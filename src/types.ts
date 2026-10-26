/** Official npm registry. */
export const OFFICIAL_REGISTRY = 'https://registry.npmjs.org/';
/** Domestic mirror used by DSH itself (same as the DSH "Add plugin" dialog's China mainland source). */
export const DOMESTIC_REGISTRY = 'https://registry.npmmirror.com/';

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
  unreleased?: boolean;
  /** Registry that reported `latestVersion` (npm packages only). */
  registry?: string;
  error?: string;
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
  /** Human-readable label of `registryUsed`. */
  registryLabel?: string;
  /** Whether the install was retried on the official registry after a failure. */
  fellBack?: boolean;
  output?: string;
  error?: string;
}

export interface SlotActionSubject {
  kind: string;
  pkg?: {
    name: string;
    version?: string;
    installed?: boolean;
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

/** Human-readable label for a registry URL. */
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
