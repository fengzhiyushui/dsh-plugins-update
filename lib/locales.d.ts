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
declare const zh: {
    'action.checking': string;
    'action.checkUpdate': string;
    'action.checkFailedRetry': string;
    'action.checkTitle': string;
    'action.checkFailedTitle': string;
    'action.upToDate': string;
    'action.upToDateTitle': string;
    'action.updateTo': string;
    'action.updateToCommit': string;
    'action.updateTitle': string;
    'action.updateCommitTitle': string;
    'action.updating': string;
    'action.success': string;
    'action.successTitle': string;
    'action.updateFailedRetry': string;
    'action.updateFailedTitle': string;
    'action.gearTitle': string;
    'confirm.update': string;
    'confirm.updateCommit': string;
    'check.branch': string;
    'check.commit': string;
    'check.tag': string;
    'check.installedCommit': string;
    'check.pinUnavailable': string;
    'progress.starting': string;
    phaseQueued: string;
    phaseResolving: string;
    phaseDownloading: string;
    phaseInstalling: string;
    phaseVerifying: string;
    phaseRollingBack: string;
    phaseDone: string;
    phaseFailed: string;
    phaseCancelled: string;
    'progress.phaseUnknown': string;
    'progress.cancel': string;
    'progress.cancelling': string;
    'progress.cancelFailed': string;
    'progress.pollFailed': string;
    'progress.logTitle': string;
    'update.success': string;
    'update.successVersion': string;
    'update.registryUsed': string;
    'update.registryUsedFellBack': string;
    'update.installedCommit': string;
    'update.selfUpdateRestart': string;
    'update.reloadHint': string;
    'update.failed': string;
    'update.rollbackRestored': string;
    'update.rollbackFailed': string;
    'update.cancelled': string;
    'update.outputTitle': string;
    'registry.official': string;
    'registry.domestic': string;
    'registry.customNamed': string;
    'registry.customHost': string;
    'registry.unknown': string;
    'error.invalidPackageName': string;
    'error.invalidTargetVersion': string;
    'error.officialPlugin': string;
    'error.notInstalled': string;
    'error.profileNotFound': string;
    'error.installInProgress': string;
    'error.jobNotFound': string;
    'error.offline': string;
    'error.rateLimited': string;
    'error.githubAuth': string;
    'error.installFailed': string;
    'error.timeout': string;
    'error.checkTimeout': string;
    'error.cancelled': string;
    'error.verificationFailed': string;
    'error.rollbackFailed': string;
    'error.unknown': string;
    'error.network': string;
    'error.httpStatus': string;
    'error.requestFailedDetail': string;
    'settings.title': string;
    'settings.close': string;
    'settings.closeTitle': string;
    'settings.intro': string;
    'settings.autoTitle': string;
    'settings.autoBadge': string;
    'settings.autoHint': string;
    'settings.npmjsTitle': string;
    'settings.npmjsHint': string;
    'settings.npmmirrorTitle': string;
    'settings.npmmirrorHint': string;
    'settings.customFallbackName': string;
    'settings.customHint': string;
    'settings.delete': string;
    'settings.deleteTitle': string;
    'settings.addCustom': string;
    'settings.addCustomTitle': string;
    'settings.namePlaceholder': string;
    'settings.urlPlaceholder': string;
    'settings.saveAndUse': string;
    'settings.cancel': string;
    'settings.fallbackLabel': string;
    'settings.notice.registryUpdated': string;
    'settings.notice.fallbackOn': string;
    'settings.notice.fallbackOff': string;
    'settings.notice.customAdded': string;
    'settings.notice.customRemoved': string;
    'settings.error.invalidUrl': string;
    'settings.error.duplicate': string;
    'settings.error.saveFailed': string;
};
/** English dictionary, checked complete against the Chinese key set at compile time. */
declare const en: Record<keyof typeof zh, string>;
export { zh, en };
