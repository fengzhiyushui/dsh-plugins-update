/**
 * Compact zh/en dictionaries for the updater UI.
 * Keys are flat; the client binds them through the DSH locale service.
 */

export const zh = {
  'action.checking': '检查中…',
  'action.upToDate': '已是最新',
  'action.fallbackUpdate': '补位更新 (v{version})',
  'action.fastUpdate': '极速更新 (v{version})',
  'action.fastUpdateTip': '仅对目标插件当前版本豁免观察期并安装最新版（子依赖仍保持 24 小时保护）',
  'action.githubUpdate': '更新最新提交 (v{version})',
  'action.updating': '更新中…',
  'action.success': '已更新',
  'action.retry': '重试',

  'badge.updateAvailable': '可更新',
  'badge.conflictDisabled': '冲突已停用',
  'badge.conflictTip': '因与当前 DSH 版本冲突已自动停用',
  'badge.conflictReasonTip': '因与当前 DSH 版本冲突已自动停用：{reason}',
  'badge.sidebarUpdatesOnly': '{updates} 个插件可更新',
  'badge.sidebarConflictsOnly': '{conflicts} 个插件因版本冲突已停用',
  'badge.sidebarBoth': '{conflicts} 个插件因版本冲突已停用，{updates} 个插件可更新',

  'danger.freshRelease.title': '开启 24 小时发布观察期豁免？',
  'danger.freshRelease.body':
    '刚发布不满 24 小时的 npm 版本尚未度过供应链安全观察期（minimumReleaseAge），若上游账号遭劫持或投毒，恶意代码可能尚未被社区发现与下架。开启后将允许探测此类新版本并在 DSH 原生拦截时直接补位安装（底层仅豁免该插件目标版本，不会放开子依赖观察期）。确认开启吗？',
  'danger.unreviewed.title': '开启未经安全审核版本更新？',
  'danger.unreviewed.body':
    '尚未收录至插件市场安全索引的新版本、野生包及 GitHub 浮动分支提交未经人工或自动化安全审计，直接拉取更新存在执行不可信代码的风险。开启后将允许探测并在详情页一键更新此类版本，后续更新时不再重复弹窗确认（未授权 postinstall 构建脚本仍会被拦截）。确认开启吗？',
  'danger.confirmEnable': '已知晓风险，确认开启',
  'danger.cancel': '取消',
  'danger.close': '关闭',

  'settings.title': '插件默认更新源配置',
  'settings.intro': '第三方插件更新时默认使用的 npm 仓库源。',
  'settings.npmjs': 'npm 官方源',
  'settings.npmjsHint': '版本发布后立即可用，无镜像同步延迟。',
  'settings.npmmirror': '国内源 npmmirror',
  'settings.npmmirrorHint': '国内下载更快；镜像同步可能有延迟。',
  'settings.customFallbackName': '自定义源',
  'settings.customHint': '自定义 npm registry。',
  'settings.customNameLabel': '源备注名称（可选）',
  'settings.customNamePlaceholder': '例如：公司内部镜像',
  'settings.customUrlLabel': 'HTTPS 仓库地址',
  'settings.customUrlPlaceholder': 'https://mirrors.example.com/npm/',
  'settings.addCustom': '+ 添加自定义更新源',
  'settings.saveUse': '保存并使用',
  'settings.cancel': '取消',
  'settings.delete': '删除',
  'settings.fallback': '非官方源安装失败时，自动改用 npm 官方源重试一次',
  'settings.fallbackHint': '当镜像源或自定义源连接失败、尚未同步新版本时，自动改用 npm 官方源重试一次。',
  'settings.alwaysShowDetail': '始终在插件详情页显示「极速更新」按钮',
  'settings.alwaysShowDetailHint':
    '关闭时，npm 官方源的常规更新交由 DSH 原生处理；GitHub 插件及镜像/自定义源仍由本插件接管。开启后可在对应安全权限允许时从详情页使用单步直装与策略豁免通道。',
  'settings.securitySectionTitle': '安全与观察期策略',
  'settings.riskEnabledTag': '高风险已开启',
  'settings.allowFreshRelease': '允许探测并更新未满 24 小时发布观察期的版本',
  'settings.allowFreshReleaseHint':
    '默认关闭。开启后将包含发布不满 24 小时的 npm 新版本，并在 DSH 原生更新受观察期拦截时提供补位更新（仅豁免目标插件当前版本，子依赖仍受 24 小时保护）。',
  'settings.allowUnreviewed': '允许探测并更新未经市场安全审核的版本与来源',
  'settings.allowUnreviewedHint':
    '默认关闭，仅放行宿主插件市场索引（未配置时自动参考 awesome-dsh-plugin 精选索引）已收录的精确版本。开启后可探测并更新尚未收录的新版本及 GitHub 浮动分支提交（安装期构建脚本仍默认拦截）。',
  'settings.notice.registryUpdated': '已更新默认更新源',
  'settings.notice.customAdded': '已添加并切换自定义源',
  'settings.notice.customRemoved': '已移除自定义源',
  'settings.error.invalidUrl': '请输入合法安全的 HTTPS 源地址（不支持本地回环或内嵌凭据）',
  'settings.error.duplicate': '该源地址已存在，无需重复添加',
  'settings.error.saveFailed': '保存自定义源失败',

  'update.success': '已更新至 v{version}，请刷新窗口或重启 DSH。',
  'update.selfUpdate': '已更新至 v{version}，请完全退出并重启 DSH。',
  'update.failed': '更新请求失败，请重试',

  'check.timeout': '检查更新超时，请重试',
  'check.network': '网络异常，请检查网络后重试',

  'error.invalidPackageName': '包名不合法',
  'error.invalidTargetVersion': '目标版本号不合法',
  'error.officialPlugin': '官方插件由 DSH 自带的更新入口管理',
  'error.notInstalled': '该插件未安装到当前 profile，无法更新',
  'error.profileNotFound': '找不到可用的 DSH profile 目录',
  'error.installInProgress': '另一个插件正在更新，请稍后再试',
  'error.offline': '网络连接异常，请检查网络后重试',
  'error.installFailed': '安装命令执行失败',
  'error.timeout': '操作超时，请稍后重试',
  'error.verificationFailed': '安装后版本校验未通过',
  'error.rollbackFailed': '回滚失败，profile 可能处于半更新状态',
  'error.freshReleaseBlocked': '该版本未满 24 小时安全观察期，请先在插件设置中开启对应权限',
  'error.unreviewedBlocked': '该版本或来源未经市场安全审核，请先在插件设置中开启对应权限',
  'error.forbidden': '请求安全校验未通过，请刷新页面后重试',
  'error.unknown': '未知错误'
} as const;

export type MessageKey = keyof typeof zh;

export const en: Record<MessageKey, string> = {
  'action.checking': 'Checking…',
  'action.upToDate': 'Up to date',
  'action.fallbackUpdate': 'Update (v{version})',
  'action.fastUpdate': 'Fast Update (v{version})',
  'action.fastUpdateTip':
    'Exempt only the target plugin version from the release age policy (sub-dependencies retain 24h protection)',
  'action.githubUpdate': 'Update to v{version}',
  'action.updating': 'Updating…',
  'action.success': 'Updated',
  'action.retry': 'Retry',

  'badge.updateAvailable': 'Update available',
  'badge.conflictDisabled': 'Disabled (conflict)',
  'badge.conflictTip': 'Auto-disabled due to conflict with current DSH version',
  'badge.conflictReasonTip': 'Auto-disabled due to DSH conflict: {reason}',
  'badge.sidebarUpdatesOnly': '{updates} plugin(s) have updates',
  'badge.sidebarConflictsOnly': '{conflicts} plugin(s) auto-disabled due to conflict',
  'badge.sidebarBoth': '{conflicts} auto-disabled due to conflict, {updates} have updates',

  'danger.freshRelease.title': 'Enable <24h release cooling override?',
  'danger.freshRelease.body':
    'Newly published npm releases (<24 hours) have not completed the minimumReleaseAge cooling window and carry higher supply-chain compromise risk before malicious versions are taken down. Enabling this allows probing <24h versions and installing them when DSH native withholds them (only the target plugin version is exempted; transitive dependencies remain protected). Enable anyway?',
  'danger.unreviewed.title': 'Allow unreviewed plugin updates?',
  'danger.unreviewed.body':
    'Versions not listed in the curated plugin market index and floating GitHub branch commits have not undergone security review and may contain untrusted code. Enabling this allows probing and updating them in one click without further confirmation prompts (unapproved postinstall scripts remain blocked). Enable anyway?',
  'danger.confirmEnable': 'I understand, enable',
  'danger.cancel': 'Cancel',
  'danger.close': 'Close',

  'settings.title': 'Default update registry',
  'settings.intro': 'The npm registry used by default when updating third-party plugins.',
  'settings.npmjs': 'npm official',
  'settings.npmjsHint': 'New releases are available immediately, without mirror sync delay.',
  'settings.npmmirror': 'npmmirror',
  'settings.npmmirrorHint': 'Faster in mainland China; mirror synchronization may lag behind.',
  'settings.customFallbackName': 'Custom registry',
  'settings.customHint': 'Custom npm registry.',
  'settings.customNameLabel': 'Registry label (optional)',
  'settings.customNamePlaceholder': 'e.g. Internal mirror',
  'settings.customUrlLabel': 'HTTPS registry URL',
  'settings.customUrlPlaceholder': 'https://mirrors.example.com/npm/',
  'settings.addCustom': '+ Add custom registry',
  'settings.saveUse': 'Save and use',
  'settings.cancel': 'Cancel',
  'settings.delete': 'Delete',
  'settings.fallback': 'Retry once on the npm official registry when a non-official registry fails',
  'settings.fallbackHint':
    'When a mirror or custom registry fails or lags behind, retry once on the npm official registry.',
  'settings.alwaysShowDetail': 'Always show the Fast Update button on plugin detail pages',
  'settings.alwaysShowDetailHint':
    'When off, standard npm official updates yield to DSH native; GitHub plugins and mirror/custom registries remain handled here. Turn on to expose direct single-step updates whenever permitted by your security toggles.',
  'settings.securitySectionTitle': 'Security & release cooling policy',
  'settings.riskEnabledTag': 'Risk enabled',
  'settings.allowFreshRelease': 'Allow probing and updating npm releases under the 24h cooling period',
  'settings.allowFreshReleaseHint':
    'Off by default. When enabled, probes npm versions published within 24 hours and activates fallback updates when DSH native withholds them (exempts only the target plugin version; sub-dependencies keep 24h protection).',
  'settings.allowUnreviewed': 'Allow probing and updating versions or sources without market security review',
  'settings.allowUnreviewedHint':
    'Off by default; only exact versions listed in configured DSH market indexes (or awesome-dsh-plugin when unconfigured) are offered. Turn on to probe and update unlisted versions and floating GitHub branches (install scripts remain blocked).',
  'settings.notice.registryUpdated': 'Default registry updated',
  'settings.notice.customAdded': 'Custom registry added and selected',
  'settings.notice.customRemoved': 'Custom registry removed',
  'settings.error.invalidUrl': 'Enter a valid HTTPS registry URL (loopback hosts and embedded credentials are not allowed)',
  'settings.error.duplicate': 'This registry URL is already in the list',
  'settings.error.saveFailed': 'Failed to save the custom registry',

  'update.success': 'Updated to v{version}. Refresh the window or restart DSH.',
  'update.selfUpdate': 'Updated to v{version}. Fully quit and restart DSH.',
  'update.failed': 'Update request failed. Please retry.',

  'check.timeout': 'Update check timed out. Please retry.',
  'check.network': 'Network error. Check your connection and retry.',

  'error.invalidPackageName': 'Invalid package name',
  'error.invalidTargetVersion': 'Invalid target version',
  'error.officialPlugin': 'Official plugins are managed by DSH built-in update',
  'error.notInstalled': 'This plugin is not installed in the current profile',
  'error.profileNotFound': 'No usable DSH profile directory was found',
  'error.installInProgress': 'Another plugin is being updated. Please try again later',
  'error.offline': 'Network error. Check your connection and retry',
  'error.installFailed': 'Install command failed',
  'error.timeout': 'Operation timed out. Please retry',
  'error.verificationFailed': 'Post-install version verification failed',
  'error.rollbackFailed': 'Rollback failed; the profile may be partially updated',
  'error.freshReleaseBlocked': 'This release is within the 24h cooling period; enable the setting first',
  'error.unreviewedBlocked': 'This version or source has not passed market review; enable the setting first',
  'error.forbidden': 'Request verification failed. Refresh the page and retry.',
  'error.unknown': 'Unknown error'
};
