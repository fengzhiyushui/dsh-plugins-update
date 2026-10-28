/**
 * Locale dictionaries for the dsh-plugins-update client UI.
 *
 * Both dictionaries are registered into the DSH client locale service under
 * `LOCALE_NAMESPACE` (src/types.ts) from `apply()` in src/client.tsx.
 * `en` is typed against `keyof typeof zh`, so a missing or extra English key is
 * a compile-time error: the two locales can never drift apart.
 *
 * Keys are flat and dot-grouped by UI area. `{name}` placeholders are
 * interpolated by the DSH locale runtime (and by the local fallback translator).
 */

const zh = {
  // --- Updater action button -------------------------------------------------------
  'action.checking': '检查中...',
  'action.checkUpdate': '检查更新',
  'action.checkFailedRetry': '检查失败(重试)',
  'action.checkTitle': '检查该插件是否有新版本',
  'action.checkFailedTitle': '检查更新失败: {error}，点击重试',
  'action.upToDate': '已是最新',
  'action.upToDateTitle': '当前已是最新版本 ({version})。点击可重新检查',
  'action.updateTo': '更新至 v{version}',
  'action.updateToCommit': '更新至最新提交',
  'action.updateTitle': '点击更新此插件至最新版本 v{version}',
  'action.updateCommitTitle': '点击更新此插件至最新提交',
  'action.updating': '正在更新...',
  'action.success': '已更新 (待重载)',
  'action.successTitle': '更新成功！点击重新检测',
  'action.updateFailedRetry': '更新失败(重试)',
  'action.updateFailedTitle': '更新失败：{error}，点击重试',
  'action.gearTitle': '设置插件默认更新源 / 自定义源',

  // --- Confirmation dialogs --------------------------------------------------------
  'confirm.update': '确认要将插件「{packageName}」更新至最新版本 v{version} 吗？',
  'confirm.updateCommit': '确认要将插件「{packageName}」更新至最新提交吗？',

  // --- Check result hints (branch / commit / tag / registry) -----------------------
  'check.branch': '分支 {branch}',
  'check.commit': '提交 {commit}',
  'check.tag': '标签 {tag}',
  'check.installedCommit': '当前 {commit}',
  'check.pinUnavailable': '未找到与目标版本对应的 tag，将安装分支最新提交',

  // --- Async job progress ----------------------------------------------------------
  'progress.starting': '正在启动更新任务…',
  'phaseQueued': '排队等待…',
  'phaseResolving': '解析依赖…',
  'phaseDownloading': '下载中…',
  'phaseInstalling': '安装中…',
  'phaseVerifying': '校验安装结果…',
  'phaseRollingBack': '正在回滚…',
  'phaseDone': '完成',
  'phaseFailed': '失败',
  'phaseCancelled': '已取消',
  'progress.phaseUnknown': '处理中（{phase}）…',
  'progress.cancel': '取消更新',
  'progress.cancelling': '正在取消…',
  'progress.cancelFailed': '取消请求失败：{error}',
  'progress.pollFailed': '获取更新进度失败：{error}',
  'progress.logTitle': '安装日志',

  // --- Final update result ---------------------------------------------------------
  'update.success': '🎉 插件「{packageName}」更新成功！',
  'update.successVersion': '已更新至 v{version}',
  'update.registryUsed': '本次更新使用源：{registry}',
  'update.registryUsedFellBack': '本次更新使用源：{registry}（已触发故障自动回退）',
  'update.installedCommit': '已安装提交：{commit}',
  'update.selfUpdateRestart': '本次更新的是本插件自身，请完全退出并重新启动 DSH 以加载新版本（仅刷新窗口可能不够）。',
  'update.reloadHint': '请刷新当前窗口或重启 DSH 以加载新版本。',
  'update.failed': '❌ 插件更新失败',
  'update.rollbackRestored': '安装失败，已自动回滚到更新前的状态。',
  'update.rollbackFailed': '⚠️ 回滚失败，profile 可能处于半更新状态，请手动检查。',
  'update.cancelled': '更新已取消。',
  'update.outputTitle': '详细输出',

  // --- Registry labels (localized from registry URLs) ------------------------------
  'registry.official': 'npm 官方源',
  'registry.domestic': '国内源 npmmirror（DSH 同款）',
  'registry.customNamed': '自定义源「{name}」',
  'registry.customHost': '自定义源 {host}',
  'registry.unknown': '未知源',

  // --- Error codes (one key per entry of ERROR_CODES) ------------------------------
  'error.invalidPackageName': '包名不合法',
  'error.invalidTargetVersion': '目标版本号不合法',
  'error.officialPlugin': '官方插件由 DSH 自带的更新入口管理，请使用插件页右上角的「更新」按钮',
  'error.notInstalled': '该插件未安装到当前 profile，无法更新',
  'error.profileNotFound': '找不到可用的 DSH profile 目录',
  'error.installInProgress': '另一个插件正在更新，请稍后再试',
  'error.jobNotFound': '更新任务已不存在或已过期，请重新检查更新',
  'error.offline': '网络连接异常，无法访问更新源或 GitHub，请检查网络后重试',
  'error.rateLimited': 'GitHub API 请求过于频繁（已触发限流），请稍后重试或配置 GITHUB_TOKEN',
  'error.githubAuth': '无法访问 GitHub 仓库（可能是私有仓库或凭据失效），请配置 GITHUB_TOKEN 后重试',
  'error.installFailed': '安装命令执行失败',
  'error.timeout': '更新超时，已中止安装',
  'error.cancelled': '更新已取消',
  'error.verificationFailed': '安装后校验未通过，版本或提交与预期不一致',
  'error.rollbackFailed': '回滚失败，profile 可能处于半更新状态',
  'error.unknown': '未知错误',
  'error.network': '网络异常，请检查网络后重试',
  'error.httpStatus': '请求失败（HTTP {status}）',
  'error.requestFailedDetail': '更新请求失败：{error}',

  // --- Settings card ---------------------------------------------------------------
  'settings.title': '⚙️ 插件默认更新源配置',
  'settings.close': '✕ 关闭',
  'settings.closeTitle': '关闭设置',
  'settings.intro': '在此设置进行第三方插件更新时默认使用的 npm 仓库源。',
  'settings.autoTitle': '自动模式（智能探测与包完整度检查）',
  'settings.autoBadge': '推荐',
  'settings.autoHint':
    '优先并发 ping 测速。若国内源较快，会自动预检国内源是否包含本次更新及现有全部直接依赖的对应版本；若无缺失则采用国内高速源，若发现版本落后/缺失则无缝切换官方源，彻底避免版本不匹配报错。',
  'settings.npmjsTitle': 'npm 官方源',
  'settings.npmjsHint': '版本发布第一时间即时可用，绝对权威且无镜像同步延迟；国内网络请求可能偶有轻微波动。',
  'settings.npmmirrorTitle': '国内源 npmmirror（与 DSH 客户端自带源一致）',
  'settings.npmmirrorHint':
    '中国大陆地区下载与解析极速。注意：镜像节点为周期同步，小众插件新版本可能存在数小时或数天的同步延迟。本插件不会主动向镜像发起同步请求。',
  'settings.customFallbackName': '自定义源',
  'settings.customHint': '自定义源地址',
  'settings.delete': '删除',
  'settings.deleteTitle': '删除此自定义源',
  'settings.addCustom': '+ 添加自定义更新源',
  'settings.addCustomTitle': '添加自定义源',
  'settings.namePlaceholder': '源备注名称 (如: 腾讯云镜像)',
  'settings.urlPlaceholder': '源 URL 地址 (如: https://mirrors.cloud.tencent.com/npm/)',
  'settings.saveAndUse': '保存并使用',
  'settings.cancel': '取消',
  'settings.fallbackLabel':
    '当国内源或自定义源安装失败（如遇到版本未同步或 404）时，自动改用 npm 官方源重试一次（推荐开启）',
  'settings.notice.registryUpdated': '已更新默认更新源',
  'settings.notice.fallbackOn': '已开启自动回退',
  'settings.notice.fallbackOff': '已关闭自动回退',
  'settings.notice.customAdded': '已添加并切换为「{name}」',
  'settings.notice.customRemoved': '已移除自定义源',
  'settings.error.invalidUrl': '请输入合法的 HTTP/HTTPS 源地址 (例如 https://mirrors.cloud.tencent.com/npm/)',
  'settings.error.duplicate': '该源地址已存在于列表中，无需重复添加',
  'settings.error.saveFailed': '保存自定义源失败'
};

/** English dictionary, checked complete against the Chinese key set at compile time. */
const en: Record<keyof typeof zh, string> = {
  // --- Updater action button -------------------------------------------------------
  'action.checking': 'Checking...',
  'action.checkUpdate': 'Check for updates',
  'action.checkFailedRetry': 'Check failed (retry)',
  'action.checkTitle': 'Check whether this plugin has a newer version',
  'action.checkFailedTitle': 'Update check failed: {error}. Click to retry',
  'action.upToDate': 'Up to date',
  'action.upToDateTitle': 'Already up to date ({version}). Click to check again',
  'action.updateTo': 'Update to v{version}',
  'action.updateToCommit': 'Update to latest commit',
  'action.updateTitle': 'Click to update this plugin to the latest version v{version}',
  'action.updateCommitTitle': 'Click to update this plugin to the latest commit',
  'action.updating': 'Updating...',
  'action.success': 'Updated (reload needed)',
  'action.successTitle': 'Update succeeded! Click to check again',
  'action.updateFailedRetry': 'Update failed (retry)',
  'action.updateFailedTitle': 'Update failed: {error}. Click to retry',
  'action.gearTitle': 'Configure the default update source / custom sources',

  // --- Confirmation dialogs --------------------------------------------------------
  'confirm.update': 'Update plugin "{packageName}" to the latest version v{version}?',
  'confirm.updateCommit': 'Update plugin "{packageName}" to the latest commit?',

  // --- Check result hints (branch / commit / tag / registry) -----------------------
  'check.branch': 'Branch {branch}',
  'check.commit': 'Commit {commit}',
  'check.tag': 'Tag {tag}',
  'check.installedCommit': 'installed {commit}',
  'check.pinUnavailable': 'No tag matches the target version; the branch head will be installed',

  // --- Async job progress ----------------------------------------------------------
  'progress.starting': 'Starting update job…',
  'phaseQueued': 'Queued…',
  'phaseResolving': 'Resolving dependencies…',
  'phaseDownloading': 'Downloading…',
  'phaseInstalling': 'Installing…',
  'phaseVerifying': 'Verifying installation…',
  'phaseRollingBack': 'Rolling back…',
  'phaseDone': 'Done',
  'phaseFailed': 'Failed',
  'phaseCancelled': 'Cancelled',
  'progress.phaseUnknown': 'Working ({phase})…',
  'progress.cancel': 'Cancel update',
  'progress.cancelling': 'Cancelling…',
  'progress.cancelFailed': 'Cancel request failed: {error}',
  'progress.pollFailed': 'Failed to fetch update progress: {error}',
  'progress.logTitle': 'Install log',

  // --- Final update result ---------------------------------------------------------
  'update.success': '🎉 Plugin "{packageName}" updated successfully!',
  'update.successVersion': 'Updated to v{version}',
  'update.registryUsed': 'Registry used: {registry}',
  'update.registryUsedFellBack': 'Registry used: {registry} (automatic fallback triggered)',
  'update.installedCommit': 'Installed commit: {commit}',
  'update.selfUpdateRestart':
    'This update replaced the updater plugin itself. Fully quit and restart DSH to load the new version (refreshing the window may not be enough).',
  'update.reloadHint': 'Refresh the current window or restart DSH to load the new version.',
  'update.failed': '❌ Plugin update failed',
  'update.rollbackRestored': 'The install failed; the previous state was restored automatically.',
  'update.rollbackFailed': '⚠️ Rollback failed; the profile may be partially updated. Please check manually.',
  'update.cancelled': 'Update cancelled.',
  'update.outputTitle': 'Details',

  // --- Registry labels (localized from registry URLs) ------------------------------
  'registry.official': 'npm official registry',
  'registry.domestic': 'npmmirror (DSH mirror)',
  'registry.customNamed': 'Custom registry "{name}"',
  'registry.customHost': 'Custom registry {host}',
  'registry.unknown': 'Unknown registry',

  // --- Error codes (one key per entry of ERROR_CODES) ------------------------------
  'error.invalidPackageName': 'Invalid package name',
  'error.invalidTargetVersion': 'Invalid target version',
  'error.officialPlugin': 'Official plugins are updated through DSH\'s built-in update entry; use the "Update" button at the top-right of the plugin page',
  'error.notInstalled': 'This plugin is not installed in the current profile and cannot be updated',
  'error.profileNotFound': 'No usable DSH profile directory was found',
  'error.installInProgress': 'Another plugin is being updated. Please try again later',
  'error.jobNotFound': 'The update job no longer exists or has expired. Please check for updates again',
  'error.offline': 'Network error: cannot reach the update source or GitHub. Check your connection and retry',
  'error.rateLimited': 'GitHub API rate limit reached. Retry later or configure GITHUB_TOKEN',
  'error.githubAuth': 'Cannot access the GitHub repository (private repository or invalid credentials). Configure GITHUB_TOKEN and retry',
  'error.installFailed': 'The install command failed',
  'error.timeout': 'The update timed out and the install was aborted',
  'error.cancelled': 'The update was cancelled',
  'error.verificationFailed': 'Post-install verification failed: the installed version or commit does not match the expected one',
  'error.rollbackFailed': 'Rollback failed; the profile may be partially updated',
  'error.unknown': 'Unknown error',
  'error.network': 'Network error. Check your connection and retry',
  'error.httpStatus': 'Request failed (HTTP {status})',
  'error.requestFailedDetail': 'Update request failed: {error}',

  // --- Settings card ---------------------------------------------------------------
  'settings.title': '⚙️ Default update source',
  'settings.close': '✕ Close',
  'settings.closeTitle': 'Close settings',
  'settings.intro': 'Choose the npm registry used by default when updating third-party plugins.',
  'settings.autoTitle': 'Automatic (smart probing with completeness check)',
  'settings.autoBadge': 'Recommended',
  'settings.autoHint':
    'Both registries are pinged in parallel. If the domestic mirror is faster, its package set is pre-checked for this update plus every currently installed direct dependency; when nothing is missing the fast mirror is used, otherwise the official registry is selected automatically so version-mismatch errors cannot happen.',
  'settings.npmjsTitle': 'npm official registry',
  'settings.npmjsHint':
    'New releases are available immediately, with no mirror synchronization lag. Requests from mainland China may occasionally be slower.',
  'settings.npmmirrorTitle': 'npmmirror (same source as the DSH client)',
  'settings.npmmirrorHint':
    'Very fast downloads and resolution in mainland China. Note: the mirror syncs periodically, so minor plugins may lag hours or days behind. This plugin never triggers a mirror sync.',
  'settings.customFallbackName': 'Custom registry',
  'settings.customHint': 'Custom registry URL',
  'settings.delete': 'Delete',
  'settings.deleteTitle': 'Delete this custom registry',
  'settings.addCustom': '+ Add custom update source',
  'settings.addCustomTitle': 'Add custom registry',
  'settings.namePlaceholder': 'Registry label (e.g. Tencent Cloud mirror)',
  'settings.urlPlaceholder': 'Registry URL (e.g. https://mirrors.cloud.tencent.com/npm/)',
  'settings.saveAndUse': 'Save and use',
  'settings.cancel': 'Cancel',
  'settings.fallbackLabel':
    'If an install from the domestic mirror or a custom registry fails (e.g. unsynced version or 404), retry once on the official npm registry (recommended)',
  'settings.notice.registryUpdated': 'Default update source updated',
  'settings.notice.fallbackOn': 'Automatic fallback enabled',
  'settings.notice.fallbackOff': 'Automatic fallback disabled',
  'settings.notice.customAdded': 'Added and switched to "{name}"',
  'settings.notice.customRemoved': 'Custom registry removed',
  'settings.error.invalidUrl': 'Enter a valid HTTP/HTTPS registry URL (e.g. https://mirrors.cloud.tencent.com/npm/)',
  'settings.error.duplicate': 'This registry URL is already in the list',
  'settings.error.saveFailed': 'Failed to save the custom registry'
};

export { zh, en };
