import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Button, Modal, Tag } from '@deepseek-ai/dsh-client-ui-primitives';
import {
  CHECK_ALL_PATH,
  CHECK_PATH,
  DOMESTIC_REGISTRY,
  ERROR_CODES,
  LOCALE_NAMESPACE,
  OFFICIAL_REGISTRY,
  UPDATE_PATH,
  normalizeRegistryUrl,
  type CheckAllResult,
  type CheckUpdateResult,
  type CustomRegistry,
  type DoUpdateResult,
  type PluginSettings,
  type SlotActionProps
} from './types.js';
import { en, zh } from './locales.js';

const CHECK_TIMEOUT_MS = 12_000;
const BATCH_CHECK_TIMEOUT_MS = 25_000;
const UPDATE_TIMEOUT_MS = 190_000;
const SELF_PACKAGE_NAME = 'dsh-plugins-update';

const DEFAULT_SETTINGS: PluginSettings = {
  registry: 'npmjs',
  customRegistries: [],
  fallbackToOfficial: true
};

type TranslateParams = Record<string, string | number>;
type Translator = (key: string, params?: TranslateParams) => string;

interface LocaleServiceLike {
  register?: (namespace: string, dictionaries: Record<string, Record<string, string>>) => (() => void) | void;
  bind?: (namespace: string) => Translator;
  getSnapshot?: () => { revision?: number; [key: string]: unknown };
  subscribe?: (listener: () => void) => (() => void) | void;
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

function useLocaleRevision(locale: LocaleServiceLike | undefined): number {
  const readRevision = () => {
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
        } catch {}
      }
    };
  }, [locale]);
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
  [ERROR_CODES.rollbackFailed]: 'error.rollbackFailed'
};

function errorText(t: Translator, errorCode?: string, fallback?: string): string {
  const key = errorCode ? ERROR_KEY_BY_CODE[errorCode] : undefined;
  return key ? t(key) : fallback || t('error.unknown');
}

function isOfficialPackage(pkg: SlotActionProps['subject']['pkg']): boolean {
  return pkg?.official === true || (typeof pkg?.name === 'string' && pkg.name.startsWith('@deepseek-ai/'));
}

function versionGte(installed: string | undefined, target: string | undefined): boolean {
  if (!installed || !target) return false;
  const a = installed.trim().replace(/^[v^~]/, '').split('-')[0].split('.').map(Number);
  const b = target.trim().replace(/^[v^~]/, '').split('-')[0].split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return true;
}

// --- Persistent updatable plugins store & startup batch probe -------------------------

const UPDATABLE_STORAGE_KEY = 'dsh-plugins-update:updatable-v1';
const UPDATED_SESSION_KEY = 'dsh-plugins-update:updated-in-session-v1';

const updatablePlugins = new Map<string, string>();
const updatedInSession = new Map<string, string>();
const updatableListeners = new Set<() => void>();
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

try {
  loadStorageMap(window.sessionStorage, UPDATABLE_STORAGE_KEY, updatablePlugins);
  loadStorageMap(window.localStorage, UPDATABLE_STORAGE_KEY, updatablePlugins);
  loadStorageMap(window.sessionStorage, UPDATED_SESSION_KEY, updatedInSession);
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

function markPluginUpdatable(packageName: string, latestVersion: string): void {
  const name = packageName.trim();
  const ver = latestVersion.trim().replace(/^[v^~]/, '');
  if (!name || !ver || name.startsWith('@deepseek-ai/')) return;
  const alreadyUpdatedTo = updatedInSession.get(name);
  if (alreadyUpdatedTo && versionGte(alreadyUpdatedTo, ver)) return;
  if (updatablePlugins.get(name) === ver) {
    notifyUpdatableChanged();
    return;
  }
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

function runBatchCheck(force = false): void {
  if (!force && hasRunInitialBatchCheck) return;
  hasRunInitialBatchCheck = true;

  if (batchCheckAbortController) {
    if (!force) return;
    batchCheckAbortController.abort();
  }

  const controller = new AbortController();
  batchCheckAbortController = controller;
  const timer = window.setTimeout(() => controller.abort(), BATCH_CHECK_TIMEOUT_MS);

  const knownUpdates: Record<string, string> = {};
  for (const [k, v] of updatablePlugins.entries()) {
    knownUpdates[k] = v;
  }

  fetch(CHECK_ALL_PATH, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ knownUpdates, force }),
    signal: controller.signal
  })
    .then(res => res.json().catch(() => null))
    .then((payload: CheckAllResult | null) => {
      if (batchCheckAbortController !== controller) return;
      if (!payload || typeof payload !== 'object' || payload.ok === false) return;
      if (!payload.updatable || typeof payload.updatable !== 'object') return;

      const nextMap = new Map<string, string>();
      for (const [rawName, rawVer] of Object.entries(payload.updatable)) {
        if (typeof rawName !== 'string' || typeof rawVer !== 'string') continue;
        const name = rawName.trim();
        const ver = rawVer.trim().replace(/^[v^~]/, '');
        if (!name || !ver || name.startsWith('@deepseek-ai/')) continue;
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
      } else {
        persistUpdatablePlugins();
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
      typeof raw?.fallbackToOfficial === 'boolean' ? raw.fallbackToOfficial : DEFAULT_SETTINGS.fallbackToOfficial
  };

  const updateField = useCallback(
    async (field: keyof PluginSettings, value: any): Promise<boolean> => {
      if (!form?.set) return false;
      try {
        return (await form.set(field, value)) !== false;
      } catch {
        return false;
      }
    },
    [form]
  );

  return { settings, writable: snapshot?.writable !== false, updateField };
}

// --- Settings card (the only configuration surface) ----------------------------------

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
  marginTop: '3px'
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
  padding: '3px 8px',
  fontSize: '12px',
  borderRadius: '6px',
  border: '1px solid var(--dsw-alias-border-l1, #cbd5e1)',
  background: 'var(--dsw-alias-bg-elevated, #ffffff)',
  color: 'var(--dsw-alias-label-primary, #334155)',
  cursor: 'pointer'
};

interface RegistrySettingsCardProps {
  form?: any;
  t: Translator;
  locale?: LocaleServiceLike;
}

export const RegistrySettingsCard: React.FC<RegistrySettingsCardProps> = ({ form, t, locale }) => {
  useLocaleRevision(locale);
  const { settings, writable, updateField } = useConfigFormState(form);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [errorKey, setErrorKey] = useState('');
  const [notice, setNotice] = useState<{ key: string; params?: TranslateParams } | null>(null);

  const showNotice = (key: string, params?: TranslateParams) => {
    setNotice({ key, params });
    window.setTimeout(() => setNotice(null), 2500);
  };

  const select = async (value: string) => {
    if (!writable) return;
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
    if (!(await updateField('customRegistries', next))) {
      setErrorKey('settings.error.saveFailed');
      return;
    }
    await updateField('registry', normalized);
    setName('');
    setUrl('');
    setAdding(false);
    showNotice('settings.notice.customAdded');
    runBatchCheck(true);
  };

  const removeCustom = async (target: string) => {
    const normalized = normalizeRegistryUrl(target);
    const next = settings.customRegistries.filter(item => normalizeRegistryUrl(item.url) !== normalized);
    await updateField('customRegistries', next);
    if (normalizeRegistryUrl(settings.registry) === normalized) {
      await updateField('registry', 'npmjs');
      runBatchCheck(true);
    }
    showNotice('settings.notice.customRemoved');
  };

  const isCurrent = (value: string) =>
    value === 'npmjs' || value === 'npmmirror'
      ? settings.registry === value
      : normalizeRegistryUrl(settings.registry) === normalizeRegistryUrl(value);

  return (
    <div style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 15, fontWeight: 600 }}>{t('settings.title')}</span>
        {notice && <span style={{ fontSize: 11, color: '#16a34a' }}>{t(notice.key, notice.params)}</span>}
      </div>
      <div style={{ ...hintStyle, marginBottom: 10 }}>{t('settings.intro')}</div>

      <div style={optionStyle(isCurrent('npmjs'))} onClick={() => void select('npmjs')}>
        <input type="radio" checked={isCurrent('npmjs')} onChange={() => void select('npmjs')} disabled={!writable} style={{ marginRight: 10, marginTop: 3 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{t('settings.npmjs')} <span style={{ fontFamily: 'monospace', fontWeight: 400 }}>{OFFICIAL_REGISTRY}</span></div>
          <div style={hintStyle}>{t('settings.npmjsHint')}</div>
        </div>
      </div>

      <div style={optionStyle(isCurrent('npmmirror'))} onClick={() => void select('npmmirror')}>
        <input type="radio" checked={isCurrent('npmmirror')} onChange={() => void select('npmmirror')} disabled={!writable} style={{ marginRight: 10, marginTop: 3 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600 }}>{t('settings.npmmirror')} <span style={{ fontFamily: 'monospace', fontWeight: 400 }}>{DOMESTIC_REGISTRY}</span></div>
          <div style={hintStyle}>{t('settings.npmmirrorHint')}</div>
        </div>
      </div>

      {settings.customRegistries.map(item => {
        const active = isCurrent(item.url);
        return (
          <div key={item.url} style={optionStyle(active)} onClick={() => void select(item.url)}>
            <input type="radio" checked={active} onChange={() => void select(item.url)} disabled={!writable} style={{ marginRight: 10, marginTop: 3 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600 }}>{item.name || t('settings.customFallbackName')} <span style={{ fontFamily: 'monospace', fontWeight: 400 }}>{item.url}</span></div>
              <div style={hintStyle}>{t('settings.customHint')}</div>
            </div>
            {writable && (
              <button
                type="button"
                style={{ ...smallButtonStyle, color: '#dc2626', borderColor: '#fca5a5' }}
                onClick={event => {
                  event.stopPropagation();
                  void removeCustom(item.url);
                }}
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
        <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={name} onChange={event => setName(event.target.value)} placeholder={t('settings.customNamePlaceholder')} style={{ height: 32, padding: '0 10px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l1, #cbd5e1)' }} />
          <input value={url} onChange={event => setUrl(event.target.value)} placeholder={t('settings.customUrlPlaceholder')} style={{ height: 32, padding: '0 10px', borderRadius: 6, border: '1px solid var(--dsw-alias-border-l1, #cbd5e1)' }} />
          {errorKey && <div style={{ color: '#b91c1c', fontSize: 12 }}>{t(errorKey)}</div>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" style={smallButtonStyle} onClick={() => void addCustom()} disabled={!writable}>{t('settings.saveUse')}</button>
            <button type="button" style={smallButtonStyle} onClick={() => { setAdding(false); setErrorKey(''); }}>{t('settings.cancel')}</button>
          </div>
        </div>
      )}

      <label style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 14, fontSize: 12, color: 'var(--dsw-alias-label-secondary, #64748b)' }}>
        <input
          type="checkbox"
          checked={settings.fallbackToOfficial}
          disabled={!writable}
          onChange={() => void updateField('fallbackToOfficial', !settings.fallbackToOfficial)}
          style={{ marginTop: 2 }}
        />
        {t('settings.fallback')}
      </label>
    </div>
  );
};

// --- Updater action button ------------------------------------------------------------

type Status = 'checking' | 'has_update' | 'up_to_date' | 'updating' | 'success' | 'error';
interface MessageState {
  key: string;
  params?: TranslateParams;
}

interface UpdaterActionButtonProps extends SlotActionProps {
  t: Translator;
  locale?: LocaleServiceLike;
}

export const UpdaterActionButton: React.FC<UpdaterActionButtonProps> = ({ subject, t, locale }) => {
  useLocaleRevision(locale);
  const pkg = subject?.pkg;
  const packageName = typeof pkg?.name === 'string' ? pkg.name : '';
  const clientVersion = pkg?.version || '0.0.0';
  const renderable = subject?.kind === 'bundle' && !!packageName && pkg?.installed !== false && !isOfficialPackage(pkg);

  const [status, setStatus] = useState<Status>('checking');
  const [checkResult, setCheckResult] = useState<CheckUpdateResult | null>(null);
  const [message, setMessage] = useState<MessageState | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const mountedRef = useRef(true);
  const tokenRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const successVersionRef = useRef<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      tokenRef.current += 1;
      abortRef.current?.abort();
    };
  }, []);

  const fetchCheck = useCallback(async (): Promise<CheckUpdateResult | null> => {
    if (!renderable) return null;
    const token = ++tokenRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
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
      const response = await fetch(CHECK_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ packageName, currentVersion: clientVersion }),
        signal: controller.signal
      });
      const payload = (await response.json().catch(() => null)) as CheckUpdateResult | null;
      if (token !== tokenRef.current || !mountedRef.current) return null;
      if (!payload || typeof payload !== 'object') throw new Error(`HTTP ${response.status}`);
      if (payload.ok === false) {
        if (payload.errorCode === ERROR_CODES.notInstalled || payload.errorCode === ERROR_CODES.officialPlugin) {
          clearPluginUpdatable(packageName);
        } else if (payload.errorCode === ERROR_CODES.offline || payload.errorCode === ERROR_CODES.timeout) {
          const fallback = tryFallbackCachedUpdate();
          if (fallback) return fallback;
        }
        setCheckResult(null);
        setStatus('error');
        setMessage({ key: '', params: { text: errorText(t, payload.errorCode, payload.error) } });
        return payload;
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
      setMessage({ key: error?.name === 'AbortError' ? 'check.timeout' : 'check.network' });
      return null;
    } finally {
      window.clearTimeout(timer);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [clientVersion, packageName, renderable, t]);

  useEffect(() => {
    if (!renderable) return;
    if (successVersionRef.current && clientVersion === successVersionRef.current) return;
    void fetchCheck();
  }, [clientVersion, fetchCheck, renderable]);

  const runUpdate = async () => {
    if (!checkResult?.hasUpdate || status === 'updating') return;
    const targetVersion = checkResult.latestVersion;
    const source = checkResult.source;
    setConfirmOpen(false);
    setStatus('updating');
    setMessage(null);

    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), UPDATE_TIMEOUT_MS);
    try {
      const response = await fetch(UPDATE_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ packageName, targetVersion, source }),
        signal: controller.signal
      });
      const payload = (await response.json().catch(() => null)) as DoUpdateResult | null;
      if (!mountedRef.current) return;
      if (!payload || typeof payload !== 'object') throw new Error(`HTTP ${response.status}`);
      if (payload.ok === false) {
        setStatus('error');
        setMessage({ key: '', params: { text: errorText(t, payload.errorCode, payload.error) } });
        return;
      }
      const version = payload.targetVersion || targetVersion || clientVersion;
      successVersionRef.current = version;
      clearPluginUpdatable(packageName, version);
      setStatus('success');
      setMessage({
        key: packageName === SELF_PACKAGE_NAME ? 'update.selfUpdate' : 'update.success',
        params: { version }
      });
    } catch {
      await new Promise(resolve => window.setTimeout(resolve, 1500));
      const checked = await fetchCheck();
      if (checked && versionGte(checked.currentVersion, targetVersion)) {
        const version = checked.currentVersion || targetVersion || clientVersion;
        successVersionRef.current = version;
        clearPluginUpdatable(packageName, version);
        setStatus('success');
        setMessage({
          key: packageName === SELF_PACKAGE_NAME ? 'update.selfUpdate' : 'update.success',
          params: { version }
        });
      } else {
        setStatus('error');
        setMessage({ key: 'update.failed' });
      }
    } finally {
      window.clearTimeout(timer);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };

  if (!renderable) return null;

  const latestVersion = checkResult?.latestVersion || '';
  const buttonLabel =
    status === 'checking'
      ? t('action.checking')
      : status === 'has_update'
        ? t('action.updateTo', { version: latestVersion })
        : status === 'updating'
          ? t('action.updating')
          : status === 'success'
            ? t('action.success')
            : status === 'up_to_date'
              ? t('action.upToDate')
              : t('action.retry');

  const onButtonClick = () => {
    if (status === 'has_update') {
      setConfirmOpen(true);
      return;
    }
    if (status === 'checking' || status === 'updating') return;
    successVersionRef.current = null;
    void fetchCheck();
  };

  // The empty key marks a server-provided fallback string stored in params.text.
  const messageText = message ? (message.key ? t(message.key, message.params) : String(message.params?.text || '')) : '';

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
      <button
        type="button"
        onClick={onButtonClick}
        disabled={status === 'checking' || status === 'updating'}
        style={{
          padding: '6px 14px',
          borderRadius: 6,
          border: '1px solid var(--dsw-alias-border-l1, #cbd5e1)',
          background: status === 'has_update' ? '#2563eb' : 'var(--dsw-alias-bg-elevated, #ffffff)',
          color: status === 'has_update' ? '#fff' : 'var(--dsw-alias-label-primary, #1e293b)',
          cursor: status === 'checking' || status === 'updating' ? 'default' : 'pointer',
          fontWeight: 500,
          fontSize: 13
        }}
      >
        {buttonLabel}
      </button>
      {messageText && (
        <div style={{ fontSize: 12, color: status === 'error' ? '#b91c1c' : '#15803d', maxWidth: 360 }}>{messageText}</div>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title={t('confirm.title')}
        closeLabel={t('confirm.close')}
        description={t('confirm.body', { packageName, version: latestVersion })}
        footer={
          <>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>
              {t('confirm.cancel')}
            </Button>
            <Button variant="primary" onClick={() => void runUpdate()}>
              {t('confirm.ok')}
            </Button>
          </>
        }
      />
    </div>
  );
};

// --- Proactive & persistent update reminders (Sidebar count & Installed list badges) -

const SIDEBAR_BADGE_ATTR = 'data-dsh-updater-sidebar-badge';
const ROW_BADGE_ATTR = 'data-dsh-updater-row-badge';

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

interface UpdateRemindersOverlayProps {
  slots: any;
  t: Translator;
  locale?: LocaleServiceLike;
}

interface RowMountTarget {
  packageName: string;
  latestVersion: string;
  host: HTMLElement;
  card: HTMLLIElement;
}

const UpdateRemindersOverlay: React.FC<UpdateRemindersOverlayProps> = ({ slots, t, locale }) => {
  useLocaleRevision(locale);
  const updatableEntries = useUpdatableSnapshot();

  const [sidebarHost, setSidebarHost] = useState<HTMLElement | null>(null);
  const [rowTargets, setRowTargets] = useState<RowMountTarget[]>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      runBatchCheck(false);
    }, 600);
    return () => window.clearTimeout(timer);
  }, []);

  const syncDomTargets = useCallback(() => {
    try {
      // 1. Sync Sidebar "Plugins" count badge host (Image 4)
      const pluginsBtn = findSidebarPluginsButton(slots);
      if (pluginsBtn) {
        let host = pluginsBtn.querySelector<HTMLElement>(`span[${SIDEBAR_BADGE_ATTR}="true"]`);
        if (!host) {
          host = document.createElement('span');
          host.setAttribute(SIDEBAR_BADGE_ATTR, 'true');
          pluginsBtn.appendChild(host);
        }
        const isCollapsed = pluginsBtn.clientWidth > 0 && pluginsBtn.clientWidth <= 48;
        if (updatablePlugins.size > 0) {
          if (isCollapsed) {
            if (window.getComputedStyle(pluginsBtn).position === 'static') {
              pluginsBtn.style.position = 'relative';
            }
            host.style.cssText =
              'position: absolute; top: 2px; right: 2px; display: inline-flex; align-items: center; pointer-events: none; transform: scale(0.8); transform-origin: top right;';
          } else {
            host.style.cssText =
              'margin-left: auto; display: inline-flex; align-items: center; flex: none; pointer-events: none;';
          }
        } else {
          host.style.cssText = 'display: none;';
        }
        setSidebarHost(prev => (prev === host ? prev : host));
      } else {
        setSidebarHost(prev => (prev === null ? null : null));
      }

      // 2. Sync Installed Plugins list row badges at right-arrow position (Image 3)
      const cards = Array.from(document.querySelectorAll<HTMLLIElement>('li[data-plugin-package]'));
      if (cards.length > 0 && !document.querySelector('[data-plugin-detail]')) {
        const installedSet = new Set<string>();
        for (const card of cards) {
          const name = card.getAttribute('data-plugin-package');
          if (name) installedSet.add(name);
        }
        // If the main installed list is rendered, prune any package that was uninstalled
        if (installedSet.has(SELF_PACKAGE_NAME)) {
          for (const [trackedPkg] of updatablePlugins.entries()) {
            if (!installedSet.has(trackedPkg)) {
              clearPluginUpdatable(trackedPkg);
            }
          }
        }
      }

      const nextRowTargets: RowMountTarget[] = [];
      for (const card of cards) {
        const pkgName = card.getAttribute('data-plugin-package') || '';
        if (!pkgName) continue;
        const latestVersion = updatablePlugins.get(pkgName);
        let host = card.querySelector<HTMLElement>(`span[${ROW_BADGE_ATTR}="${pkgName}"]`);

        if (latestVersion) {
          if (!host) {
            host = document.createElement('span');
            host.setAttribute(ROW_BADGE_ATTR, pkgName);
            host.style.cssText = 'display: inline-flex; align-items: center; flex: none; cursor: pointer;';
            const switchEl = card.querySelector<HTMLElement>('[role="switch"]');
            if (switchEl && switchEl.parentElement) {
              switchEl.parentElement.insertBefore(host, switchEl);
            } else {
              const fallbackEnd = card.firstElementChild?.lastElementChild || card;
              fallbackEnd.insertBefore(host, fallbackEnd.firstChild);
            }
          }
          nextRowTargets.push({
            packageName: pkgName,
            latestVersion,
            host,
            card
          });
        } else if (host) {
          host.remove();
        }
      }

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
    } catch {}
  }, [slots]);

  useEffect(() => {
    syncDomTargets();
  }, [syncDomTargets, updatableEntries]);

  useEffect(() => {
    let rafId = 0;
    const scheduleSync = () => {
      if (rafId) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = 0;
        syncDomTargets();
      });
    };

    const observer = new MutationObserver(mutations => {
      for (const m of mutations) {
        const targetEl = m.target instanceof Element ? m.target : null;
        if (
          targetEl &&
          (targetEl.hasAttribute(SIDEBAR_BADGE_ATTR) ||
            targetEl.hasAttribute(ROW_BADGE_ATTR) ||
            targetEl.closest(`[${SIDEBAR_BADGE_ATTR}], [${ROW_BADGE_ATTR}]`))
        ) {
          continue;
        }
        scheduleSync();
        break;
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    window.addEventListener('resize', scheduleSync);
    syncDomTargets();

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', scheduleSync);
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [syncDomTargets]);

  useEffect(() => {
    return () => {
      document.querySelectorAll(`[${SIDEBAR_BADGE_ATTR}], [${ROW_BADGE_ATTR}]`).forEach(el => el.remove());
    };
  }, []);

  const count = updatableEntries.length;

  return (
    <>
      {sidebarHost &&
        count > 0 &&
        createPortal(
          <span title={t('badge.sidebarTip', { count })} style={{ display: 'inline-flex', alignItems: 'center' }}>
            <Tag tone="info">{String(count)}</Tag>
          </span>,
          sidebarHost
        )}
      {rowTargets.map(({ packageName, latestVersion, host, card }) =>
        createPortal(
          <span
            key={packageName}
            title={`v${latestVersion}`}
            onClick={event => {
              event.stopPropagation();
              const openBtn = card.querySelector<HTMLElement>('button:not([role="switch"])');
              openBtn?.click();
            }}
            style={{ display: 'inline-flex', alignItems: 'center' }}
          >
            <Tag tone="info">{t('badge.updateAvailable')}</Tag>
          </span>,
          host
        )
      )}
    </>
  );
};

// --- Client entry ---------------------------------------------------------------------

export function apply(ctx: any) {
  const locale = getLocaleService(ctx);
  const t = createTranslator(locale);
  registerLocaleDictionaries(ctx, locale);

  let formInstance: any;
  const getForm = () => {
    if (formInstance) return formInstance;
    if (ctx.configForms?.get) formInstance = ctx.configForms.get('dsh-plugins-update');
    return formInstance;
  };

  const slots = ctx.slots;
  if (!slots?.inject || !slots?.register) return;

  slots.inject('shell.overlay', () =>
    slots.register(
      {
        name: 'shell.overlay',
        id: 'dsh-plugins-update.reminders-overlay',
        order: 50
      },
      (props: any) => React.createElement(UpdateRemindersOverlay, { ...props, slots, t, locale })
    )
  );

  ctx.slots.inject('plugins.detail.actions', () =>
    ctx.slots.register(
      {
        name: 'plugins.detail.actions',
        id: 'dsh-plugins-update.action-button',
        order: -10
      },
      (props: SlotActionProps) => React.createElement(UpdaterActionButton, { ...props, t, locale })
    )
  );

  const registerBundleConfig = (form?: any) => {
    ctx.slots.inject('plugins.bundle.config', () =>
      ctx.slots.register(
        {
          name: 'plugins.bundle.config',
          key: 'dsh-plugins-update'
        },
        () => React.createElement(RegistrySettingsCard, { form: form || getForm(), t, locale })
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

export const name = 'dsh-plugins-update';
export const inject = ['slots', 'configForms', 'locale'];
