import React from 'react';
import { type SlotActionProps } from './types.js';
type TranslateParams = Record<string, string | number>;
type Translator = (key: string, params?: TranslateParams) => string;
interface LocaleServiceLike {
    register?: (namespace: string, dictionaries: Record<string, Record<string, string>>) => (() => void) | void;
    bind?: (namespace: string) => Translator;
    getSnapshot?: () => {
        revision?: number;
        [key: string]: unknown;
    };
    subscribe?: (listener: () => void) => (() => void) | void;
}
interface DynamicLocaleBridge {
    t: Translator;
    getRevision: () => number;
    subscribe: (listener: () => void) => () => void;
    attach: (ctx: any, locale: LocaleServiceLike | undefined) => void;
}
interface RegistrySettingsCardProps {
    form?: any;
    localeBridge: DynamicLocaleBridge;
}
export declare const RegistrySettingsCard: React.FC<RegistrySettingsCardProps>;
interface UpdaterActionButtonProps extends SlotActionProps {
    localeBridge: DynamicLocaleBridge;
}
export declare const UpdaterActionButton: React.FC<UpdaterActionButtonProps>;
export declare function apply(ctx: any, config?: any): void;
export declare const name = "dsh-plugins-update";
export declare const inject: string[];
export {};
