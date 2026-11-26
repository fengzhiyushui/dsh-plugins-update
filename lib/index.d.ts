import Schema from '@deepseek-ai/schemastery';
export declare const name = "dsh-plugins-update";
export declare const inject: string[];
export declare const Config: Schema<any>;
interface MarketReviewedVersion {
    version: string;
    publishTimestampMs?: number;
    sourceType: 'npm' | 'git' | 'other';
    gitUrl?: string;
    gitCommit?: string;
    gitPath?: string;
}
export declare function parseMarketIndexPayload(raw: any): Map<string, MarketReviewedVersion[]>;
/** Add a scoped single-package exemption (<packageName>@<targetVersion>) without disabling 24h protection for dependencies. */
export declare function applyMinimumReleaseAgeExemptionYaml(existingContent: string | null, packageName: string, targetVersion: string): string;
export declare function apply(ctx: any, config?: any): void;
export {};
