import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import Schema from '@deepseek-ai/schemastery';
import {
  CHECK_PATH,
  DOMESTIC_REGISTRY,
  ERROR_CODES,
  OFFICIAL_REGISTRY,
  UPDATE_PATH,
  normalizeRegistryUrl,
  registryLabel,
  type CheckUpdateResult,
  type CustomRegistry,
  type DoUpdateResult,
  type ErrorCode,
  type PluginSettings
} from './types.js';

export const name = 'dsh-plugins-update';
export const inject = ['connection'];

const OWN_PACKAGE_NAME = 'dsh-plugins-update';
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;
const TARGET_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const INSTALL_TIMEOUT_MS = 180_000;
const CHECK_TIMEOUT_MS = 15_000;
const OUTPUT_LIMIT = 8_000;

function live<T>(schema: T): T {
  const s = schema as any;
  return typeof s?.volatile === 'function' ? s.volatile() : schema;
}

export const Config: Schema<any> = Schema.object({
  registry: live(
    Schema.string()
      .default('npmjs')
      .description('第三方插件更新源：npmjs（npm 官方）/ npmmirror（国内镜像）/ 自定义源 URL；Update registry: npmjs | npmmirror | custom URL')
  ),
  customRegistries: live(
    Schema.array(
      Schema.object({
        name: Schema.string().default(''),
        url: Schema.string().default('')
      })
    )
      .default([])
      .description('自定义更新源列表 / Custom update registries')
  ),
  fallbackToOfficial: live(
    Schema.boolean()
      .default(true)
      .description('非官方源安装失败时，自动改用 npm 官方源重试一次 / Retry once on npm official after a non-official registry fails')
  )
});

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
  const registryRaw = readField<string>(config?.registry, 'npmjs');
  const customRaw = readField<any[]>(config?.customRegistries, []);
  const customRegistries: CustomRegistry[] = Array.isArray(customRaw)
    ? customRaw
        .map(item => ({
          name: typeof item?.name === 'string' ? item.name.trim() : '',
          url: normalizeRegistryUrl(typeof item?.url === 'string' ? item.url : '') ?? ''
        }))
        .filter(item => !!item.url)
    : [];
  return {
    registry: typeof registryRaw === 'string' && registryRaw.trim() ? registryRaw.trim() : 'npmjs',
    customRegistries,
    fallbackToOfficial: readField<boolean>(config?.fallbackToOfficial, true)
  };
}

function selectedRegistry(settings: PluginSettings): string {
  if (settings.registry === 'npmjs') return OFFICIAL_REGISTRY;
  if (settings.registry === 'npmmirror') return DOMESTIC_REGISTRY;
  return normalizeRegistryUrl(settings.registry) ?? OFFICIAL_REGISTRY;
}

function readPackageName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const packageName = value.trim();
  if (!packageName || packageName.length > 214 || !PACKAGE_NAME_PATTERN.test(packageName)) return undefined;
  return packageName;
}

function readTargetVersion(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return null;
  const version = value.trim().replace(/^[v^~]/, '');
  if (!version) return undefined;
  return TARGET_VERSION_PATTERN.test(version) ? version : null;
}

function isOfficialPackageName(packageName: string): boolean {
  return packageName.startsWith('@deepseek-ai/');
}

// --- semver ---------------------------------------------------------------------------

interface ParsedSemver {
  core: number[];
  prerelease: string[];
}

function parseSemver(input: string): ParsedSemver | null {
  const match = String(input || '')
    .trim()
    .replace(/^[v^~]/, '')
    .match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split('.') : []
  };
}

function compareSemver(left: string, right: string): number {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return left === right ? 0 : left > right ? 1 : -1;
  for (let i = 0; i < 3; i++) {
    if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i] ? 1 : -1;
  }
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < length; i++) {
    const x = a.prerelease[i];
    const y = b.prerelease[i];
    if (x === undefined) return -1;
    if (y === undefined) return 1;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) {
      const diff = Number(x) - Number(y);
      if (diff !== 0) return diff > 0 ? 1 : -1;
    } else if (nx !== ny) {
      return nx ? -1 : 1;
    } else if (x !== y) {
      return x > y ? 1 : -1;
    }
  }
  return 0;
}

// --- profile / package ----------------------------------------------------------------

interface BundleInfo {
  name?: string;
  official?: boolean;
  installed?: boolean;
  availability?: string;
  source?: string;
  removable?: boolean;
}

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

function resolveProfileDir(packageName?: string): { dir: string; profileName: string } {
  const candidates = profileCandidates();
  if (packageName) {
    const owner = candidates.find(candidate =>
      Object.prototype.hasOwnProperty.call(readProfileDependencies(candidate.dir), packageName)
    );
    if (owner) return owner;
  }
  return candidates.find(candidate => candidate.profileName === 'desktop') ?? candidates[0];
}

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

function bundleGuardError(packageName: string, bundle: BundleInfo | undefined): { error: string; errorCode: ErrorCode } | undefined {
  if (bundle?.official === true || isOfficialPackageName(packageName)) {
    return {
      error: '官方插件由 DSH 自带的更新入口管理，请使用插件页右上角的「更新」按钮',
      errorCode: ERROR_CODES.officialPlugin
    };
  }
  if (bundle?.installed === false) {
    return { error: '该插件未安装到当前 profile，无法更新', errorCode: ERROR_CODES.notInstalled };
  }
  return undefined;
}

function readInstalledVersion(profileDir: string, packageName: string): string | undefined {
  const path = join(profileDir, 'node_modules', packageName, 'package.json');
  try {
    const pkg = JSON.parse(readFileSync(path, 'utf8'));
    return typeof pkg.version === 'string' && pkg.version.trim() ? pkg.version.trim() : undefined;
  } catch {
    return undefined;
  }
}

function parseGithubSource(value?: string): { owner: string; repo: string } | null {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .trim()
    .replace(/^git\+/, '')
    .replace(/#.*$/, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  if (!cleaned) return null;
  const match = cleaned.match(
    /(?:github:|^https?:\/\/github\.com\/|^git@github\.com:|^git:\/\/github\.com\/|^ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i
  );
  if (match) return { owner: match[1], repo: match[2] };
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleaned)) {
    const [owner, repo] = cleaned.split('/');
    return { owner, repo };
  }
  return null;
}

interface PackageOrigin {
  isGithub: boolean;
  github?: { owner: string; repo: string };
  declaredSpec?: string;
}

function resolvePackageOrigin(profileDir: string, packageName: string, explicitSource?: string): PackageOrigin {
  const explicit = parseGithubSource(explicitSource);
  if (explicit) return { isGithub: true, github: explicit, declaredSpec: explicitSource };
  const spec = readProfileDependencies(profileDir)[packageName];
  const github = parseGithubSource(spec);
  return github ? { isGithub: true, github, declaredSpec: spec } : { isGithub: false, declaredSpec: spec };
}

// --- network --------------------------------------------------------------------------

class RemoteError extends Error {
  errorCode: ErrorCode;
  constructor(errorCode: ErrorCode, message: string) {
    super(message);
    this.errorCode = errorCode;
  }
}

function redactSecrets(input: string): string {
  return String(input || '')
    .replace(/\/\/[^/@\s]+:[^/@\s]+@/g, '//***:***@')
    .replace(/(token|password|secret)=([^&\s]+)/gi, '$1=***');
}

function safeRegistryUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;
  try {
    const parsed = new URL(url);
    parsed.username = '';
    parsed.password = '';
    return parsed.href;
  } catch {
    return url;
  }
}
function encodePackageName(packageName: string): string {
  return encodeURIComponent(packageName).replace(/^%40/i, '@');
}

async function fetchJson(url: string, timeoutMs = CHECK_TIMEOUT_MS): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const parsed = new URL(url);
    const headers: Record<string, string> = {
      accept: 'application/json',
      'user-agent': 'dsh-plugins-update'
    };
    if (parsed.username || parsed.password) {
      const credentials = `${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`;
      headers.authorization = `Basic ${Buffer.from(credentials).toString('base64')}`;
      parsed.username = '';
      parsed.password = '';
    }
    const response = await fetch(parsed.href, { headers, signal: controller.signal });
    if (!response.ok) throw new RemoteError(ERROR_CODES.offline, `HTTP ${response.status}`);
    return await response.json();
  } catch (error: any) {
    if (error instanceof RemoteError) throw error;
    if (error?.name === 'AbortError') throw new RemoteError(ERROR_CODES.timeout, '检查更新超时');
    throw new RemoteError(ERROR_CODES.offline, redactSecrets(error?.message || '网络请求失败'));
  } finally {
    clearTimeout(timer);
  }
}

interface RemotePackageInfo {
  version: string;
  description?: string;
  registry?: string;
  isGithub: boolean;
}

async function fetchNpmLatest(packageName: string, registry: string): Promise<RemotePackageInfo> {
  const data = await fetchJson(`${registry}${encodePackageName(packageName)}`);
  const version = data?.['dist-tags']?.latest;
  if (typeof version !== 'string' || !version.trim()) {
    throw new RemoteError(ERROR_CODES.offline, '更新源未返回最新版本号');
  }
  return {
    version: version.trim(),
    description: typeof data?.description === 'string' ? data.description : undefined,
    registry,
    isGithub: false
  };
}

async function fetchGithubPackageJson(owner: string, repo: string): Promise<RemotePackageInfo> {
  const urls = [
    `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/package.json`,
    `https://cdn.jsdelivr.net/gh/${owner}/${repo}@HEAD/package.json`
  ];
  let lastError: any;
  for (const url of urls) {
    try {
      const data = await fetchJson(url);
      if (typeof data?.version !== 'string' || !data.version.trim()) {
        throw new RemoteError(ERROR_CODES.offline, 'GitHub 仓库 package.json 缺少版本号');
      }
      return {
        version: data.version.trim(),
        description: typeof data?.description === 'string' ? data.description : undefined,
        isGithub: true
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof RemoteError
    ? lastError
    : new RemoteError(ERROR_CODES.offline, '无法读取 GitHub 仓库版本信息');
}

async function resolveRemotePackage(
  packageName: string,
  profileDir: string,
  settings: PluginSettings,
  source?: string
): Promise<{ info: RemotePackageInfo; origin: PackageOrigin; registry: string }> {
  const origin = resolvePackageOrigin(profileDir, packageName, source);
  if (origin.isGithub && origin.github) {
    const info = await fetchGithubPackageJson(origin.github.owner, origin.github.repo);
    return { info, origin, registry: selectedRegistry(settings) };
  }
  const registry = selectedRegistry(settings);
  const info = await fetchNpmLatest(packageName, registry);
  return { info, origin, registry };
}

// --- install --------------------------------------------------------------------------

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
  if (process.env.LOCALAPPDATA) candidates.push(join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness', cliRel));
  return candidates;
}

function pnpmCandidates(): string[] {
  const candidates: string[] = [];
  const override = process.env.DSH_PNPM_JS?.trim();
  if (override) candidates.push(override);
  const rel = join('resources', 'runtime', 'primary-runtime', 'dependencies', 'pnpm', 'bin', 'pnpm.mjs');
  const execDir = process.execPath ? dirname(process.execPath) : '';
  if (execDir) {
    candidates.push(join(execDir, rel));
    candidates.push(join(execDir, '..', rel));
  }
  if (process.env.LOCALAPPDATA) candidates.push(join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness', rel));
  return candidates;
}

function buildInstallCommand(
  profileName: string,
  spec: string,
  registry: string,
  policyBypass: boolean
): { command: string; args: string[]; env: NodeJS.ProcessEnv } | { error: string } {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    npm_config_registry: registry
  };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  const policyArgs = policyBypass ? ['--config.minimum-release-age=0'] : [];
  const cliJs = desktopCliCandidates().find(candidate => existsSync(candidate));
  if (cliJs) {
    return {
      command: process.execPath,
      args: ['--expose-internals', cliJs, 'plugin', '--profile', profileName, 'add', spec, `--registry=${registry}`, ...policyArgs],
      env
    };
  }
  const pnpmJs = pnpmCandidates().find(candidate => existsSync(candidate));
  if (pnpmJs) {
    return {
      command: process.execPath,
      args: ['--expose-internals', pnpmJs, 'add', spec, `--registry=${registry}`, ...policyArgs],
      env
    };
  }
  return { error: '找不到 DSH CLI 或 pnpm，无法执行安装' };
}

interface InstallAttempt {
  ok: boolean;
  output: string;
  error?: string;
  timedOut: boolean;
}

function killChildTree(child: any): void {
  if (!child || child.exitCode !== null) return;
  if (process.platform === 'win32' && child.pid) {
    try {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
        shell: false,
        windowsHide: true,
        stdio: 'ignore'
      });
      killer.on('error', () => {});
      killer.unref?.();
    } catch {}
  }
  try {
    child.kill();
  } catch {}
  try {
    child.kill('SIGKILL');
  } catch {}
}

function spawnInstall(profileDir: string, profileName: string, spec: string, registry: string, policyBypass = false): Promise<InstallAttempt> {
  const plan = buildInstallCommand(profileName, spec, registry, policyBypass);
  if ('error' in plan) return Promise.resolve({ ok: false, output: '', error: plan.error, timedOut: false });

  return new Promise(resolve => {
    let output = '';
    let settled = false;
    let timedOut = false;
    let timer: NodeJS.Timeout | undefined;
    let forceTimer: NodeJS.Timeout | undefined;

    const append = (chunk: Buffer | string) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString();
      output = output.length + text.length > OUTPUT_LIMIT ? (output + text).slice(-OUTPUT_LIMIT) : output + text;
    };
    const finish = (ok: boolean, error?: string) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (forceTimer) clearTimeout(forceTimer);
      resolve({ ok, output, error, timedOut });
    };

    let child: any;
    try {
      child = spawn(plan.command, plan.args, {
        cwd: profileDir,
        shell: false,
        windowsHide: true,
        env: plan.env
      });
    } catch (error: any) {
      finish(false, redactSecrets(error?.message || '无法启动安装进程'));
      return;
    }

    child.stdout?.on('data', append);
    child.stderr?.on('data', append);
    child.on('error', (error: any) => finish(false, redactSecrets(error?.message || '安装进程错误')));
    child.on('close', (code: number | null) => {
      if (timedOut) return finish(false, `安装命令超时（${Math.round(INSTALL_TIMEOUT_MS / 1000)} 秒）`);
      if (code === 0) return finish(true);
      finish(false, redactSecrets(`安装进程退出码 ${code ?? 'unknown'}`));
    });

    timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      killChildTree(child);
      forceTimer = setTimeout(
        () => finish(false, `安装命令超时（${Math.round(INSTALL_TIMEOUT_MS / 1000)} 秒）`),
        10_000
      );
      forceTimer.unref?.();
    }, INSTALL_TIMEOUT_MS);
    timer.unref?.();
  });
}

function isSupplyChainPolicyFailure(output: string): boolean {
  return /ERR_PNPM_NO_MATURE_MATCHING_VERSION|ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION|minimumReleaseAge/i.test(
    output || ''
  );
}

interface Snapshot {
  manifest: string | null;
  lockfile: string | null;
}

function captureSnapshot(profileDir: string): Snapshot {
  const manifestPath = join(profileDir, 'package.json');
  const lockfilePath = join(profileDir, 'pnpm-lock.yaml');
  return {
    manifest: existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : null,
    lockfile: existsSync(lockfilePath) ? readFileSync(lockfilePath, 'utf8') : null
  };
}

function restoreSnapshot(profileDir: string, snapshot: Snapshot): boolean {
  try {
    if (snapshot.manifest !== null) writeFileSync(join(profileDir, 'package.json'), snapshot.manifest, 'utf8');
    if (snapshot.lockfile !== null) writeFileSync(join(profileDir, 'pnpm-lock.yaml'), snapshot.lockfile, 'utf8');
    return true;
  } catch {
    return false;
  }
}

async function performUpdate(
  ctx: any,
  config: any,
  params: { packageName: string; targetVersion?: string; source?: string },
  refresh: () => Promise<void>
): Promise<DoUpdateResult> {
  const { packageName } = params;
  const settings = readSettings(config);
  const { dir: profileDir, profileName } = resolveProfileDir(packageName);
  if (!existsSync(join(profileDir, 'package.json'))) {
    return { ok: false, packageName, error: '找不到可用的 DSH profile 目录', errorCode: ERROR_CODES.profileNotFound };
  }

  const origin = resolvePackageOrigin(profileDir, packageName, params.source);
  const currentVersion = readInstalledVersion(profileDir, packageName);
  let targetVersion = params.targetVersion;
  let spec = '';
  let expectedGithub = false;

  if (origin.isGithub && origin.github) {
    expectedGithub = true;
    if (!targetVersion) {
      const remote = await fetchGithubPackageJson(origin.github.owner, origin.github.repo);
      targetVersion = remote.version;
    }
    spec = `github:${origin.github.owner}/${origin.github.repo}`;
  } else {
    const registry = selectedRegistry(settings);
    const remote = targetVersion ? undefined : await fetchNpmLatest(packageName, registry);
    targetVersion = targetVersion || remote!.version;
    spec = `${packageName}@${targetVersion}`;
  }

  if (!targetVersion) {
    return { ok: false, packageName, error: '无法确定目标版本', errorCode: ERROR_CODES.invalidTargetVersion };
  }

  const snapshot = captureSnapshot(profileDir);
  let registryUsed = selectedRegistry(settings);
  let fellBack = false;
  let attempt = await spawnInstall(profileDir, profileName, spec, registryUsed);

  if (!attempt.ok && !attempt.timedOut && isSupplyChainPolicyFailure(attempt.output)) {
    attempt = await spawnInstall(profileDir, profileName, spec, registryUsed, true);
  }
  if (
    !attempt.ok &&
    !attempt.timedOut &&
    settings.fallbackToOfficial &&
    normalizeRegistryUrl(registryUsed) !== OFFICIAL_REGISTRY
  ) {
    fellBack = true;
    registryUsed = OFFICIAL_REGISTRY;
    attempt = await spawnInstall(profileDir, profileName, spec, registryUsed);
    if (!attempt.ok && !attempt.timedOut && isSupplyChainPolicyFailure(attempt.output)) {
      attempt = await spawnInstall(profileDir, profileName, spec, registryUsed, true);
    }
  }

  if (!attempt.ok) {
    const restored = restoreSnapshot(profileDir, snapshot);
    return {
      ok: false,
      packageName,
      targetVersion,
      source: origin.declaredSpec,
      registryUsed: safeRegistryUrl(registryUsed),
      registryLabel: registryLabel(registryUsed, settings.customRegistries),
      fellBack,
      rollback: restored ? 'restored' : 'failed',
      error: attempt.timedOut ? '更新超时，已中止安装' : attempt.error || '安装失败',
      errorCode: attempt.timedOut ? ERROR_CODES.timeout : ERROR_CODES.installFailed,
      output: attempt.output
    };
  }

  const installedVersion = readInstalledVersion(profileDir, packageName);
  const verified =
    installedVersion !== undefined &&
    (expectedGithub ? installedVersion === targetVersion : compareSemver(installedVersion, targetVersion) >= 0);
  if (!verified) {
    const restored = restoreSnapshot(profileDir, snapshot);
    return {
      ok: false,
      packageName,
      targetVersion,
      source: origin.declaredSpec,
      registryUsed: safeRegistryUrl(registryUsed),
      registryLabel: registryLabel(registryUsed, settings.customRegistries),
      fellBack,
      rollback: restored ? 'restored' : 'failed',
      error: `安装后校验未通过：期望 ${targetVersion}，实际 ${installedVersion || '未知'}`,
      errorCode: ERROR_CODES.verificationFailed,
      output: attempt.output
    };
  }

  const selfUpdate = packageName === OWN_PACKAGE_NAME;
  if (selfUpdate) {
    const timer = setTimeout(() => void refresh(), 1500);
    timer.unref?.();
  } else {
    try {
      await refresh();
    } catch {}
  }

  return {
    ok: true,
    packageName,
    targetVersion,
    source: origin.declaredSpec,
    registryUsed: safeRegistryUrl(registryUsed),
    registryLabel: registryLabel(registryUsed, settings.customRegistries),
    fellBack,
    selfUpdate,
    rollback: 'not-needed',
    output: attempt.output
  };
}

// --- HTTP helpers ---------------------------------------------------------------------

function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function errorResponse(payload: Record<string, any>, errorCode: ErrorCode, error: string, status = 200): Response {
  return jsonResponse({ ...payload, ok: false, error, errorCode }, status);
}

async function parseJsonBody(req: Request): Promise<Record<string, any>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, any>) : {};
  } catch {
    return {};
  }
}

// --- Plugin entry point ---------------------------------------------------------------

export function apply(ctx: any, config: any) {
  const conn = ctx.get('connection');
  const registerFetch = conn?.fetch?.register?.bind(conn.fetch);
  if (typeof registerFetch !== 'function') return;

  const refreshAfterInstall = async () => {
    try {
      const packages = ctx.get?.('pluginPackages');
      if (packages?.refresh) await packages.refresh();
    } catch {}
    try {
      const hmr = ctx.get?.('hmr');
      if (hmr?.runExclusive && typeof hmr.reconcileProfile === 'function') {
        await hmr.runExclusive(() => hmr.reconcileProfile([]));
      }
    } catch {}
    try {
      ctx.emit?.('plugin-manager/changed', { reason: 'install' });
    } catch {}
  };

  const runningProfiles = new Set<string>();

  // 1. Check for a newer version.
  ctx.effect(
    () =>
      registerFetch({
        path: CHECK_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (req: Request) => {
          try {
            const body = await parseJsonBody(req);
            const packageName = readPackageName(body?.packageName);
            if (!packageName) {
              return errorResponse(
                { packageName: '', hasUpdate: false },
                ERROR_CODES.invalidPackageName,
                'packageName 必须是合法的 npm 包名',
                400
              );
            }
            const bundle = await readBundleInfo(ctx, packageName);
            const blocked = bundleGuardError(packageName, bundle);
            if (blocked) return errorResponse({ packageName, hasUpdate: false }, blocked.errorCode, blocked.error);
            const { dir } = resolveProfileDir(packageName);
            const currentVersion = readInstalledVersion(dir, packageName) || body?.currentVersion || '0.0.0';
            const { info, origin, registry } = await resolveRemotePackage(
              packageName,
              dir,
              readSettings(config),
              typeof body?.source === 'string' ? body.source : bundle?.source
            );
            const result: CheckUpdateResult = {
              ok: true,
              packageName,
              currentVersion,
              latestVersion: info.version,
              hasUpdate: compareSemver(info.version, currentVersion) > 0,
              description: info.description,
              source: origin.declaredSpec || bundle?.source,
              isGithub: info.isGithub,
              registry: safeRegistryUrl(registry)
            };
            return jsonResponse(result);
          } catch (error: any) {
            const errorCode = error instanceof RemoteError ? error.errorCode : ERROR_CODES.unknown;
            return errorResponse(
              { packageName: '', hasUpdate: false, latestVersion: '0.0.0' },
              errorCode,
              redactSecrets(error?.message || '检查更新失败')
            );
          }
        }
      }),
    'dsh-plugins-update: check route'
  );

  // 2. Run one synchronous update. No progress job and no polling.
  ctx.effect(
    () =>
      registerFetch({
        path: UPDATE_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (req: Request) => {
          let packageName = '';
          try {
            const body = await parseJsonBody(req);
            packageName = readPackageName(body?.packageName) ?? '';
            if (!packageName) {
              return errorResponse({ packageName: '' }, ERROR_CODES.invalidPackageName, 'packageName 必须是合法的 npm 包名', 400);
            }
            const targetVersion = readTargetVersion(body?.targetVersion);
            if (targetVersion === null) {
              return errorResponse({ packageName }, ERROR_CODES.invalidTargetVersion, 'targetVersion 必须是合法的语义化版本', 400);
            }
            const bundle = await readBundleInfo(ctx, packageName);
            const blocked = bundleGuardError(packageName, bundle);
            if (blocked) return errorResponse({ packageName }, blocked.errorCode, blocked.error);

            const { dir } = resolveProfileDir(packageName);
            if (!existsSync(join(dir, 'package.json'))) {
              return errorResponse({ packageName }, ERROR_CODES.profileNotFound, '找不到可用的 DSH profile 目录');
            }
            if (runningProfiles.has(dir)) {
              return errorResponse({ packageName }, ERROR_CODES.installInProgress, '另一个插件正在更新，请稍后再试');
            }

            runningProfiles.add(dir);
            try {
              const result = await performUpdate(
                ctx,
                config,
                {
                  packageName,
                  targetVersion,
                  source: typeof body?.source === 'string' ? body.source : bundle?.source
                },
                refreshAfterInstall
              );
              return jsonResponse(result);
            } finally {
              runningProfiles.delete(dir);
            }
          } catch (error: any) {
            return errorResponse(
              { packageName },
              error instanceof RemoteError ? error.errorCode : ERROR_CODES.unknown,
              redactSecrets(error?.message || '更新失败')
            );
          }
        }
      }),
    'dsh-plugins-update: update route'
  );
}
