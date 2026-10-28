/** Official npm registry. */
export declare const OFFICIAL_REGISTRY = "https://registry.npmjs.org/";
/** Domestic mirror used by DSH itself (same as the DSH "Add plugin" dialog's China mainland source). */
export declare const DOMESTIC_REGISTRY = "https://registry.npmmirror.com/";
/** Locale namespace owned by this plugin's client dictionaries (`ctx.locale.register`). */
export declare const LOCALE_NAMESPACE = "dsh-plugins-update";
/** HTTP paths served by the backend half. */
export declare const CHECK_PATH = "/api/dsh-plugins-update/check";
export declare const UPDATE_PATH = "/api/dsh-plugins-update/update";
export declare const PROGRESS_PATH = "/api/dsh-plugins-update/progress";
export declare const CANCEL_PATH = "/api/dsh-plugins-update/cancel";
/**
 * Machine-readable error codes. The client localizes `errorCode`; `error` stays as a
 * Chinese fallback for older clients and for diagnostics.
 */
export declare const ERROR_CODES: {
    readonly invalidPackageName: "invalid-package-name";
    readonly invalidTargetVersion: "invalid-target-version";
    readonly officialPlugin: "official-plugin";
    readonly notInstalled: "not-installed";
    readonly profileNotFound: "profile-not-found";
    readonly installInProgress: "install-in-progress";
    readonly jobNotFound: "job-not-found";
    readonly offline: "offline";
    readonly rateLimited: "rate-limited";
    readonly githubAuth: "github-auth";
    readonly installFailed: "install-failed";
    readonly timeout: "timeout";
    readonly cancelled: "cancelled";
    readonly verificationFailed: "verification-failed";
    readonly rollbackFailed: "rollback-failed";
    readonly unknown: "unknown";
};
export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
/** Phases reported by the progress endpoint while an install job runs. */
export type UpdatePhase = 'queued' | 'resolving' | 'downloading' | 'installing' | 'verifying' | 'rolling-back' | 'done' | 'failed' | 'cancelled';
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
export declare function normalizeRegistryUrl(url: string | undefined | null): string | null;
/** Human-readable label for a registry URL (Chinese fallback; the client localizes this itself). */
export declare function registryLabel(url: string, customs?: CustomRegistry[]): string;
