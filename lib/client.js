/**
 * dsh-plugins-update v0.2.6-exp.1
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
var import_react_dom = require("react-dom");
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/types.ts
var OFFICIAL_REGISTRY = "https://registry.npmjs.org/";
var DOMESTIC_REGISTRY = "https://registry.npmmirror.com/";
var PLUGIN_NAME = "dsh-plugins-update";
var OFFICIAL_PACKAGE_PREFIX = "@deepseek-ai/";
var LOCALE_NAMESPACE = PLUGIN_NAME;
var CHECK_PATH = "/api/dsh-plugins-update/check";
var CHECK_ALL_PATH = "/api/dsh-plugins-update/check-all";
var UPDATE_PATH = "/api/dsh-plugins-update/update";
var DIAGNOSE_PATH = "/api/dsh-plugins-update/diagnose";
var RESCUE_PATH = "/api/dsh-plugins-update/rescue";
var ERROR_CODES = {
  invalidPackageName: "invalid-package-name",
  invalidTargetVersion: "invalid-target-version",
  officialPlugin: "official-plugin",
  notInstalled: "not-installed",
  profileNotFound: "profile-not-found",
  installInProgress: "install-in-progress",
  offline: "offline",
  installFailed: "install-failed",
  timeout: "timeout",
  verificationFailed: "verification-failed",
  rollbackFailed: "rollback-failed",
  selfUninstallBlocked: "self-uninstall-blocked",
  unknown: "unknown"
};
function isOfficialPackageName(packageName) {
  return typeof packageName === "string" && packageName.startsWith(OFFICIAL_PACKAGE_PREFIX);
}
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
function resolveRegistryUrl(registry) {
  if (!registry || registry === "npmjs") return OFFICIAL_REGISTRY;
  if (registry === "npmmirror") return DOMESTIC_REGISTRY;
  return normalizeRegistryUrl(registry) ?? OFFICIAL_REGISTRY;
}
function parseSemver(input) {
  const match = String(input || "").trim().replace(/^[v^~]/, "").match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/);
  if (!match) return null;
  return {
    core: [Number(match[1]), Number(match[2]), Number(match[3])],
    prerelease: match[4] ? match[4].split(".") : []
  };
}
function compareSemver(left, right) {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (!a || !b) return left === right ? 0 : left > right ? 1 : -1;
  for (let i = 0; i < 3; i++) {
    if (a.core[i] !== b.core[i]) return a.core[i] > b.core[i] ? 1 : -1;
  }
  if (a.prerelease.length === 0 && b.prerelease.length === 0) return 0;
  if (a.prerelease.length === 0) return 1;
  if (b.prerelease.length === 0) return -1;
  const length = Math.max(a.prerelease.length, b.prerelease.length);
  for (let i = 0; i < length; i++) {
    const x = a.prerelease[i];
    const y = b.prerelease[i];
    if (x === void 0) return -1;
    if (y === void 0) return 1;
    const nx = /^\d+$/.test(x);
    const ny = /^\d+$/.test(y);
    if (nx && ny) {
      const diff = Number(x) - Number(y);
      if (diff !== 0) return diff > 0 ? 1 : -1;
    } else if (nx !== ny) {
      return nx ? -1 : 1;
    } else if (x !== y) {
      return x > y ? 1 : -1;
    }
  }
  return 0;
}
function versionGte(installed, target) {
  if (!installed || !target) return false;
  return compareSemver(installed, target) >= 0;
}

// src/locales.ts
var zh = {
  "action.checking": "\u68C0\u67E5\u4E2D\u2026",
  "action.upToDate": "\u5DF2\u662F\u6700\u65B0",
  "action.fastUpdate": "\u26A1 \u6781\u901F\u66F4\u65B0 (v{version})",
  "action.fastUpdateTip": "\u7ED5\u8FC7\u4F9B\u5E94\u94FE\u5B89\u5168\u89C2\u5BDF\u671F\uFF0C\u76F4\u63A5\u5B89\u88C5\u6700\u65B0\u7248",
  "action.githubUpdate": "\u66F4\u65B0\u6700\u65B0\u63D0\u4EA4 (v{version})",
  "action.updating": "\u66F4\u65B0\u4E2D\u2026",
  "action.success": "\u5DF2\u66F4\u65B0",
  "action.retry": "\u91CD\u8BD5",
  "badge.updateAvailable": "\u53EF\u66F4\u65B0",
  "badge.sidebarTip": "{count} \u4E2A\u63D2\u4EF6\u53EF\u66F4\u65B0",
  "badge.issueDetected": "\u26A0\uFE0F \u5F02\u5E38 / \u4FEE\u590D",
  "badge.issueAndUpdate": "\u26A0\uFE0F \u5F02\u5E38 \xB7 \u53EF\u66F4\u65B0\u4FEE\u590D",
  "rescue.banner.hostUpgradedTitle": "DSH \u5DF2\u5347\u7EA7\u81F3 {version}\uFF0C\u5EFA\u8BAE\u68C0\u67E5\u63D2\u4EF6\u9002\u914D",
  "rescue.banner.crashTitle": "\u68C0\u6D4B\u5230 {count} \u4E2A\u63D2\u4EF6\u8FD0\u884C\u5F02\u5E38\u6216\u53EF\u80FD\u672A\u9002\u914D",
  "rescue.banner.desc": "\u65E0\u9700\u6253\u5F00\u6545\u969C\u63D2\u4EF6\u8BE6\u60C5\u9875\uFF0C\u53EF\u5728\u6B64\u76F4\u63A5\u5347\u7EA7\u9002\u914D\u7248\u3001\u91CD\u88C5\u4FEE\u590D\u6216\u5B89\u5168\u5378\u8F7D\u3002",
  "rescue.banner.openCenter": "\u6253\u5F00\u6025\u6551\u4E2D\u5FC3",
  "rescue.banner.batchUpdate": "\u4E00\u952E\u66F4\u65B0\u5168\u90E8 ({count})",
  "rescue.banner.dismiss": "\u6682\u4E0D\u63D0\u9192",
  "rescue.modal.title": "\u{1F6E1}\uFE0F \u63D2\u4EF6\u5065\u5EB7\u8BCA\u65AD\u4E0E\u5B89\u5168\u6025\u6551\u4E2D\u5FC3",
  "rescue.modal.subtitle": "\u5F53 DSH \u5347\u7EA7\u540E\u63D2\u4EF6\u672A\u9002\u914D\u5BFC\u81F4\u9875\u9762\u62A5\u9519\u3001\u5D29\u6E83\u6216\u6253\u4E0D\u5F00\u65F6\uFF0C\u53EF\u5728\u6B64\u72EC\u7ACB\u5B8C\u6210\u8BCA\u65AD\u3001\u4E00\u952E\u66F4\u65B0\u3001\u91CD\u88C5\u4FEE\u590D\u6216\u5B89\u5168\u5378\u8F7D\u3002",
  "rescue.center.title": "\u{1F6E1}\uFE0F \u63D2\u4EF6\u5065\u5EB7\u8BCA\u65AD\u4E0E\u5B89\u5168\u6025\u6551\u4E2D\u5FC3",
  "rescue.center.intro": "\u4E13\u95E8\u5E94\u5BF9 DSH \u5347\u7EA7\u540E\uFF0C\u56E0\u7B2C\u4E09\u65B9\u63D2\u4EF6\u672A\u9002\u914D\u5BFC\u81F4\u62A5\u9519\u3001\u767D\u5C4F\u6216\u8BE6\u60C5\u9875\u65E0\u6CD5\u6253\u5F00\u7684\u95EE\u9898\u3002",
  "rescue.center.hostVersion": "\u5F53\u524D DSH \u5BBF\u4E3B\u7248\u672C\uFF1A{version}",
  "rescue.center.hostVersionUnknown": "\u5F53\u524D DSH \u5BBF\u4E3B\u7248\u672C\uFF1A\u672A\u8BC6\u522B",
  "rescue.center.diagnoseBtn": "\u{1F50D} \u91CD\u65B0\u626B\u63CF\u5168\u90E8\u63D2\u4EF6",
  "rescue.center.diagnosing": "\u6B63\u5728\u8BCA\u65AD\u5168\u90E8\u7B2C\u4E09\u65B9\u63D2\u4EF6\u2026",
  "rescue.center.batchUpdateBtn": "\u{1F680} \u4E00\u952E\u6279\u91CF\u66F4\u65B0\u5168\u90E8\u53EF\u66F4\u65B0\u63D2\u4EF6 ({count})",
  "rescue.center.batchUpdating": "\u6B63\u5728\u6279\u91CF\u66F4\u65B0 ({done}/{total})\uFF1A\u6B63\u5728\u5904\u7406 {packageName}\u2026",
  "rescue.center.batchDone": "\u6279\u91CF\u66F4\u65B0\u5B8C\u6210\uFF1A\u6210\u529F {ok} \u4E2A\uFF0C\u5931\u8D25 {fail} \u4E2A",
  "rescue.center.allHealthy": "\u6240\u6709\u5DF2\u5B89\u88C5\u7B2C\u4E09\u65B9\u63D2\u4EF6\u72B6\u6001\u5065\u5EB7\uFF08\u5171 {count} \u4E2A\uFF09\u3002",
  "rescue.center.healthyTag": "\u72B6\u6001\u6B63\u5E38",
  "rescue.center.currentVersion": "\u5F53\u524D v{version}",
  "rescue.center.latestVersion": "\u6700\u65B0 v{version}",
  "rescue.center.openRescueModal": "\u6253\u5F00\u72EC\u7ACB\u6025\u6551\u5F39\u7A97",
  "rescue.issue.bundleUnavailable": "\u5BBF\u4E3B\u4E0D\u53EF\u7528",
  "rescue.issue.bundleError": "\u52A0\u8F7D\u62A5\u9519",
  "rescue.issue.entryMissing": "\u6587\u4EF6\u7F3A\u5931/\u635F\u574F",
  "rescue.issue.unregisteredBundle": "\u672A\u88AB\u5BBF\u4E3B\u52A0\u8F7D",
  "rescue.issue.clientCrash": "\u9875\u9762\u8FD0\u884C\u65F6\u5D29\u6E83",
  "rescue.action.updateFix": "\u26A1 \u7ACB\u5373\u66F4\u65B0\u81F3 v{version}",
  "rescue.action.reinstall": "\u{1F504} \u5F3A\u5236\u91CD\u88C5\u4FEE\u590D",
  "rescue.action.uninstall": "\u{1F5D1}\uFE0F \u7D27\u6025\u5B89\u5168\u5378\u8F7D",
  "rescue.action.confirmUninstall": "\u786E\u8BA4\u8981\u4ECE\u5F53\u524D profile \u7D27\u6025\u5378\u8F7D\u300C{packageName}\u300D\u5417\uFF1F\u5378\u8F7D\u540E\u53EF\u968F\u65F6\u91CD\u65B0\u5B89\u88C5\u3002",
  "rescue.status.updating": "\u6B63\u5728\u5347\u7EA7\u4FEE\u590D\u2026",
  "rescue.status.reinstalling": "\u6B63\u5728\u91CD\u88C5\u4FEE\u590D\u2026",
  "rescue.status.uninstalling": "\u6B63\u5728\u5B89\u5168\u5378\u8F7D\u2026",
  "rescue.result.updated": "\u5DF2\u66F4\u65B0\u81F3 v{version}\uFF0C\u8BF7\u5237\u65B0\u7A97\u53E3\u6216\u91CD\u542F DSH\u3002",
  "rescue.result.reinstalled": "\u5DF2\u5B8C\u6210\u91CD\u88C5\u4FEE\u590D (v{version})\uFF0C\u8BF7\u5237\u65B0\u7A97\u53E3\u6216\u91CD\u542F DSH\u3002",
  "rescue.result.uninstalled": "\u5DF2\u5B89\u5168\u5378\u8F7D\u300C{packageName}\u300D\uFF0C\u8BF7\u5237\u65B0\u7A97\u53E3\u6216\u91CD\u542F DSH \u751F\u6548\u3002",
  "confirm.title": "\u66F4\u65B0\u63D2\u4EF6",
  "confirm.body": "\u786E\u8BA4\u5C06\u63D2\u4EF6\u300C{packageName}\u300D\u66F4\u65B0\u81F3\u6700\u65B0\u7248\u672C v{version} \u5417\uFF1F",
  "confirm.cancel": "\u53D6\u6D88",
  "confirm.ok": "\u786E\u8BA4\u66F4\u65B0",
  "confirm.close": "\u5173\u95ED",
  "settings.title": "\u63D2\u4EF6\u9ED8\u8BA4\u66F4\u65B0\u6E90\u914D\u7F6E",
  "settings.intro": "\u7B2C\u4E09\u65B9\u63D2\u4EF6\u66F4\u65B0\u65F6\u9ED8\u8BA4\u4F7F\u7528\u7684 npm \u4ED3\u5E93\u6E90\u3002",
  "settings.npmjs": "npm \u5B98\u65B9\u6E90",
  "settings.npmjsHint": "\u7248\u672C\u53D1\u5E03\u540E\u7ACB\u5373\u53EF\u7528\uFF0C\u65E0\u955C\u50CF\u540C\u6B65\u5EF6\u8FDF\u3002",
  "settings.npmmirror": "\u56FD\u5185\u6E90 npmmirror",
  "settings.npmmirrorHint": "\u56FD\u5185\u4E0B\u8F7D\u66F4\u5FEB\uFF1B\u955C\u50CF\u540C\u6B65\u53EF\u80FD\u6709\u5EF6\u8FDF\u3002",
  "settings.customFallbackName": "\u81EA\u5B9A\u4E49\u6E90",
  "settings.customHint": "\u81EA\u5B9A\u4E49 npm registry\u3002",
  "settings.customNamePlaceholder": "\u6E90\u5907\u6CE8\u540D\u79F0\uFF08\u53EF\u9009\uFF09",
  "settings.customUrlPlaceholder": "https://mirrors.example.com/npm/",
  "settings.addCustom": "+ \u6DFB\u52A0\u81EA\u5B9A\u4E49\u66F4\u65B0\u6E90",
  "settings.saveUse": "\u4FDD\u5B58\u5E76\u4F7F\u7528",
  "settings.cancel": "\u53D6\u6D88",
  "settings.delete": "\u5220\u9664",
  "settings.fallback": "\u975E\u5B98\u65B9\u6E90\u5B89\u88C5\u5931\u8D25\u65F6\uFF0C\u81EA\u52A8\u6539\u7528 npm \u5B98\u65B9\u6E90\u91CD\u8BD5\u4E00\u6B21",
  "settings.alwaysShowDetail": "\u59CB\u7EC8\u5728\u63D2\u4EF6\u8BE6\u60C5\u9875\u663E\u793A\u300C\u6781\u901F\u66F4\u65B0\u300D\u6309\u94AE",
  "settings.alwaysShowDetailHint": "\u5173\u95ED\u65F6\uFF0Cnpm \u5B98\u65B9\u6E90\u7684\u5E38\u89C4\u66F4\u65B0\u4EA4\u7531 DSH \u539F\u751F\u5904\u7406\uFF1BGitHub \u63D2\u4EF6\u53CA\u955C\u50CF/\u81EA\u5B9A\u4E49\u6E90\u4ECD\u7531\u672C\u63D2\u4EF6\u63A5\u7BA1\u3002\u5F00\u542F\u540E\u53EF\u968F\u65F6\u4ECE\u8BE6\u60C5\u9875\u4F7F\u7528\u5355\u6B65\u76F4\u88C5\u4E0E\u7B56\u7565\u8C41\u514D\u901A\u9053\u3002",
  "settings.notice.registryUpdated": "\u5DF2\u66F4\u65B0\u9ED8\u8BA4\u66F4\u65B0\u6E90",
  "settings.notice.customAdded": "\u5DF2\u6DFB\u52A0\u5E76\u5207\u6362\u81EA\u5B9A\u4E49\u6E90",
  "settings.notice.customRemoved": "\u5DF2\u79FB\u9664\u81EA\u5B9A\u4E49\u6E90",
  "settings.error.invalidUrl": "\u8BF7\u8F93\u5165\u5408\u6CD5\u7684 HTTP/HTTPS \u6E90\u5730\u5740",
  "settings.error.duplicate": "\u8BE5\u6E90\u5730\u5740\u5DF2\u5B58\u5728\uFF0C\u65E0\u9700\u91CD\u590D\u6DFB\u52A0",
  "settings.error.saveFailed": "\u4FDD\u5B58\u81EA\u5B9A\u4E49\u6E90\u5931\u8D25",
  "update.success": "\u5DF2\u66F4\u65B0\u81F3 v{version}\uFF0C\u8BF7\u5237\u65B0\u7A97\u53E3\u6216\u91CD\u542F DSH\u3002",
  "update.selfUpdate": "\u5DF2\u66F4\u65B0\u81F3 v{version}\uFF0C\u8BF7\u5B8C\u5168\u9000\u51FA\u5E76\u91CD\u542F DSH\u3002",
  "update.failed": "\u66F4\u65B0\u8BF7\u6C42\u5931\u8D25\uFF0C\u8BF7\u91CD\u8BD5",
  "check.timeout": "\u68C0\u67E5\u66F4\u65B0\u8D85\u65F6\uFF0C\u8BF7\u91CD\u8BD5",
  "check.network": "\u7F51\u7EDC\u5F02\u5E38\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5",
  "error.invalidPackageName": "\u5305\u540D\u4E0D\u5408\u6CD5",
  "error.invalidTargetVersion": "\u76EE\u6807\u7248\u672C\u53F7\u4E0D\u5408\u6CD5",
  "error.officialPlugin": "\u5B98\u65B9\u63D2\u4EF6\u7531 DSH \u81EA\u5E26\u7684\u66F4\u65B0\u5165\u53E3\u7BA1\u7406",
  "error.notInstalled": "\u8BE5\u63D2\u4EF6\u672A\u5B89\u88C5\u5230\u5F53\u524D profile\uFF0C\u65E0\u6CD5\u66F4\u65B0",
  "error.profileNotFound": "\u627E\u4E0D\u5230\u53EF\u7528\u7684 DSH profile \u76EE\u5F55",
  "error.installInProgress": "\u53E6\u4E00\u4E2A\u63D2\u4EF6\u6B63\u5728\u66F4\u65B0\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5",
  "error.offline": "\u7F51\u7EDC\u8FDE\u63A5\u5F02\u5E38\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u540E\u91CD\u8BD5",
  "error.installFailed": "\u5B89\u88C5\u547D\u4EE4\u6267\u884C\u5931\u8D25",
  "error.timeout": "\u64CD\u4F5C\u8D85\u65F6\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5",
  "error.verificationFailed": "\u5B89\u88C5\u540E\u7248\u672C\u6821\u9A8C\u672A\u901A\u8FC7",
  "error.rollbackFailed": "\u56DE\u6EDA\u5931\u8D25\uFF0Cprofile \u53EF\u80FD\u5904\u4E8E\u534A\u66F4\u65B0\u72B6\u6001",
  "error.selfUninstallBlocked": "\u4E0D\u80FD\u5728\u6025\u6551\u4E2D\u5FC3\u5378\u8F7D dsh-plugins-update \u81EA\u8EAB",
  "error.unknown": "\u672A\u77E5\u9519\u8BEF"
};
var en = {
  "action.checking": "Checking\u2026",
  "action.upToDate": "Up to date",
  "action.fastUpdate": "\u26A1 Fast Update (v{version})",
  "action.fastUpdateTip": "Bypass release age policy and update to latest version directly",
  "action.githubUpdate": "Update to v{version}",
  "action.updating": "Updating\u2026",
  "action.success": "Updated",
  "action.retry": "Retry",
  "badge.updateAvailable": "Update available",
  "badge.sidebarTip": "{count} plugin(s) have updates",
  "badge.issueDetected": "\u26A0\uFE0F Issue / Fix",
  "badge.issueAndUpdate": "\u26A0\uFE0F Issue \xB7 Fix available",
  "rescue.banner.hostUpgradedTitle": "DSH upgraded to {version} \u2014 check plugin updates",
  "rescue.banner.crashTitle": "Detected {count} plugin(s) with errors or compatibility issues",
  "rescue.banner.desc": "Update to adapted versions, reinstall, or safely uninstall broken plugins without opening their detail pages.",
  "rescue.banner.openCenter": "Open Rescue Center",
  "rescue.banner.batchUpdate": "Update all ({count})",
  "rescue.banner.dismiss": "Dismiss",
  "rescue.modal.title": "\u{1F6E1}\uFE0F Plugin Health Diagnostics & Safe Rescue Center",
  "rescue.modal.subtitle": "Diagnose, update, reinstall, or safely uninstall unadapted or broken plugins independently when DSH updates cause errors or blank detail pages.",
  "rescue.center.title": "\u{1F6E1}\uFE0F Plugin Health Diagnostics & Safe Rescue Center",
  "rescue.center.intro": "Built to recover from errors, crashes, or unreachable detail pages caused by unadapted plugins after DSH updates.",
  "rescue.center.hostVersion": "Current DSH host version: {version}",
  "rescue.center.hostVersionUnknown": "Current DSH host version: Unknown",
  "rescue.center.diagnoseBtn": "\u{1F50D} Re-scan all plugins",
  "rescue.center.diagnosing": "Diagnosing installed third-party plugins\u2026",
  "rescue.center.batchUpdateBtn": "\u{1F680} Batch update all updatable plugins ({count})",
  "rescue.center.batchUpdating": "Batch updating ({done}/{total}): {packageName}\u2026",
  "rescue.center.batchDone": "Batch update finished: {ok} succeeded, {fail} failed",
  "rescue.center.allHealthy": "All {count} installed third-party plugin(s) look healthy.",
  "rescue.center.healthyTag": "Healthy",
  "rescue.center.currentVersion": "Installed v{version}",
  "rescue.center.latestVersion": "Latest v{version}",
  "rescue.center.openRescueModal": "Open Rescue Modal",
  "rescue.issue.bundleUnavailable": "Unavailable in host",
  "rescue.issue.bundleError": "Load error",
  "rescue.issue.entryMissing": "Missing files",
  "rescue.issue.unregisteredBundle": "Not registered",
  "rescue.issue.clientCrash": "UI crash detected",
  "rescue.action.updateFix": "\u26A1 Update to v{version}",
  "rescue.action.reinstall": "\u{1F504} Reinstall to repair",
  "rescue.action.uninstall": "\u{1F5D1}\uFE0F Safe uninstall",
  "rescue.action.confirmUninstall": 'Uninstall "{packageName}" from the current profile? You can reinstall it later anytime.',
  "rescue.status.updating": "Updating\u2026",
  "rescue.status.reinstalling": "Reinstalling\u2026",
  "rescue.status.uninstalling": "Uninstalling\u2026",
  "rescue.result.updated": "Updated to v{version}. Refresh the window or restart DSH.",
  "rescue.result.reinstalled": "Reinstalled and verified (v{version}). Refresh the window or restart DSH.",
  "rescue.result.uninstalled": 'Safely uninstalled "{packageName}". Refresh the window or restart DSH.',
  "confirm.title": "Update plugin",
  "confirm.body": 'Update plugin "{packageName}" to the latest version v{version}?',
  "confirm.cancel": "Cancel",
  "confirm.ok": "Update",
  "confirm.close": "Close",
  "settings.title": "Default update registry",
  "settings.intro": "The npm registry used by default when updating third-party plugins.",
  "settings.npmjs": "npm official",
  "settings.npmjsHint": "New releases are available immediately, without mirror sync delay.",
  "settings.npmmirror": "npmmirror",
  "settings.npmmirrorHint": "Faster in mainland China; mirror synchronization may lag behind.",
  "settings.customFallbackName": "Custom registry",
  "settings.customHint": "Custom npm registry.",
  "settings.customNamePlaceholder": "Registry label (optional)",
  "settings.customUrlPlaceholder": "https://mirrors.example.com/npm/",
  "settings.addCustom": "+ Add custom registry",
  "settings.saveUse": "Save and use",
  "settings.cancel": "Cancel",
  "settings.delete": "Delete",
  "settings.fallback": "Retry once on the npm official registry when a non-official registry fails",
  "settings.alwaysShowDetail": "Always show the Fast Update button on plugin detail pages",
  "settings.alwaysShowDetailHint": "When off, standard npm official updates yield to DSH native; GitHub plugins and mirror/custom registries remain handled here. Turn on to force direct install & policy bypass on detail pages.",
  "settings.notice.registryUpdated": "Default registry updated",
  "settings.notice.customAdded": "Custom registry added and selected",
  "settings.notice.customRemoved": "Custom registry removed",
  "settings.error.invalidUrl": "Enter a valid HTTP/HTTPS registry URL",
  "settings.error.duplicate": "This registry URL is already in the list",
  "settings.error.saveFailed": "Failed to save the custom registry",
  "update.success": "Updated to v{version}. Refresh the window or restart DSH.",
  "update.selfUpdate": "Updated to v{version}. Fully quit and restart DSH.",
  "update.failed": "Update request failed. Please retry.",
  "check.timeout": "Update check timed out. Please retry.",
  "check.network": "Network error. Check your connection and retry.",
  "error.invalidPackageName": "Invalid package name",
  "error.invalidTargetVersion": "Invalid target version",
  "error.officialPlugin": "Official plugins are managed by DSH built-in update",
  "error.notInstalled": "This plugin is not installed in the current profile",
  "error.profileNotFound": "No usable DSH profile directory was found",
  "error.installInProgress": "Another plugin is being updated. Please try again later",
  "error.offline": "Network error. Check your connection and retry",
  "error.installFailed": "Install command failed",
  "error.timeout": "Operation timed out. Please retry",
  "error.verificationFailed": "Post-install version verification failed",
  "error.rollbackFailed": "Rollback failed; the profile may be partially updated",
  "error.selfUninstallBlocked": "Cannot uninstall dsh-plugins-update itself from the Rescue Center",
  "error.unknown": "Unknown error"
};

// src/client.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var CHECK_TIMEOUT_MS = 15e3;
var BATCH_CHECK_TIMEOUT_MS = 25e3;
var DIAGNOSE_TIMEOUT_MS = 25e3;
var UPDATE_TIMEOUT_MS = 3e5;
function isUsableComponent(comp) {
  return typeof comp === "function" || typeof comp === "object" && comp !== null;
}
var SafeErrorBoundary = class extends import_react.default.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch() {
  }
  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
};
var SafeButton = ({ variant = "outline", size = "md", style, children, disabled, ...rest }) => {
  const isPrimary = variant === "primary";
  const isDanger = variant === "danger";
  const isSm = size === "sm";
  const fallback = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      disabled,
      style: {
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
        padding: isSm ? "4px 10px" : "6px 14px",
        fontSize: isSm ? 12 : 13,
        fontWeight: 500,
        borderRadius: 6,
        border: isPrimary ? "1px solid var(--dsw-alias-primary, #2563eb)" : isDanger ? "1px solid #ef4444" : "1px solid var(--dsw-alias-border-l1, #cbd5e1)",
        background: isPrimary ? "var(--dsw-alias-primary, #2563eb)" : isDanger ? "#dc2626" : "var(--dsw-alias-bg-elevated, #ffffff)",
        color: isPrimary || isDanger ? "#ffffff" : "var(--dsw-alias-label-primary, #1e293b)",
        opacity: disabled ? 0.55 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        lineHeight: 1.4,
        ...style
      },
      ...rest,
      children
    }
  );
  if (!isUsableComponent(import_dsh_client_ui_primitives.Button)) return fallback;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeErrorBoundary, { fallback, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: variant === "danger" ? "outline" : variant, size, style, disabled, ...rest, children }) });
};
var SafeTag = ({ tone = "info", style, children, ...rest }) => {
  const palette = tone === "warning" || tone === "danger" ? { bg: "rgba(239, 68, 68, 0.12)", border: "rgba(239, 68, 68, 0.35)", color: "#dc2626" } : tone === "success" ? { bg: "rgba(22, 163, 74, 0.12)", border: "rgba(22, 163, 74, 0.3)", color: "#15803d" } : { bg: "rgba(37, 99, 235, 0.1)", border: "rgba(37, 99, 235, 0.25)", color: "var(--dsw-alias-primary, #2563eb)" };
  const fallback = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "span",
    {
      style: {
        display: "inline-flex",
        alignItems: "center",
        padding: "1px 7px",
        fontSize: 11,
        fontWeight: 500,
        borderRadius: 999,
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        color: palette.color,
        lineHeight: 1.5,
        whiteSpace: "nowrap",
        ...style
      },
      ...rest,
      children
    }
  );
  if (!isUsableComponent(import_dsh_client_ui_primitives.Tag) || tone === "warning" || tone === "danger") return fallback;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeErrorBoundary, { fallback, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tag, { tone, style, ...rest, children }) });
};
var SafeModal = ({ open, onClose, title, description, footer, children, closeLabel }) => {
  if (!open) return null;
  const fallback = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      onClick: () => onClose?.(),
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 1e4,
        background: "rgba(15, 23, 42, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
        "div",
        {
          onClick: (event) => event.stopPropagation(),
          style: {
            width: "100%",
            maxWidth: 680,
            maxHeight: "85vh",
            overflow: "auto",
            borderRadius: 12,
            padding: 20,
            background: "var(--dsw-alias-bg-elevated, #ffffff)",
            color: "var(--dsw-alias-label-primary, #1e293b)",
            border: "1px solid var(--dsw-alias-border-l1, #e2e8f0)",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.25)",
            boxSizing: "border-box"
          },
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 16, fontWeight: 600 }, children: title }),
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "button",
                {
                  type: "button",
                  "aria-label": closeLabel || "Close",
                  onClick: () => onClose?.(),
                  style: {
                    border: "none",
                    background: "transparent",
                    color: "var(--dsw-alias-label-secondary, #64748b)",
                    cursor: "pointer",
                    fontSize: 18,
                    lineHeight: 1,
                    padding: "2px 6px"
                  },
                  children: "\xD7"
                }
              )
            ] }),
            description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 13, color: "var(--dsw-alias-label-secondary, #64748b)", marginBottom: 12 }, children: description }),
            children,
            footer && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }, children: footer })
          ]
        }
      )
    }
  );
  if (children || !isUsableComponent(import_dsh_client_ui_primitives.Modal)) return fallback;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeErrorBoundary, { fallback, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    import_dsh_client_ui_primitives.Modal,
    {
      open,
      onClose,
      title,
      closeLabel,
      description,
      footer
    }
  ) });
};
var DEFAULT_SETTINGS = {
  registry: "npmjs",
  customRegistries: [],
  fallbackToOfficial: true,
  alwaysShowDetailButton: false
};
function interpolate(template, params) {
  if (!params) return template;
  return template.replace(
    /\{(\w+)\}/g,
    (match, name2) => Object.prototype.hasOwnProperty.call(params, name2) ? String(params[name2]) : match
  );
}
function translateFromZh(key, params) {
  const dictionary = zh;
  return interpolate(Object.prototype.hasOwnProperty.call(dictionary, key) ? dictionary[key] : key, params);
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
    if (ctx?.locale && typeof ctx.locale === "object") return ctx.locale;
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
    } catch {
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
    } catch {
      return void 0;
    }
  };
  if (typeof ctx?.effect === "function") {
    try {
      ctx.effect(register, "dsh-plugins-update: locale dictionaries");
      return;
    } catch {
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
  [ERROR_CODES.offline]: "error.offline",
  [ERROR_CODES.installFailed]: "error.installFailed",
  [ERROR_CODES.timeout]: "error.timeout",
  [ERROR_CODES.verificationFailed]: "error.verificationFailed",
  [ERROR_CODES.rollbackFailed]: "error.rollbackFailed",
  [ERROR_CODES.selfUninstallBlocked]: "error.selfUninstallBlocked"
};
function errorText(t, errorCode, fallback) {
  const key = errorCode ? ERROR_KEY_BY_CODE[errorCode] : void 0;
  return key ? t(key) : fallback || t("error.unknown");
}
function isOfficialPackage(pkg) {
  return pkg?.official === true || isOfficialPackageName(pkg?.name);
}
var UPDATABLE_STORAGE_KEY = "dsh-plugins-update:updatable-v1";
var UPDATED_SESSION_KEY = "dsh-plugins-update:updated-in-session-v1";
var UI_PREFS_STORAGE_KEY = "dsh-plugins-update:ui-prefs-v1";
var LAST_HOST_VERSION_KEY = "dsh-plugins-update:last-host-version-v1";
var DISMISSED_RESCUE_KEY = "dsh-plugins-update:dismissed-rescue-v1";
var uiPrefs = {
  registryUrl: OFFICIAL_REGISTRY,
  alwaysShowDetailButton: false
};
var uiPrefsListeners = /* @__PURE__ */ new Set();
function loadUiPrefs() {
  try {
    const raw = window.localStorage?.getItem(UI_PREFS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      const normalized = normalizeRegistryUrl(parsed.registryUrl);
      if (normalized) uiPrefs.registryUrl = normalized;
      if (typeof parsed.alwaysShowDetailButton === "boolean") {
        uiPrefs.alwaysShowDetailButton = parsed.alwaysShowDetailButton;
      }
    }
  } catch {
  }
}
loadUiPrefs();
function notifyUiPrefsChanged() {
  try {
    window.localStorage?.setItem(UI_PREFS_STORAGE_KEY, JSON.stringify(uiPrefs));
  } catch {
  }
  for (const listener of uiPrefsListeners) {
    try {
      listener();
    } catch {
    }
  }
}
function syncUiPrefs(next) {
  let changed = false;
  if (next.registryUrl !== void 0) {
    const normalized = normalizeRegistryUrl(next.registryUrl);
    if (normalized && normalized !== uiPrefs.registryUrl) {
      uiPrefs.registryUrl = normalized;
      changed = true;
    }
  }
  if (typeof next.alwaysShowDetailButton === "boolean" && next.alwaysShowDetailButton !== uiPrefs.alwaysShowDetailButton) {
    uiPrefs.alwaysShowDetailButton = next.alwaysShowDetailButton;
    changed = true;
  }
  if (changed) notifyUiPrefsChanged();
}
function useUiPrefs() {
  const [snapshot, setSnapshot] = (0, import_react.useState)(() => ({ ...uiPrefs }));
  (0, import_react.useEffect)(() => {
    const sync = () => setSnapshot({ ...uiPrefs });
    uiPrefsListeners.add(sync);
    sync();
    return () => {
      uiPrefsListeners.delete(sync);
    };
  }, []);
  return snapshot;
}
var updatablePlugins = /* @__PURE__ */ new Map();
var updatedInSession = /* @__PURE__ */ new Map();
var updatableListeners = /* @__PURE__ */ new Set();
var hasRunInitialBatchCheck = false;
var batchCheckAbortController = null;
var unhealthyPlugins = /* @__PURE__ */ new Map();
var crashedPlugins = /* @__PURE__ */ new Map();
var knownThirdPartyPackages = /* @__PURE__ */ new Set();
var rescueListeners = /* @__PURE__ */ new Set();
var hostUpgradeState = { upgraded: false };
var rescueModalState = { open: false };
var lastClickedPlugin = null;
var dismissedRescueSignature = "";
try {
  dismissedRescueSignature = window.localStorage?.getItem(DISMISSED_RESCUE_KEY) || "";
} catch {
}
function notifyRescueChanged() {
  for (const listener of rescueListeners) {
    try {
      listener();
    } catch {
    }
  }
}
function openRescueModal(focusPackage, autoBatch = false) {
  rescueModalState = { open: true, focusPackage, autoBatch };
  notifyRescueChanged();
}
function closeRescueModal() {
  if (!rescueModalState.open) return;
  rescueModalState = { open: false };
  notifyRescueChanged();
}
function recordClientCrash(packageName, detail) {
  const name2 = packageName.trim();
  if (!name2 || name2 === PLUGIN_NAME || isOfficialPackageName(name2)) return;
  const cleanDetail = (detail || "Runtime error").trim().slice(0, 300);
  if (crashedPlugins.get(name2) === cleanDetail) return;
  crashedPlugins.set(name2, cleanDetail);
  dismissedRescueSignature = "";
  try {
    window.localStorage?.removeItem(DISMISSED_RESCUE_KEY);
  } catch {
  }
  notifyRescueChanged();
}
function clearPluginHealthState(packageName) {
  const name2 = packageName.trim();
  if (!name2) return;
  const removedUnhealthy = unhealthyPlugins.delete(name2);
  const removedCrash = crashedPlugins.delete(name2);
  if (removedUnhealthy || removedCrash) {
    notifyRescueChanged();
  }
}
function computeRescueSignature() {
  const issueKeys = Array.from(/* @__PURE__ */ new Set([...unhealthyPlugins.keys(), ...crashedPlugins.keys()])).sort();
  return JSON.stringify({
    host: hostUpgradeState.upgraded ? hostUpgradeState.current || "" : "",
    issues: issueKeys
  });
}
function dismissCurrentRescueBanner() {
  const sig = computeRescueSignature();
  dismissedRescueSignature = sig;
  try {
    window.localStorage?.setItem(DISMISSED_RESCUE_KEY, sig);
  } catch {
  }
  notifyRescueChanged();
}
function buildRescueSnapshot() {
  return {
    unhealthy: new Map(unhealthyPlugins),
    crashes: new Map(crashedPlugins),
    hostUpgrade: { ...hostUpgradeState },
    modal: { ...rescueModalState },
    dismissedSignature: dismissedRescueSignature
  };
}
function useRescueSnapshot() {
  const [snapshot, setSnapshot] = (0, import_react.useState)(buildRescueSnapshot);
  (0, import_react.useEffect)(() => {
    const sync = () => setSnapshot(buildRescueSnapshot());
    rescueListeners.add(sync);
    sync();
    return () => {
      rescueListeners.delete(sync);
    };
  }, []);
  return snapshot;
}
var IGNORED_NODE_MODULES = /* @__PURE__ */ new Set([
  "react",
  "react-dom",
  "scheduler",
  "cordis",
  "schemastery",
  PLUGIN_NAME
]);
function extractPackageFromStackText(text) {
  if (!text) return null;
  const normalized = text.replace(/\\/g, "/");
  const nmRegex = /node_modules\/((?:@[a-z0-9._~-]+\/)?[a-z0-9._~-]+)/gi;
  let match;
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
  const sortedKnown = Array.from(knownThirdPartyPackages).filter((n) => n && n !== PLUGIN_NAME && !isOfficialPackageName(n)).sort((a, b) => b.length - a.length);
  for (const pkg of sortedKnown) {
    if (normalized.includes(`/${pkg}/`) || normalized.includes(`"${pkg}"`) || normalized.includes(`'${pkg}'`)) {
      return pkg;
    }
  }
  return null;
}
function attributePluginCrash(message, stackOrFile) {
  const combined = `${stackOrFile}
${message}`;
  if (stackOrFile.includes(`/${PLUGIN_NAME}/`) || stackOrFile.includes(`\\${PLUGIN_NAME}\\`) || message.includes(`"${PLUGIN_NAME}"`)) {
    return;
  }
  const fromStack = extractPackageFromStackText(combined);
  if (fromStack) {
    recordClientCrash(fromStack, message || "Uncaught error");
    return;
  }
  if (lastClickedPlugin && Date.now() - lastClickedPlugin.timestamp <= 1500) {
    recordClientCrash(lastClickedPlugin.name, message || "Error immediately after opening plugin");
    return;
  }
  const detailEl = document.querySelector("[data-plugin-detail]");
  if (detailEl && lastClickedPlugin && Date.now() - lastClickedPlugin.timestamp <= 4e3) {
    recordClientCrash(lastClickedPlugin.name, message || "Plugin detail page error");
  }
}
function loadStorageMap(storage, key, target) {
  try {
    const raw = storage?.getItem(key);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof k === "string" && typeof v === "string" && k && v) {
          target.set(k, v);
        }
      }
    }
  } catch {
  }
}
function saveStorageMap(storage, key, source) {
  try {
    const obj = {};
    for (const [k, v] of source.entries()) obj[k] = v;
    storage?.setItem(key, JSON.stringify(obj));
  } catch {
  }
}
try {
  loadStorageMap(window.localStorage, UPDATABLE_STORAGE_KEY, updatablePlugins);
  loadStorageMap(window.sessionStorage, UPDATED_SESSION_KEY, updatedInSession);
} catch {
}
function persistUpdatablePlugins() {
  try {
    saveStorageMap(window.localStorage, UPDATABLE_STORAGE_KEY, updatablePlugins);
  } catch {
  }
}
function notifyUpdatableChanged() {
  for (const listener of updatableListeners) {
    try {
      listener();
    } catch {
    }
  }
}
function markPluginUpdatable(packageName, latestVersion) {
  const name2 = packageName.trim();
  const ver = latestVersion.trim().replace(/^[v^~]/, "");
  if (!name2 || !ver || isOfficialPackageName(name2)) return;
  const alreadyUpdatedTo = updatedInSession.get(name2);
  if (alreadyUpdatedTo && versionGte(alreadyUpdatedTo, ver)) return;
  if (updatablePlugins.get(name2) === ver) return;
  updatablePlugins.set(name2, ver);
  persistUpdatablePlugins();
  notifyUpdatableChanged();
}
function clearPluginUpdatable(packageName, updatedToVersion) {
  const name2 = packageName.trim();
  if (!name2) return;
  if (updatedToVersion) {
    const cleanVer = updatedToVersion.trim().replace(/^[v^~]/, "");
    if (cleanVer) {
      updatedInSession.set(name2, cleanVer);
      try {
        saveStorageMap(window.sessionStorage, UPDATED_SESSION_KEY, updatedInSession);
      } catch {
      }
    }
  }
  if (updatablePlugins.delete(name2)) {
    persistUpdatablePlugins();
    notifyUpdatableChanged();
  }
}
function syncHostVersionState(hostVersion) {
  if (!hostVersion || !hostVersion.trim()) return false;
  const current = hostVersion.trim();
  let prev = "";
  try {
    prev = window.localStorage?.getItem(LAST_HOST_VERSION_KEY) || "";
    if (prev !== current) {
      window.localStorage?.setItem(LAST_HOST_VERSION_KEY, current);
    }
  } catch {
  }
  if (prev && prev !== current) {
    hostUpgradeState = { previous: prev, current, upgraded: true };
    notifyRescueChanged();
    return true;
  }
  if (!hostUpgradeState.current) {
    hostUpgradeState = { ...hostUpgradeState, current };
    notifyRescueChanged();
  }
  return false;
}
function syncUnhealthyPluginsMap(nextUnhealthy) {
  if (!nextUnhealthy || typeof nextUnhealthy !== "object") return;
  const nextKeys = Object.keys(nextUnhealthy);
  let changed = nextKeys.length !== unhealthyPlugins.size;
  if (!changed) {
    for (const key of nextKeys) {
      const prev = unhealthyPlugins.get(key);
      const curr = nextUnhealthy[key];
      if (!prev || prev.errorDetail !== curr.errorDetail || prev.issues.join(",") !== (curr.issues || []).join(",")) {
        changed = true;
        break;
      }
    }
  }
  if (!changed) return;
  unhealthyPlugins.clear();
  for (const [pkg, summary] of Object.entries(nextUnhealthy)) {
    if (pkg && summary && Array.isArray(summary.issues) && summary.issues.length > 0) {
      unhealthyPlugins.set(pkg, summary);
      knownThirdPartyPackages.add(pkg);
    }
  }
  notifyRescueChanged();
}
function runBatchCheck(force = false, reconcileOnly = false) {
  if (!force && !reconcileOnly && hasRunInitialBatchCheck) return;
  hasRunInitialBatchCheck = true;
  if (batchCheckAbortController) {
    if (!force && !reconcileOnly) return;
    batchCheckAbortController.abort();
  }
  const controller = new AbortController();
  batchCheckAbortController = controller;
  const timer = window.setTimeout(() => controller.abort(), BATCH_CHECK_TIMEOUT_MS);
  const knownUpdates = {};
  for (const [k, v] of updatablePlugins.entries()) {
    knownUpdates[k] = v;
  }
  const reqBody = {
    knownUpdates,
    force,
    ...reconcileOnly ? { reconcile: true } : {}
  };
  fetch(CHECK_ALL_PATH, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(reqBody),
    signal: controller.signal
  }).then((res) => res.json().catch(() => null)).then((payload) => {
    if (batchCheckAbortController !== controller) return;
    if (!payload || typeof payload !== "object" || payload.ok === false) return;
    syncUiPrefs({
      registryUrl: payload.registry,
      alwaysShowDetailButton: payload.alwaysShowDetailButton
    });
    syncUnhealthyPluginsMap(payload.unhealthy);
    const hostJustUpgraded = syncHostVersionState(payload.hostVersion);
    if (payload.updatable && typeof payload.updatable === "object") {
      const nextMap = /* @__PURE__ */ new Map();
      for (const [rawName, rawVer] of Object.entries(payload.updatable)) {
        if (typeof rawName !== "string" || typeof rawVer !== "string") continue;
        const name2 = rawName.trim();
        const ver = rawVer.trim().replace(/^[v^~]/, "");
        if (!name2 || !ver || isOfficialPackageName(name2)) continue;
        knownThirdPartyPackages.add(name2);
        const alreadyUpdatedTo = updatedInSession.get(name2);
        if (alreadyUpdatedTo && versionGte(alreadyUpdatedTo, ver)) continue;
        nextMap.set(name2, ver);
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
    if (hostJustUpgraded && !force) {
      window.setTimeout(() => runBatchCheck(true), 50);
    }
  }).catch(() => {
  }).finally(() => {
    window.clearTimeout(timer);
    if (batchCheckAbortController === controller) {
      batchCheckAbortController = null;
    }
  });
}
function useUpdatableSnapshot() {
  const [entries, setEntries] = (0, import_react.useState)(() => Array.from(updatablePlugins.entries()));
  (0, import_react.useEffect)(() => {
    const sync = () => setEntries(Array.from(updatablePlugins.entries()));
    updatableListeners.add(sync);
    sync();
    return () => {
      updatableListeners.delete(sync);
    };
  }, []);
  return entries;
}
function useConfigFormState(form) {
  const [snapshot, setSnapshot] = (0, import_react.useState)(() => form?.getSnapshot ? form.getSnapshot() : {});
  (0, import_react.useEffect)(() => {
    if (!form?.subscribe) return void 0;
    const unsubscribe = form.subscribe(() => setSnapshot(form.getSnapshot?.() ?? {}));
    setSnapshot(form.getSnapshot?.() ?? {});
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [form]);
  const raw = snapshot?.value;
  const settings = {
    registry: typeof raw?.registry === "string" && raw.registry !== "auto" ? raw.registry : DEFAULT_SETTINGS.registry,
    customRegistries: Array.isArray(raw?.customRegistries) ? raw.customRegistries.filter((item) => item && typeof item.url === "string") : DEFAULT_SETTINGS.customRegistries,
    fallbackToOfficial: typeof raw?.fallbackToOfficial === "boolean" ? raw.fallbackToOfficial : DEFAULT_SETTINGS.fallbackToOfficial,
    alwaysShowDetailButton: typeof raw?.alwaysShowDetailButton === "boolean" ? raw.alwaysShowDetailButton : DEFAULT_SETTINGS.alwaysShowDetailButton
  };
  const hasRaw = Boolean(raw && typeof raw === "object");
  (0, import_react.useEffect)(() => {
    if (!hasRaw) return;
    syncUiPrefs({
      registryUrl: resolveRegistryUrl(settings.registry),
      alwaysShowDetailButton: settings.alwaysShowDetailButton
    });
  }, [settings.registry, settings.alwaysShowDetailButton, hasRaw]);
  const updateField = (0, import_react.useCallback)(
    async (field, value) => {
      if (!form?.set) return false;
      try {
        const ok = await form.set(field, value) !== false;
        if (ok) {
          if (field === "registry" && typeof value === "string") {
            syncUiPrefs({ registryUrl: resolveRegistryUrl(value) });
          } else if (field === "alwaysShowDetailButton" && typeof value === "boolean") {
            syncUiPrefs({ alwaysShowDetailButton: value });
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
var cardStyle = {
  padding: "16px 20px",
  borderRadius: "10px",
  background: "var(--dsw-alias-bg-elevated, #ffffff)",
  border: "1px solid var(--dsw-alias-border-l1, #e2e8f0)",
  fontSize: "13px",
  color: "var(--dsw-alias-label-primary, #1e293b)",
  lineHeight: 1.6,
  boxSizing: "border-box"
};
var hintStyle = {
  fontSize: "12px",
  color: "var(--dsw-alias-label-secondary, #64748b)",
  marginTop: "3px"
};
var optionStyle = (active) => ({
  display: "flex",
  alignItems: "flex-start",
  padding: "10px 12px",
  borderRadius: "8px",
  border: active ? "1.5px solid var(--dsw-alias-primary, #2563eb)" : "1px solid var(--dsw-alias-border-l2, #e2e8f0)",
  background: active ? "rgba(37, 99, 235, 0.04)" : "var(--dsw-alias-bg-subtle, #f8fafc)",
  marginBottom: "8px",
  cursor: "pointer"
});
var smallButtonStyle = {
  padding: "3px 8px",
  fontSize: "12px",
  borderRadius: "6px",
  border: "1px solid var(--dsw-alias-border-l1, #cbd5e1)",
  background: "var(--dsw-alias-bg-elevated, #ffffff)",
  color: "var(--dsw-alias-label-primary, #334155)",
  cursor: "pointer"
};
var ISSUE_LABEL_KEY = {
  "bundle-unavailable": "rescue.issue.bundleUnavailable",
  "bundle-error": "rescue.issue.bundleError",
  "entry-missing": "rescue.issue.entryMissing",
  "unregistered-bundle": "rescue.issue.unregisteredBundle",
  "client-crash": "rescue.issue.clientCrash"
};
function syncDiagnosticsStores(payload) {
  syncHostVersionState(payload.hostVersion);
  const nextUnhealthy = {};
  for (const item of payload.plugins) {
    if (item.hasUpdate && item.latestVersion) {
      markPluginUpdatable(item.packageName, item.latestVersion);
    } else {
      clearPluginUpdatable(item.packageName, item.currentVersion);
    }
    const backendIssues = item.issues.filter((kind) => kind !== "client-crash");
    if (backendIssues.length > 0) {
      nextUnhealthy[item.packageName] = {
        issues: backendIssues,
        errorDetail: item.errorDetail,
        currentVersion: item.currentVersion
      };
    }
  }
  syncUnhealthyPluginsMap(nextUnhealthy);
}
var RescueCenterPanel = ({ t, focusPackage, autoBatch, compact }) => {
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [report, setReport] = (0, import_react.useState)(null);
  const [diagnoseError, setDiagnoseError] = (0, import_react.useState)("");
  const [busyPkg, setBusyPkg] = (0, import_react.useState)(null);
  const [busyAction, setBusyAction] = (0, import_react.useState)(null);
  const [confirmUninstallPkg, setConfirmUninstallPkg] = (0, import_react.useState)(null);
  const [actionFeedback, setActionFeedback] = (0, import_react.useState)({});
  const [batchState, setBatchState] = (0, import_react.useState)(null);
  const mountedRef = (0, import_react.useRef)(true);
  const busyRef = (0, import_react.useRef)(false);
  const didAutoBatchRef = (0, import_react.useRef)(false);
  (0, import_react.useEffect)(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const runDiagnose = (0, import_react.useCallback)(async (forceCheckUpdates = false) => {
    setLoading(true);
    setDiagnoseError("");
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), DIAGNOSE_TIMEOUT_MS);
    try {
      const crashesObj = {};
      for (const [k, v] of crashedPlugins.entries()) crashesObj[k] = v;
      const response = await fetch(DIAGNOSE_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ forceCheckUpdates, clientCrashes: crashesObj }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null);
      if (!mountedRef.current) return null;
      if (!payload || typeof payload !== "object" || payload.ok === false) {
        setDiagnoseError(errorText(t, payload?.errorCode, payload?.error));
        return null;
      }
      setReport(payload);
      syncDiagnosticsStores(payload);
      return payload;
    } catch (error) {
      if (!mountedRef.current) return null;
      setDiagnoseError(error?.name === "AbortError" ? t("check.timeout") : t("check.network"));
      return null;
    } finally {
      window.clearTimeout(timer);
      if (mountedRef.current) setLoading(false);
    }
  }, [t]);
  const executeSingleRescue = (0, import_react.useCallback)(
    async (pkg, action) => {
      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), UPDATE_TIMEOUT_MS);
      try {
        const response = await fetch(RESCUE_PATH, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            packageName: pkg.packageName,
            action,
            targetVersion: action === "update" ? pkg.latestVersion : void 0,
            source: pkg.source
          }),
          signal: controller.signal
        });
        const payload = await response.json().catch(() => null);
        if (!mountedRef.current) return false;
        if (!payload || typeof payload !== "object" || payload.ok === false) {
          const baseError = errorText(t, payload?.errorCode, payload?.error);
          const fullError = payload?.rollback === "failed" && payload?.errorCode !== ERROR_CODES.rollbackFailed ? `${baseError} (${t("error.rollbackFailed")})` : baseError;
          setActionFeedback((prev) => ({
            ...prev,
            [pkg.packageName]: { ok: false, text: fullError }
          }));
          return false;
        }
        const finalVersion = payload.targetVersion || pkg.latestVersion || pkg.currentVersion;
        if (action === "uninstall") {
          clearPluginUpdatable(pkg.packageName);
          clearPluginHealthState(pkg.packageName);
          setActionFeedback((prev) => ({
            ...prev,
            [pkg.packageName]: { ok: true, text: t("rescue.result.uninstalled", { packageName: pkg.packageName }) }
          }));
        } else {
          clearPluginUpdatable(pkg.packageName, finalVersion);
          clearPluginHealthState(pkg.packageName);
          const key = action === "reinstall" ? "rescue.result.reinstalled" : pkg.packageName === PLUGIN_NAME ? "update.selfUpdate" : "rescue.result.updated";
          setActionFeedback((prev) => ({
            ...prev,
            [pkg.packageName]: { ok: true, text: t(key, { version: finalVersion }) }
          }));
        }
        return true;
      } finally {
        window.clearTimeout(timer);
      }
    },
    [t]
  );
  const handleRescueAction = async (pkg, action) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setConfirmUninstallPkg(null);
    setBusyPkg(pkg.packageName);
    setBusyAction(action);
    try {
      const ok = await executeSingleRescue(pkg, action);
      if (ok && mountedRef.current) {
        runBatchCheck(true);
        await runDiagnose(false);
      }
    } catch {
      if (mountedRef.current) {
        setActionFeedback((prev) => ({
          ...prev,
          [pkg.packageName]: { ok: false, text: t("update.failed") }
        }));
      }
    } finally {
      busyRef.current = false;
      if (mountedRef.current) {
        setBusyPkg(null);
        setBusyAction(null);
      }
    }
  };
  const handleBatchUpdate = (0, import_react.useCallback)(
    async (plugins2) => {
      const targets = plugins2.filter((p) => p.hasUpdate && p.latestVersion).sort((a, b) => a.packageName === PLUGIN_NAME ? 1 : b.packageName === PLUGIN_NAME ? -1 : 0);
      if (targets.length === 0 || busyRef.current) return;
      busyRef.current = true;
      let okCount = 0;
      let failCount = 0;
      try {
        setBatchState({
          running: true,
          done: 0,
          total: targets.length,
          currentPkg: targets[0].packageName,
          okCount: 0,
          failCount: 0,
          finished: false
        });
        for (let i = 0; i < targets.length; i++) {
          const item = targets[i];
          if (!mountedRef.current) break;
          setBatchState({
            running: true,
            done: i,
            total: targets.length,
            currentPkg: item.packageName,
            okCount,
            failCount,
            finished: false
          });
          try {
            const ok = await executeSingleRescue(item, "update");
            if (ok) okCount += 1;
            else failCount += 1;
          } catch {
            failCount += 1;
            if (mountedRef.current) {
              setActionFeedback((prev) => ({
                ...prev,
                [item.packageName]: { ok: false, text: t("update.failed") }
              }));
            }
          }
        }
        if (!mountedRef.current) return;
        setBatchState({
          running: false,
          done: targets.length,
          total: targets.length,
          currentPkg: "",
          okCount,
          failCount,
          finished: true
        });
        runBatchCheck(true);
        await runDiagnose(false);
      } finally {
        busyRef.current = false;
      }
    },
    [executeSingleRescue, runDiagnose, t]
  );
  (0, import_react.useEffect)(() => {
    void runDiagnose(false).then((result) => {
      if (autoBatch && !didAutoBatchRef.current && result?.plugins?.length) {
        didAutoBatchRef.current = true;
        void handleBatchUpdate(result.plugins);
      }
    });
  }, [autoBatch, handleBatchUpdate, runDiagnose]);
  const plugins = report?.plugins || [];
  const updatableCount = plugins.filter((p) => p.hasUpdate && p.latestVersion).length;
  const unhealthyCount = plugins.filter((p) => !p.healthy).length;
  const hostVersionText = report?.hostVersion ? t("rescue.center.hostVersion", { version: report.hostVersion }) : t("rescue.center.hostVersionUnknown");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 10 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary, #64748b)" }, children: hostVersionText }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexWrap: "wrap", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          SafeButton,
          {
            variant: "outline",
            size: "sm",
            disabled: loading || Boolean(busyPkg) || Boolean(batchState?.running),
            onClick: () => void runDiagnose(true),
            children: loading ? t("rescue.center.diagnosing") : t("rescue.center.diagnoseBtn")
          }
        ),
        updatableCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          SafeButton,
          {
            variant: "primary",
            size: "sm",
            disabled: loading || Boolean(busyPkg) || Boolean(batchState?.running),
            onClick: () => void handleBatchUpdate(plugins),
            children: t("rescue.center.batchUpdateBtn", { count: updatableCount })
          }
        )
      ] })
    ] }),
    batchState && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          padding: "8px 10px",
          borderRadius: 8,
          fontSize: 12,
          background: batchState.finished ? "rgba(22, 163, 74, 0.08)" : "rgba(37, 99, 235, 0.08)",
          border: batchState.finished ? "1px solid rgba(22, 163, 74, 0.25)" : "1px solid rgba(37, 99, 235, 0.25)",
          color: batchState.finished ? "#15803d" : "var(--dsw-alias-label-primary, #1e293b)"
        },
        children: batchState.running ? t("rescue.center.batchUpdating", {
          done: batchState.done,
          total: batchState.total,
          packageName: batchState.currentPkg
        }) : t("rescue.center.batchDone", { ok: batchState.okCount, fail: batchState.failCount })
      }
    ),
    diagnoseError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: "#dc2626", padding: "6px 10px", borderRadius: 6, background: "rgba(239, 68, 68, 0.08)" }, children: diagnoseError }),
    !loading && !diagnoseError && plugins.length > 0 && unhealthyCount === 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: "#15803d" }, children: t("rescue.center.allHealthy", { count: plugins.length }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "div",
      {
        style: {
          display: "flex",
          flexDirection: "column",
          gap: 8,
          maxHeight: compact ? 320 : 420,
          overflowY: "auto",
          paddingRight: 2
        },
        children: plugins.map((item) => {
          const isFocused = Boolean(focusPackage && item.packageName === focusPackage);
          const isBusy = busyPkg === item.packageName;
          const feedback = actionFeedback[item.packageName];
          const isConfirmingUninstall = confirmUninstallPkg === item.packageName;
          const isSelf = item.packageName === PLUGIN_NAME;
          return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "div",
            {
              ref: (el) => {
                if (isFocused && el) {
                  try {
                    el.scrollIntoView({ block: "nearest" });
                  } catch {
                  }
                }
              },
              style: {
                padding: "10px 12px",
                borderRadius: 8,
                border: isFocused ? "1.5px solid #f59e0b" : !item.healthy ? "1px solid rgba(239, 68, 68, 0.4)" : "1px solid var(--dsw-alias-border-l2, #e2e8f0)",
                background: !item.healthy ? "rgba(239, 68, 68, 0.03)" : "var(--dsw-alias-bg-subtle, #f8fafc)"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 6 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6 }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontWeight: 600, fontSize: 13 }, children: item.packageName }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 11, fontFamily: "monospace", color: "var(--dsw-alias-label-secondary, #64748b)" }, children: t("rescue.center.currentVersion", { version: item.currentVersion }) }),
                  item.hasUpdate && item.latestVersion && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeTag, { tone: "info", children: t("rescue.center.latestVersion", { version: item.latestVersion }) }),
                  item.healthy ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeTag, { tone: "success", children: t("rescue.center.healthyTag") }) : item.issues.map((issue) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeTag, { tone: "warning", children: t(ISSUE_LABEL_KEY[issue] || "error.unknown") }, issue))
                ] }) }),
                item.errorDetail && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "div",
                  {
                    style: {
                      marginTop: 6,
                      fontSize: 11,
                      color: "#b91c1c",
                      fontFamily: "monospace",
                      wordBreak: "break-word",
                      background: "rgba(239, 68, 68, 0.06)",
                      padding: "4px 8px",
                      borderRadius: 6
                    },
                    children: item.errorDetail
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 8 }, children: [
                  item.hasUpdate && item.latestVersion && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    SafeButton,
                    {
                      variant: "primary",
                      size: "sm",
                      disabled: Boolean(busyPkg) || Boolean(batchState?.running),
                      onClick: () => void handleRescueAction(item, "update"),
                      children: isBusy && busyAction === "update" ? t("rescue.status.updating") : t("rescue.action.updateFix", { version: item.latestVersion })
                    }
                  ),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    SafeButton,
                    {
                      variant: !item.healthy && !item.hasUpdate ? "primary" : "outline",
                      size: "sm",
                      disabled: Boolean(busyPkg) || Boolean(batchState?.running),
                      onClick: () => void handleRescueAction(item, "reinstall"),
                      children: isBusy && busyAction === "reinstall" ? t("rescue.status.reinstalling") : t("rescue.action.reinstall")
                    }
                  ),
                  !isSelf && !isConfirmingUninstall && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                    SafeButton,
                    {
                      variant: "outline",
                      size: "sm",
                      style: { color: "#dc2626", borderColor: "rgba(239, 68, 68, 0.4)" },
                      disabled: Boolean(busyPkg) || Boolean(batchState?.running),
                      onClick: () => setConfirmUninstallPkg(item.packageName),
                      children: isBusy && busyAction === "uninstall" ? t("rescue.status.uninstalling") : t("rescue.action.uninstall")
                    }
                  )
                ] }),
                isConfirmingUninstall && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
                  "div",
                  {
                    style: {
                      marginTop: 8,
                      padding: "6px 8px",
                      borderRadius: 6,
                      background: "rgba(239, 68, 68, 0.08)",
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                      fontSize: 12
                    },
                    children: [
                      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: "#b91c1c" }, children: t("rescue.action.confirmUninstall", { packageName: item.packageName }) }),
                      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 6 }, children: [
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                          SafeButton,
                          {
                            variant: "danger",
                            size: "sm",
                            disabled: Boolean(busyPkg) || Boolean(batchState?.running),
                            onClick: () => void handleRescueAction(item, "uninstall"),
                            children: t("rescue.action.uninstall")
                          }
                        ),
                        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeButton, { variant: "outline", size: "sm", onClick: () => setConfirmUninstallPkg(null), children: t("confirm.cancel") })
                      ] })
                    ]
                  }
                ),
                feedback && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 6, fontSize: 12, color: feedback.ok ? "#15803d" : "#b91c1c" }, children: feedback.text })
              ]
            },
            item.packageName
          );
        })
      }
    )
  ] });
};
var BUILTIN_REGISTRIES = [
  { value: "npmjs", url: OFFICIAL_REGISTRY, labelKey: "settings.npmjs", hintKey: "settings.npmjsHint" },
  { value: "npmmirror", url: DOMESTIC_REGISTRY, labelKey: "settings.npmmirror", hintKey: "settings.npmmirrorHint" }
];
var RegistrySettingsCard = ({ form, t, locale }) => {
  useLocaleRevision(locale);
  const { settings, writable, updateField } = useConfigFormState(form);
  const [adding, setAdding] = (0, import_react.useState)(false);
  const [name2, setName] = (0, import_react.useState)("");
  const [url, setUrl] = (0, import_react.useState)("");
  const [errorKey, setErrorKey] = (0, import_react.useState)("");
  const [notice, setNotice] = (0, import_react.useState)(null);
  const noticeTimerRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);
  const showNotice = (key, params) => {
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    setNotice({ key, params });
    noticeTimerRef.current = window.setTimeout(() => {
      noticeTimerRef.current = null;
      setNotice(null);
    }, 2500);
  };
  const isCurrent = (value) => value === "npmjs" || value === "npmmirror" ? settings.registry === value : normalizeRegistryUrl(settings.registry) === normalizeRegistryUrl(value);
  const select = async (value) => {
    if (!writable || isCurrent(value)) return;
    if (await updateField("registry", value)) {
      showNotice("settings.notice.registryUpdated");
      runBatchCheck(true);
    }
  };
  const addCustom = async () => {
    setErrorKey("");
    const normalized = normalizeRegistryUrl(url);
    if (!normalized) {
      setErrorKey("settings.error.invalidUrl");
      return;
    }
    if (normalized === OFFICIAL_REGISTRY || normalized === DOMESTIC_REGISTRY || settings.customRegistries.some((item) => normalizeRegistryUrl(item.url) === normalized)) {
      setErrorKey("settings.error.duplicate");
      return;
    }
    const next = [...settings.customRegistries, { name: name2.trim(), url: normalized }];
    if (!await updateField("customRegistries", next) || !await updateField("registry", normalized)) {
      setErrorKey("settings.error.saveFailed");
      return;
    }
    setName("");
    setUrl("");
    setAdding(false);
    showNotice("settings.notice.customAdded");
    runBatchCheck(true);
  };
  const removeCustom = async (target) => {
    if (!writable) return;
    const normalized = normalizeRegistryUrl(target);
    const next = settings.customRegistries.filter((item) => normalizeRegistryUrl(item.url) !== normalized);
    if (!await updateField("customRegistries", next)) return;
    if (normalizeRegistryUrl(settings.registry) === normalized) {
      await updateField("registry", "npmjs");
      runBatchCheck(true);
    }
    showNotice("settings.notice.customRemoved");
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 14 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: cardStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 15, fontWeight: 600 }, children: t("settings.title") }),
        notice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 11, color: "#16a34a" }, children: t(notice.key, notice.params) })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...hintStyle, marginBottom: 10 }, children: t("settings.intro") }),
      BUILTIN_REGISTRIES.map((item) => {
        const active = isCurrent(item.value);
        return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...optionStyle(active), padding: 0, alignItems: "center", cursor: "default" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "label",
          {
            style: {
              display: "flex",
              alignItems: "flex-start",
              flex: 1,
              padding: "10px 12px",
              cursor: writable ? "pointer" : "default"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                "input",
                {
                  type: "radio",
                  checked: active,
                  onChange: () => void select(item.value),
                  disabled: !writable,
                  style: { marginRight: 10, marginTop: 3 }
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontWeight: 600 }, children: [
                  t(item.labelKey),
                  " ",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontFamily: "monospace", fontWeight: 400 }, children: item.url })
                ] }),
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: t(item.hintKey) })
              ] })
            ]
          }
        ) }, item.value);
      }),
      settings.customRegistries.map((item) => {
        const active = isCurrent(item.url);
        return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...optionStyle(active), padding: 0, alignItems: "center", cursor: "default" }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
            "label",
            {
              style: {
                display: "flex",
                alignItems: "flex-start",
                flex: 1,
                padding: "10px 12px",
                cursor: writable ? "pointer" : "default"
              },
              children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
                  "input",
                  {
                    type: "radio",
                    checked: active,
                    onChange: () => void select(item.url),
                    disabled: !writable,
                    style: { marginRight: 10, marginTop: 3 }
                  }
                ),
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1 }, children: [
                  /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontWeight: 600 }, children: [
                    item.name || t("settings.customFallbackName"),
                    " ",
                    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontFamily: "monospace", fontWeight: 400 }, children: item.url })
                  ] }),
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: t("settings.customHint") })
                ] })
              ]
            }
          ),
          writable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              style: { ...smallButtonStyle, color: "#dc2626", borderColor: "#fca5a5", alignSelf: "flex-start", marginTop: 10, marginRight: 12 },
              onClick: () => void removeCustom(item.url),
              children: t("settings.delete")
            }
          )
        ] }, item.url);
      }),
      !adding && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: smallButtonStyle, onClick: () => setAdding(true), disabled: !writable, children: t("settings.addCustom") }),
      adding && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: name2, onChange: (event) => setName(event.target.value), placeholder: t("settings.customNamePlaceholder"), style: { height: 32, padding: "0 10px", borderRadius: 6, border: "1px solid var(--dsw-alias-border-l1, #cbd5e1)" } }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { value: url, onChange: (event) => setUrl(event.target.value), placeholder: t("settings.customUrlPlaceholder"), style: { height: 32, padding: "0 10px", borderRadius: 6, border: "1px solid var(--dsw-alias-border-l1, #cbd5e1)" } }),
        errorKey && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "#b91c1c", fontSize: 12 }, children: t(errorKey) }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: smallButtonStyle, onClick: () => void addCustom(), disabled: !writable, children: t("settings.saveUse") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: smallButtonStyle, onClick: () => {
            setAdding(false);
            setErrorKey("");
          }, children: t("settings.cancel") })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "flex", alignItems: "flex-start", gap: 8, marginTop: 14, fontSize: 12, color: "var(--dsw-alias-label-secondary, #64748b)" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "checkbox",
            checked: settings.fallbackToOfficial,
            disabled: !writable,
            onChange: () => void updateField("fallbackToOfficial", !settings.fallbackToOfficial),
            style: { marginTop: 2 }
          }
        ),
        t("settings.fallback")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("label", { style: { display: "flex", alignItems: "flex-start", gap: 8, marginTop: 12, fontSize: 12, color: "var(--dsw-alias-label-primary, #1e293b)", cursor: writable ? "pointer" : "default" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "checkbox",
            checked: settings.alwaysShowDetailButton,
            disabled: !writable,
            onChange: () => void updateField("alwaysShowDetailButton", !settings.alwaysShowDetailButton),
            style: { marginTop: 3 }
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 500 }, children: t("settings.alwaysShowDetail") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: t("settings.alwaysShowDetailHint") })
        ] })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: cardStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 6 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 15, fontWeight: 600 }, children: t("rescue.center.title") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeButton, { variant: "outline", size: "sm", onClick: () => openRescueModal(), children: t("rescue.center.openRescueModal") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...hintStyle, marginBottom: 12 }, children: t("rescue.center.intro") }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RescueCenterPanel, { t, compact: true })
    ] })
  ] });
};
function isGithubPackage(pkg, checkResult) {
  if (checkResult?.isGithub === true) return true;
  const source = typeof pkg?.source === "string" ? pkg.source : "";
  return /github:|github\.com/i.test(source);
}
var UpdaterActionButton = ({ subject, t, locale }) => {
  useLocaleRevision(locale);
  const currentUiPrefs = useUiPrefs();
  const pkg = subject?.pkg;
  const packageName = typeof pkg?.name === "string" ? pkg.name : "";
  const clientVersion = pkg?.version || "0.0.0";
  const renderable = subject?.kind === "bundle" && !!packageName && pkg?.installed !== false && !isOfficialPackage(pkg);
  const [status, setStatus] = (0, import_react.useState)("checking");
  const [checkResult, setCheckResult] = (0, import_react.useState)(null);
  const [message, setMessage] = (0, import_react.useState)(null);
  const [confirmOpen, setConfirmOpen] = (0, import_react.useState)(false);
  const mountedRef = (0, import_react.useRef)(true);
  const tokenRef = (0, import_react.useRef)(0);
  const checkAbortRef = (0, import_react.useRef)(null);
  const updateAbortRef = (0, import_react.useRef)(null);
  const successVersionRef = (0, import_react.useRef)(null);
  const activePackageRef = (0, import_react.useRef)(packageName);
  activePackageRef.current = packageName;
  const isGithub = isGithubPackage(pkg, checkResult);
  (0, import_react.useEffect)(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      tokenRef.current += 1;
      checkAbortRef.current?.abort();
      updateAbortRef.current?.abort();
    };
  }, []);
  (0, import_react.useEffect)(() => {
    tokenRef.current += 1;
    checkAbortRef.current?.abort();
    successVersionRef.current = null;
    setCheckResult(null);
    setMessage(null);
    setConfirmOpen(false);
  }, [packageName]);
  (0, import_react.useEffect)(() => {
    if (!packageName || !clientVersion) return;
    const cachedVer = updatablePlugins.get(packageName);
    if (cachedVer && versionGte(clientVersion, cachedVer)) {
      clearPluginUpdatable(packageName, clientVersion);
    }
  }, [packageName, clientVersion]);
  const fetchCheck = (0, import_react.useCallback)(async () => {
    if (!renderable) return null;
    const token = ++tokenRef.current;
    checkAbortRef.current?.abort();
    const controller = new AbortController();
    checkAbortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    setStatus("checking");
    setMessage(null);
    const tryFallbackCachedUpdate = () => {
      const cachedVer = updatablePlugins.get(packageName);
      if (cachedVer && !versionGte(clientVersion, cachedVer)) {
        const fallbackResult = {
          ok: true,
          packageName,
          currentVersion: clientVersion,
          latestVersion: cachedVer,
          hasUpdate: true
        };
        setCheckResult(fallbackResult);
        setStatus("has_update");
        setMessage(null);
        return fallbackResult;
      }
      return null;
    };
    try {
      const reqBody = { packageName, currentVersion: clientVersion };
      const response = await fetch(CHECK_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reqBody),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null);
      if (token !== tokenRef.current || !mountedRef.current) return null;
      if (!payload || typeof payload !== "object") throw new Error(`HTTP ${response.status}`);
      if (payload.ok === false) {
        if (payload.errorCode === ERROR_CODES.notInstalled || payload.errorCode === ERROR_CODES.officialPlugin) {
          clearPluginUpdatable(packageName);
        } else if (payload.errorCode === ERROR_CODES.offline || payload.errorCode === ERROR_CODES.timeout) {
          const fallback = tryFallbackCachedUpdate();
          if (fallback) return fallback;
        }
        setCheckResult(null);
        setStatus("error");
        setMessage({ kind: "error", errorCode: payload.errorCode, fallback: payload.error });
        return payload;
      }
      syncUiPrefs({
        registryUrl: payload.registry,
        alwaysShowDetailButton: payload.alwaysShowDetailButton
      });
      setCheckResult(payload);
      if (payload.hasUpdate && payload.latestVersion) {
        markPluginUpdatable(packageName, payload.latestVersion);
        setStatus("has_update");
      } else {
        clearPluginUpdatable(packageName, payload.currentVersion || clientVersion);
        setStatus("up_to_date");
      }
      return payload;
    } catch (error) {
      if (token !== tokenRef.current || !mountedRef.current) return null;
      const fallback = tryFallbackCachedUpdate();
      if (fallback) return fallback;
      setCheckResult(null);
      setStatus("error");
      setMessage({ kind: "key", key: error?.name === "AbortError" ? "check.timeout" : "check.network" });
      return null;
    } finally {
      window.clearTimeout(timer);
      if (checkAbortRef.current === controller) checkAbortRef.current = null;
    }
  }, [clientVersion, packageName, renderable]);
  (0, import_react.useEffect)(() => {
    if (!renderable) return;
    if (successVersionRef.current && clientVersion === successVersionRef.current) return;
    void fetchCheck();
  }, [clientVersion, fetchCheck, renderable]);
  const runUpdate = async () => {
    if (!checkResult?.hasUpdate || status === "updating") return;
    const targetPkg = packageName;
    const targetVersion = checkResult.latestVersion;
    const source = checkResult.source;
    const updateToken = ++tokenRef.current;
    setConfirmOpen(false);
    setStatus("updating");
    setMessage(null);
    const controller = new AbortController();
    updateAbortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), UPDATE_TIMEOUT_MS);
    try {
      const reqBody = { packageName: targetPkg, targetVersion, source };
      const response = await fetch(UPDATE_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(reqBody),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null);
      if (!payload || typeof payload !== "object") throw new Error(`HTTP ${response.status}`);
      if (payload.ok === false) {
        if (updateToken !== tokenRef.current || !mountedRef.current) return;
        setStatus("error");
        setMessage({
          kind: "error",
          errorCode: payload.errorCode,
          fallback: payload.error,
          rollbackFailed: payload.rollback === "failed"
        });
        return;
      }
      const version = payload.targetVersion || targetVersion || clientVersion;
      clearPluginUpdatable(targetPkg, version);
      if (updateToken !== tokenRef.current || !mountedRef.current) return;
      successVersionRef.current = version;
      setStatus("success");
      setMessage({
        kind: "key",
        key: targetPkg === PLUGIN_NAME ? "update.selfUpdate" : "update.success",
        params: { version }
      });
    } catch {
      if (updateToken !== tokenRef.current || !mountedRef.current) return;
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      if (updateToken !== tokenRef.current || !mountedRef.current) return;
      const checked = await fetchCheck();
      if (!mountedRef.current || activePackageRef.current !== targetPkg) return;
      if (checked && versionGte(checked.currentVersion, targetVersion)) {
        const version = checked.currentVersion || targetVersion || clientVersion;
        successVersionRef.current = version;
        clearPluginUpdatable(targetPkg, version);
        setStatus("success");
        setMessage({
          kind: "key",
          key: targetPkg === PLUGIN_NAME ? "update.selfUpdate" : "update.success",
          params: { version }
        });
      } else {
        setStatus("error");
        setMessage({ kind: "key", key: "update.failed" });
      }
    } finally {
      window.clearTimeout(timer);
      if (updateAbortRef.current === controller) updateAbortRef.current = null;
    }
  };
  if (!renderable) return null;
  const effectiveRegistry = normalizeRegistryUrl(checkResult?.registry || currentUiPrefs.registryUrl) ?? OFFICIAL_REGISTRY;
  const usingNonOfficialRegistry = effectiveRegistry !== OFFICIAL_REGISTRY;
  const effectiveAlwaysShow = checkResult?.alwaysShowDetailButton ?? currentUiPrefs.alwaysShowDetailButton;
  if (!isGithub && !usingNonOfficialRegistry && !effectiveAlwaysShow) {
    return null;
  }
  if (!isGithub && (status === "checking" || status === "up_to_date")) {
    return null;
  }
  const latestVersion = checkResult?.latestVersion || "";
  const messageText = message ? message.kind === "key" ? t(message.key, message.params) : (() => {
    const baseError = errorText(t, message.errorCode, message.fallback);
    return message.rollbackFailed && message.errorCode !== ERROR_CODES.rollbackFailed ? `${baseError} (${t("error.rollbackFailed")})` : baseError;
  })() : "";
  const buttonLabel = status === "checking" ? t("action.checking") : status === "has_update" ? t("action.githubUpdate", { version: latestVersion }) : status === "updating" ? t("action.updating") : status === "success" ? t("action.success") : status === "up_to_date" ? t("action.upToDate") : t("action.retry");
  const onButtonClick = () => {
    if (status === "has_update") {
      setConfirmOpen(true);
      return;
    }
    if (status === "checking" || status === "updating") return;
    successVersionRef.current = null;
    void fetchCheck();
  };
  const showMessage = Boolean(messageText) && (isGithub || status !== "success");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }, children: [
    isGithub ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      SafeButton,
      {
        variant: status === "has_update" ? "primary" : "outline",
        size: "sm",
        onClick: onButtonClick,
        disabled: status === "checking" || status === "updating",
        children: buttonLabel
      }
    ) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      status === "has_update" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        SafeButton,
        {
          variant: "outline",
          size: "sm",
          onClick: () => setConfirmOpen(true),
          title: t("action.fastUpdateTip"),
          children: t("action.fastUpdate", { version: latestVersion })
        }
      ),
      status === "updating" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary, #64748b)" }, children: t("action.updating") }),
      status === "success" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12, color: "#15803d" }, children: messageText || t("action.success") }),
      status === "error" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeButton, { variant: "outline", size: "sm", onClick: () => void fetchCheck(), children: t("action.retry") })
    ] }),
    showMessage && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: status === "error" ? "#b91c1c" : "#15803d", maxWidth: 360 }, children: messageText }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      SafeModal,
      {
        open: confirmOpen,
        onClose: () => setConfirmOpen(false),
        title: t("confirm.title"),
        closeLabel: t("confirm.close"),
        description: t("confirm.body", { packageName, version: latestVersion }),
        footer: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeButton, { variant: "outline", onClick: () => setConfirmOpen(false), children: t("confirm.cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeButton, { variant: "primary", onClick: () => void runUpdate(), children: t("confirm.ok") })
        ] })
      }
    )
  ] });
};
var SIDEBAR_BADGE_ATTR = "data-dsh-updater-sidebar-badge";
var ROW_BADGE_ATTR = "data-dsh-updater-row-badge";
var ROW_ISSUE_ATTR = "data-dsh-updater-row-issue";
var NATIVE_UPDATE_LABELS = /* @__PURE__ */ new Set(["\u53EF\u66F4\u65B0", "Update available"]);
function hasNativeUpdateTag(card, t) {
  const expectedLocal = t("badge.updateAvailable");
  const candidates = card.querySelectorAll("[data-dsw-tag], [data-tone], span");
  for (const el of Array.from(candidates)) {
    if (el.hasAttribute(ROW_BADGE_ATTR) || el.hasAttribute(ROW_ISSUE_ATTR) || el.closest(`[${ROW_BADGE_ATTR}], [${ROW_ISSUE_ATTR}]`) || el.querySelector(`[${ROW_BADGE_ATTR}], [${ROW_ISSUE_ATTR}]`)) {
      continue;
    }
    const isLeafOrTagged = el.children.length === 0 || el.hasAttribute("data-tone") || el.hasAttribute("data-dsw-tag");
    if (!isLeafOrTagged) continue;
    const text = el.textContent?.trim();
    if (!text) continue;
    if (text === expectedLocal || NATIVE_UPDATE_LABELS.has(text)) {
      return true;
    }
  }
  return false;
}
function mountRowBadgeHost(card, pkgName, attrName = ROW_BADGE_ATTR) {
  const host = document.createElement("span");
  host.setAttribute(attrName, pkgName);
  host.style.cssText = "display: inline-flex; align-items: center; flex: none; cursor: pointer;";
  const titleBtn = card.querySelector('button:not([role="switch"])');
  if (titleBtn?.parentElement && titleBtn.parentElement !== card) {
    titleBtn.parentElement.appendChild(host);
    return host;
  }
  const switchEl = card.querySelector('[role="switch"]');
  const toggleWrapper = switchEl?.closest("span");
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
function isOwnBadgeMutation(mutation) {
  const targetEl = mutation.target instanceof Element ? mutation.target : null;
  if (targetEl && (targetEl.hasAttribute(SIDEBAR_BADGE_ATTR) || targetEl.hasAttribute(ROW_BADGE_ATTR) || targetEl.hasAttribute(ROW_ISSUE_ATTR) || targetEl.closest(`[${SIDEBAR_BADGE_ATTR}], [${ROW_BADGE_ATTR}], [${ROW_ISSUE_ATTR}]`))) {
    return true;
  }
  if (mutation.type === "childList") {
    const nodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
    if (nodes.length > 0 && nodes.every(
      (node) => node instanceof Element && (node.hasAttribute(SIDEBAR_BADGE_ATTR) || node.hasAttribute(ROW_BADGE_ATTR) || node.hasAttribute(ROW_ISSUE_ATTR))
    )) {
      return true;
    }
  }
  return false;
}
function resolvePluginsPanelLabel(slots) {
  try {
    const entries = typeof slots?.entriesOfSlot === "function" ? slots.entriesOfSlot("sidebar.panellist") : typeof slots?.entries === "function" ? slots.entries("sidebar.panellist") : null;
    if (Array.isArray(entries)) {
      const pluginsEntry = entries.find((item) => item?.options?.id === "plugins");
      const rawLabel = pluginsEntry?.options?.label;
      const resolved = typeof rawLabel === "function" ? rawLabel() : rawLabel;
      if (typeof resolved === "string" && resolved.trim()) return resolved.trim();
    }
  } catch {
  }
  return null;
}
function findSidebarPluginsButton(slots) {
  try {
    const dynamicLabel = resolvePluginsPanelLabel(slots);
    const candidateLabels = Array.from(new Set([dynamicLabel, "\u63D2\u4EF6", "Plugins"].filter(Boolean)));
    for (const label of candidateLabels) {
      const escaped = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(label) : label;
      const btn = document.querySelector(`button[aria-label="${escaped}"]`);
      if (btn && !btn.closest("[data-plugin-panel]")) return btn;
    }
    const buttons = document.querySelectorAll("button");
    for (const btn of buttons) {
      if (btn.closest("[data-plugin-panel]")) continue;
      for (const child of Array.from(btn.children)) {
        if (child.tagName === "SPAN" && candidateLabels.includes((child.textContent || "").trim())) {
          return btn;
        }
      }
    }
  } catch {
  }
  return null;
}
var UpdateRemindersOverlay = ({ slots, t, locale }) => {
  useLocaleRevision(locale);
  const updatableEntries = useUpdatableSnapshot();
  const rescue = useRescueSnapshot();
  const [sidebarHost, setSidebarHost] = (0, import_react.useState)(null);
  const [rowTargets, setRowTargets] = (0, import_react.useState)([]);
  const [issueTargets, setIssueTargets] = (0, import_react.useState)([]);
  const lastNativeDoneRef = (0, import_react.useRef)(false);
  const sidebarBtnRef = (0, import_react.useRef)(null);
  const lastSidebarCssRef = (0, import_react.useRef)("");
  (0, import_react.useEffect)(() => {
    const timer = window.setTimeout(() => {
      runBatchCheck(false);
    }, 600);
    return () => window.clearTimeout(timer);
  }, []);
  (0, import_react.useEffect)(() => {
    const onCaptureClick = (event) => {
      const target = event.target;
      if (!target) return;
      if (target.closest(`[${ROW_BADGE_ATTR}], [${ROW_ISSUE_ATTR}], [role="switch"]`)) return;
      const card = target.closest("li[data-plugin-package]");
      const pkgName = card?.getAttribute("data-plugin-package")?.trim();
      if (pkgName && pkgName !== PLUGIN_NAME && !isOfficialPackageName(pkgName)) {
        knownThirdPartyPackages.add(pkgName);
        lastClickedPlugin = { name: pkgName, timestamp: Date.now() };
      }
    };
    const onWindowError = (event) => {
      const msg = String(event?.message || event?.error?.message || "");
      const stack = `${event?.filename || ""}
${event?.error?.stack || ""}`;
      attributePluginCrash(msg, stack);
    };
    const onUnhandledRejection = (event) => {
      const reason = event?.reason;
      const msg = typeof reason === "string" ? reason : typeof reason?.message === "string" ? reason.message : String(reason || "");
      const stack = typeof reason?.stack === "string" ? reason.stack : "";
      attributePluginCrash(msg, stack);
    };
    document.addEventListener("click", onCaptureClick, true);
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      document.removeEventListener("click", onCaptureClick, true);
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);
  const syncDomTargets = (0, import_react.useCallback)(() => {
    try {
      let pluginsBtn = sidebarBtnRef.current;
      if (!pluginsBtn || !pluginsBtn.isConnected) {
        pluginsBtn = findSidebarPluginsButton(slots);
        sidebarBtnRef.current = pluginsBtn;
        lastSidebarCssRef.current = "";
      }
      if (pluginsBtn) {
        let host = pluginsBtn.querySelector(`span[${SIDEBAR_BADGE_ATTR}="true"]`);
        if (!host) {
          host = document.createElement("span");
          host.setAttribute(SIDEBAR_BADGE_ATTR, "true");
          pluginsBtn.appendChild(host);
          lastSidebarCssRef.current = "";
        }
        let nextCssText = "display: none;";
        if (updatablePlugins.size > 0) {
          if ((!pluginsBtn.style.position || pluginsBtn.style.position === "static") && window.getComputedStyle(pluginsBtn).position === "static") {
            pluginsBtn.style.position = "relative";
          }
          const isCollapsed = pluginsBtn.clientWidth > 0 && pluginsBtn.clientWidth <= 48;
          if (isCollapsed) {
            nextCssText = "position: absolute; top: 2px; right: 2px; display: inline-flex; align-items: center; pointer-events: none; transform: scale(0.8); transform-origin: top right;";
          } else {
            const panelEntry = pluginsBtn.closest("nav > div") || pluginsBtn.parentElement;
            const hasUnpinBtn = Boolean(
              panelEntry && Array.from(panelEntry.querySelectorAll("button")).some((btn) => btn !== pluginsBtn)
            );
            nextCssText = `position: absolute; top: 50%; right: ${hasUnpinBtn ? "32px" : "10px"}; transform: translateY(-50%); display: inline-flex; align-items: center; pointer-events: none;`;
          }
        }
        if (lastSidebarCssRef.current !== nextCssText) {
          host.style.cssText = nextCssText;
          lastSidebarCssRef.current = nextCssText;
        }
        setSidebarHost((prev) => prev === host ? prev : host);
      } else {
        setSidebarHost(null);
      }
      const detailEl = document.querySelector("[data-plugin-detail]");
      if (detailEl && lastClickedPlugin) {
        const elapsed = Date.now() - lastClickedPlugin.timestamp;
        if (elapsed <= 5e3) {
          const text = (detailEl.textContent || "").trim();
          const hasExplicitErr = Boolean(detailEl.querySelector("[data-plugin-error], [data-error-boundary]"));
          const isBlank = elapsed >= 1e3 && text.length === 0;
          const looksBroken = /Something went wrong|ChunkLoadError|Minified React error|组件加载失败|页面渲染失败|插件加载异常/i.test(text);
          if (hasExplicitErr || isBlank || looksBroken) {
            recordClientCrash(
              lastClickedPlugin.name,
              isBlank ? "\u6253\u5F00\u63D2\u4EF6\u8BE6\u60C5\u9875\u540E\u9875\u9762\u7A7A\u767D" : text.slice(0, 200)
            );
          }
        }
      }
      const cards = Array.from(document.querySelectorAll("li[data-plugin-package]"));
      if (cards.length > 0 && !detailEl) {
        for (const card of cards) {
          const pkg = card.getAttribute("data-plugin-package");
          if (pkg && pkg !== PLUGIN_NAME && !isOfficialPackageName(pkg)) {
            knownThirdPartyPackages.add(pkg);
          }
        }
      }
      const nextRowTargets = [];
      const nextIssueTargets = [];
      for (const card of cards) {
        const pkgName = card.getAttribute("data-plugin-package") || "";
        if (!pkgName) continue;
        const latestVersion = updatablePlugins.get(pkgName);
        const unhealthySummary = unhealthyPlugins.get(pkgName);
        const crashDetail = crashedPlugins.get(pkgName);
        const hasIssue = Boolean(unhealthySummary || crashDetail);
        const escapedPkg = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(pkgName) : pkgName.replace(/["\\]/g, "\\$&");
        let updateHost = card.querySelector(`span[${ROW_BADGE_ATTR}="${escapedPkg}"]`);
        let issueHost = card.querySelector(`span[${ROW_ISSUE_ATTR}="${escapedPkg}"]`);
        if (hasIssue) {
          if (updateHost) updateHost.remove();
          if (!issueHost) {
            issueHost = mountRowBadgeHost(card, pkgName, ROW_ISSUE_ATTR);
          }
          nextIssueTargets.push({
            packageName: pkgName,
            hasUpdate: Boolean(latestVersion),
            latestVersion,
            detail: crashDetail || unhealthySummary?.errorDetail,
            host: issueHost
          });
          continue;
        }
        if (issueHost) issueHost.remove();
        if (latestVersion && !hasNativeUpdateTag(card, t)) {
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
      setRowTargets((prev) => {
        if (prev.length === nextRowTargets.length && prev.every(
          (item, i) => item.packageName === nextRowTargets[i].packageName && item.latestVersion === nextRowTargets[i].latestVersion && item.host === nextRowTargets[i].host
        )) {
          return prev;
        }
        return nextRowTargets;
      });
      setIssueTargets((prev) => {
        if (prev.length === nextIssueTargets.length && prev.every(
          (item, i) => item.packageName === nextIssueTargets[i].packageName && item.hasUpdate === nextIssueTargets[i].hasUpdate && item.latestVersion === nextIssueTargets[i].latestVersion && item.host === nextIssueTargets[i].host
        )) {
          return prev;
        }
        return nextIssueTargets;
      });
      const nativeDone = Boolean(document.querySelector('[data-plugin-update="done"], [data-install-phase="done"]'));
      if (nativeDone && !lastNativeDoneRef.current) {
        runBatchCheck(false, true);
      }
      lastNativeDoneRef.current = nativeDone;
    } catch {
    }
  }, [slots, t]);
  (0, import_react.useEffect)(() => {
    syncDomTargets();
  }, [syncDomTargets, updatableEntries, rescue]);
  (0, import_react.useEffect)(() => {
    const btn = sidebarBtnRef.current;
    if (!btn || typeof ResizeObserver === "undefined") return void 0;
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
  (0, import_react.useEffect)(() => {
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
    const observer = new MutationObserver((mutations) => {
      let hasRelevant = false;
      let isDialogDoneAttr = false;
      for (const m of mutations) {
        if (isOwnBadgeMutation(m)) continue;
        hasRelevant = true;
        if (m.type === "attributes") {
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
      attributeFilter: ["data-plugin-update", "data-install-phase"]
    });
    const onResize = () => scheduleSync();
    window.addEventListener("resize", onResize);
    syncDomTargets();
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", onResize);
      if (rafId) window.cancelAnimationFrame(rafId);
      if (throttleTimer) window.clearTimeout(throttleTimer);
    };
  }, [syncDomTargets]);
  (0, import_react.useEffect)(() => {
    return () => {
      document.querySelectorAll(`[${SIDEBAR_BADGE_ATTR}], [${ROW_BADGE_ATTR}], [${ROW_ISSUE_ATTR}]`).forEach((el) => el.remove());
    };
  }, []);
  const count = updatableEntries.length;
  const issueCount = (/* @__PURE__ */ new Set([...rescue.unhealthy.keys(), ...rescue.crashes.keys()])).size;
  const currentSignature = computeRescueSignature();
  const shouldShowBanner = (issueCount > 0 || rescue.hostUpgrade.upgraded && count > 0) && currentSignature !== rescue.dismissedSignature && !rescue.modal.open;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    sidebarHost && count > 0 && (0, import_react_dom.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { title: t("badge.sidebarTip", { count }), style: { display: "inline-flex", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeTag, { tone: "info", children: String(count) }) }),
      sidebarHost
    ),
    rowTargets.map(
      ({ packageName, latestVersion, host, card }) => (0, import_react_dom.createPortal)(
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            title: `v${latestVersion}`,
            onClick: (event) => {
              event.stopPropagation();
              const openBtn = card.querySelector('button:not([role="switch"])');
              openBtn?.click();
            },
            style: { display: "inline-flex", alignItems: "center" },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeTag, { tone: "info", children: t("badge.updateAvailable") })
          }
        ),
        host,
        packageName
      )
    ),
    issueTargets.map(
      ({ packageName, hasUpdate, latestVersion, detail, host }) => (0, import_react_dom.createPortal)(
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            title: detail || (latestVersion ? `v${latestVersion}` : packageName),
            onClick: (event) => {
              event.preventDefault();
              event.stopPropagation();
              openRescueModal(packageName);
            },
            style: { display: "inline-flex", alignItems: "center" },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeTag, { tone: "warning", children: hasUpdate ? t("badge.issueAndUpdate") : t("badge.issueDetected") })
          }
        ),
        host,
        `issue:${packageName}`
      )
    ),
    shouldShowBanner && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "div",
      {
        style: {
          position: "fixed",
          right: 20,
          bottom: 20,
          zIndex: 9500,
          width: 360,
          maxWidth: "calc(100vw - 40px)",
          padding: "12px 14px",
          borderRadius: 12,
          background: "var(--dsw-alias-bg-elevated, #ffffff)",
          color: "var(--dsw-alias-label-primary, #1e293b)",
          border: issueCount > 0 ? "1.5px solid #f59e0b" : "1.5px solid var(--dsw-alias-primary, #2563eb)",
          boxShadow: "0 12px 32px rgba(15, 23, 42, 0.18)",
          boxSizing: "border-box"
        },
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 13, fontWeight: 600, marginBottom: 4 }, children: issueCount > 0 ? t("rescue.banner.crashTitle", { count: issueCount }) : t("rescue.banner.hostUpgradedTitle", { version: rescue.hostUpgrade.current || "" }) }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary, #64748b)", lineHeight: 1.5, marginBottom: 10 }, children: t("rescue.banner.desc") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexWrap: "wrap", gap: 6 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeButton, { variant: "primary", size: "sm", onClick: () => openRescueModal(), children: t("rescue.banner.openCenter") }),
            count > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeButton, { variant: "outline", size: "sm", onClick: () => openRescueModal(void 0, true), children: t("rescue.banner.batchUpdate", { count }) }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeButton, { variant: "outline", size: "sm", onClick: () => dismissCurrentRescueBanner(), children: t("rescue.banner.dismiss") })
          ] })
        ]
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      SafeModal,
      {
        open: rescue.modal.open,
        onClose: () => closeRescueModal(),
        title: t("rescue.modal.title"),
        closeLabel: t("confirm.close"),
        description: t("rescue.modal.subtitle"),
        footer: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeButton, { variant: "outline", onClick: () => closeRescueModal(), children: t("confirm.close") }),
        children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          RescueCenterPanel,
          {
            t,
            focusPackage: rescue.modal.focusPackage,
            autoBatch: rescue.modal.autoBatch
          }
        )
      }
    )
  ] });
};
function apply(ctx) {
  const locale = getLocaleService(ctx);
  const t = createTranslator(locale);
  registerLocaleDictionaries(ctx, locale);
  let formInstance;
  const getForm = () => {
    if (formInstance) return formInstance;
    if (ctx.configForms?.get) formInstance = ctx.configForms.get(PLUGIN_NAME);
    return formInstance;
  };
  const slots = ctx.slots;
  if (!slots?.inject || !slots?.register) return;
  slots.inject(
    "shell.overlay",
    () => slots.register(
      {
        name: "shell.overlay",
        id: `${PLUGIN_NAME}.reminders-overlay`,
        order: 50
      },
      (props) => import_react.default.createElement(
        SafeErrorBoundary,
        { fallback: null },
        import_react.default.createElement(UpdateRemindersOverlay, { ...props, slots, t, locale })
      )
    )
  );
  slots.inject(
    "plugins.detail.actions",
    () => slots.register(
      {
        name: "plugins.detail.actions",
        id: `${PLUGIN_NAME}.action-button`,
        order: -10
      },
      (props) => import_react.default.createElement(
        SafeErrorBoundary,
        { fallback: null },
        import_react.default.createElement(UpdaterActionButton, { ...props, t, locale })
      )
    )
  );
  const registerBundleConfig = (form) => slots.inject(
    "plugins.bundle.config",
    () => slots.register(
      {
        name: "plugins.bundle.config",
        key: PLUGIN_NAME
      },
      () => import_react.default.createElement(
        SafeErrorBoundary,
        { fallback: null },
        import_react.default.createElement(RegistrySettingsCard, { form: form || getForm(), t, locale })
      )
    )
  );
  if (ctx.configForms?.whileServed) {
    ctx.effect(
      () => ctx.configForms.whileServed([PLUGIN_NAME], () => {
        const form = ctx.configForms.get(PLUGIN_NAME);
        formInstance = form;
        return registerBundleConfig(form);
      }),
      "dsh-plugins-update: bundle settings card"
    );
  } else {
    registerBundleConfig();
  }
}
var name = PLUGIN_NAME;
var inject = ["slots", "configForms", "locale"];

    return module.exports;
  }
});
