import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Schema from '@deepseek-ai/schemastery';
import {
  CHECK_ALL_PATH,
  CHECK_PATH,
  ERROR_CODES,
  OFFICIAL_REGISTRY,
  PLUGIN_NAME,
  REPORT_CONFLICT_PATH,
  UPDATE_PATH,
  UPDATER_REQUEST_HEADER,
  compareSemver,
  isDisallowedHost,
  isOfficialPackageName,
  normalizeRegistryUrl,
  parseSemver,
  resolveRegistryUrl,
  type CheckAllResult,
  type CheckUpdateResult,
  type CustomRegistry,
  type DoUpdateParams,
  type DoUpdateResult,
  type ErrorCode,
  type PluginConflictInfo,
  type PluginSettings,
  type ReportConflictResult
} from './types.js';

export const name = PLUGIN_NAME;
// Keep inject empty so a future host service rename never blocks the startup conflict guard.
export const inject: string[] = [];

const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;
const PROFILE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
const INSTALL_TIMEOUT_MS = 180_000;
const ROLLBACK_TIMEOUT_MS = 60_000;
const CHECK_TIMEOUT_MS = 12_000;
const OUTPUT_LIMIT = 8_000;
const MAX_REDIRECTS = 3;
const FIBER_PENDING = 0;
const FIBER_FAILED = 3;
const CRASH_LOOP_WINDOW_MS = 90_000;
const CRASH_LOOP_CLEAR_MS = 5_000;
const CRASH_LOOP_THRESHOLD = 3;
const RELEASE_COOLING_WINDOW_MS = 24 * 60 * 60 * 1000;
const MARKET_CACHE_TTL_MS = 10 * 60 * 1000;
const MARKET_FETCH_TIMEOUT_MS = 10_000;
const DEFAULT_MARKET_INDEX_URLS = [
  'https://awesome-dsh-plugin.com/index.json',
  'https://dshmarket.com/index.json',
  'https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json'
] as const;

const ALLOWED_CHILD_ENV_KEYS = [
  'PATH',
  'Path',
  'PATHEXT',
  'SystemRoot',
  'SYSTEMROOT',
  'SystemDrive',
  'WINDIR',
  'windir',
  'COMSPEC',
  'ComSpec',
  'TEMP',
  'TMP',
  'TMPDIR',
  'HOME',
  'USERPROFILE',
  'HOMEDRIVE',
  'HOMEPATH',
  'APPDATA',
  'LOCALAPPDATA',
  'ProgramData',
  'ProgramFiles',
  'ProgramFiles(x86)',
  'CommonProgramFiles',
  'USERNAME',
  'USER',
  'LOGNAME',
  'SHELL',
  'LANG',
  'LC_ALL',
  'LC_CTYPE',
  'TZ',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
  'XDG_DATA_HOME',
  'XDG_STATE_HOME',
  'PNPM_HOME',
  'PNPM_STORE_DIR',
  'NPM_CONFIG_CACHE',
  'npm_config_cache',
  'DSH_HOME',
  'DSH_PROFILE',
  'HTTP_PROXY',
  'HTTPS_PROXY',
  'ALL_PROXY',
  'NO_PROXY',
  'http_proxy',
  'https_proxy',
  'all_proxy',
  'no_proxy',
  'SSL_CERT_FILE',
  'SSL_CERT_DIR',
  'NODE_EXTRA_CA_CERTS',
  'REQUESTS_CA_BUNDLE',
  'CURL_CA_BUNDLE'
] as const;

function live<T>(schema: T): T {
  const s = schema as any;
  return typeof s?.volatile === 'function' ? s.volatile() : schema;
}

function createConfigSchema(): Schema<any> {
  try {
    return Schema.object({
      registry: live(
        Schema.string()
          .default('npmjs')
          .description('第三方插件更新源：npmjs（npm 官方）/ npmmirror（国内镜像）/ 自定义 HTTPS 源 URL；Update registry: npmjs | npmmirror | custom HTTPS URL')
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
      ),
      allowFreshRelease: live(
        Schema.boolean()
          .default(false)
          .description('允许探测并更新未满 24 小时发布观察期的版本（高风险）/ Allow probing and updating npm releases under the 24h cooling period (high risk)')
      ),
      allowUnreviewed: live(
        Schema.boolean()
          .default(false)
          .description('允许探测并更新未经市场安全审核的版本与来源（高风险）/ Allow probing and updating versions or sources without market security review (high risk)')
      )
    });
  } catch {
    return undefined as any;
  }
}

export const Config: Schema<any> = createConfigSchema();

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
    alwaysShowDetailButton: readField<boolean>(config?.alwaysShowDetailButton, false),
    allowFreshRelease: readField<boolean>(config?.allowFreshRelease, false),
    allowUnreviewed: readField<boolean>(config?.allowUnreviewed, false)
  };
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
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const version = trimmed.replace(/^[v^~]/, '');
  if (!version || /^[v^~]/.test(version)) return null;
  return parseSemver(version) ? version : null;
}

// --- atomic fs & security helpers -------------------------------------------------------

function writeFileAtomicSync(filePath: string, content: string): void {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = join(
    dir,
    `.${basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
  );
  try {
    writeFileSync(tmpPath, content, { encoding: 'utf8', mode: 0o600 });
    renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      rmSync(tmpPath, { force: true });
    } catch {}
    throw error;
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

// --- profile / host / package ---------------------------------------------------------

interface BundleRowSummary {
  rowId?: string;
  moduleName?: string;
  entryId?: string;
}

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
  rows?: BundleRowSummary[];
}

function detectHostVersion(ctx?: any): string | undefined {
  const envVersion = process.env.DSH_VERSION?.trim();
  if (envVersion) return envVersion;
  const ctxVersion = ctx?.host?.version || ctx?.app?.version;
  if (typeof ctxVersion === 'string' && ctxVersion.trim()) return ctxVersion.trim();

  try {
    const req = createRequire(import.meta.url);
    const bootPkgPath = req.resolve('@deepseek-ai/dsh-app-boot/package.json');
    if (bootPkgPath && existsSync(bootPkgPath)) {
      const bootPkg = JSON.parse(readFileSync(bootPkgPath, 'utf8'));
      if (typeof bootPkg?.version === 'string' && bootPkg.version.trim()) {
        return bootPkg.version.trim();
      }
    }
  } catch {}

  const execDir = process.execPath ? dirname(process.execPath) : '';
  const dshHome = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh');
  const candidates: string[] = [];
  if (execDir) {
    candidates.push(
      join(execDir, 'resources', 'app.asar', 'package.json'),
      join(execDir, '..', 'Resources', 'app.asar', 'package.json'),
      join(execDir, 'resources', 'app.asar', 'dsh', 'package.json'),
      join(execDir, '..', 'Resources', 'app.asar', 'dsh', 'package.json'),
      join(execDir, 'resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'package.json'),
      join(execDir, '..', 'Resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'package.json')
    );
  }
  candidates.push(
    join(dshHome, 'dsh-runtimes', 'dsh-primary-runtime', 'runtime.json'),
    join(dshHome, 'dsh-runtimes', 'dsh-primary-runtime', 'package.json')
  );

  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) continue;
      const data = JSON.parse(readFileSync(candidate, 'utf8'));
      const ver = data?.desktopVersion ?? data?.version;
      if (typeof ver === 'string' && ver.trim()) {
        return ver.trim();
      }
    } catch {}
  }
  return undefined;
}

function profileCandidates(): Array<{ dir: string; profileName: string }> {
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh');
  const profilesDir = join(dshHome, 'profiles');
  const rawPreferred = (process.env.DSH_PROFILE || '').trim();
  const preferred = rawPreferred && PROFILE_NAME_PATTERN.test(rawPreferred) ? rawPreferred : '';
  const names = [...new Set([preferred, 'desktop', 'default', 'web'].filter(Boolean))];
  const candidates = names
    .map(profileName => ({ dir: join(profilesDir, profileName), profileName }))
    .filter(candidate => existsSync(join(candidate.dir, 'package.json')));
  if (candidates.length === 0) candidates.push({ dir: join(profilesDir, 'desktop'), profileName: 'desktop' });
  return candidates;
}

function readProfileManifest(profileDir: string): any {
  const manifestPath = join(profileDir, 'package.json');
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch {
    return null;
  }
}

function readProfileDependencies(profileDir: string): Record<string, string> {
  const manifest = readProfileManifest(profileDir);
  if (!manifest) return {};
  return {
    ...(manifest?.optionalDependencies || {}),
    ...(manifest?.devDependencies || {}),
    ...(manifest?.dependencies || {})
  };
}

function readActiveBundlesFromManifest(profileDir: string): string[] {
  const manifest = readProfileManifest(profileDir);
  const bundles = manifest?.dsh?.profile?.bundles;
  if (!Array.isArray(bundles)) return [];
  return bundles.filter((item: unknown): item is string => typeof item === 'string');
}

function disableBundleOnDisk(profileDir: string, packageName: string): boolean {
  if (isOfficialPackageName(packageName) || packageName === PLUGIN_NAME) return false;
  const manifestPath = join(profileDir, 'package.json');
  const manifest = readProfileManifest(profileDir);
  const bundles = manifest?.dsh?.profile?.bundles;
  if (!manifest || !Array.isArray(bundles) || !bundles.includes(packageName)) return false;

  const updated = {
    ...manifest,
    dsh: {
      ...manifest.dsh,
      profile: {
        ...manifest.dsh.profile,
        bundles: bundles.filter((name: unknown) => name !== packageName)
      }
    }
  };
  try {
    writeFileAtomicSync(manifestPath, `${JSON.stringify(updated, null, 2)}\n`);
    return true;
  } catch {
    return false;
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

function getService(ctx: any, names: string[]): any {
  for (const service of names) {
    try {
      const direct = ctx?.get?.(service);
      if (direct !== undefined) return direct;
    } catch {}
    try {
      const rootSvc = ctx?.root?.get?.(service);
      if (rootSvc !== undefined) return rootSvc;
    } catch {}
  }
  return undefined;
}

async function readAllBundles(ctx: any): Promise<BundleInfo[]> {
  for (const service of ['pluginManager', 'plugin-manager']) {
    for (const scope of [ctx, ctx?.root]) {
      try {
        const manager = scope?.get?.(service);
        if (typeof manager?.listBundles !== 'function') continue;
        const bundles = await manager.listBundles();
        if (Array.isArray(bundles)) return bundles as BundleInfo[];
      } catch {}
    }
  }
  return [];
}

async function readBundleInfo(ctx: any, packageName: string): Promise<BundleInfo | undefined> {
  const bundles = await readAllBundles(ctx);
  return bundles.find((item: any) => item && item.name === packageName);
}

function extractVersionFromSpec(spec: unknown): string {
  if (typeof spec !== 'string') return '0.0.0';
  const cleaned = spec.trim().replace(/^[v^~=]+/, '');
  return cleaned && parseSemver(cleaned) ? cleaned : '0.0.0';
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
  const nodeModulesRoot = resolve(profileDir, 'node_modules');
  const pkgDir = resolve(nodeModulesRoot, packageName);
  const pkgRel = relative(nodeModulesRoot, pkgDir);
  if (!pkgRel || pkgRel.startsWith('..') || isAbsolute(pkgRel)) {
    return { entryMissing: true, errorDetail: '插件目录路径越界' };
  }

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
    const targetPath = resolve(pkgDir, cleanRel);
    const rel = relative(pkgDir, targetPath);
    if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
      return {
        entryMissing: true,
        currentVersion,
        errorDetail: `入口路径越界: ${relPath}`
      };
    }
    if (!existsSync(targetPath)) {
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
  if (bundle.error && typeof bundle.error === 'object') {
    const code = typeof bundle.error.code === 'string' ? bundle.error.code : '';
    if (code === 'incompatible-version') return '声明的 DSH 兼容版本与当前宿主不匹配';
    if (code === 'unsupported-platform') return '不支持当前操作系统平台';
    if (typeof bundle.error.diagnostic === 'string' && bundle.error.diagnostic.trim()) {
      const redacted = redactSecrets(bundle.error.diagnostic.trim());
      return redacted.length > 300 ? `${redacted.slice(0, 300)}...` : redacted;
    }
    if (code) return `宿主拒绝加载 (${code})`;
  }
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
  return redacted.length > 300 ? `${redacted.slice(0, 300)}...` : redacted;
}

interface InstalledThirdPartyPackage {
  packageName: string;
  dir: string;
  profileName: string;
  currentVersion: string;
  source?: string;
  bundle?: BundleInfo;
  enabled: boolean;
}

async function listInstalledThirdPartyPackages(ctx: any): Promise<InstalledThirdPartyPackage[]> {
  const bundles = await readAllBundles(ctx);
  const bundleMap = new Map<string, BundleInfo>();
  for (const b of bundles) {
    if (b && typeof b.name === 'string') bundleMap.set(b.name, b);
  }

  const profiles = profileCandidates().map(candidate => ({
    ...candidate,
    deps: readProfileDependencies(candidate.dir),
    activeBundles: new Set(readActiveBundlesFromManifest(candidate.dir))
  }));
  const primaryProfile = profiles.find(p => p.profileName === 'desktop') ?? profiles[0];
  const manifestDepsByPackage = new Map<string, string>();
  for (const candidate of profiles) {
    for (const [depName, spec] of Object.entries(candidate.deps)) {
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

    const owner = profiles.find(p => Object.prototype.hasOwnProperty.call(p.deps, packageName)) ?? primaryProfile;
    const { dir, profileName, activeBundles } = owner;
    const installedVersion = readInstalledVersion(dir, packageName);
    if (!inManifest && !installedVersion) continue;

    const enabled = bundle ? bundle.enabled === true : activeBundles.has(packageName);
    result.push({
      packageName,
      dir,
      profileName,
      currentVersion: installedVersion || extractVersionFromSpec(declaredSpec),
      source: declaredSpec || bundle?.source,
      bundle,
      enabled
    });
  }
  return result;
}

function isDeclaredInProfile(packageName: string): boolean {
  const { dir } = resolveProfileDir(packageName);
  return Object.prototype.hasOwnProperty.call(readProfileDependencies(dir), packageName);
}

function bundleGuardError(
  packageName: string,
  bundle: BundleInfo | undefined
): { error: string; errorCode: ErrorCode } | undefined {
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
  const nodeModulesRoot = resolve(profileDir, 'node_modules');
  const pkgDir = resolve(nodeModulesRoot, packageName);
  const rel = relative(nodeModulesRoot, pkgDir);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return undefined;
  const manifestPath = join(pkgDir, 'package.json');
  try {
    const pkg = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return typeof pkg.version === 'string' && pkg.version.trim() ? pkg.version.trim() : undefined;
  } catch {
    return undefined;
  }
}

// --- Guard state, crash-loop sentinel & conflict detection ----------------------------

interface BootStreakState {
  hostVersion: string;
  count: number;
  timestamp: number;
}

interface GuardState {
  lastHostVersion?: string;
  bootStreak?: BootStreakState;
  conflicts: Record<string, PluginConflictInfo>;
}

function guardStatePath(profileDir: string): string {
  return join(profileDir, '.plugin-manager', 'dsh-plugins-update-state.json');
}

function loadGuardState(profileDir: string): GuardState {
  const empty: GuardState = { conflicts: {} };
  const filePath = guardStatePath(profileDir);
  if (!existsSync(filePath)) return empty;
  try {
    const raw = JSON.parse(readFileSync(filePath, 'utf8'));
    if (!raw || typeof raw !== 'object') return empty;
    const conflicts: Record<string, PluginConflictInfo> = {};
    if (raw.conflicts && typeof raw.conflicts === 'object') {
      for (const [k, v] of Object.entries(raw.conflicts)) {
        const pkgName = readPackageName(k);
        if (!pkgName || isOfficialPackageName(pkgName) || pkgName === PLUGIN_NAME) continue;
        if (!v || typeof v !== 'object') continue;
        const entry = v as Record<string, unknown>;
        const pluginVersion = typeof entry.pluginVersion === 'string' && entry.pluginVersion.trim() ? entry.pluginVersion.trim() : '0.0.0';
        const hostVersion = typeof entry.hostVersion === 'string' && entry.hostVersion.trim() ? entry.hostVersion.trim() : undefined;
        const reason = typeof entry.reason === 'string' && entry.reason.trim() ? redactSecrets(entry.reason.trim()) : undefined;
        conflicts[pkgName] = { pluginVersion, ...(hostVersion ? { hostVersion } : {}), ...(reason ? { reason } : {}) };
      }
    }
    const lastHostVersion =
      typeof raw.lastHostVersion === 'string' && raw.lastHostVersion.trim() ? raw.lastHostVersion.trim() : undefined;
    let bootStreak: BootStreakState | undefined;
    if (
      raw.bootStreak &&
      typeof raw.bootStreak === 'object' &&
      typeof raw.bootStreak.hostVersion === 'string' &&
      typeof raw.bootStreak.count === 'number' &&
      typeof raw.bootStreak.timestamp === 'number'
    ) {
      bootStreak = {
        hostVersion: raw.bootStreak.hostVersion.trim(),
        count: raw.bootStreak.count,
        timestamp: raw.bootStreak.timestamp
      };
    }
    return { lastHostVersion, bootStreak, conflicts };
  } catch {
    return empty;
  }
}

function saveGuardState(profileDir: string, state: GuardState): void {
  if (!existsSync(join(profileDir, 'package.json'))) return;
  try {
    writeFileAtomicSync(guardStatePath(profileDir), `${JSON.stringify(state, null, 2)}\n`);
  } catch {}
}

function clearConflictInState(profileDir: string, packageName: string): boolean {
  const state = loadGuardState(profileDir);
  if (!Object.prototype.hasOwnProperty.call(state.conflicts, packageName)) return false;
  delete state.conflicts[packageName];
  saveGuardState(profileDir, state);
  return true;
}

function pathMatchesPackage(candidatePath: string, packageName: string): boolean {
  if (!candidatePath) return false;
  let normalized = candidatePath;
  if (normalized.startsWith('file:')) {
    try {
      normalized = fileURLToPath(normalized);
    } catch {
      return false;
    }
  }
  normalized = normalized.replace(/\\/g, '/');
  const idx = normalized.lastIndexOf('/node_modules/');
  if (idx < 0) return false;
  const rest = normalized.slice(idx + '/node_modules/'.length);
  return rest === packageName || rest.startsWith(`${packageName}/`);
}

function entryBelongsToPackage(entry: any, packageName: string, bundleRowIds: Set<string>): boolean {
  if (!entry) return false;
  const entryId = typeof entry.id === 'string' ? entry.id : typeof entry.options?.id === 'string' ? entry.options.id : '';
  if (entryId && bundleRowIds.has(entryId)) return true;

  const modName = typeof entry.options?.name === 'string' ? entry.options.name : '';
  if (modName === packageName || modName.startsWith(`${packageName}/`) || pathMatchesPackage(modName, packageName)) {
    return true;
  }

  const baseUrl = typeof entry.parent?.tree?.ctx?.baseUrl === 'string' ? entry.parent.tree.ctx.baseUrl : '';
  return pathMatchesPackage(baseUrl, packageName);
}

function detectPluginConflict(
  profileDir: string,
  packageName: string,
  bundle: BundleInfo | undefined,
  loaderEntries: any[]
): string | undefined {
  if (isOfficialPackageName(packageName) || packageName === PLUGIN_NAME) return undefined;

  const bundleError = extractBundleErrorDetail(bundle);
  const hasBundleError =
    Boolean(bundleError) || bundle?.status === 'error' || bundle?.state === 'error' || bundle?.state === 'failed';
  if (hasBundleError) {
    return bundleError || `插件异常 (${bundle?.status || bundle?.state || 'error'})`;
  }

  const disk = inspectPackageDiskHealth(profileDir, packageName);
  if (disk.entryMissing) {
    return disk.errorDetail || '插件入口文件缺失或损坏';
  }

  if (loaderEntries.length > 0) {
    const bundleRowIds = new Set<string>();
    for (const row of bundle?.rows || []) {
      if (row?.rowId) bundleRowIds.add(row.rowId);
      if (row?.entryId) bundleRowIds.add(row.entryId);
    }

    for (const entry of loaderEntries) {
      if (!entryBelongsToPackage(entry, packageName, bundleRowIds)) continue;
      let disabled = false;
      try {
        disabled = entry?.disabled === true;
      } catch {
        return '插件启用条件表达式执行异常';
      }
      if (disabled) continue;

      const fiber = entry.fiber;
      if (!fiber || fiber.state === FIBER_FAILED) {
        return '插件后端模块加载或初始化失败';
      }
      if (fiber.state === FIBER_PENDING) {
        const missing = Object.keys(fiber.inject || {}).filter(service => {
          try {
            return fiber.ctx?.get?.(service) === undefined;
          } catch {
            return true;
          }
        });
        if (missing.length > 0) {
          return `依赖的宿主服务缺失或已变更: ${missing.join(', ')}`;
        }
      }
    }
  }

  return undefined;
}

// --- GitHub / npm origin resolution ---------------------------------------------------

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
        // Track pinned commit SHA so market commit updates can replace it when reviewing unbranched installs.
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

/** Resolve package origin strictly from authoritative local profile manifest or host bundle metadata. */
function resolvePackageOrigin(profileDir: string, packageName: string, hostBundleSource?: string): PackageOrigin {
  const spec = readProfileDependencies(profileDir)[packageName];
  const fromManifest = parseGithubSource(spec);
  if (fromManifest) return { isGithub: true, github: fromManifest, declaredSpec: spec };
  if (!spec && hostBundleSource) {
    const fromHost = parseGithubSource(hostBundleSource);
    if (fromHost) return { isGithub: true, github: fromHost, declaredSpec: hostBundleSource };
  }
  return { isGithub: false, declaredSpec: spec || hostBundleSource };
}

// --- network --------------------------------------------------------------------------

class RemoteError extends Error {
  errorCode: ErrorCode;
  constructor(errorCode: ErrorCode, message: string) {
    super(message);
    this.errorCode = errorCode;
  }
}

function encodePackageName(packageName: string): string {
  return encodeURIComponent(packageName).replace(/^%40/i, '@');
}

function assertSafeHttpsUrl(rawUrl: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new RemoteError(ERROR_CODES.offline, '更新源 URL 格式不合法');
  }
  if (parsed.protocol !== 'https:') {
    throw new RemoteError(ERROR_CODES.offline, '仅支持 HTTPS 更新源地址');
  }
  if (parsed.username || parsed.password) {
    throw new RemoteError(ERROR_CODES.offline, '更新源地址不允许包含内嵌账号凭据');
  }
  if (isDisallowedHost(parsed.hostname)) {
    throw new RemoteError(ERROR_CODES.offline, '更新源主机地址被安全策略拒绝');
  }
  return parsed;
}

async function fetchJson(
  url: string,
  timeoutMs = CHECK_TIMEOUT_MS,
  externalSignal?: AbortSignal,
  accept = 'application/json'
): Promise<any> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = externalSignal ? AbortSignal.any([controller.signal, externalSignal]) : controller.signal;
  try {
    let currentUrl = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const parsed = assertSafeHttpsUrl(currentUrl);
      const response = await fetch(parsed.href, {
        headers: {
          accept,
          'user-agent': PLUGIN_NAME
        },
        signal,
        redirect: 'manual'
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        try {
          await response.body?.cancel?.();
        } catch {}
        if (!location || hop === MAX_REDIRECTS) {
          throw new RemoteError(ERROR_CODES.offline, '更新源重定向次数过多或目标地址缺失');
        }
        currentUrl = new URL(location, parsed.href).href;
        continue;
      }

      if (!response.ok) throw new RemoteError(ERROR_CODES.offline, `HTTP ${response.status}`);
      return await response.json();
    }
    throw new RemoteError(ERROR_CODES.offline, '更新源重定向异常');
  } catch (error: any) {
    if (error instanceof RemoteError) throw error;
    if (controller.signal.aborted) throw new RemoteError(ERROR_CODES.timeout, '检查更新超时');
    if (externalSignal?.aborted || error?.name === 'AbortError') throw error;
    throw new RemoteError(ERROR_CODES.offline, redactSecrets(error?.message || '网络请求失败'));
  } finally {
    clearTimeout(timer);
  }
}

interface MarketReviewedVersion {
  version: string;
  publishTimestampMs?: number;
  sourceType: 'npm' | 'git' | 'other';
  gitUrl?: string;
  gitCommit?: string;
  gitPath?: string;
}

interface MarketReviewLookup {
  available: boolean;
  versions: MarketReviewedVersion[];
}

interface CachedMarketIndexDoc {
  fetchedAt: number;
  plugins: Map<string, MarketReviewedVersion[]>;
}

const marketIndexCache = new Map<string, CachedMarketIndexDoc>();
const inFlightMarketIndex = new Map<string, Promise<Map<string, MarketReviewedVersion[]>>>();
let defaultMarketCache: CachedMarketIndexDoc | null = null;
let inFlightDefaultMarket: Promise<Map<string, MarketReviewedVersion[]>> | null = null;

function parseMarketPluginVersions(rawPlugin: any): MarketReviewedVersion[] {
  const out: MarketReviewedVersion[] = [];
  if (!Array.isArray(rawPlugin?.versions)) return out;
  for (const v of rawPlugin.versions) {
    const version = readTargetVersion(v?.version);
    if (!version) continue;
    const publishTimestampMs =
      typeof v?.publishTimestamp === 'number' && Number.isFinite(v.publishTimestamp)
        ? v.publishTimestamp * 1000
        : undefined;
    const rawType = v?.source?.type;
    if (rawType === 'npm') {
      out.push({ version, publishTimestampMs, sourceType: 'npm' });
    } else if (rawType === 'git') {
      out.push({
        version,
        publishTimestampMs,
        sourceType: 'git',
        gitUrl: typeof v?.source?.url === 'string' ? v.source.url : undefined,
        gitCommit: typeof v?.source?.commit === 'string' ? v.source.commit.toLowerCase() : undefined,
        gitPath: typeof v?.source?.path === 'string' ? v.source.path.replace(/^\/+|\/+$/g, '') : undefined
      });
    } else {
      out.push({ version, publishTimestampMs, sourceType: 'other' });
    }
  }
  return out;
}

export function parseMarketIndexPayload(raw: any): Map<string, MarketReviewedVersion[]> {
  if (!raw || raw.format !== 1 || !Array.isArray(raw.plugins)) {
    throw new Error('Invalid format-1 market index payload');
  }
  const map = new Map<string, MarketReviewedVersion[]>();
  for (const plugin of raw.plugins) {
    const pkgName = readPackageName(plugin?.name);
    if (!pkgName) continue;
    const parsedVersions = parseMarketPluginVersions(plugin);
    if (parsedVersions.length > 0) {
      map.set(pkgName, parsedVersions);
    }
  }
  return map;
}

async function fetchCachedMarketIndexByUrl(url: string): Promise<Map<string, MarketReviewedVersion[]>> {
  const normalized = url.trim();
  const cached = marketIndexCache.get(normalized);
  if (cached && Date.now() - cached.fetchedAt < MARKET_CACHE_TTL_MS) {
    return cached.plugins;
  }
  const existing = inFlightMarketIndex.get(normalized);
  if (existing) return existing;

  const task = (async () => {
    const raw = await fetchJson(normalized, MARKET_FETCH_TIMEOUT_MS);
    const plugins = parseMarketIndexPayload(raw);
    marketIndexCache.set(normalized, { fetchedAt: Date.now(), plugins });
    return plugins;
  })().finally(() => {
    if (inFlightMarketIndex.get(normalized) === task) {
      inFlightMarketIndex.delete(normalized);
    }
  });
  inFlightMarketIndex.set(normalized, task);
  return task;
}

async function loadDefaultCommunityMarketIndex(): Promise<Map<string, MarketReviewedVersion[]>> {
  if (defaultMarketCache && Date.now() - defaultMarketCache.fetchedAt < MARKET_CACHE_TTL_MS) {
    return defaultMarketCache.plugins;
  }
  if (inFlightDefaultMarket) return inFlightDefaultMarket;

  const task = (async () => {
    const controller = new AbortController();
    try {
      const parsed = await Promise.any(
        DEFAULT_MARKET_INDEX_URLS.map(async url => {
          const raw = await fetchJson(url, MARKET_FETCH_TIMEOUT_MS, controller.signal);
          return parseMarketIndexPayload(raw);
        })
      );
      defaultMarketCache = { fetchedAt: Date.now(), plugins: parsed };
      return parsed;
    } finally {
      controller.abort();
    }
  })().finally(() => {
    if (inFlightDefaultMarket === task) {
      inFlightDefaultMarket = null;
    }
  });
  inFlightDefaultMarket = task;
  return task;
}

async function getReviewedVersionsForPackage(ctx: any, packageName: string): Promise<MarketReviewLookup> {
  const market = getService(ctx, ['pluginMarket', 'plugin-market']);
  let indexUrls: string[] = [];
  if (market && typeof market.listIndexes === 'function') {
    try {
      const summaries = market.listIndexes();
      if (Array.isArray(summaries)) {
        indexUrls = summaries
          .map((item: any) => (typeof item?.url === 'string' ? item.url.trim() : ''))
          .filter(Boolean);
      }
    } catch {
      indexUrls = [];
    }
  }

  if (indexUrls.length > 0) {
    const merged: MarketReviewedVersion[] = [];
    let anySucceeded = false;
    await Promise.all(
      indexUrls.map(async url => {
        if (typeof market?.entry === 'function') {
          try {
            const entry = await market.entry(url, packageName);
            anySucceeded = true;
            if (entry) merged.push(...parseMarketPluginVersions(entry));
            return;
          } catch {
            // Fall through to direct HTTPS index fetch on worker/service errors.
          }
        }
        try {
          const map = await fetchCachedMarketIndexByUrl(url);
          anySucceeded = true;
          const entries = map.get(packageName);
          if (entries) merged.push(...entries);
        } catch {}
      })
    );
    return { available: anySucceeded, versions: merged };
  }

  try {
    const map = await loadDefaultCommunityMarketIndex();
    return { available: true, versions: map.get(packageName) ?? [] };
  } catch {
    return { available: false, versions: [] };
  }
}

interface RemotePackageInfo {
  version: string;
  hasUpdate: boolean;
  registry?: string;
  isGithub: boolean;
  isFreshRelease: boolean;
  isUnreviewed: boolean;
  reviewedGitCommit?: string;
  blockedReason?: 'freshReleaseBlocked' | 'unreviewedBlocked';
}

interface NpmPackument {
  versions: Record<string, any>;
  distTags: Record<string, string>;
  time: Record<string, string>;
}

async function fetchNpmPackument(packageName: string, registry: string): Promise<NpmPackument> {
  const data = await fetchJson(
    `${registry}${encodePackageName(packageName)}`,
    CHECK_TIMEOUT_MS,
    undefined,
    'application/json'
  );
  const versions = data?.versions && typeof data.versions === 'object' ? (data.versions as Record<string, any>) : {};
  const distTags =
    data?.['dist-tags'] && typeof data['dist-tags'] === 'object'
      ? (data['dist-tags'] as Record<string, string>)
      : {};
  const time = data?.time && typeof data.time === 'object' ? (data.time as Record<string, string>) : {};
  if (Object.keys(versions).length === 0 && typeof distTags.latest !== 'string') {
    throw new RemoteError(ERROR_CODES.offline, '更新源未返回有效的版本列表');
  }
  return { versions, distTags, time };
}

function inspectNpmVersionPolicy(
  packument: NpmPackument,
  version: string,
  reviewedVersions: MarketReviewedVersion[],
  reviewAvailable: boolean
): { exists: boolean; deprecated: boolean; isFreshRelease: boolean; isUnreviewed: boolean } {
  const versionObj = packument.versions[version];
  const exists = Boolean(versionObj && typeof versionObj === 'object');
  const deprecated = Boolean(versionObj?.deprecated);
  const timeIso = packument.time?.[version];
  const timeMs = typeof timeIso === 'string' ? Date.parse(timeIso) : NaN;
  const reviewedEntry = reviewAvailable
    ? reviewedVersions.find(rv => rv.version === version && rv.sourceType === 'npm')
    : undefined;
  const effectiveTimeMs = Number.isFinite(timeMs) ? timeMs : reviewedEntry?.publishTimestampMs;
  const isFreshRelease =
    typeof effectiveTimeMs === 'number' && Number.isFinite(effectiveTimeMs)
      ? Date.now() - effectiveTimeMs < RELEASE_COOLING_WINDOW_MS
      : true;
  const isUnreviewed = !reviewedEntry;
  return { exists, deprecated, isFreshRelease, isUnreviewed };
}

function encodeRefSegments(value: string): string {
  return value
    .split('/')
    .map(seg => encodeURIComponent(seg))
    .join('/');
}

async function fetchGithubPackageJson(github: GithubOrigin): Promise<{ version: string }> {
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
      version: data.version.trim()
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

function findMatchingReviewedGitVersions(
  review: MarketReviewLookup,
  github: GithubOrigin
): MarketReviewedVersion[] {
  if (!review.available) return [];
  const expectedRepo = `${github.owner}/${github.repo}`.toLowerCase();
  const expectedPath = (github.subpath || '').replace(/^\/+|\/+$/g, '');
  return review.versions
    .filter(rv => {
      if (rv.sourceType !== 'git' || !rv.gitCommit || !/^[0-9a-f]{40}$/i.test(rv.gitCommit)) return false;
      const parsedRepo = parseGithubSource(rv.gitUrl);
      if (!parsedRepo) return false;
      const rvRepo = `${parsedRepo.owner}/${parsedRepo.repo}`.toLowerCase();
      const rvPath = (rv.gitPath || '').replace(/^\/+|\/+$/g, '');
      return rvRepo === expectedRepo && rvPath === expectedPath;
    })
    .sort((a, b) => compareSemver(b.version, a.version));
}

async function evaluatePackageCandidate(
  ctx: any,
  packageName: string,
  currentVersion: string,
  profileDir: string,
  settings: PluginSettings,
  hostBundleSource?: string
): Promise<{ info: RemotePackageInfo; origin: PackageOrigin; registry: string }> {
  const origin = resolvePackageOrigin(profileDir, packageName, hostBundleSource);
  const registry = resolveRegistryUrl(settings.registry);

  if (origin.isGithub && origin.github) {
    const github = origin.github;
    const review = await getReviewedVersionsForPackage(ctx, packageName);

    if (!github.ref) {
      const reviewedGit = findMatchingReviewedGitVersions(review, github);
      let blockedByFresh = false;
      for (const rv of reviewedGit) {
        if (compareSemver(rv.version, currentVersion) <= 0) continue;
        const isFreshRelease =
          typeof rv.publishTimestampMs === 'number' && Number.isFinite(rv.publishTimestampMs)
            ? Date.now() - rv.publishTimestampMs < RELEASE_COOLING_WINDOW_MS
            : false;
        if (isFreshRelease && !settings.allowFreshRelease) {
          blockedByFresh = true;
          continue;
        }
        return {
          info: {
            version: rv.version,
            hasUpdate: true,
            registry,
            isGithub: true,
            isFreshRelease,
            isUnreviewed: false,
            reviewedGitCommit: rv.gitCommit
          },
          origin,
          registry
        };
      }
      if (!settings.allowUnreviewed) {
        if (!review.available) {
          throw new RemoteError(ERROR_CODES.offline, '无法获取插件安全审核索引');
        }
        return {
          info: {
            version: currentVersion || '0.0.0',
            hasUpdate: false,
            registry,
            isGithub: true,
            isFreshRelease: false,
            isUnreviewed: false,
            ...(blockedByFresh ? { blockedReason: 'freshReleaseBlocked' as const } : {})
          },
          origin,
          registry
        };
      }
    } else if (!settings.allowUnreviewed) {
      if (!review.available) {
        throw new RemoteError(ERROR_CODES.offline, '无法获取插件安全审核索引');
      }
      return {
        info: {
          version: currentVersion || '0.0.0',
          hasUpdate: false,
          registry,
          isGithub: true,
          isFreshRelease: false,
          isUnreviewed: true,
          blockedReason: 'unreviewedBlocked'
        },
        origin,
        registry
      };
    }

    const remote = await fetchGithubPackageJson(github);
    const cleanLatest = remote.version.trim().replace(/^[v^~]/, '');
    return {
      info: {
        version: cleanLatest,
        hasUpdate: compareSemver(cleanLatest, currentVersion) > 0,
        registry,
        isGithub: true,
        isFreshRelease: false,
        isUnreviewed: true
      },
      origin,
      registry
    };
  }

  const [packument, review] = await Promise.all([
    fetchNpmPackument(packageName, registry),
    getReviewedVersionsForPackage(ctx, packageName)
  ]);

  if (!settings.allowUnreviewed && !review.available) {
    throw new RemoteError(ERROR_CODES.offline, '无法获取插件安全审核索引');
  }

  const rawLatest = typeof packument.distTags?.latest === 'string' ? packument.distTags.latest.trim() : '';
  const latestTag = rawLatest ? rawLatest.replace(/^[v^~]/, '') : '';
  const latestParsed = latestTag ? parseSemver(latestTag) : null;
  const capAtLatest = Boolean(latestTag && latestParsed && latestParsed.prerelease.length === 0);
  const currentParsed = parseSemver(currentVersion);
  const currentIsPrerelease = Boolean(currentParsed && currentParsed.prerelease.length > 0);

  const candidates: string[] = [];
  for (const rawVer of Object.keys(packument.versions)) {
    const parsed = parseSemver(rawVer);
    if (!parsed) continue;
    const vObj = packument.versions[rawVer];
    if (!vObj || typeof vObj !== 'object' || vObj.deprecated) continue;
    if (compareSemver(rawVer, currentVersion) <= 0) continue;
    if (parsed.prerelease.length > 0 && !(rawVer === latestTag && currentIsPrerelease)) continue;
    if (capAtLatest && rawVer !== latestTag && compareSemver(rawVer, latestTag) > 0) continue;
    candidates.push(rawVer);
  }
  candidates.sort((a, b) => compareSemver(b, a));

  let blockedByUnreviewed = false;
  let blockedByFresh = false;

  for (const candidateVer of candidates) {
    const policy = inspectNpmVersionPolicy(packument, candidateVer, review.versions, review.available);
    if (policy.isUnreviewed && !settings.allowUnreviewed) {
      blockedByUnreviewed = true;
      continue;
    }
    if (policy.isFreshRelease && !settings.allowFreshRelease) {
      blockedByFresh = true;
      continue;
    }
    return {
      info: {
        version: candidateVer,
        hasUpdate: true,
        registry,
        isGithub: false,
        isFreshRelease: policy.isFreshRelease,
        isUnreviewed: policy.isUnreviewed
      },
      origin,
      registry
    };
  }

  const blockedReason = blockedByFresh
    ? ('freshReleaseBlocked' as const)
    : blockedByUnreviewed
      ? ('unreviewedBlocked' as const)
      : undefined;

  return {
    info: {
      version: currentVersion || '0.0.0',
      hasUpdate: false,
      registry,
      isGithub: false,
      isFreshRelease: false,
      isUnreviewed: false,
      ...(blockedReason ? { blockedReason } : {})
    },
    origin,
    registry
  };
}

// --- install --------------------------------------------------------------------------

function desktopCliCandidates(): string[] {
  const candidates: string[] = [];
  const override = process.env.DSH_CLI_JS?.trim();
  if (override) candidates.push(override);
  const appRel = join('app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js');
  const cliRel = join('resources', appRel);
  const execDir = process.execPath ? dirname(process.execPath) : '';
  if (execDir) {
    candidates.push(join(execDir, cliRel));
    candidates.push(join(execDir, '..', 'Resources', appRel));
  }
  if (process.env.LOCALAPPDATA) candidates.push(join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness', cliRel));
  return candidates;
}

function pnpmCandidates(): string[] {
  const candidates: string[] = [];
  const override = process.env.DSH_PNPM_JS?.trim();
  if (override) candidates.push(override);
  const runtimeRel = join('runtime', 'primary-runtime', 'dependencies', 'pnpm', 'bin', 'pnpm.mjs');
  const rel = join('resources', runtimeRel);
  const execDir = process.execPath ? dirname(process.execPath) : '';
  if (execDir) {
    candidates.push(join(execDir, rel));
    candidates.push(join(execDir, '..', 'Resources', runtimeRel));
    candidates.push(join(execDir, '..', rel));
  }
  const dshHome = process.env.DSH_HOME?.trim() || join(homedir(), '.dsh');
  candidates.push(join(dshHome, 'dsh-runtimes', 'dsh-primary-runtime', 'dependencies', 'pnpm', 'bin', 'pnpm.mjs'));
  if (process.env.LOCALAPPDATA) candidates.push(join(process.env.LOCALAPPDATA, 'Programs', 'DeepSeek Harness', rel));
  return candidates;
}

function createChildEnv(registry?: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ELECTRON_RUN_AS_NODE: '1',
    GIT_TERMINAL_PROMPT: '0',
    npm_config_update_notifier: 'false',
    pnpm_config_update_notifier: 'false',
    npm_config_fund: 'false',
    npm_config_audit: 'false'
  };
  for (const key of ALLOWED_CHILD_ENV_KEYS) {
    const val = process.env[key];
    if (typeof val === 'string') env[key] = val;
  }
  if (registry) env.npm_config_registry = registry;
  return env;
}

function formatWorkspaceExcludeScalar(entry: string): string {
  if (/^[A-Za-z0-9][A-Za-z0-9@._/| -]*$/.test(entry) && !entry.includes(' #')) {
    return entry;
  }
  return `"${entry.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

function unquoteWorkspaceExcludeScalar(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed.replace(/\s+#.*$/, '').trim();
}

function matchWorkspaceExcludeEntry(entry: string, packageName: string): { exactAll: boolean; versions?: string[] } | null {
  if (entry === packageName) return { exactAll: true };
  if (entry.startsWith(`${packageName}@`)) {
    const rawVers = entry.slice(packageName.length + 1).trim();
    const versions = rawVers
      .split(/\s*\|\|\s*/)
      .map(v => v.trim())
      .filter(Boolean);
    return { exactAll: false, versions };
  }
  return null;
}

/** Add a scoped single-package exemption (<packageName>@<targetVersion>) without disabling 24h protection for dependencies. */
export function applyMinimumReleaseAgeExemptionYaml(
  existingContent: string | null,
  packageName: string,
  targetVersion: string
): string {
  const eol = existingContent?.includes('\r\n') ? '\r\n' : '\n';
  const newScalar = formatWorkspaceExcludeScalar(`${packageName}@${targetVersion}`);
  if (!existingContent || !existingContent.trim()) {
    return [`packages:`, `  - .`, ``, `minimumReleaseAgeExclude:`, `  - ${newScalar}`, ``].join(eol);
  }

  const lines = existingContent.split(/\r?\n/);
  const keyLineIdx = lines.findIndex(line => /^minimumReleaseAgeExclude\s*:/.test(line));
  if (keyLineIdx === -1) {
    while (lines.length > 0 && lines[lines.length - 1].trim() === '') {
      lines.pop();
    }
    lines.push('minimumReleaseAgeExclude:', `  - ${newScalar}`, '');
    return lines.join(eol);
  }

  const keyMatch = lines[keyLineIdx].match(/^minimumReleaseAgeExclude\s*:(.*)$/);
  const inlineRaw = (keyMatch?.[1] || '').replace(/\s+#.*$/, '').trim();
  if (inlineRaw.startsWith('[') && inlineRaw.endsWith(']')) {
    const inner = inlineRaw.slice(1, -1).trim();
    const existingItems = inner
      ? inner
          .split(',')
          .map(s => unquoteWorkspaceExcludeScalar(s))
          .filter(Boolean)
      : [];
    let matched = false;
    const nextItems: string[] = [];
    for (const item of existingItems) {
      const m = matchWorkspaceExcludeEntry(item, packageName);
      if (!m) {
        nextItems.push(item);
        continue;
      }
      matched = true;
      if (m.exactAll || (m.versions && m.versions.includes(targetVersion))) {
        return existingContent;
      }
      nextItems.push(`${packageName}@${[...(m.versions || []), targetVersion].join(' || ')}`);
    }
    if (!matched) nextItems.push(`${packageName}@${targetVersion}`);
    lines.splice(keyLineIdx, 1, 'minimumReleaseAgeExclude:', ...nextItems.map(it => `  - ${formatWorkspaceExcludeScalar(it)}`));
    return lines.join(eol);
  }

  const listItems: Array<{ index: number; indent: string; entry: string }> = [];
  let blockEndIdx = keyLineIdx;
  for (let i = keyLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[^\s#-]/.test(line)) break;
    const itemMatch = line.match(/^(\s*)-\s+(.*)$/);
    if (itemMatch) {
      listItems.push({
        index: i,
        indent: itemMatch[1] || '  ',
        entry: unquoteWorkspaceExcludeScalar(itemMatch[2])
      });
      blockEndIdx = i;
    }
  }

  for (const item of listItems) {
    const m = matchWorkspaceExcludeEntry(item.entry, packageName);
    if (!m) continue;
    if (m.exactAll || (m.versions && m.versions.includes(targetVersion))) {
      return existingContent;
    }
    const merged = formatWorkspaceExcludeScalar(`${packageName}@${[...(m.versions || []), targetVersion].join(' || ')}`);
    lines[item.index] = `${item.indent}- ${merged}`;
    return lines.join(eol);
  }

  const indent = listItems[0]?.indent || '  ';
  lines.splice(blockEndIdx + 1, 0, `${indent}- ${newScalar}`);
  return lines.join(eol);
}

function writeTargetedReleaseAgeExemption(profileDir: string, packageName: string, targetVersion: string): void {
  const workspacePath = join(profileDir, 'pnpm-workspace.yaml');
  const existing = existsSync(workspacePath) ? readFileSync(workspacePath, 'utf8') : null;
  const next = applyMinimumReleaseAgeExemptionYaml(existing, packageName, targetVersion);
  if (next !== existing) {
    writeFileAtomicSync(workspacePath, next);
  }
}

function buildInstallCommand(
  profileName: string,
  spec: string,
  registry: string
): { command: string; args: string[]; env: NodeJS.ProcessEnv } | { error: string } {
  if (!PROFILE_NAME_PATTERN.test(profileName)) {
    return { error: 'profile 名称不合法' };
  }
  if (!spec || spec.startsWith('-')) {
    return { error: '安装规格不合法' };
  }
  const env = createChildEnv(registry);
  const extraArgs = ['--config.update-notifier=false'];
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
      args: ['--expose-internals', pnpmJs, 'add', spec, '--ignore-scripts', `--registry=${registry}`, ...extraArgs],
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

function spawnCommand(
  command: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutMs: number
): Promise<InstallAttempt> {
  return new Promise(resolvePromise => {
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
      resolvePromise({ ok, output, error, timedOut });
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

function spawnInstall(
  profileDir: string,
  profileName: string,
  spec: string,
  registry: string
): Promise<InstallAttempt> {
  const plan = buildInstallCommand(profileName, spec, registry);
  if ('error' in plan) return Promise.resolve({ ok: false, output: '', error: plan.error, timedOut: false });
  return spawnCommand(plan.command, plan.args, profileDir, plan.env, INSTALL_TIMEOUT_MS);
}

function isSupplyChainPolicyFailure(output: string): boolean {
  return /ERR_PNPM_NO_MATURE_MATCHING_VERSION|ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION|minimumReleaseAge/i.test(
    output || ''
  );
}

async function installWithPolicyFallback(
  profileDir: string,
  profileName: string,
  packageName: string,
  targetVersion: string,
  isGithub: boolean,
  spec: string,
  registry: string,
  allowFreshRelease: boolean,
  preExempt: boolean
): Promise<InstallAttempt> {
  if (!isGithub && allowFreshRelease && preExempt) {
    writeTargetedReleaseAgeExemption(profileDir, packageName, targetVersion);
  }
  const attempt = await spawnInstall(profileDir, profileName, spec, registry);
  if (!attempt.ok && !attempt.timedOut && isSupplyChainPolicyFailure(attempt.output) && !isGithub && allowFreshRelease && !preExempt) {
    writeTargetedReleaseAgeExemption(profileDir, packageName, targetVersion);
    return spawnInstall(profileDir, profileName, spec, registry);
  }
  return attempt;
}

interface Snapshot {
  manifest: string | null;
  lockfile: string | null;
  workspace: string | null;
}

function captureSnapshot(profileDir: string): Snapshot {
  const manifestPath = join(profileDir, 'package.json');
  const lockfilePath = join(profileDir, 'pnpm-lock.yaml');
  const workspacePath = join(profileDir, 'pnpm-workspace.yaml');
  return {
    manifest: existsSync(manifestPath) ? readFileSync(manifestPath, 'utf8') : null,
    lockfile: existsSync(lockfilePath) ? readFileSync(lockfilePath, 'utf8') : null,
    workspace: existsSync(workspacePath) ? readFileSync(workspacePath, 'utf8') : null
  };
}

function restoreSnapshot(profileDir: string, snapshot: Snapshot): boolean {
  try {
    if (snapshot.manifest !== null) writeFileAtomicSync(join(profileDir, 'package.json'), snapshot.manifest);
    if (snapshot.lockfile !== null) writeFileAtomicSync(join(profileDir, 'pnpm-lock.yaml'), snapshot.lockfile);
    const workspacePath = join(profileDir, 'pnpm-workspace.yaml');
    if (snapshot.workspace !== null) {
      writeFileAtomicSync(workspacePath, snapshot.workspace);
    } else if (existsSync(workspacePath)) {
      rmSync(workspacePath, { force: true });
    }
    return true;
  } catch {
    return false;
  }
}

async function alignNodeModulesAfterRollback(profileDir: string): Promise<'aligned' | 'skipped' | 'failed'> {
  const pnpmJs = pnpmCandidates().find(candidate => existsSync(candidate));
  if (!pnpmJs) return 'skipped';
  const result = await spawnCommand(
    process.execPath,
    [
      '--expose-internals',
      pnpmJs,
      'install',
      '--frozen-lockfile',
      '--prefer-offline',
      '--ignore-scripts',
      '--config.update-notifier=false'
    ],
    profileDir,
    createChildEnv(),
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
  if (snapshot.lockfile === null) return 'restored';
  const versionAfterRestore = readInstalledVersion(profileDir, packageName);
  const drifted = forceAlign || (Boolean(previousVersion) && versionAfterRestore !== previousVersion);
  if (!drifted) return 'restored';
  const alignment = await alignNodeModulesAfterRollback(profileDir);
  return alignment === 'failed' ? 'failed' : 'restored';
}

function buildGithubInstallSpec(github: GithubOrigin, commitOverride?: string): string {
  if (commitOverride) {
    const fragmentParts = [commitOverride.toLowerCase()];
    if (github.subpath) fragmentParts.push(`path:${github.subpath}`);
    return `git+https://github.com/${github.owner}/${github.repo}.git#${fragmentParts.join('&')}`;
  }
  const fragmentParts: string[] = [];
  if (github.ref) fragmentParts.push(github.ref);
  if (github.subpath) fragmentParts.push(`path:${github.subpath}`);
  const fragment = fragmentParts.length > 0 ? `#${fragmentParts.join('&')}` : '';
  return `github:${github.owner}/${github.repo}${fragment}`;
}

async function runInstallWithFallback(
  profileDir: string,
  profileName: string,
  packageName: string,
  targetVersion: string,
  isGithub: boolean,
  spec: string,
  settings: PluginSettings,
  preExempt: boolean
): Promise<{ attempt: InstallAttempt; registryUsed: string; fellBack: boolean }> {
  let registryUsed = resolveRegistryUrl(settings.registry);
  let fellBack = false;
  let attempt = await installWithPolicyFallback(
    profileDir,
    profileName,
    packageName,
    targetVersion,
    isGithub,
    spec,
    registryUsed,
    settings.allowFreshRelease,
    preExempt
  );

  if (
    !attempt.ok &&
    !attempt.timedOut &&
    !isSupplyChainPolicyFailure(attempt.output) &&
    settings.fallbackToOfficial &&
    normalizeRegistryUrl(registryUsed) !== OFFICIAL_REGISTRY
  ) {
    fellBack = true;
    registryUsed = OFFICIAL_REGISTRY;
    attempt = await installWithPolicyFallback(
      profileDir,
      profileName,
      packageName,
      targetVersion,
      isGithub,
      spec,
      registryUsed,
      settings.allowFreshRelease,
      preExempt
    );
  }
  return { attempt, registryUsed, fellBack };
}

function triggerPackageRefresh(packageName: string, refresh: () => Promise<void>): Promise<void> {
  if (packageName === PLUGIN_NAME) {
    const timer = setTimeout(() => void refresh(), 1500);
    timer.unref?.();
    return Promise.resolve();
  }
  return refresh().catch(() => {});
}

async function performUpdate(
  ctx: any,
  config: any,
  profile: { dir: string; profileName: string },
  params: DoUpdateParams & { hostBundleSource?: string },
  refresh: () => Promise<void>
): Promise<DoUpdateResult> {
  const { packageName } = params;
  const { dir: profileDir, profileName } = profile;
  const settings = readSettings(config);

  const origin = resolvePackageOrigin(profileDir, packageName, params.hostBundleSource);
  const currentVersion = readInstalledVersion(profileDir, packageName) || '0.0.0';
  const registryUsed = resolveRegistryUrl(settings.registry);
  let targetVersion = params.targetVersion;
  let spec = '';
  let preExempt = false;

  if (origin.isGithub && origin.github) {
    const github = origin.github;
    const review = await getReviewedVersionsForPackage(ctx, packageName);
    let matchedCommit: string | undefined;

    if (!github.ref) {
      const reviewedGit = findMatchingReviewedGitVersions(review, github);
      const chosen = targetVersion
        ? reviewedGit.find(rv => rv.version === targetVersion)
        : reviewedGit.find(rv => compareSemver(rv.version, currentVersion) > 0);
      if (chosen) {
        const isFreshRelease =
          typeof chosen.publishTimestampMs === 'number' && Number.isFinite(chosen.publishTimestampMs)
            ? Date.now() - chosen.publishTimestampMs < RELEASE_COOLING_WINDOW_MS
            : false;
        if (isFreshRelease && !settings.allowFreshRelease) {
          return {
            ok: false,
            packageName,
            targetVersion: chosen.version,
            source: origin.declaredSpec,
            error: '该版本未满 24 小时安全观察期，请先在插件设置中开启对应权限',
            errorCode: ERROR_CODES.freshReleaseBlocked
          };
        }
        targetVersion = chosen.version;
        matchedCommit = chosen.gitCommit;
      }
    }

    if (matchedCommit) {
      spec = buildGithubInstallSpec(github, matchedCommit);
    } else {
      if (!settings.allowUnreviewed) {
        if (!review.available) {
          throw new RemoteError(ERROR_CODES.offline, '无法获取插件安全审核索引');
        }
        return {
          ok: false,
          packageName,
          targetVersion,
          source: origin.declaredSpec,
          error: '该版本或来源未经市场安全审核，请先在插件设置中开启对应权限',
          errorCode: ERROR_CODES.unreviewedBlocked
        };
      }
      if (!targetVersion) {
        const remote = await fetchGithubPackageJson(github);
        targetVersion = remote.version;
      }
      spec = buildGithubInstallSpec(github);
    }
  } else if (targetVersion) {
    let packument: NpmPackument;
    let review: MarketReviewLookup;
    try {
      [packument, review] = await Promise.all([
        fetchNpmPackument(packageName, registryUsed),
        getReviewedVersionsForPackage(ctx, packageName)
      ]);
    } catch (error) {
      if (settings.fallbackToOfficial && normalizeRegistryUrl(registryUsed) !== OFFICIAL_REGISTRY) {
        [packument, review] = await Promise.all([
          fetchNpmPackument(packageName, OFFICIAL_REGISTRY),
          getReviewedVersionsForPackage(ctx, packageName)
        ]);
      } else {
        throw error;
      }
    }
    if (!packument.versions?.[targetVersion] && settings.fallbackToOfficial && normalizeRegistryUrl(registryUsed) !== OFFICIAL_REGISTRY) {
      try {
        const officialPack = await fetchNpmPackument(packageName, OFFICIAL_REGISTRY);
        if (officialPack.versions?.[targetVersion]) packument = officialPack;
      } catch {}
    }
    if (!settings.allowUnreviewed && !review.available) {
      throw new RemoteError(ERROR_CODES.offline, '无法获取插件安全审核索引');
    }
    const policy = inspectNpmVersionPolicy(packument, targetVersion, review.versions, review.available);
    if (!policy.exists) {
      return {
        ok: false,
        packageName,
        targetVersion,
        source: origin.declaredSpec,
        error: `更新源中不存在版本 v${targetVersion}`,
        errorCode: ERROR_CODES.invalidTargetVersion
      };
    }
    if (policy.isUnreviewed && !settings.allowUnreviewed) {
      return {
        ok: false,
        packageName,
        targetVersion,
        source: origin.declaredSpec,
        error: '该版本或来源未经市场安全审核，请先在插件设置中开启对应权限',
        errorCode: ERROR_CODES.unreviewedBlocked
      };
    }
    if (policy.isFreshRelease && !settings.allowFreshRelease) {
      return {
        ok: false,
        packageName,
        targetVersion,
        source: origin.declaredSpec,
        error: '该版本未满 24 小时安全观察期，请先在插件设置中开启对应权限',
        errorCode: ERROR_CODES.freshReleaseBlocked
      };
    }
    preExempt = policy.isFreshRelease;
    spec = `${packageName}@${targetVersion}`;
  } else {
    const evaluated = await evaluatePackageCandidate(
      ctx,
      packageName,
      currentVersion,
      profileDir,
      settings,
      params.hostBundleSource
    );
    if (!evaluated.info.hasUpdate) {
      if (evaluated.info.blockedReason === 'freshReleaseBlocked') {
        return {
          ok: false,
          packageName,
          source: origin.declaredSpec,
          error: '该版本未满 24 小时安全观察期，请先在插件设置中开启对应权限',
          errorCode: ERROR_CODES.freshReleaseBlocked
        };
      }
      if (evaluated.info.blockedReason === 'unreviewedBlocked') {
        return {
          ok: false,
          packageName,
          source: origin.declaredSpec,
          error: '该版本或来源未经市场安全审核，请先在插件设置中开启对应权限',
          errorCode: ERROR_CODES.unreviewedBlocked
        };
      }
      return {
        ok: false,
        packageName,
        source: origin.declaredSpec,
        error: '无法确定符合安全策略的新版本',
        errorCode: ERROR_CODES.invalidTargetVersion
      };
    }
    targetVersion = evaluated.info.version;
    preExempt = evaluated.info.isFreshRelease;
    spec = `${packageName}@${targetVersion}`;
  }

  if (!targetVersion) {
    return { ok: false, packageName, error: '无法确定目标版本', errorCode: ERROR_CODES.invalidTargetVersion };
  }

  const snapshot = captureSnapshot(profileDir);
  const { attempt } = await runInstallWithFallback(
    profileDir,
    profileName,
    packageName,
    targetVersion,
    origin.isGithub,
    spec,
    settings,
    preExempt
  );

  if (!attempt.ok) {
    const policyBlocked = isSupplyChainPolicyFailure(attempt.output);
    const rollback = await rollbackAfterFailure(profileDir, packageName, currentVersion, snapshot, false);
    if (policyBlocked && !settings.allowFreshRelease) {
      return {
        ok: false,
        packageName,
        targetVersion,
        source: origin.declaredSpec,
        rollback,
        error: '该版本未满 24 小时安全观察期，请先在插件设置中开启对应权限',
        errorCode: ERROR_CODES.freshReleaseBlocked
      };
    }
    return {
      ok: false,
      packageName,
      targetVersion,
      source: origin.declaredSpec,
      rollback,
      error: attempt.timedOut ? '更新超时，已中止安装' : attempt.error || '安装失败',
      errorCode: attempt.timedOut ? ERROR_CODES.timeout : ERROR_CODES.installFailed
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
      rollback,
      error: `安装后校验未通过：期望 ${targetVersion}，实际 ${installedVersion || '未知'}`,
      errorCode: ERROR_CODES.verificationFailed
    };
  }

  clearConflictInState(profileDir, packageName);
  await triggerPackageRefresh(packageName, refresh);

  return {
    ok: true,
    packageName,
    targetVersion: installedVersion,
    source: origin.declaredSpec,
    rollback: 'not-needed'
  };
}

// --- HTTP helpers ---------------------------------------------------------------------

function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

function errorResponse(payload: Record<string, any>, errorCode: ErrorCode, error: string, status = 200): Response {
  return jsonResponse({ ...payload, ok: false, error, errorCode }, status);
}

function verifyUpdaterRequest(req: Request): Response | null {
  const headerVal = req.headers.get(UPDATER_REQUEST_HEADER);
  const contentType = (req.headers.get('content-type') || '').toLowerCase();
  if (headerVal !== '1' || !contentType.includes('application/json')) {
    return errorResponse({}, ERROR_CODES.forbidden, '请求安全校验未通过', 403);
  }
  return null;
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
  conflicts: Record<string, PluginConflictInfo>;
}

export function apply(ctx: any, config?: any) {
  let disposed = false;
  const cleanupTimers: NodeJS.Timeout[] = [];
  ctx.effect?.(() => () => {
    disposed = true;
    for (const t of cleanupTimers) clearTimeout(t);
    cleanupTimers.length = 0;
  }, 'dsh-plugins-update: lifecycle cleanup');

  const refreshAfterInstall = async () => {
    let reconciled = false;
    try {
      const hmr = getService(ctx, ['hmr']);
      if (hmr?.runExclusive && typeof hmr.reconcileProfile === 'function') {
        await hmr.runExclusive(() => hmr.reconcileProfile([]));
        reconciled = true;
      }
    } catch {}
    if (!reconciled) {
      try {
        const packages = getService(ctx, ['pluginPackages']);
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
  const selfDisablingPackages = new Set<string>();
  let inFlightCheckAll: Promise<BatchCheckState> | null = null;
  let scanRunning = false;
  let rescanDebounceTimer: NodeJS.Timeout | undefined;

  const disableConflictingPlugin = async (
    profileDir: string,
    packageName: string,
    pluginVersion: string,
    hostVersion: string | undefined,
    reason: string
  ): Promise<{ disabled: boolean; conflict: PluginConflictInfo }> => {
    const conflict: PluginConflictInfo = {
      pluginVersion: pluginVersion || '0.0.0',
      ...(hostVersion ? { hostVersion } : {}),
      ...(reason ? { reason } : {})
    };
    if (isOfficialPackageName(packageName) || packageName === PLUGIN_NAME) {
      return { disabled: false, conflict };
    }

    const state = loadGuardState(profileDir);
    state.conflicts[packageName] = conflict;
    saveGuardState(profileDir, state);
    inFlightCheckAll = null;

    let disabledViaManager = false;
    selfDisablingPackages.add(packageName);
    try {
      const manager = getService(ctx, ['pluginManager', 'plugin-manager']);
      if (typeof manager?.setBundleEnabled === 'function') {
        await Promise.race([
          manager.setBundleEnabled(packageName, false),
          new Promise((_, reject) => setTimeout(() => reject(new Error('setBundleEnabled timeout')), 15_000))
        ]);
        disabledViaManager = true;
      }
    } catch {
      disabledViaManager = false;
    } finally {
      selfDisablingPackages.delete(packageName);
    }

    const stillActiveInManifest = readActiveBundlesFromManifest(profileDir).includes(packageName);
    let disabledOnDisk = false;
    if (stillActiveInManifest) {
      disabledOnDisk = disableBundleOnDisk(profileDir, packageName);
      if (disabledOnDisk) {
        await refreshAfterInstall();
      }
    }

    return { disabled: disabledViaManager || disabledOnDisk || !stillActiveInManifest, conflict };
  };

  const getLoaderEntries = (): any[] => {
    const loader = getService(ctx, ['loader']);
    if (typeof loader?.entries !== 'function') return [];
    try {
      return [...loader.entries()];
    } catch {
      return [];
    }
  };

  const reconcileAllConflicts = async (checkEnabledConflicts: boolean): Promise<Record<string, PluginConflictInfo>> => {
    const installed = await listInstalledThirdPartyPackages(ctx);
    const loaderEntries = checkEnabledConflicts ? getLoaderEntries() : [];
    const currentHostVersion = detectHostVersion(ctx);
    const byProfile = new Map<string, InstalledThirdPartyPackage[]>();
    for (const item of installed) {
      const list = byProfile.get(item.dir) ?? [];
      list.push(item);
      byProfile.set(item.dir, list);
    }

    const activeConflicts: Record<string, PluginConflictInfo> = {};
    const primaryDir = resolveProfileDir().dir;
    if (!byProfile.has(primaryDir)) byProfile.set(primaryDir, []);

    for (const [profileDir, items] of byProfile.entries()) {
      const state = loadGuardState(profileDir);
      const itemMap = new Map(items.map(i => [i.packageName, i]));
      let dirty = false;

      if (currentHostVersion && state.lastHostVersion !== currentHostVersion && checkEnabledConflicts) {
        state.lastHostVersion = currentHostVersion;
        dirty = true;
      }

      // 1. Reconcile existing recorded conflicts and save removals before Step 2
      for (const [pkgName, info] of Object.entries(state.conflicts)) {
        const item = itemMap.get(pkgName);
        if (!item) {
          delete state.conflicts[pkgName];
          dirty = true;
          continue;
        }
        if (
          parseSemver(item.currentVersion) &&
          parseSemver(info.pluginVersion) &&
          compareSemver(item.currentVersion, info.pluginVersion) > 0
        ) {
          // Upgraded beyond conflicting version: clear red conflict tag while keeping switch off for user to enable.
          delete state.conflicts[pkgName];
          dirty = true;
          continue;
        }
        if (item.enabled && checkEnabledConflicts) {
          const reason = detectPluginConflict(profileDir, pkgName, item.bundle, loaderEntries);
          if (!reason) {
            delete state.conflicts[pkgName];
            dirty = true;
          }
        }
      }

      if (dirty) {
        saveGuardState(profileDir, state);
      }

      // 2. Scan currently enabled third-party plugins for incompatibilities/crashes and auto-disable
      if (checkEnabledConflicts) {
        for (const item of items) {
          if (item.packageName === PLUGIN_NAME || !item.enabled) continue;
          const reason = detectPluginConflict(profileDir, item.packageName, item.bundle, loaderEntries);
          if (!reason) continue;
          await disableConflictingPlugin(
            profileDir,
            item.packageName,
            item.currentVersion,
            currentHostVersion,
            reason
          );
        }
      }

      const finalState = loadGuardState(profileDir);
      for (const [pkgName, info] of Object.entries(finalState.conflicts)) {
        activeConflicts[pkgName] = info;
      }
    }

    return activeConflicts;
  };

  // --- Startup Crash-Loop Sentinel (runs immediately even if other services fail) -----
  let needCrashLoopRefresh = false;
  try {
    const primaryProfile = resolveProfileDir();
    const hostVersion = detectHostVersion(ctx);
    if (hostVersion && existsSync(join(primaryProfile.dir, 'package.json'))) {
      const state = loadGuardState(primaryProfile.dir);
      const now = Date.now();
      let nextCount = 0;
      if (state.bootStreak && state.bootStreak.hostVersion === hostVersion && now - state.bootStreak.timestamp < CRASH_LOOP_WINDOW_MS) {
        nextCount = state.bootStreak.count + 1;
      } else if (state.lastHostVersion !== hostVersion) {
        nextCount = 1;
      }

      if (nextCount >= CRASH_LOOP_THRESHOLD) {
        const active = readActiveBundlesFromManifest(primaryProfile.dir);
        for (const pkgName of active) {
          if (isOfficialPackageName(pkgName) || pkgName === PLUGIN_NAME) continue;
          if (disableBundleOnDisk(primaryProfile.dir, pkgName)) {
            needCrashLoopRefresh = true;
          }
          const ver = readInstalledVersion(primaryProfile.dir, pkgName) || '0.0.0';
          state.conflicts[pkgName] = {
            pluginVersion: ver,
            hostVersion,
            reason: 'DSH 升级后连续启动异常退出，已自动停用以恢复启动'
          };
        }
        state.bootStreak = undefined;
        state.lastHostVersion = hostVersion;
        saveGuardState(primaryProfile.dir, state);
      } else if (nextCount > 0) {
        state.bootStreak = { hostVersion, count: nextCount, timestamp: now };
        saveGuardState(primaryProfile.dir, state);
        const clearTimer = setTimeout(() => {
          if (disposed) return;
          const latest = loadGuardState(primaryProfile.dir);
          latest.bootStreak = undefined;
          latest.lastHostVersion = hostVersion;
          saveGuardState(primaryProfile.dir, latest);
        }, CRASH_LOOP_CLEAR_MS);
        clearTimer.unref?.();
        cleanupTimers.push(clearTimer);
      }
    }
  } catch {}

  const runStartupConflictScan = async () => {
    if (disposed || scanRunning) return;
    scanRunning = true;
    try {
      const loader = getService(ctx, ['loader']);
      if (typeof loader?.await === 'function') {
        await Promise.race([
          loader.await(),
          new Promise(resolvePromise => setTimeout(resolvePromise, 5_000))
        ]);
      }
      await new Promise(resolvePromise => {
        const settleTimer = setTimeout(resolvePromise, 250);
        settleTimer.unref?.();
        cleanupTimers.push(settleTimer);
      });
      if (disposed) return;
      if (needCrashLoopRefresh) {
        needCrashLoopRefresh = false;
        await refreshAfterInstall();
      }
      await reconcileAllConflicts(true);
    } catch {
    } finally {
      scanRunning = false;
    }
  };

  // Run initial startup scan immediately as soon as Cordis loader settles
  const startupScanPromise: Promise<void> = runStartupConflictScan();

  // Re-scan whenever plugin manager state changes (e.g. user re-enables a broken plugin manually)
  ctx.on?.('plugin-manager/changed', () => {
    inFlightCheckAll = null;
    if (disposed || selfDisablingPackages.size > 0) return;
    if (rescanDebounceTimer) clearTimeout(rescanDebounceTimer);
    rescanDebounceTimer = setTimeout(() => {
      rescanDebounceTimer = undefined;
      void runStartupConflictScan();
    }, 500);
    rescanDebounceTimer.unref?.();
    cleanupTimers.push(rescanDebounceTimer);
  });

  // --- Register HTTP routes (decoupled from top-level inject) -------------------------
  let routesRegistered = false;
  const registerRoutes = (conn: any, scopeCtx: any = ctx) => {
    if (routesRegistered || disposed) return;
    const registerFetch = conn?.fetch?.register?.bind(conn.fetch);
    if (typeof registerFetch !== 'function') return;
    routesRegistered = true;
    scopeCtx.effect?.(() => () => {
      routesRegistered = false;
    }, 'dsh-plugins-update: routes registration state');

    // 1. Check for a newer version of a single package.
    ctx.effect(
      () =>
        registerFetch({
          path: CHECK_PATH,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (req: Request) => {
            const rejected = verifyUpdaterRequest(req);
            if (rejected) return rejected;

            let packageName = '';
            try {
              const body = await parseJsonBody(req);
              packageName = readPackageName(body?.packageName) ?? '';
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
              const { info, origin, registry } = await evaluatePackageCandidate(
                ctx,
                packageName,
                currentVersion,
                dir,
                settings,
                bundle?.source
              );

              const state = loadGuardState(dir);
              let conflict: PluginConflictInfo | undefined = state.conflicts[packageName];
              if (
                conflict &&
                parseSemver(currentVersion) &&
                parseSemver(conflict.pluginVersion) &&
                compareSemver(currentVersion, conflict.pluginVersion) > 0
              ) {
                clearConflictInState(dir, packageName);
                conflict = undefined;
              }

              const result: CheckUpdateResult = {
                ok: true,
                packageName,
                currentVersion,
                latestVersion: info.version,
                hasUpdate: info.hasUpdate,
                source: origin.declaredSpec,
                isGithub: info.isGithub,
                isFreshRelease: info.isFreshRelease,
                isUnreviewed: info.isUnreviewed,
                registry: safeRegistryUrl(registry),
                alwaysShowDetailButton: settings.alwaysShowDetailButton,
                allowFreshRelease: settings.allowFreshRelease,
                allowUnreviewed: settings.allowUnreviewed,
                ...(conflict ? { conflict } : {})
              };
              return jsonResponse(result);
            } catch (error: any) {
              const errorCode = error instanceof RemoteError ? error.errorCode : ERROR_CODES.unknown;
              return errorResponse(
                { packageName, hasUpdate: false },
                errorCode,
                redactSecrets(error?.message || '检查更新失败')
              );
            }
          }
        }),
      'dsh-plugins-update: check route'
    );

    // 1b. Batch check all installed third-party packages on startup (plus conflict state).
    ctx.effect(
      () =>
        registerFetch({
          path: CHECK_ALL_PATH,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (req: Request) => {
            const rejected = verifyUpdaterRequest(req);
            if (rejected) return rejected;

            try {
              const body = await parseJsonBody(req);
              const force = body?.force === true;
              const reconcile = body?.reconcile === true;

              const runBatch = async (): Promise<BatchCheckState> => {
                await Promise.race([
                  startupScanPromise,
                  new Promise(resolvePromise => setTimeout(resolvePromise, 4_000))
                ]);
                const conflicts = await reconcileAllConflicts(reconcile);
                const installed = await listInstalledThirdPartyPackages(ctx);
                const settings = readSettings(config);
                const updatable: Record<string, string> = {};

                const concurrency = 4;
                let cursor = 0;
                const workers = Array.from({ length: Math.min(concurrency, installed.length) }, async () => {
                  while (cursor < installed.length) {
                    const current = installed[cursor++];
                    if (!current) break;
                    try {
                      const { info } = await evaluatePackageCandidate(
                        ctx,
                        current.packageName,
                        current.currentVersion,
                        current.dir,
                        settings,
                        current.bundle?.source
                      );
                      if (info.hasUpdate && compareSemver(info.version, current.currentVersion) > 0) {
                        updatable[current.packageName] = info.version;
                      }
                    } catch {
                      // Ignore single-package network or review errors during background startup probe.
                    }
                  }
                });

                await Promise.all(workers);
                return { updatable, conflicts };
              };

              let task: Promise<BatchCheckState>;
              if (!force && !reconcile && inFlightCheckAll) {
                task = inFlightCheckAll;
              } else {
                task = runBatch().finally(() => {
                  if (inFlightCheckAll === task) inFlightCheckAll = null;
                });
                inFlightCheckAll = task;
              }

              const { updatable, conflicts } = await task;
              const settings = readSettings(config);
              const result: CheckAllResult = {
                ok: true,
                updatable,
                conflicts,
                hostVersion: detectHostVersion(ctx),
                registry: safeRegistryUrl(resolveRegistryUrl(settings.registry)),
                alwaysShowDetailButton: settings.alwaysShowDetailButton,
                allowFreshRelease: settings.allowFreshRelease,
                allowUnreviewed: settings.allowUnreviewed
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

    // 2. Run one synchronous update.
    ctx.effect(
      () =>
        registerFetch({
          path: UPDATE_PATH,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (req: Request) => {
            const rejected = verifyUpdaterRequest(req);
            if (rejected) return rejected;

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

              const profile = resolveProfileDir(packageName);
              if (!existsSync(join(profile.dir, 'package.json'))) {
                return errorResponse({ packageName }, ERROR_CODES.profileNotFound, '找不到可用的 DSH profile 目录');
              }
              if (runningProfiles.has(profile.dir)) {
                return errorResponse({ packageName }, ERROR_CODES.installInProgress, '另一个插件正在更新，请稍后再试');
              }

              runningProfiles.add(profile.dir);
              try {
                const result = await performUpdate(
                  ctx,
                  config,
                  profile,
                  {
                    packageName,
                    targetVersion,
                    hostBundleSource: bundle?.source
                  },
                  refreshAfterInstall
                );
                return jsonResponse(result);
              } finally {
                runningProfiles.delete(profile.dir);
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

    // 3. Auto-disable a conflicting third-party plugin reported by frontend runtime sniffer.
    ctx.effect(
      () =>
        registerFetch({
          path: REPORT_CONFLICT_PATH,
          methods: ['POST'],
          requestBody: 'buffered',
          fetch: async (req: Request) => {
            const rejected = verifyUpdaterRequest(req);
            if (rejected) return rejected;

            let packageName = '';
            try {
              const body = await parseJsonBody(req);
              packageName = readPackageName(body?.packageName) ?? '';
              if (!packageName) {
                return errorResponse(
                  { packageName: '' },
                  ERROR_CODES.invalidPackageName,
                  'packageName 必须是合法的 npm 包名',
                  400
                );
              }
              if (isOfficialPackageName(packageName) || packageName === PLUGIN_NAME) {
                return errorResponse({ packageName }, ERROR_CODES.officialPlugin, '不允许自动停用官方插件或更新器自身');
              }
              const bundle = await readBundleInfo(ctx, packageName);
              const blocked = bundleGuardError(packageName, bundle);
              if (blocked) return errorResponse({ packageName }, blocked.errorCode, blocked.error);

              const profile = resolveProfileDir(packageName);
              if (!existsSync(join(profile.dir, 'package.json'))) {
                return errorResponse({ packageName }, ERROR_CODES.profileNotFound, '找不到可用的 DSH profile 目录');
              }

              const currentVersion = readInstalledVersion(profile.dir, packageName) || '0.0.0';
              const hostVersion = detectHostVersion(ctx);
              const rawReason = typeof body?.reason === 'string' && body.reason.trim() ? body.reason.trim() : '前端运行时触发异常';
              const reason = redactSecrets(rawReason).slice(0, 260);
              const { disabled, conflict } = await disableConflictingPlugin(
                profile.dir,
                packageName,
                currentVersion,
                hostVersion,
                reason
              );
              const result: ReportConflictResult = {
                ok: true,
                packageName,
                disabled,
                conflict
              };
              return jsonResponse(result);
            } catch (error: any) {
              return errorResponse(
                { packageName },
                error instanceof RemoteError ? error.errorCode : ERROR_CODES.unknown,
                redactSecrets(error?.message || '记录冲突失败')
              );
            }
          }
        }),
      'dsh-plugins-update: report-conflict route'
    );
  };

  const immediateConn = getService(ctx, ['connection']);
  if (immediateConn) {
    registerRoutes(immediateConn, ctx);
  } else if (typeof ctx.inject === 'function') {
    ctx.inject(['connection'], (connCtx: any) => {
      registerRoutes(connCtx?.get?.('connection') ?? connCtx?.connection, connCtx);
    });
  }
}
