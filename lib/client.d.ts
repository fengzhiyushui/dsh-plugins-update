import React from 'react';
import { type SlotActionProps } from './types.js';
/** Copy of a user-facing sentence, resolved at render time so it follows locale switches. */
type TranslateParams = Record<string, string | number>;
type Translator = (key: string, params?: TranslateParams) => string;
/** The subset of the DSH client `locale` service this plugin relies on (all optional). */
interface LocaleSnapshotLike {
    active?: string;
    revision?: number;
    [key: string]: unknown;
}
interface LocaleServiceLike {
    register?: (namespace: string, dictionaries: Record<string, Record<string, string>>) => (() => void) | void;
    bind?: (namespace: string) => Translator;
    getSnapshot?: () => LocaleSnapshotLike;
    subscribe?: (listener: () => void) => (() => void) | void;
    resolveText?: (text: unknown) => string;
}
interface RegistrySettingsCardProps {
    form?: any;
    onClose?: () => void;
    /** Translator injected by apply(); falls back to the bundled Chinese dictionary. */
    t?: Translator;
    /** DSH locale service, used only to re-render on language switches. */
    locale?: LocaleServiceLike;
}
export declare const RegistrySettingsCard: React.FC<RegistrySettingsCardProps>;
interface UpdaterActionButtonProps extends SlotActionProps {
    form?: any;
    /** Translator injected by apply(); falls back to the bundled Chinese dictionary. */
    t?: Translator;
    /** DSH locale service, used only to re-render on language switches. */
    locale?: LocaleServiceLike;
}
export declare const UpdaterActionButton: React.FC<UpdaterActionButtonProps>;
export declare function apply(ctx: any): void;
export declare const name = "dsh-plugins-update";
export declare const inject: string[];
export {};
