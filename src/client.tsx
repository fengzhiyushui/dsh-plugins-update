import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  DOMESTIC_REGISTRY,
  OFFICIAL_REGISTRY,
  normalizeRegistryUrl,
  type CheckUpdateResult,
  type CustomRegistry,
  type DoUpdateResult,
  type PluginSettings,
  type SlotActionProps
} from './types.js';

// Cache for check results to avoid repeating requests in short intervals
const checkCache = new Map<string, { time: number; result: CheckUpdateResult }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

// Default fallback settings
const DEFAULT_SETTINGS: PluginSettings = {
  registry: 'auto',
  customRegistries: [],
  fallbackToOfficial: true
};

// Hook to subscribe to a DSH configForms form controller
function useConfigFormState(form: any): {
  settings: PluginSettings;
  writable: boolean;
  status: string;
  updateField: (field: keyof PluginSettings, value: any) => Promise<boolean>;
} {
  const [snapshot, setSnapshot] = useState<any>(() => (form?.getSnapshot ? form.getSnapshot() : { status: 'idle' }));

  useEffect(() => {
    if (!form?.subscribe) return;
    const unsub = form.subscribe(() => {
      setSnapshot(form.getSnapshot?.() ?? {});
    });
    setSnapshot(form.getSnapshot?.() ?? {});
    return unsub;
  }, [form]);

  const rawValue = snapshot?.value;
  const settings: PluginSettings = {
    registry: typeof rawValue?.registry === 'string' ? rawValue.registry : DEFAULT_SETTINGS.registry,
    customRegistries: Array.isArray(rawValue?.customRegistries)
      ? rawValue.customRegistries.filter((c: any) => c && typeof c.url === 'string')
      : DEFAULT_SETTINGS.customRegistries,
    fallbackToOfficial: typeof rawValue?.fallbackToOfficial === 'boolean'
      ? rawValue.fallbackToOfficial
      : DEFAULT_SETTINGS.fallbackToOfficial
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

export const RegistrySettingsCard: React.FC<{ form?: any; onClose?: () => void }> = ({ form, onClose }) => {
  const { settings, writable, updateField } = useConfigFormState(form);

  // Local state for adding a new custom registry
  const [isAddingCustom, setIsAddingCustom] = useState(false);
  const [newCustomName, setNewCustomName] = useState('');
  const [newCustomUrl, setNewCustomUrl] = useState('');
  const [customError, setCustomError] = useState('');
  const [savingNotice, setSavingNotice] = useState('');

  const showNotice = (msg: string) => {
    setSavingNotice(msg);
    setTimeout(() => setSavingNotice(''), 2500);
  };

  const handleSelectRegistry = async (val: string) => {
    const ok = await updateField('registry', val);
    if (ok) showNotice('已更新默认更新源');
  };

  const handleToggleFallback = async () => {
    const next = !settings.fallbackToOfficial;
    const ok = await updateField('fallbackToOfficial', next);
    if (ok) showNotice(next ? '已开启自动回退' : '已关闭自动回退');
  };

  const handleAddCustom = async () => {
    setCustomError('');
    const name = newCustomName.trim() || '自定义源';
    const normalized = normalizeRegistryUrl(newCustomUrl);
    if (!normalized) {
      setCustomError('请输入合法的 HTTP/HTTPS 源地址 (例如 https://mirrors.cloud.tencent.com/npm/)');
      return;
    }

    if (
      normalized === OFFICIAL_REGISTRY ||
      normalized === DOMESTIC_REGISTRY ||
      settings.customRegistries.some(c => normalizeRegistryUrl(c.url) === normalized)
    ) {
      setCustomError('该源地址已存在于列表中，无需重复添加');
      return;
    }

    const nextList: CustomRegistry[] = [...settings.customRegistries, { name, url: normalized }];
    const ok = await updateField('customRegistries', nextList);
    if (ok) {
      await updateField('registry', normalized);
      setNewCustomName('');
      setNewCustomUrl('');
      setIsAddingCustom(false);
      showNotice(`已添加并切换为「${name}」`);
    } else {
      setCustomError('保存自定义源失败');
    }
  };

  const handleDeleteCustom = async (urlToDelete: string) => {
    const norm = normalizeRegistryUrl(urlToDelete);
    const nextList = settings.customRegistries.filter(c => normalizeRegistryUrl(c.url) !== norm);
    await updateField('customRegistries', nextList);
    if (normalizeRegistryUrl(settings.registry) === norm) {
      await updateField('registry', 'auto');
    }
    showNotice('已移除自定义源');
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
    border: active ? '1.5px solid var(--dsw-alias-primary, #2563eb)' : '1px solid var(--dsw-alias-border-l2, #e2e8f0)',
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
          <span style={{ fontSize: '15px', fontWeight: 600 }}>⚙️ 插件默认更新源配置</span>
          {savingNotice && (
            <span style={{ fontSize: '11px', color: '#16a34a', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>
              {savingNotice}
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            style={{ ...btnStyle, padding: '2px 8px', fontSize: '12px' }}
            title="关闭设置"
          >
            ✕ 关闭
          </button>
        )}
      </div>

      <div style={{ marginBottom: '14px' }}>
        <div style={{ ...hintStyle, marginBottom: '10px' }}>
          在此设置进行第三方插件更新时默认使用的 npm 仓库源。
        </div>

        {/* 1. 自动探测 (推荐) */}
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
              自动模式（智能探测与包完整度检查）
              <span style={{ marginLeft: 6, fontSize: '11px', color: '#2563eb', background: '#eff6ff', padding: '1px 5px', borderRadius: '3px' }}>
                推荐
              </span>
            </div>
            <div style={hintStyle}>
              优先并发 ping 测速。若国内源较快，会自动预检国内源是否包含本次更新及现有全部直接依赖的对应版本；若无缺失则采用国内高速源，若发现版本落后/缺失则无缝切换官方源，彻底避免版本不匹配报错。
            </div>
          </div>
        </div>

        {/* 2. npm 官方源 */}
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
              npm 官方源
              <span style={{ marginLeft: 6, fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>
                https://registry.npmjs.org/
              </span>
            </div>
            <div style={hintStyle}>
              版本发布第一时间即时可用，绝对权威且无镜像同步延迟；国内网络请求可能偶有轻微波动。
            </div>
          </div>
        </div>

        {/* 3. 国内镜像源 npmmirror (DSH 同款) */}
        <div style={optionItemStyle(isCurrent('npmmirror'))} onClick={() => writable && handleSelectRegistry('npmmirror')}>
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
              国内源 npmmirror（与 DSH 客户端自带源一致）
              <span style={{ marginLeft: 6, fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>
                https://registry.npmmirror.com/
              </span>
            </div>
            <div style={hintStyle}>
              中国大陆地区下载与解析极速。注意：镜像节点为周期同步，小众插件新版本可能存在数小时或数天的同步延迟。本插件不会主动向镜像发起同步请求。
            </div>
          </div>
        </div>

        {/* 4. 用户自定义源 */}
        {settings.customRegistries.map((cust) => {
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
                  {cust.name || '自定义源'}
                  <span style={{ marginLeft: 6, fontSize: '11px', color: '#475569', fontFamily: 'monospace' }}>
                    {cust.url}
                  </span>
                </div>
                <div style={hintStyle}>自定义源地址</div>
              </div>
              {writable && (
                <button
                  type="button"
                  style={{ ...btnStyle, color: '#dc2626', borderColor: '#fca5a5', padding: '2px 6px', fontSize: '11px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteCustom(cust.url);
                  }}
                  title="删除此自定义源"
                >
                  删除
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* 添加自定义源区域 */}
      {writable && (
        <div style={{ marginBottom: '14px', padding: '10px 12px', background: 'var(--dsw-alias-bg-subtle, #f8fafc)', borderRadius: '8px' }}>
          {!isAddingCustom ? (
            <button
              type="button"
              style={{ ...btnStyle, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
              onClick={() => setIsAddingCustom(true)}
            >
              <span>+</span> 添加自定义更新源
            </button>
          ) : (
            <div>
              <div style={{ fontWeight: 600, fontSize: '12px', marginBottom: '8px' }}>添加自定义源</div>
              <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', flexWrap: 'wrap' }}>
                <input
                  type="text"
                  placeholder="源备注名称 (如: 腾讯云镜像)"
                  value={newCustomName}
                  onChange={(e) => setNewCustomName(e.target.value)}
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
                  placeholder="源 URL 地址 (如: https://mirrors.cloud.tencent.com/npm/)"
                  value={newCustomUrl}
                  onChange={(e) => setNewCustomUrl(e.target.value)}
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
              {customError && <div style={{ color: '#dc2626', fontSize: '11px', marginBottom: '6px' }}>{customError}</div>}
              <div style={{ display: 'flex', gap: '6px' }}>
                <button
                  type="button"
                  style={{ ...btnStyle, background: 'var(--dsw-alias-primary, #2563eb)', color: '#ffffff', borderColor: '#2563eb' }}
                  onClick={handleAddCustom}
                >
                  保存并使用
                </button>
                <button
                  type="button"
                  style={btnStyle}
                  onClick={() => {
                    setIsAddingCustom(false);
                    setCustomError('');
                  }}
                >
                  取消
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 故障自动回退开关 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--dsw-alias-border-l2, #f1f5f9)' }}>
        <input
          type="checkbox"
          id="fallbackToOfficialCheckbox"
          checked={settings.fallbackToOfficial}
          onChange={handleToggleFallback}
          disabled={!writable}
          style={{ cursor: writable ? 'pointer' : 'default' }}
        />
        <label htmlFor="fallbackToOfficialCheckbox" style={{ fontSize: '12px', cursor: writable ? 'pointer' : 'default', color: 'var(--dsw-alias-label-primary, #1e293b)' }}>
          当国内源或自定义源安装失败（如遇到版本未同步或 404）时，自动改用 npm 官方源重试一次（推荐开启）
        </label>
      </div>
    </div>
  );
};

// =====================================================================================
// Updater Action Button (Injected into plugin detail actions header)
// =====================================================================================

export const UpdaterActionButton: React.FC<SlotActionProps & { form?: any }> = ({ subject, form }) => {
  const pkg = subject?.pkg;
  const packageName = pkg?.name;
  const currentVersion = pkg?.version || '0.0.0';
  const source = pkg?.source;

  const [status, setStatus] = useState<'idle' | 'checking' | 'has_update' | 'up_to_date' | 'updating' | 'success' | 'error'>('idle');
  const [latestVersion, setLatestVersion] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const checkingRef = useRef(false);

  // If this is not a bundle or has no name, do not render
  if (subject?.kind !== 'bundle' || !packageName) {
    return null;
  }

  // Check update logic
  const doCheck = useCallback(async (force = false) => {
    if (checkingRef.current) return;

    if (!force) {
      const cached = checkCache.get(packageName);
      if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
        if (cached.result.hasUpdate) {
          setStatus('has_update');
          setLatestVersion(cached.result.latestVersion || '');
        } else {
          setStatus('up_to_date');
        }
        return;
      }
    }

    checkingRef.current = true;
    setStatus('checking');
    setErrorMsg('');

    try {
      const res = await fetch('/api/dsh-plugins-update/check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageName, currentVersion, source })
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = (await res.json()) as CheckUpdateResult;
      checkCache.set(packageName, { time: Date.now(), result: data });

      if (data.ok) {
        if (data.hasUpdate) {
          setStatus('has_update');
          setLatestVersion(data.latestVersion || '');
        } else {
          setStatus('up_to_date');
          setLatestVersion(data.latestVersion || currentVersion);
        }
      } else {
        setStatus('error');
        setErrorMsg(data.error || '检查失败');
      }
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e?.message || '网络异常');
    } finally {
      checkingRef.current = false;
    }
  }, [packageName, currentVersion, source]);

  // Trigger check when plugin detail opens
  useEffect(() => {
    doCheck();
  }, [packageName, currentVersion, doCheck]);

  // Execute update logic
  const handleUpdate = async () => {
    if (status === 'updating') return;

    const confirmed = window.confirm(`确认要将插件「${packageName}」更新至最新版本 ${latestVersion || ''} 吗？`);
    if (!confirmed) return;

    setStatus('updating');
    setErrorMsg('');

    try {
      const res = await fetch('/api/dsh-plugins-update/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageName, targetVersion: latestVersion, source })
      });

      const data = (await res.json()) as DoUpdateResult;
      if (data.ok) {
        setStatus('success');
        checkCache.delete(packageName); // Clear cache
        const usedMsg = data.registryLabel || data.registryUsed ? `\n（本次更新使用源：${data.registryLabel || data.registryUsed}${data.fellBack ? '，触发故障自动回退' : ''}）` : '';
        alert(`🎉 插件「${packageName}」更新成功！${usedMsg}\n\n请刷新当前窗口或重启 DSH 以加载新版本。`);
      } else {
        setStatus('error');
        setErrorMsg(data.error || '更新失败');
        const usedMsg = data.registryLabel || data.registryUsed ? `使用源：${data.registryLabel || data.registryUsed}\n` : '';
        alert(`❌ 插件更新失败：\n${data.error || '未知错误'}\n${usedMsg}\n详细输出：\n${data.output || ''}`);
      }
    } catch (e: any) {
      setStatus('error');
      setErrorMsg(e?.message || '请求失败');
      alert(`❌ 更新请求出错：${e?.message || '网络连接异常'}`);
    }
  };

  // SVG Icons
  const RefreshIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
      <path d="M3 3v5h5"/>
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
      <path d="M16 16h5v5"/>
    </svg>
  );

  const ArrowUpIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}>
      <path d="M12 19V5"/>
      <path d="m5 12 7-7 7 7"/>
    </svg>
  );

  const CheckIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 5 }}>
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );

  const GearIcon = () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/>
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
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
          title={`点击更新此插件至最新版本 v${latestVersion}`}
        >
          <ArrowUpIcon />
          更新至 v{latestVersion}
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
          正在更新...
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
          检查中...
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
          title="更新成功！点击重新检测"
        >
          <CheckIcon />
          已更新 (待重载)
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
          title={`当前已是最新版本 (${currentVersion})。点击可重新检查`}
        >
          <CheckIcon />
          已是最新
        </button>
      );
    }

    // Idle or Error
    return (
      <button
        type="button"
        style={{
          ...baseButtonStyle,
          ...(status === 'error' ? { borderColor: '#fca5a5', color: '#b91c1c' } : {})
        }}
        onClick={() => doCheck(true)}
        title={errorMsg ? `检查更新失败: ${errorMsg}，点击重试` : '检查该插件是否有新版本'}
      >
        <RefreshIcon />
        {status === 'error' ? '检查失败(重试)' : '检查更新'}
      </button>
    );
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center' }}>
      {renderMainButton()}
      <button
        type="button"
        style={gearButtonStyle}
        onClick={() => setShowSettingsModal(true)}
        title="设置插件默认更新源 / 自定义源"
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
            onClick={(e) => e.stopPropagation()}
          >
            <RegistrySettingsCard form={form} onClose={() => setShowSettingsModal(false)} />
          </div>
        </div>
      )}
    </div>
  );
};

// =====================================================================================
// DSH Client Plugin apply Entry
// =====================================================================================

export function apply(ctx: any) {
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
        (props: SlotActionProps) => React.createElement(UpdaterActionButton, { ...props, form: getForm() })
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
          () => React.createElement(RegistrySettingsCard, { form: f || getForm() })
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
export const inject = ['slots', 'configForms'];
