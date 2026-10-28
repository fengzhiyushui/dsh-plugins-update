/**
 * dsh-plugins-update v0.1.4
 * One-click updater for third-party plugins in DeepSeek Harness.
 */
window.__ModuleLoader__.load({
  id: "dsh-plugins-update",
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client.tsx
var client_exports = {};
__export(client_exports, {
  RegistrySettingsCard: () => RegistrySettingsCard,
  UpdaterActionButton: () => UpdaterActionButton,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var import_react = __toESM(require("react"), 1);

// src/types.ts
var OFFICIAL_REGISTRY = "https://registry.npmjs.org/";
var DOMESTIC_REGISTRY = "https://registry.npmmirror.com/";
var LOCALE_NAMESPACE = "dsh-plugins-update";
var CHECK_PATH = "/api/dsh-plugins-update/check";
var UPDATE_PATH = "/api/dsh-plugins-update/update";
var PROGRESS_PATH = "/api/dsh-plugins-update/progress";
var CANCEL_PATH = "/api/dsh-plugins-update/cancel";
var ERROR_CODES = {
  invalidPackageName: "invalid-package-name",
  invalidTargetVersion: "invalid-target-version",
  officialPlugin: "official-plugin",
  notInstalled: "not-installed",
  profileNotFound: "profile-not-found",
  installInProgress: "install-in-progress",
  jobNotFound: "job-not-found",
  offline: "offline",
  rateLimited: "rate-limited",
  githubAuth: "github-auth",
  installFailed: "install-failed",
  timeout: "timeout",
  cancelled: "cancelled",
  verificationFailed: "verification-failed",
  rollbackFailed: "rollback-failed",
  unknown: "unknown"
};
function normalizeRegistryUrl(url) {
  if (typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (!parsed.pathname.endsWith("/")) parsed.pathname += "/";
  parsed.hash = "";
  parsed.search = "";
  return parsed.href;
}

// src/locales.ts
var zh = {
  // --- Updater action button -------------------------------------------------------
  "action.checking": "\u68C0\u67E5\u4E2D...",
  "action.checkUpdate": "\u68C0\u67E5\u66F4\u65B0",
  "action.checkFailedRetry": "\u68C0\u67E5\u5931\u8D25(\u91CD\u8BD5)",
  "action.checkTitle": "\u68C0\u67E5\u8BE5\u63D2\u4EF6\u662F\u5426\u6709\u65B0\u7248\u672C",
  "action.checkFailedTitle": "\u68C0\u67E5\u66F4\u65B0\u5931\u8D25: {error}\uFF0C\u70B9\u51FB\u91CD\u8BD5",
  "action.upToDate": "\u5DF2\u662F\u6700\u65B0",
  "action.upToDateTitle": "\u5F53\u524D\u5DF2\u662F\u6700\u65B0\u7248\u672C ({version})\u3002\u70B9\u51FB\u53EF\u91CD\u65B0\u68C0\u67E5",
  "action.updateTo": "\u66F4\u65B0\u81F3 v{version}",
  "action.updateToCommit": "\u66F4\u65B0\u81F3\u6700\u65B0\u63D0\u4EA4",
  "action.updateTitle": "\u70B9\u51FB\u66F4\u65B0\u6B64\u63D2\u4EF6\u81F3\u6700\u65B0\u7248\u672C v{version}",
  "action.updateCommitTitle": "\u70B9\u51FB\u66F4\u65B0\u6B64\u63D2\u4EF6\u81F3\u6700\u65B0\u63D0\u4EA4",
  "action.updating": "\u6B63\u5728\u66F4\u65B0...",
  "action.success": "\u5DF2\u66F4\u65B0 (\u5F85\u91CD\u8F7D)",
  "action.successTitle": "\u66F4\u65B0\u6210\u529F\uFF01\u70B9\u51FB\u91CD\u65B0\u68C0\u6D4B",
  "action.updateFailedRetry": "\u66F4\u65B0\u5931\u8D25(\u91CD\u8BD5)",
  "action.updateFailedTitle": "\u66F4\u65B0\u5931\u8D25\uFF1A{error}\uFF0C\u70B9\u51FB\u91CD\u8BD5",
  "action.gearTitle": "\u8BBE\u7F6E\u63D2\u4EF6\u9ED8\u8BA4\u66F4\u65B0\u6E90 / \u81EA\u5B9A\u4E49\u6E90",
  // --- Confirmation dialogs --------------------------------------------------------
  "confirm.update": "\u786E\u8BA4\u8981\u5C06\u63D2\u4EF6\u300C{packageName}\u300D\u66F4\u65B0\u81F3\u6700\u65B0\u7248\u672C v{version} \u5417\uFF1F",
  "confirm.updateCommit": "\u786E\u8BA4\u8981\u5C06\u63D2\u4EF6\u300C{packageName}\u300D\u66F4\u65B0\u81F3\u6700\u65B0\u63D0\u4EA4\u5417\uFF1F",
  // --- Check result hints (branch / commit / tag / registry) -----------------------
  "check.branch": "\u5206\u652F {branch}",
  "check.commit": "\u63D0\u4EA4 {commit}",
  "check.tag": "\u6807\u7B7E {tag}",
  "check.installedCommit": "\u5F53\u524D {commit}",
  "check.pinUnavailable": "\u672A\u627E\u5230\u4E0E\u76EE\u6807\u7248\u672C\u5BF9\u5E94\u7684 tag\uFF0C\u5C06\u5B89\u88C5\u5206\u652F\u6700\u65B0\u63D0\u4EA4",
  // --- Async job progress ----------------------------------------------------------
  "progress.starting": "\u6B63\u5728\u542F\u52A8\u66F4\u65B0\u4EFB\u52A1\u2026",
  "phaseQueued": "\u6392\u961F\u7B49\u5F85\u2026",
  "phaseResolving": "\u89E3\u6790\u4F9D\u8D56\u2026",
  "phaseDownloading": "\u4E0B\u8F7D\u4E2D\u2026",
  "phaseInstalling": "\u5B89\u88C5\u4E2D\u2026",
  "phaseVerifying": "\u6821\u9A8C\u5B89\u88C5\u7ED3\u679C\u2026",
  "phaseRollingBack": "\u6B63\u5728\u56DE\u6EDA\u2026",
  "phaseDone": "\u5B8C\u6210",
  "phaseFailed": "\u5931\u8D25",
  "phaseCancelled": "\u5DF2\u53D6\u6D88",
  "progress.phaseUnknown": "\u5904\u7406\u4E2D\uFF08{phase}\uFF09\u2026",
  "progress.cancel": "\u53D6\u6D88\u66F4\u65B0",
  "progress.cancelling": "\u6B63\u5728\u53D6\u6D88\u2026",
  "progress.cancelFailed": "\u53D6\u6D88\u8BF7\u6C42\u5931\u8D25\uFF1A{error}",
  "progress.pollFailed": "\u83B7\u53D6\u66F4\u65B0\u8FDB\u5EA6\u5931\u8D25\uFF1A{error}",
  "progress.logTitle": "\u5B89\u88C5\u65E5\u5FD7",
  // --- Final update result ---------------------------------------------------------
  "update.success": "\u{1F389} \u63D2\u4EF6\u300C{packageName}\u300D\u66F4\u65B0\u6210\u529F\uFF01",
  "update.successVersion": "\u5DF2\u66F4\u65B0\u81F3 v{version}",
  "update.registryUsed": "\u672C\u6B21\u66F4\u65B0\u4F7F\u7528\u6E90\uFF1A{registry}",
  "update.registryUsedFellBack": "\u672C\u6B21\u66F4\u65B0\u4F7F\u7528\u6E90\uFF1A{registry}\uFF08\u5DF2\u89E6\u53D1\u6545\u969C\u81EA\u52A8\u56DE\u9000\uFF09",
  "update.installedCommit": "\u5DF2\u5B89\u88C5\u63D0\u4EA4\uFF1A{commit}",
  "update.selfUpdateRestart": "\u672C\u6B21\u66F4\u65B0\u7684\u662F\u672C\u63D2\u4EF6\u81EA\u8EAB\uFF0C\u8BF7\u5B8C\u5168\u9000\u51FA\u5E76\u91CD\u65B0\u542F\u52A8 DSH \u4EE5\u52A0\u8F7D\u65B0\u7248\u672C\uFF08\u4EC5\u5237\u65B0\u7A97\u53E3\u53EF\u80FD\u4E0D\u591F\uFF09\u3002",
  "update.reloadHint": "\u8BF7\u5237\u65B0\u5F53\u524D\u7A97\u53E3\u6216\u91CD\u542F DSH \u4EE5\u52A0\u8F7D\u65B0\u7248\u672C\u3002",
  "update.failed": "\u274C \u63D2\u4EF6\u66F4\u65B0\u5931\u8D25",
  "update.rollbackRestored": "\u5B89\u88C5\u5931\u8D25\uFF0C\u5DF2\u81EA\u52A8\u56DE\u6EDA\u5230\u66F4\u65B0\u524D\u7684\u72B6\u6001\u3002",
  "update.rollbackFailed": "\u26A0\uFE0F \u56DE\u6EDA\u5931\u8D25\uFF0Cprofile \u53EF\u80FD\u5904\u4E8E\u534A\u66F4\u65B0\u72B6\u6001\uFF0C\u8BF7\u624B\u52A8\u68C0\u67E5\u3002",
  "update.cancelled": "\u66F4\u65B0\u5DF2\u53D6\u6D88\u3002",
  "update.outputTitle": "\u8BE6\u7EC6\u8F93\u51FA",
  // --- Registry labels (localized from registry URLs) ------------------------------
  "registry.official": "npm \u5B98\u65B9\u6E90",
  "registry.domestic": "\u56FD\u5185\u6E90 npmmirror\uFF08DSH \u540C\u6B3E\uFF09",
  "registry.customNamed": "\u81EA\u5B9A\u4E49\u6E90\u300C{name}\u300D",
  "registry.customHost": "\u81EA\u5B9A\u4E49\u6E90 {host}",
  "registry.unknown": "\u672A\u77E5\u6E90",
  // --- Error codes (one key per entry of ERROR_CODES) ------------------------------
  "error.invalidPackageName": "\u5305\u540D\u4E0D\u5408\u6CD5",
  "error.invalidTargetVersion": "\u76EE\u6807\u7248\u672C\u53F7\u4E0D\u5408\u6CD5",
  "error.officialPlugin": "\u5B98\u65B9\u63D2\u4EF6\u7531 DSH \u81EA\u5E26\u7684\u66F4\u65B0\u5165\u53E3\u7BA1\u7406\uFF0C\u8BF7\u4F7F\u7528\u63D2\u4EF6\u9875\u53F3\u4E0A\u89D2\u7684\u300C\u66F4\u65B0\u300D\u6309\u94AE",
  "error.notInstalled": "\u8BE5\u63D2\u4EF6\u672A\u5B89\u88C5\u5230\u5F53\u524D profile\uFF0C\u65E0\u6CD5\u66F4\u65B0",
  "error.profileNotFound": "\u627E\u4E0D\u5230\u53EF\u7528\u7684 DSH profile \u76EE\u5F55",
  "error.installInProgress": "\u53E6\u4E00\u4E2A\u63D2\u4EF6\u6B63\u5728\u66F4\u65B0\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5",
  "error.jobNotFound": "\u66F4\u65B0\u4EFB\u52A1\u5DF2\u4E0D\u5B58\u5728\u6216\u5DF2\u8FC7\u671F\uFF0C\u8BF7\u91CD\u65B0\u68C0\u67E5\u66F4\u65B0",
  "error.offline": "\u7F51\u7EDC\u8FDE\u63A5\u5F02\u5E38\uFF0C\u65E0\u6CD5\u8BBF\u95EE\u66F4\u65B0\u6E90\u6216 GitHub\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5",
  "error.rateLimited": "GitHub API \u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF08\u5DF2\u89E6\u53D1\u9650\u6D41\uFF09\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u6216\u914D\u7F6E GITHUB_TOKEN",
  "error.githubAuth": "\u65E0\u6CD5\u8BBF\u95EE GitHub \u4ED3\u5E93\uFF08\u53EF\u80FD\u662F\u79C1\u6709\u4ED3\u5E93\u6216\u51ED\u636E\u5931\u6548\uFF09\uFF0C\u8BF7\u914D\u7F6E GITHUB_TOKEN \u540E\u91CD\u8BD5",
  "error.installFailed": "\u5B89\u88C5\u547D\u4EE4\u6267\u884C\u5931\u8D25",
  "error.timeout": "\u66F4\u65B0\u8D85\u65F6\uFF0C\u5DF2\u4E2D\u6B62\u5B89\u88C5",
  "error.cancelled": "\u66F4\u65B0\u5DF2\u53D6\u6D88",
  "error.verificationFailed": "\u5B89\u88C5\u540E\u6821\u9A8C\u672A\u901A\u8FC7\uFF0C\u7248\u672C\u6216\u63D0\u4EA4\u4E0E\u9884\u671F\u4E0D\u4E00\u81F4",
  "error.rollbackFailed": "\u56DE\u6EDA\u5931\u8D25\uFF0Cprofile \u53EF\u80FD\u5904\u4E8E\u534A\u66F4\u65B0\u72B6\u6001",
  "error.unknown": "\u672A\u77E5\u9519\u8BEF",
  "error.network": "\u7F51\u7EDC\u5F02\u5E38\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5",
  "error.httpStatus": "\u8BF7\u6C42\u5931\u8D25\uFF08HTTP {status}\uFF09",
  "error.requestFailedDetail": "\u66F4\u65B0\u8BF7\u6C42\u5931\u8D25\uFF1A{error}",
  // --- Settings card ---------------------------------------------------------------
  "settings.title": "\u2699\uFE0F \u63D2\u4EF6\u9ED8\u8BA4\u66F4\u65B0\u6E90\u914D\u7F6E",
  "settings.close": "\u2715 \u5173\u95ED",
  "settings.closeTitle": "\u5173\u95ED\u8BBE\u7F6E",
  "settings.intro": "\u5728\u6B64\u8BBE\u7F6E\u8FDB\u884C\u7B2C\u4E09\u65B9\u63D2\u4EF6\u66F4\u65B0\u65F6\u9ED8\u8BA4\u4F7F\u7528\u7684 npm \u4ED3\u5E93\u6E90\u3002",
  "settings.autoTitle": "\u81EA\u52A8\u6A21\u5F0F\uFF08\u667A\u80FD\u63A2\u6D4B\u4E0E\u5305\u5B8C\u6574\u5EA6\u68C0\u67E5\uFF09",
  "settings.autoBadge": "\u63A8\u8350",
  "settings.autoHint": "\u4F18\u5148\u5E76\u53D1 ping \u6D4B\u901F\u3002\u82E5\u56FD\u5185\u6E90\u8F83\u5FEB\uFF0C\u4F1A\u81EA\u52A8\u9884\u68C0\u56FD\u5185\u6E90\u662F\u5426\u5305\u542B\u672C\u6B21\u66F4\u65B0\u53CA\u73B0\u6709\u5168\u90E8\u76F4\u63A5\u4F9D\u8D56\u7684\u5BF9\u5E94\u7248\u672C\uFF1B\u82E5\u65E0\u7F3A\u5931\u5219\u91C7\u7528\u56FD\u5185\u9AD8\u901F\u6E90\uFF0C\u82E5\u53D1\u73B0\u7248\u672C\u843D\u540E/\u7F3A\u5931\u5219\u65E0\u7F1D\u5207\u6362\u5B98\u65B9\u6E90\uFF0C\u5F7B\u5E95\u907F\u514D\u7248\u672C\u4E0D\u5339\u914D\u62A5\u9519\u3002",
  "settings.npmjsTitle": "npm \u5B98\u65B9\u6E90",
  "settings.npmjsHint": "\u7248\u672C\u53D1\u5E03\u7B2C\u4E00\u65F6\u95F4\u5373\u65F6\u53EF\u7528\uFF0C\u7EDD\u5BF9\u6743\u5A01\u4E14\u65E0\u955C\u50CF\u540C\u6B65\u5EF6\u8FDF\uFF1B\u56FD\u5185\u7F51\u7EDC\u8BF7\u6C42\u53EF\u80FD\u5076\u6709\u8F7B\u5FAE\u6CE2\u52A8\u3002",
  "settings.npmmirrorTitle": "\u56FD\u5185\u6E90 npmmirror\uFF08\u4E0E DSH \u5BA2\u6237\u7AEF\u81EA\u5E26\u6E90\u4E00\u81F4\uFF09",
  "settings.npmmirrorHint": "\u4E2D\u56FD\u5927\u9646\u5730\u533A\u4E0B\u8F7D\u4E0E\u89E3\u6790\u6781\u901F\u3002\u6CE8\u610F\uFF1A\u955C\u50CF\u8282\u70B9\u4E3A\u5468\u671F\u540C\u6B65\uFF0C\u5C0F\u4F17\u63D2\u4EF6\u65B0\u7248\u672C\u53EF\u80FD\u5B58\u5728\u6570\u5C0F\u65F6\u6216\u6570\u5929\u7684\u540C\u6B65\u5EF6\u8FDF\u3002\u672C\u63D2\u4EF6\u4E0D\u4F1A\u4E3B\u52A8\u5411\u955C\u50CF\u53D1\u8D77\u540C\u6B65\u8BF7\u6C42\u3002",
  "settings.customFallbackName": "\u81EA\u5B9A\u4E49\u6E90",
  "settings.customHint": "\u81EA\u5B9A\u4E49\u6E90\u5730\u5740",
  "settings.delete": "\u5220\u9664",
  "settings.deleteTitle": "\u5220\u9664\u6B64\u81EA\u5B9A\u4E49\u6E90",
  "settings.addCustom": "+ \u6DFB\u52A0\u81EA\u5B9A\u4E49\u66F4\u65B0\u6E90",
  "settings.addCustomTitle": "\u6DFB\u52A0\u81EA\u5B9A\u4E49\u6E90",
  "settings.namePlaceholder": "\u6E90\u5907\u6CE8\u540D\u79F0 (\u5982: \u817E\u8BAF\u4E91\u955C\u50CF)",
  "settings.urlPlaceholder": "\u6E90 URL \u5730\u5740 (\u5982: https://mirrors.cloud.tencent.com/npm/)",
  "settings.saveAndUse": "\u4FDD\u5B58\u5E76\u4F7F\u7528",
  "settings.cancel": "\u53D6\u6D88",
  "settings.fallbackLabel": "\u5F53\u56FD\u5185\u6E90\u6216\u81EA\u5B9A\u4E49\u6E90\u5B89\u88C5\u5931\u8D25\uFF08\u5982\u9047\u5230\u7248\u672C\u672A\u540C\u6B65\u6216 404\uFF09\u65F6\uFF0C\u81EA\u52A8\u6539\u7528 npm \u5B98\u65B9\u6E90\u91CD\u8BD5\u4E00\u6B21\uFF08\u63A8\u8350\u5F00\u542F\uFF09",
  "settings.notice.registryUpdated": "\u5DF2\u66F4\u65B0\u9ED8\u8BA4\u66F4\u65B0\u6E90",
  "settings.notice.fallbackOn": "\u5DF2\u5F00\u542F\u81EA\u52A8\u56DE\u9000",
  "settings.notice.fallbackOff": "\u5DF2\u5173\u95ED\u81EA\u52A8\u56DE\u9000",
  "settings.notice.customAdded": "\u5DF2\u6DFB\u52A0\u5E76\u5207\u6362\u4E3A\u300C{name}\u300D",
  "settings.notice.customRemoved": "\u5DF2\u79FB\u9664\u81EA\u5B9A\u4E49\u6E90",
  "settings.error.invalidUrl": "\u8BF7\u8F93\u5165\u5408\u6CD5\u7684 HTTP/HTTPS \u6E90\u5730\u5740 (\u4F8B\u5982 https://mirrors.cloud.tencent.com/npm/)",
  "settings.error.duplicate": "\u8BE5\u6E90\u5730\u5740\u5DF2\u5B58\u5728\u4E8E\u5217\u8868\u4E2D\uFF0C\u65E0\u9700\u91CD\u590D\u6DFB\u52A0",
  "settings.error.saveFailed": "\u4FDD\u5B58\u81EA\u5B9A\u4E49\u6E90\u5931\u8D25"
};
var en = {
  // --- Updater action button -------------------------------------------------------
  "action.checking": "Checking...",
  "action.checkUpdate": "Check for updates",
  "action.checkFailedRetry": "Check failed (retry)",
  "action.checkTitle": "Check whether this plugin has a newer version",
  "action.checkFailedTitle": "Update check failed: {error}. Click to retry",
  "action.upToDate": "Up to date",
  "action.upToDateTitle": "Already up to date ({version}). Click to check again",
  "action.updateTo": "Update to v{version}",
  "action.updateToCommit": "Update to latest commit",
  "action.updateTitle": "Click to update this plugin to the latest version v{version}",
  "action.updateCommitTitle": "Click to update this plugin to the latest commit",
  "action.updating": "Updating...",
  "action.success": "Updated (reload needed)",
  "action.successTitle": "Update succeeded! Click to check again",
  "action.updateFailedRetry": "Update failed (retry)",
  "action.updateFailedTitle": "Update failed: {error}. Click to retry",
  "action.gearTitle": "Configure the default update source / custom sources",
  // --- Confirmation dialogs --------------------------------------------------------
  "confirm.update": 'Update plugin "{packageName}" to the latest version v{version}?',
  "confirm.updateCommit": 'Update plugin "{packageName}" to the latest commit?',
  // --- Check result hints (branch / commit / tag / registry) -----------------------
  "check.branch": "Branch {branch}",
  "check.commit": "Commit {commit}",
  "check.tag": "Tag {tag}",
  "check.installedCommit": "installed {commit}",
  "check.pinUnavailable": "No tag matches the target version; the branch head will be installed",
  // --- Async job progress ----------------------------------------------------------
  "progress.starting": "Starting update job\u2026",
  "phaseQueued": "Queued\u2026",
  "phaseResolving": "Resolving dependencies\u2026",
  "phaseDownloading": "Downloading\u2026",
  "phaseInstalling": "Installing\u2026",
  "phaseVerifying": "Verifying installation\u2026",
  "phaseRollingBack": "Rolling back\u2026",
  "phaseDone": "Done",
  "phaseFailed": "Failed",
  "phaseCancelled": "Cancelled",
  "progress.phaseUnknown": "Working ({phase})\u2026",
  "progress.cancel": "Cancel update",
  "progress.cancelling": "Cancelling\u2026",
  "progress.cancelFailed": "Cancel request failed: {error}",
  "progress.pollFailed": "Failed to fetch update progress: {error}",
  "progress.logTitle": "Install log",
  // --- Final update result ---------------------------------------------------------
  "update.success": '\u{1F389} Plugin "{packageName}" updated successfully!',
  "update.successVersion": "Updated to v{version}",
  "update.registryUsed": "Registry used: {registry}",
  "update.registryUsedFellBack": "Registry used: {registry} (automatic fallback triggered)",
  "update.installedCommit": "Installed commit: {commit}",
  "update.selfUpdateRestart": "This update replaced the updater plugin itself. Fully quit and restart DSH to load the new version (refreshing the window may not be enough).",
  "update.reloadHint": "Refresh the current window or restart DSH to load the new version.",
  "update.failed": "\u274C Plugin update failed",
  "update.rollbackRestored": "The install failed; the previous state was restored automatically.",
  "update.rollbackFailed": "\u26A0\uFE0F Rollback failed; the profile may be partially updated. Please check manually.",
  "update.cancelled": "Update cancelled.",
  "update.outputTitle": "Details",
  // --- Registry labels (localized from registry URLs) ------------------------------
  "registry.official": "npm official registry",
  "registry.domestic": "npmmirror (DSH mirror)",
  "registry.customNamed": 'Custom registry "{name}"',
  "registry.customHost": "Custom registry {host}",
  "registry.unknown": "Unknown registry",
  // --- Error codes (one key per entry of ERROR_CODES) ------------------------------
  "error.invalidPackageName": "Invalid package name",
  "error.invalidTargetVersion": "Invalid target version",
  "error.officialPlugin": `Official plugins are updated through DSH's built-in update entry; use the "Update" button at the top-right of the plugin page`,
  "error.notInstalled": "This plugin is not installed in the current profile and cannot be updated",
  "error.profileNotFound": "No usable DSH profile directory was found",
  "error.installInProgress": "Another plugin is being updated. Please try again later",
  "error.jobNotFound": "The update job no longer exists or has expired. Please check for updates again",
  "error.offline": "Network error: cannot reach the update source or GitHub. Check your connection and retry",
  "error.rateLimited": "GitHub API rate limit reached. Retry later or configure GITHUB_TOKEN",
  "error.githubAuth": "Cannot access the GitHub repository (private repository or invalid credentials). Configure GITHUB_TOKEN and retry",
  "error.installFailed": "The install command failed",
  "error.timeout": "The update timed out and the install was aborted",
  "error.cancelled": "The update was cancelled",
  "error.verificationFailed": "Post-install verification failed: the installed version or commit does not match the expected one",
  "error.rollbackFailed": "Rollback failed; the profile may be partially updated",
  "error.unknown": "Unknown error",
  "error.network": "Network error. Check your connection and retry",
  "error.httpStatus": "Request failed (HTTP {status})",
  "error.requestFailedDetail": "Update request failed: {error}",
  // --- Settings card ---------------------------------------------------------------
  "settings.title": "\u2699\uFE0F Default update source",
  "settings.close": "\u2715 Close",
  "settings.closeTitle": "Close settings",
  "settings.intro": "Choose the npm registry used by default when updating third-party plugins.",
  "settings.autoTitle": "Automatic (smart probing with completeness check)",
  "settings.autoBadge": "Recommended",
  "settings.autoHint": "Both registries are pinged in parallel. If the domestic mirror is faster, its package set is pre-checked for this update plus every currently installed direct dependency; when nothing is missing the fast mirror is used, otherwise the official registry is selected automatically so version-mismatch errors cannot happen.",
  "settings.npmjsTitle": "npm official registry",
  "settings.npmjsHint": "New releases are available immediately, with no mirror synchronization lag. Requests from mainland China may occasionally be slower.",
  "settings.npmmirrorTitle": "npmmirror (same source as the DSH client)",
  "settings.npmmirrorHint": "Very fast downloads and resolution in mainland China. Note: the mirror syncs periodically, so minor plugins may lag hours or days behind. This plugin never triggers a mirror sync.",
  "settings.customFallbackName": "Custom registry",
  "settings.customHint": "Custom registry URL",
  "settings.delete": "Delete",
  "settings.deleteTitle": "Delete this custom registry",
  "settings.addCustom": "+ Add custom update source",
  "settings.addCustomTitle": "Add custom registry",
  "settings.namePlaceholder": "Registry label (e.g. Tencent Cloud mirror)",
  "settings.urlPlaceholder": "Registry URL (e.g. https://mirrors.cloud.tencent.com/npm/)",
  "settings.saveAndUse": "Save and use",
  "settings.cancel": "Cancel",
  "settings.fallbackLabel": "If an install from the domestic mirror or a custom registry fails (e.g. unsynced version or 404), retry once on the official npm registry (recommended)",
  "settings.notice.registryUpdated": "Default update source updated",
  "settings.notice.fallbackOn": "Automatic fallback enabled",
  "settings.notice.fallbackOff": "Automatic fallback disabled",
  "settings.notice.customAdded": 'Added and switched to "{name}"',
  "settings.notice.customRemoved": "Custom registry removed",
  "settings.error.invalidUrl": "Enter a valid HTTP/HTTPS registry URL (e.g. https://mirrors.cloud.tencent.com/npm/)",
  "settings.error.duplicate": "This registry URL is already in the list",
  "settings.error.saveFailed": "Failed to save the custom registry"
};

// src/client.tsx
var import_jsx_runtime = require("react/jsx-runtime");
function interpolate(template, params) {
  if (!params) return template;
  return template.replace(
    /\{(\w+)\}/g,
    (match, name2) => Object.prototype.hasOwnProperty.call(params, name2) ? String(params[name2]) : match
  );
}
function translateFromZh(key, params) {
  const dictionary = zh;
  const template = Object.prototype.hasOwnProperty.call(dictionary, key) ? dictionary[key] : key;
  return interpolate(template, params);
}
var FALLBACK_TRANSLATOR = (key, params) => translateFromZh(key, params);
function wrapTranslator(bound) {
  return (key, params) => {
    let resolved;
    try {
      resolved = bound(key, params);
    } catch {
      resolved = key;
    }
    if (typeof resolved !== "string" || resolved === key) return translateFromZh(key, params);
    return resolved;
  };
}
function getLocaleService(ctx) {
  try {
    const direct = ctx?.locale;
    if (direct && typeof direct === "object") return direct;
  } catch {
  }
  try {
    const viaGet = typeof ctx?.get === "function" ? ctx.get("locale") : void 0;
    if (viaGet && typeof viaGet === "object") return viaGet;
  } catch {
  }
  return void 0;
}
function createTranslator(locale) {
  if (locale && typeof locale.bind === "function") {
    try {
      const bound = locale.bind(LOCALE_NAMESPACE);
      if (typeof bound === "function") return wrapTranslator(bound);
    } catch (error) {
      console.error("dsh-plugins-update: failed to bind the locale namespace, using the bundled fallback", error);
    }
  }
  return FALLBACK_TRANSLATOR;
}
function registerLocaleDictionaries(ctx, locale) {
  if (!locale || typeof locale.register !== "function") return;
  const register = () => {
    try {
      const disposer = locale.register?.(LOCALE_NAMESPACE, { zh, en });
      return typeof disposer === "function" ? disposer : void 0;
    } catch (error) {
      console.error("dsh-plugins-update: failed to register locale dictionaries", error);
      return void 0;
    }
  };
  if (typeof ctx?.effect === "function") {
    try {
      ctx.effect(register, "dsh-plugins-update: locale dictionaries");
      return;
    } catch (error) {
      console.error("dsh-plugins-update: failed to install the locale registration effect", error);
    }
  }
  register();
}
function useLocaleRevision(locale) {
  const readRevision = () => {
    try {
      const snapshot = locale?.getSnapshot?.();
      return typeof snapshot?.revision === "number" ? snapshot.revision : 0;
    } catch {
      return 0;
    }
  };
  const [revision, setRevision] = (0, import_react.useState)(readRevision);
  (0, import_react.useEffect)(() => {
    if (!locale || typeof locale.subscribe !== "function") return void 0;
    const sync = () => setRevision(readRevision());
    let unsubscribe;
    try {
      unsubscribe = locale.subscribe(sync);
    } catch {
      return void 0;
    }
    sync();
    return () => {
      if (typeof unsubscribe === "function") {
        try {
          unsubscribe();
        } catch {
        }
      }
    };
  }, [locale]);
  return revision;
}
var ERROR_KEY_BY_CODE = {
  [ERROR_CODES.invalidPackageName]: "error.invalidPackageName",
  [ERROR_CODES.invalidTargetVersion]: "error.invalidTargetVersion",
  [ERROR_CODES.officialPlugin]: "error.officialPlugin",
  [ERROR_CODES.notInstalled]: "error.notInstalled",
  [ERROR_CODES.profileNotFound]: "error.profileNotFound",
  [ERROR_CODES.installInProgress]: "error.installInProgress",
  [ERROR_CODES.jobNotFound]: "error.jobNotFound",
  [ERROR_CODES.offline]: "error.offline",
  [ERROR_CODES.rateLimited]: "error.rateLimited",
  [ERROR_CODES.githubAuth]: "error.githubAuth",
  [ERROR_CODES.installFailed]: "error.installFailed",
  [ERROR_CODES.timeout]: "error.timeout",
  [ERROR_CODES.cancelled]: "error.cancelled",
  [ERROR_CODES.verificationFailed]: "error.verificationFailed",
  [ERROR_CODES.rollbackFailed]: "error.rollbackFailed",
  [ERROR_CODES.unknown]: "error.unknown"
};
function errorMessageKey(errorCode) {
  if (!errorCode) return void 0;
  return ERROR_KEY_BY_CODE[errorCode];
}
function localizeErrorInfo(t, info) {
  if (!info) return t("error.unknown");
  const key = errorMessageKey(info.errorCode);
  if (key) return t(key);
  if (info.notice) return t(info.notice.key, info.notice.params);
  if (typeof info.fallbackText === "string" && info.fallbackText.trim()) return info.fallbackText;
  return t("error.unknown");
}
function describeRequestError(error) {
  const name2 = typeof error?.name === "string" ? error.name : "";
  const message = typeof error?.message === "string" ? error.message : "";
  if (name2 === "AbortError") return { errorCode: ERROR_CODES.timeout };
  const httpMatch = /^HTTP (\d{3})$/.exec(message);
  if (httpMatch) return { notice: { key: "error.httpStatus", params: { status: httpMatch[1] } } };
  if (message) return { notice: { key: "error.requestFailedDetail", params: { error: message } } };
  return { errorCode: ERROR_CODES.offline };
}
function localizedRegistryLabel(t, url, customs) {
  if (typeof url !== "string" || !url.trim()) return void 0;
  const normalized = normalizeRegistryUrl(url) ?? url;
  if (normalized === OFFICIAL_REGISTRY) return t("registry.official");
  if (normalized === DOMESTIC_REGISTRY) return t("registry.domestic");
  const custom = customs.find((item) => normalizeRegistryUrl(item.url) === normalized);
  if (custom && custom.name) return t("registry.customNamed", { name: custom.name });
  try {
    return t("registry.customHost", { host: new URL(normalized).host });
  } catch {
    return normalized;
  }
}
function shortCommit(commit) {
  if (typeof commit !== "string") return "";
  return commit.slice(0, 7);
}
var PHASE_TEXT_KEY = {
  queued: "phaseQueued",
  resolving: "phaseResolving",
  downloading: "phaseDownloading",
  installing: "phaseInstalling",
  verifying: "phaseVerifying",
  "rolling-back": "phaseRollingBack",
  done: "phaseDone",
  failed: "phaseFailed",
  cancelled: "phaseCancelled"
};
function normalizePhaseAlias(messageKey) {
  const compact = messageKey.trim().toLowerCase().replace(/^progress[._-]/, "").replace(/^phase[._-]/, "").replace(/[^a-z]/g, "");
  switch (compact) {
    case "queued":
      return "queued";
    case "resolving":
      return "resolving";
    case "downloading":
      return "downloading";
    case "installing":
      return "installing";
    case "verifying":
      return "verifying";
    case "rollingback":
      return "rolling-back";
    case "done":
      return "done";
    case "failed":
      return "failed";
    case "cancelled":
    case "canceled":
      return "cancelled";
    default:
      return void 0;
  }
}
function resolvePhaseTextKey(messageKey, phase) {
  if (typeof messageKey === "string" && messageKey.trim()) {
    const trimmed = messageKey.trim();
    if (Object.prototype.hasOwnProperty.call(zh, trimmed)) return trimmed;
    const aliased = normalizePhaseAlias(trimmed);
    if (aliased) return PHASE_TEXT_KEY[aliased];
  }
  if (phase && Object.prototype.hasOwnProperty.call(PHASE_TEXT_KEY, phase)) return PHASE_TEXT_KEY[phase];
  return "progress.phaseUnknown";
}
function phaseLabel(t, messageKey, phase) {
  const key = resolvePhaseTextKey(messageKey, phase);
  if (key === "progress.phaseUnknown") return t(key, { phase: phase || messageKey || "" });
  return t(key);
}
var checkCache = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 60 * 1e3;
var POLL_INTERVAL_MS = 800;
var POLL_TIMEOUT_MS = 8e3;
var REQUEST_TIMEOUT_MS = 2e4;
var CANCEL_TIMEOUT_MS = 15e3;
var SELF_PACKAGE_NAME = "dsh-plugins-update";
function isOfficialPackage(pkg) {
  if (!pkg) return false;
  if (typeof pkg.official === "boolean") return pkg.official;
  return typeof pkg.name === "string" && pkg.name.startsWith("@deepseek-ai/");
}
var DEFAULT_SETTINGS = {
  registry: "auto",
  customRegistries: [],
  fallbackToOfficial: true,
  installTimeoutSeconds: 120
};
function useConfigFormState(form) {
  const [snapshot, setSnapshot] = (0, import_react.useState)(() => form?.getSnapshot ? form.getSnapshot() : { status: "idle" });
  (0, import_react.useEffect)(() => {
    if (!form?.subscribe) return void 0;
    const unsub = form.subscribe(() => {
      setSnapshot(form.getSnapshot?.() ?? {});
    });
    setSnapshot(form.getSnapshot?.() ?? {});
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, [form]);
  const rawValue = snapshot?.value;
  const settings = {
    registry: typeof rawValue?.registry === "string" ? rawValue.registry : DEFAULT_SETTINGS.registry,
    customRegistries: Array.isArray(rawValue?.customRegistries) ? rawValue.customRegistries.filter((c) => c && typeof c.url === "string") : DEFAULT_SETTINGS.customRegistries,
    fallbackToOfficial: typeof rawValue?.fallbackToOfficial === "boolean" ? rawValue.fallbackToOfficial : DEFAULT_SETTINGS.fallbackToOfficial,
    installTimeoutSeconds: typeof rawValue?.installTimeoutSeconds === "number" ? rawValue.installTimeoutSeconds : DEFAULT_SETTINGS.installTimeoutSeconds
  };
  const updateField = (0, import_react.useCallback)(
    async (field, value) => {
      if (!form?.set) return false;
      try {
        const ok = await form.set(field, value);
        return ok !== false;
      } catch (e) {
        console.error("Failed to update config field:", field, e);
        return false;
      }
    },
    [form]
  );
  return {
    settings,
    writable: snapshot?.writable !== false,
    status: snapshot?.status || "ready",
    updateField
  };
}
var RegistrySettingsCard = ({
  form,
  onClose,
  t: providedT,
  locale
}) => {
  useLocaleRevision(locale);
  const t = providedT ?? FALLBACK_TRANSLATOR;
  const { settings, writable, updateField } = useConfigFormState(form);
  const [isAddingCustom, setIsAddingCustom] = (0, import_react.useState)(false);
  const [newCustomName, setNewCustomName] = (0, import_react.useState)("");
  const [newCustomUrl, setNewCustomUrl] = (0, import_react.useState)("");
  const [customErrorKey, setCustomErrorKey] = (0, import_react.useState)("");
  const [notice, setNotice] = (0, import_react.useState)(null);
  const noticeTimerRef = (0, import_react.useRef)(void 0);
  (0, import_react.useEffect)(() => {
    return () => {
      if (noticeTimerRef.current !== void 0) clearTimeout(noticeTimerRef.current);
    };
  }, []);
  const showNotice = (key, params) => {
    setNotice({ key, params });
    if (noticeTimerRef.current !== void 0) clearTimeout(noticeTimerRef.current);
    noticeTimerRef.current = setTimeout(() => setNotice(null), 2500);
  };
  const handleSelectRegistry = async (val) => {
    const ok = await updateField("registry", val);
    if (ok) showNotice("settings.notice.registryUpdated");
  };
  const handleToggleFallback = async () => {
    const next = !settings.fallbackToOfficial;
    const ok = await updateField("fallbackToOfficial", next);
    if (ok) showNotice(next ? "settings.notice.fallbackOn" : "settings.notice.fallbackOff");
  };
  const handleAddCustom = async () => {
    setCustomErrorKey("");
    const name2 = newCustomName.trim() || t("settings.customFallbackName");
    const normalized = normalizeRegistryUrl(newCustomUrl);
    if (!normalized) {
      setCustomErrorKey("settings.error.invalidUrl");
      return;
    }
    if (normalized === OFFICIAL_REGISTRY || normalized === DOMESTIC_REGISTRY || settings.customRegistries.some((c) => normalizeRegistryUrl(c.url) === normalized)) {
      setCustomErrorKey("settings.error.duplicate");
      return;
    }
    const nextList = [...settings.customRegistries, { name: name2, url: normalized }];
    const ok = await updateField("customRegistries", nextList);
    if (ok) {
      await updateField("registry", normalized);
      setNewCustomName("");
      setNewCustomUrl("");
      setIsAddingCustom(false);
      showNotice("settings.notice.customAdded", { name: name2 });
    } else {
      setCustomErrorKey("settings.error.saveFailed");
    }
  };
  const handleDeleteCustom = async (urlToDelete) => {
    const norm = normalizeRegistryUrl(urlToDelete);
    const nextList = settings.customRegistries.filter((c) => normalizeRegistryUrl(c.url) !== norm);
    await updateField("customRegistries", nextList);
    if (normalizeRegistryUrl(settings.registry) === norm) {
      await updateField("registry", "auto");
    }
    showNotice("settings.notice.customRemoved");
  };
  const cardStyle = {
    padding: "16px 20px",
    borderRadius: "10px",
    background: "var(--dsw-alias-bg-elevated, #ffffff)",
    border: "1px solid var(--dsw-alias-border-l1, #e2e8f0)",
    fontSize: "13px",
    color: "var(--dsw-alias-label-primary, #1e293b)",
    lineHeight: 1.6,
    boxSizing: "border-box"
  };
  const sectionHeaderStyle = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
    borderBottom: "1px solid var(--dsw-alias-border-l2, #f1f5f9)",
    paddingBottom: "8px"
  };
  const labelStyle = {
    fontWeight: 600,
    fontSize: "13px",
    color: "var(--dsw-alias-label-primary, #0f172a)"
  };
  const hintStyle = {
    fontSize: "12px",
    color: "var(--dsw-alias-label-secondary, #64748b)",
    marginTop: "3px"
  };
  const optionItemStyle = (active) => ({
    display: "flex",
    alignItems: "flex-start",
    padding: "10px 12px",
    borderRadius: "8px",
    border: active ? "1.5px solid var(--dsw-alias-primary, #2563eb)" : "1px solid var(--dsw-alias-border-l2, #e2e8f0)",
    background: active ? "rgba(37, 99, 235, 0.04)" : "var(--dsw-alias-bg-subtle, #f8fafc)",
    marginBottom: "8px",
    cursor: writable ? "pointer" : "default",
    transition: "all 0.15s ease-in-out"
  });
  const btnStyle = {
    padding: "4px 10px",
    fontSize: "12px",
    borderRadius: "6px",
    border: "1px solid var(--dsw-alias-border-l1, #cbd5e1)",
    background: "var(--dsw-alias-bg-elevated, #ffffff)",
    color: "var(--dsw-alias-label-primary, #334155)",
    cursor: "pointer"
  };
  const isCurrent = (val) => {
    if (val === "auto" || val === "npmjs" || val === "npmmirror") {
      return settings.registry === val;
    }
    return normalizeRegistryUrl(settings.registry) === normalizeRegistryUrl(val);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: cardStyle, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: sectionHeaderStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "8px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "15px", fontWeight: 600 }, children: t("settings.title") }),
        notice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            style: {
              fontSize: "11px",
              color: "#16a34a",
              background: "#dcfce7",
              padding: "1px 6px",
              borderRadius: "4px"
            },
            children: t(notice.key, notice.params)
          }
        )
      ] }),
      onClose && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          onClick: onClose,
          style: { ...btnStyle, padding: "2px 8px", fontSize: "12px" },
          title: t("settings.closeTitle"),
          children: t("settings.close")
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginBottom: "14px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...hintStyle, marginBottom: "10px" }, children: t("settings.intro") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: optionItemStyle(isCurrent("auto")), onClick: () => writable && handleSelectRegistry("auto"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "radio",
            name: "dsh-plugin-registry",
            checked: isCurrent("auto"),
            onChange: () => handleSelectRegistry("auto"),
            disabled: !writable,
            style: { marginRight: "10px", marginTop: "3px" }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: labelStyle, children: [
            t("settings.autoTitle"),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "span",
              {
                style: {
                  marginLeft: 6,
                  fontSize: "11px",
                  color: "#2563eb",
                  background: "#eff6ff",
                  padding: "1px 5px",
                  borderRadius: "3px"
                },
                children: t("settings.autoBadge")
              }
            )
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: t("settings.autoHint") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: optionItemStyle(isCurrent("npmjs")), onClick: () => writable && handleSelectRegistry("npmjs"), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "radio",
            name: "dsh-plugin-registry",
            checked: isCurrent("npmjs"),
            onChange: () => handleSelectRegistry("npmjs"),
            disabled: !writable,
            style: { marginRight: "10px", marginTop: "3px" }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: labelStyle, children: [
            t("settings.npmjsTitle"),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { marginLeft: 6, fontSize: "11px", color: "#475569", fontFamily: "monospace" }, children: "https://registry.npmjs.org/" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: t("settings.npmjsHint") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          style: optionItemStyle(isCurrent("npmmirror")),
          onClick: () => writable && handleSelectRegistry("npmmirror"),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                type: "radio",
                name: "dsh-plugin-registry",
                checked: isCurrent("npmmirror"),
                onChange: () => handleSelectRegistry("npmmirror"),
                disabled: !writable,
                style: { marginRight: "10px", marginTop: "3px" }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: labelStyle, children: [
                t("settings.npmmirrorTitle"),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { marginLeft: 6, fontSize: "11px", color: "#475569", fontFamily: "monospace" }, children: "https://registry.npmmirror.com/" })
              ] }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: t("settings.npmmirrorHint") })
            ] })
          ]
        }
      ),
      settings.customRegistries.map((cust) => {
        const norm = normalizeRegistryUrl(cust.url) || cust.url;
        const active = isCurrent(norm);
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: optionItemStyle(active), onClick: () => writable && handleSelectRegistry(norm), children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "radio",
              name: "dsh-plugin-registry",
              checked: active,
              onChange: () => handleSelectRegistry(norm),
              disabled: !writable,
              style: { marginRight: "10px", marginTop: "3px" }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: labelStyle, children: [
              cust.name || t("settings.customFallbackName"),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { marginLeft: 6, fontSize: "11px", color: "#475569", fontFamily: "monospace" }, children: cust.url })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: t("settings.customHint") })
          ] }),
          writable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              style: {
                ...btnStyle,
                color: "#dc2626",
                borderColor: "#fca5a5",
                padding: "2px 6px",
                fontSize: "11px"
              },
              onClick: (e) => {
                e.stopPropagation();
                handleDeleteCustom(cust.url);
              },
              title: t("settings.deleteTitle"),
              children: t("settings.delete")
            }
          )
        ] }, norm);
      })
    ] }),
    writable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          marginBottom: "14px",
          padding: "10px 12px",
          background: "var(--dsw-alias-bg-subtle, #f8fafc)",
          borderRadius: "8px"
        },
        children: !isAddingCustom ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            style: { ...btnStyle, display: "inline-flex", alignItems: "center", gap: "4px" },
            onClick: () => setIsAddingCustom(true),
            children: t("settings.addCustom")
          }
        ) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 600, fontSize: "12px", marginBottom: "8px" }, children: t("settings.addCustomTitle") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                type: "text",
                placeholder: t("settings.namePlaceholder"),
                value: newCustomName,
                onChange: (e) => setNewCustomName(e.target.value),
                style: {
                  padding: "4px 8px",
                  fontSize: "12px",
                  borderRadius: "6px",
                  border: "1px solid var(--dsw-alias-border-l1, #cbd5e1)",
                  width: "180px"
                }
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "input",
              {
                type: "text",
                placeholder: t("settings.urlPlaceholder"),
                value: newCustomUrl,
                onChange: (e) => setNewCustomUrl(e.target.value),
                style: {
                  padding: "4px 8px",
                  fontSize: "12px",
                  borderRadius: "6px",
                  border: "1px solid var(--dsw-alias-border-l1, #cbd5e1)",
                  flex: 1,
                  minWidth: "240px"
                }
              }
            )
          ] }),
          customErrorKey && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "#dc2626", fontSize: "11px", marginBottom: "6px" }, children: t(customErrorKey) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: "6px" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                style: {
                  ...btnStyle,
                  background: "var(--dsw-alias-primary, #2563eb)",
                  color: "#ffffff",
                  borderColor: "#2563eb"
                },
                onClick: handleAddCustom,
                children: t("settings.saveAndUse")
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "button",
              {
                type: "button",
                style: btnStyle,
                onClick: () => {
                  setIsAddingCustom(false);
                  setCustomErrorKey("");
                },
                children: t("settings.cancel")
              }
            )
          ] })
        ] })
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          display: "flex",
          alignItems: "center",
          gap: "8px",
          paddingTop: "8px",
          borderTop: "1px solid var(--dsw-alias-border-l2, #f1f5f9)"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "input",
            {
              type: "checkbox",
              id: "fallbackToOfficialCheckbox",
              checked: settings.fallbackToOfficial,
              onChange: handleToggleFallback,
              disabled: !writable,
              style: { cursor: writable ? "pointer" : "default" }
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "label",
            {
              htmlFor: "fallbackToOfficialCheckbox",
              style: {
                fontSize: "12px",
                cursor: writable ? "pointer" : "default",
                color: "var(--dsw-alias-label-primary, #1e293b)"
              },
              children: t("settings.fallbackLabel")
            }
          )
        ]
      }
    )
  ] });
};
var UpdaterActionButton = ({
  subject,
  form,
  t: providedT,
  locale
}) => {
  useLocaleRevision(locale);
  const t = providedT ?? FALLBACK_TRANSLATOR;
  const pkg = subject?.pkg;
  const packageName = typeof pkg?.name === "string" ? pkg.name : "";
  const clientVersion = pkg?.version || "0.0.0";
  const renderable = subject?.kind === "bundle" && !!packageName && pkg?.installed !== false && !isOfficialPackage(pkg);
  const { settings: configSettings } = useConfigFormState(form);
  const customRegistries = configSettings.customRegistries;
  const [status, setStatus] = (0, import_react.useState)("idle");
  const [checkResult, setCheckResult] = (0, import_react.useState)(null);
  const [checkError, setCheckError] = (0, import_react.useState)(null);
  const [errorSource, setErrorSource] = (0, import_react.useState)("check");
  const [progress, setProgress] = (0, import_react.useState)(null);
  const [progressError, setProgressError] = (0, import_react.useState)(null);
  const [successInfo, setSuccessInfo] = (0, import_react.useState)(null);
  const [failureInfo, setFailureInfo] = (0, import_react.useState)(null);
  const [showSettingsModal, setShowSettingsModal] = (0, import_react.useState)(false);
  const checkingRef = (0, import_react.useRef)(false);
  const mountedRef = (0, import_react.useRef)(true);
  const pollTokenRef = (0, import_react.useRef)(0);
  const abortRef = (0, import_react.useRef)(null);
  const updateAvailableRef = (0, import_react.useRef)(false);
  const pendingTargetRef = (0, import_react.useRef)({ commitOnly: false });
  const effectiveCurrentVersion = checkResult?.currentVersion || clientVersion;
  const remoteVersion = checkResult?.latestVersion || "";
  const versionChanged = !!remoteVersion && remoteVersion !== effectiveCurrentVersion;
  const commitOnlyUpdate = !!checkResult?.commitAhead && !versionChanged;
  const hasUpdate = status === "has_update";
  const latestVersion = checkResult?.latestVersion || "";
  updateAvailableRef.current = !!(checkResult?.hasUpdate || checkResult?.commitAhead);
  (0, import_react.useEffect)(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pollTokenRef.current += 1;
      try {
        abortRef.current?.abort();
      } catch {
      }
    };
  }, []);
  const stopPolling = (0, import_react.useCallback)(() => {
    pollTokenRef.current += 1;
    try {
      abortRef.current?.abort();
    } catch {
    }
    abortRef.current = null;
  }, []);
  const doCheck = (0, import_react.useCallback)(
    async (force = false) => {
      if (!renderable || checkingRef.current) return;
      if (!force) {
        const cached = checkCache.get(packageName);
        if (cached && cached.result.ok && Date.now() - cached.time < CACHE_TTL_MS) {
          setCheckResult(cached.result);
          setCheckError(null);
          setSuccessInfo(null);
          setFailureInfo(null);
          setStatus(cached.result.hasUpdate || cached.result.commitAhead ? "has_update" : "up_to_date");
          return;
        }
      }
      checkingRef.current = true;
      setStatus("checking");
      setCheckError(null);
      setErrorSource("check");
      setSuccessInfo(null);
      setFailureInfo(null);
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = setTimeout(() => {
        try {
          controller?.abort();
        } catch {
        }
      }, REQUEST_TIMEOUT_MS);
      try {
        const res = await fetch(CHECK_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ packageName, currentVersion: clientVersion }),
          signal: controller?.signal
        });
        const payload = await res.json().catch(() => null);
        if (!payload || typeof payload !== "object") throw new Error(`HTTP ${res.status}`);
        const data = payload;
        if (!res.ok && data.ok) throw new Error(`HTTP ${res.status}`);
        if (!mountedRef.current) return;
        if (data.ok) {
          checkCache.set(packageName, { time: Date.now(), result: data });
          setCheckResult(data);
          if (data.hasUpdate || data.commitAhead) {
            setStatus("has_update");
          } else {
            setStatus("up_to_date");
          }
        } else {
          setCheckResult(null);
          setStatus("error");
          setErrorSource("check");
          setCheckError({
            errorCode: typeof data.errorCode === "string" ? data.errorCode : void 0,
            fallbackText: typeof data.error === "string" ? data.error : void 0
          });
        }
      } catch (error) {
        if (!mountedRef.current) return;
        setCheckResult(null);
        setStatus("error");
        setErrorSource("check");
        setCheckError(describeRequestError(error));
      } finally {
        clearTimeout(timer);
        checkingRef.current = false;
      }
    },
    [packageName, clientVersion, renderable]
  );
  (0, import_react.useEffect)(() => {
    if (!renderable) return;
    void doCheck();
  }, [packageName, clientVersion, doCheck, renderable]);
  const finishSuccess = (0, import_react.useCallback)(
    (result, options) => {
      if (!mountedRef.current) return;
      checkCache.delete(packageName);
      setStatus("success");
      setProgress(null);
      setProgressError(null);
      setFailureInfo(null);
      setErrorSource("check");
      const pending = pendingTargetRef.current;
      setSuccessInfo({
        version: options?.suppressVersion ? void 0 : result?.targetVersion || (pending.commitOnly ? void 0 : pending.version),
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
  const finishFailure = (0, import_react.useCallback)((info) => {
    if (!mountedRef.current) return;
    setProgress(null);
    setProgressError(null);
    setSuccessInfo(null);
    setFailureInfo(info);
  }, []);
  const finishWithResult = (0, import_react.useCallback)(
    (result, fallback) => {
      if (result && result.ok) {
        finishSuccess(result);
        return;
      }
      if (fallback.cancelled) {
        setStatus(updateAvailableRef.current ? "has_update" : "idle");
        finishFailure({ errorCode: fallback.errorCode || ERROR_CODES.cancelled, cancelled: true });
        return;
      }
      setStatus("error");
      setErrorSource("update");
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
  const startPolling = (0, import_react.useCallback)(
    (jobId) => {
      const token = ++pollTokenRef.current;
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
      const poll = async () => {
        while (mountedRef.current && token === pollTokenRef.current) {
          await sleep(POLL_INTERVAL_MS);
          if (!mountedRef.current || token !== pollTokenRef.current) return;
          const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
          abortRef.current = controller;
          const timer = setTimeout(() => {
            try {
              controller?.abort();
            } catch {
            }
          }, POLL_TIMEOUT_MS);
          let state = null;
          try {
            const res = await fetch(`${PROGRESS_PATH}?jobId=${encodeURIComponent(jobId)}`, {
              method: "GET",
              headers: { accept: "application/json" },
              signal: controller?.signal
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            state = await res.json();
          } catch (error) {
            clearTimeout(timer);
            if (!mountedRef.current || token !== pollTokenRef.current) return;
            const message = typeof error?.message === "string" ? error.message : "";
            setProgress(null);
            setProgressError(
              message ? { key: "progress.pollFailed", params: { error: message } } : { key: "error.network" }
            );
            setStatus("error");
            setErrorSource("update");
            return;
          }
          clearTimeout(timer);
          if (!mountedRef.current || token !== pollTokenRef.current) return;
          if (!state || typeof state !== "object") {
            setProgress(null);
            setProgressError({ key: "error.unknown" });
            setStatus("error");
            setErrorSource("update");
            return;
          }
          const phase = state.phase;
          if (phase === "done" || phase === "failed" || phase === "cancelled") {
            if (state.ok === false && state.errorCode === ERROR_CODES.jobNotFound && packageName === SELF_PACKAGE_NAME) {
              finishSuccess(
                { ok: true, packageName, selfUpdate: true },
                { suppressVersion: true }
              );
              return;
            }
            finishWithResult(phase === "cancelled" ? void 0 : state.result, {
              errorCode: state.errorCode,
              fallbackText: state.error,
              cancelled: phase === "cancelled"
            });
            return;
          }
          const nextPercent = typeof state.percent === "number" && Number.isFinite(state.percent) ? Math.max(0, Math.min(100, state.percent)) : void 0;
          setProgress((prev) => ({
            jobId,
            phase: phase || prev?.phase || "installing",
            percent: nextPercent ?? prev?.percent,
            logTail: typeof state?.logTail === "string" ? state.logTail : prev?.logTail,
            messageKey: typeof state?.messageKey === "string" ? state.messageKey : void 0,
            cancelling: prev?.cancelling || false
          }));
        }
      };
      void poll();
    },
    [finishWithResult]
  );
  const handleUpdate = async () => {
    if (status === "updating") return;
    const targetVersion = versionChanged ? latestVersion : void 0;
    const commitOnly = commitOnlyUpdate;
    const confirmed = typeof window === "undefined" || typeof window.confirm !== "function" ? true : window.confirm(
      commitOnly ? t("confirm.updateCommit", { packageName }) : t("confirm.update", { packageName, version: latestVersion || effectiveCurrentVersion })
    );
    if (!confirmed) return;
    stopPolling();
    pendingTargetRef.current = {
      commitOnly,
      version: commitOnly ? void 0 : latestVersion || void 0,
      branch: checkResult?.branch
    };
    setStatus("updating");
    setCheckError(null);
    setSuccessInfo(null);
    setFailureInfo(null);
    setProgressError(null);
    setProgress({ jobId: "", phase: "queued", cancelling: false });
    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      abortRef.current = controller;
      const timer = setTimeout(() => {
        try {
          controller?.abort();
        } catch {
        }
      }, REQUEST_TIMEOUT_MS);
      let payload;
      try {
        const body = { packageName };
        if (!commitOnly && targetVersion) body.targetVersion = targetVersion;
        const res = await fetch(UPDATE_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller?.signal
        });
        if (!res.ok) {
          payload = await res.json().catch(() => null);
          const failure = new Error(
            payload && typeof payload.error === "string" ? payload.error : `HTTP ${res.status}`
          );
          if (payload && typeof payload.errorCode === "string") failure.errorCode = payload.errorCode;
          throw failure;
        }
        payload = await res.json().catch(() => null);
      } finally {
        clearTimeout(timer);
        if (abortRef.current === controller) abortRef.current = null;
      }
      if (!mountedRef.current) return;
      if (!payload || typeof payload !== "object") throw new Error("Invalid response");
      if (payload.ok === false) {
        setStatus("error");
        setErrorSource("update");
        setProgress(null);
        finishFailure({
          errorCode: typeof payload.errorCode === "string" ? payload.errorCode : void 0,
          fallbackText: typeof payload.error === "string" ? payload.error : void 0
        });
        return;
      }
      const jobId = typeof payload.jobId === "string" ? payload.jobId : "";
      if (!jobId) {
        finishWithResult(payload, {});
        return;
      }
      setProgress({ jobId, phase: "queued", cancelling: false });
      startPolling(jobId);
    } catch (error) {
      if (!mountedRef.current) return;
      setProgress(null);
      setStatus("error");
      setErrorSource("update");
      const thrownCode = typeof error?.errorCode === "string" ? error.errorCode : void 0;
      finishFailure(
        thrownCode ? {
          errorCode: thrownCode,
          fallbackText: typeof error?.message === "string" ? error.message : void 0
        } : describeRequestError(error)
      );
    }
  };
  const handleCancelUpdate = async () => {
    const jobId = progress?.jobId;
    if (!jobId || progress?.cancelling) return;
    setProgress((prev) => prev ? { ...prev, cancelling: true } : prev);
    setProgressError(null);
    try {
      const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
      const timer = setTimeout(() => {
        try {
          controller?.abort();
        } catch {
        }
      }, CANCEL_TIMEOUT_MS);
      let res;
      try {
        res = await fetch(CANCEL_PATH, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jobId }),
          signal: controller?.signal
        });
      } finally {
        clearTimeout(timer);
      }
      const payload = await res.json().catch(() => null);
      if (!res.ok || payload && typeof payload === "object" && payload.ok === false) {
        const errorCode = payload && typeof payload.errorCode === "string" ? payload.errorCode : "";
        if (errorCode === ERROR_CODES.unknown || errorCode === ERROR_CODES.jobNotFound) return;
        const message = payload && typeof payload.error === "string" ? payload.error : `HTTP ${res.status}`;
        throw new Error(message);
      }
    } catch (error) {
      if (!mountedRef.current) return;
      setProgress((prev) => prev ? { ...prev, cancelling: false } : prev);
      const message = typeof error?.message === "string" ? error.message : t("error.network");
      setProgressError({ key: "progress.cancelFailed", params: { error: message } });
    }
  };
  const shortLatestCommit = shortCommit(checkResult?.latestCommit);
  const shortInstalledCommit = shortCommit(checkResult?.installedCommit);
  const hintParts = [];
  if (checkResult?.isGithub) {
    if (checkResult.branch) hintParts.push(t("check.branch", { branch: checkResult.branch }));
    if (shortLatestCommit) hintParts.push(t("check.commit", { commit: shortLatestCommit }));
    if (checkResult.tag) hintParts.push(t("check.tag", { tag: checkResult.tag }));
    if (shortInstalledCommit) hintParts.push(t("check.installedCommit", { commit: shortInstalledCommit }));
  }
  const checkHint = hintParts.join(" \xB7 ");
  const updateTitle = (() => {
    const lines = [
      commitOnlyUpdate ? t("action.updateCommitTitle") : t("action.updateTitle", { version: latestVersion || effectiveCurrentVersion })
    ];
    if (checkResult?.isGithub) {
      if (checkResult.branch) lines.push(t("check.branch", { branch: checkResult.branch }));
      if (shortLatestCommit) lines.push(t("check.commit", { commit: shortLatestCommit }));
      if (shortInstalledCommit) lines.push(t("check.installedCommit", { commit: shortInstalledCommit }));
    }
    if (checkResult?.tag) lines.push(t("check.tag", { tag: checkResult.tag }));
    if (checkResult?.pinAvailable === false) lines.push(t("check.pinUnavailable"));
    return lines.join("\n");
  })();
  const RefreshIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "svg",
    {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { marginRight: 5 },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 3v5h5" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M16 16h5v5" })
      ]
    }
  );
  const ArrowUpIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "svg",
    {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.5",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { marginRight: 5 },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 19V5" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m5 12 7-7 7 7" })
      ]
    }
  );
  const CheckIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "svg",
    {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2.5",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      style: { marginRight: 5 },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "20 6 9 17 4 12" })
    }
  );
  const GearIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "svg",
    {
      width: "13",
      height: "13",
      viewBox: "0 0 24 24",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: "2",
      strokeLinecap: "round",
      strokeLinejoin: "round",
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "3" }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" })
      ]
    }
  );
  const baseButtonStyle = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    lineHeight: "20px",
    fontWeight: 500,
    padding: "3px 10px",
    borderRadius: "6px",
    cursor: "pointer",
    transition: "all 0.15s ease-in-out",
    border: "1px solid var(--dsw-alias-border-l1, #e2e8f0)",
    background: "var(--dsw-alias-bg-elevated, #ffffff)",
    color: "var(--dsw-alias-label-primary, #1e293b)",
    userSelect: "none"
  };
  const gearButtonStyle = {
    ...baseButtonStyle,
    padding: "3px 7px",
    marginLeft: "4px",
    marginRight: "6px",
    color: "var(--dsw-alias-label-secondary, #64748b)"
  };
  const hintLineStyle = {
    fontSize: "11px",
    color: "var(--dsw-alias-label-secondary, #64748b)",
    marginTop: "2px",
    lineHeight: 1.4,
    maxWidth: "340px",
    whiteSpace: "normal"
  };
  const panelStyle = {
    marginTop: "6px",
    marginLeft: "0",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid var(--dsw-alias-border-l2, #e2e8f0)",
    background: "var(--dsw-alias-bg-subtle, #f8fafc)",
    minWidth: "240px",
    maxWidth: "340px",
    boxSizing: "border-box",
    fontSize: "12px",
    lineHeight: 1.5
  };
  const progressTrackStyle = {
    marginTop: "6px",
    height: "5px",
    borderRadius: "3px",
    background: "rgba(37, 99, 235, 0.15)",
    overflow: "hidden"
  };
  const progressFillStyle = (percent) => ({
    height: "100%",
    width: `${percent}%`,
    background: "var(--dsw-alias-primary, #2563eb)",
    transition: "width 0.2s ease-in-out"
  });
  const logStyle = {
    margin: "6px 0 0",
    padding: "6px 8px",
    maxHeight: "120px",
    overflow: "auto",
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
    fontSize: "11px",
    lineHeight: 1.45,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    background: "rgba(15, 23, 42, 0.04)",
    borderRadius: "4px",
    color: "var(--dsw-alias-label-secondary, #475569)"
  };
  const smallButtonStyle = {
    ...baseButtonStyle,
    padding: "1px 8px",
    fontSize: "11px",
    lineHeight: "17px",
    marginLeft: "auto"
  };
  const renderMainButton = () => {
    if (status === "has_update") {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          type: "button",
          style: {
            ...baseButtonStyle,
            borderColor: "rgba(234, 88, 12, 0.45)",
            background: "rgba(254, 243, 199, 0.7)",
            color: "#c2410c",
            boxShadow: "0 1px 2px rgba(234, 88, 12, 0.15)"
          },
          onClick: handleUpdate,
          title: updateTitle,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpIcon, {}),
            commitOnlyUpdate ? t("action.updateToCommit") : t("action.updateTo", { version: latestVersion || effectiveCurrentVersion })
          ]
        }
      );
    }
    if (status === "updating") {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          type: "button",
          disabled: true,
          style: {
            ...baseButtonStyle,
            opacity: 0.75,
            cursor: "wait",
            background: "var(--dsw-alias-bg-subtle, #f1f5f9)",
            color: "var(--dsw-alias-label-secondary, #64748b)"
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshIcon, {}),
            t("action.updating")
          ]
        }
      );
    }
    if (status === "checking") {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          type: "button",
          disabled: true,
          style: {
            ...baseButtonStyle,
            opacity: 0.65,
            cursor: "wait"
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshIcon, {}),
            t("action.checking")
          ]
        }
      );
    }
    if (status === "success") {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          type: "button",
          style: {
            ...baseButtonStyle,
            borderColor: "rgba(22, 163, 74, 0.4)",
            background: "rgba(220, 252, 231, 0.7)",
            color: "#15803d"
          },
          onClick: () => doCheck(true),
          title: t("action.successTitle"),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckIcon, {}),
            t("action.success")
          ]
        }
      );
    }
    if (status === "up_to_date") {
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          type: "button",
          style: {
            ...baseButtonStyle,
            color: "var(--dsw-alias-label-secondary, #64748b)"
          },
          onClick: () => doCheck(true),
          title: t("action.upToDateTitle", { version: effectiveCurrentVersion }),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckIcon, {}),
            t("action.upToDate")
          ]
        }
      );
    }
    if (status === "error" && errorSource === "update") {
      const failureText = failureInfo ? localizeErrorInfo(t, failureInfo) : progressError ? t(progressError.key, progressError.params) : t("error.unknown");
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "button",
        {
          type: "button",
          style: {
            ...baseButtonStyle,
            borderColor: "#fca5a5",
            color: "#b91c1c"
          },
          onClick: () => checkResult?.hasUpdate || checkResult?.commitAhead ? handleUpdate() : doCheck(true),
          title: t("action.updateFailedTitle", { error: failureText }),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshIcon, {}),
            t("action.updateFailedRetry")
          ]
        }
      );
    }
    const checkErrorText = checkError ? localizeErrorInfo(t, checkError) : "";
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        type: "button",
        style: {
          ...baseButtonStyle,
          ...status === "error" ? { borderColor: "#fca5a5", color: "#b91c1c" } : {}
        },
        onClick: () => doCheck(true),
        title: status === "error" ? t("action.checkFailedTitle", { error: checkErrorText }) : t("action.checkTitle"),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshIcon, {}),
          status === "error" ? t("action.checkFailedRetry") : t("action.checkUpdate")
        ]
      }
    );
  };
  if (!renderable) return null;
  const successRegistry = localizedRegistryLabel(t, successInfo?.registryUsed, customRegistries) ?? successInfo?.registryLabel;
  const failureRegistry = localizedRegistryLabel(t, failureInfo?.registryUsed, customRegistries) ?? failureInfo?.registryLabel;
  const progressPercent = progress?.percent;
  const progressPhaseText = progress ? phaseLabel(t, progress.messageKey, progress.phase) : t("progress.starting");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "inline-flex", flexDirection: "column", alignItems: "flex-start" }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "inline-flex", alignItems: "center" }, children: [
      renderMainButton(),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          style: gearButtonStyle,
          onClick: () => setShowSettingsModal(true),
          title: t("action.gearTitle"),
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(GearIcon, {})
        }
      ),
      showSettingsModal && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "div",
        {
          style: {
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.45)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backdropFilter: "blur(2px)"
          },
          onClick: () => setShowSettingsModal(false),
          children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "div",
            {
              style: {
                width: "560px",
                maxWidth: "92vw",
                maxHeight: "90vh",
                overflowY: "auto",
                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)"
              },
              onClick: (e) => e.stopPropagation(),
              children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                RegistrySettingsCard,
                {
                  form,
                  t,
                  locale,
                  onClose: () => setShowSettingsModal(false)
                }
              )
            }
          )
        }
      )
    ] }),
    hasUpdate && checkHint && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintLineStyle, children: checkHint }),
    status === "error" && errorSource === "check" && checkError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...hintLineStyle, color: "#b91c1c" }, children: localizeErrorInfo(t, checkError) }),
    status === "updating" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: panelStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "6px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 600, fontSize: "12px" }, children: progressPhaseText }),
        typeof progressPercent === "number" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { style: { fontSize: "11px", color: "var(--dsw-alias-label-secondary, #64748b)" }, children: [
          Math.round(progressPercent),
          "%"
        ] }),
        progress?.jobId && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            style: smallButtonStyle,
            onClick: handleCancelUpdate,
            disabled: progress.cancelling,
            children: progress.cancelling ? t("progress.cancelling") : t("progress.cancel")
          }
        )
      ] }),
      typeof progressPercent === "number" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: progressTrackStyle, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: progressFillStyle(progressPercent) }) }),
      progress?.logTail && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "summary",
          {
            style: {
              cursor: "pointer",
              fontSize: "11px",
              color: "var(--dsw-alias-label-secondary, #64748b)",
              marginTop: "6px"
            },
            children: t("progress.logTitle")
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: logStyle, children: progress.logTail })
      ] }),
      progressError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: "11px", color: "#b91c1c", marginTop: "4px" }, children: t(progressError.key, progressError.params) })
    ] }),
    progressError && status !== "updating" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...hintLineStyle, color: "#b91c1c" }, children: t(progressError.key, progressError.params) }),
    successInfo && status === "success" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          ...panelStyle,
          borderColor: "rgba(22, 163, 74, 0.4)",
          background: "rgba(220, 252, 231, 0.45)"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 600, color: "#15803d" }, children: t("update.success", { packageName }) }),
          successInfo.version && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: t("update.successVersion", { version: successInfo.version }) }),
          !successInfo.version && successInfo.branch && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: t("check.branch", { branch: successInfo.branch }) }),
          !successInfo.version && successInfo.installedCommit && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: t("update.installedCommit", { commit: shortCommit(successInfo.installedCommit) }) }),
          successRegistry && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: t(successInfo.fellBack ? "update.registryUsedFellBack" : "update.registryUsed", {
            registry: successRegistry
          }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: "2px" }, children: successInfo.selfUpdate ? t("update.selfUpdateRestart") : t("update.reloadHint") })
        ]
      }
    ),
    failureInfo && !failureInfo.cancelled && status === "error" && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          ...panelStyle,
          borderColor: "#fca5a5",
          background: "rgba(254, 226, 226, 0.5)"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 600, color: "#b91c1c" }, children: t("update.failed") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: localizeErrorInfo(t, failureInfo) }),
          failureInfo.rollback === "restored" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: t("update.rollbackRestored") }),
          failureInfo.rollback === "failed" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: t("update.rollbackFailed") }),
          failureRegistry && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: t(failureInfo.fellBack ? "update.registryUsedFellBack" : "update.registryUsed", {
            registry: failureRegistry
          }) }),
          failureInfo.installedCommit && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { children: t("update.installedCommit", { commit: shortCommit(failureInfo.installedCommit) }) }),
          failureInfo.output && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("details", { children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
              "summary",
              {
                style: {
                  cursor: "pointer",
                  fontSize: "11px",
                  color: "var(--dsw-alias-label-secondary, #64748b)",
                  marginTop: "6px"
                },
                children: t("update.outputTitle")
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("pre", { style: logStyle, children: failureInfo.output })
          ] })
        ]
      }
    ),
    failureInfo?.cancelled && status !== "error" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...hintLineStyle, color: "var(--dsw-alias-label-secondary, #64748b)" }, children: t("update.cancelled") })
  ] });
};
function apply(ctx) {
  const locale = getLocaleService(ctx);
  const t = createTranslator(locale);
  registerLocaleDictionaries(ctx, locale);
  let formInstance;
  const getForm = () => {
    if (formInstance) return formInstance;
    if (ctx.configForms?.get) {
      formInstance = ctx.configForms.get("dsh-plugins-update");
    }
    return formInstance;
  };
  if (ctx.slots?.inject && ctx.slots?.register) {
    ctx.slots.inject(
      "plugins.detail.actions",
      () => ctx.slots.register(
        {
          name: "plugins.detail.actions",
          id: "dsh-plugins-update.action-button",
          order: -10
          // Place before uninstall and enable switch
        },
        (props) => import_react.default.createElement(UpdaterActionButton, { ...props, form: getForm(), t, locale })
      )
    );
    const registerBundleConfig = (f) => {
      ctx.slots.inject(
        "plugins.bundle.config",
        () => ctx.slots.register(
          {
            name: "plugins.bundle.config",
            key: "dsh-plugins-update"
          },
          () => import_react.default.createElement(RegistrySettingsCard, { form: f || getForm(), t, locale })
        )
      );
    };
    if (ctx.configForms?.whileServed) {
      ctx.effect(
        () => ctx.configForms.whileServed(["dsh-plugins-update"], () => {
          const form = ctx.configForms.get("dsh-plugins-update");
          formInstance = form;
          registerBundleConfig(form);
        }),
        "dsh-plugins-update: bundle settings card"
      );
    } else {
      registerBundleConfig();
    }
  }
}
var name = "dsh-plugins-update";
var inject = ["slots", "configForms"];

    return module.exports;
  }
});
