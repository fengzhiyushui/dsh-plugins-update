import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { CheckUpdateParams, CheckUpdateResult, DoUpdateParams, DoUpdateResult } from './types.js';

export const name = 'dsh-plugins-update';
export const inject = ['connection'];

// Simple Semver Comparison: returns >0 if v1 > v2, <0 if v1 < v2, 0 if equal
function compareSemver(v1: string, v2: string): number {
  const clean = (v: string) => v.replace(/^v/, '').trim();
  const parts1 = clean(v1).split(/[-+]/)[0].split('.').map(n => parseInt(n, 10) || 0);
  const parts2 = clean(v2).split(/[-+]/)[0].split('.').map(n => parseInt(n, 10) || 0);

  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}

// Parse GitHub owner & repo from source string
function parseGithubSource(source?: string): { owner: string; repo: string } | null {
  if (!source) return null;

  // Patterns: github:owner/repo, https://github.com/owner/repo, owner/repo
  const cleaned = source.trim().replace(/\.git$/, '');
  const match = cleaned.match(/(?:github:|^https?:\/\/github\.com\/|^git@github\.com:)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }

  // Bare owner/repo
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(cleaned)) {
    const parts = cleaned.split('/');
    return { owner: parts[0], repo: parts[1] };
  }

  return null;
}

// Locate the profile directory where plugins are installed
function resolveProfileDir(): { dir: string; profileName: string } {
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh');
  const desktopDir = join(dshHome, 'profiles', 'desktop');

  if (existsSync(join(desktopDir, 'package.json'))) {
    return { dir: desktopDir, profileName: 'desktop' };
  }

  // Fallback to searching profiles
  const profilesDir = join(dshHome, 'profiles');
  for (const name of ['desktop', 'default', 'web']) {
    const candidate = join(profilesDir, name);
    if (existsSync(join(candidate, 'package.json'))) {
      return { dir: candidate, profileName: name };
    }
  }

  return { dir: desktopDir, profileName: 'desktop' };
}

// Fetch package metadata from GitHub repository
async function fetchGithubPackageInfo(owner: string, repo: string): Promise<{ version: string; description?: string }> {
  const urls = [
    `https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/package.json`,
    `https://fastly.jsdelivr.net/gh/${owner}/${repo}@main/package.json`,
    `https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`,
    `https://api.github.com/repos/${owner}/${repo}/contents/package.json`
  ];

  let lastError: any = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'dsh-plugins-update'
        },
        signal: AbortSignal.timeout(6000)
      });

      if (res.ok) {
        let pkgJson: any;
        if (url.includes('api.github.com')) {
          const data = await res.json() as any;
          if (data.content && data.encoding === 'base64') {
            const raw = Buffer.from(data.content, 'base64').toString('utf8');
            pkgJson = JSON.parse(raw);
          }
        } else {
          pkgJson = await res.json();
        }

        if (pkgJson && typeof pkgJson.version === 'string') {
          return {
            version: pkgJson.version,
            description: pkgJson.description
          };
        }
      }
    } catch (e) {
      lastError = e;
    }
  }

  throw lastError || new Error(`Failed to fetch package.json from GitHub (${owner}/${repo})`);
}

// Fetch package metadata from npm registry
async function fetchNpmPackageInfo(packageName: string): Promise<{ version: string; releaseDate?: string; description?: string }> {
  const registries = [
    'https://registry.npmjs.org/',
    'https://registry.npmmirror.com/'
  ];

  let lastError: any = null;
  for (const registry of registries) {
    try {
      const url = new URL(encodeURIComponent(packageName).replace(/^%40/, '@') + '/latest', registry).toString();
      const res = await fetch(url, {
        headers: { 'accept': 'application/json' },
        signal: AbortSignal.timeout(6000)
      });
      if (res.ok) {
        const data = await res.json() as any;
        return {
          version: data.version,
          releaseDate: data.time?.[data.version],
          description: data.description
        };
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(`Package ${packageName} not found on npm`);
}

// Run update command using the best available tool
async function runUpdateCommand(
  profileDir: string,
  profileName: string,
  packageName: string,
  targetVersion?: string,
  source?: string
): Promise<{ ok: boolean; output: string; error?: string }> {
  let spec: string;
  const gh = parseGithubSource(source);

  if (gh) {
    // If installed via GitHub, update using github spec
    spec = `github:${gh.owner}/${gh.repo}`;
  } else if (targetVersion) {
    spec = `${packageName}@${targetVersion}`;
  } else {
    spec = `${packageName}@latest`;
  }

  // Candidate commands
  const execDir = process.execPath ? join(process.execPath, '..') : '';
  const dshCmdPaths = [
    join(execDir, 'resources', 'runtime', 'cli', 'bin', 'dsh.cmd'),
    'D:\\dsh\\resources\\runtime\\cli\\bin\\dsh.cmd',
    'C:\\dsh\\resources\\runtime\\cli\\bin\\dsh.cmd',
    join(process.env.LOCALAPPDATA || '', 'Programs', 'DeepSeek Harness', 'resources', 'runtime', 'cli', 'bin', 'dsh.cmd')
  ];

  let command = 'pnpm';
  let args = ['update', spec];
  let useShell = process.platform === 'win32';

  for (const p of dshCmdPaths) {
    if (existsSync(p)) {
      command = p;
      args = ['plugin', '--profile', profileName, 'update', spec];
      break;
    }
  }

  return new Promise((resolve) => {
    let output = '';
    let settled = false;

    try {
      const child = spawn(command, args, {
        cwd: profileDir,
        shell: useShell,
        env: {
          ...process.env,
          npm_config_registry: process.env.npm_config_registry || 'https://registry.npmmirror.com/'
        }
      });

      child.stdout?.on('data', (data) => {
        output += data.toString();
      });

      child.stderr?.on('data', (data) => {
        output += data.toString();
      });

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        resolve({
          ok: false,
          output,
          error: `Process error: ${err.message}`
        });
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        if (code === 0) {
          resolve({ ok: true, output });
        } else {
          resolve({
            ok: false,
            output,
            error: `Update process exited with code ${code}`
          });
        }
      });

      // Timeout after 2 minutes
      setTimeout(() => {
        if (!settled) {
          settled = true;
          try { child.kill(); } catch {}
          resolve({
            ok: false,
            output,
            error: 'Update command timed out after 120 seconds'
          });
        }
      }, 120000);

    } catch (e: any) {
      resolve({
        ok: false,
        output: '',
        error: e?.message || 'Failed to spawn update process'
      });
    }
  });
}

export function apply(ctx: any) {
  const conn = ctx.get('connection');
  const registerFetch = conn?.fetch?.register?.bind(conn.fetch);

  if (typeof registerFetch !== 'function') {
    return;
  }

  // 1. API: Check update for a package (Supports npm & GitHub)
  ctx.effect(() => registerFetch({
    path: '/api/dsh-plugins-update/check',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (req: Request) => {
      try {
        const body = (await req.json()) as CheckUpdateParams;
        if (!body.packageName) {
          return Response.json({ ok: false, error: 'packageName is required' } as CheckUpdateResult, { status: 400 });
        }

        const current = body.currentVersion || '0.0.0';
        const gh = parseGithubSource(body.source) || parseGithubSource(body.packageName);

        let latestVersion = current;
        let releaseDate: string | undefined;
        let description: string | undefined;
        let isGithub = false;

        if (gh) {
          // Check GitHub repo
          isGithub = true;
          try {
            const ghInfo = await fetchGithubPackageInfo(gh.owner, gh.repo);
            latestVersion = ghInfo.version;
            description = ghInfo.description;
          } catch (ghErr: any) {
            // If GitHub fails, fallback to npm
            try {
              const npmInfo = await fetchNpmPackageInfo(body.packageName);
              latestVersion = npmInfo.version;
              releaseDate = npmInfo.releaseDate;
              description = npmInfo.description;
              isGithub = false;
            } catch {
              throw ghErr;
            }
          }
        } else {
          // Normal npm package
          try {
            const npmInfo = await fetchNpmPackageInfo(body.packageName);
            latestVersion = npmInfo.version;
            releaseDate = npmInfo.releaseDate;
            description = npmInfo.description;
          } catch (npmErr: any) {
            // Check if it might be a GitHub repo from manifest or name
            throw npmErr;
          }
        }

        const hasUpdate = compareSemver(latestVersion, current) > 0;

        const result: CheckUpdateResult = {
          ok: true,
          packageName: body.packageName,
          currentVersion: current,
          latestVersion,
          hasUpdate,
          releaseDate,
          description,
          source: body.source,
          isGithub
        };

        return Response.json(result, {
          headers: { 'cache-control': 'no-store' }
        });
      } catch (err: any) {
        // Return friendly message instead of crash
        return Response.json({
          ok: false,
          packageName: '',
          hasUpdate: false,
          error: err?.message || 'Check failed'
        } as CheckUpdateResult, { status: 200 });
      }
    }
  }), 'dsh-plugins-update: check route');

  // 2. API: Execute plugin update
  ctx.effect(() => registerFetch({
    path: '/api/dsh-plugins-update/update',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (req: Request) => {
      try {
        const body = (await req.json()) as DoUpdateParams;
        if (!body.packageName) {
          return Response.json({ ok: false, error: 'packageName is required' } as DoUpdateResult, { status: 400 });
        }

        const { dir, profileName } = resolveProfileDir();
        const runRes = await runUpdateCommand(dir, profileName, body.packageName, body.targetVersion, body.source);

        const result: DoUpdateResult = {
          ok: runRes.ok,
          packageName: body.packageName,
          targetVersion: body.targetVersion,
          source: body.source,
          output: runRes.output,
          error: runRes.error
        };

        return Response.json(result, {
          headers: { 'cache-control': 'no-store' }
        });
      } catch (err: any) {
        return Response.json({
          ok: false,
          packageName: '',
          error: err?.message || 'Update failed'
        } as DoUpdateResult, { status: 200 });
      }
    }
  }), 'dsh-plugins-update: update route');
}
