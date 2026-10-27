/** Official npm registry. */
export declare const OFFICIAL_REGISTRY = "https://registry.npmjs.org/";
/** Domestic mirror used by DSH itself (same as the DSH "Add plugin" dialog's China mainland source). */
export declare const DOMESTIC_REGISTRY = "https://registry.npmmirror.com/";
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
    /** The plugin updated itself; DSH must be restarted instead of just reloading the window. */
    selfUpdate?: boolean;
    output?: string;
    error?: string;
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
export declare function normalizeRegistryUrl(url: string | undefined | null): string | null;
/** Human-readable label for a registry URL. */
export declare function registryLabel(url: string, customs?: CustomRegistry[]): string;
