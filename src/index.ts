import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import Schema from '@deepseek-ai/schemastery';
import {
  DOMESTIC_REGISTRY,
  OFFICIAL_REGISTRY,
  normalizeRegistryUrl,
  registryLabel,
  type CheckUpdateParams,
  type CheckUpdateResult,
  type CustomRegistry,
  type DoUpdateParams,
  type DoUpdateResult,
  type PluginSettings
} from './types.js';

export const name = 'dsh-plugins-update';
export const inject = ['connection'];

/** This plugin's own package name; updating it from inside its own request needs a restart. */
const OWN_PACKAGE_NAME = 'dsh-plugins-update';
/** npm package name rules: lower-case, optional scope, at most 214 characters. */
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;
/** Exact semantic version accepted as an update target (a leading v/^/~ is stripped first). */
const TARGET_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
/** Characters safe to place on a shell command line for the guarded pnpm fallback path. */
const SHELL_SAFE_PATTERN = /^[A-Za-z0-9@._~:/\\+=,-]+$/;
const INSTALL_TIMEOUT_MS = 120_000;

/** Validate an npm package name from an HTTP request; returns undefined when invalid. */
function readPackageName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const packageName = value.trim();
  if (!packageName || packageName.length > 214 || !PACKAGE_NAME_PATTERN.test(packageName)) return undefined;
  return packageName;
}

/** Validate the requested update target; `undefined` means "latest", `null` means invalid. */
function readTargetVersion(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return null;
  const version = value.trim().replace(/^[v^~]/, '');
  if (!version) return undefined;
  return TARGET_VERSION_PATTERN.test(version) ? version : null;
}

/** `@deepseek-ai/*` packages are official, even on DSH versions that do not expose `official` to slots. */
function isOfficialPackageName(packageName: string): boolean {
  return packageName.startsWith('@deepseek-ai/');
}

// Mark a schema volatile when the running schemastery supports it, so setting changes apply without a restart
function live<T>(schema: T): T {
  const s = schema as any;
  return typeof s?.volatile === 'function' ? s.volatile() : schema;
}

// Plugin configuration (persisted by DSH in the profile's cordis.patch.yml under `id: dsh-plugins-update`)
export const Config: Schema<any> = Schema.object({
  registry: live(
    Schema.string()
      .default('auto')
      .description('更新源：auto（自动）/ npmjs（npm 官方源）/ npmmirror（DSH 同款国内源）/ 自定义源 URL')
  ),
  customRegistries: live(
    Schema.array(
      Schema.object({
        name: Schema.string().default(''),
        url: Schema.string().default('')
      })
    )
      .default([])
      .description('用户自行添加的更新源列表')
  ),
  fallbackToOfficial: live(
    Schema.boolean()
      .default(true)
      .description('使用非官方源更新失败时，自动改用 npm 官方源重试一次')
  )
});

// Read a config field that may be a plain value or a volatile wrapper with `.get()`
function readField<T>(field: any, fallback: T): T {
  let raw: any = field;
  if (field && typeof field === 'object' && typeof field.get === 'function') {
    try {
      raw = field.get();
    } catch {
      raw = undefined;
    }
  }
  return raw === undefined || raw === null ? fallback : (raw as T);
}

function readSettings(config: any): PluginSettings {
  const registryRaw = readField<string>(config?.registry, 'auto');
  const customRaw = readField<any[]>(config?.customRegistries, []);
  const fallback = readField<boolean>(config?.fallbackToOfficial, true);

  const customRegistries: CustomRegistry[] = Array.isArray(customRaw)
    ? customRaw
        .map(item => ({
          name: typeof item?.name === 'string' ? item.name.trim() : '',
          url: normalizeRegistryUrl(item?.url) ?? ''
        }))
        .filter(item => item.url)
    : [];

  let registry = typeof registryRaw === 'string' ? registryRaw.trim() : 'auto';
  if (registry !== 'auto' && registry !== 'npmjs' && registry !== 'npmmirror') {
    registry = normalizeRegistryUrl(registry) ?? 'auto';
  }

  return { registry, customRegistries, fallbackToOfficial: fallback !== false };
}

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

// Profile directories this installation may serve, preferring the active/desktop profile.
function profileCandidates(): Array<{ dir: string; profileName: string }> {
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh');
  const profilesDir = join(dshHome, 'profiles');
  const preferred = (process.env.DSH_PROFILE || '').trim();
  const names = [...new Set([preferred, 'desktop', 'default', 'web'].filter(Boolean))];

  const candidates = names
    .map(profileName => ({ dir: join(profilesDir, profileName), profileName }))
    .filter(candidate => existsSync(join(candidate.dir, 'package.json')));

  if (candidates.length === 0) candidates.push({ dir: join(profilesDir, 'desktop'), profileName: 'desktop' });
  return candidates;
}

// Locate the profile directory that owns the package, falling back to the desktop profile.
function resolveProfileDir(packageName?: string): { dir: string; profileName: string } {
  const candidates = profileCandidates();

  if (packageName) {
    const owner = candidates.find(candidate => {
      const dependencies = readProfileDependencies(candidate.dir);
      return Object.prototype.hasOwnProperty.call(dependencies, packageName);
    });
    if (owner) return owner;
  }

  return candidates.find(candidate => candidate.profileName === 'desktop') ?? candidates[0];
}

/** The subset of the Host plugin manager's `BundleInfo` this plugin relies on. */
interface BundleInfo {
  name?: string;
  official?: boolean;
  installed?: boolean;
  availability?: string;
  /** The spec `pnpm add` accepts for a profile dependency (GitHub installs appear as `github:owner/repo`). */
  source?: string;
  removable?: boolean;
  installTarget?: { spec?: string; version?: string };
}

/** Best-effort read of the Host plugin-manager metadata for one bundle; undefined when unavailable. */
async function readBundleInfo(ctx: any, packageName: string): Promise<BundleInfo | undefined> {
  for (const service of ['pluginManager', 'plugin-manager']) {
    try {
      const manager = ctx?.get?.(service);
      if (typeof manager?.listBundles !== 'function') continue;
      const bundles = await manager.listBundles();
      if (!Array.isArray(bundles)) continue;
      const bundle = bundles.find((item: any) => item && item.name === packageName);
      if (bundle) return bundle as BundleInfo;
    } catch {}
  }
  return undefined;
}

// Reject official plugins (DSH owns their update entry) and bundles the profile does not install.
function bundleGuardError(packageName: string, bundle: BundleInfo | undefined): string | undefined {
  if (bundle?.official === true) {
    return '官方插件由 DSH 自带的更新入口管理，请使用插件页右上角的「更新」按钮';
  }
  if (bundle?.installed === false) {
    return '该插件未安装到当前 profile，无法更新';
  }
  // Older DSH versions may not report `official`; official packages all live in this npm scope.
  if (!bundle && isOfficialPackageName(packageName)) {
    return '官方插件由 DSH 自带的更新入口管理，请使用插件页右上角的「更新」按钮';
  }
  return undefined;
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

// Read the profile manifest's direct dependencies
function readProfileDependencies(profileDir: string): Record<string, string> {
  const manifestPath = join(profileDir, 'package.json');
  if (!existsSync(manifestPath)) return {};
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return {
      ...(manifest?.optionalDependencies || {}),
      ...(manifest?.devDependencies || {}),
      ...(manifest?.dependencies || {})
    };
  } catch {
    return {};
  }
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

function encodePackageName(packageName: string): string {
  return encodeURIComponent(packageName).replace(/^%40/, '@');
}

// Registries consulted for version checks, by setting
function checkRegistries(settings: PluginSettings): string[] {
  switch (settings.registry) {
    case 'auto':
      return [DOMESTIC_REGISTRY, OFFICIAL_REGISTRY];
    case 'npmjs':
      return [OFFICIAL_REGISTRY];
    case 'npmmirror':
      return [DOMESTIC_REGISTRY];
    default:
      return [settings.registry];
  }
}

async function fetchLatestFrom(registry: string, packageName: string) {
  const res = await fetch(`${registry}${encodePackageName(packageName)}/latest`, {
    headers: { 'accept': 'application/json' },
    signal: AbortSignal.timeout(5000)
  });
  if (!res.ok) throw new Error(`${registry} HTTP ${res.status}`);
  const data = (await res.json()) as any;
  if (!data || typeof data.version !== 'string') throw new Error(`${registry} returned no version`);
  return {
    version: data.version as string,
    releaseDate: data.time?.[data.version] as string | undefined,
    description: data.description as string | undefined,
    registry
  };
}

// Fetch package metadata from the configured registries.
// In auto mode both built-in registries are queried and the HIGHEST version wins,
// so a lagging mirror can no longer hide a newer release.
async function fetchNpmPackageInfo(
  packageName: string,
  settings: PluginSettings
): Promise<{ version: string; releaseDate?: string; description?: string; registry: string }> {
  const registries = checkRegistries(settings);

  const pickHighest = (results: PromiseSettledResult<Awaited<ReturnType<typeof fetchLatestFrom>>>[]) => {
    let best: Awaited<ReturnType<typeof fetchLatestFrom>> | undefined;
    for (const r of results) {
      if (r.status !== 'fulfilled') continue;
      if (!best || compareSemver(r.value.version, best.version) > 0) best = r.value;
    }
    return best;
  };

  let best = pickHighest(await Promise.allSettled(registries.map(reg => fetchLatestFrom(reg, packageName))));

  if (!best && settings.fallbackToOfficial && !registries.includes(OFFICIAL_REGISTRY)) {
    best = pickHighest(await Promise.allSettled([fetchLatestFrom(OFFICIAL_REGISTRY, packageName)]));
  }

  if (best) return best;
  throw new Error(`Package ${packageName} not found on ${registries.join(', ')}`);
}

// --- Registry selection for installs -------------------------------------------------

// Ping a registry; resolves with the URL on a 2xx response, rejects otherwise
async function pingRegistry(registry: string, timeoutMs: number): Promise<string> {
  const res = await fetch(`${registry}-/ping`, { signal: AbortSignal.timeout(timeoutMs), redirect: 'manual' });
  try {
    await res.body?.cancel();
  } catch {}
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
  return registry;
}

// Same probing approach DSH's "Add plugin" dialog uses: first 2xx ping wins
async function probeFastestRegistry(): Promise<string | null> {
  try {
    return await Promise.any([pingRegistry(OFFICIAL_REGISTRY, 1500), pingRegistry(DOMESTIC_REGISTRY, 1500)]);
  } catch {
    return null;
  }
}

async function versionExists(registry: string, packageName: string, version: string): Promise<boolean> {
  try {
    const res = await fetch(`${registry}${encodePackageName(packageName)}/${encodeURIComponent(version)}`, {
      headers: { 'accept': 'application/json' },
      signal: AbortSignal.timeout(5000)
    });
    try {
      await res.body?.cancel();
    } catch {}
    return res.ok;
  } catch {
    return false;
  }
}

function isRegistrySpec(spec: string): boolean {
  const s = spec.trim();
  if (!s) return false;
  if (/^(?:github:|gitlab:|bitbucket:|git[+:]|git@|https?:|file:|link:|workspace:|npm:|portal:|patch:)/i.test(s)) return false;
  if (parseGithubSource(s)) return false; // bare owner/repo
  return true;
}

// Every `name@version` pnpm will have to resolve from the registry during this install
function collectRequiredVersions(
  profileDir: string,
  packageName: string,
  targetVersion: string,
  targetIsGithub: boolean
): Array<{ name: string; version: string }> {
  const required: Array<{ name: string; version: string }> = [];
  const deps = readProfileDependencies(profileDir);

  for (const [dep, spec] of Object.entries(deps)) {
    if (dep === packageName) continue;
    if (typeof spec !== 'string' || !isRegistrySpec(spec)) continue;
    const installed = readInstalledVersion(profileDir, dep);
    if (installed) required.push({ name: dep, version: installed });
  }

  if (!targetIsGithub && targetVersion) {
    required.push({ name: packageName, version: targetVersion });
  }
  return required;
}

async function resolveInstallRegistry(
  settings: PluginSettings,
  profileDir: string,
  packageName: string,
  targetVersion: string,
  targetIsGithub: boolean
): Promise<{ registry: string; reason: string }> {
  if (settings.registry === 'npmjs') return { registry: OFFICIAL_REGISTRY, reason: '设置中指定' };
  if (settings.registry === 'npmmirror') return { registry: DOMESTIC_REGISTRY, reason: '设置中指定' };
  if (settings.registry !== 'auto') return { registry: settings.registry, reason: '设置中指定' };

  // auto
  const fastest = await probeFastestRegistry();
  if (fastest === OFFICIAL_REGISTRY) {
    return { registry: OFFICIAL_REGISTRY, reason: '自动模式：npm 官方源响应更快' };
  }

  // Domestic registry is faster (or both pings failed): make sure it actually has everything this install needs
  const required = collectRequiredVersions(profileDir, packageName, targetVersion, targetIsGithub);
  const present = await Promise.all(required.map(r => versionExists(DOMESTIC_REGISTRY, r.name, r.version)));
  const missing = required.filter((_, i) => !present[i]);

  if (missing.length === 0) {
    return { registry: DOMESTIC_REGISTRY, reason: '自动模式：国内源响应更快，且包含本次所需的全部版本' };
  }
  return {
    registry: OFFICIAL_REGISTRY,
    reason: `自动模式：国内源暂缺 ${missing.map(m => `${m.name}@${m.version}`).join('、')}，改用 npm 官方源`
  };
}

// --- Install execution -----------------------------------------------------------------

/** Candidate `cli.js` entries of the DSH desktop Host, next to the running executable. */
function desktopCliCandidates(): string[] {
  const candidates: string[] = [];
  const override = process.env.DSH_CLI_JS?.trim();
  if (override) candidates.push(override);

  const cliRel = join('resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js');
  const execDir = process.execPath ? dirname(process.execPath) : '';
  if (execDir) {
    candidates.push(join(execDir, cliRel));
    candidates.push(join(execDir, '..', 'Resources', cliRel));
  }
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) candidates.push(join(localAppData, 'Programs', 'DeepSeek Harness', cliRel));
  return candidates;
}

/**
 * Build the install command without letting request data reach a shell.
 * The DSH CLI is started the same way `dsh.cmd` starts it (Electron in Node mode + `cli.js`);
 * only the guarded pnpm fallback needs a shell on Windows.
 */
function buildInstallCommand(
  profileName: string,
  spec: string,
  registry: string
): { command: string; args: string[]; env: NodeJS.ProcessEnv } | { error: string } {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // Keep the env registry identical to the --registry flag
    npm_config_registry: registry,
    ELECTRON_RUN_AS_NODE: '1'
  };

  const cliJs = desktopCliCandidates().find(candidate => existsSync(candidate));
  if (cliJs) {
    return {
      command: process.execPath,
      args: ['--expose-internals', cliJs, 'plugin', '--profile', profileName, 'add', spec, `--registry=${registry}`],
      env
    };
  }

  if ([profileName, spec, registry].some(value => !SHELL_SAFE_PATTERN.test(value))) {
    return { error: 'Could not locate the DSH CLI and the pnpm fallback would need unsafe characters' };
  }
  if (process.platform === 'win32') {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', `pnpm add ${spec} --registry=${registry}`],
      env
    };
  }
  return { command: 'pnpm', args: ['add', spec, `--registry=${registry}`], env };
}

function runInstall(
  profileDir: string,
  profileName: string,
  spec: string,
  registry: string
): Promise<{ ok: boolean; output: string; error?: string }> {
  const plan = buildInstallCommand(profileName, spec, registry);
  if ('error' in plan) {
    return Promise.resolve({ ok: false, output: '', error: plan.error });
  }

  return new Promise((resolve) => {
    let output = '';
    let settled = false;

    try {
      const child = spawn(plan.command, plan.args, {
        cwd: profileDir,
        shell: false,
        windowsHide: true,
        env: plan.env
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
            error: `Update command timed out after ${INSTALL_TIMEOUT_MS / 1000} seconds`
          });
        }
      }, INSTALL_TIMEOUT_MS);
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

// Run update command using the configured registry, with optional fallback to the official registry
async function runUpdateCommand(
  settings: PluginSettings,
  profileDir: string,
  profileName: string,
  packageName: string,
  targetVersion?: string,
  source?: string
): Promise<{ ok: boolean; output: string; error?: string; registryUsed: string; fellBack: boolean }> {
  let spec: string;
  const origin = resolvePackageOrigin(profileDir, packageName, source);
  const cleanTarget = targetVersion ? targetVersion.replace(/^[v^~]/, '').trim() : '';
  if (cleanTarget && !TARGET_VERSION_PATTERN.test(cleanTarget)) {
    return { ok: false, output: '', error: `无效的目标版本: ${targetVersion}`, registryUsed: '', fellBack: false };
  }

  if (origin.isGithub && origin.github) {
    // If installed via GitHub, re-add using github spec
    spec = `github:${origin.github.owner}/${origin.github.repo}`;
  } else if (cleanTarget) {
    spec = `${packageName}@${cleanTarget}`;
  } else {
    spec = `${packageName}@latest`;
  }

  const plan = await resolveInstallRegistry(settings, profileDir, packageName, cleanTarget, origin.isGithub);
  const label = (url: string) => registryLabel(url, settings.customRegistries);

  let output = `[dsh-plugins-update] 使用 ${label(plan.registry)}（${plan.registry}）— ${plan.reason}\n`;
  let attempt = await runInstall(profileDir, profileName, spec, plan.registry);
  output += attempt.output;
  let registryUsed = plan.registry;
  let fellBack = false;

  if (!attempt.ok && settings.fallbackToOfficial && plan.registry !== OFFICIAL_REGISTRY) {
    output += `\n[dsh-plugins-update] ${label(plan.registry)} 更新失败（${attempt.error || 'unknown'}），改用 npm 官方源（${OFFICIAL_REGISTRY}）重试…\n`;
    attempt = await runInstall(profileDir, profileName, spec, OFFICIAL_REGISTRY);
    output += attempt.output;
    registryUsed = OFFICIAL_REGISTRY;
    fellBack = true;
  }

  if (attempt.ok) {
    const afterVersion = readInstalledVersion(profileDir, packageName);
    if (!origin.isGithub && cleanTarget && afterVersion && compareSemver(afterVersion, cleanTarget) < 0) {
      return {
        ok: false,
        output,
        error: `Update process exited with 0, but installed version remained ${afterVersion} (expected ${cleanTarget})`,
        registryUsed,
        fellBack
      };
    }
    return { ok: true, output, registryUsed, fellBack };
  }

  return { ok: false, output, error: attempt.error, registryUsed, fellBack };
}

export function apply(ctx: any, config: any) {
  const conn = ctx.get('connection');
  const registerFetch = conn?.fetch?.register?.bind(conn.fetch);

  if (typeof registerFetch !== 'function') {
    return;
  }

  // One install at a time per profile: concurrent `pnpm add` runs would race on the same node_modules.
  const installing = new Set<string>();

  // Refresh the Host plugin list after an install; delayed for self-updates so the HTTP response can leave first.
  const refreshAfterInstall = async () => {
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
  };

  // 1. API: Check update for a package (Supports npm & GitHub)
  ctx.effect(() => registerFetch({
    path: '/api/dsh-plugins-update/check',
    methods: ['POST'],
    requestBody: 'buffered',
    fetch: async (req: Request) => {
      try {
        const body = ((await req.json().catch(() => ({}))) ?? {}) as CheckUpdateParams & { packageName?: unknown };
        const packageName = readPackageName(body?.packageName);
        if (!packageName) {
          return Response.json({ ok: false, packageName: '', hasUpdate: false, error: 'packageName 必须是合法的 npm 包名' } as CheckUpdateResult, { status: 400 });
        }

        const settings = readSettings(config);
        const bundle = await readBundleInfo(ctx, packageName);
        const blocked = bundleGuardError(packageName, bundle);
        if (blocked) {
          return Response.json({ ok: false, packageName, hasUpdate: false, error: blocked } as CheckUpdateResult, { status: 200 });
        }

        const { dir } = resolveProfileDir(packageName);
        const diskVersion = readInstalledVersion(dir, packageName);
        const clientVersion = typeof body.currentVersion === 'string' && body.currentVersion ? body.currentVersion : '0.0.0';
        const current =
          diskVersion && compareSemver(diskVersion, clientVersion) > 0
            ? diskVersion
            : clientVersion || diskVersion || '0.0.0';
        const origin = resolvePackageOrigin(
          dir,
          packageName,
          typeof body.source === 'string' && body.source ? body.source : bundle?.source
        );

        let latestVersion = current;
        let releaseDate: string | undefined;
        let description: string | undefined;
        let registry: string | undefined;
        let isGithub = false;
        let fetched = false;
        let fetchError = '';

        if (origin.isGithub && origin.github) {
          // GitHub-installed package: read the repository first, then fall back to npm.
          isGithub = true;
          try {
            const ghInfo = await fetchGithubPackageInfo(origin.github.owner, origin.github.repo);
            latestVersion = ghInfo.version;
            description = ghInfo.description;
            fetched = true;
          } catch (ghErr: any) {
            fetchError = ghErr?.message || 'GitHub request failed';
            try {
              const npmInfo = await fetchNpmPackageInfo(packageName, settings);
              latestVersion = npmInfo.version;
              releaseDate = npmInfo.releaseDate;
              description = npmInfo.description;
              registry = npmInfo.registry;
              isGithub = false;
              fetched = true;
            } catch (npmErr: any) {
              fetchError += `；${npmErr?.message || 'npm request failed'}`;
            }
          }
        } else {
          // Normal npm package.
          try {
            const npmInfo = await fetchNpmPackageInfo(packageName, settings);
            latestVersion = npmInfo.version;
            releaseDate = npmInfo.releaseDate;
            description = npmInfo.description;
            registry = npmInfo.registry;
            fetched = true;
          } catch (npmErr: any) {
            fetchError = npmErr?.message || 'npm request failed';
            // Fallback: check the GitHub repository declared by the installed package.
            const fallbackGh = origin.repoGithub || origin.github;
            if (fallbackGh) {
              try {
                const ghInfo = await fetchGithubPackageInfo(fallbackGh.owner, fallbackGh.repo);
                latestVersion = ghInfo.version;
                description = ghInfo.description;
                fetched = true;
              } catch (ghErr: any) {
                fetchError += `；${ghErr?.message || 'GitHub request failed'}`;
              }
            }
          }
        }

        if (!fetched) {
          // A failed lookup must never be reported as "already up to date".
          return Response.json({
            ok: false,
            packageName,
            currentVersion: current,
            latestVersion: current,
            hasUpdate: false,
            isGithub,
            error: `无法获取远端版本信息：${fetchError || '网络不可达'}`
          } as CheckUpdateResult, { status: 200 });
        }

        const hasUpdate = compareSemver(latestVersion, current) > 0;

        const result: CheckUpdateResult = {
          ok: true,
          packageName,
          currentVersion: current,
          latestVersion,
          hasUpdate,
          releaseDate,
          description,
          source: origin.declaredSpec,
          isGithub,
          registry
        };

        return Response.json(result, {
          headers: { 'cache-control': 'no-store' }
        });
      } catch (err: any) {
        return Response.json({
          ok: false,
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
      let packageName = '';
      try {
        const body = ((await req.json().catch(() => ({}))) ?? {}) as DoUpdateParams & { packageName?: unknown };
        packageName = readPackageName(body?.packageName) ?? '';
        if (!packageName) {
          return Response.json({ ok: false, packageName: '', error: 'packageName 必须是合法的 npm 包名' } as DoUpdateResult, { status: 400 });
        }
        const targetVersion = readTargetVersion(body?.targetVersion);
        if (targetVersion === null) {
          return Response.json({ ok: false, packageName, error: 'targetVersion 必须是合法的语义化版本' } as DoUpdateResult, { status: 400 });
        }

        const settings = readSettings(config);
        const bundle = await readBundleInfo(ctx, packageName);
        const blocked = bundleGuardError(packageName, bundle);
        if (blocked) {
          return Response.json({ ok: false, packageName, error: blocked } as DoUpdateResult, { status: 200 });
        }

        const { dir, profileName } = resolveProfileDir(packageName);
        if (!existsSync(join(dir, 'package.json'))) {
          return Response.json({ ok: false, packageName, error: '找不到可用的 DSH profile 目录' } as DoUpdateResult, { status: 200 });
        }

        if (installing.has(dir)) {
          return Response.json({ ok: false, packageName, error: '另一个插件正在更新，请稍后再试' } as DoUpdateResult, { status: 200 });
        }
        installing.add(dir);

        try {
          const source = typeof body.source === 'string' && body.source ? body.source : bundle?.source;
          const runRes = await runUpdateCommand(settings, dir, profileName, packageName, targetVersion, source);
          const selfUpdate = packageName === OWN_PACKAGE_NAME;

          if (runRes.ok) {
            if (selfUpdate) {
              // Respond before the Host reloads this very plugin, otherwise the client sees a failed request.
              const timer = setTimeout(() => { void refreshAfterInstall(); }, 1500);
              timer.unref?.();
            } else {
              await refreshAfterInstall();
            }
          }

          const result: DoUpdateResult = {
            ok: runRes.ok,
            packageName,
            targetVersion,
            source,
            registryUsed: runRes.registryUsed,
            registryLabel: registryLabel(runRes.registryUsed, settings.customRegistries),
            fellBack: runRes.fellBack,
            selfUpdate,
            output: runRes.output,
            error: runRes.error
          };

          return Response.json(result, {
            headers: { 'cache-control': 'no-store' }
          });
        } finally {
          installing.delete(dir);
        }
      } catch (err: any) {
        return Response.json({
          ok: false,
          packageName,
          error: err?.message || 'Update failed'
        } as DoUpdateResult, { status: 200 });
      }
    }
  }), 'dsh-plugins-update: update route');
}
