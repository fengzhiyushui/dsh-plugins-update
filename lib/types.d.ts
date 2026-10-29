/** Official npm registry. */
export declare const OFFICIAL_REGISTRY = "https://registry.npmjs.org/";
/** Domestic mirror used by DSH itself. */
export declare const DOMESTIC_REGISTRY = "https://registry.npmmirror.com/";
/** Locale namespace owned by this plugin's client dictionaries. */
export declare const LOCALE_NAMESPACE = "dsh-plugins-update";
/** HTTP paths served by the backend half. */
export declare const CHECK_PATH = "/api/dsh-plugins-update/check";
export declare const UPDATE_PATH = "/api/dsh-plugins-update/update";
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
export declare function normalizeRegistryUrl(url: string | undefined | null): string | null;
/** Human-readable label for a registry URL. */
export declare function registryLabel(url: string, customs?: CustomRegistry[]): string;
