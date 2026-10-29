/** Official npm registry. */
export const OFFICIAL_REGISTRY = 'https://registry.npmjs.org/';
/** Domestic mirror used by DSH itself. */
export const DOMESTIC_REGISTRY = 'https://registry.npmmirror.com/';

/** Locale namespace owned by this plugin's client dictionaries. */
export const LOCALE_NAMESPACE = 'dsh-plugins-update';

/** HTTP paths served by the backend half. */
export const CHECK_PATH = '/api/dsh-plugins-update/check';
export const UPDATE_PATH = '/api/dsh-plugins-update/update';

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
}

export interface CheckUpdateParams {
  packageName: string;
  currentVersion?: string;
  source?: string;
}

export interface CheckUpdateResult {
  ok: boolean;
  packageName: string;
  currentVersion?: string;
  latestVersion?: string;
  hasUpdate: boolean;
  description?: string;
  source?: string;
  isGithub?: boolean;
  registry?: string;
  error?: string;
  errorCode?: ErrorCode | string;
}

export interface DoUpdateParams {
  packageName: string;
  targetVersion?: string;
  source?: string;
}

export interface DoUpdateResult {
  ok: boolean;
  packageName: string;
  targetVersion?: string;
  source?: string;
  registryUsed?: string;
  registryLabel?: string;
  fellBack?: boolean;
  selfUpdate?: boolean;
  rollback?: 'not-needed' | 'restored' | 'failed';
  error?: string;
  errorCode?: ErrorCode | string;
  output?: string;
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
    [key: string]: any;
  };
}

export interface SlotActionProps {
  subject: SlotActionSubject;
}

/** Normalize a registry URL the way pnpm compares them. */
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
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (!parsed.pathname.endsWith('/')) parsed.pathname += '/';
  parsed.hash = '';
  parsed.search = '';
  return parsed.href;
}

/** Human-readable label for a registry URL. */
export function registryLabel(url: string, customs: CustomRegistry[] = []): string {
  const normalized = normalizeRegistryUrl(url) ?? url;
  if (normalized === OFFICIAL_REGISTRY) return 'npm 官方源';
  if (normalized === DOMESTIC_REGISTRY) return '国内源 npmmirror';
  const custom = customs.find(c => normalizeRegistryUrl(c.url) === normalized);
  if (custom?.name) return `自定义源「${custom.name}」`;
  try {
    return `自定义源 ${new URL(normalized).host}`;
  } catch {
    return normalized;
  }
}
