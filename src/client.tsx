import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  CANCEL_PATH,
  CHECK_PATH,
  DOMESTIC_REGISTRY,
  ERROR_CODES,
  LOCALE_NAMESPACE,
  OFFICIAL_REGISTRY,
  PROGRESS_PATH,
  UPDATE_PATH,
  normalizeRegistryUrl,
  type CheckUpdateResult,
  type CustomRegistry,
  type DoUpdateResult,
  type ErrorCode,
  type PluginSettings,
  type SlotActionProps,
  type UpdateJobState,
  type UpdatePhase
} from './types.js';
import { en, zh } from './locales.js';

// =====================================================================================
// Shared helpers: translators, DSH locale service access, error and registry text
// =====================================================================================

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

/** Interpolate `{name}` placeholders the same way the DSH locale runtime does. */
function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
  );
}

/** Look a key up in the bundled Chinese dictionary (older DSH without a locale service). */
function translateFromZh(key: string, params?: TranslateParams): string {
  const dictionary = zh as unknown as Record<string, string>;
  const template = Object.prototype.hasOwnProperty.call(dictionary, key) ? dictionary[key] : key;
  return interpolate(template, params);
}

/** Fallback translator used when the DSH locale service is unavailable and by direct component use. */
const FALLBACK_TRANSLATOR: Translator = (key, params) => translateFromZh(key, params);

/**
 * Wrap a locale-service translator: when the bound namespace has no entry for a key
 * (e.g. dictionaries are not registered yet, or an older DSH ignores late namespaces),
 * show the bundled Chinese text instead of the raw key.
 */
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

/** Read the locale service defensively: older DSH versions do not provide it at all. */
function getLocaleService(ctx: any): LocaleServiceLike | undefined {
  try {
    const direct = ctx?.locale;
    if (direct && typeof direct === 'object') return direct as LocaleServiceLike;
  } catch {
    // Accessing an unprovided service may throw on some cordis versions; ignore.
  }
  try {
    const viaGet = typeof ctx?.get === 'function' ? ctx.get('locale') : undefined;
    if (viaGet && typeof viaGet === 'object') return viaGet as LocaleServiceLike;
  } catch {
    // Ignore and report "no locale service".
  }
  return undefined;
}

/** Build the plugin translator: live locale-service binding when available, Chinese fallback otherwise. */
function createTranslator(locale: LocaleServiceLike | undefined): Translator {
  if (locale && typeof locale.bind === 'function') {
    try {
      const bound = locale.bind(LOCALE_NAMESPACE);
      if (typeof bound === 'function') return wrapTranslator(bound);
    } catch (error) {
      console.error('dsh-plugins-update: failed to bind the locale namespace, using the bundled fallback', error);
    }
  }
  return FALLBACK_TRANSLATOR;
}

/** Register zh/en dictionaries under the plugin namespace inside a cordis effect (disposed with the plugin). */
function registerLocaleDictionaries(ctx: any, locale: LocaleServiceLike | undefined): void {
  if (!locale || typeof locale.register !== 'function') return;
  const register = () => {
    try {
      const disposer = locale.register?.(LOCALE_NAMESPACE, { zh, en });
      return typeof disposer === 'function' ? disposer : undefined;
    } catch (error) {
      console.error('dsh-plugins-update: failed to register locale dictionaries', error);
      return undefined;
    }
  };
  if (typeof ctx?.effect === 'function') {
    try {
      ctx.effect(register, 'dsh-plugins-update: locale dictionaries');
      return;
    } catch (error) {
      console.error('dsh-plugins-update: failed to install the locale registration effect', error);
    }
  }
  register();
}

/** Re-render a component whenever the DSH locale snapshot changes (language switch or late registration). */
function useLocaleRevision(locale: LocaleServiceLike | undefined): number {
  const readRevision = (): number => {
    try {
      const snapshot = locale?.getSnapshot?.();
      return typeof snapshot?.revision === 'number' ? snapshot.revision : 0;
    } catch {
      return 0;
    }
  };
  const [revision, setRevision] = useState<number>(readRevision);

  useEffect(() => {
    if (!locale || typeof locale.subscribe !== 'function') return undefined;
    const sync = () => setRevision(readRevision());
    let unsubscribe: (() => void) | void;
    try {
      unsubscribe = locale.subscribe(sync);
    } catch {
      return undefined;
    }
    sync();
    return () => {
      if (typeof unsubscribe === 'function') {
        try {
          unsubscribe();
        } catch {
          // Ignore unsubscribe failures during teardown.
        }
      }
    };
  }, [locale]);

  return revision;
}

/** One localized error message key per machine-readable error code (compile-time complete). */
const ERROR_KEY_BY_CODE = {
  [ERROR_CODES.invalidPackageName]: 'error.invalidPackageName',
  [ERROR_CODES.invalidTargetVersion]: 'error.invalidTargetVersion',
  [ERROR_CODES.officialPlugin]: 'error.officialPlugin',
  [ERROR_CODES.notInstalled]: 'error.notInstalled',
  [ERROR_CODES.profileNotFound]: 'error.profileNotFound',
  [ERROR_CODES.installInProgress]: 'error.installInProgress',
  [ERROR_CODES.jobNotFound]: 'error.jobNotFound',
  [ERROR_CODES.offline]: 'error.offline',
  [ERROR_CODES.rateLimited]: 'error.rateLimited',
  [ERROR_CODES.githubAuth]: 'error.githubAuth',
  [ERROR_CODES.installFailed]: 'error.installFailed',
  [ERROR_CODES.timeout]: 'error.timeout',
  [ERROR_CODES.cancelled]: 'error.cancelled',
  [ERROR_CODES.verificationFailed]: 'error.verificationFailed',
  [ERROR_CODES.rollbackFailed]: 'error.rollbackFailed',
  [ERROR_CODES.unknown]: 'error.unknown'
} satisfies Record<ErrorCode, string>;

function errorMessageKey(errorCode: string | undefined): string | undefined {
  if (!errorCode) return undefined;
  return (ERROR_KEY_BY_CODE as Record<string, string | undefined>)[errorCode];
}

/** Text to show for a failed check/update, preferring the localized error code over the server fallback. */
interface ErrorTextInfo {
  errorCode?: string;
  fallbackText?: string;
  notice?: { key: string; params?: TranslateParams };
}

function localizeErrorInfo(t: Translator, info: ErrorTextInfo | null | undefined): string {
  if (!info) return t('error.unknown');
  const key = errorMessageKey(info.errorCode);
  if (key) return t(key);
  if (info.notice) return t(info.notice.key, info.notice.params);
  if (typeof info.fallbackText === 'string' && info.fallbackText.trim()) return info.fallbackText;
  return t('error.unknown');
}

/** Translate a thrown fetch error into localized text. */
function describeRequestError(error: any): ErrorTextInfo {
  const name = typeof error?.name === 'string' ? error.name : '';
  const message = typeof error?.message === 'string' ? error.message : '';
  if (name === 'AbortError') return { errorCode: ERROR_CODES.timeout };
  const httpMatch = /^HTTP (\d{3})$/.exec(message);
  if (httpMatch) return { notice: { key: 'error.httpStatus', params: { status: httpMatch[1] } } };
  if (message) return { notice: { key: 'error.requestFailedDetail', params: { error: message } } };
  return { errorCode: ERROR_CODES.offline };
}

/** Localize a registry URL using the same labels the backend uses (custom registries included). */
function localizedRegistryLabel(
  t: Translator,
  url: string | undefined,
  customs: CustomRegistry[]
): string | undefined {
  if (typeof url !== 'string' || !url.trim()) return undefined;
  const normalized = normalizeRegistryUrl(url) ?? url;
  if (normalized === OFFICIAL_REGISTRY) return t('registry.official');
  if (normalized === DOMESTIC_REGISTRY) return t('registry.domestic');
  const custom = customs.find(item => normalizeRegistryUrl(item.url) === normalized);
  if (custom && custom.name) return t('registry.customNamed', { name: custom.name });
  try {
    return t('registry.customHost', { host: new URL(normalized).host });
  } catch {
    return normalized;
  }
}

function shortCommit(commit: string | undefined): string {
  if (typeof commit !== 'string') return '';
  return commit.slice(0, 7);
}

/** Localization keys for the job phases emitted by the progress endpoint. */
const PHASE_TEXT_KEY: Record<UpdatePhase, string> = {
  queued: 'phaseQueued',
  resolving: 'phaseResolving',
  downloading: 'phaseDownloading',
  installing: 'phaseInstalling',
  verifying: 'phaseVerifying',
  'rolling-back': 'phaseRollingBack',
  done: 'phaseDone',
  failed: 'phaseFailed',
  cancelled: 'phaseCancelled'
};

/** Accept the agreed `phaseXxx` message keys plus dotted/snake/lower-case spellings from older builds. */
function normalizePhaseAlias(messageKey: string): UpdatePhase | undefined {
  const compact = messageKey
    .trim()
    .toLowerCase()
    .replace(/^progress[._-]/, '')
    .replace(/^phase[._-]/, '')
    .replace(/[^a-z]/g, '');
  switch (compact) {
    case 'queued':
      return 'queued';
    case 'resolving':
      return 'resolving';
    case 'downloading':
      return 'downloading';
    case 'installing':
      return 'installing';
    case 'verifying':
      return 'verifying';
    case 'rollingback':
      return 'rolling-back';
    case 'done':
      return 'done';
    case 'failed':
      return 'failed';
    case 'cancelled':
    case 'canceled':
      return 'cancelled';
    default:
      return undefined;
  }
}

/** Resolve the dictionary key for a phase label, honoring the job's own messageKey when known. */
function resolvePhaseTextKey(messageKey: string | undefined, phase: UpdatePhase | undefined): string {
  if (typeof messageKey === 'string' && messageKey.trim()) {
    const trimmed = messageKey.trim();
    if (Object.prototype.hasOwnProperty.call(zh, trimmed)) return trimmed;
    const aliased = normalizePhaseAlias(trimmed);
    if (aliased) return PHASE_TEXT_KEY[aliased];
  }
  if (phase && Object.prototype.hasOwnProperty.call(PHASE_TEXT_KEY, phase)) return PHASE_TEXT_KEY[phase];
  return 'progress.phaseUnknown';
}

function phaseLabel(t: Translator, messageKey: string | undefined, phase: UpdatePhase | undefined): string {
  const key = resolvePhaseTextKey(messageKey, phase);
  if (key === 'progress.phaseUnknown') return t(key, { phase: phase || messageKey || '' });
  return t(key);
}

// =====================================================================================
// Module-level state: check cache (successful checks only, 60s TTL)
// =====================================================================================

const checkCache = new Map<string, { time: number; result: CheckUpdateResult }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute
const POLL_INTERVAL_MS = 800;
const POLL_TIMEOUT_MS = 8000;
const REQUEST_TIMEOUT_MS = 20000;
// A cold GitHub check can legitimately take multiple paginated/retried metadata calls; the client
// must not abort a check while the server is still within its own retry budget.
const CHECK_TIMEOUT_MS = 45000;
const CANCEL_TIMEOUT_MS = 15000;
/** This plugin's own package name: updating it needs a full DSH restart. */
const SELF_PACKAGE_NAME = 'dsh-plugins-update';

/** Official plugins are updated through DSH's own Update button. Older DSH versions do not pass
 *  `official` to detail slots, so fall back to the official npm scope. */
function isOfficialPackage(pkg: SlotActionProps['subject']['pkg']): boolean {
  if (!pkg) return false;
  if (typeof pkg.official === 'boolean') return pkg.official;
  return typeof pkg.name === 'string' && pkg.name.startsWith('@deepseek-ai/');
}

// Default fallback settings
const DEFAULT_SETTINGS: PluginSettings = {
  registry: 'auto',
  customRegistries: [],
  fallbackToOfficial: true,
  installTimeoutSeconds: 120
};

// =====================================================================================
// Config form state hook
// =====================================================================================

function useConfigFormState(form: any): {
  settings: PluginSettings;
  writable: boolean;
  status: string;
  updateField: (field: keyof PluginSettings, value: any) => Promise<boolean>;
} {
  const [snapshot, setSnapshot] = useState<any>(() => (form?.getSnapshot ? form.getSnapshot() : { status: 'idle' }));

  useEffect(() => {
    if (!form?.subscribe) return undefined;
    const unsub = form.subscribe(() => {
      setSnapshot(form.getSnapshot?.() ?? {});
    });
    setSnapshot(form.getSnapshot?.() ?? {});
    return () => {
      if (typeof unsub === 'function') unsub();
    };
  }, [form]);

  const rawValue = snapshot?.value;
  const settings: PluginSettings = {
    registry: typeof rawValue?.registry === 'string' ? rawValue.registry : DEFAULT_SETTINGS.registry,
    customRegistries: Array.isArray(rawValue?.customRegistries)
      ? rawValue.customRegistries.filter((c: any) => c && typeof c.url === 'string')
      : DEFAULT_SETTINGS.customRegistries,
    fallbackToOfficial:
      typeof rawValue?.fallbackToOfficial === 'boolean'
        ? rawValue.fallbackToOfficial
        : DEFAULT_SETTINGS.fallbackToOfficial,
    installTimeoutSeconds:
      typeof rawValue?.installTimeoutSeconds === 'number'
        ? rawValue.installTimeoutSeconds
        : DEFAULT_SETTINGS.installTimeoutSeconds
  };

  const updateField = useCallback(
    async (field: keyof PluginSettings, value: any): Promise<boolean> => {
      if (!form?.set) return false;
      try {
        const ok = await form.set(field, value);
        return ok !== false;
      } catch (e) {
        console.error('Failed to update config field:', field, e);
        return false;
      }
    },
    [form]
  );

  return {
    settings,
    writable: snapshot?.writable !== false,
    status: snapshot?.status || 'ready',
    updateField
  };
}

// =====================================================================================
// Settings Card Component (Rendered in bundle config slot and available in modal)
// =====================================================================================

interface RegistrySettingsCardProps {
  form?: any;
  onClose?: () => void;
  /** Translator injected by apply(); falls back to the bundled Chinese dictionary. */
  t?: Translator;
  /** DSH locale service, used only to re-render on language switches. */
  locale?: LocaleServiceLike;
}

export const RegistrySettingsCard: React.FC<RegistrySettingsCardProps> = ({
  form,
  onClose,
  t: providedT,
  locale
}) => {
  useLocaleRevision(locale);
  const t = providedT ?? FALLBACK_TRANSLATOR;
  const { settings, writable, updateField } = useConfigFormState(form);

  // Local state for adding a new custom registry
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomUrl, setNewCustomUrl] = useState('');
  const [customErrorKey, setCustomErrorKey] = useState('');
  const [notice, setNotice] = useState<{ key: string; params?: TranslateParams } | null>(null);
  const noticeTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== undefined) clearTimeout(noticeTimerRef.current);
    };
  }, []);

  const showNotice = (key: string, params?: TranslateParams) => {
    setNotice({ key, params });
    if (noticeTimerRef.current !== undefined) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 2500);
  };

  const handleSelectRegistry = async (val: string) => {
    const ok = await updateField('registry', val);
    if (ok) showNotice('settings.notice.registryUpdated');
  };

  const handleToggleFallback = async () => {
    const next = !settings.fallbackToOfficial;
    const ok = await updateField('fallbackToOfficial', next);
    if (ok) showNotice(next ? 'settings.notice.fallbackOn' : 'settings.notice.fallbackOff');
  };

  const handleAddCustom = async () => {
    setCustomErrorKey('');
    const name = newCustomName.trim();
    const normalized = normalizeRegistryUrl(newCustomUrl);
    if (!normalized) {
      setCustomErrorKey('settings.error.invalidUrl');
      return;
    }

    if (
      normalized === OFFICIAL_REGISTRY ||
      normalized === DOMESTIC_REGISTRY ||
      settings.customRegistries.some(c => normalizeRegistryUrl(c.url) === normalized)
    ) {
      setCustomErrorKey('settings.error.duplicate');
      return;
    }

    const nextList: CustomRegistry[] = [...settings.customRegistries, { name, url: normalized }];
    const ok = await updateField('customRegistries', nextList);
    if (ok) {
      await updateField('registry', normalized);
      setNewCustomName('');
      setNewCustomUrl('');
      setIsAddingCustom(false);
      showNotice('settings.notice.customAdded', { name });
    } else {
      setCustomErrorKey('settings.error.saveFailed');
    }
  };

  const handleDeleteCustom = async (urlToDelete: string) => {
    const norm = normalizeRegistryUrl(urlToDelete);
    const nextList = settings.customRegistries.filter(c => normalizeRegistryUrl(c.url) !== norm);
    await updateField('customRegistries', nextList);
    if (normalizeRegistryUrl(settings.registry) === norm) {
      await updateField('registry', 'auto');
    }
    showNotice('settings.notice.customRemoved');
  };

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

  const sectionHeaderStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
    borderBottom: '1px solid var(--dsw-alias-border-l2, #f1f5f9)',
    paddingBottom: '8px'
  };

  const labelStyle: React.CSSProperties = {
    fontWeight: 600,
    fontSize: '13px',
    color: 'var(--dsw-alias-label-primary, #0f172a)'
  };

  const hintStyle: React.CSSProperties = {
    fontSize: '12px',
    color: 'var(--dsw-alias-label-secondary, #64748b)',
    marginTop: '3px'
  };

  const optionItemStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'flex-start',
    padding: '10px 12px',
    borderRadius: '8px',
    border: active
      ? '1.5px solid var(--dsw-alias-primary, #2563eb)'
      : '1px solid var(--dsw-alias-border-l2, #e2e8f0)',
    background: active ? 'rgba(37, 99, 235, 0.04)' : 'var(--dsw-alias-bg-subtle, #f8fafc)',
    marginBottom: '8px',
    cursor: writable ? 'pointer' : 'default',
    transition: 'all 0.15s ease-in-out'
  });

  const btnStyle: React.CSSProperties = {
    padding: '4px 10px',
    fontSize: '12px',
    borderRadius: '6px',
    border: '1px solid var(--dsw-alias-border-l1, #cbd5e1)',
    background: 'var(--dsw-alias-bg-elevated, #ffffff)',
    color: 'var(--dsw-alias-label-primary, #334155)',
    cursor: 'pointer'
  };

  const isCurrent = (val: string) => {
    if (val === 'auto' || val === 'npmjs' || val === 'npmmirror') {
      return settings.registry === val;
    }
    return normalizeRegistryUrl(settings.registry) === normalizeRegistryUrl(val);
  };

  return (
    <div style={cardStyle}>
      <div style={sectionHeaderStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '15px', fontWeight: 600 }}>{t('settings.title')}</span>
          {notice && (
            <span
              style={{
                fontSize: '11px',
                color: '#16a34a',
                background: '#dcfce7',
                padding: '1px 6px',
                borderRadius: '4px'
              }}
            >
              {t(notice.key, notice.params)}
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{ ...btnStyle, padding: '2px 8px', fontSize: '12px' }}
            title={t('settings.closeTitle')}
          >
            {t('settings.close')}
          </button>
        )}
      </div>

      <div style={{ marginBottom: '14px' }}>
        <div style={{ ...hintStyle, marginBottom: '10px' }}>{t('settings.intro')}</div>

        {/* 1. Automatic probing (recommended) */}
        <div style={optionItemStyle(isCurrent('auto'))} onClick={() => writable && handleSelectRegistry('auto')}>
          <input
            type="radio"
            name="dsh-plugin-registry"
            checked={isCurrent('auto')}
            onChange={() => handleSelectRegistry('auto')}
            disabled={!writable}
            style={{ marginRight: '10px', marginTop: '3px' }}
          />
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>
              {t('settings.autoTitle')}
              <span
                style={{
                  marginLeft: 6,
                  fontSize: '11px',
                  color: '#2563eb',
                  background: '#eff6ff',
                  padding: '1px 5px',
                  borderRadius: '3px'
                }}
              >
                {t('settings.autoBadge')}
              </span>
            </div>
            <div style={hintStyle}>{t('settings.autoHint')}</div>
          </div>
        </div>

        {/* 2. npm official registry */}
        <div style={optionItemStyle(isCurrent('npmjs'))} onClick={() => writable && handleSelectRegistry('npmjs')}>
          <input
            type="radio"
            name="dsh-plugin-registry"
            checked={isCurrent('npmjs')}
            onChange={() => handleSelectRegistry('npmjs')}
            disabled={!writable}
            style={{ marginRight: '10px', marginTop: '3px' }}
          />
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>
              {t('settings.npmjsTitle')}
              <span style={{ marginLeft: 6, fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>
                https://registry.npmjs.org/
              </span>
            </div>
            <div style={hintStyle}>{t('settings.npmjsHint')}</div>
          </div>
        </div>

        {/* 3. Domestic mirror npmmirror (same as DSH) */}
        <div
          style={optionItemStyle(isCurrent('npmmirror'))}
          onClick={() => writable && handleSelectRegistry('npmmirror')}
        >
          <input
            type="radio"
            name="dsh-plugin-registry"
            checked={isCurrent('npmmirror')}
            onChange={() => handleSelectRegistry('npmmirror')}
            disabled={!writable}
            style={{ marginRight: '10px', marginTop: '3px' }}
          />
          <div style={{ flex: 1 }}>
            <div style={labelStyle}>
              {t('settings.npmmirrorTitle')}
              <span style={{ marginLeft: 6, fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>
                https://registry.npmmirror.com/
              </span>
            </div>
            <div style={hintStyle}>{t('settings.npmmirrorHint')}</div>
          </div>
        </div>

        {/* 4. User-defined registries */}
        {settings.customRegistries.map(cust => {
          const norm = normalizeRegistryUrl(cust.url) || cust.url;
          const active = isCurrent(norm);
          return (
            <div key={norm} style={optionItemStyle(active)} onClick={() => writable && handleSelectRegistry(norm)}>
              <input
                type="radio"
                name="dsh-plugin-registry"
                checked={active}
                onChange={() => handleSelectRegistry(norm)}
                disabled={!writable}
                style={{ marginRight: '10px', marginTop: '3px' }}
              />
              <div style={{ flex: 1 }}>
                <div style={labelStyle}>
                  {cust.name || t('settings.customFallbackName')}
                  <span style={{ marginLeft: 6, fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>
                    {cust.url}
                  </span>
                </div>
                <div style={hintStyle}>{t('settings.customHint')}</div>
              </div>
              {writable && (
                <button
                  type="button"
                  style={{
                    ...btnStyle,
                    color: '#dc2626',
                    borderColor: '#fca5a5',
                    padding: '2px 6px',
                    fontSize: '11px'
                  }}
                  onClick={e => {
                    e.stopPropagation();
                    handleDeleteCustom(cust.url);
                  }}
                  title={t('settings.deleteTitle')}
                >
                  {t('settings.delete')}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add a custom registry */}
      {writable && (
        <div
          style={{
            marginBottom: '14px',
            padding: '10px 12px',
            background: 'var(--dsw-alias-bg-subtle, #f8fafc)',
            borderRadius: '8px'
          }}
        >
          {!isAddingCustom ? (
            <button
              type="button"
              style={{ ...btnStyle, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              onClick={() => setIsAddingCustom(true)}
            >
              {t('settings.addCustom')}
            </button>
          ) : (
            <div>
              <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '8px' }}>{t('settings.addCustomTitle')}</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder={t('settings.namePlaceholder')}
                  value={newCustomName}
                  onChange={e => setNewCustomName(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--dsw-alias-border-l1, #cbd5e1)',
                    width: '180px'
                  }}
                />
                <input
                  type="text"
                  placeholder={t('settings.urlPlaceholder')}
                  value={newCustomUrl}
                  onChange={e => setNewCustomUrl(e.target.value)}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    borderRadius: '6px',
                    border: '1px solid var(--dsw-alias-border-l1, #cbd5e1)',
                    flex: 1,
                    minWidth: '240px'
                  }}
                />
              </div>
              {customErrorKey && (
                <div style={{ color: '#dc2626', fontSize: '11px', marginBottom: '6px' }}>{t(customErrorKey)}</div>
              )}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  style={{
                    ...btnStyle,
                    background: 'var(--dsw-alias-primary, #2563eb)',
                    color: '#ffffff',
                    borderColor: '#2563eb'
                  }}
                  onClick={handleAddCustom}
                >
                  {t('settings.saveAndUse')}
                </button>
                <button
                  type="button"
                  style={btnStyle}
                  onClick={() => {
                    setIsAddingCustom(false);
                    setCustomErrorKey('');
                  }}
                >
                  {t('settings.cancel')}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Automatic fallback on install failure */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          paddingTop: '8px',
          borderTop: '1px solid var(--dsw-alias-border-l2, #f1f5f9)'
        }}
      >
        <input
          type="checkbox"
          id="fallbackToOfficialCheckbox"
          checked={settings.fallbackToOfficial}
          onChange={handleToggleFallback}
          disabled={!writable}
          style={{ cursor: writable ? 'pointer' : 'default' }}
        />
        <label
          htmlFor="fallbackToOfficialCheckbox"
          style={{
            fontSize: '12px',
            cursor: writable ? 'pointer' : 'default',
            color: 'var(--dsw-alias-label-primary, #1e293b)'
          }}
        >
          {t('settings.fallbackLabel')}
        </label>
      </div>
    </div>
  );
};

// =====================================================================================
// Updater Action Button (Injected into plugin detail actions header)
// =====================================================================================

type UpdaterStatus = 'idle' | 'checking' | 'has_update' | 'up_to_date' | 'updating' | 'success' | 'error';

interface UpdateProgressUi {
  jobId: string;
  phase: UpdatePhase;
  percent?: number;
  logTail?: string;
  messageKey?: string;
  cancelling: boolean;
}

interface UpdateSuccessInfo {
  version?: string;
  commitOnly?: boolean;
  branch?: string;
  installedCommit?: string;
  registryUsed?: string;
  registryLabel?: string;
  fellBack?: boolean;
  selfUpdate?: boolean;
}

interface UpdateFailureInfo extends ErrorTextInfo {
  rollback?: DoUpdateResult['rollback'];
  registryUsed?: string;
  registryLabel?: string;
  fellBack?: boolean;
  output?: string;
  installedCommit?: string;
  cancelled?: boolean;
}

interface UpdaterActionButtonProps extends SlotActionProps {
  form?: any;
  /** Translator injected by apply(); falls back to the bundled Chinese dictionary. */
  t?: Translator;
  /** DSH locale service, used only to re-render on language switches. */
  locale?: LocaleServiceLike;
}

export const UpdaterActionButton: React.FC<UpdaterActionButtonProps> = ({
  subject,
  form,
  t: providedT,
  locale
}) => {
  useLocaleRevision(locale);
  const t = providedT ?? FALLBACK_TRANSLATOR;

  const pkg = subject?.pkg;
  const packageName = typeof pkg?.name === 'string' ? pkg.name : '';
  const clientVersion = pkg?.version || '0.0.0';

  // Only user-installed bundles: official plugins use DSH's own update entry, and uninstalled
  // bundles have nothing to update. Hooks above stay unconditional so the hook order is stable.
  const renderable = subject?.kind === 'bundle' && !!packageName && pkg?.installed !== false && !isOfficialPackage(pkg);

  const { settings: configSettings } = useConfigFormState(form);
  const customRegistries = configSettings.customRegistries;

  const [status, setStatus] = useState<UpdaterStatus>('idle');
  const [checkResult, setCheckResult] = useState<CheckUpdateResult | null>(null);
  const [checkError, setCheckError] = useState<ErrorTextInfo | null>(null);
  const [errorSource, setErrorSource] = useState<'check' | 'update'>('check');
  const [progress, setProgress] = useState<UpdateProgressUi | null>(null);
  const [progressError, setProgressError] = useState<{ key: string; params?: TranslateParams } | null>(null);
  const [successInfo, setSuccessInfo] = useState<UpdateSuccessInfo | null>(null);
  const [failureInfo, setFailureInfo] = useState<UpdateFailureInfo | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);

  const checkingRef = useRef(false);
  const mountedRef = useRef(true);
  const pollTokenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const updateAvailableRef = useRef(false);
  /** What the running job was asked to install: commit-only jobs have no target version. */
  const pendingTargetRef = useRef<{ commitOnly: boolean; version?: string; branch?: string }>({ commitOnly: false });

  const effectiveCurrentVersion = checkResult?.currentVersion || clientVersion;
  const remoteVersion = checkResult?.latestVersion || '';
  const versionChanged = !!remoteVersion && remoteVersion !== effectiveCurrentVersion;
  const commitOnlyUpdate = !!checkResult?.commitAhead && !versionChanged;
  const hasUpdate = status === 'has_update';
  const latestVersion = checkResult?.latestVersion || '';
  // Keep "is an update still available" available to callbacks without re-creating them per render.
  updateAvailableRef.current = !!(checkResult?.hasUpdate || checkResult?.commitAhead);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pollTokenRef.current += 1;
      try {
        abortRef.current?.abort();
      } catch {
        // Ignore abort errors during teardown.
      }
    };
  }, []);

  const stopPolling = useCallback(() => {
    pollTokenRef.current += 1;
    try {
      abortRef.current?.abort();
    } catch {
      // Ignore abort errors.
    }
    abortRef.current = null;
  }, []);

  // ---- Check flow ------------------------------------------------------------------

  const doCheck = useCallback(
    async (force = false) => {
      if (!renderable || checkingRef.current) return;

      if (!force) {
        const cached = checkCache.get(packageName);
        // Never replay a failed check: the button must show the retry state instead of "up to date".
        if (cached && cached.result.ok && Date.now() - cached.time < CACHE_TTL_MS) {
          setCheckResult(cached.result);
          setCheckError(null);
          setSuccessInfo(null);
          setFailureInfo(null);
          setStatus(cached.result.hasUpdate || cached.result.commitAhead ? 'has_update' : 'up_to_date');
          return;
        }
      }

      checkingRef.current = true;
      setStatus('checking');
      setCheckError(null);
      setErrorSource('check');
      setSuccessInfo(null);
      setFailureInfo(null);

      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = setTimeout(() => {
        try {
          controller?.abort();
        } catch {
          // Ignore abort errors.
        }
      }, CHECK_TIMEOUT_MS);
      try {
        const res = await fetch(CHECK_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ packageName, currentVersion: clientVersion }),
          signal: controller?.signal
        });

        const payload = (await res.json().catch(() => null)) as CheckUpdateResult | null;
        if (!payload || typeof payload !== 'object') throw new Error(`HTTP ${res.status}`);
        const data = payload;
        if (!res.ok && data.ok) throw new Error(`HTTP ${res.status}`);
        if (!mountedRef.current) return;

        if (data.ok) {
          checkCache.set(packageName, { time: Date.now(), result: data });
          setCheckResult(data);
          if (data.hasUpdate || data.commitAhead) {
            setStatus('has_update');
          } else {
            setStatus('up_to_date');
          }
        } else {
          setCheckResult(null);
          setStatus('error');
          setErrorSource('check');
          setCheckError({
            errorCode: typeof data.errorCode === 'string' ? data.errorCode : undefined,
            fallbackText: typeof data.error === 'string' ? data.error : undefined
          });
        }
      } catch (error: any) {
        if (!mountedRef.current) return;
        setCheckResult(null);
        setStatus('error');
        setErrorSource('check');
        setCheckError(
          error?.name === 'AbortError'
            ? { notice: { key: 'error.checkTimeout' } }
            : describeRequestError(error)
        );
      } finally {
        clearTimeout(timer);
        checkingRef.current = false;
      }
    },
    [packageName, clientVersion, renderable]
  );

  // Trigger a check when the plugin detail opens (and when the translated cache is bypassed on retry).
  useEffect(() => {
    if (!renderable) return;
    void doCheck();
  }, [packageName, clientVersion, doCheck, renderable]);

  // ---- Final result handling -------------------------------------------------------

  const finishSuccess = useCallback(
    (result: DoUpdateResult | undefined, options?: { suppressVersion?: boolean }) => {
      if (!mountedRef.current) return;
      checkCache.delete(packageName); // Force a fresh check next time
      setStatus('success');
      setProgress(null);
      setProgressError(null);
      setFailureInfo(null);
      setErrorSource('check');
      const pending = pendingTargetRef.current;
      setSuccessInfo({
        version: options?.suppressVersion
          ? undefined
          : result?.targetVersion || (pending.commitOnly ? undefined : pending.version),
        commitOnly: pending.commitOnly,
        branch: pending.branch,
        installedCommit: result?.installedCommit,
        registryUsed: result?.registryUsed,
        registryLabel: result?.registryLabel,
        fellBack: result?.fellBack,
        selfUpdate: result?.selfUpdate
      });
    },
    [packageName]
  );

  const finishFailure = useCallback((info: UpdateFailureInfo) => {
    if (!mountedRef.current) return;
    setProgress(null);
    setProgressError(null);
    setSuccessInfo(null);
    setFailureInfo(info);
  }, []);

  /** Apply a terminal DoUpdateResult (shared by the polling path and the old synchronous API). */
  const finishWithResult = useCallback(
    (result: DoUpdateResult | undefined, fallback: { errorCode?: string; fallbackText?: string; cancelled?: boolean }) => {
      if (result && result.ok) {
        finishSuccess(result);
        return;
      }
      if (fallback.cancelled) {
        setStatus(updateAvailableRef.current ? 'has_update' : 'idle');
        finishFailure({
          errorCode: fallback.errorCode || ERROR_CODES.cancelled,
          cancelled: true,
          rollback: result?.rollback,
          registryUsed: result?.registryUsed,
          registryLabel: result?.registryLabel,
          fellBack: result?.fellBack,
          output: result?.output,
          installedCommit: result?.installedCommit
        });
        return;
      }
      setStatus('error');
      setErrorSource('update');
      finishFailure({
        errorCode: result?.errorCode || fallback.errorCode,
        fallbackText: result?.error || fallback.fallbackText,
        rollback: result?.rollback,
        registryUsed: result?.registryUsed,
        registryLabel: result?.registryLabel,
        fellBack: result?.fellBack,
        output: result?.output,
        installedCommit: result?.installedCommit
      });
    },
    [finishSuccess, finishFailure]
  );

  // ---- Async job polling -----------------------------------------------------------

  const startPolling = useCallback(
    (jobId: string) => {
      const token = ++pollTokenRef.current;
      const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

      const poll = async () => {
        while (mountedRef.current && token === pollTokenRef.current) {
          await sleep(POLL_INTERVAL_MS);
          if (!mountedRef.current || token !== pollTokenRef.current) return;

          const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
          abortRef.current = controller;
          const timer = setTimeout(() => {
            try {
              controller?.abort();
            } catch {
              // Ignore abort errors.
            }
          }, POLL_TIMEOUT_MS);

          let state: UpdateJobState | null = null;
          try {
            const res = await fetch(`${PROGRESS_PATH}?jobId=${encodeURIComponent(jobId)}`, {
              method: 'GET',
              headers: { accept: 'application/json' },
              signal: controller?.signal
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            state = (await res.json()) as UpdateJobState;
          } catch (error: any) {
            clearTimeout(timer);
            if (!mountedRef.current || token !== pollTokenRef.current) return;
            const message = typeof error?.message === 'string' ? error.message : '';
            setProgress(null);
            setProgressError(
              message ? { key: 'progress.pollFailed', params: { error: message } } : { key: 'error.network' }
            );
            setStatus('error');
            setErrorSource('update');
            return;
          }
          clearTimeout(timer);
          if (!mountedRef.current || token !== pollTokenRef.current) return;

          if (!state || typeof state !== 'object') {
            setProgress(null);
            setProgressError({ key: 'error.unknown' });
            setStatus('error');
            setErrorSource('update');
            return;
          }

          const phase = state.phase;
          if (phase === 'done' || phase === 'failed' || phase === 'cancelled') {
            // The job map is in-memory on the backend, so a self-update reload drops the finished
            // job and makes the next progress request answer `job-not-found`. For our own package
            // that only happens after a successful self update: report success, not an error.
            if (
              state.ok === false &&
              state.errorCode === ERROR_CODES.jobNotFound &&
              packageName === SELF_PACKAGE_NAME
            ) {
              finishSuccess(
                { ok: true, packageName, selfUpdate: true },
                { suppressVersion: true }
              );
              return;
            }
            finishWithResult(state.result, {
              errorCode: state.errorCode,
              fallbackText: state.error,
              cancelled: phase === 'cancelled'
            });
            return;
          }

          const nextPercent = typeof state.percent === 'number' && Number.isFinite(state.percent)
            ? Math.max(0, Math.min(100, state.percent))
            : undefined;
          setProgress(prev => ({
            jobId,
            phase: phase || prev?.phase || 'installing',
            percent: nextPercent ?? prev?.percent,
            logTail: typeof state?.logTail === 'string' ? state.logTail : prev?.logTail,
            messageKey: typeof state?.messageKey === 'string' ? state.messageKey : undefined,
            cancelling: prev?.cancelling || false
          }));
        }
      };

      void poll();
    },
    [finishWithResult]
  );

  // ---- Start an update -------------------------------------------------------------

  const handleUpdate = async () => {
    if (status === 'updating') return;

    const targetVersion = versionChanged ? latestVersion : undefined;
    const commitOnly = commitOnlyUpdate;
    const confirmed =
      typeof window === 'undefined' || typeof window.confirm !== 'function'
        ? true
        : window.confirm(
            commitOnly
              ? t('confirm.updateCommit', { packageName })
              : t('confirm.update', { packageName, version: latestVersion || effectiveCurrentVersion })
          );
    if (!confirmed) return;

    stopPolling();
    pendingTargetRef.current = {
      commitOnly,
      version: commitOnly ? undefined : latestVersion || undefined,
      branch: checkResult?.branch
    };
    setStatus('updating');
    setCheckError(null);
    setSuccessInfo(null);
    setFailureInfo(null);
    setProgressError(null);
    setProgress({ jobId: '', phase: 'queued', cancelling: false });

    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      abortRef.current = controller;
      const timer = setTimeout(() => {
        try {
          controller?.abort();
        } catch {
          // Ignore abort errors.
        }
      }, REQUEST_TIMEOUT_MS);

      let payload: any;
      try {
        const body: { packageName: string; targetVersion?: string } = { packageName };
        // A commit-only GitHub update must not pin the tag of the already installed version;
        // the backend installs the default branch head when targetVersion is omitted.
        if (!commitOnly && targetVersion) body.targetVersion = targetVersion;
        const res = await fetch(UPDATE_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: controller?.signal
        });
        if (!res.ok) {
          payload = await res.json().catch(() => null);
          const failure: any = new Error(
            payload && typeof payload.error === 'string' ? payload.error : `HTTP ${res.status}`
          );
          if (payload && typeof payload.errorCode === 'string') failure.errorCode = payload.errorCode;
          throw failure;
        }
        payload = await res.json().catch(() => null);
      } finally {
        clearTimeout(timer);
        if (abortRef.current === controller) abortRef.current = null;
      }
      if (!mountedRef.current) return;

      if (!payload || typeof payload !== 'object') throw new Error('Invalid response');

      if (payload.ok === false) {
        setStatus('error');
        setErrorSource('update');
        setProgress(null);
        finishFailure({
          errorCode: typeof payload.errorCode === 'string' ? payload.errorCode : undefined,
          fallbackText: typeof payload.error === 'string' ? payload.error : undefined
        });
        return;
      }

      const jobId = typeof payload.jobId === 'string' ? payload.jobId : '';
      if (!jobId) {
        // Backward compatibility: an older backend answers the update synchronously.
        finishWithResult(payload as DoUpdateResult, {});
        return;
      }

      setProgress({ jobId, phase: 'queued', cancelling: false });
      startPolling(jobId);
    } catch (error: any) {
      if (!mountedRef.current) return;
      setProgress(null);
      setStatus('error');
      setErrorSource('update');
      const thrownCode = typeof error?.errorCode === 'string' ? error.errorCode : undefined;
      finishFailure(
        thrownCode
          ? {
              errorCode: thrownCode,
              fallbackText: typeof error?.message === 'string' ? error.message : undefined
            }
          : describeRequestError(error)
      );
    }
  };

  // ---- Cancel a running job --------------------------------------------------------

  const handleCancelUpdate = async () => {
    const jobId = progress?.jobId;
    if (!jobId || progress?.cancelling) return;

    setProgress(prev => (prev ? { ...prev, cancelling: true } : prev));
    setProgressError(null);

    try {
      const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = setTimeout(() => {
        try {
          controller?.abort();
        } catch {
          // Ignore abort errors.
        }
      }, CANCEL_TIMEOUT_MS);
      let res: Response;
      try {
        res = await fetch(CANCEL_PATH, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ jobId }),
          signal: controller?.signal
        });
      } finally {
        clearTimeout(timer);
      }
      const payload = (await res.json().catch(() => null)) as any;
      if (!res.ok || (payload && typeof payload === 'object' && payload.ok === false)) {
        const errorCode = payload && typeof payload.errorCode === 'string' ? payload.errorCode : '';
        // Already finished / no longer tracked: a harmless no-op. Polling decides the final state.
        if (errorCode === ERROR_CODES.unknown || errorCode === ERROR_CODES.jobNotFound) return;
        const message =
          payload && typeof payload.error === 'string' ? payload.error : `HTTP ${res.status}`;
        throw new Error(message);
      }
      // Accepted: keep polling until the backend reports the cancelled phase.
    } catch (error: any) {
      if (!mountedRef.current) return;
      setProgress(prev => (prev ? { ...prev, cancelling: false } : prev));
      const message = typeof error?.message === 'string' ? error.message : t('error.network');
      setProgressError({ key: 'progress.cancelFailed', params: { error: message } });
    }
  };

  // ---- Rendering helpers -----------------------------------------------------------

  const shortLatestCommit = shortCommit(checkResult?.latestCommit);
  const shortInstalledCommit = shortCommit(checkResult?.installedCommit);

  const hintParts: string[] = [];
  if (checkResult?.isGithub) {
    if (checkResult.branch) hintParts.push(t('check.branch', { branch: checkResult.branch }));
    if (shortLatestCommit) hintParts.push(t('check.commit', { commit: shortLatestCommit }));
    if (checkResult.tag) hintParts.push(t('check.tag', { tag: checkResult.tag }));
    if (shortInstalledCommit) hintParts.push(t('check.installedCommit', { commit: shortInstalledCommit }));
  }
  const checkHint = hintParts.join(' · ');

  const updateTitle = (() => {
    const lines: string[] = [
      commitOnlyUpdate
        ? t('action.updateCommitTitle')
        : t('action.updateTitle', { version: latestVersion || effectiveCurrentVersion })
    ];
    if (checkResult?.isGithub) {
      if (checkResult.branch) lines.push(t('check.branch', { branch: checkResult.branch }));
      if (shortLatestCommit) lines.push(t('check.commit', { commit: shortLatestCommit }));
      if (shortInstalledCommit) lines.push(t('check.installedCommit', { commit: shortInstalledCommit }));
    }
    if (checkResult?.tag) lines.push(t('check.tag', { tag: checkResult.tag }));
    if (checkResult?.pinAvailable === false) lines.push(t('check.pinUnavailable'));
    return lines.join('\n');
  })();

  // SVG Icons
  const RefreshIcon = () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginRight: 5 }}
    >
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );

  const ArrowUpIcon = () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginRight: 5 }}
    >
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  );

  const CheckIcon = () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ marginRight: 5 }}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  const GearIcon = () => (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );

  // Common button base styling matching DSH theme
  const baseButtonStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '12px',
    lineHeight: '20px',
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'all 0.15s ease-in-out',
    border: '1px solid var(--dsw-alias-border-l1, #e2e8f0)',
    background: 'var(--dsw-alias-bg-elevated, #ffffff)',
    color: 'var(--dsw-alias-label-primary, #1e293b)',
    userSelect: 'none'
  };

  const gearButtonStyle: React.CSSProperties = {
    ...baseButtonStyle,
    padding: '3px 7px',
    marginLeft: '4px',
    marginRight: '6px',
    color: 'var(--dsw-alias-label-secondary, #64748b)'
  };

  const hintLineStyle: React.CSSProperties = {
    fontSize: '11px',
    color: 'var(--dsw-alias-label-secondary, #64748b)',
    marginTop: '2px',
    lineHeight: 1.4,
    maxWidth: '340px',
    whiteSpace: 'normal'
  };

  const panelStyle: React.CSSProperties = {
    marginTop: '6px',
    marginLeft: '0',
    padding: '8px 10px',
    borderRadius: '8px',
    border: '1px solid var(--dsw-alias-border-l2, #e2e8f0)',
    background: 'var(--dsw-alias-bg-subtle, #f8fafc)',
    minWidth: '240px',
    maxWidth: '340px',
    boxSizing: 'border-box',
    fontSize: '12px',
    lineHeight: 1.5
  };

  const progressTrackStyle: React.CSSProperties = {
    marginTop: '6px',
    height: '5px',
    borderRadius: '3px',
    background: 'rgba(37, 99, 235, 0.15)',
    overflow: 'hidden'
  };

  const progressFillStyle = (percent: number): React.CSSProperties => ({
    height: '100%',
    width: `${percent}%`,
    background: 'var(--dsw-alias-primary, #2563eb)',
    transition: 'width 0.2s ease-in-out'
  });

  const logStyle: React.CSSProperties = {
    margin: '6px 0 0',
    padding: '6px 8px',
    maxHeight: '120px',
    overflow: 'auto',
    fontFamily: 'ui-monospace, SFMono-Regular, Consolas, monospace',
    fontSize: '11px',
    lineHeight: 1.45,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    background: 'rgba(15, 23, 42, 0.04)',
    borderRadius: '4px',
    color: 'var(--dsw-alias-label-secondary, #475569)'
  };

  const smallButtonStyle: React.CSSProperties = {
    ...baseButtonStyle,
    padding: '1px 8px',
    fontSize: '11px',
    lineHeight: '17px',
    marginLeft: 'auto'
  };

  const renderMainButton = () => {
    if (status === 'has_update') {
      return (
        <button
          type="button"
          style={{
            ...baseButtonStyle,
            borderColor: 'rgba(234, 88, 12, 0.45)',
            background: 'rgba(254, 243, 199, 0.7)',
            color: '#c2410c',
            boxShadow: '0 1px 2px rgba(234, 88, 12, 0.15)'
          }}
          onClick={handleUpdate}
          title={updateTitle}
        >
          <ArrowUpIcon />
          {commitOnlyUpdate
            ? t('action.updateToCommit')
            : t('action.updateTo', { version: latestVersion || effectiveCurrentVersion })}
        </button>
      );
    }

    if (status === 'updating') {
      return (
        <button
          type="button"
          disabled
          style={{
            ...baseButtonStyle,
            opacity: 0.75,
            cursor: 'wait',
            background: 'var(--dsw-alias-bg-subtle, #f1f5f9)',
            color: 'var(--dsw-alias-label-secondary, #64748b)'
          }}
        >
          <RefreshIcon />
          {t('action.updating')}
        </button>
      );
    }

    if (status === 'checking') {
      return (
        <button
          type="button"
          disabled
          style={{
            ...baseButtonStyle,
            opacity: 0.65,
            cursor: 'wait'
          }}
        >
          <RefreshIcon />
          {t('action.checking')}
        </button>
      );
    }

    if (status === 'success') {
      return (
        <button
          type="button"
          style={{
            ...baseButtonStyle,
            borderColor: 'rgba(22, 163, 74, 0.4)',
            background: 'rgba(220, 252, 231, 0.7)',
            color: '#15803d'
          }}
          onClick={() => doCheck(true)}
          title={t('action.successTitle')}
        >
          <CheckIcon />
          {t('action.success')}
        </button>
      );
    }

    if (status === 'up_to_date') {
      return (
        <button
          type="button"
          style={{
            ...baseButtonStyle,
            color: 'var(--dsw-alias-label-secondary, #64748b)'
          }}
          onClick={() => doCheck(true)}
          title={t('action.upToDateTitle', { version: effectiveCurrentVersion })}
        >
          <CheckIcon />
          {t('action.upToDate')}
        </button>
      );
    }

    if (status === 'error' && errorSource === 'update') {
      const failureText = failureInfo
        ? localizeErrorInfo(t, failureInfo)
        : progressError
          ? t(progressError.key, progressError.params)
          : t('error.unknown');
      return (
        <button
          type="button"
          style={{
            ...baseButtonStyle,
            borderColor: '#fca5a5',
            color: '#b91c1c'
          }}
          onClick={() => (checkResult?.hasUpdate || checkResult?.commitAhead ? handleUpdate() : doCheck(true))}
          title={t('action.updateFailedTitle', { error: failureText })}
        >
          <RefreshIcon />
          {t('action.updateFailedRetry')}
        </button>
      );
    }

    // Idle or check error
    const checkErrorText = checkError ? localizeErrorInfo(t, checkError) : '';
    return (
      <button
        type="button"
        style={{
          ...baseButtonStyle,
          ...(status === 'error' ? { borderColor: '#fca5a5', color: '#b91c1c' } : {})
        }}
        onClick={() => doCheck(true)}
        title={
          status === 'error'
            ? t('action.checkFailedTitle', { error: checkErrorText })
            : t('action.checkTitle')
        }
      >
        <RefreshIcon />
        {status === 'error' ? t('action.checkFailedRetry') : t('action.checkUpdate')}
      </button>
    );
  };

  if (!renderable) return null;

  // Never fall back to the server's Chinese label in the localized UI; only use it when the URL is known.
  const successRegistry =
    localizedRegistryLabel(t, successInfo?.registryUsed, customRegistries) ??
    (successInfo?.registryUsed ? successInfo?.registryLabel : undefined);
  const failureRegistry =
    localizedRegistryLabel(t, failureInfo?.registryUsed, customRegistries) ??
    (failureInfo?.registryUsed ? failureInfo?.registryLabel : undefined);
  const progressPercent = progress?.percent;
  const progressPhaseText = progress
    ? phaseLabel(t, progress.messageKey, progress.phase)
    : t('progress.starting');

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start' }}>
      <div style={{ display: 'inline-flex', alignItems: 'center' }}>
        {renderMainButton()}
        <button
          type="button"
          style={gearButtonStyle}
          onClick={() => setShowSettingsModal(true)}
          title={t('action.gearTitle')}
        >
          <GearIcon />
        </button>

        {/* Settings Modal (pops up anywhere when gear is clicked) */}
        {showSettingsModal && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.45)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backdropFilter: 'blur(2px)'
            }}
            onClick={() => setShowSettingsModal(false)}
          >
            <div
              style={{
                width: '560px',
                maxWidth: '92vw',
                maxHeight: '90vh',
                overflowY: 'auto',
                boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)'
              }}
              onClick={e => e.stopPropagation()}
            >
              <RegistrySettingsCard
                form={form}
                t={t}
                locale={locale}
                onClose={() => setShowSettingsModal(false)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Secondary line: GitHub branch / tag / commit info for a pending update */}
      {hasUpdate && checkHint && <div style={hintLineStyle}>{checkHint}</div>}

      {/* Failed check: compact localized reason under the button */}
      {status === 'error' && errorSource === 'check' && checkError && (
        <div style={{ ...hintLineStyle, color: '#b91c1c' }}>{localizeErrorInfo(t, checkError)}</div>
      )}

      {/* Progress panel for the running install job */}
      {status === 'updating' && (
        <div style={panelStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontWeight: 600, fontSize: '12px' }}>{progressPhaseText}</span>
            {typeof progressPercent === 'number' && (
              <span style={{ fontSize: '11px', color: 'var(--dsw-alias-label-secondary, #64748b)' }}>
                {Math.round(progressPercent)}%
              </span>
            )}
            {progress?.jobId && (
              <button
                type="button"
                style={smallButtonStyle}
                onClick={handleCancelUpdate}
                disabled={progress.cancelling}
              >
                {progress.cancelling ? t('progress.cancelling') : t('progress.cancel')}
              </button>
            )}
          </div>

          {typeof progressPercent === 'number' && (
            <div style={progressTrackStyle}>
              <div style={progressFillStyle(progressPercent)} />
            </div>
          )}

          {progress?.logTail && (
            <details>
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: 'var(--dsw-alias-label-secondary, #64748b)',
                  marginTop: '6px'
                }}
              >
                {t('progress.logTitle')}
              </summary>
              <pre style={logStyle}>{progress.logTail}</pre>
            </details>
          )}

          {progressError && (
            <div style={{ fontSize: '11px', color: '#b91c1c', marginTop: '4px' }}>
              {t(progressError.key, progressError.params)}
            </div>
          )}
        </div>
      )}

      {/* Polling/cancel errors after the progress panel has gone away (or without a failure result) */}
      {progressError && status !== 'updating' && (
        <div style={{ ...hintLineStyle, color: '#b91c1c' }}>{t(progressError.key, progressError.params)}</div>
      )}

      {/* Success result panel */}
      {successInfo && status === 'success' && (
        <div
          style={{
            ...panelStyle,
            borderColor: 'rgba(22, 163, 74, 0.4)',
            background: 'rgba(220, 252, 231, 0.45)'
          }}
        >
          <div style={{ fontWeight: 600, color: '#15803d' }}>
            {t('update.success', { packageName })}
          </div>
          {successInfo.version && <div>{t('update.successVersion', { version: successInfo.version })}</div>}
          {!successInfo.version && successInfo.branch && (
            <div>{t('check.branch', { branch: successInfo.branch })}</div>
          )}
          {!successInfo.version && successInfo.installedCommit && (
            <div>{t('update.installedCommit', { commit: shortCommit(successInfo.installedCommit) })}</div>
          )}
          {successRegistry && (
            <div>
              {t(successInfo.fellBack ? 'update.registryUsedFellBack' : 'update.registryUsed', {
                registry: successRegistry
              })}
            </div>
          )}
          <div style={{ marginTop: '2px' }}>
            {successInfo.selfUpdate ? t('update.selfUpdateRestart') : t('update.reloadHint')}
          </div>
        </div>
      )}

      {/* Failure result panel */}
      {failureInfo && !failureInfo.cancelled && status === 'error' && (
        <div
          style={{
            ...panelStyle,
            borderColor: '#fca5a5',
            background: 'rgba(254, 226, 226, 0.5)'
          }}
        >
          <div style={{ fontWeight: 600, color: '#b91c1c' }}>{t('update.failed')}</div>
          <div>{localizeErrorInfo(t, failureInfo)}</div>
          {failureInfo.rollback === 'restored' && <div>{t('update.rollbackRestored')}</div>}
          {failureInfo.rollback === 'failed' && <div>{t('update.rollbackFailed')}</div>}
          {failureRegistry && (
            <div>
              {t(failureInfo.fellBack ? 'update.registryUsedFellBack' : 'update.registryUsed', {
                registry: failureRegistry
              })}
            </div>
          )}
          {failureInfo.installedCommit && (
            <div>{t('update.installedCommit', { commit: shortCommit(failureInfo.installedCommit) })}</div>
          )}
          {failureInfo.output && (
            <details>
              <summary
                style={{
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: 'var(--dsw-alias-label-secondary, #64748b)',
                  marginTop: '6px'
                }}
              >
                {t('update.outputTitle')}
              </summary>
              <pre style={logStyle}>{failureInfo.output}</pre>
            </details>
          )}
        </div>
      )}

      {/* Cancelled notice: back to the update button, so the user can retry; a failed rollback must stay visible */}
      {failureInfo?.cancelled && status !== 'error' && (
        <div style={{ ...hintLineStyle, color: 'var(--dsw-alias-label-secondary, #64748b)' }}>
          <div>{t('update.cancelled')}</div>
          {failureInfo.rollback === 'failed' && (
            <div style={{ color: '#b91c1c' }}>{t('update.rollbackFailed')}</div>
          )}
          {failureInfo.rollback === 'restored' && <div>{t('update.rollbackRestored')}</div>}
        </div>
      )}
    </div>
  );
};

// =====================================================================================
// DSH Client Plugin apply Entry
// =====================================================================================

export function apply(ctx: any) {
  // DSH locale service: optional (older DSH versions have none) — always access it defensively.
  const locale = getLocaleService(ctx);
  const t = createTranslator(locale);
  registerLocaleDictionaries(ctx, locale);

  let formInstance: any;

  const getForm = () => {
    if (formInstance) return formInstance;
    if (ctx.configForms?.get) {
      formInstance = ctx.configForms.get('dsh-plugins-update');
    }
    return formInstance;
  };

  // 1. Inject UpdaterActionButton into plugins.detail.actions slot
  if (ctx.slots?.inject && ctx.slots?.register) {
    ctx.slots.inject('plugins.detail.actions', () =>
      ctx.slots.register(
        {
          name: 'plugins.detail.actions',
          id: 'dsh-plugins-update.action-button',
          order: -10 // Place before uninstall and enable switch
        },
        (props: SlotActionProps) =>
          React.createElement(UpdaterActionButton, { ...props, form: getForm(), t, locale })
      )
    );

    // 2. Register RegistrySettingsCard into plugins.bundle.config slot for dsh-plugins-update page
    const registerBundleConfig = (f?: any) => {
      ctx.slots.inject('plugins.bundle.config', () =>
        ctx.slots.register(
          {
            name: 'plugins.bundle.config',
            key: 'dsh-plugins-update'
          },
          () => React.createElement(RegistrySettingsCard, { form: f || getForm(), t, locale })
        )
      );
    };

    if (ctx.configForms?.whileServed) {
      ctx.effect(
        () =>
          ctx.configForms.whileServed(['dsh-plugins-update'], () => {
            const form = ctx.configForms.get('dsh-plugins-update');
            formInstance = form;
            registerBundleConfig(form);
          }),
        'dsh-plugins-update: bundle settings card'
      );
    } else {
      registerBundleConfig();
    }
  }
}

export const name = 'dsh-plugins-update';
// `locale` is required: without it the DSH client context never exposes `ctx.locale`, so the UI
// silently stayed on the bundled Chinese dictionary regardless of the DSH language setting.
export const inject = ['slots', 'configForms', 'locale'];
