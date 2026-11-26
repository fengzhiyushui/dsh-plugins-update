import React, { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type * as DshPrimitives from '@deepseek-ai/dsh-client-ui-primitives';
import {
  CHECK_ALL_PATH,
  CHECK_PATH,
  DOMESTIC_REGISTRY,
  ERROR_CODES,
  LOCALE_NAMESPACE,
  OFFICIAL_REGISTRY,
  PLUGIN_NAME,
  REPORT_CONFLICT_PATH,
  UPDATE_PATH,
  UPDATER_REQUEST_HEADER,
  compareSemver,
  isOfficialPackageName,
  normalizeRegistryUrl,
  parseSemver,
  resolveRegistryUrl,
  versionGte,
  type CheckAllParams,
  type CheckAllResult,
  type CheckUpdateParams,
  type CheckUpdateResult,
  type CustomRegistry,
  type DoUpdateParams,
  type DoUpdateResult,
  type PluginConflictInfo,
  type PluginSettings,
  type ReportConflictParams,
  type ReportConflictResult,
  type SlotActionProps
} from './types.js';
import { en, zh } from './locales.js';

declare const require: ((id: string) => any) | undefined;

const CHECK_TIMEOUT_MS = 15_000;
const BATCH_CHECK_TIMEOUT_MS = 25_000;
const UPDATE_TIMEOUT_MS = 300_000;
const REPORT_TIMEOUT_MS = 15_000;

// --- Guarded DSH UI Primitives loader & self-defense components -----------------------

interface LoadedPrimitives {
  Button?: typeof DshPrimitives.Button;
  Modal?: typeof DshPrimitives.Modal;
  Switch?: typeof DshPrimitives.Switch;
  Tag?: typeof DshPrimitives.Tag;
}

function loadDshPrimitives(): LoadedPrimitives {
  try {
    if (typeof require === 'function') {
      const mod = require('@deepseek-ai/dsh-client-ui-primitives');
      if (mod && typeof mod === 'object') return mod as LoadedPrimitives;
    }
  } catch {}
  return {};
}

const { Button, Modal, Switch, Tag } = loadDshPrimitives();

function isUsableComponent(comp: unknown): comp is React.ComponentType<any> {
  return typeof comp === 'function' || (typeof comp === 'object' && comp !== null);
}

interface SafeErrorBoundaryProps {
  fallback?: React.ReactNode;
  children?: React.ReactNode;
}

class SafeErrorBoundary extends React.Component<SafeErrorBoundaryProps, { hasError: boolean }> {
  constructor(props: SafeErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch(): void {
    // Isolate failures inside our own plugin UI so the DSH host page never crashes.
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}

const SafeButton: React.FC<any> = ({ variant = 'outline', size = 'md', style, children, disabled, ...rest }) => {
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isSm = size === 'sm';
  const dangerStyle: React.CSSProperties | undefined = isDanger
    ? {
        background: 'var(--dsw-alias-danger, #dc2626)',
        borderColor: 'var(--dsw-alias-danger, #dc2626)',
        color: '#ffffff'
      }
    : undefined;
  const fallback = (
    <button
      type="button"
      disabled={disabled}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        padding: isSm ? '4px 10px' : '6px 14px',
        fontSize: isSm ? 12 : 13,
        fontWeight: 500,
        borderRadius: 6,
        border: isPrimary
          ? '1px solid var(--dsw-alias-primary, #2563eb)'
          : isDanger
            ? '1px solid var(--dsw-alias-danger, #dc2626)'
            : '1px solid var(--dsw-alias-border-l1, #cbd5e1)',
        background: isPrimary
          ? 'var(--dsw-alias-primary, #2563eb)'
          : isDanger
            ? 'var(--dsw-alias-danger, #dc2626)'
            : 'var(--dsw-alias-bg-elevated, #ffffff)',
        color: isPrimary || isDanger ? '#ffffff' : 'var(--dsw-alias-label-primary, #1e293b)',
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        lineHeight: 1.4,
        whiteSpace: 'nowrap',
        transition: 'opacity 160ms cubic-bezier(0.16, 1, 0.3, 1)',
        ...dangerStyle,
        ...style
      }}
      {...rest}
    >
      {children}
    </button>
  );

  if (!isUsableComponent(Button)) return fallback;
  return (
    <SafeErrorBoundary fallback={fallback}>
      <Button
        variant={isDanger ? 'primary' : variant}
        size={size}
        style={{ ...dangerStyle, ...style }}
        disabled={disabled}
        {...rest}
      >
        {children}
      </Button>
    </SafeErrorBoundary>
  );
};

const SafeTag: React.FC<{
  tone?: 'info' | 'danger' | 'success';
  style?: React.CSSProperties;
  title?: string;
  children?: React.ReactNode;
}> = ({ tone = 'info', style, children, ...rest }) => {
  const palette =
    tone === 'danger'
      ? {
          bg: 'rgba(220, 38, 38, 0.12)',
          border: 'rgba(220, 38, 38, 0.32)',
          color: 'var(--dsw-alias-danger, #dc2626)'
        }
      : tone === 'success'
        ? {
            bg: 'rgba(22, 163, 74, 0.12)',
            border: 'rgba(22, 163, 74, 0.3)',
            color: '#15803d'
          }
        : {
            bg: 'rgba(37, 99, 235, 0.1)',
            border: 'rgba(37, 99, 235, 0.25)',
            color: 'var(--dsw-alias-primary, #2563eb)'
          };

  const fallback = (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '1px 7px',
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 999,
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        color: palette.color,
        lineHeight: 1.5,
        whiteSpace: 'nowrap',
        fontVariantNumeric: 'tabular-nums',
        ...style
      }}
      {...rest}
    >
      {children}
    </span>
  );

  if (!isUsableComponent(Tag)) return fallback;
  return (
    <SafeErrorBoundary fallback={fallback}>
      <Tag tone={tone} style={style} {...rest}>
        {children}
      </Tag>
    </SafeErrorBoundary>
  );
};

interface SafeSwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

const SafeSwitch: React.FC<SafeSwitchProps> = ({ checked, onChange, label, disabled = false }) => {
  const fallback = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        width: 36,
        height: 20,
        padding: 2,
        borderRadius: 999,
        border: 'none',
        boxSizing: 'border-box',
        flexShrink: 0,
        background: checked
          ? 'var(--dsw-alias-label-primary, #111827)'
          : 'var(--dsw-alias-border-l1, #cbd5e1)',
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
        transition: 'background-color 180ms cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <span
        aria-hidden="true"
        style={{
          width: 16,
          height: 16,
          borderRadius: 999,
          background: '#ffffff',
          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.18)',
          transform: checked ? 'translateX(16px)' : 'translateX(0)',
          transition: 'transform 180ms cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      />
    </button>
  );

  if (!isUsableComponent(Switch)) return fallback;
  return (
    <SafeErrorBoundary fallback={fallback}>
      <span style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}>
        <Switch checked={checked} onChange={onChange} label={label} disabled={disabled} />
      </span>
    </SafeErrorBoundary>
  );
};

const SafeModal: React.FC<any> = ({ open, onClose, title, description, footer, closeLabel }) => {
  if (!open) return null;
  const fallback = (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={() => onClose?.()}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        background: 'rgba(15, 23, 42, 0.48)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16
      }}
    >
      <div
        onClick={event => event.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 440,
          borderRadius: 12,
          padding: 20,
          background: 'var(--dsw-alias-bg-elevated, #ffffff)',
          color: 'var(--dsw-alias-label-primary, #1e293b)',
          border: '1px solid var(--dsw-alias-border-l1, #e2e8f0)',
          boxShadow: '0 16px 40px rgba(15, 23, 42, 0.18)',
          boxSizing: 'border-box'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 8 }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{title}</div>
          <button
            type="button"
            aria-label={closeLabel || 'Close'}
            onClick={() => onClose?.()}
            style={{
              border: 'none',
              background: 'transparent',
              color: 'var(--dsw-alias-label-secondary, #64748b)',
              cursor: 'pointer',
              fontSize: 18,
              lineHeight: 1,
              padding: '4px 8px'
            }}
          >
            ×
          </button>
        </div>
        {description && (
          <div style={{ fontSize: 13, color: 'var(--dsw-alias-label-secondary, #64748b)', lineHeight: 1.6, marginBottom: 12 }}>
            {description}
          </div>
        )}
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>{footer}</div>}
      </div>
    </div>
  );

  if (!isUsableComponent(Modal)) return fallback;
  return (
    <SafeErrorBoundary fallback={fallback}>
      <Modal open={open} onClose={onClose} title={title} closeLabel={closeLabel} description={description} footer={footer} />
    </SafeErrorBoundary>
  );
};

// --- HTTP helper with required anti-CSRF header --------------------------------------

async function postUpdaterRequest<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal
): Promise<{ status: number; payload: T | null }> {
  const response = await fetch(path, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [UPDATER_REQUEST_HEADER]: '1'
    },
    body: JSON.stringify(body),
    signal
  });
  const payload = (await response.json().catch(() => null)) as T | null;
  return { status: response.status, payload };
}

// --- Locale bridge (supports optional / delayed locale service) -----------------------

const DEFAULT_SETTINGS: PluginSettings = {
  registry: 'npmjs',
  customRegistries: [],
  fallbackToOfficial: true,
  alwaysShowDetailButton: false,
  allowFreshRelease: false,
  allowUnreviewed: false
};

type TranslateParams = Record<string, string | number>;
type Translator = (key: string, params?: TranslateParams) => string;

interface LocaleServiceLike {
  register?: (namespace: string, dictionaries: Record<string, Record<string, string>>) => (() => void) | void;
  bind?: (namespace: string) => Translator;
  getSnapshot?: () => { revision?: number; [key: string]: unknown };
  subscribe?: (listener: () => void) => (() => void) | void;
}

interface DynamicLocaleBridge {
  t: Translator;
  getRevision: () => number;
  subscribe: (listener: () => void) => () => void;
  attach: (ctx: any, locale: LocaleServiceLike | undefined) => void;
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  );
}

function translateFromZh(key: string, params?: TranslateParams): string {
  const dictionary = zh as unknown as Record<string, string>;
  return interpolate(Object.prototype.hasOwnProperty.call(dictionary, key) ? dictionary[key] : key, params);
}

const FALLBACK_TRANSLATOR: Translator = (key, params) => translateFromZh(key, params);

function wrapTranslator(bound: Translator): Translator {
  return (key, params) => {
    let resolved: unknown;
    try {
      resolved = bound(key, params);
    } catch {
      resolved = key;
    }
    if (typeof resolved !== 'string' || resolved === key) return translateFromZh(key, params);
    return resolved;
  };
}

function getLocaleService(ctx: any): LocaleServiceLike | undefined {
  try {
    if (ctx?.locale && typeof ctx.locale === 'object') return ctx.locale as LocaleServiceLike;
  } catch {}
  try {
    const viaGet = typeof ctx?.get === 'function' ? ctx.get('locale') : undefined;
    if (viaGet && typeof viaGet === 'object') return viaGet as LocaleServiceLike;
  } catch {}
  return undefined;
}

function createTranslator(locale: LocaleServiceLike | undefined): Translator {
  if (locale && typeof locale.bind === 'function') {
    try {
      const bound = locale.bind(LOCALE_NAMESPACE);
      if (typeof bound === 'function') return wrapTranslator(bound);
    } catch {}
  }
  return FALLBACK_TRANSLATOR;
}

function registerLocaleDictionaries(ctx: any, locale: LocaleServiceLike | undefined): void {
  if (!locale || typeof locale.register !== 'function') return;
  const register = () => {
    try {
      const disposer = locale.register?.(LOCALE_NAMESPACE, { zh, en });
      return typeof disposer === 'function' ? disposer : undefined;
    } catch {
      return undefined;
    }
  };
  if (typeof ctx?.effect === 'function') {
    try {
      ctx.effect(register, 'dsh-plugins-update: locale dictionaries');
      return;
    } catch {}
  }
  register();
}

function createDynamicLocaleBridge(initialCtx: any): DynamicLocaleBridge {
  let activeLocale = getLocaleService(initialCtx);
  let activeTranslator = createTranslator(activeLocale);
  let revisionCounter = 0;
  let unsubscribeLocale: (() => void) | void;
  const listeners = new Set<() => void>();

  const bump = () => {
    revisionCounter += 1;
    for (const fn of listeners) {
      try {
        fn();
      } catch {}
    }
  };

  const attach = (targetCtx: any, nextLocale: LocaleServiceLike | undefined) => {
    if (!nextLocale) return;
    if (typeof unsubscribeLocale === 'function') {
      try {
        unsubscribeLocale();
      } catch {}
      unsubscribeLocale = undefined;
    }
    activeLocale = nextLocale;
    registerLocaleDictionaries(targetCtx, nextLocale);
    activeTranslator = createTranslator(nextLocale);
    if (typeof nextLocale.subscribe === 'function') {
      try {
        unsubscribeLocale = nextLocale.subscribe(bump);
      } catch {}
    }
    bump();
  };

  if (activeLocale) {
    attach(initialCtx, activeLocale);
  }

  return {
    t: (key, params) => activeTranslator(key, params),
    getRevision: () => {
      try {
        const snap = activeLocale?.getSnapshot?.();
        const hostRev = typeof snap?.revision === 'number' ? snap.revision : 0;
        return revisionCounter * 1000 + hostRev;
      } catch {
        return revisionCounter;
      }
    },
    subscribe: listener => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    attach
  };
}

function useLocaleRevision(bridge: DynamicLocaleBridge): number {
  const [revision, setRevision] = useState<number>(() => bridge.getRevision());
  useEffect(() => {
    const sync = () => setRevision(bridge.getRevision());
    const off = bridge.subscribe(sync);
    sync();
    return off;
  }, [bridge]);
  return revision;
}

const ERROR_KEY_BY_CODE: Record<string, string> = {
  [ERROR_CODES.invalidPackageName]: 'error.invalidPackageName',
  [ERROR_CODES.invalidTargetVersion]: 'error.invalidTargetVersion',
  [ERROR_CODES.officialPlugin]: 'error.officialPlugin',
  [ERROR_CODES.notInstalled]: 'error.notInstalled',
  [ERROR_CODES.profileNotFound]: 'error.profileNotFound',
  [ERROR_CODES.installInProgress]: 'error.installInProgress',
  [ERROR_CODES.offline]: 'error.offline',
  [ERROR_CODES.installFailed]: 'error.installFailed',
  [ERROR_CODES.timeout]: 'error.timeout',
  [ERROR_CODES.verificationFailed]: 'error.verificationFailed',
  [ERROR_CODES.rollbackFailed]: 'error.rollbackFailed',
  [ERROR_CODES.freshReleaseBlocked]: 'error.freshReleaseBlocked',
  [ERROR_CODES.unreviewedBlocked]: 'error.unreviewedBlocked',
  [ERROR_CODES.forbidden]: 'error.forbidden'
};

function errorText(t: Translator, errorCode?: string, fallback?: string): string {
  const key = errorCode ? ERROR_KEY_BY_CODE[errorCode] : undefined;
  return key ? t(key) : fallback || t('error.unknown');
}

function isOfficialPackage(pkg: SlotActionProps['subject']['pkg']): boolean {
  return pkg?.official === true || isOfficialPackageName(pkg?.name);
}

// --- Persistent stores: UI prefs, updatable plugins & orthogonal conflict badges ------

const UPDATABLE_STORAGE_KEY = 'dsh-plugins-update:updatable-v1';
const CONFLICTS_STORAGE_KEY = 'dsh-plugins-update:conflicts-v1';
const UPDATED_SESSION_KEY = 'dsh-plugins-update:updated-in-session-v1';
const UI_PREFS_STORAGE_KEY = 'dsh-plugins-update:ui-prefs-v1';

interface UiPrefs {
  registryUrl: string;
  alwaysShowDetailButton: boolean;
  allowFreshRelease: boolean;
  allowUnreviewed: boolean;
}

const uiPrefs: UiPrefs = {
  registryUrl: OFFICIAL_REGISTRY,
  alwaysShowDetailButton: false,
  allowFreshRelease: false,
  allowUnreviewed: false
};
const uiPrefsListeners = new Set<() => void>();

function loadUiPrefs(): void {
  try {
    const raw = window.localStorage?.getItem(UI_PREFS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      const normalized = normalizeRegistryUrl(parsed.registryUrl);
      if (normalized) uiPrefs.registryUrl = normalized;
      if (typeof parsed.alwaysShowDetailButton === 'boolean') {
        uiPrefs.alwaysShowDetailButton = parsed.alwaysShowDetailButton;
      }
      if (typeof parsed.allowFreshRelease === 'boolean') {
        uiPrefs.allowFreshRelease = parsed.allowFreshRelease;
      }
      if (typeof parsed.allowUnreviewed === 'boolean') {
        uiPrefs.allowUnreviewed = parsed.allowUnreviewed;
      }
    }
  } catch {}
}

loadUiPrefs();

function notifyUiPrefsChanged(): void {
  try {
    window.localStorage?.setItem(UI_PREFS_STORAGE_KEY, JSON.stringify(uiPrefs));
  } catch {}
  for (const listener of uiPrefsListeners) {
    try {
      listener();
    } catch {}
  }
}

function syncUiPrefs(next: {
  registryUrl?: string;
  alwaysShowDetailButton?: boolean;
  allowFreshRelease?: boolean;
  allowUnreviewed?: boolean;
}): void {
  let changed = false;
  if (next.registryUrl !== undefined) {
    const normalized = normalizeRegistryUrl(next.registryUrl);
    if (normalized && normalized !== uiPrefs.registryUrl) {
      uiPrefs.registryUrl = normalized;
      changed = true;
    }
  }
  if (typeof next.alwaysShowDetailButton === 'boolean' && next.alwaysShowDetailButton !== uiPrefs.alwaysShowDetailButton) {
    uiPrefs.alwaysShowDetailButton = next.alwaysShowDetailButton;
    changed = true;
  }
  if (typeof next.allowFreshRelease === 'boolean' && next.allowFreshRelease !== uiPrefs.allowFreshRelease) {
    uiPrefs.allowFreshRelease = next.allowFreshRelease;
    changed = true;
  }
  if (typeof next.allowUnreviewed === 'boolean' && next.allowUnreviewed !== uiPrefs.allowUnreviewed) {
    uiPrefs.allowUnreviewed = next.allowUnreviewed;
    changed = true;
  }
  if (changed) notifyUiPrefsChanged();
}

function useUiPrefs(): UiPrefs {
  const [snapshot, setSnapshot] = useState<UiPrefs>(() => ({ ...uiPrefs }));
  useEffect(() => {
    const sync = () => setSnapshot({ ...uiPrefs });
    uiPrefsListeners.add(sync);
    sync();
    return () => {
      uiPrefsListeners.delete(sync);
    };
  }, []);
  return snapshot;
}

interface SyncedConfigRefLike<T = unknown> {
  get: () => T;
  subscribe?: (listener: () => void) => (() => void) | void;
}

function isSyncedConfigRef<T = unknown>(value: unknown): value is SyncedConfigRefLike<T> {
  return typeof value === 'object' && value !== null && typeof (value as any).get === 'function';
}

function resolveSyncedConfigSource(ctx: any, config: any): Record<string, any> | undefined {
  if (config && typeof config === 'object' && isSyncedConfigRef(config.registry)) {
    return config as Record<string, any>;
  }
  try {
    const resolved = ctx?.config?.resolveConfigByPackage?.(PLUGIN_NAME);
    if (resolved && typeof resolved === 'object' && isSyncedConfigRef(resolved.registry)) {
      return resolved as Record<string, any>;
    }
  } catch {}
  return undefined;
}

function bindSyncedConfig(ctx: any, config: any): void {
  const source = resolveSyncedConfigSource(ctx, config);
  if (!source) return;

  const registryRef = source.registry;
  const alwaysShowRef = source.alwaysShowDetailButton;
  const allowFreshRef = source.allowFreshRelease;
  const allowUnreviewedRef = source.allowUnreviewed;

  const applySnapshot = () => {
    const next: {
      registryUrl?: string;
      alwaysShowDetailButton?: boolean;
      allowFreshRelease?: boolean;
      allowUnreviewed?: boolean;
    } = {};
    if (isSyncedConfigRef<unknown>(registryRef)) {
      try {
        const rawRegistry = registryRef.get();
        if (typeof rawRegistry === 'string' && rawRegistry.trim() && rawRegistry !== 'auto') {
          next.registryUrl = resolveRegistryUrl(rawRegistry.trim());
        }
      } catch {}
    }
    if (isSyncedConfigRef<unknown>(alwaysShowRef)) {
      try {
        const rawAlwaysShow = alwaysShowRef.get();
        if (typeof rawAlwaysShow === 'boolean') {
          next.alwaysShowDetailButton = rawAlwaysShow;
        }
      } catch {}
    }
    if (isSyncedConfigRef<unknown>(allowFreshRef)) {
      try {
        const rawFresh = allowFreshRef.get();
        if (typeof rawFresh === 'boolean') {
          next.allowFreshRelease = rawFresh;
        }
      } catch {}
    }
    if (isSyncedConfigRef<unknown>(allowUnreviewedRef)) {
      try {
        const rawUnreviewed = allowUnreviewedRef.get();
        if (typeof rawUnreviewed === 'boolean') {
          next.allowUnreviewed = rawUnreviewed;
        }
      } catch {}
    }
    syncUiPrefs(next);
  };

  const setup = () => {
    applySnapshot();
    const disposers: Array<() => void> = [];
    for (const ref of [registryRef, alwaysShowRef, allowFreshRef, allowUnreviewedRef]) {
      if (isSyncedConfigRef(ref) && typeof ref.subscribe === 'function') {
        try {
          const off = ref.subscribe(applySnapshot);
          if (typeof off === 'function') disposers.push(off);
        } catch {}
      }
    }
    return disposers.length > 0
      ? () => {
          for (const dispose of disposers) {
            try {
              dispose();
            } catch {}
          }
        }
      : undefined;
  };

  if (typeof ctx?.effect === 'function') {
    try {
      ctx.effect(setup, 'dsh-plugins-update: synced config');
      return;
    } catch {}
  }
  setup();
}

const updatablePlugins = new Map<string, string>();
const updatedInSession = new Map<string, string>();
const updatableListeners = new Set<() => void>();

const conflictedPlugins = new Map<string, PluginConflictInfo>();
const conflictListeners = new Set<() => void>();
const knownThirdPartyPackages = new Set<string>();
const reportedSessionCrashes = new Set<string>();

let hasRunInitialBatchCheck = false;
let batchCheckAbortController: AbortController | null = null;

function loadStorageMap(storage: Storage | undefined, key: string, target: Map<string, string>): void {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof k === 'string' && typeof v === 'string' && k && v) {
          target.set(k, v);
        }
      }
    }
  } catch {}
}

function saveStorageMap(storage: Storage | undefined, key: string, source: Map<string, string>): void {
  try {
    const obj: Record<string, string> = {};
    for (const [k, v] of source.entries()) obj[k] = v;
    storage?.setItem(key, JSON.stringify(obj));
  } catch {}
}

function loadConflictsStorage(): void {
  try {
    const raw = window.localStorage?.getItem(CONFLICTS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return;
    for (const [k, v] of Object.entries(parsed)) {
      if (!k || k === PLUGIN_NAME || isOfficialPackageName(k) || !v || typeof v !== 'object') continue;
      const item = v as Record<string, unknown>;
      if (typeof item.pluginVersion !== 'string' || !item.pluginVersion) continue;
      conflictedPlugins.set(k, {
        pluginVersion: item.pluginVersion,
        ...(typeof item.hostVersion === 'string' && item.hostVersion ? { hostVersion: item.hostVersion } : {}),
        ...(typeof item.reason === 'string' && item.reason ? { reason: item.reason } : {})
      });
    }
  } catch {}
}

function persistConflictsStorage(): void {
  try {
    const obj: Record<string, PluginConflictInfo> = {};
    for (const [k, v] of conflictedPlugins.entries()) obj[k] = v;
    window.localStorage?.setItem(CONFLICTS_STORAGE_KEY, JSON.stringify(obj));
  } catch {}
}

try {
  loadStorageMap(window.localStorage, UPDATABLE_STORAGE_KEY, updatablePlugins);
  loadStorageMap(window.sessionStorage, UPDATED_SESSION_KEY, updatedInSession);
  loadConflictsStorage();
} catch {}

function persistUpdatablePlugins(): void {
  try {
    saveStorageMap(window.localStorage, UPDATABLE_STORAGE_KEY, updatablePlugins);
  } catch {}
}

function notifyUpdatableChanged(): void {
  for (const listener of updatableListeners) {
    try {
      listener();
    } catch {}
  }
}

function notifyConflictsChanged(): void {
  for (const listener of conflictListeners) {
    try {
      listener();
    } catch {}
  }
}

function markPluginUpdatable(packageName: string, latestVersion: string): void {
  const name = packageName.trim();
  const ver = latestVersion.trim().replace(/^[v^~]/, '');
  if (!name || !ver || isOfficialPackageName(name)) return;
  const alreadyUpdatedTo = updatedInSession.get(name);
  if (alreadyUpdatedTo && versionGte(alreadyUpdatedTo, ver)) return;
  if (updatablePlugins.get(name) === ver) return;
  updatablePlugins.set(name, ver);
  persistUpdatablePlugins();
  notifyUpdatableChanged();
}

function clearPluginUpdatable(packageName: string, updatedToVersion?: string): void {
  const name = packageName.trim();
  if (!name) return;
  if (updatedToVersion) {
    const cleanVer = updatedToVersion.trim().replace(/^[v^~]/, '');
    if (cleanVer) {
      updatedInSession.set(name, cleanVer);
      try {
        saveStorageMap(window.sessionStorage, UPDATED_SESSION_KEY, updatedInSession);
      } catch {}
    }
  }
  if (updatablePlugins.delete(name)) {
    persistUpdatablePlugins();
    notifyUpdatableChanged();
  }
}

function sameConflictInfo(a: PluginConflictInfo | undefined, b: PluginConflictInfo | undefined): boolean {
  if (!a || !b) return false;
  return a.pluginVersion === b.pluginVersion && a.hostVersion === b.hostVersion && a.reason === b.reason;
}

function markPluginConflicted(packageName: string, info: PluginConflictInfo): void {
  const name = packageName.trim();
  if (!name || name === PLUGIN_NAME || isOfficialPackageName(name)) return;
  const prev = conflictedPlugins.get(name);
  if (sameConflictInfo(prev, info)) return;
  conflictedPlugins.set(name, info);
  persistConflictsStorage();
  notifyConflictsChanged();
}

function clearPluginConflict(packageName: string): void {
  const name = packageName.trim();
  if (!name) return;
  if (conflictedPlugins.delete(name)) {
    persistConflictsStorage();
    notifyConflictsChanged();
  }
}

function syncConflictsMap(nextConflicts?: Record<string, PluginConflictInfo>): void {
  if (!nextConflicts || typeof nextConflicts !== 'object') return;
  const nextEntries: Array<[string, PluginConflictInfo]> = [];
  for (const [rawName, info] of Object.entries(nextConflicts)) {
    const name = rawName.trim();
    if (!name || name === PLUGIN_NAME || isOfficialPackageName(name) || !info || typeof info !== 'object') continue;
    if (typeof info.pluginVersion !== 'string' || !info.pluginVersion) continue;
    knownThirdPartyPackages.add(name);
    nextEntries.push([name, info]);
  }

  let changed = nextEntries.length !== conflictedPlugins.size;
  if (!changed) {
    for (const [k, v] of nextEntries) {
      if (!sameConflictInfo(conflictedPlugins.get(k), v)) {
        changed = true;
        break;
      }
    }
  }
  if (!changed) return;

  conflictedPlugins.clear();
  for (const [k, v] of nextEntries) {
    conflictedPlugins.set(k, v);
  }
  persistConflictsStorage();
  notifyConflictsChanged();
}

function runBatchCheck(force = false, reconcileOnly = false): void {
  if (!force && !reconcileOnly && hasRunInitialBatchCheck) return;
  hasRunInitialBatchCheck = true;

  if (batchCheckAbortController) {
    if (!force && !reconcileOnly) return;
    batchCheckAbortController.abort();
  }

  const controller = new AbortController();
  batchCheckAbortController = controller;
  const timer = window.setTimeout(() => controller.abort(), BATCH_CHECK_TIMEOUT_MS);

  const knownUpdates: Record<string, string> = {};
  for (const [k, v] of updatablePlugins.entries()) {
    knownUpdates[k] = v;
  }

  const reqBody: CheckAllParams = {
    knownUpdates,
    force,
    ...(reconcileOnly ? { reconcile: true } : {})
  };

  postUpdaterRequest<CheckAllResult>(CHECK_ALL_PATH, reqBody, controller.signal)
    .then(({ payload }) => {
      if (batchCheckAbortController !== controller) return;
      if (!payload || typeof payload !== 'object' || payload.ok === false) return;
      syncUiPrefs({
        registryUrl: payload.registry,
        alwaysShowDetailButton: payload.alwaysShowDetailButton,
        allowFreshRelease: payload.allowFreshRelease,
        allowUnreviewed: payload.allowUnreviewed
      });
      syncConflictsMap(payload.conflicts ?? {});

      if (payload.updatable && typeof payload.updatable === 'object') {
        const nextMap = new Map<string, string>();
        for (const [rawName, rawVer] of Object.entries(payload.updatable)) {
          if (typeof rawName !== 'string' || typeof rawVer !== 'string') continue;
          const name = rawName.trim();
          const ver = rawVer.trim().replace(/^[v^~]/, '');
          if (!name || !ver || isOfficialPackageName(name)) continue;
          knownThirdPartyPackages.add(name);
          const alreadyUpdatedTo = updatedInSession.get(name);
          if (alreadyUpdatedTo && versionGte(alreadyUpdatedTo, ver)) continue;
          nextMap.set(name, ver);
        }

        let changed = nextMap.size !== updatablePlugins.size;
        if (!changed) {
          for (const [k, v] of nextMap.entries()) {
            if (updatablePlugins.get(k) !== v) {
              changed = true;
              break;
            }
          }
        }

        if (changed) {
          updatablePlugins.clear();
          for (const [k, v] of nextMap.entries()) {
            updatablePlugins.set(k, v);
          }
          persistUpdatablePlugins();
          notifyUpdatableChanged();
        }
      }
    })
    .catch(() => {})
    .finally(() => {
      window.clearTimeout(timer);
      if (batchCheckAbortController === controller) {
        batchCheckAbortController = null;
      }
    });
}

function useUpdatableSnapshot(): [string, string][] {
  const [entries, setEntries] = useState<[string, string][]>(() => Array.from(updatablePlugins.entries()));
  useEffect(() => {
    const sync = () => setEntries(Array.from(updatablePlugins.entries()));
    updatableListeners.add(sync);
    sync();
    return () => {
      updatableListeners.delete(sync);
    };
  }, []);
  return entries;
}

function useConflictsSnapshot(): [string, PluginConflictInfo][] {
  const [entries, setEntries] = useState<[string, PluginConflictInfo][]>(() => Array.from(conflictedPlugins.entries()));
  useEffect(() => {
    const sync = () => setEntries(Array.from(conflictedPlugins.entries()));
    conflictListeners.add(sync);
    sync();
    return () => {
      conflictListeners.delete(sync);
    };
  }, []);
  return entries;
}

function formatConflictTooltip(t: Translator, info: PluginConflictInfo): string {
  return info.reason ? t('badge.conflictReasonTip', { reason: info.reason }) : t('badge.conflictTip');
}

function buildSidebarTip(t: Translator, conflictCount: number, updatableCount: number): string {
  if (conflictCount > 0 && updatableCount > 0) {
    return t('badge.sidebarBoth', { conflicts: conflictCount, updates: updatableCount });
  }
  if (conflictCount > 0) {
    return t('badge.sidebarConflictsOnly', { conflicts: conflictCount });
  }
  return t('badge.sidebarUpdatesOnly', { updates: updatableCount });
}

// --- Client runtime crash stack attribution ------------------------------------------

const IGNORED_NODE_MODULES = new Set([
  'react',
  'react-dom',
  'scheduler',
  'cordis',
  'schemastery',
  PLUGIN_NAME
]);

function extractPackageFromStackText(text: string): string | null {
  if (!text) return null;
  const normalized = text.replace(/\\/g, '/');
  const nmRegex = /node_modules\/((?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+)/gi;
  let match: RegExpExecArray | null;
  while ((match = nmRegex.exec(normalized)) !== null) {
    const candidate = match[1];
    if (!candidate || isOfficialPackageName(candidate) || IGNORED_NODE_MODULES.has(candidate)) continue;
    return candidate;
  }

  const loaderMatch = normalized.match(/__ModuleLoader__[\s\S]{0,120}?["']((?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+)["']/);
  if (loaderMatch?.[1]) {
    const candidate = loaderMatch[1];
    if (!isOfficialPackageName(candidate) && !IGNORED_NODE_MODULES.has(candidate)) {
      return candidate;
    }
  }

  const sortedKnown = Array.from(knownThirdPartyPackages)
    .filter(n => n && n !== PLUGIN_NAME && !isOfficialPackageName(n))
    .sort((a, b) => b.length - a.length);
  for (const pkg of sortedKnown) {
    if (normalized.includes(`/${pkg}/`) || normalized.includes(`"${pkg}"`) || normalized.includes(`'${pkg}'`)) {
      return pkg;
    }
  }
  return null;
}

function reportRuntimeConflictToBackend(packageName: string, detail: string): void {
  const name = packageName.trim();
  if (!name || name === PLUGIN_NAME || isOfficialPackageName(name)) return;
  if (conflictedPlugins.has(name) || reportedSessionCrashes.has(name)) return;
  reportedSessionCrashes.add(name);

  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);
  const body: ReportConflictParams = {
    packageName: name,
    reason: (detail || 'Runtime error').trim().slice(0, 260)
  };

  postUpdaterRequest<ReportConflictResult>(REPORT_CONFLICT_PATH, body, controller.signal)
    .then(({ payload }) => {
      if (payload?.ok && payload.disabled && payload.conflict) {
        markPluginConflicted(name, payload.conflict);
      }
    })
    .catch(() => {})
    .finally(() => {
      window.clearTimeout(timer);
    });
}

// --- Settings card (native Switch toggles & accessible inputs) ------------------------

function useConfigFormState(form: any): {
  settings: PluginSettings;
  writable: boolean;
  updateField: (field: keyof PluginSettings, value: any) => Promise<boolean>;
} {
  const [snapshot, setSnapshot] = useState<any>(() => (form?.getSnapshot ? form.getSnapshot() : {}));

  useEffect(() => {
    if (!form?.subscribe) return undefined;
    const unsubscribe = form.subscribe(() => setSnapshot(form.getSnapshot?.() ?? {}));
    setSnapshot(form.getSnapshot?.() ?? {});
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [form]);

  const raw = snapshot?.value;
  const settings: PluginSettings = {
    registry: typeof raw?.registry === 'string' && raw.registry !== 'auto' ? raw.registry : DEFAULT_SETTINGS.registry,
    customRegistries: Array.isArray(raw?.customRegistries)
      ? raw.customRegistries.filter((item: any) => item && typeof item.url === 'string')
      : DEFAULT_SETTINGS.customRegistries,
    fallbackToOfficial:
      typeof raw?.fallbackToOfficial === 'boolean' ? raw.fallbackToOfficial : DEFAULT_SETTINGS.fallbackToOfficial,
    alwaysShowDetailButton:
      typeof raw?.alwaysShowDetailButton === 'boolean'
        ? raw.alwaysShowDetailButton
        : DEFAULT_SETTINGS.alwaysShowDetailButton,
    allowFreshRelease:
      typeof raw?.allowFreshRelease === 'boolean' ? raw.allowFreshRelease : DEFAULT_SETTINGS.allowFreshRelease,
    allowUnreviewed:
      typeof raw?.allowUnreviewed === 'boolean' ? raw.allowUnreviewed : DEFAULT_SETTINGS.allowUnreviewed
  };

  const hasRaw = Boolean(raw && typeof raw === 'object');
  useEffect(() => {
    if (!hasRaw) return;
    syncUiPrefs({
      registryUrl: resolveRegistryUrl(settings.registry),
      alwaysShowDetailButton: settings.alwaysShowDetailButton,
      allowFreshRelease: settings.allowFreshRelease,
      allowUnreviewed: settings.allowUnreviewed
    });
  }, [
    settings.registry,
    settings.alwaysShowDetailButton,
    settings.allowFreshRelease,
    settings.allowUnreviewed,
    hasRaw
  ]);

  const updateField = useCallback(
    async (field: keyof PluginSettings, value: any): Promise<boolean> => {
      if (!form?.set) return false;
      try {
        const ok = (await form.set(field, value)) !== false;
        if (ok) {
          if (field === 'registry' && typeof value === 'string') {
            syncUiPrefs({ registryUrl: resolveRegistryUrl(value) });
          } else if (field === 'alwaysShowDetailButton' && typeof value === 'boolean') {
            syncUiPrefs({ alwaysShowDetailButton: value });
          } else if (field === 'allowFreshRelease' && typeof value === 'boolean') {
            syncUiPrefs({ allowFreshRelease: value });
          } else if (field === 'allowUnreviewed' && typeof value === 'boolean') {
            syncUiPrefs({ allowUnreviewed: value });
          }
        }
        return ok;
      } catch {
        return false;
      }
    },
    [form]
  );

  return { settings, writable: snapshot?.writable !== false, updateField };
}

const cardStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderRadius: '10px',
  background: 'var(--dsw-alias-bg-elevated, #ffffff)',
  border: '1px solid var(--dsw-alias-border-l1, #e2e8f0)',
  fontSize: '13px',
  color: 'var(--dsw-alias-label-primary, #1e293b)',
  lineHeight: 1.6,
  boxSizing: 'border-box'
};

const hintStyle: React.CSSProperties = {
  fontSize: '12px',
  color: 'var(--dsw-alias-label-secondary, #64748b)',
  marginTop: '3px',
  maxWidth: '65ch'
};

const optionStyle = (active: boolean): React.CSSProperties => ({
  display: 'flex',
  alignItems: 'flex-start',
  padding: '10px 12px',
  borderRadius: '8px',
  border: active ? '1.5px solid var(--dsw-alias-primary, #2563eb)' : '1px solid var(--dsw-alias-border-l2, #e2e8f0)',
  background: active ? 'rgba(37, 99, 235, 0.04)' : 'var(--dsw-alias-bg-subtle, #f8fafc)',
  marginBottom: '8px',
  cursor: 'pointer'
});

const smallButtonStyle: React.CSSProperties = {
  padding: '4px 10px',
  fontSize: '12px',
  borderRadius: '6px',
  border: '1px solid var(--dsw-alias-border-l1, #cbd5e1)',
  background: 'var(--dsw-alias-bg-elevated, #ffffff)',
  color: 'var(--dsw-alias-label-primary, #334155)',
  cursor: 'pointer'
};

const inputLabelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: 'var(--dsw-alias-label-primary, #1e293b)',
  marginBottom: '4px'
};

const textInputStyle: React.CSSProperties = {
  width: '100%',
  height: 32,
  padding: '0 10px',
  borderRadius: 6,
  border: '1px solid var(--dsw-alias-border-l1, #cbd5e1)',
  background: 'var(--dsw-alias-bg-elevated, #ffffff)',
  color: 'var(--dsw-alias-label-primary, #1e293b)',
  fontSize: '13px',
  boxSizing: 'border-box'
};

const switchRowStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 16,
  paddingTop: 12,
  marginTop: 12,
  borderTop: '1px solid var(--dsw-alias-border-l2, #e2e8f0)'
};

interface RegistrySettingsCardProps {
  form?: any;
  localeBridge: DynamicLocaleBridge;
}

const BUILTIN_REGISTRIES = [
  { value: 'npmjs', url: OFFICIAL_REGISTRY, labelKey: 'settings.npmjs', hintKey: 'settings.npmjsHint' },
  { value: 'npmmirror', url: DOMESTIC_REGISTRY, labelKey: 'settings.npmmirror', hintKey: 'settings.npmmirrorHint' }
] as const;

export const RegistrySettingsCard: React.FC<RegistrySettingsCardProps> = ({ form, localeBridge }) => {
  useLocaleRevision(localeBridge);
  const t = localeBridge.t;
  const { settings, writable, updateField } = useConfigFormState(form);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [errorKey, setErrorKey] = useState('');
  const [notice, setNotice] = useState<{ key: string; params?: TranslateParams } | null>(null);
  const [pendingDangerField, setPendingDangerField] = useState<'allowFreshRelease' | 'allowUnreviewed' | null>(null);
  const noticeTimerRef = useRef<number | null>(null);
  const customNameId = useId();
  const customUrlId = useId();

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  const showNotice = (key: string, params?: TranslateParams) => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setNotice({ key, params });
    noticeTimerRef.current = window.setTimeout(() => {
      noticeTimerRef.current = null;
      setNotice(null);
    }, 2500);
  };

  const isCurrent = (value: string) =>
    value === 'npmjs' || value === 'npmmirror'
      ? settings.registry === value
      : normalizeRegistryUrl(settings.registry) === normalizeRegistryUrl(value);

  const select = async (value: string) => {
    if (!writable || isCurrent(value)) return;
    if (await updateField('registry', value)) {
      showNotice('settings.notice.registryUpdated');
      runBatchCheck(true);
    }
  };

  const addCustom = async () => {
    setErrorKey('');
    const normalized = normalizeRegistryUrl(url);
    if (!normalized) {
      setErrorKey('settings.error.invalidUrl');
      return;
    }
    if (
      normalized === OFFICIAL_REGISTRY ||
      normalized === DOMESTIC_REGISTRY ||
      settings.customRegistries.some(item => normalizeRegistryUrl(item.url) === normalized)
    ) {
      setErrorKey('settings.error.duplicate');
      return;
    }
    const next: CustomRegistry[] = [...settings.customRegistries, { name: name.trim(), url: normalized }];
    if (!(await updateField('customRegistries', next)) || !(await updateField('registry', normalized))) {
      setErrorKey('settings.error.saveFailed');
      return;
    }
    setName('');
    setUrl('');
    setAdding(false);
    showNotice('settings.notice.customAdded');
    runBatchCheck(true);
  };

  const removeCustom = async (target: string) => {
    if (!writable) return;
    const normalized = normalizeRegistryUrl(target);
    const next = settings.customRegistries.filter(item => normalizeRegistryUrl(item.url) !== normalized);
    if (!(await updateField('customRegistries', next))) return;
    if (normalizeRegistryUrl(settings.registry) === normalized) {
      await updateField('registry', 'npmjs');
      runBatchCheck(true);
    }
    showNotice('settings.notice.customRemoved');
  };

  const handleDangerToggle = (field: 'allowFreshRelease' | 'allowUnreviewed') => async (next: boolean) => {
    if (!writable) return;
    if (next) {
      setPendingDangerField(field);
      return;
    }
    if (await updateField(field, false)) {
      updatablePlugins.clear();
      persistUpdatablePlugins();
      notifyUpdatableChanged();
      runBatchCheck(true);
    }
  };

  const confirmDangerEnable = async () => {
    const field = pendingDangerField;
    setPendingDangerField(null);
    if (!field || !writable) return;
    if (await updateField(field, true)) {
      runBatchCheck(true);
    }
  };

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{t('settings.title')}</span>
        {notice && (
          <span role="status" style={{ fontSize: 12, color: '#15803d' }}>
            {t(notice.key, notice.params)}
          </span>
        )}
      </div>
      <div style={{ ...hintStyle, marginBottom: 10 }}>{t('settings.intro')}</div>

      {BUILTIN_REGISTRIES.map(item => {
        const active = isCurrent(item.value);
        return (
          <div key={item.value} style={{ ...optionStyle(active), padding: 0, alignItems: 'center', cursor: 'default' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                flex: 1,
                padding: '10px 12px',
                cursor: writable ? 'pointer' : 'default'
              }}
            >
              <input
                type="radio"
                checked={active}
                onChange={() => void select(item.value)}
                disabled={!writable}
                style={{ marginRight: 10, marginTop: 3 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {t(item.labelKey)}{' '}
                  <span style={{ fontFamily: 'monospace', fontWeight: 400, overflowWrap: 'anywhere' }}>{item.url}</span>
                </div>
                <div style={hintStyle}>{t(item.hintKey)}</div>
              </div>
            </label>
          </div>
        );
      })}

      {settings.customRegistries.map(item => {
        const active = isCurrent(item.url);
        return (
          <div key={item.url} style={{ ...optionStyle(active), padding: 0, alignItems: 'center', cursor: 'default' }}>
            <label
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                flex: 1,
                minWidth: 0,
                padding: '10px 12px',
                cursor: writable ? 'pointer' : 'default'
              }}
            >
              <input
                type="radio"
                checked={active}
                onChange={() => void select(item.url)}
                disabled={!writable}
                style={{ marginRight: 10, marginTop: 3 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>
                  {item.name || t('settings.customFallbackName')}{' '}
                  <span style={{ fontFamily: 'monospace', fontWeight: 400, overflowWrap: 'anywhere' }}>{item.url}</span>
                </div>
                <div style={hintStyle}>{t('settings.customHint')}</div>
              </div>
            </label>
            {writable && (
              <button
                type="button"
                style={{
                  ...smallButtonStyle,
                  color: 'var(--dsw-alias-danger, #dc2626)',
                  borderColor: 'rgba(220, 38, 38, 0.35)',
                  alignSelf: 'flex-start',
                  marginTop: 10,
                  marginRight: 12
                }}
                onClick={() => void removeCustom(item.url)}
              >
                {t('settings.delete')}
              </button>
            )}
          </div>
        );
      })}

      {!adding && (
        <button type="button" style={smallButtonStyle} onClick={() => setAdding(true)} disabled={!writable}>
          {t('settings.addCustom')}
        </button>
      )}
      {adding && (
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div>
            <label htmlFor={customNameId} style={inputLabelStyle}>
              {t('settings.customNameLabel')}
            </label>
            <input
              id={customNameId}
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder={t('settings.customNamePlaceholder')}
              style={textInputStyle}
            />
          </div>
          <div>
            <label htmlFor={customUrlId} style={inputLabelStyle}>
              {t('settings.customUrlLabel')}
            </label>
            <input
              id={customUrlId}
              type="url"
              value={url}
              onChange={event => setUrl(event.target.value)}
              placeholder={t('settings.customUrlPlaceholder')}
              style={textInputStyle}
            />
          </div>
          {errorKey && (
            <div role="alert" style={{ color: 'var(--dsw-alias-danger, #b91c1c)', fontSize: 12 }}>
              {t(errorKey)}
            </div>
          )}
          <div style={{ display: 'flex', gap: 8 }}>
            <SafeButton variant="primary" size="sm" onClick={() => void addCustom()} disabled={!writable}>
              {t('settings.saveUse')}
            </SafeButton>
            <SafeButton
              variant="outline"
              size="sm"
              onClick={() => {
                setAdding(false);
                setErrorKey('');
              }}
            >
              {t('settings.cancel')}
            </SafeButton>
          </div>
        </div>
      )}

      <div style={{ ...switchRowStyle, marginTop: 16, paddingTop: 14 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--dsw-alias-label-primary, #1e293b)' }}>
            {t('settings.fallback')}
          </div>
          <div style={hintStyle}>{t('settings.fallbackHint')}</div>
        </div>
        <SafeSwitch
          checked={settings.fallbackToOfficial}
          disabled={!writable}
          label={t('settings.fallback')}
          onChange={next => void updateField('fallbackToOfficial', next)}
        />
      </div>

      <div style={switchRowStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 500, fontSize: 13, color: 'var(--dsw-alias-label-primary, #1e293b)' }}>
            {t('settings.alwaysShowDetail')}
          </div>
          <div style={hintStyle}>{t('settings.alwaysShowDetailHint')}</div>
        </div>
        <SafeSwitch
          checked={settings.alwaysShowDetailButton}
          disabled={!writable}
          label={t('settings.alwaysShowDetail')}
          onChange={next => void updateField('alwaysShowDetailButton', next)}
        />
      </div>

      <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--dsw-alias-border-l2, #e2e8f0)' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--dsw-alias-label-primary, #1e293b)' }}>
          {t('settings.securitySectionTitle')}
        </div>
      </div>

      <div style={{ ...switchRowStyle, borderTop: 'none', marginTop: 8, paddingTop: 4 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              fontWeight: 500,
              fontSize: 13,
              color: 'var(--dsw-alias-label-primary, #1e293b)'
            }}
          >
            <span>{t('settings.allowFreshRelease')}</span>
            {settings.allowFreshRelease && <SafeTag tone="danger">{t('settings.riskEnabledTag')}</SafeTag>}
          </div>
          <div style={hintStyle}>{t('settings.allowFreshReleaseHint')}</div>
        </div>
        <SafeSwitch
          checked={settings.allowFreshRelease}
          disabled={!writable}
          label={t('settings.allowFreshRelease')}
          onChange={next => void handleDangerToggle('allowFreshRelease')(next)}
        />
      </div>

      <div style={switchRowStyle}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 8,
              fontWeight: 500,
              fontSize: 13,
              color: 'var(--dsw-alias-label-primary, #1e293b)'
            }}
          >
            <span>{t('settings.allowUnreviewed')}</span>
            {settings.allowUnreviewed && <SafeTag tone="danger">{t('settings.riskEnabledTag')}</SafeTag>}
          </div>
          <div style={hintStyle}>{t('settings.allowUnreviewedHint')}</div>
        </div>
        <SafeSwitch
          checked={settings.allowUnreviewed}
          disabled={!writable}
          label={t('settings.allowUnreviewed')}
          onChange={next => void handleDangerToggle('allowUnreviewed')(next)}
        />
      </div>

      <SafeModal
        open={pendingDangerField !== null}
        onClose={() => setPendingDangerField(null)}
        title={pendingDangerField === 'allowFreshRelease' ? t('danger.freshRelease.title') : t('danger.unreviewed.title')}
        closeLabel={t('danger.close')}
        description={
          pendingDangerField === 'allowFreshRelease' ? t('danger.freshRelease.body') : t('danger.unreviewed.body')
        }
        footer={
          <>
            <SafeButton variant="outline" onClick={() => setPendingDangerField(null)}>
              {t('danger.cancel')}
            </SafeButton>
            <SafeButton variant="danger" onClick={() => void confirmDangerEnable()}>
              {t('danger.confirmEnable')}
            </SafeButton>
          </>
        }
      />
    </div>
  );
};

// --- Detail page conflict badge (`plugins.detail.badge`) ------------------------------

interface DetailConflictBadgeProps extends SlotActionProps {
  localeBridge: DynamicLocaleBridge;
}

const DetailConflictBadge: React.FC<DetailConflictBadgeProps> = ({ subject, localeBridge }) => {
  useLocaleRevision(localeBridge);
  const t = localeBridge.t;
  useConflictsSnapshot();

  const pkg = subject?.pkg;
  const packageName = typeof pkg?.name === 'string' ? pkg.name : '';
  const conflict = packageName ? conflictedPlugins.get(packageName) : undefined;
  const isEnabled = pkg?.enabled === true;
  const currentVersion = pkg?.version;
  const upgradedPastConflict = Boolean(
    conflict &&
      currentVersion &&
      parseSemver(currentVersion) &&
      parseSemver(conflict.pluginVersion) &&
      compareSemver(currentVersion, conflict.pluginVersion) > 0
  );

  useEffect(() => {
    if (!packageName || !conflict) return;
    if (upgradedPastConflict) {
      clearPluginConflict(packageName);
      return;
    }
    if (isEnabled) {
      clearPluginConflict(packageName);
      runBatchCheck(false, true);
    }
  }, [conflict, isEnabled, packageName, upgradedPastConflict]);

  if (
    subject?.kind !== 'bundle' ||
    !packageName ||
    isOfficialPackage(pkg) ||
    !conflict ||
    isEnabled ||
    upgradedPastConflict
  ) {
    return null;
  }

  return (
    <SafeTag tone="danger" title={formatConflictTooltip(t, conflict)}>
      {t('badge.conflictDisabled')}
    </SafeTag>
  );
};

// --- Detail page updater action button (`plugins.detail.actions`) ---------------------

type Status = 'checking' | 'has_update' | 'up_to_date' | 'updating' | 'success' | 'error';
type MessageState =
  | { kind: 'key'; key: string; params?: TranslateParams }
  | { kind: 'error'; errorCode?: string; fallback?: string; rollbackFailed?: boolean };

interface UpdaterActionButtonProps extends SlotActionProps {
  localeBridge: DynamicLocaleBridge;
}

function isGithubPackage(pkg: SlotActionProps['subject']['pkg'], checkResult?: CheckUpdateResult | null): boolean {
  if (checkResult?.isGithub === true) return true;
  const source = typeof pkg?.source === 'string' ? pkg.source : '';
  return /github:|github\.com/i.test(source);
}

export const UpdaterActionButton: React.FC<UpdaterActionButtonProps> = ({ subject, localeBridge }) => {
  useLocaleRevision(localeBridge);
  const t = localeBridge.t;
  const currentUiPrefs = useUiPrefs();
  const pkg = subject?.pkg;
  const packageName = typeof pkg?.name === 'string' ? pkg.name : '';
  const clientVersion = pkg?.version || '0.0.0';
  const renderable = subject?.kind === 'bundle' && !!packageName && pkg?.installed !== false && !isOfficialPackage(pkg);

  const [status, setStatus] = useState<Status>('checking');
  const [checkResult, setCheckResult] = useState<CheckUpdateResult | null>(null);
  const [message, setMessage] = useState<MessageState | null>(null);
  const mountedRef = useRef(true);
  const tokenRef = useRef(0);
  const checkAbortRef = useRef<AbortController | null>(null);
  const updateAbortRef = useRef<AbortController | null>(null);
  const successVersionRef = useRef<string | null>(null);
  const activePackageRef = useRef(packageName);
  activePackageRef.current = packageName;

  const isGithub = isGithubPackage(pkg, checkResult);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      tokenRef.current += 1;
      checkAbortRef.current?.abort();
      updateAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    tokenRef.current += 1;
    checkAbortRef.current?.abort();
    successVersionRef.current = null;
    setCheckResult(null);
    setMessage(null);
  }, [packageName]);

  useEffect(() => {
    if (!packageName || !clientVersion) return;
    const cachedVer = updatablePlugins.get(packageName);
    if (cachedVer && versionGte(clientVersion, cachedVer)) {
      clearPluginUpdatable(packageName, clientVersion);
    }
    const cachedConflict = conflictedPlugins.get(packageName);
    if (
      cachedConflict &&
      parseSemver(clientVersion) &&
      parseSemver(cachedConflict.pluginVersion) &&
      compareSemver(clientVersion, cachedConflict.pluginVersion) > 0
    ) {
      clearPluginConflict(packageName);
    }
  }, [packageName, clientVersion]);

  const fetchCheck = useCallback(async (): Promise<CheckUpdateResult | null> => {
    if (!renderable) return null;
    const token = ++tokenRef.current;
    checkAbortRef.current?.abort();
    const controller = new AbortController();
    checkAbortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    setStatus('checking');
    setMessage(null);

    const tryFallbackCachedUpdate = (): CheckUpdateResult | null => {
      const cachedVer = updatablePlugins.get(packageName);
      if (cachedVer && !versionGte(clientVersion, cachedVer)) {
        const fallbackResult: CheckUpdateResult = {
          ok: true,
          packageName,
          currentVersion: clientVersion,
          latestVersion: cachedVer,
          hasUpdate: true
        };
        setCheckResult(fallbackResult);
        setStatus('has_update');
        setMessage(null);
        return fallbackResult;
      }
      return null;
    };

    try {
      const reqBody: CheckUpdateParams = { packageName, currentVersion: clientVersion };
      const { status: httpStatus, payload } = await postUpdaterRequest<CheckUpdateResult>(
        CHECK_PATH,
        reqBody,
        controller.signal
      );
      if (token !== tokenRef.current || !mountedRef.current) return null;
      if (!payload || typeof payload !== 'object') throw new Error(`HTTP ${httpStatus}`);
      if (payload.ok === false) {
        if (payload.errorCode === ERROR_CODES.notInstalled || payload.errorCode === ERROR_CODES.officialPlugin) {
          clearPluginUpdatable(packageName);
          clearPluginConflict(packageName);
        } else if (payload.errorCode === ERROR_CODES.offline || payload.errorCode === ERROR_CODES.timeout) {
          const fallback = tryFallbackCachedUpdate();
          if (fallback) return fallback;
        }
        setCheckResult(null);
        setStatus('error');
        setMessage({ kind: 'error', errorCode: payload.errorCode, fallback: payload.error });
        return payload;
      }
      syncUiPrefs({
        registryUrl: payload.registry,
        alwaysShowDetailButton: payload.alwaysShowDetailButton,
        allowFreshRelease: payload.allowFreshRelease,
        allowUnreviewed: payload.allowUnreviewed
      });
      if (payload.conflict) {
        markPluginConflicted(packageName, payload.conflict);
      } else {
        clearPluginConflict(packageName);
      }
      setCheckResult(payload);
      if (payload.hasUpdate && payload.latestVersion) {
        markPluginUpdatable(packageName, payload.latestVersion);
        setStatus('has_update');
      } else {
        clearPluginUpdatable(packageName, payload.currentVersion || clientVersion);
        setStatus('up_to_date');
      }
      return payload;
    } catch (error: any) {
      if (token !== tokenRef.current || !mountedRef.current) return null;
      const fallback = tryFallbackCachedUpdate();
      if (fallback) return fallback;
      setCheckResult(null);
      setStatus('error');
      setMessage({ kind: 'key', key: error?.name === 'AbortError' ? 'check.timeout' : 'check.network' });
      return null;
    } finally {
      window.clearTimeout(timer);
      if (checkAbortRef.current === controller) checkAbortRef.current = null;
    }
  }, [clientVersion, packageName, renderable]);

  useEffect(() => {
    if (!renderable) return;
    if (successVersionRef.current && clientVersion === successVersionRef.current) return;
    void fetchCheck();
  }, [clientVersion, fetchCheck, renderable]);

  const runUpdate = async () => {
    if (!checkResult?.hasUpdate || status === 'updating') return;
    const targetPkg = packageName;
    const targetVersion = checkResult.latestVersion;
    const updateToken = ++tokenRef.current;
    setStatus('updating');
    setMessage(null);

    const controller = new AbortController();
    updateAbortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), UPDATE_TIMEOUT_MS);
    try {
      const reqBody: DoUpdateParams = { packageName: targetPkg, targetVersion };
      const { status: httpStatus, payload } = await postUpdaterRequest<DoUpdateResult>(
        UPDATE_PATH,
        reqBody,
        controller.signal
      );
      if (!payload || typeof payload !== 'object') throw new Error(`HTTP ${httpStatus}`);
      if (payload.ok === false) {
        if (updateToken !== tokenRef.current || !mountedRef.current) return;
        setStatus('error');
        setMessage({
          kind: 'error',
          errorCode: payload.errorCode,
          fallback: payload.error,
          rollbackFailed: payload.rollback === 'failed'
        });
        return;
      }
      const version = payload.targetVersion || targetVersion || clientVersion;
      clearPluginUpdatable(targetPkg, version);
      clearPluginConflict(targetPkg);
      if (updateToken !== tokenRef.current || !mountedRef.current) return;
      successVersionRef.current = version;
      setStatus('success');
      setMessage({
        kind: 'key',
        key: targetPkg === PLUGIN_NAME ? 'update.selfUpdate' : 'update.success',
        params: { version }
      });
    } catch {
      if (updateToken !== tokenRef.current || !mountedRef.current) return;
      await new Promise(resolvePromise => window.setTimeout(resolvePromise, 1500));
      if (updateToken !== tokenRef.current || !mountedRef.current) return;
      const checked = await fetchCheck();
      if (!mountedRef.current || activePackageRef.current !== targetPkg) return;
      if (checked && versionGte(checked.currentVersion, targetVersion)) {
        const version = checked.currentVersion || targetVersion || clientVersion;
        successVersionRef.current = version;
        clearPluginUpdatable(targetPkg, version);
        clearPluginConflict(targetPkg);
        setStatus('success');
        setMessage({
          kind: 'key',
          key: targetPkg === PLUGIN_NAME ? 'update.selfUpdate' : 'update.success',
          params: { version }
        });
      } else {
        setStatus('error');
        setMessage({ kind: 'key', key: 'update.failed' });
      }
    } finally {
      window.clearTimeout(timer);
      if (updateAbortRef.current === controller) updateAbortRef.current = null;
    }
  };

  if (!renderable) return null;

  const effectiveRegistry =
    normalizeRegistryUrl(checkResult?.registry || currentUiPrefs.registryUrl) ?? OFFICIAL_REGISTRY;
  const usingNonOfficialRegistry = effectiveRegistry !== OFFICIAL_REGISTRY;
  const effectiveAlwaysShow = checkResult?.alwaysShowDetailButton ?? currentUiPrefs.alwaysShowDetailButton;
  const isGitOrigin = isGithub || (typeof pkg?.update === 'string' && pkg.update !== 'registry');
  const isFreshRelease = checkResult?.isFreshRelease === true;
  const nativeUnavailable = isGitOrigin || usingNonOfficialRegistry || isFreshRelease;

  // Yield to DSH native VersionSection unless DSH native does not cover this update or Always Show is enabled.
  if (!nativeUnavailable && !effectiveAlwaysShow) {
    return null;
  }

  // When npm secondary action is enabled, keep the header clean unless an update/action is active.
  if (!isGitOrigin && (status === 'checking' || status === 'up_to_date')) {
    return null;
  }

  const latestVersion = checkResult?.latestVersion || '';
  const messageText = message
    ? message.kind === 'key'
      ? t(message.key, message.params)
      : (() => {
          const baseError = errorText(t, message.errorCode, message.fallback);
          return message.rollbackFailed && message.errorCode !== ERROR_CODES.rollbackFailed
            ? `${baseError} (${t('error.rollbackFailed')})`
            : baseError;
        })()
    : '';

  const buttonLabel =
    status === 'checking'
      ? t('action.checking')
      : status === 'has_update'
        ? t('action.githubUpdate', { version: latestVersion })
        : status === 'updating'
          ? t('action.updating')
          : status === 'success'
            ? t('action.success')
            : status === 'up_to_date'
              ? t('action.upToDate')
              : t('action.retry');

  const onButtonClick = () => {
    if (status === 'has_update') {
      void runUpdate();
      return;
    }
    if (status === 'checking' || status === 'updating') return;
    successVersionRef.current = null;
    void fetchCheck();
  };

  const showMessage = Boolean(messageText) && (isGitOrigin || status !== 'success');

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      {isGitOrigin ? (
        <SafeButton
          variant={status === 'has_update' ? 'primary' : 'outline'}
          size="sm"
          onClick={onButtonClick}
          disabled={status === 'checking' || status === 'updating'}
        >
          {buttonLabel}
        </SafeButton>
      ) : (
        <>
          {status === 'has_update' && (
            <SafeButton
              variant="outline"
              size="sm"
              onClick={() => void runUpdate()}
              title={isFreshRelease ? t('action.fastUpdateTip') : undefined}
            >
              {t(isFreshRelease ? 'action.fastUpdate' : 'action.fallbackUpdate', { version: latestVersion })}
            </SafeButton>
          )}
          {status === 'updating' && (
            <span style={{ fontSize: 12, color: 'var(--dsw-alias-label-secondary, #64748b)' }}>{t('action.updating')}</span>
          )}
          {status === 'success' && (
            <span style={{ fontSize: 12, color: '#15803d' }}>{messageText || t('action.success')}</span>
          )}
          {status === 'error' && (
            <SafeButton variant="outline" size="sm" onClick={() => void fetchCheck()}>
              {t('action.retry')}
            </SafeButton>
          )}
        </>
      )}
      {showMessage && (
        <div style={{ fontSize: 12, color: status === 'error' ? '#b91c1c' : '#15803d', maxWidth: 360 }}>{messageText}</div>
      )}
    </div>
  );
};

// --- Sidebar & installed list orthogonal badges (Red = Conflict, Blue = Update) -------

const SIDEBAR_BADGE_ATTR = 'data-dsh-updater-sidebar-badge';
const ROW_BADGE_ATTR = 'data-dsh-updater-row-badge';
const ROW_CONFLICT_ATTR = 'data-dsh-updater-row-conflict';
const NATIVE_UPDATE_LABELS = new Set(['可更新', 'Update available']);

function hasNativeUpdateTag(card: HTMLElement, t: Translator): boolean {
  const expectedLocal = t('badge.updateAvailable');
  const candidates = card.querySelectorAll<HTMLElement>('[data-dsw-tag], [data-tone], span');
  for (const el of Array.from(candidates)) {
    if (
      el.hasAttribute(ROW_BADGE_ATTR) ||
      el.hasAttribute(ROW_CONFLICT_ATTR) ||
      el.closest(`[${ROW_BADGE_ATTR}], [${ROW_CONFLICT_ATTR}]`) ||
      el.querySelector(`[${ROW_BADGE_ATTR}], [${ROW_CONFLICT_ATTR}]`)
    ) {
      continue;
    }
    const isLeafOrTagged =
      el.children.length === 0 || el.hasAttribute('data-tone') || el.hasAttribute('data-dsw-tag');
    if (!isLeafOrTagged) continue;
    const text = el.textContent?.trim();
    if (!text) continue;
    if (text === expectedLocal || NATIVE_UPDATE_LABELS.has(text)) {
      return true;
    }
  }
  return false;
}

function hasNativeProblemTag(card: HTMLElement): boolean {
  if (card.getAttribute('data-plugin-status') === 'problem') return true;
  const dangerTags = card.querySelectorAll<HTMLElement>('[data-tone="danger"]');
  for (const el of Array.from(dangerTags)) {
    if (
      el.hasAttribute(ROW_CONFLICT_ATTR) ||
      el.hasAttribute(ROW_BADGE_ATTR) ||
      el.closest(`[${ROW_CONFLICT_ATTR}], [${ROW_BADGE_ATTR}]`)
    ) {
      continue;
    }
    return true;
  }
  return false;
}

function mountRowBadgeHost(
  card: HTMLLIElement,
  pkgName: string,
  attrName: string,
  beforeSibling?: HTMLElement | null
): HTMLElement {
  const host = document.createElement('span');
  host.setAttribute(attrName, pkgName);
  host.style.cssText = 'display: inline-flex; align-items: center; flex: none; cursor: pointer;';

  if (beforeSibling?.parentElement) {
    beforeSibling.parentElement.insertBefore(host, beforeSibling);
    return host;
  }

  // DSH PackageCard renders native status tags inside the titleRow beside cardTitle.
  const titleBtn = card.querySelector<HTMLElement>('button:not([role="switch"])');
  if (titleBtn?.parentElement && titleBtn.parentElement !== card) {
    titleBtn.parentElement.appendChild(host);
    return host;
  }

  // Fallback: place before the outer toggle wrapper inside cardEnd, never inside .bundleToggle span itself.
  const switchEl = card.querySelector<HTMLElement>('[role="switch"]');
  const toggleWrapper = switchEl?.closest('span');
  const cardEnd = toggleWrapper?.parentElement || switchEl?.parentElement;
  if (toggleWrapper && cardEnd && toggleWrapper !== switchEl) {
    cardEnd.insertBefore(host, toggleWrapper);
  } else if (switchEl && switchEl.parentElement) {
    switchEl.parentElement.insertBefore(host, switchEl);
  } else {
    const fallbackEnd = card.firstElementChild?.lastElementChild || card;
    fallbackEnd.insertBefore(host, fallbackEnd.firstChild);
  }
  return host;
}

function isOwnBadgeMutation(mutation: MutationRecord): boolean {
  const targetEl = mutation.target instanceof Element ? mutation.target : null;
  if (
    targetEl &&
    (targetEl.hasAttribute(SIDEBAR_BADGE_ATTR) ||
      targetEl.hasAttribute(ROW_BADGE_ATTR) ||
      targetEl.hasAttribute(ROW_CONFLICT_ATTR) ||
      targetEl.closest(`[${SIDEBAR_BADGE_ATTR}], [${ROW_BADGE_ATTR}], [${ROW_CONFLICT_ATTR}]`))
  ) {
    return true;
  }
  if (mutation.type === 'childList') {
    const nodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
    if (
      nodes.length > 0 &&
      nodes.every(
        node =>
          node instanceof Element &&
          (node.hasAttribute(SIDEBAR_BADGE_ATTR) ||
            node.hasAttribute(ROW_BADGE_ATTR) ||
            node.hasAttribute(ROW_CONFLICT_ATTR))
      )
    ) {
      return true;
    }
  }
  return false;
}

function resolvePluginsPanelLabel(slots: any): string | null {
  try {
    const entries =
      typeof slots?.entriesOfSlot === 'function'
        ? slots.entriesOfSlot('sidebar.panellist')
        : typeof slots?.entries === 'function'
          ? slots.entries('sidebar.panellist')
          : null;
    if (Array.isArray(entries)) {
      const pluginsEntry = entries.find((item: any) => item?.options?.id === 'plugins');
      const rawLabel = pluginsEntry?.options?.label;
      const resolved = typeof rawLabel === 'function' ? rawLabel() : rawLabel;
      if (typeof resolved === 'string' && resolved.trim()) return resolved.trim();
    }
  } catch {}
  return null;
}

function findSidebarPluginsButton(slots: any): HTMLElement | null {
  try {
    const dynamicLabel = resolvePluginsPanelLabel(slots);
    const candidateLabels = Array.from(new Set([dynamicLabel, '插件', 'Plugins'].filter(Boolean) as string[]));

    for (const label of candidateLabels) {
      const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(label) : label;
      const btn = document.querySelector<HTMLElement>(`button[aria-label="${escaped}"]`);
      if (btn && !btn.closest('[data-plugin-panel]')) return btn;
    }

    const buttons = document.querySelectorAll<HTMLElement>('button');
    for (const btn of buttons) {
      if (btn.closest('[data-plugin-panel]')) continue;
      for (const child of Array.from(btn.children)) {
        if (child.tagName === 'SPAN' && candidateLabels.includes((child.textContent || '').trim())) {
          return btn;
        }
      }
    }
  } catch {}
  return null;
}

let nativeSidebarTrailingDepth = 0;
const nativeSidebarTrailingListeners = new Set<() => void>();

function notifyNativeSidebarTrailingChanged(): void {
  for (const listener of nativeSidebarTrailingListeners) {
    try {
      listener();
    } catch {}
  }
}

function useNativeSidebarTrailingActive(): boolean {
  const [active, setActive] = useState<boolean>(() => nativeSidebarTrailingDepth > 0);
  useEffect(() => {
    const sync = () => setActive(nativeSidebarTrailingDepth > 0);
    nativeSidebarTrailingListeners.add(sync);
    sync();
    return () => {
      nativeSidebarTrailingListeners.delete(sync);
    };
  }, []);
  return active;
}

const srOnlyStyle: React.CSSProperties = {
  position: 'absolute',
  width: '1px',
  height: '1px',
  padding: 0,
  margin: '-1px',
  overflow: 'hidden',
  clip: 'rect(0, 0, 0, 0)',
  whiteSpace: 'nowrap',
  border: 0
};

function renderSidebarBadgeVisual(conflictCount: number, updatableCount: number, wide: boolean): React.ReactNode {
  if (wide) {
    return (
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {conflictCount > 0 && <SafeTag tone="danger">{String(conflictCount)}</SafeTag>}
        {updatableCount > 0 && <SafeTag tone="info">{String(updatableCount)}</SafeTag>}
      </span>
    );
  }

  return (
    <span aria-hidden="true" style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
      {conflictCount > 0 ? (
        <>
          <SafeTag tone="danger">{String(conflictCount)}</SafeTag>
          {updatableCount > 0 && (
            <span
              style={{
                position: 'absolute',
                top: -2,
                right: -2,
                width: 6,
                height: 6,
                borderRadius: 999,
                background: 'var(--dsw-alias-primary, #2563eb)',
                boxShadow: '0 0 0 1.5px var(--dsw-alias-bg-elevated, #ffffff)'
              }}
            />
          )}
        </>
      ) : (
        <SafeTag tone="info">{String(updatableCount)}</SafeTag>
      )}
    </span>
  );
}

interface SidebarPluginsTrailingProps {
  wide?: boolean;
  active?: boolean;
  localeBridge: DynamicLocaleBridge;
}

const SidebarPluginsTrailingBadge: React.FC<SidebarPluginsTrailingProps> = ({ wide = true, localeBridge }) => {
  useLocaleRevision(localeBridge);
  const t = localeBridge.t;
  const updatableEntries = useUpdatableSnapshot();
  const conflictEntries = useConflictsSnapshot();
  const updatableCount = updatableEntries.length;
  const conflictCount = conflictEntries.length;

  if (conflictCount <= 0 && updatableCount <= 0) return null;

  const tip = buildSidebarTip(t, conflictCount, updatableCount);
  return (
    <span
      title={wide ? tip : undefined}
      style={
        wide
          ? { display: 'inline-flex', alignItems: 'center', gap: 4 }
          : {
              display: 'inline-flex',
              alignItems: 'center',
              pointerEvents: 'none',
              transform: 'scale(0.75) translate(3px, -3px)',
              transformOrigin: 'top right'
            }
      }
    >
      <span style={srOnlyStyle}>{tip}</span>
      {renderSidebarBadgeVisual(conflictCount, updatableCount, wide)}
    </span>
  );
};

interface UpdateRemindersOverlayProps {
  slots: any;
  localeBridge: DynamicLocaleBridge;
}

interface RowUpdateMountTarget {
  packageName: string;
  latestVersion: string;
  host: HTMLElement;
  card: HTMLLIElement;
}

interface RowConflictMountTarget {
  packageName: string;
  conflict: PluginConflictInfo;
  host: HTMLElement;
  card: HTMLLIElement;
}

const UpdateRemindersOverlay: React.FC<UpdateRemindersOverlayProps> = ({ slots, localeBridge }) => {
  useLocaleRevision(localeBridge);
  const t = localeBridge.t;
  const updatableEntries = useUpdatableSnapshot();
  const conflictEntries = useConflictsSnapshot();
  const nativeSidebarTrailing = useNativeSidebarTrailingActive();

  const [sidebarHost, setSidebarHost] = useState<HTMLElement | null>(null);
  const [sidebarWide, setSidebarWide] = useState<boolean>(true);
  const [rowTargets, setRowTargets] = useState<RowUpdateMountTarget[]>([]);
  const [conflictTargets, setConflictTargets] = useState<RowConflictMountTarget[]>([]);

  const lastNativeDoneRef = useRef(false);
  const sidebarBtnRef = useRef<HTMLElement | null>(null);
  const lastSidebarCssRef = useRef<string>('');
  const reconciledSwitchOnRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const timer = window.setTimeout(() => {
      runBatchCheck(false);
    }, 600);
    return () => window.clearTimeout(timer);
  }, []);

  // Lightweight runtime error sniffer: auto-disables third-party plugins whose client bundle crashes.
  useEffect(() => {
    const onWindowError = (event: ErrorEvent) => {
      const msg = String(event?.message || event?.error?.message || '');
      const stack = `${event?.filename || ''}\n${event?.error?.stack || ''}`;
      if (stack.includes(`/${PLUGIN_NAME}/`) || stack.includes(`\\${PLUGIN_NAME}\\`) || msg.includes(`"${PLUGIN_NAME}"`)) {
        return;
      }
      const pkg = extractPackageFromStackText(`${stack}\n${msg}`);
      if (pkg) {
        reportRuntimeConflictToBackend(pkg, msg || 'Uncaught client runtime error');
      }
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event?.reason;
      const msg =
        typeof reason === 'string'
          ? reason
          : typeof reason?.message === 'string'
            ? reason.message
            : String(reason || '');
      const stack = typeof reason?.stack === 'string' ? reason.stack : '';
      if (stack.includes(`/${PLUGIN_NAME}/`) || stack.includes(`\\${PLUGIN_NAME}\\`) || msg.includes(`"${PLUGIN_NAME}"`)) {
        return;
      }
      const pkg = extractPackageFromStackText(`${stack}\n${msg}`);
      if (pkg) {
        reportRuntimeConflictToBackend(pkg, msg || 'Unhandled promise rejection');
      }
    };

    window.addEventListener('error', onWindowError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);
    return () => {
      window.removeEventListener('error', onWindowError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  const syncDomTargets = useCallback(() => {
    try {
      const hasAnyBadge = updatablePlugins.size > 0 || conflictedPlugins.size > 0;

      // 1. Legacy Sidebar "Plugins" count badge host (fallback for DSH < 0.2.3-alpha.1 without sidebar.panellist.trailing)
      if (nativeSidebarTrailingDepth > 0) {
        if (sidebarBtnRef.current) {
          sidebarBtnRef.current.querySelector(`span[${SIDEBAR_BADGE_ATTR}="true"]`)?.remove();
          sidebarBtnRef.current = null;
          lastSidebarCssRef.current = '';
        }
        setSidebarHost(null);
      } else {
        let pluginsBtn = sidebarBtnRef.current;
        if (!pluginsBtn || !pluginsBtn.isConnected) {
          pluginsBtn = findSidebarPluginsButton(slots);
          sidebarBtnRef.current = pluginsBtn;
          lastSidebarCssRef.current = '';
        }
        const hasNativeTrailingSlotInDom = Boolean(
          pluginsBtn?.querySelector('[data-slot="sidebar.panellist.trailing"]')
        );
        if (pluginsBtn && !hasNativeTrailingSlotInDom) {
          let host = pluginsBtn.querySelector<HTMLElement>(`span[${SIDEBAR_BADGE_ATTR}="true"]`);
          if (!host) {
            host = document.createElement('span');
            host.setAttribute(SIDEBAR_BADGE_ATTR, 'true');
            pluginsBtn.appendChild(host);
            lastSidebarCssRef.current = '';
          }
          let nextCssText = 'display: none;';
          const isCollapsed = pluginsBtn.clientWidth > 0 && pluginsBtn.clientWidth <= 48;
          setSidebarWide(!isCollapsed);
          if (hasAnyBadge) {
            if (
              (!pluginsBtn.style.position || pluginsBtn.style.position === 'static') &&
              window.getComputedStyle(pluginsBtn).position === 'static'
            ) {
              pluginsBtn.style.position = 'relative';
            }
            if (isCollapsed) {
              nextCssText =
                'position: absolute; top: 2px; right: 2px; display: inline-flex; align-items: center; pointer-events: none; transform: scale(0.8); transformOrigin: top right;';
            } else {
              const panelEntry = pluginsBtn.closest('nav > div') || pluginsBtn.parentElement;
              const hasUnpinBtn = Boolean(
                panelEntry && Array.from(panelEntry.querySelectorAll('button')).some(btn => btn !== pluginsBtn)
              );
              nextCssText = `position: absolute; top: 50%; right: ${hasUnpinBtn ? '32px' : '10px'}; transform: translateY(-50%); display: inline-flex; align-items: center; pointer-events: none;`;
            }
          }
          if (lastSidebarCssRef.current !== nextCssText) {
            host.style.cssText = nextCssText;
            lastSidebarCssRef.current = nextCssText;
          }
          setSidebarHost(prev => (prev === host ? prev : host));
        } else {
          pluginsBtn?.querySelector(`span[${SIDEBAR_BADGE_ATTR}="true"]`)?.remove();
          setSidebarHost(null);
        }
      }

      // 2. Sync Installed Plugins list row badges (orthogonal red conflict badge + blue update badge)
      const cards = Array.from(document.querySelectorAll<HTMLLIElement>('li[data-plugin-package]'));
      for (const card of cards) {
        const pkg = card.getAttribute('data-plugin-package');
        if (pkg && pkg !== PLUGIN_NAME && !isOfficialPackageName(pkg)) {
          knownThirdPartyPackages.add(pkg);
        }
      }

      const nextRowTargets: RowUpdateMountTarget[] = [];
      const nextConflictTargets: RowConflictMountTarget[] = [];

      for (const card of cards) {
        const pkgName = card.getAttribute('data-plugin-package') || '';
        if (!pkgName) continue;
        const latestVersion = updatablePlugins.get(pkgName);
        const conflict = conflictedPlugins.get(pkgName);
        const switchAttr = card.querySelector('[role="switch"]')?.getAttribute('aria-checked');
        const isCardSwitchOn = switchAttr === 'true';

        if (conflict && isCardSwitchOn) {
          if (!reconciledSwitchOnRef.current.has(pkgName)) {
            reconciledSwitchOnRef.current.add(pkgName);
            window.setTimeout(() => runBatchCheck(false, true), 600);
          }
        } else {
          reconciledSwitchOnRef.current.delete(pkgName);
        }

        const escapedPkg =
          typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
            ? CSS.escape(pkgName)
            : pkgName.replace(/["\\]/g, '\\$&');
        let conflictHost = card.querySelector<HTMLElement>(`span[${ROW_CONFLICT_ATTR}="${escapedPkg}"]`);
        let updateHost = card.querySelector<HTMLElement>(`span[${ROW_BADGE_ATTR}="${escapedPkg}"]`);

        const showConflict = Boolean(conflict && !isCardSwitchOn && !hasNativeProblemTag(card));
        const showUpdate = Boolean(latestVersion && !hasNativeUpdateTag(card, t));

        if (showConflict && conflict) {
          const updateParent = updateHost?.parentElement;
          if (!conflictHost) {
            conflictHost = mountRowBadgeHost(card, pkgName, ROW_CONFLICT_ATTR, updateHost);
          } else if (updateHost && updateParent && conflictHost.parentElement === updateParent) {
            // Keep [Conflict] consistently placed before [Update available]
            if (conflictHost.compareDocumentPosition(updateHost) & Node.DOCUMENT_POSITION_PRECEDING) {
              updateParent.insertBefore(conflictHost, updateHost);
            }
          }
          nextConflictTargets.push({
            packageName: pkgName,
            conflict,
            host: conflictHost,
            card
          });
        } else if (conflictHost) {
          conflictHost.remove();
        }

        if (showUpdate && latestVersion) {
          if (!updateHost) {
            updateHost = mountRowBadgeHost(card, pkgName, ROW_BADGE_ATTR);
          }
          nextRowTargets.push({
            packageName: pkgName,
            latestVersion,
            host: updateHost,
            card
          });
        } else if (updateHost) {
          updateHost.remove();
        }
      }

      setConflictTargets(prev => {
        if (
          prev.length === nextConflictTargets.length &&
          prev.every(
            (item, i) =>
              item.packageName === nextConflictTargets[i].packageName &&
              sameConflictInfo(item.conflict, nextConflictTargets[i].conflict) &&
              item.host === nextConflictTargets[i].host
          )
        ) {
          return prev;
        }
        return nextConflictTargets;
      });

      setRowTargets(prev => {
        if (
          prev.length === nextRowTargets.length &&
          prev.every(
            (item, i) =>
              item.packageName === nextRowTargets[i].packageName &&
              item.latestVersion === nextRowTargets[i].latestVersion &&
              item.host === nextRowTargets[i].host
          )
        ) {
          return prev;
        }
        return nextRowTargets;
      });

      // 3. Reconcile badge cache when DSH's native UpdateDialog / InstallDialog settles on "done"
      const nativeDone = Boolean(document.querySelector('[data-plugin-update="done"], [data-install-phase="done"]'));
      if (nativeDone && !lastNativeDoneRef.current) {
        runBatchCheck(false, true);
      }
      lastNativeDoneRef.current = nativeDone;
    } catch {}
  }, [slots, t]);

  useEffect(() => {
    syncDomTargets();
  }, [syncDomTargets, updatableEntries, conflictEntries, nativeSidebarTrailing]);

  useEffect(() => {
    const btn = sidebarBtnRef.current;
    if (!btn || typeof ResizeObserver === 'undefined') return undefined;
    let rafId = 0;
    const ro = new ResizeObserver(() => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        syncDomTargets();
      });
    });
    ro.observe(btn);
    return () => {
      ro.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [sidebarHost, syncDomTargets]);

  useEffect(() => {
    const THROTTLE_MS = 200;
    let rafId = 0;
    let throttleTimer = 0;
    let lastSyncTime = 0;

    const runNow = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        lastSyncTime = Date.now();
        syncDomTargets();
      });
    };

    const scheduleSync = (immediate = false) => {
      if (immediate) {
        if (throttleTimer) {
          window.clearTimeout(throttleTimer);
          throttleTimer = 0;
        }
        runNow();
        return;
      }
      const elapsed = Date.now() - lastSyncTime;
      if (elapsed >= THROTTLE_MS) {
        runNow();
      } else if (!throttleTimer && !rafId) {
        throttleTimer = window.setTimeout(() => {
          throttleTimer = 0;
          runNow();
        }, THROTTLE_MS - elapsed);
      }
    };

    const observer = new MutationObserver(mutations => {
      let hasRelevant = false;
      let isDialogDoneAttr = false;
      for (const m of mutations) {
        if (isOwnBadgeMutation(m)) continue;
        hasRelevant = true;
        if (m.type === 'attributes') {
          isDialogDoneAttr = true;
          break;
        }
      }
      if (hasRelevant) {
        scheduleSync(isDialogDoneAttr);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['data-plugin-update', 'data-install-phase', 'aria-checked', 'data-plugin-status']
    });

    const onResize = () => scheduleSync();
    window.addEventListener('resize', onResize);
    syncDomTargets();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', onResize);
      if (rafId) window.cancelAnimationFrame(rafId);
      if (throttleTimer) window.clearTimeout(throttleTimer);
    };
  }, [syncDomTargets]);

  useEffect(() => {
    return () => {
      document
        .querySelectorAll(`[${SIDEBAR_BADGE_ATTR}], [${ROW_BADGE_ATTR}], [${ROW_CONFLICT_ATTR}]`)
        .forEach(el => el.remove());
    };
  }, []);

  const updatableCount = updatableEntries.length;
  const conflictCount = conflictEntries.length;
  const hasAnySidebarBadge = conflictCount > 0 || updatableCount > 0;
  const sidebarTip = hasAnySidebarBadge ? buildSidebarTip(t, conflictCount, updatableCount) : '';

  return (
    <>
      {sidebarHost &&
        hasAnySidebarBadge &&
        createPortal(
          <span title={sidebarTip} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            {renderSidebarBadgeVisual(conflictCount, updatableCount, sidebarWide)}
          </span>,
          sidebarHost
        )}
      {conflictTargets.map(({ packageName, conflict, host, card }) =>
        createPortal(
          <span
            title={formatConflictTooltip(t, conflict)}
            onClick={event => {
              event.stopPropagation();
              const openBtn = card.querySelector<HTMLElement>('button:not([role="switch"])');
              openBtn?.click();
            }}
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            <SafeTag tone="danger">{t('badge.conflictDisabled')}</SafeTag>
          </span>,
          host,
          `conflict:${packageName}`
        )
      )}
      {rowTargets.map(({ packageName, latestVersion, host, card }) =>
        createPortal(
          <span
            title={`v${latestVersion}`}
            onClick={event => {
              event.stopPropagation();
              const openBtn = card.querySelector<HTMLElement>('button:not([role="switch"])');
              openBtn?.click();
            }}
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            <SafeTag tone="info">{t('badge.updateAvailable')}</SafeTag>
          </span>,
          host,
          `update:${packageName}`
        )
      )}
    </>
  );
};

// --- Client entry (minimal Cordis inject for survivability across DSH upgrades) -------

export function apply(ctx: any, config?: any) {
  const localeBridge = createDynamicLocaleBridge(ctx);
  if (!getLocaleService(ctx) && typeof ctx?.inject === 'function') {
    try {
      ctx.inject(['locale'], (subCtx: any) => {
        localeBridge.attach(subCtx, getLocaleService(subCtx));
      });
    } catch {}
  }

  bindSyncedConfig(ctx, config);

  const slots = ctx.slots ?? ctx.get?.('slots');
  if (!slots?.inject || !slots?.register) return;

  let formInstance: any;
  const getForm = () => {
    if (formInstance) return formInstance;
    const cf = ctx.configForms ?? ctx.get?.('configForms');
    if (cf?.get) formInstance = cf.get(PLUGIN_NAME);
    return formInstance;
  };

  try {
    slots.inject('sidebar.panellist.trailing', () => {
      let disposeRegistration: (() => void) | void;
      try {
        disposeRegistration = slots.register(
          {
            name: 'sidebar.panellist.trailing',
            id: 'plugins',
            priority: 10
          },
          (props: Omit<SidebarPluginsTrailingProps, 'localeBridge'>) =>
            React.createElement(
              SafeErrorBoundary,
              { fallback: null },
              React.createElement(SidebarPluginsTrailingBadge, { ...props, localeBridge })
            )
        );
      } catch {
        return undefined;
      }
      nativeSidebarTrailingDepth += 1;
      notifyNativeSidebarTrailingChanged();
      return () => {
        nativeSidebarTrailingDepth = Math.max(0, nativeSidebarTrailingDepth - 1);
        notifyNativeSidebarTrailingChanged();
        if (typeof disposeRegistration === 'function') {
          try {
            disposeRegistration();
          } catch {}
        }
      };
    });
  } catch {}

  slots.inject('shell.overlay', () =>
    slots.register(
      {
        name: 'shell.overlay',
        id: `${PLUGIN_NAME}.reminders-overlay`,
        order: 50
      },
      (props: any) =>
        React.createElement(
          SafeErrorBoundary,
          { fallback: null },
          React.createElement(UpdateRemindersOverlay, { ...props, slots, localeBridge })
        )
    )
  );

  try {
    slots.inject('plugins.detail.badge', () =>
      slots.register(
        {
          name: 'plugins.detail.badge',
          id: `${PLUGIN_NAME}.conflict-badge`,
          order: -5
        },
        (props: SlotActionProps) =>
          React.createElement(
            SafeErrorBoundary,
            { fallback: null },
            React.createElement(DetailConflictBadge, { ...props, localeBridge })
          )
      )
    );
  } catch {}

  slots.inject('plugins.detail.actions', () =>
    slots.register(
      {
        name: 'plugins.detail.actions',
        id: `${PLUGIN_NAME}.action-button`,
        order: -10
      },
      (props: SlotActionProps) =>
        React.createElement(
          SafeErrorBoundary,
          { fallback: null },
          React.createElement(UpdaterActionButton, { ...props, localeBridge })
        )
    )
  );

  const registerBundleConfig = (form?: any) =>
    slots.inject('plugins.bundle.config', () =>
      slots.register(
        {
          name: 'plugins.bundle.config',
          key: PLUGIN_NAME
        },
        () =>
          React.createElement(
            SafeErrorBoundary,
            { fallback: null },
            React.createElement(RegistrySettingsCard, { form: form || getForm(), localeBridge })
          )
      )
    );

  const bindConfigCard = (targetCtx: any, cf: any) => {
    if (cf?.whileServed) {
      targetCtx.effect(
        () =>
          cf.whileServed([PLUGIN_NAME], () => {
            const form = cf.get(PLUGIN_NAME);
            formInstance = form;
            return registerBundleConfig(form);
          }),
        'dsh-plugins-update: bundle settings card'
      );
    } else {
      registerBundleConfig(cf?.get?.(PLUGIN_NAME));
    }
  };

  const immediateCf = ctx.configForms ?? ctx.get?.('configForms');
  if (immediateCf) {
    bindConfigCard(ctx, immediateCf);
  } else if (typeof ctx.inject === 'function') {
    ctx.inject(['configForms'], (subCtx: any) => {
      bindConfigCard(subCtx, subCtx.configForms ?? subCtx.get?.('configForms'));
    });
  } else {
    registerBundleConfig();
  }
}

export const name = PLUGIN_NAME;
export const inject = ['slots'];
