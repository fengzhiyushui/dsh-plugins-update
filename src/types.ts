/** Official npm registry. */
export const OFFICIAL_REGISTRY = 'https://registry.npmjs.org/';
/** Domestic mirror used by DSH itself (same as the DSH "Add plugin" dialog's China mainland source). */
export const DOMESTIC_REGISTRY = 'https://registry.npmmirror.com/';

/** Locale namespace owned by this plugin's client dictionaries (`ctx.locale.register`). */
export const LOCALE_NAMESPACE = 'dsh-plugins-update';

/** HTTP paths served by the backend half. */
export const CHECK_PATH = '/api/dsh-plugins-update/check';
export const UPDATE_PATH = '/api/dsh-plugins-update/update';
export const PROGRESS_PATH = '/api/dsh-plugins-update/progress';
export const CANCEL_PATH = '/api/dsh-plugins-update/cancel';

/**
 * Machine-readable error codes. The client localizes `errorCode`; `error` stays as a
 * Chinese fallback for older clients and for diagnostics.
 */
export const ERROR_CODES = {
  invalidPackageName: 'invalid-package-name',
  invalidTargetVersion: 'invalid-target-version',
  officialPlugin: 'official-plugin',
  notInstalled: 'not-installed',
  profileNotFound: 'profile-not-found',
  installInProgress: 'install-in-progress',
  jobNotFound: 'job-not-found',
  offline: 'offline',
  rateLimited: 'rate-limited',
  githubAuth: 'github-auth',
  installFailed: 'install-failed',
  timeout: 'timeout',
  cancelled: 'cancelled',
  verificationFailed: 'verification-failed',
  rollbackFailed: 'rollback-failed',
  unknown: 'unknown'
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

/** Phases reported by the progress endpoint while an install job runs. */
export type UpdatePhase =
  | 'queued'
  | 'resolving'
  | 'downloading'
  | 'installing'
  | 'verifying'
  | 'rolling-back'
  | 'done'
  | 'failed'
  | 'cancelled';

/**
 * Registry selection stored in the plugin config:
 * - `auto`: probe both built-in registries and pick a complete one, otherwise the official one
 * - `npmjs`: official npm registry
 * - `npmmirror`: DSH's domestic mirror
 * - any `http(s)://` URL: one of the user's custom registries
 */
export type RegistryChoice = 'auto' | 'npmjs' | 'npmmirror' | string;

export interface CustomRegistry {
  name: string;
  url: string;
}

export interface PluginSettings {
  registry: RegistryChoice;
  customRegistries: CustomRegistry[];
  fallbackToOfficial: boolean;
  /** Upper bound of one install command, in seconds (defaults to 120). */
  installTimeoutSeconds: number;
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
  releaseDate?: string;
  description?: string;
  source?: string;
  isGithub?: boolean;
  /** Registry that reported `latestVersion` (npm packages only). */
  registry?: string;
  error?: string;
  errorCode?: ErrorCode | string;
  /** GitHub: the branch whose `package.json` was read for the remote version. */
  branch?: string;
  /** GitHub: head commit SHA of the tracked branch. */
  latestCommit?: string;
  /** GitHub: commit pinned by the local pnpm lockfile, when known. */
  installedCommit?: string;
  /** GitHub: the tracked branch contains commits newer than the installed revision. */
  commitAhead?: boolean;
  /** GitHub: exact tag matching `latestVersion`, when one exists. */
  tag?: string;
  /** Whether the update can be pinned to a tag; `false` means the branch head will be installed. */
  pinAvailable?: boolean;
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
  /** Registry the successful (or last) install attempt used. */
  registryUsed?: string;
  /** Human-readable label of `registryUsed` (Chinese fallback; the client localizes from the URL). */
  registryLabel?: string;
  /** Whether the install was retried on the official registry after a failure. */
  fellBack?: boolean;
  /** The plugin updated itself; DSH must be restarted instead of just reloading the window. */
  selfUpdate?: boolean;
  /** Whether a failed install/verification restored the previous profile state. */
  rollback?: 'not-needed' | 'restored' | 'failed';
  /** GitHub: commit verified on disk after a successful install. */
  installedCommit?: string;
  error?: string;
  errorCode?: ErrorCode | string;
  output?: string;
}

/** State of one asynchronous install job, returned by the progress endpoint. */
export interface UpdateJobState {
  ok: boolean;
  jobId: string;
  packageName: string;
  phase: UpdatePhase;
  running: boolean;
  /** Rough completion percentage (0-100) when the installer reports enough detail. */
  percent?: number;
  /** Localization key describing the current phase. */
  messageKey?: string;
  /** Tail of the install log, for the expandable progress panel. */
  logTail?: string;
  startedAt: number;
  updatedAt: number;
  result?: DoUpdateResult;
  error?: string;
  errorCode?: ErrorCode | string;
}

export interface SlotActionSubject {
  kind: string;
  pkg?: {
    name: string;
    version?: string;
    installed?: boolean;
    /** `profile` | `installation` | `missing`, as reported by the Host plugin manager. */
    availability?: string;
    removable?: boolean;
    /** True for project-maintained optional/on-demand official bundles; DSH owns their update entry. */
    official?: boolean;
    enabled?: boolean;
    /** @deprecated The Host no longer passes the dependency spec to `plugins.detail.actions`; kept for older versions. */
    source?: string;
    [key: string]: any;
  };
}

export interface SlotActionProps {
  subject: SlotActionSubject;
}

/** Normalize a registry URL the way pnpm compares them: lower-case host, trailing slash. Returns null if invalid. */
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

/** Human-readable label for a registry URL (Chinese fallback; the client localizes this itself). */
export function registryLabel(url: string, customs: CustomRegistry[] = []): string {
  const normalized = normalizeRegistryUrl(url) ?? url;
  if (normalized === OFFICIAL_REGISTRY) return 'npm 官方源';
  if (normalized === DOMESTIC_REGISTRY) return '国内源 npmmirror（DSH 同款）';
  const custom = customs.find(c => normalizeRegistryUrl(c.url) === normalized);
  if (custom?.name) return `自定义源「${custom.name}」`;
  try {
    return `自定义源 ${new URL(normalized).host}`;
  } catch {
    return normalized;
  }
}
