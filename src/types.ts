/** Official npm registry. */
export const OFFICIAL_REGISTRY = 'https://registry.npmjs.org/';
/** Domestic mirror used by DSH itself. */
export const DOMESTIC_REGISTRY = 'https://registry.npmmirror.com/';

/** Plugin package and Cordis service identifier. */
export const PLUGIN_NAME = 'dsh-plugins-update';
/** Package scope prefix reserved for official DSH plugins. */
export const OFFICIAL_PACKAGE_PREFIX = '@deepseek-ai/';

/** Locale namespace owned by this plugin's client dictionaries. */
export const LOCALE_NAMESPACE = PLUGIN_NAME;

/** Custom anti-CSRF header required on all updater HTTP API calls. */
export const UPDATER_REQUEST_HEADER = 'x-dsh-updater';

/** HTTP paths served by the backend half. */
export const CHECK_PATH = '/api/dsh-plugins-update/check';
export const CHECK_ALL_PATH = '/api/dsh-plugins-update/check-all';
export const UPDATE_PATH = '/api/dsh-plugins-update/update';
export const REPORT_CONFLICT_PATH = '/api/dsh-plugins-update/report-conflict';

/** Machine-readable error codes. */
export const ERROR_CODES = {
  invalidPackageName: 'invalid-package-name',
  invalidTargetVersion: 'invalid-target-version',
  officialPlugin: 'official-plugin',
  notInstalled: 'not-installed',
  profileNotFound: 'profile-not-found',
  installInProgress: 'install-in-progress',
  offline: 'offline',
  installFailed: 'install-failed',
  timeout: 'timeout',
  verificationFailed: 'verification-failed',
  rollbackFailed: 'rollback-failed',
  freshReleaseBlocked: 'fresh-release-blocked',
  unreviewedBlocked: 'unreviewed-blocked',
  forbidden: 'forbidden',
  unknown: 'unknown'
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Registry selection stored in the plugin config. No automatic mode. */
export type RegistryChoice = 'npmjs' | 'npmmirror' | string;

export interface CustomRegistry {
  name: string;
  url: string;
}

export interface PluginSettings {
  registry: RegistryChoice;
  customRegistries: CustomRegistry[];
  fallbackToOfficial: boolean;
  alwaysShowDetailButton: boolean;
  allowFreshRelease: boolean;
  allowUnreviewed: boolean;
}

export interface PluginConflictInfo {
  pluginVersion: string;
  hostVersion?: string;
  reason?: string;
}

export interface CheckUpdateParams {
  packageName: string;
  currentVersion?: string;
}

export interface CheckUpdateResult {
  ok: boolean;
  packageName: string;
  currentVersion?: string;
  latestVersion?: string;
  hasUpdate: boolean;
  source?: string;
  isGithub?: boolean;
  isFreshRelease?: boolean;
  isUnreviewed?: boolean;
  registry?: string;
  alwaysShowDetailButton?: boolean;
  allowFreshRelease?: boolean;
  allowUnreviewed?: boolean;
  conflict?: PluginConflictInfo;
  error?: string;
  errorCode?: ErrorCode | string;
}

export interface ReportConflictParams {
  packageName: string;
  reason?: string;
}

export interface ReportConflictResult {
  ok: boolean;
  packageName: string;
  disabled?: boolean;
  conflict?: PluginConflictInfo;
  error?: string;
  errorCode?: ErrorCode | string;
}

export interface CheckAllParams {
  knownUpdates?: Record<string, string>;
  force?: boolean;
  reconcile?: boolean;
}

export interface CheckAllResult {
  ok: boolean;
  updatable: Record<string, string>;
  conflicts?: Record<string, PluginConflictInfo>;
  hostVersion?: string;
  registry?: string;
  alwaysShowDetailButton?: boolean;
  allowFreshRelease?: boolean;
  allowUnreviewed?: boolean;
  error?: string;
  errorCode?: ErrorCode | string;
}

export interface DoUpdateParams {
  packageName: string;
  targetVersion?: string;
}

export interface DoUpdateResult {
  ok: boolean;
  packageName: string;
  targetVersion?: string;
  source?: string;
  rollback?: 'not-needed' | 'restored' | 'failed';
  error?: string;
  errorCode?: ErrorCode | string;
}

export interface SlotActionSubject {
  kind: string;
  pkg?: {
    name: string;
    version?: string;
    installed?: boolean;
    availability?: string;
    removable?: boolean;
    official?: boolean;
    enabled?: boolean;
    source?: string;
    update?: 'registry' | 'git' | string;
    [key: string]: any;
  };
}

export interface SlotActionProps {
  subject: SlotActionSubject;
}

/** Check whether a package name belongs to the official DSH scope. */
export function isOfficialPackageName(packageName: string | undefined | null): boolean {
  return typeof packageName === 'string' && packageName.startsWith(OFFICIAL_PACKAGE_PREFIX);
}

/** Reject loopback, link-local, unique-local, and cloud metadata hostnames to mitigate SSRF. */
export function isDisallowedHost(hostname: string): boolean {
  const host = String(hostname || '')
    .trim()
    .replace(/^\[|\]$/g, '')
    .replace(/\.+$/, '')
    .toLowerCase();
  if (!host) return true;
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === '0.0.0.0' ||
    host === '::' ||
    host === '::1' ||
    host === '::ffff:0:0' ||
    host === 'metadata.google.internal' ||
    host === '100.100.100.200'
  ) {
    return true;
  }
  if (/^(?:::ffff:)?127\./i.test(host)) return true;
  if (/^(?:::ffff:)?169\.254\./i.test(host)) return true;
  if (/^::ffff:(?:7f[0-9a-f]{2}|a9fe):[0-9a-f]{1,4}$/i.test(host)) return true;
  if (/^fe[89ab][0-9a-f]:/i.test(host)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(host)) return true;
  return false;
}

/** Normalize an HTTPS registry URL without embedded credentials or loopback/metadata hosts. */
export function normalizeRegistryUrl(url: string | undefined | null): string | null {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  if (isDisallowedHost(parsed.hostname)) return null;
  if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
  parsed.hash = '';
  parsed.search = '';
  return parsed.href;
}

/** Resolve a stored registry choice ('npmjs' | 'npmmirror' | custom URL) to a normalized URL. */
export function resolveRegistryUrl(registry: string | undefined | null): string {
  if (!registry || registry === 'npmjs') return OFFICIAL_REGISTRY;
  if (registry === 'npmmirror') return DOMESTIC_REGISTRY;
  return normalizeRegistryUrl(registry) ?? OFFICIAL_REGISTRY;
}

export interface ParsedSemver {
  core: number[];
  prerelease: string[];
}

export function parseSemver(input: string): ParsedSemver | null {
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

export function compareSemver(left: string, right: string): number {
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

export function versionGte(installed: string | undefined, target: string | undefined): boolean {
  if (!installed || !target) return false;
  return compareSemver(installed, target) >= 0;
}
