import React from 'react';
import { type SlotActionProps } from './types.js';
export declare const RegistrySettingsCard: React.FC<{
    form?: any;
    onClose?: () => void;
}>;
export declare const UpdaterActionButton: React.FC<SlotActionProps & {
    form?: any;
}>;
export declare function apply(ctx: any): void;
export declare const name = "dsh-plugins-update";
export declare const inject: string[];
