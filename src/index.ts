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

// Parse GitHub owner & repo from any string (spec, url, repository field)
function parseGithubSource(str?: string): { owner: string; repo: string } | null {
  if (!str) return null;

  const cleaned = str.trim().replace(/\.git$/, '');
  const match = cleaned.match(/(?:github:|^https?:\/\/github\.com\/|^git@github\.com:|^git\+https:\/\/github\.com\/)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }

  // Bare owner/repo (e.g. fengzhiyushui/dsh-plugins-update)
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

// Read installed version directly from node_modules/<packageName>/package.json on disk
function readInstalledVersion(profileDir: string, packageName: string): string | undefined {
  const installedPkgJsonPath = join(profileDir, 'node_modules', packageName, 'package.json');
  if (existsSync(installedPkgJsonPath)) {
    try {
      const pkgJson = JSON.parse(readFileSync(installedPkgJsonPath, 'utf8'));
      if (typeof pkgJson.version === 'string' && pkgJson.version.trim()) {
        return pkgJson.version.trim();
      }
    } catch {}
  }
  return undefined;
}

// Resolve package origin from profile manifest and installed node_modules
function resolvePackageOrigin(
  profileDir: string,
  packageName: string,
  explicitSource?: string
): {
  isGithub: boolean;
  github?: { owner: string; repo: string };
  repoGithub?: { owner: string; repo: string };
  declaredSpec?: string;
} {
  // Read repository metadata from installed package.json as fallback info only (NOT install origin)
  let repoGithub: { owner: string; repo: string } | undefined;
  const installedPkgJsonPath = join(profileDir, 'node_modules', packageName, 'package.json');
  if (existsSync(installedPkgJsonPath)) {
    try {
      const pkgJson = JSON.parse(readFileSync(installedPkgJsonPath, 'utf8'));
      const repoUrl = typeof pkgJson.repository === 'string' ? pkgJson.repository : pkgJson.repository?.url;
      const parsedRepo = parseGithubSource(repoUrl);
      if (parsedRepo) repoGithub = parsedRepo;
    } catch {}
  }

  // 1. Check explicit source passed from client
  let gh = parseGithubSource(explicitSource);
  if (gh) return { isGithub: true, github: gh, repoGithub: repoGithub || gh, declaredSpec: explicitSource };

  // 2. Check profile's package.json dependencies
  const manifestPath = join(profileDir, 'package.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const spec =
        manifest?.dependencies?.[packageName] ||
        manifest?.devDependencies?.[packageName] ||
        manifest?.optionalDependencies?.[packageName];
      if (typeof spec === 'string') {
        gh = parseGithubSource(spec);
        if (gh) {
          return { isGithub: true, github: gh, repoGithub: repoGithub || gh, declaredSpec: spec };
        }
        // Installed via npm registry / version range
        return { isGithub: false, repoGithub, declaredSpec: spec };
      }
    } catch {}
  }

  return { isGithub: false, repoGithub };
}

// Fetch package metadata from GitHub repository (fast multi-source race)
async function fetchGithubPackageInfo(owner: string, repo: string): Promise<{ version: string; description?: string }> {
  const fetchEndpoints = [
    async () => {
      const res = await fetch(`https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/package.json`, {
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },
    async () => {
      const res = await fetch(`https://fastly.jsdelivr.net/gh/${owner}/${repo}@main/package.json`, {
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },
    async () => {
      const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`, {
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },
    async () => {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, {
        headers: { 'User-Agent': 'dsh-plugins-update', 'Accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as any;
      if (data.content && data.encoding === 'base64') {
        return JSON.parse(Buffer.from(data.content, 'base64').toString('utf8'));
      }
      throw new Error('Invalid format');
    }
  ];

  try {
    const pkgJson = await Promise.any(fetchEndpoints.map(fn => fn()));
    if (pkgJson && typeof pkgJson.version === 'string') {
      return {
        version: pkgJson.version,
        description: pkgJson.description
      };
    }
  } catch {}

  throw new Error(`Failed to read package.json from GitHub (${owner}/${repo})`);
}

// Fetch package metadata from npm registry (prioritize fast domestic mirrors)
async function fetchNpmPackageInfo(packageName: string): Promise<{ version: string; releaseDate?: string; description?: string }> {
  const encodedName = encodeURIComponent(packageName).replace(/^%40/, '@');

  const fetchEndpoints = [
    // 1. npmmirror (China domestic high speed, primary)
    async () => {
      const res = await fetch(`https://registry.npmmirror.com/${encodedName}/latest`, {
        headers: { 'accept': 'application/json' },
        signal: AbortSignal.timeout(4000)
      });
      if (!res.ok) throw new Error(`npmmirror HTTP ${res.status}`);
      return await res.json();
    },
    // 2. npmjs.org official
    async () => {
      const res = await fetch(`https://registry.npmjs.org/${encodedName}/latest`, {
        headers: { 'accept': 'application/json' },
        signal: AbortSignal.timeout(5000)
      });
      if (!res.ok) throw new Error(`npmjs HTTP ${res.status}`);
      return await res.json();
    }
  ];

  try {
    const data = await Promise.any(fetchEndpoints.map(fn => fn()));
    if (data && typeof data.version === 'string') {
      return {
        version: data.version,
        releaseDate: data.time?.[data.version],
        description: data.description
      };
    }
  } catch {}

  throw new Error(`Package ${packageName} not found on npm`);
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
  const origin = resolvePackageOrigin(profileDir, packageName, source);
  const cleanTarget = targetVersion ? targetVersion.replace(/^[v^~]/, '').trim() : '';

  if (origin.isGithub && origin.github) {
    // If installed via GitHub, re-add using github spec
    spec = `github:${origin.github.owner}/${origin.github.repo}`;
  } else if (cleanTarget) {
    spec = `${packageName}@${cleanTarget}`;
  } else {
    spec = `${packageName}@latest`;
  }

  const registryFlag = '--registry=https://registry.npmmirror.com/';

  // Candidate commands
  const execDir = process.execPath ? join(process.execPath, '..') : '';
  const dshCmdPaths = [
    join(execDir, 'resources', 'runtime', 'cli', 'bin', 'dsh.cmd'),
    'D:\\dsh\\resources\\runtime\\cli\\bin\\dsh.cmd',
    'C:\\dsh\\resources\\runtime\\cli\\bin\\dsh.cmd',
    join(process.env.LOCALAPPDATA || '', 'Programs', 'DeepSeek Harness', 'resources', 'runtime', 'cli', 'bin', 'dsh.cmd')
  ];

  let command = 'pnpm';
  let args = ['add', spec, registryFlag];
  const useShell = process.platform === 'win32';

  for (const p of dshCmdPaths) {
    if (existsSync(p)) {
      command = useShell && p.includes(' ') ? `"${p}"` : p;
      args = ['plugin', '--profile', profileName, 'add', spec, registryFlag];
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

      const timeoutTimer = setTimeout(() => {
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
      timeoutTimer.unref?.();

      child.on('error', (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        resolve({
          ok: false,
          output,
          error: `Process error: ${err.message}`
        });
      });

      child.on('close', (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        if (code === 0) {
          const afterVersion = readInstalledVersion(profileDir, packageName);
          if (!origin.isGithub && cleanTarget && afterVersion && compareSemver(afterVersion, cleanTarget) < 0) {
            resolve({
              ok: false,
              output,
              error: `Update process exited with 0, but installed version remained ${afterVersion} (expected ${cleanTarget})`
            });
            return;
          }
          resolve({ ok: true, output });
        } else {
          resolve({
            ok: false,
            output,
            error: `Update process exited with code ${code}`
          });
        }
      });

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

        const { dir } = resolveProfileDir();
        const diskVersion = readInstalledVersion(dir, body.packageName);
        const clientVersion = body.currentVersion || '0.0.0';
        const current =
          diskVersion && compareSemver(diskVersion, clientVersion) > 0
            ? diskVersion
            : clientVersion || diskVersion || '0.0.0';
        const origin = resolvePackageOrigin(dir, body.packageName, body.source);

        let latestVersion = current;
        let releaseDate: string | undefined;
        let description: string | undefined;
        let isGithub = false;

        if (origin.isGithub && origin.github) {
          // GitHub package
          isGithub = true;
          try {
            const ghInfo = await fetchGithubPackageInfo(origin.github.owner, origin.github.repo);
            latestVersion = ghInfo.version;
            description = ghInfo.description;
          } catch (ghErr) {
            // Fallback: check npm
            try {
              const npmInfo = await fetchNpmPackageInfo(body.packageName);
              latestVersion = npmInfo.version;
              releaseDate = npmInfo.releaseDate;
              description = npmInfo.description;
              isGithub = false;
            } catch {
              // If both not reachable, treat current as latest without throwing fatal error
              latestVersion = current;
            }
          }
        } else {
          // Normal npm package
          try {
            const npmInfo = await fetchNpmPackageInfo(body.packageName);
            latestVersion = npmInfo.version;
            releaseDate = npmInfo.releaseDate;
            description = npmInfo.description;
          } catch {
            // Fallback: check if package has github repository declared in package.json
            const fallbackGh = origin.repoGithub || origin.github;
            if (fallbackGh) {
              try {
                const ghInfo = await fetchGithubPackageInfo(fallbackGh.owner, fallbackGh.repo);
                latestVersion = ghInfo.version;
                description = ghInfo.description;
              } catch {
                latestVersion = current;
              }
            } else {
              latestVersion = current;
            }
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
          source: body.source || origin.declaredSpec,
          isGithub
        };

        return Response.json(result, {
          headers: { 'cache-control': 'no-store' }
        });
      } catch (err: any) {
        // Return friendly message instead of crash
        return Response.json({
          ok: true,
          packageName: '',
          hasUpdate: false,
          latestVersion: '0.0.0',
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

        if (runRes.ok) {
          try {
            const packages = ctx.get?.('pluginPackages');
            if (packages?.refresh) await packages.refresh();
          } catch {}
          try {
            const hmr = ctx.get?.('hmr');
            if (hmr?.reconcileProfile) await hmr.reconcileProfile([]);
          } catch {}
          try {
            ctx.emit?.('plugin-manager/changed', { reason: 'install' });
          } catch {}
        }

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
