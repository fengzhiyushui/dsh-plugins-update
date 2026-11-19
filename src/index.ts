import { spawn } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import Schema from '@deepseek-ai/schemastery';
import {
  CHECK_ALL_PATH,
  CHECK_PATH,
  DIAGNOSE_PATH,
  DOMESTIC_REGISTRY,
  ERROR_CODES,
  OFFICIAL_REGISTRY,
  RESCUE_PATH,
  UPDATE_PATH,
  compareSemver,
  normalizeRegistryUrl,
  registryLabel,
  type CheckAllResult,
  type CheckUpdateResult,
  type CustomRegistry,
  type DiagnoseResult,
  type DoUpdateResult,
  type ErrorCode,
  type PluginHealthIssueKind,
  type PluginHealthReport,
  type PluginHealthSummary,
  type PluginSettings,
  type RescueAction,
  type RescueResult
} from './types.js';

export const name = 'dsh-plugins-update';
export const inject = ['connection'];

const OWN_PACKAGE_NAME = 'dsh-plugins-update';
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;
const TARGET_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const INSTALL_TIMEOUT_MS = 180_000;
const ROLLBACK_TIMEOUT_MS = 60_000;
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
  ),
  alwaysShowDetailButton: live(
    Schema.boolean()
      .default(false)
      .description('始终在插件详情页显示「极速更新」按钮 / Always show the Fast Update button on plugin detail pages')
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
    fallbackToOfficial: readField<boolean>(config?.fallbackToOfficial, true),
    alwaysShowDetailButton: readField<boolean>(config?.alwaysShowDetailButton, false)
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

// --- profile / package ----------------------------------------------------------------

interface BundleInfo {
  name?: string;
  official?: boolean;
  installed?: boolean;
  availability?: string;
  source?: string;
  removable?: boolean;
  update?: 'registry' | 'git';
  enabled?: boolean;
  error?: any;
  loadError?: any;
  reason?: string;
  status?: string;
  state?: string;
  message?: string;
}

function detectHostVersion(ctx?: any): string | undefined {
  const envVersion = process.env.DSH_VERSION?.trim();
  if (envVersion) return envVersion;
  const ctxVersion = ctx?.host?.version || ctx?.app?.version;
  if (typeof ctxVersion === 'string' && ctxVersion.trim()) return ctxVersion.trim();

  const execDir = process.execPath ? dirname(process.execPath) : '';
  const dshHome = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh');
  const candidates: string[] = [];
  if (execDir) {
    candidates.push(
      join(execDir, 'resources', 'app.asar', 'package.json'),
      join(execDir, '..', 'Resources', 'app.asar', 'package.json'),
      join(execDir, 'resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'package.json'),
      join(execDir, '..', 'Resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'package.json')
    );
  }
  candidates.push(join(dshHome, 'dsh-runtimes', 'dsh-primary-runtime', 'package.json'));

  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) continue;
      const pkg = JSON.parse(readFileSync(candidate, 'utf8'));
      if (typeof pkg?.version === 'string' && pkg.version.trim()) {
        return pkg.version.trim();
      }
    } catch {}
  }
  return undefined;
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

async function readAllBundles(ctx: any): Promise<BundleInfo[]> {
  for (const service of ['pluginManager', 'plugin-manager']) {
    try {
      const manager = ctx?.get?.(service);
      if (typeof manager?.listBundles !== 'function') continue;
      const bundles = await manager.listBundles();
      if (Array.isArray(bundles)) return bundles as BundleInfo[];
    } catch {}
  }
  return [];
}

async function readBundleInfo(ctx: any, packageName: string): Promise<BundleInfo | undefined> {
  const bundles = await readAllBundles(ctx);
  return bundles.find((item: any) => item && item.name === packageName);
}

interface InstalledThirdPartyPackage {
  packageName: string;
  dir: string;
  profileName: string;
  currentVersion: string;
  source?: string;
  bundle?: BundleInfo;
  issues: PluginHealthIssueKind[];
  errorDetail?: string;
}

function extractVersionFromSpec(spec: unknown): string {
  if (typeof spec !== 'string') return '0.0.0';
  const cleaned = spec.trim().replace(/^[v^~=]+/, '');
  return TARGET_VERSION_PATTERN.test(cleaned) ? cleaned : '0.0.0';
}

function collectExportTargets(exp: unknown, out: string[]): void {
  if (typeof exp === 'string') {
    if (exp.trim() && !exp.includes('*')) out.push(exp.trim());
    return;
  }
  if (!exp || typeof exp !== 'object') return;
  const obj = exp as Record<string, unknown>;
  for (const key of ['default', 'import', 'node', 'browser', 'require']) {
    if (key in obj) collectExportTargets(obj[key], out);
  }
}

function inspectPackageDiskHealth(
  profileDir: string,
  packageName: string
): { entryMissing: boolean; currentVersion?: string; errorDetail?: string } {
  const pkgDir = join(profileDir, 'node_modules', packageName);
  const manifestPath = join(pkgDir, 'package.json');
  if (!existsSync(manifestPath)) {
    return { entryMissing: true, errorDetail: 'node_modules 中的 package.json 缺失' };
  }
  let pkg: any;
  try {
    pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    return { entryMissing: true, errorDetail: 'package.json 解析失败或文件损坏' };
  }
  const currentVersion =
    typeof pkg?.version === 'string' && pkg.version.trim() ? pkg.version.trim() : undefined;

  const entryPaths: string[] = [];
  if (typeof pkg?.main === 'string' && pkg.main.trim()) {
    entryPaths.push(pkg.main.trim());
  }
  if (typeof pkg?.exports === 'string') {
    collectExportTargets(pkg.exports, entryPaths);
  } else if (pkg?.exports && typeof pkg.exports === 'object') {
    const exportsObj = pkg.exports as Record<string, unknown>;
    if ('.' in exportsObj) collectExportTargets(exportsObj['.'], entryPaths);
    if ('./client' in exportsObj) collectExportTargets(exportsObj['./client'], entryPaths);
  }

  for (const relPath of new Set(entryPaths)) {
    const cleanRel = relPath.replace(/^\.\//, '');
    if (!cleanRel) continue;
    if (!existsSync(join(pkgDir, cleanRel))) {
      return {
        entryMissing: true,
        currentVersion,
        errorDetail: `缺少入口文件: ${relPath}`
      };
    }
  }
  return { entryMissing: false, currentVersion };
}

function extractBundleErrorDetail(bundle: BundleInfo | undefined): string | undefined {
  if (!bundle) return undefined;
  const raw = bundle.error ?? bundle.loadError ?? bundle.reason ?? bundle.message;
  if (!raw) return undefined;
  const text =
    typeof raw === 'string'
      ? raw.trim()
      : typeof raw?.message === 'string'
        ? raw.message.trim()
        : String(raw).trim();
  if (!text) return undefined;
  const redacted = redactSecrets(text);
  return redacted.length > 400 ? `${redacted.slice(0, 400)}...` : redacted;
}

async function inspectInstalledPluginsHealth(ctx: any): Promise<InstalledThirdPartyPackage[]> {
  const bundles = await readAllBundles(ctx);
  const bundleMap = new Map<string, BundleInfo>();
  for (const b of bundles) {
    if (b && typeof b.name === 'string') bundleMap.set(b.name, b);
  }

  const candidateProfiles = profileCandidates();
  const manifestDepsByPackage = new Map<string, string>();
  for (const candidate of candidateProfiles) {
    const deps = readProfileDependencies(candidate.dir);
    for (const [depName, spec] of Object.entries(deps)) {
      if (!manifestDepsByPackage.has(depName) && typeof spec === 'string') {
        manifestDepsByPackage.set(depName, spec);
      }
    }
  }

  const candidateNames = new Set<string>([...manifestDepsByPackage.keys(), ...bundleMap.keys()]);
  const result: InstalledThirdPartyPackage[] = [];

  for (const rawName of candidateNames) {
    const packageName = readPackageName(rawName);
    if (!packageName || isOfficialPackageName(packageName)) continue;
    const bundle = bundleMap.get(packageName);
    if (bundle?.official === true) continue;

    const declaredSpec = manifestDepsByPackage.get(packageName);
    const inManifest = Boolean(declaredSpec);
    if (!inManifest && bundle?.installed === false) continue;

    const { dir, profileName } = resolveProfileDir(packageName);
    const disk = inspectPackageDiskHealth(dir, packageName);
    if (!inManifest && !disk.currentVersion) continue;

    const issues: PluginHealthIssueKind[] = [];
    const details: string[] = [];

    if (disk.entryMissing || (inManifest && bundle?.installed === false)) {
      issues.push('entry-missing');
      if (disk.errorDetail) details.push(disk.errorDetail);
      else if (bundle?.installed === false) details.push('已在配置中声明但未正确安装到当前 profile');
    }

    const bundleErrorDetail = extractBundleErrorDetail(bundle);
    const hasErrorState =
      Boolean(bundleErrorDetail) ||
      bundle?.status === 'error' ||
      bundle?.state === 'error' ||
      bundle?.state === 'failed';
    if (hasErrorState) {
      issues.push('bundle-error');
      details.push(bundleErrorDetail || `Bundle state: ${bundle?.status || bundle?.state || 'error'}`);
    }

    if (typeof bundle?.availability === 'string' && bundle.availability !== 'available') {
      issues.push('bundle-unavailable');
      details.push(`可用性异常: ${bundle.availability}`);
    }

    if (bundles.length > 0 && inManifest && !bundle) {
      issues.push('unregistered-bundle');
      details.push('已在 profile package.json 中声明，但 DSH 插件管理器未能加载/注册');
    }

    result.push({
      packageName,
      dir,
      profileName,
      currentVersion: disk.currentVersion || extractVersionFromSpec(declaredSpec),
      source: bundle?.source || declaredSpec,
      bundle,
      issues: Array.from(new Set(issues)),
      errorDetail: details.filter(Boolean).join('; ') || undefined
    });
  }
  return result;
}

function isDeclaredInProfile(packageName: string): boolean {
  const { dir } = resolveProfileDir(packageName);
  return Object.prototype.hasOwnProperty.call(readProfileDependencies(dir), packageName);
}

function bundleGuardError(packageName: string, bundle: BundleInfo | undefined): { error: string; errorCode: ErrorCode } | undefined {
  if (bundle?.official === true || isOfficialPackageName(packageName)) {
    return {
      error: '官方插件由 DSH 自带的更新入口管理，请使用插件页右上角的「更新」按钮',
      errorCode: ERROR_CODES.officialPlugin
    };
  }
  if (bundle?.installed === false && !isDeclaredInProfile(packageName)) {
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

interface GithubOrigin {
  owner: string;
  repo: string;
  ref?: string;
  pinnedCommit?: string;
  subpath?: string;
}

function parseGithubSource(value?: string): GithubOrigin | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const hashIndex = trimmed.indexOf('#');
  const rawBase = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const rawFragment = hashIndex >= 0 ? trimmed.slice(hashIndex + 1).trim() : '';

  const cleaned = rawBase
    .trim()
    .replace(/^git\+/, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  if (!cleaned) return null;

  let owner = '';
  let repo = '';
  const match = cleaned.match(
    /(?:github:|^https?:\/\/github\.com\/|^git@github\.com:|^git:\/\/github\.com\/|^ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i
  );
  if (match) {
    owner = match[1];
    repo = match[2];
  } else if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleaned)) {
    [owner, repo] = cleaned.split('/');
  } else {
    return null;
  }

  let ref: string | undefined;
  let pinnedCommit: string | undefined;
  let subpath: string | undefined;

  if (rawFragment) {
    const parts = rawFragment
      .split('&')
      .map(s => s.trim())
      .filter(Boolean);
    for (const part of parts) {
      if (part.startsWith('path:')) {
        const normalizedPath = part
          .slice('path:'.length)
          .trim()
          .replace(/\\/g, '/')
          .split('/')
          .filter(seg => seg && seg !== '.' && seg !== '..')
          .join('/');
        if (normalizedPath) subpath = normalizedPath;
      } else if (/^[0-9a-f]{40}$/i.test(part)) {
        pinnedCommit = part.toLowerCase();
      } else if (!part.includes(':') && !part.includes('..') && /^[A-Za-z0-9._/-]+$/.test(part)) {
        ref = part;
      }
    }
  }

  return {
    owner,
    repo,
    ...(ref ? { ref } : {}),
    ...(pinnedCommit ? { pinnedCommit } : {}),
    ...(subpath ? { subpath } : {})
  };
}

interface PackageOrigin {
  isGithub: boolean;
  github?: GithubOrigin;
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

async function fetchJson(url: string, timeoutMs = CHECK_TIMEOUT_MS, externalSignal?: AbortSignal): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = externalSignal ? AbortSignal.any([controller.signal, externalSignal]) : controller.signal;
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
    const response = await fetch(parsed.href, { headers, signal });
    if (!response.ok) throw new RemoteError(ERROR_CODES.offline, `HTTP ${response.status}`);
    return await response.json();
  } catch (error: any) {
    if (error instanceof RemoteError) throw error;
    if (controller.signal.aborted) throw new RemoteError(ERROR_CODES.timeout, '检查更新超时');
    if (externalSignal?.aborted || error?.name === 'AbortError') throw error;
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

function encodeRefSegments(value: string): string {
  return value
    .split('/')
    .map(seg => encodeURIComponent(seg))
    .join('/');
}

async function fetchGithubPackageJson(github: GithubOrigin): Promise<RemotePackageInfo> {
  const { owner, repo, ref, subpath } = github;
  const targetRef = encodeRefSegments(ref || 'HEAD');
  const pkgPath = subpath ? `${encodeRefSegments(subpath)}/package.json` : 'package.json';
  const urls = [
    `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${targetRef}/${pkgPath}`,
    `https://raw.githubusercontent.com/${owner}/${repo}/${targetRef}/${pkgPath}`
  ];
  const controller = new AbortController();
  const attempts = urls.map(async url => {
    const data = await fetchJson(url, CHECK_TIMEOUT_MS, controller.signal);
    if (typeof data?.version !== 'string' || !data.version.trim()) {
      throw new RemoteError(ERROR_CODES.offline, 'GitHub 仓库 package.json 缺少版本号');
    }
    return {
      version: data.version.trim(),
      description: typeof data?.description === 'string' ? data.description : undefined,
      isGithub: true
    };
  });
  try {
    return await Promise.any(attempts);
  } catch (error: any) {
    const errors: any[] = Array.isArray(error?.errors) ? error.errors : [];
    const remote =
      errors.find(e => e instanceof RemoteError && e.errorCode !== ERROR_CODES.timeout) ??
      errors.find(e => e instanceof RemoteError);
    throw remote ?? new RemoteError(ERROR_CODES.offline, '无法读取 GitHub 仓库版本信息');
  } finally {
    controller.abort();
  }
}

async function resolveRemotePackage(
  packageName: string,
  profileDir: string,
  settings: PluginSettings,
  source?: string
): Promise<{ info: RemotePackageInfo; origin: PackageOrigin; registry: string }> {
  const origin = resolvePackageOrigin(profileDir, packageName, source);
  if (origin.isGithub && origin.github) {
    const info = await fetchGithubPackageJson(origin.github);
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
  const dshHome = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh');
  candidates.push(join(dshHome, 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'pnpm', 'bin', 'pnpm.mjs'));
  if (process.env.LOCALAPPDATA) candidates.push(join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness', rel));
  return candidates;
}

function buildChildEnv(registry?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    ...(registry ? { npm_config_registry: registry } : {}),
    npm_config_update_notifier: 'false',
    pnpm_config_update_notifier: 'false',
    npm_config_fund: 'false',
    npm_config_audit: 'false'
  };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  return env;
}

function buildInstallCommand(
  profileName: string,
  spec: string,
  registry: string,
  policyBypass: boolean
): { command: string; args: string[]; env: NodeJS.ProcessEnv } | { error: string } {
  const env = buildChildEnv(registry);
  const extraArgs = [
    '--config.update-notifier=false',
    ...(policyBypass ? ['--config.minimum-release-age=0'] : [])
  ];
  const cliJs = desktopCliCandidates().find(candidate => existsSync(candidate));
  if (cliJs) {
    return {
      command: process.execPath,
      args: ['--expose-internals', cliJs, 'plugin', '--profile', profileName, 'add', spec, `--registry=${registry}`, ...extraArgs],
      env
    };
  }
  const pnpmJs = pnpmCandidates().find(candidate => existsSync(candidate));
  if (pnpmJs) {
    return {
      command: process.execPath,
      args: ['--expose-internals', pnpmJs, 'add', spec, `--registry=${registry}`, ...extraArgs],
      env
    };
  }
  return { error: '找不到 DSH CLI 或 pnpm，无法执行安装' };
}

function buildRemoveCommand(
  profileName: string,
  packageName: string
): { command: string; args: string[]; env: NodeJS.ProcessEnv } | { error: string } {
  const env = buildChildEnv();
  const extraArgs = ['--config.update-notifier=false'];
  const cliJs = desktopCliCandidates().find(candidate => existsSync(candidate));
  if (cliJs) {
    return {
      command: process.execPath,
      args: ['--expose-internals', cliJs, 'plugin', '--profile', profileName, 'remove', packageName, ...extraArgs],
      env
    };
  }
  const pnpmJs = pnpmCandidates().find(candidate => existsSync(candidate));
  if (pnpmJs) {
    return {
      command: process.execPath,
      args: ['--expose-internals', pnpmJs, 'remove', packageName, ...extraArgs],
      env
    };
  }
  return { error: '找不到 DSH CLI 或 pnpm，无法执行卸载' };
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

function spawnCommand(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number
): Promise<InstallAttempt> {
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
      child = spawn(command, args, {
        cwd,
        shell: false,
        windowsHide: true,
        env
      });
    } catch (error: any) {
      finish(false, redactSecrets(error?.message || '无法启动进程'));
      return;
    }

    child.stdout?.on('data', append);
    child.stderr?.on('data', append);
    child.on('error', (error: any) => finish(false, redactSecrets(error?.message || '进程执行错误')));
    child.on('close', (code: number | null) => {
      if (timedOut) return finish(false, `命令超时（${Math.round(timeoutMs / 1000)} 秒）`);
      if (code === 0) return finish(true);
      finish(false, redactSecrets(`进程退出码 ${code ?? 'unknown'}`));
    });

    timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      killChildTree(child);
      forceTimer = setTimeout(() => finish(false, `命令超时（${Math.round(timeoutMs / 1000)} 秒）`), 10_000);
      forceTimer.unref?.();
    }, timeoutMs);
    timer.unref?.();
  });
}

function spawnInstall(profileDir: string, profileName: string, spec: string, registry: string, policyBypass = false): Promise<InstallAttempt> {
  const plan = buildInstallCommand(profileName, spec, registry, policyBypass);
  if ('error' in plan) return Promise.resolve({ ok: false, output: '', error: plan.error, timedOut: false });
  return spawnCommand(plan.command, plan.args, profileDir, plan.env, INSTALL_TIMEOUT_MS);
}

function spawnRemove(profileDir: string, profileName: string, packageName: string): Promise<InstallAttempt> {
  const plan = buildRemoveCommand(profileName, packageName);
  if ('error' in plan) return Promise.resolve({ ok: false, output: '', error: plan.error, timedOut: false });
  return spawnCommand(plan.command, plan.args, profileDir, plan.env, INSTALL_TIMEOUT_MS);
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

async function alignNodeModulesAfterRollback(profileDir: string): Promise<'aligned' | 'skipped' | 'failed'> {
  const pnpmJs = pnpmCandidates().find(candidate => existsSync(candidate));
  if (!pnpmJs) return 'skipped';
  const env = buildChildEnv();
  const result = await spawnCommand(
    process.execPath,
    [
      '--expose-internals',
      pnpmJs,
      'install',
      '--frozen-lockfile',
      '--prefer-offline',
      '--ignore-scripts',
      '--config.update-notifier=false',
      '--config.minimum-release-age=0'
    ],
    profileDir,
    env,
    ROLLBACK_TIMEOUT_MS
  );
  return result.ok ? 'aligned' : 'failed';
}

async function rollbackAfterFailure(
  profileDir: string,
  packageName: string,
  previousVersion: string | undefined,
  snapshot: Snapshot,
  forceAlign: boolean
): Promise<'restored' | 'failed'> {
  const restored = restoreSnapshot(profileDir, snapshot);
  if (!restored) return 'failed';
  // Skip expensive pnpm alignment unless verification failed or node_modules was mutated before failure.
  const versionAfterRestore = readInstalledVersion(profileDir, packageName);
  const drifted = forceAlign || (Boolean(previousVersion) && versionAfterRestore !== previousVersion);
  if (!drifted) return 'restored';
  const alignment = await alignNodeModulesAfterRollback(profileDir);
  return alignment === 'failed' ? 'failed' : 'restored';
}

function buildGithubInstallSpec(github: GithubOrigin): string {
  const fragmentParts: string[] = [];
  if (github.ref) fragmentParts.push(github.ref);
  if (github.subpath) fragmentParts.push(`path:${github.subpath}`);
  const fragment = fragmentParts.length > 0 ? `#${fragmentParts.join('&')}` : '';
  return `github:${github.owner}/${github.repo}${fragment}`;
}

async function runInstallWithFallback(
  profileDir: string,
  profileName: string,
  spec: string,
  settings: PluginSettings,
  initialPolicyBypass = false
): Promise<{ attempt: InstallAttempt; registryUsed: string; fellBack: boolean }> {
  let registryUsed = selectedRegistry(settings);
  let fellBack = false;
  let attempt = await spawnInstall(profileDir, profileName, spec, registryUsed, initialPolicyBypass);

  if (!attempt.ok && !attempt.timedOut && !initialPolicyBypass && isSupplyChainPolicyFailure(attempt.output)) {
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
    attempt = await spawnInstall(profileDir, profileName, spec, registryUsed, initialPolicyBypass);
    if (!attempt.ok && !attempt.timedOut && !initialPolicyBypass && isSupplyChainPolicyFailure(attempt.output)) {
      attempt = await spawnInstall(profileDir, profileName, spec, registryUsed, true);
    }
  }
  return { attempt, registryUsed, fellBack };
}

function triggerPackageRefresh(packageName: string, refresh: () => Promise<void>): Promise<void> {
  if (packageName === OWN_PACKAGE_NAME) {
    const timer = setTimeout(() => void refresh(), 1500);
    timer.unref?.();
    return Promise.resolve();
  }
  return refresh().catch(() => {});
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

  if (origin.isGithub && origin.github) {
    if (!targetVersion) {
      const remote = await fetchGithubPackageJson(origin.github);
      targetVersion = remote.version;
    }
    spec = buildGithubInstallSpec(origin.github);
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
  const { attempt, registryUsed, fellBack } = await runInstallWithFallback(profileDir, profileName, spec, settings);

  if (!attempt.ok) {
    const rollback = await rollbackAfterFailure(profileDir, packageName, currentVersion, snapshot, false);
    return {
      ok: false,
      packageName,
      targetVersion,
      source: origin.declaredSpec,
      registryUsed: safeRegistryUrl(registryUsed),
      registryLabel: registryLabel(registryUsed, settings.customRegistries),
      fellBack,
      rollback,
      error: attempt.timedOut ? '更新超时，已中止安装' : attempt.error || '安装失败',
      errorCode: attempt.timedOut ? ERROR_CODES.timeout : ERROR_CODES.installFailed,
      output: attempt.output
    };
  }

  const installedVersion = readInstalledVersion(profileDir, packageName);
  const verified = installedVersion !== undefined && compareSemver(installedVersion, targetVersion) >= 0;
  if (!verified) {
    const rollback = await rollbackAfterFailure(profileDir, packageName, currentVersion, snapshot, true);
    return {
      ok: false,
      packageName,
      targetVersion,
      source: origin.declaredSpec,
      registryUsed: safeRegistryUrl(registryUsed),
      registryLabel: registryLabel(registryUsed, settings.customRegistries),
      fellBack,
      rollback,
      error: `安装后校验未通过：期望 ${targetVersion}，实际 ${installedVersion || '未知'}`,
      errorCode: ERROR_CODES.verificationFailed,
      output: attempt.output
    };
  }

  const selfUpdate = packageName === OWN_PACKAGE_NAME;
  await triggerPackageRefresh(packageName, refresh);

  return {
    ok: true,
    packageName,
    targetVersion: installedVersion,
    source: origin.declaredSpec,
    registryUsed: safeRegistryUrl(registryUsed),
    registryLabel: registryLabel(registryUsed, settings.customRegistries),
    fellBack,
    selfUpdate,
    rollback: 'not-needed',
    output: attempt.output
  };
}

async function performReinstall(
  _ctx: any,
  config: any,
  params: { packageName: string; targetVersion?: string; source?: string },
  refresh: () => Promise<void>
): Promise<RescueResult> {
  const { packageName } = params;
  const settings = readSettings(config);
  const { dir: profileDir, profileName } = resolveProfileDir(packageName);
  if (!existsSync(join(profileDir, 'package.json'))) {
    return {
      ok: false,
      packageName,
      action: 'reinstall',
      error: '找不到可用的 DSH profile 目录',
      errorCode: ERROR_CODES.profileNotFound
    };
  }

  const origin = resolvePackageOrigin(profileDir, packageName, params.source);
  const currentVersion = readInstalledVersion(profileDir, packageName);
  let targetVersion = params.targetVersion || currentVersion;
  let spec = '';

  if (origin.isGithub && origin.github) {
    if (!targetVersion) {
      try {
        const remote = await fetchGithubPackageJson(origin.github);
        targetVersion = remote.version;
      } catch {}
    }
    spec = buildGithubInstallSpec(origin.github);
  } else {
    const registry = selectedRegistry(settings);
    if (!targetVersion) {
      try {
        const remote = await fetchNpmLatest(packageName, registry);
        targetVersion = remote.version;
      } catch {}
    }
    spec = targetVersion ? `${packageName}@${targetVersion}` : packageName;
  }

  const snapshot = captureSnapshot(profileDir);
  const { attempt } = await runInstallWithFallback(profileDir, profileName, spec, settings, true);

  if (!attempt.ok) {
    const rollback = await rollbackAfterFailure(profileDir, packageName, currentVersion, snapshot, false);
    return {
      ok: false,
      packageName,
      action: 'reinstall',
      targetVersion,
      rollback,
      error: attempt.timedOut ? '重装超时，已中止操作' : attempt.error || '重装失败',
      errorCode: attempt.timedOut ? ERROR_CODES.timeout : ERROR_CODES.installFailed,
      output: attempt.output
    };
  }

  const disk = inspectPackageDiskHealth(profileDir, packageName);
  const installedVersion = disk.currentVersion;
  const versionOk =
    installedVersion !== undefined &&
    (!targetVersion || compareSemver(installedVersion, targetVersion) >= 0);
  if (disk.entryMissing || !versionOk) {
    const rollback = await rollbackAfterFailure(profileDir, packageName, currentVersion, snapshot, true);
    return {
      ok: false,
      packageName,
      action: 'reinstall',
      targetVersion,
      rollback,
      error: disk.entryMissing
        ? `重装后入口校验仍缺失：${disk.errorDetail || '文件不完整'}`
        : `重装后版本校验未通过：期望 ${targetVersion || '可用版本'}，实际 ${installedVersion || '未知'}`,
      errorCode: ERROR_CODES.verificationFailed,
      output: attempt.output
    };
  }

  const selfUpdate = packageName === OWN_PACKAGE_NAME;
  await triggerPackageRefresh(packageName, refresh);

  return {
    ok: true,
    packageName,
    action: 'reinstall',
    targetVersion: installedVersion,
    selfUpdate,
    rollback: 'not-needed',
    output: attempt.output
  };
}

async function performUninstall(
  packageName: string,
  bundle: BundleInfo | undefined,
  refresh: () => Promise<void>
): Promise<RescueResult> {
  if (packageName === OWN_PACKAGE_NAME) {
    return {
      ok: false,
      packageName,
      action: 'uninstall',
      error: '不能在急救中心卸载 dsh-plugins-update 自身',
      errorCode: ERROR_CODES.selfUninstallBlocked
    };
  }

  const { dir: profileDir, profileName } = resolveProfileDir(packageName);
  if (!existsSync(join(profileDir, 'package.json'))) {
    return {
      ok: false,
      packageName,
      action: 'uninstall',
      error: '找不到可用的 DSH profile 目录',
      errorCode: ERROR_CODES.profileNotFound
    };
  }

  const inManifest = Object.prototype.hasOwnProperty.call(readProfileDependencies(profileDir), packageName);
  const inNodeModules = existsSync(join(profileDir, 'node_modules', packageName));
  if (!inManifest && !inNodeModules && bundle?.installed === false) {
    return {
      ok: false,
      packageName,
      action: 'uninstall',
      error: '该插件未安装到当前 profile，无需卸载',
      errorCode: ERROR_CODES.notInstalled
    };
  }

  const currentVersion = readInstalledVersion(profileDir, packageName);
  const snapshot = captureSnapshot(profileDir);
  const attempt = await spawnRemove(profileDir, profileName, packageName);

  if (!attempt.ok) {
    const rollback = await rollbackAfterFailure(profileDir, packageName, currentVersion, snapshot, true);
    return {
      ok: false,
      packageName,
      action: 'uninstall',
      rollback,
      error: attempt.timedOut ? '卸载超时，已中止操作' : attempt.error || '卸载失败',
      errorCode: attempt.timedOut ? ERROR_CODES.timeout : ERROR_CODES.installFailed,
      output: attempt.output
    };
  }

  const stillInManifest = Object.prototype.hasOwnProperty.call(readProfileDependencies(profileDir), packageName);
  if (stillInManifest) {
    const rollback = await rollbackAfterFailure(profileDir, packageName, currentVersion, snapshot, true);
    return {
      ok: false,
      packageName,
      action: 'uninstall',
      rollback,
      error: '卸载后校验未通过：插件仍存在于 profile 配置中',
      errorCode: ERROR_CODES.verificationFailed,
      output: attempt.output
    };
  }

  await refresh().catch(() => {});

  return {
    ok: true,
    packageName,
    action: 'uninstall',
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

interface BatchCheckState {
  updatable: Record<string, string>;
  unhealthy: Record<string, PluginHealthSummary>;
}

export function apply(ctx: any, config: any) {
  const conn = ctx.get('connection');
  const registerFetch = conn?.fetch?.register?.bind(conn.fetch);
  if (typeof registerFetch !== 'function') return;

  const refreshAfterInstall = async () => {
    let reconciled = false;
    try {
      const hmr = ctx.get?.('hmr');
      if (hmr?.runExclusive && typeof hmr.reconcileProfile === 'function') {
        await hmr.runExclusive(() => hmr.reconcileProfile([]));
        reconciled = true;
      }
    } catch {}
    if (!reconciled) {
      try {
        const packages = ctx.get?.('pluginPackages');
        if (packages?.refresh) await packages.refresh();
      } catch {}
    }
    try {
      ctx.emit?.('plugin-manager/changed', { reason: 'install' });
      const root = ctx.root;
      if (root && root !== ctx && typeof root.emit === 'function') {
        root.emit('plugin-manager/changed', { reason: 'install' });
      }
    } catch {}
  };

  const runningProfiles = new Set<string>();
  let inFlightCheckAll: Promise<BatchCheckState> | null = null;
  ctx.on?.('plugin-manager/changed', () => {
    inFlightCheckAll = null;
  });

  // 1. Check for a newer version of a single package.
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
            const settings = readSettings(config);
            const { info, origin, registry } = await resolveRemotePackage(
              packageName,
              dir,
              settings,
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
              registry: safeRegistryUrl(registry),
              alwaysShowDetailButton: settings.alwaysShowDetailButton
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

  // 1b. Batch check all installed third-party packages on startup (plus local health & host version).
  ctx.effect(
    () =>
      registerFetch({
        path: CHECK_ALL_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (req: Request) => {
          try {
            const body = await parseJsonBody(req);
            const force = body?.force === true;
            const rawKnown: Record<string, unknown> =
              body?.knownUpdates && typeof body.knownUpdates === 'object' ? body.knownUpdates : {};

            const runBatch = async (): Promise<BatchCheckState> => {
              const installed = await inspectInstalledPluginsHealth(ctx);
              const settings = readSettings(config);
              const updatable: Record<string, string> = {};
              const unhealthy: Record<string, PluginHealthSummary> = {};
              const toProbe: InstalledThirdPartyPackage[] = [];

              for (const item of installed) {
                const hasIssues = item.issues.length > 0;
                if (hasIssues) {
                  unhealthy[item.packageName] = {
                    issues: item.issues,
                    ...(item.errorDetail ? { errorDetail: item.errorDetail } : {}),
                    currentVersion: item.currentVersion
                  };
                }
                const knownVer = !force && !hasIssues ? readTargetVersion(rawKnown[item.packageName]) : undefined;
                if (typeof knownVer === 'string' && compareSemver(knownVer, item.currentVersion) > 0) {
                  // Already known to have an unapplied update (and healthy); skip remote probe.
                  updatable[item.packageName] = knownVer;
                } else {
                  toProbe.push(item);
                }
              }

              const concurrency = 4;
              let cursor = 0;
              const workers = Array.from({ length: Math.min(concurrency, toProbe.length) }, async () => {
                while (cursor < toProbe.length) {
                  const current = toProbe[cursor++];
                  if (!current) break;
                  try {
                    const { info } = await resolveRemotePackage(
                      current.packageName,
                      current.dir,
                      settings,
                      current.source
                    );
                    if (compareSemver(info.version, current.currentVersion) > 0) {
                      updatable[current.packageName] = info.version;
                    }
                  } catch {
                    // Ignore single-package network errors during background startup probe.
                  }
                }
              });

              await Promise.all(workers);
              return { updatable, unhealthy };
            };

            let task: Promise<BatchCheckState>;
            if (!force && inFlightCheckAll) {
              task = inFlightCheckAll;
            } else {
              task = runBatch().finally(() => {
                if (inFlightCheckAll === task) inFlightCheckAll = null;
              });
              inFlightCheckAll = task;
            }

            const { updatable, unhealthy } = await task;
            const settings = readSettings(config);
            const result: CheckAllResult = {
              ok: true,
              updatable,
              hostVersion: detectHostVersion(ctx),
              unhealthy,
              registry: safeRegistryUrl(selectedRegistry(settings)),
              alwaysShowDetailButton: settings.alwaysShowDetailButton
            };
            return jsonResponse(result);
          } catch (error: any) {
            const errorCode = error instanceof RemoteError ? error.errorCode : ERROR_CODES.unknown;
            return errorResponse(
              { updatable: {} },
              errorCode,
              redactSecrets(error?.message || '批量检查更新失败')
            );
          }
        }
      }),
    'dsh-plugins-update: check-all route'
  );

  // 1c. Diagnose health and available updates for all third-party plugins.
  ctx.effect(
    () =>
      registerFetch({
        path: DIAGNOSE_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (req: Request) => {
          try {
            const body = await parseJsonBody(req);
            const rawCrashes =
              body?.clientCrashes && typeof body.clientCrashes === 'object' ? (body.clientCrashes as Record<string, unknown>) : {};
            const clientCrashes = new Map<string, string>();
            for (const [rawName, rawMsg] of Object.entries(rawCrashes)) {
              const pkgName = readPackageName(rawName);
              if (!pkgName || isOfficialPackageName(pkgName) || pkgName === OWN_PACKAGE_NAME) continue;
              if (typeof rawMsg === 'string' && rawMsg.trim()) {
                const msg = redactSecrets(rawMsg.trim());
                clientCrashes.set(pkgName, msg.length > 300 ? `${msg.slice(0, 300)}...` : msg);
              }
            }

            const installed = await inspectInstalledPluginsHealth(ctx);
            const settings = readSettings(config);
            const reports: PluginHealthReport[] = [];

            let cursor = 0;
            const concurrency = 4;
            const workers = Array.from({ length: Math.min(concurrency, installed.length) }, async () => {
              while (cursor < installed.length) {
                const item = installed[cursor++];
                if (!item) break;
                let latestVersion: string | undefined;
                let hasUpdate = false;
                let isGithub: boolean | undefined = parseGithubSource(item.source) ? true : undefined;

                try {
                  const { info } = await resolveRemotePackage(item.packageName, item.dir, settings, item.source);
                  latestVersion = info.version;
                  hasUpdate = compareSemver(info.version, item.currentVersion) > 0;
                  isGithub = info.isGithub;
                } catch {}

                const issues = [...item.issues];
                const details: string[] = item.errorDetail ? [item.errorDetail] : [];
                const crashMsg = clientCrashes.get(item.packageName);
                if (crashMsg) {
                  if (!issues.includes('client-crash')) issues.push('client-crash');
                  details.push(`前端异常: ${crashMsg}`);
                }

                reports.push({
                  packageName: item.packageName,
                  currentVersion: item.currentVersion,
                  latestVersion,
                  hasUpdate,
                  source: item.source,
                  isGithub,
                  enabled: item.bundle?.enabled,
                  availability: item.bundle?.availability,
                  healthy: issues.length === 0,
                  issues,
                  errorDetail: details.filter(Boolean).join('; ') || undefined
                });
              }
            });

            await Promise.all(workers);

            reports.sort((a, b) => {
              if (a.healthy !== b.healthy) return a.healthy ? 1 : -1;
              if (a.hasUpdate !== b.hasUpdate) return a.hasUpdate ? -1 : 1;
              return a.packageName.localeCompare(b.packageName);
            });

            const primaryProfile = resolveProfileDir();
            const result: DiagnoseResult = {
              ok: true,
              hostVersion: detectHostVersion(ctx),
              profileName: primaryProfile.profileName,
              plugins: reports,
              registry: safeRegistryUrl(selectedRegistry(settings))
            };
            return jsonResponse(result);
          } catch (error: any) {
            const errorCode = error instanceof RemoteError ? error.errorCode : ERROR_CODES.unknown;
            return errorResponse(
              { plugins: [] },
              errorCode,
              redactSecrets(error?.message || '插件健康诊断失败')
            );
          }
        }
      }),
    'dsh-plugins-update: diagnose route'
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

  // 3. Rescue actions (update / reinstall / safe uninstall) independent of plugin detail pages.
  ctx.effect(
    () =>
      registerFetch({
        path: RESCUE_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (req: Request) => {
          let packageName = '';
          let action: RescueAction = 'update';
          try {
            const body = await parseJsonBody(req);
            packageName = readPackageName(body?.packageName) ?? '';
            const rawAction = body?.action;
            if (rawAction === 'update' || rawAction === 'reinstall' || rawAction === 'uninstall') {
              action = rawAction;
            } else {
              return errorResponse(
                { packageName, action },
                ERROR_CODES.unknown,
                '不支持的急救操作类型',
                400
              );
            }
            if (!packageName) {
              return errorResponse(
                { packageName: '', action },
                ERROR_CODES.invalidPackageName,
                'packageName 必须是合法的 npm 包名',
                400
              );
            }
            const targetVersion = readTargetVersion(body?.targetVersion);
            if (targetVersion === null) {
              return errorResponse(
                { packageName, action },
                ERROR_CODES.invalidTargetVersion,
                'targetVersion 必须是合法的语义化版本',
                400
              );
            }

            const bundle = await readBundleInfo(ctx, packageName);
            const blocked = bundleGuardError(packageName, bundle);
            if (blocked) {
              return errorResponse({ packageName, action }, blocked.errorCode, blocked.error);
            }
            if (action === 'uninstall' && packageName === OWN_PACKAGE_NAME) {
              return errorResponse(
                { packageName, action },
                ERROR_CODES.selfUninstallBlocked,
                '不能在急救中心卸载 dsh-plugins-update 自身'
              );
            }

            const { dir } = resolveProfileDir(packageName);
            if (!existsSync(join(dir, 'package.json'))) {
              return errorResponse({ packageName, action }, ERROR_CODES.profileNotFound, '找不到可用的 DSH profile 目录');
            }
            if (runningProfiles.has(dir)) {
              return errorResponse(
                { packageName, action },
                ERROR_CODES.installInProgress,
                '另一个插件正在更新或修复，请稍后再试'
              );
            }

            runningProfiles.add(dir);
            try {
              const source = typeof body?.source === 'string' ? body.source : bundle?.source;
              if (action === 'update') {
                const updated = await performUpdate(
                  ctx,
                  config,
                  { packageName, targetVersion, source },
                  refreshAfterInstall
                );
                const result: RescueResult = {
                  ok: updated.ok,
                  packageName,
                  action: 'update',
                  targetVersion: updated.targetVersion,
                  selfUpdate: updated.selfUpdate,
                  rollback: updated.rollback,
                  error: updated.error,
                  errorCode: updated.errorCode,
                  output: updated.output
                };
                return jsonResponse(result);
              }
              if (action === 'reinstall') {
                const reinstalled = await performReinstall(
                  ctx,
                  config,
                  { packageName, targetVersion, source },
                  refreshAfterInstall
                );
                return jsonResponse(reinstalled);
              }
              const uninstalled = await performUninstall(packageName, bundle, refreshAfterInstall);
              return jsonResponse(uninstalled);
            } finally {
              runningProfiles.delete(dir);
            }
          } catch (error: any) {
            return errorResponse(
              { packageName, action },
              error instanceof RemoteError ? error.errorCode : ERROR_CODES.unknown,
              redactSecrets(error?.message || '急救操作失败')
            );
          }
        }
      }),
    'dsh-plugins-update: rescue route'
  );
}
