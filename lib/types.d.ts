/** Official npm registry. */
export declare const OFFICIAL_REGISTRY = "https://registry.npmjs.org/";
/** Domestic mirror used by DSH itself. */
export declare const DOMESTIC_REGISTRY = "https://registry.npmmirror.com/";
/** Plugin package and Cordis service identifier. */
export declare const PLUGIN_NAME = "dsh-plugins-update";
/** Package scope prefix reserved for official DSH plugins. */
export declare const OFFICIAL_PACKAGE_PREFIX = "@deepseek-ai/";
/** Locale namespace owned by this plugin's client dictionaries. */
export declare const LOCALE_NAMESPACE = "dsh-plugins-update";
/** HTTP paths served by the backend half. */
export declare const CHECK_PATH = "/api/dsh-plugins-update/check";
export declare const CHECK_ALL_PATH = "/api/dsh-plugins-update/check-all";
export declare const UPDATE_PATH = "/api/dsh-plugins-update/update";
export declare const DIAGNOSE_PATH = "/api/dsh-plugins-update/diagnose";
export declare const RESCUE_PATH = "/api/dsh-plugins-update/rescue";
/** Machine-readable error codes. */
export declare const ERROR_CODES: {
    readonly invalidPackageName: "invalid-package-name";
    readonly invalidTargetVersion: "invalid-target-version";
    readonly officialPlugin: "official-plugin";
    readonly notInstalled: "not-installed";
    readonly profileNotFound: "profile-not-found";
    readonly installInProgress: "install-in-progress";
    readonly offline: "offline";
    readonly installFailed: "install-failed";
    readonly timeout: "timeout";
    readonly verificationFailed: "verification-failed";
    readonly rollbackFailed: "rollback-failed";
    readonly selfUninstallBlocked: "self-uninstall-blocked";
    readonly unknown: "unknown";
};
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
    source?: string;
    isGithub?: boolean;
    registry?: string;
    alwaysShowDetailButton?: boolean;
    error?: string;
    errorCode?: ErrorCode | string;
}
export type PluginHealthIssueKind = 'bundle-unavailable' | 'bundle-error' | 'entry-missing' | 'unregistered-bundle' | 'client-crash';
export interface PluginHealthSummary {
    issues: PluginHealthIssueKind[];
    errorDetail?: string;
    currentVersion: string;
}
export interface PluginHealthReport {
    packageName: string;
    currentVersion: string;
    latestVersion?: string;
    hasUpdate: boolean;
    source?: string;
    isGithub?: boolean;
    enabled?: boolean;
    availability?: string;
    healthy: boolean;
    issues: PluginHealthIssueKind[];
    errorDetail?: string;
}
export interface DiagnoseParams {
    forceCheckUpdates?: boolean;
    clientCrashes?: Record<string, string>;
}
export interface DiagnoseResult {
    ok: boolean;
    hostVersion?: string;
    profileName?: string;
    plugins: PluginHealthReport[];
    registry?: string;
    error?: string;
    errorCode?: ErrorCode | string;
}
export type RescueAction = 'update' | 'reinstall' | 'uninstall';
export interface RescueParams {
    packageName: string;
    action: RescueAction;
    targetVersion?: string;
    source?: string;
}
export interface RescueResult {
    ok: boolean;
    packageName: string;
    action: RescueAction;
    targetVersion?: string;
    selfUpdate?: boolean;
    rollback?: 'not-needed' | 'restored' | 'failed';
    error?: string;
    errorCode?: ErrorCode | string;
    output?: string;
}
export interface CheckAllParams {
    knownUpdates?: Record<string, string>;
    force?: boolean;
    reconcile?: boolean;
}
export interface CheckAllResult {
    ok: boolean;
    updatable: Record<string, string>;
    hostVersion?: string;
    unhealthy?: Record<string, PluginHealthSummary>;
    registry?: string;
    alwaysShowDetailButton?: boolean;
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
        [key: string]: any;
    };
}
export interface SlotActionProps {
    subject: SlotActionSubject;
}
/** Check whether a package name belongs to the official DSH scope. */
export declare function isOfficialPackageName(packageName: string | undefined | null): boolean;
/** Normalize a registry URL the way pnpm compares them. */
export declare function normalizeRegistryUrl(url: string | undefined | null): string | null;
/** Resolve a stored registry choice ('npmjs' | 'npmmirror' | custom URL) to a normalized URL. */
export declare function resolveRegistryUrl(registry: string | undefined | null): string;
export interface ParsedSemver {
    core: number[];
    prerelease: string[];
}
export declare function parseSemver(input: string): ParsedSemver | null;
export declare function compareSemver(left: string, right: string): number;
export declare function versionGte(installed: string | undefined, target: string | undefined): boolean;
