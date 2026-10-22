import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { CheckUpdateResult, DoUpdateResult, SlotActionProps } from './types.js';

// Cache for check results to avoid repeating requests in short intervals
const checkCache = new Map<string, { time: number; result: CheckUpdateResult }>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

export const UpdaterActionButton: React.FC<SlotActionProps> = ({ subject }) => {
  const pkg = subject?.pkg;
  const packageName = pkg?.name;
  const currentVersion = pkg?.version || '0.0.0';
  const source = pkg?.source;

  const [status, setStatus] = useState<'idle' | 'checking' | 'has_update' | 'up_to_date' | 'updating' | 'success' | 'error'>('idle');
  const [latestVersion, setLatestVersion] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
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
        alert(`🎉 插件「${packageName}」更新成功！\n请刷新当前窗口或重启 DSH 以加载新版本。`);
      } else {
        setStatus('error');
        setErrorMsg(data.error || '更新失败');
        alert(`❌ 插件更新失败：\n${data.error || '未知错误'}\n\n详细输出：\n${data.output || ''}`);
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
    userSelect: 'none',
    marginRight: '6px'
  };

  // Render according to status
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

// DSH client plugin apply entry
export function apply(ctx: any) {
  // Inject UpdaterActionButton into plugins.detail.actions slot
  if (ctx.slots?.inject && ctx.slots?.register) {
    ctx.slots.inject('plugins.detail.actions', () =>
      ctx.slots.register(
        {
          name: 'plugins.detail.actions',
          id: 'dsh-plugins-update.action-button',
          order: -10 // Place before uninstall and enable switch
        },
        (props: SlotActionProps) => React.createElement(UpdaterActionButton, props)
      )
    );
  }
}

export const name = 'dsh-plugins-update';
export const inject = ['slots'];
