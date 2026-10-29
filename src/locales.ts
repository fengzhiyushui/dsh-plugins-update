/**
 * Compact zh/en dictionaries for the updater UI.
 * Keys are flat; the client binds them through the DSH locale service.
 */

export const zh = {
  'action.checking': '检查中…',
  'action.checkUpdate': '检查更新',
  'action.upToDate': '已是最新',
  'action.updateTo': '更新至 v{version}',
  'action.updating': '更新中…',
  'action.success': '已更新',
  'action.retry': '重试',
  'action.updateFailed': '更新失败(重试)',

  'confirm.title': '更新插件',
  'confirm.body': '确认将插件「{packageName}」更新至最新版本 v{version} 吗？',
  'confirm.cancel': '取消',
  'confirm.ok': '确认更新',
  'confirm.close': '关闭',

  'settings.title': '插件默认更新源配置',
  'settings.intro': '第三方插件更新时默认使用的 npm 仓库源。',
  'settings.npmjs': 'npm 官方源',
  'settings.npmjsHint': '版本发布后立即可用，无镜像同步延迟。',
  'settings.npmmirror': '国内源 npmmirror',
  'settings.npmmirrorHint': '国内下载更快；镜像同步可能有延迟。',
  'settings.customFallbackName': '自定义源',
  'settings.customHint': '自定义 npm registry。',
  'settings.customNamePlaceholder': '源备注名称（可选）',
  'settings.customUrlPlaceholder': 'https://mirrors.example.com/npm/',
  'settings.addCustom': '+ 添加自定义更新源',
  'settings.saveUse': '保存并使用',
  'settings.cancel': '取消',
  'settings.delete': '删除',
  'settings.fallback': '非官方源安装失败时，自动改用 npm 官方源重试一次',
  'settings.notice.registryUpdated': '已更新默认更新源',
  'settings.notice.customAdded': '已添加并切换自定义源',
  'settings.notice.customRemoved': '已移除自定义源',
  'settings.error.invalidUrl': '请输入合法的 HTTP/HTTPS 源地址',
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
  'error.unknown': '未知错误'
} as const;

export type MessageKey = keyof typeof zh;

export const en: Record<MessageKey, string> = {
  'action.checking': 'Checking…',
  'action.checkUpdate': 'Check for updates',
  'action.upToDate': 'Up to date',
  'action.updateTo': 'Update to v{version}',
  'action.updating': 'Updating…',
  'action.success': 'Updated',
  'action.retry': 'Retry',
  'action.updateFailed': 'Update failed (retry)',

  'confirm.title': 'Update plugin',
  'confirm.body': 'Update plugin "{packageName}" to the latest version v{version}?',
  'confirm.cancel': 'Cancel',
  'confirm.ok': 'Update',
  'confirm.close': 'Close',

  'settings.title': 'Default update registry',
  'settings.intro': 'The npm registry used by default when updating third-party plugins.',
  'settings.npmjs': 'npm official',
  'settings.npmjsHint': 'New releases are available immediately, without mirror sync delay.',
  'settings.npmmirror': 'npmmirror',
  'settings.npmmirrorHint': 'Faster in mainland China; mirror synchronization may lag behind.',
  'settings.customFallbackName': 'Custom registry',
  'settings.customHint': 'Custom npm registry.',
  'settings.customNamePlaceholder': 'Registry label (optional)',
  'settings.customUrlPlaceholder': 'https://mirrors.example.com/npm/',
  'settings.addCustom': '+ Add custom registry',
  'settings.saveUse': 'Save and use',
  'settings.cancel': 'Cancel',
  'settings.delete': 'Delete',
  'settings.fallback': 'Retry once on the npm official registry when a non-official registry fails',
  'settings.notice.registryUpdated': 'Default registry updated',
  'settings.notice.customAdded': 'Custom registry added and selected',
  'settings.notice.customRemoved': 'Custom registry removed',
  'settings.error.invalidUrl': 'Enter a valid HTTP/HTTPS registry URL',
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
  'error.unknown': 'Unknown error'
};
