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
  releaseDate?: string;
  description?: string;
  error?: string;
}

export interface DoUpdateParams {
  packageName: string;
  targetVersion?: string;
}

export interface DoUpdateResult {
  ok: boolean;
  packageName: string;
  targetVersion?: string;
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
