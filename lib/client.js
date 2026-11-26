/**
 * dsh-plugins-update v0.2.7-exp.2
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

// src/types.ts
var OFFICIAL_REGISTRY = "https://registry.npmjs.org/";
var DOMESTIC_REGISTRY = "https://registry.npmmirror.com/";
var PLUGIN_NAME = "dsh-plugins-update";
var OFFICIAL_PACKAGE_PREFIX = "@deepseek-ai/";
var LOCALE_NAMESPACE = PLUGIN_NAME;
var UPDATER_REQUEST_HEADER = "x-dsh-updater";
var CHECK_PATH = "/api/dsh-plugins-update/check";
var CHECK_ALL_PATH = "/api/dsh-plugins-update/check-all";
var UPDATE_PATH = "/api/dsh-plugins-update/update";
var REPORT_CONFLICT_PATH = "/api/dsh-plugins-update/report-conflict";
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
  freshReleaseBlocked: "fresh-release-blocked",
  unreviewedBlocked: "unreviewed-blocked",
  forbidden: "forbidden",
  unknown: "unknown"
};
function isOfficialPackageName(packageName) {
  return typeof packageName === "string" && packageName.startsWith(OFFICIAL_PACKAGE_PREFIX);
}
function isDisallowedHost(hostname) {
  const host = String(hostname || "").trim().replace(/^\[|\]$/g, "").replace(/\.+$/, "").toLowerCase();
  if (!host) return true;
  if (host === "localhost" || host.endsWith(".localhost") || host === "0.0.0.0" || host === "::" || host === "::1" || host === "::ffff:0:0" || host === "metadata.google.internal" || host === "100.100.100.200") {
    return true;
  }
  if (/^(?:::ffff:)?127\./i.test(host)) return true;
  if (/^(?:::ffff:)?169\.254\./i.test(host)) return true;
  if (/^::ffff:(?:7f[0-9a-f]{2}|a9fe):[0-9a-f]{1,4}$/i.test(host)) return true;
  if (/^fe[89ab][0-9a-f]:/i.test(host)) return true;
  if (/^f[cd][0-9a-f]{2}:/i.test(host)) return true;
  return false;
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
  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (isDisallowedHost(parsed.hostname)) return null;
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
  "action.fallbackUpdate": "\u8865\u4F4D\u66F4\u65B0 (v{version})",
  "action.fastUpdate": "\u6781\u901F\u66F4\u65B0 (v{version})",
  "action.fastUpdateTip": "\u4EC5\u5BF9\u76EE\u6807\u63D2\u4EF6\u5F53\u524D\u7248\u672C\u8C41\u514D\u89C2\u5BDF\u671F\u5E76\u5B89\u88C5\u6700\u65B0\u7248\uFF08\u5B50\u4F9D\u8D56\u4ECD\u4FDD\u6301 24 \u5C0F\u65F6\u4FDD\u62A4\uFF09",
  "action.githubUpdate": "\u66F4\u65B0\u6700\u65B0\u63D0\u4EA4 (v{version})",
  "action.updating": "\u66F4\u65B0\u4E2D\u2026",
  "action.success": "\u5DF2\u66F4\u65B0",
  "action.retry": "\u91CD\u8BD5",
  "badge.updateAvailable": "\u53EF\u66F4\u65B0",
  "badge.conflictDisabled": "\u51B2\u7A81\u5DF2\u505C\u7528",
  "badge.conflictTip": "\u56E0\u4E0E\u5F53\u524D DSH \u7248\u672C\u51B2\u7A81\u5DF2\u81EA\u52A8\u505C\u7528",
  "badge.conflictReasonTip": "\u56E0\u4E0E\u5F53\u524D DSH \u7248\u672C\u51B2\u7A81\u5DF2\u81EA\u52A8\u505C\u7528\uFF1A{reason}",
  "badge.sidebarUpdatesOnly": "{updates} \u4E2A\u63D2\u4EF6\u53EF\u66F4\u65B0",
  "badge.sidebarConflictsOnly": "{conflicts} \u4E2A\u63D2\u4EF6\u56E0\u7248\u672C\u51B2\u7A81\u5DF2\u505C\u7528",
  "badge.sidebarBoth": "{conflicts} \u4E2A\u63D2\u4EF6\u56E0\u7248\u672C\u51B2\u7A81\u5DF2\u505C\u7528\uFF0C{updates} \u4E2A\u63D2\u4EF6\u53EF\u66F4\u65B0",
  "danger.freshRelease.title": "\u5F00\u542F 24 \u5C0F\u65F6\u53D1\u5E03\u89C2\u5BDF\u671F\u8C41\u514D\uFF1F",
  "danger.freshRelease.body": "\u521A\u53D1\u5E03\u4E0D\u6EE1 24 \u5C0F\u65F6\u7684 npm \u7248\u672C\u5C1A\u672A\u5EA6\u8FC7\u4F9B\u5E94\u94FE\u5B89\u5168\u89C2\u5BDF\u671F\uFF08minimumReleaseAge\uFF09\uFF0C\u82E5\u4E0A\u6E38\u8D26\u53F7\u906D\u52AB\u6301\u6216\u6295\u6BD2\uFF0C\u6076\u610F\u4EE3\u7801\u53EF\u80FD\u5C1A\u672A\u88AB\u793E\u533A\u53D1\u73B0\u4E0E\u4E0B\u67B6\u3002\u5F00\u542F\u540E\u5C06\u5141\u8BB8\u63A2\u6D4B\u6B64\u7C7B\u65B0\u7248\u672C\u5E76\u5728 DSH \u539F\u751F\u62E6\u622A\u65F6\u76F4\u63A5\u8865\u4F4D\u5B89\u88C5\uFF08\u5E95\u5C42\u4EC5\u8C41\u514D\u8BE5\u63D2\u4EF6\u76EE\u6807\u7248\u672C\uFF0C\u4E0D\u4F1A\u653E\u5F00\u5B50\u4F9D\u8D56\u89C2\u5BDF\u671F\uFF09\u3002\u786E\u8BA4\u5F00\u542F\u5417\uFF1F",
  "danger.unreviewed.title": "\u5F00\u542F\u672A\u7ECF\u5B89\u5168\u5BA1\u6838\u7248\u672C\u66F4\u65B0\uFF1F",
  "danger.unreviewed.body": "\u5C1A\u672A\u6536\u5F55\u81F3\u63D2\u4EF6\u5E02\u573A\u5B89\u5168\u7D22\u5F15\u7684\u65B0\u7248\u672C\u3001\u91CE\u751F\u5305\u53CA GitHub \u6D6E\u52A8\u5206\u652F\u63D0\u4EA4\u672A\u7ECF\u4EBA\u5DE5\u6216\u81EA\u52A8\u5316\u5B89\u5168\u5BA1\u8BA1\uFF0C\u76F4\u63A5\u62C9\u53D6\u66F4\u65B0\u5B58\u5728\u6267\u884C\u4E0D\u53EF\u4FE1\u4EE3\u7801\u7684\u98CE\u9669\u3002\u5F00\u542F\u540E\u5C06\u5141\u8BB8\u63A2\u6D4B\u5E76\u5728\u8BE6\u60C5\u9875\u4E00\u952E\u66F4\u65B0\u6B64\u7C7B\u7248\u672C\uFF0C\u540E\u7EED\u66F4\u65B0\u65F6\u4E0D\u518D\u91CD\u590D\u5F39\u7A97\u786E\u8BA4\uFF08\u672A\u6388\u6743 postinstall \u6784\u5EFA\u811A\u672C\u4ECD\u4F1A\u88AB\u62E6\u622A\uFF09\u3002\u786E\u8BA4\u5F00\u542F\u5417\uFF1F",
  "danger.confirmEnable": "\u5DF2\u77E5\u6653\u98CE\u9669\uFF0C\u786E\u8BA4\u5F00\u542F",
  "danger.cancel": "\u53D6\u6D88",
  "danger.close": "\u5173\u95ED",
  "settings.title": "\u63D2\u4EF6\u9ED8\u8BA4\u66F4\u65B0\u6E90\u914D\u7F6E",
  "settings.intro": "\u7B2C\u4E09\u65B9\u63D2\u4EF6\u66F4\u65B0\u65F6\u9ED8\u8BA4\u4F7F\u7528\u7684 npm \u4ED3\u5E93\u6E90\u3002",
  "settings.npmjs": "npm \u5B98\u65B9\u6E90",
  "settings.npmjsHint": "\u7248\u672C\u53D1\u5E03\u540E\u7ACB\u5373\u53EF\u7528\uFF0C\u65E0\u955C\u50CF\u540C\u6B65\u5EF6\u8FDF\u3002",
  "settings.npmmirror": "\u56FD\u5185\u6E90 npmmirror",
  "settings.npmmirrorHint": "\u56FD\u5185\u4E0B\u8F7D\u66F4\u5FEB\uFF1B\u955C\u50CF\u540C\u6B65\u53EF\u80FD\u6709\u5EF6\u8FDF\u3002",
  "settings.customFallbackName": "\u81EA\u5B9A\u4E49\u6E90",
  "settings.customHint": "\u81EA\u5B9A\u4E49 npm registry\u3002",
  "settings.customNameLabel": "\u6E90\u5907\u6CE8\u540D\u79F0\uFF08\u53EF\u9009\uFF09",
  "settings.customNamePlaceholder": "\u4F8B\u5982\uFF1A\u516C\u53F8\u5185\u90E8\u955C\u50CF",
  "settings.customUrlLabel": "HTTPS \u4ED3\u5E93\u5730\u5740",
  "settings.customUrlPlaceholder": "https://mirrors.example.com/npm/",
  "settings.addCustom": "+ \u6DFB\u52A0\u81EA\u5B9A\u4E49\u66F4\u65B0\u6E90",
  "settings.saveUse": "\u4FDD\u5B58\u5E76\u4F7F\u7528",
  "settings.cancel": "\u53D6\u6D88",
  "settings.delete": "\u5220\u9664",
  "settings.fallback": "\u975E\u5B98\u65B9\u6E90\u5B89\u88C5\u5931\u8D25\u65F6\uFF0C\u81EA\u52A8\u6539\u7528 npm \u5B98\u65B9\u6E90\u91CD\u8BD5\u4E00\u6B21",
  "settings.fallbackHint": "\u5F53\u955C\u50CF\u6E90\u6216\u81EA\u5B9A\u4E49\u6E90\u8FDE\u63A5\u5931\u8D25\u3001\u5C1A\u672A\u540C\u6B65\u65B0\u7248\u672C\u65F6\uFF0C\u81EA\u52A8\u6539\u7528 npm \u5B98\u65B9\u6E90\u91CD\u8BD5\u4E00\u6B21\u3002",
  "settings.alwaysShowDetail": "\u59CB\u7EC8\u5728\u63D2\u4EF6\u8BE6\u60C5\u9875\u663E\u793A\u300C\u6781\u901F\u66F4\u65B0\u300D\u6309\u94AE",
  "settings.alwaysShowDetailHint": "\u5173\u95ED\u65F6\uFF0Cnpm \u5B98\u65B9\u6E90\u7684\u5E38\u89C4\u66F4\u65B0\u4EA4\u7531 DSH \u539F\u751F\u5904\u7406\uFF1BGitHub \u63D2\u4EF6\u53CA\u955C\u50CF/\u81EA\u5B9A\u4E49\u6E90\u4ECD\u7531\u672C\u63D2\u4EF6\u63A5\u7BA1\u3002\u5F00\u542F\u540E\u53EF\u5728\u5BF9\u5E94\u5B89\u5168\u6743\u9650\u5141\u8BB8\u65F6\u4ECE\u8BE6\u60C5\u9875\u4F7F\u7528\u5355\u6B65\u76F4\u88C5\u4E0E\u7B56\u7565\u8C41\u514D\u901A\u9053\u3002",
  "settings.securitySectionTitle": "\u5B89\u5168\u4E0E\u89C2\u5BDF\u671F\u7B56\u7565",
  "settings.riskEnabledTag": "\u9AD8\u98CE\u9669\u5DF2\u5F00\u542F",
  "settings.allowFreshRelease": "\u5141\u8BB8\u63A2\u6D4B\u5E76\u66F4\u65B0\u672A\u6EE1 24 \u5C0F\u65F6\u53D1\u5E03\u89C2\u5BDF\u671F\u7684\u7248\u672C",
  "settings.allowFreshReleaseHint": "\u9ED8\u8BA4\u5173\u95ED\u3002\u5F00\u542F\u540E\u5C06\u5305\u542B\u53D1\u5E03\u4E0D\u6EE1 24 \u5C0F\u65F6\u7684 npm \u65B0\u7248\u672C\uFF0C\u5E76\u5728 DSH \u539F\u751F\u66F4\u65B0\u53D7\u89C2\u5BDF\u671F\u62E6\u622A\u65F6\u63D0\u4F9B\u8865\u4F4D\u66F4\u65B0\uFF08\u4EC5\u8C41\u514D\u76EE\u6807\u63D2\u4EF6\u5F53\u524D\u7248\u672C\uFF0C\u5B50\u4F9D\u8D56\u4ECD\u53D7 24 \u5C0F\u65F6\u4FDD\u62A4\uFF09\u3002",
  "settings.allowUnreviewed": "\u5141\u8BB8\u63A2\u6D4B\u5E76\u66F4\u65B0\u672A\u7ECF\u5E02\u573A\u5B89\u5168\u5BA1\u6838\u7684\u7248\u672C\u4E0E\u6765\u6E90",
  "settings.allowUnreviewedHint": "\u9ED8\u8BA4\u5173\u95ED\uFF0C\u4EC5\u653E\u884C\u5BBF\u4E3B\u63D2\u4EF6\u5E02\u573A\u7D22\u5F15\uFF08\u672A\u914D\u7F6E\u65F6\u81EA\u52A8\u53C2\u8003 awesome-dsh-plugin \u7CBE\u9009\u7D22\u5F15\uFF09\u5DF2\u6536\u5F55\u7684\u7CBE\u786E\u7248\u672C\u3002\u5F00\u542F\u540E\u53EF\u63A2\u6D4B\u5E76\u66F4\u65B0\u5C1A\u672A\u6536\u5F55\u7684\u65B0\u7248\u672C\u53CA GitHub \u6D6E\u52A8\u5206\u652F\u63D0\u4EA4\uFF08\u5B89\u88C5\u671F\u6784\u5EFA\u811A\u672C\u4ECD\u9ED8\u8BA4\u62E6\u622A\uFF09\u3002",
  "settings.notice.registryUpdated": "\u5DF2\u66F4\u65B0\u9ED8\u8BA4\u66F4\u65B0\u6E90",
  "settings.notice.customAdded": "\u5DF2\u6DFB\u52A0\u5E76\u5207\u6362\u81EA\u5B9A\u4E49\u6E90",
  "settings.notice.customRemoved": "\u5DF2\u79FB\u9664\u81EA\u5B9A\u4E49\u6E90",
  "settings.error.invalidUrl": "\u8BF7\u8F93\u5165\u5408\u6CD5\u5B89\u5168\u7684 HTTPS \u6E90\u5730\u5740\uFF08\u4E0D\u652F\u6301\u672C\u5730\u56DE\u73AF\u6216\u5185\u5D4C\u51ED\u636E\uFF09",
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
  "error.freshReleaseBlocked": "\u8BE5\u7248\u672C\u672A\u6EE1 24 \u5C0F\u65F6\u5B89\u5168\u89C2\u5BDF\u671F\uFF0C\u8BF7\u5148\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u5F00\u542F\u5BF9\u5E94\u6743\u9650",
  "error.unreviewedBlocked": "\u8BE5\u7248\u672C\u6216\u6765\u6E90\u672A\u7ECF\u5E02\u573A\u5B89\u5168\u5BA1\u6838\uFF0C\u8BF7\u5148\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u5F00\u542F\u5BF9\u5E94\u6743\u9650",
  "error.forbidden": "\u8BF7\u6C42\u5B89\u5168\u6821\u9A8C\u672A\u901A\u8FC7\uFF0C\u8BF7\u5237\u65B0\u9875\u9762\u540E\u91CD\u8BD5",
  "error.unknown": "\u672A\u77E5\u9519\u8BEF"
};
var en = {
  "action.checking": "Checking\u2026",
  "action.upToDate": "Up to date",
  "action.fallbackUpdate": "Update (v{version})",
  "action.fastUpdate": "Fast Update (v{version})",
  "action.fastUpdateTip": "Exempt only the target plugin version from the release age policy (sub-dependencies retain 24h protection)",
  "action.githubUpdate": "Update to v{version}",
  "action.updating": "Updating\u2026",
  "action.success": "Updated",
  "action.retry": "Retry",
  "badge.updateAvailable": "Update available",
  "badge.conflictDisabled": "Disabled (conflict)",
  "badge.conflictTip": "Auto-disabled due to conflict with current DSH version",
  "badge.conflictReasonTip": "Auto-disabled due to DSH conflict: {reason}",
  "badge.sidebarUpdatesOnly": "{updates} plugin(s) have updates",
  "badge.sidebarConflictsOnly": "{conflicts} plugin(s) auto-disabled due to conflict",
  "badge.sidebarBoth": "{conflicts} auto-disabled due to conflict, {updates} have updates",
  "danger.freshRelease.title": "Enable <24h release cooling override?",
  "danger.freshRelease.body": "Newly published npm releases (<24 hours) have not completed the minimumReleaseAge cooling window and carry higher supply-chain compromise risk before malicious versions are taken down. Enabling this allows probing <24h versions and installing them when DSH native withholds them (only the target plugin version is exempted; transitive dependencies remain protected). Enable anyway?",
  "danger.unreviewed.title": "Allow unreviewed plugin updates?",
  "danger.unreviewed.body": "Versions not listed in the curated plugin market index and floating GitHub branch commits have not undergone security review and may contain untrusted code. Enabling this allows probing and updating them in one click without further confirmation prompts (unapproved postinstall scripts remain blocked). Enable anyway?",
  "danger.confirmEnable": "I understand, enable",
  "danger.cancel": "Cancel",
  "danger.close": "Close",
  "settings.title": "Default update registry",
  "settings.intro": "The npm registry used by default when updating third-party plugins.",
  "settings.npmjs": "npm official",
  "settings.npmjsHint": "New releases are available immediately, without mirror sync delay.",
  "settings.npmmirror": "npmmirror",
  "settings.npmmirrorHint": "Faster in mainland China; mirror synchronization may lag behind.",
  "settings.customFallbackName": "Custom registry",
  "settings.customHint": "Custom npm registry.",
  "settings.customNameLabel": "Registry label (optional)",
  "settings.customNamePlaceholder": "e.g. Internal mirror",
  "settings.customUrlLabel": "HTTPS registry URL",
  "settings.customUrlPlaceholder": "https://mirrors.example.com/npm/",
  "settings.addCustom": "+ Add custom registry",
  "settings.saveUse": "Save and use",
  "settings.cancel": "Cancel",
  "settings.delete": "Delete",
  "settings.fallback": "Retry once on the npm official registry when a non-official registry fails",
  "settings.fallbackHint": "When a mirror or custom registry fails or lags behind, retry once on the npm official registry.",
  "settings.alwaysShowDetail": "Always show the Fast Update button on plugin detail pages",
  "settings.alwaysShowDetailHint": "When off, standard npm official updates yield to DSH native; GitHub plugins and mirror/custom registries remain handled here. Turn on to expose direct single-step updates whenever permitted by your security toggles.",
  "settings.securitySectionTitle": "Security & release cooling policy",
  "settings.riskEnabledTag": "Risk enabled",
  "settings.allowFreshRelease": "Allow probing and updating npm releases under the 24h cooling period",
  "settings.allowFreshReleaseHint": "Off by default. When enabled, probes npm versions published within 24 hours and activates fallback updates when DSH native withholds them (exempts only the target plugin version; sub-dependencies keep 24h protection).",
  "settings.allowUnreviewed": "Allow probing and updating versions or sources without market security review",
  "settings.allowUnreviewedHint": "Off by default; only exact versions listed in configured DSH market indexes (or awesome-dsh-plugin when unconfigured) are offered. Turn on to probe and update unlisted versions and floating GitHub branches (install scripts remain blocked).",
  "settings.notice.registryUpdated": "Default registry updated",
  "settings.notice.customAdded": "Custom registry added and selected",
  "settings.notice.customRemoved": "Custom registry removed",
  "settings.error.invalidUrl": "Enter a valid HTTPS registry URL (loopback hosts and embedded credentials are not allowed)",
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
  "error.freshReleaseBlocked": "This release is within the 24h cooling period; enable the setting first",
  "error.unreviewedBlocked": "This version or source has not passed market review; enable the setting first",
  "error.forbidden": "Request verification failed. Refresh the page and retry.",
  "error.unknown": "Unknown error"
};

// src/client.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var CHECK_TIMEOUT_MS = 15e3;
var BATCH_CHECK_TIMEOUT_MS = 25e3;
var UPDATE_TIMEOUT_MS = 3e5;
var REPORT_TIMEOUT_MS = 15e3;
function loadDshPrimitives() {
  try {
    if (typeof require === "function") {
      const mod = require("@deepseek-ai/dsh-client-ui-primitives");
      if (mod && typeof mod === "object") return mod;
    }
  } catch {
  }
  return {};
}
var { Button, Modal, Switch, Tag } = loadDshPrimitives();
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
  const dangerStyle = isDanger ? {
    background: "var(--dsw-alias-danger, #dc2626)",
    borderColor: "var(--dsw-alias-danger, #dc2626)",
    color: "#ffffff"
  } : void 0;
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
        border: isPrimary ? "1px solid var(--dsw-alias-primary, #2563eb)" : isDanger ? "1px solid var(--dsw-alias-danger, #dc2626)" : "1px solid var(--dsw-alias-border-l1, #cbd5e1)",
        background: isPrimary ? "var(--dsw-alias-primary, #2563eb)" : isDanger ? "var(--dsw-alias-danger, #dc2626)" : "var(--dsw-alias-bg-elevated, #ffffff)",
        color: isPrimary || isDanger ? "#ffffff" : "var(--dsw-alias-label-primary, #1e293b)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        lineHeight: 1.4,
        whiteSpace: "nowrap",
        transition: "opacity 160ms cubic-bezier(0.16, 1, 0.3, 1)",
        ...dangerStyle,
        ...style
      },
      ...rest,
      children
    }
  );
  if (!isUsableComponent(Button)) return fallback;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeErrorBoundary, { fallback, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    Button,
    {
      variant: isDanger ? "primary" : variant,
      size,
      style: { ...dangerStyle, ...style },
      disabled,
      ...rest,
      children
    }
  ) });
};
var SafeTag = ({ tone = "info", style, children, ...rest }) => {
  const palette = tone === "danger" ? {
    bg: "rgba(220, 38, 38, 0.12)",
    border: "rgba(220, 38, 38, 0.32)",
    color: "var(--dsw-alias-danger, #dc2626)"
  } : tone === "success" ? {
    bg: "rgba(22, 163, 74, 0.12)",
    border: "rgba(22, 163, 74, 0.3)",
    color: "#15803d"
  } : {
    bg: "rgba(37, 99, 235, 0.1)",
    border: "rgba(37, 99, 235, 0.25)",
    color: "var(--dsw-alias-primary, #2563eb)"
  };
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
        fontVariantNumeric: "tabular-nums",
        ...style
      },
      ...rest,
      children
    }
  );
  if (!isUsableComponent(Tag)) return fallback;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeErrorBoundary, { fallback, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Tag, { tone, style, ...rest, children }) });
};
var SafeSwitch = ({ checked, onChange, label, disabled = false }) => {
  const fallback = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      role: "switch",
      "aria-checked": checked,
      "aria-label": label,
      disabled,
      onClick: () => {
        if (!disabled) onChange(!checked);
      },
      style: {
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        width: 36,
        height: 20,
        padding: 2,
        borderRadius: 999,
        border: "none",
        boxSizing: "border-box",
        flexShrink: 0,
        background: checked ? "var(--dsw-alias-label-primary, #111827)" : "var(--dsw-alias-border-l1, #cbd5e1)",
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
        transition: "background-color 180ms cubic-bezier(0.16, 1, 0.3, 1)"
      },
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "span",
        {
          "aria-hidden": "true",
          style: {
            width: 16,
            height: 16,
            borderRadius: 999,
            background: "#ffffff",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.18)",
            transform: checked ? "translateX(16px)" : "translateX(0)",
            transition: "transform 180ms cubic-bezier(0.16, 1, 0.3, 1)"
          }
        }
      )
    }
  );
  if (!isUsableComponent(Switch)) return fallback;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeErrorBoundary, { fallback, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { display: "inline-flex", alignItems: "center", flexShrink: 0 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Switch, { checked, onChange, label, disabled }) }) });
};
var SafeModal = ({ open, onClose, title, description, footer, closeLabel }) => {
  if (!open) return null;
  const fallback = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      role: "dialog",
      "aria-modal": "true",
      "aria-label": title,
      onClick: () => onClose?.(),
      style: {
        position: "fixed",
        inset: 0,
        zIndex: 1e3,
        background: "rgba(15, 23, 42, 0.48)",
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
            maxWidth: 440,
            borderRadius: 12,
            padding: 20,
            background: "var(--dsw-alias-bg-elevated, #ffffff)",
            color: "var(--dsw-alias-label-primary, #1e293b)",
            border: "1px solid var(--dsw-alias-border-l1, #e2e8f0)",
            boxShadow: "0 16px 40px rgba(15, 23, 42, 0.18)",
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
                    padding: "4px 8px"
                  },
                  children: "\xD7"
                }
              )
            ] }),
            description && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 13, color: "var(--dsw-alias-label-secondary, #64748b)", lineHeight: 1.6, marginBottom: 12 }, children: description }),
            footer && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 }, children: footer })
          ]
        }
      )
    }
  );
  if (!isUsableComponent(Modal)) return fallback;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeErrorBoundary, { fallback, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Modal, { open, onClose, title, closeLabel, description, footer }) });
};
async function postUpdaterRequest(path, body, signal) {
  const response = await fetch(path, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      [UPDATER_REQUEST_HEADER]: "1"
    },
    body: JSON.stringify(body),
    signal
  });
  const payload = await response.json().catch(() => null);
  return { status: response.status, payload };
}
var DEFAULT_SETTINGS = {
  registry: "npmjs",
  customRegistries: [],
  fallbackToOfficial: true,
  alwaysShowDetailButton: false,
  allowFreshRelease: false,
  allowUnreviewed: false
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
function createDynamicLocaleBridge(initialCtx) {
  let activeLocale = getLocaleService(initialCtx);
  let activeTranslator = createTranslator(activeLocale);
  let revisionCounter = 0;
  let unsubscribeLocale;
  const listeners = /* @__PURE__ */ new Set();
  const bump = () => {
    revisionCounter += 1;
    for (const fn of listeners) {
      try {
        fn();
      } catch {
      }
    }
  };
  const attach = (targetCtx, nextLocale) => {
    if (!nextLocale) return;
    if (typeof unsubscribeLocale === "function") {
      try {
        unsubscribeLocale();
      } catch {
      }
      unsubscribeLocale = void 0;
    }
    activeLocale = nextLocale;
    registerLocaleDictionaries(targetCtx, nextLocale);
    activeTranslator = createTranslator(nextLocale);
    if (typeof nextLocale.subscribe === "function") {
      try {
        unsubscribeLocale = nextLocale.subscribe(bump);
      } catch {
      }
    }
    bump();
  };
  if (activeLocale) {
    attach(initialCtx, activeLocale);
  }
  return {
    t: (key, params) => activeTranslator(key, params),
    getRevision: () => {
      try {
        const snap = activeLocale?.getSnapshot?.();
        const hostRev = typeof snap?.revision === "number" ? snap.revision : 0;
        return revisionCounter * 1e3 + hostRev;
      } catch {
        return revisionCounter;
      }
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    attach
  };
}
function useLocaleRevision(bridge) {
  const [revision, setRevision] = (0, import_react.useState)(() => bridge.getRevision());
  (0, import_react.useEffect)(() => {
    const sync = () => setRevision(bridge.getRevision());
    const off = bridge.subscribe(sync);
    sync();
    return off;
  }, [bridge]);
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
  [ERROR_CODES.freshReleaseBlocked]: "error.freshReleaseBlocked",
  [ERROR_CODES.unreviewedBlocked]: "error.unreviewedBlocked",
  [ERROR_CODES.forbidden]: "error.forbidden"
};
function errorText(t, errorCode, fallback) {
  const key = errorCode ? ERROR_KEY_BY_CODE[errorCode] : void 0;
  return key ? t(key) : fallback || t("error.unknown");
}
function isOfficialPackage(pkg) {
  return pkg?.official === true || isOfficialPackageName(pkg?.name);
}
var UPDATABLE_STORAGE_KEY = "dsh-plugins-update:updatable-v1";
var CONFLICTS_STORAGE_KEY = "dsh-plugins-update:conflicts-v1";
var UPDATED_SESSION_KEY = "dsh-plugins-update:updated-in-session-v1";
var UI_PREFS_STORAGE_KEY = "dsh-plugins-update:ui-prefs-v1";
var uiPrefs = {
  registryUrl: OFFICIAL_REGISTRY,
  alwaysShowDetailButton: false,
  allowFreshRelease: false,
  allowUnreviewed: false
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
      if (typeof parsed.allowFreshRelease === "boolean") {
        uiPrefs.allowFreshRelease = parsed.allowFreshRelease;
      }
      if (typeof parsed.allowUnreviewed === "boolean") {
        uiPrefs.allowUnreviewed = parsed.allowUnreviewed;
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
  if (typeof next.allowFreshRelease === "boolean" && next.allowFreshRelease !== uiPrefs.allowFreshRelease) {
    uiPrefs.allowFreshRelease = next.allowFreshRelease;
    changed = true;
  }
  if (typeof next.allowUnreviewed === "boolean" && next.allowUnreviewed !== uiPrefs.allowUnreviewed) {
    uiPrefs.allowUnreviewed = next.allowUnreviewed;
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
function isSyncedConfigRef(value) {
  return typeof value === "object" && value !== null && typeof value.get === "function";
}
function resolveSyncedConfigSource(ctx, config) {
  if (config && typeof config === "object" && isSyncedConfigRef(config.registry)) {
    return config;
  }
  try {
    const resolved = ctx?.config?.resolveConfigByPackage?.(PLUGIN_NAME);
    if (resolved && typeof resolved === "object" && isSyncedConfigRef(resolved.registry)) {
      return resolved;
    }
  } catch {
  }
  return void 0;
}
function bindSyncedConfig(ctx, config) {
  const source = resolveSyncedConfigSource(ctx, config);
  if (!source) return;
  const registryRef = source.registry;
  const alwaysShowRef = source.alwaysShowDetailButton;
  const allowFreshRef = source.allowFreshRelease;
  const allowUnreviewedRef = source.allowUnreviewed;
  const applySnapshot = () => {
    const next = {};
    if (isSyncedConfigRef(registryRef)) {
      try {
        const rawRegistry = registryRef.get();
        if (typeof rawRegistry === "string" && rawRegistry.trim() && rawRegistry !== "auto") {
          next.registryUrl = resolveRegistryUrl(rawRegistry.trim());
        }
      } catch {
      }
    }
    if (isSyncedConfigRef(alwaysShowRef)) {
      try {
        const rawAlwaysShow = alwaysShowRef.get();
        if (typeof rawAlwaysShow === "boolean") {
          next.alwaysShowDetailButton = rawAlwaysShow;
        }
      } catch {
      }
    }
    if (isSyncedConfigRef(allowFreshRef)) {
      try {
        const rawFresh = allowFreshRef.get();
        if (typeof rawFresh === "boolean") {
          next.allowFreshRelease = rawFresh;
        }
      } catch {
      }
    }
    if (isSyncedConfigRef(allowUnreviewedRef)) {
      try {
        const rawUnreviewed = allowUnreviewedRef.get();
        if (typeof rawUnreviewed === "boolean") {
          next.allowUnreviewed = rawUnreviewed;
        }
      } catch {
      }
    }
    syncUiPrefs(next);
  };
  const setup = () => {
    applySnapshot();
    const disposers = [];
    for (const ref of [registryRef, alwaysShowRef, allowFreshRef, allowUnreviewedRef]) {
      if (isSyncedConfigRef(ref) && typeof ref.subscribe === "function") {
        try {
          const off = ref.subscribe(applySnapshot);
          if (typeof off === "function") disposers.push(off);
        } catch {
        }
      }
    }
    return disposers.length > 0 ? () => {
      for (const dispose of disposers) {
        try {
          dispose();
        } catch {
        }
      }
    } : void 0;
  };
  if (typeof ctx?.effect === "function") {
    try {
      ctx.effect(setup, "dsh-plugins-update: synced config");
      return;
    } catch {
    }
  }
  setup();
}
var updatablePlugins = /* @__PURE__ */ new Map();
var updatedInSession = /* @__PURE__ */ new Map();
var updatableListeners = /* @__PURE__ */ new Set();
var conflictedPlugins = /* @__PURE__ */ new Map();
var conflictListeners = /* @__PURE__ */ new Set();
var knownThirdPartyPackages = /* @__PURE__ */ new Set();
var reportedSessionCrashes = /* @__PURE__ */ new Set();
var hasRunInitialBatchCheck = false;
var batchCheckAbortController = null;
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
function loadConflictsStorage() {
  try {
    const raw = window.localStorage?.getItem(CONFLICTS_STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return;
    for (const [k, v] of Object.entries(parsed)) {
      if (!k || k === PLUGIN_NAME || isOfficialPackageName(k) || !v || typeof v !== "object") continue;
      const item = v;
      if (typeof item.pluginVersion !== "string" || !item.pluginVersion) continue;
      conflictedPlugins.set(k, {
        pluginVersion: item.pluginVersion,
        ...typeof item.hostVersion === "string" && item.hostVersion ? { hostVersion: item.hostVersion } : {},
        ...typeof item.reason === "string" && item.reason ? { reason: item.reason } : {}
      });
    }
  } catch {
  }
}
function persistConflictsStorage() {
  try {
    const obj = {};
    for (const [k, v] of conflictedPlugins.entries()) obj[k] = v;
    window.localStorage?.setItem(CONFLICTS_STORAGE_KEY, JSON.stringify(obj));
  } catch {
  }
}
try {
  loadStorageMap(window.localStorage, UPDATABLE_STORAGE_KEY, updatablePlugins);
  loadStorageMap(window.sessionStorage, UPDATED_SESSION_KEY, updatedInSession);
  loadConflictsStorage();
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
function notifyConflictsChanged() {
  for (const listener of conflictListeners) {
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
function sameConflictInfo(a, b) {
  if (!a || !b) return false;
  return a.pluginVersion === b.pluginVersion && a.hostVersion === b.hostVersion && a.reason === b.reason;
}
function markPluginConflicted(packageName, info) {
  const name2 = packageName.trim();
  if (!name2 || name2 === PLUGIN_NAME || isOfficialPackageName(name2)) return;
  const prev = conflictedPlugins.get(name2);
  if (sameConflictInfo(prev, info)) return;
  conflictedPlugins.set(name2, info);
  persistConflictsStorage();
  notifyConflictsChanged();
}
function clearPluginConflict(packageName) {
  const name2 = packageName.trim();
  if (!name2) return;
  if (conflictedPlugins.delete(name2)) {
    persistConflictsStorage();
    notifyConflictsChanged();
  }
}
function syncConflictsMap(nextConflicts) {
  if (!nextConflicts || typeof nextConflicts !== "object") return;
  const nextEntries = [];
  for (const [rawName, info] of Object.entries(nextConflicts)) {
    const name2 = rawName.trim();
    if (!name2 || name2 === PLUGIN_NAME || isOfficialPackageName(name2) || !info || typeof info !== "object") continue;
    if (typeof info.pluginVersion !== "string" || !info.pluginVersion) continue;
    knownThirdPartyPackages.add(name2);
    nextEntries.push([name2, info]);
  }
  let changed = nextEntries.length !== conflictedPlugins.size;
  if (!changed) {
    for (const [k, v] of nextEntries) {
      if (!sameConflictInfo(conflictedPlugins.get(k), v)) {
        changed = true;
        break;
      }
    }
  }
  if (!changed) return;
  conflictedPlugins.clear();
  for (const [k, v] of nextEntries) {
    conflictedPlugins.set(k, v);
  }
  persistConflictsStorage();
  notifyConflictsChanged();
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
  postUpdaterRequest(CHECK_ALL_PATH, reqBody, controller.signal).then(({ payload }) => {
    if (batchCheckAbortController !== controller) return;
    if (!payload || typeof payload !== "object" || payload.ok === false) return;
    syncUiPrefs({
      registryUrl: payload.registry,
      alwaysShowDetailButton: payload.alwaysShowDetailButton,
      allowFreshRelease: payload.allowFreshRelease,
      allowUnreviewed: payload.allowUnreviewed
    });
    syncConflictsMap(payload.conflicts ?? {});
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
function useConflictsSnapshot() {
  const [entries, setEntries] = (0, import_react.useState)(() => Array.from(conflictedPlugins.entries()));
  (0, import_react.useEffect)(() => {
    const sync = () => setEntries(Array.from(conflictedPlugins.entries()));
    conflictListeners.add(sync);
    sync();
    return () => {
      conflictListeners.delete(sync);
    };
  }, []);
  return entries;
}
function formatConflictTooltip(t, info) {
  return info.reason ? t("badge.conflictReasonTip", { reason: info.reason }) : t("badge.conflictTip");
}
function buildSidebarTip(t, conflictCount, updatableCount) {
  if (conflictCount > 0 && updatableCount > 0) {
    return t("badge.sidebarBoth", { conflicts: conflictCount, updates: updatableCount });
  }
  if (conflictCount > 0) {
    return t("badge.sidebarConflictsOnly", { conflicts: conflictCount });
  }
  return t("badge.sidebarUpdatesOnly", { updates: updatableCount });
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
function reportRuntimeConflictToBackend(packageName, detail) {
  const name2 = packageName.trim();
  if (!name2 || name2 === PLUGIN_NAME || isOfficialPackageName(name2)) return;
  if (conflictedPlugins.has(name2) || reportedSessionCrashes.has(name2)) return;
  reportedSessionCrashes.add(name2);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), REPORT_TIMEOUT_MS);
  const body = {
    packageName: name2,
    reason: (detail || "Runtime error").trim().slice(0, 260)
  };
  postUpdaterRequest(REPORT_CONFLICT_PATH, body, controller.signal).then(({ payload }) => {
    if (payload?.ok && payload.disabled && payload.conflict) {
      markPluginConflicted(name2, payload.conflict);
    }
  }).catch(() => {
  }).finally(() => {
    window.clearTimeout(timer);
  });
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
    alwaysShowDetailButton: typeof raw?.alwaysShowDetailButton === "boolean" ? raw.alwaysShowDetailButton : DEFAULT_SETTINGS.alwaysShowDetailButton,
    allowFreshRelease: typeof raw?.allowFreshRelease === "boolean" ? raw.allowFreshRelease : DEFAULT_SETTINGS.allowFreshRelease,
    allowUnreviewed: typeof raw?.allowUnreviewed === "boolean" ? raw.allowUnreviewed : DEFAULT_SETTINGS.allowUnreviewed
  };
  const hasRaw = Boolean(raw && typeof raw === "object");
  (0, import_react.useEffect)(() => {
    if (!hasRaw) return;
    syncUiPrefs({
      registryUrl: resolveRegistryUrl(settings.registry),
      alwaysShowDetailButton: settings.alwaysShowDetailButton,
      allowFreshRelease: settings.allowFreshRelease,
      allowUnreviewed: settings.allowUnreviewed
    });
  }, [
    settings.registry,
    settings.alwaysShowDetailButton,
    settings.allowFreshRelease,
    settings.allowUnreviewed,
    hasRaw
  ]);
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
          } else if (field === "allowFreshRelease" && typeof value === "boolean") {
            syncUiPrefs({ allowFreshRelease: value });
          } else if (field === "allowUnreviewed" && typeof value === "boolean") {
            syncUiPrefs({ allowUnreviewed: value });
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
  marginTop: "3px",
  maxWidth: "65ch"
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
  padding: "4px 10px",
  fontSize: "12px",
  borderRadius: "6px",
  border: "1px solid var(--dsw-alias-border-l1, #cbd5e1)",
  background: "var(--dsw-alias-bg-elevated, #ffffff)",
  color: "var(--dsw-alias-label-primary, #334155)",
  cursor: "pointer"
};
var inputLabelStyle = {
  display: "block",
  fontSize: "12px",
  fontWeight: 500,
  color: "var(--dsw-alias-label-primary, #1e293b)",
  marginBottom: "4px"
};
var textInputStyle = {
  width: "100%",
  height: 32,
  padding: "0 10px",
  borderRadius: 6,
  border: "1px solid var(--dsw-alias-border-l1, #cbd5e1)",
  background: "var(--dsw-alias-bg-elevated, #ffffff)",
  color: "var(--dsw-alias-label-primary, #1e293b)",
  fontSize: "13px",
  boxSizing: "border-box"
};
var switchRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 16,
  paddingTop: 12,
  marginTop: 12,
  borderTop: "1px solid var(--dsw-alias-border-l2, #e2e8f0)"
};
var BUILTIN_REGISTRIES = [
  { value: "npmjs", url: OFFICIAL_REGISTRY, labelKey: "settings.npmjs", hintKey: "settings.npmjsHint" },
  { value: "npmmirror", url: DOMESTIC_REGISTRY, labelKey: "settings.npmmirror", hintKey: "settings.npmmirrorHint" }
];
var RegistrySettingsCard = ({ form, localeBridge }) => {
  useLocaleRevision(localeBridge);
  const t = localeBridge.t;
  const { settings, writable, updateField } = useConfigFormState(form);
  const [adding, setAdding] = (0, import_react.useState)(false);
  const [name2, setName] = (0, import_react.useState)("");
  const [url, setUrl] = (0, import_react.useState)("");
  const [errorKey, setErrorKey] = (0, import_react.useState)("");
  const [notice, setNotice] = (0, import_react.useState)(null);
  const [pendingDangerField, setPendingDangerField] = (0, import_react.useState)(null);
  const noticeTimerRef = (0, import_react.useRef)(null);
  const customNameId = (0, import_react.useId)();
  const customUrlId = (0, import_react.useId)();
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
  const handleDangerToggle = (field) => async (next) => {
    if (!writable) return;
    if (next) {
      setPendingDangerField(field);
      return;
    }
    if (await updateField(field, false)) {
      updatablePlugins.clear();
      persistUpdatablePlugins();
      notifyUpdatableChanged();
      runBatchCheck(true);
    }
  };
  const confirmDangerEnable = async () => {
    const field = pendingDangerField;
    setPendingDangerField(null);
    if (!field || !writable) return;
    if (await updateField(field, true)) {
      runBatchCheck(true);
    }
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: cardStyle, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 15, fontWeight: 600 }, children: t("settings.title") }),
      notice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { role: "status", style: { fontSize: 12, color: "#15803d" }, children: t(notice.key, notice.params) })
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
            /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1, minWidth: 0 }, children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontWeight: 600 }, children: [
                t(item.labelKey),
                " ",
                /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontFamily: "monospace", fontWeight: 400, overflowWrap: "anywhere" }, children: item.url })
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
              minWidth: 0,
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
              /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1, minWidth: 0 }, children: [
                /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontWeight: 600 }, children: [
                  item.name || t("settings.customFallbackName"),
                  " ",
                  /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontFamily: "monospace", fontWeight: 400, overflowWrap: "anywhere" }, children: item.url })
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
            style: {
              ...smallButtonStyle,
              color: "var(--dsw-alias-danger, #dc2626)",
              borderColor: "rgba(220, 38, 38, 0.35)",
              alignSelf: "flex-start",
              marginTop: 10,
              marginRight: 12
            },
            onClick: () => void removeCustom(item.url),
            children: t("settings.delete")
          }
        )
      ] }, item.url);
    }),
    !adding && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", style: smallButtonStyle, onClick: () => setAdding(true), disabled: !writable, children: t("settings.addCustom") }),
    adding && /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: customNameId, style: inputLabelStyle, children: t("settings.customNameLabel") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            id: customNameId,
            value: name2,
            onChange: (event) => setName(event.target.value),
            placeholder: t("settings.customNamePlaceholder"),
            style: textInputStyle
          }
        )
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: customUrlId, style: inputLabelStyle, children: t("settings.customUrlLabel") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            id: customUrlId,
            type: "url",
            value: url,
            onChange: (event) => setUrl(event.target.value),
            placeholder: t("settings.customUrlPlaceholder"),
            style: textInputStyle
          }
        )
      ] }),
      errorKey && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { role: "alert", style: { color: "var(--dsw-alias-danger, #b91c1c)", fontSize: 12 }, children: t(errorKey) }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: 8 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeButton, { variant: "primary", size: "sm", onClick: () => void addCustom(), disabled: !writable, children: t("settings.saveUse") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          SafeButton,
          {
            variant: "outline",
            size: "sm",
            onClick: () => {
              setAdding(false);
              setErrorKey("");
            },
            children: t("settings.cancel")
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...switchRowStyle, marginTop: 16, paddingTop: 14 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1, minWidth: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 500, fontSize: 13, color: "var(--dsw-alias-label-primary, #1e293b)" }, children: t("settings.fallback") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: t("settings.fallbackHint") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        SafeSwitch,
        {
          checked: settings.fallbackToOfficial,
          disabled: !writable,
          label: t("settings.fallback"),
          onChange: (next) => void updateField("fallbackToOfficial", next)
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: switchRowStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1, minWidth: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 500, fontSize: 13, color: "var(--dsw-alias-label-primary, #1e293b)" }, children: t("settings.alwaysShowDetail") }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: t("settings.alwaysShowDetailHint") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        SafeSwitch,
        {
          checked: settings.alwaysShowDetailButton,
          disabled: !writable,
          label: t("settings.alwaysShowDetail"),
          onChange: (next) => void updateField("alwaysShowDetailButton", next)
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginTop: 16, paddingTop: 14, borderTop: "1px solid var(--dsw-alias-border-l2, #e2e8f0)" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 14, fontWeight: 600, color: "var(--dsw-alias-label-primary, #1e293b)" }, children: t("settings.securitySectionTitle") }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { ...switchRowStyle, borderTop: "none", marginTop: 8, paddingTop: 4 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1, minWidth: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              fontWeight: 500,
              fontSize: 13,
              color: "var(--dsw-alias-label-primary, #1e293b)"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("settings.allowFreshRelease") }),
              settings.allowFreshRelease && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeTag, { tone: "danger", children: t("settings.riskEnabledTag") })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: t("settings.allowFreshReleaseHint") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        SafeSwitch,
        {
          checked: settings.allowFreshRelease,
          disabled: !writable,
          label: t("settings.allowFreshRelease"),
          onChange: (next) => void handleDangerToggle("allowFreshRelease")(next)
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: switchRowStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1, minWidth: 0 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
          "div",
          {
            style: {
              display: "flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: 8,
              fontWeight: 500,
              fontSize: 13,
              color: "var(--dsw-alias-label-primary, #1e293b)"
            },
            children: [
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: t("settings.allowUnreviewed") }),
              settings.allowUnreviewed && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeTag, { tone: "danger", children: t("settings.riskEnabledTag") })
            ]
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: t("settings.allowUnreviewedHint") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        SafeSwitch,
        {
          checked: settings.allowUnreviewed,
          disabled: !writable,
          label: t("settings.allowUnreviewed"),
          onChange: (next) => void handleDangerToggle("allowUnreviewed")(next)
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      SafeModal,
      {
        open: pendingDangerField !== null,
        onClose: () => setPendingDangerField(null),
        title: pendingDangerField === "allowFreshRelease" ? t("danger.freshRelease.title") : t("danger.unreviewed.title"),
        closeLabel: t("danger.close"),
        description: pendingDangerField === "allowFreshRelease" ? t("danger.freshRelease.body") : t("danger.unreviewed.body"),
        footer: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeButton, { variant: "outline", onClick: () => setPendingDangerField(null), children: t("danger.cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeButton, { variant: "danger", onClick: () => void confirmDangerEnable(), children: t("danger.confirmEnable") })
        ] })
      }
    )
  ] });
};
var DetailConflictBadge = ({ subject, localeBridge }) => {
  useLocaleRevision(localeBridge);
  const t = localeBridge.t;
  useConflictsSnapshot();
  const pkg = subject?.pkg;
  const packageName = typeof pkg?.name === "string" ? pkg.name : "";
  const conflict = packageName ? conflictedPlugins.get(packageName) : void 0;
  const isEnabled = pkg?.enabled === true;
  const currentVersion = pkg?.version;
  const upgradedPastConflict = Boolean(
    conflict && currentVersion && parseSemver(currentVersion) && parseSemver(conflict.pluginVersion) && compareSemver(currentVersion, conflict.pluginVersion) > 0
  );
  (0, import_react.useEffect)(() => {
    if (!packageName || !conflict) return;
    if (upgradedPastConflict) {
      clearPluginConflict(packageName);
      return;
    }
    if (isEnabled) {
      clearPluginConflict(packageName);
      runBatchCheck(false, true);
    }
  }, [conflict, isEnabled, packageName, upgradedPastConflict]);
  if (subject?.kind !== "bundle" || !packageName || isOfficialPackage(pkg) || !conflict || isEnabled || upgradedPastConflict) {
    return null;
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeTag, { tone: "danger", title: formatConflictTooltip(t, conflict), children: t("badge.conflictDisabled") });
};
function isGithubPackage(pkg, checkResult) {
  if (checkResult?.isGithub === true) return true;
  const source = typeof pkg?.source === "string" ? pkg.source : "";
  return /github:|github\.com/i.test(source);
}
var UpdaterActionButton = ({ subject, localeBridge }) => {
  useLocaleRevision(localeBridge);
  const t = localeBridge.t;
  const currentUiPrefs = useUiPrefs();
  const pkg = subject?.pkg;
  const packageName = typeof pkg?.name === "string" ? pkg.name : "";
  const clientVersion = pkg?.version || "0.0.0";
  const renderable = subject?.kind === "bundle" && !!packageName && pkg?.installed !== false && !isOfficialPackage(pkg);
  const [status, setStatus] = (0, import_react.useState)("checking");
  const [checkResult, setCheckResult] = (0, import_react.useState)(null);
  const [message, setMessage] = (0, import_react.useState)(null);
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
  }, [packageName]);
  (0, import_react.useEffect)(() => {
    if (!packageName || !clientVersion) return;
    const cachedVer = updatablePlugins.get(packageName);
    if (cachedVer && versionGte(clientVersion, cachedVer)) {
      clearPluginUpdatable(packageName, clientVersion);
    }
    const cachedConflict = conflictedPlugins.get(packageName);
    if (cachedConflict && parseSemver(clientVersion) && parseSemver(cachedConflict.pluginVersion) && compareSemver(clientVersion, cachedConflict.pluginVersion) > 0) {
      clearPluginConflict(packageName);
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
      const { status: httpStatus, payload } = await postUpdaterRequest(
        CHECK_PATH,
        reqBody,
        controller.signal
      );
      if (token !== tokenRef.current || !mountedRef.current) return null;
      if (!payload || typeof payload !== "object") throw new Error(`HTTP ${httpStatus}`);
      if (payload.ok === false) {
        if (payload.errorCode === ERROR_CODES.notInstalled || payload.errorCode === ERROR_CODES.officialPlugin) {
          clearPluginUpdatable(packageName);
          clearPluginConflict(packageName);
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
        alwaysShowDetailButton: payload.alwaysShowDetailButton,
        allowFreshRelease: payload.allowFreshRelease,
        allowUnreviewed: payload.allowUnreviewed
      });
      if (payload.conflict) {
        markPluginConflicted(packageName, payload.conflict);
      } else {
        clearPluginConflict(packageName);
      }
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
    const updateToken = ++tokenRef.current;
    setStatus("updating");
    setMessage(null);
    const controller = new AbortController();
    updateAbortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), UPDATE_TIMEOUT_MS);
    try {
      const reqBody = { packageName: targetPkg, targetVersion };
      const { status: httpStatus, payload } = await postUpdaterRequest(
        UPDATE_PATH,
        reqBody,
        controller.signal
      );
      if (!payload || typeof payload !== "object") throw new Error(`HTTP ${httpStatus}`);
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
      clearPluginConflict(targetPkg);
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
      await new Promise((resolvePromise) => window.setTimeout(resolvePromise, 1500));
      if (updateToken !== tokenRef.current || !mountedRef.current) return;
      const checked = await fetchCheck();
      if (!mountedRef.current || activePackageRef.current !== targetPkg) return;
      if (checked && versionGte(checked.currentVersion, targetVersion)) {
        const version = checked.currentVersion || targetVersion || clientVersion;
        successVersionRef.current = version;
        clearPluginUpdatable(targetPkg, version);
        clearPluginConflict(targetPkg);
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
  const isGitOrigin = isGithub || typeof pkg?.update === "string" && pkg.update !== "registry";
  const isFreshRelease = checkResult?.isFreshRelease === true;
  const nativeUnavailable = isGitOrigin || usingNonOfficialRegistry || isFreshRelease;
  if (!nativeUnavailable && !effectiveAlwaysShow) {
    return null;
  }
  if (!isGitOrigin && (status === "checking" || status === "up_to_date")) {
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
      void runUpdate();
      return;
    }
    if (status === "checking" || status === "updating") return;
    successVersionRef.current = null;
    void fetchCheck();
  };
  const showMessage = Boolean(messageText) && (isGitOrigin || status !== "success");
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }, children: [
    isGitOrigin ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
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
          onClick: () => void runUpdate(),
          title: isFreshRelease ? t("action.fastUpdateTip") : void 0,
          children: t(isFreshRelease ? "action.fastUpdate" : "action.fallbackUpdate", { version: latestVersion })
        }
      ),
      status === "updating" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12, color: "var(--dsw-alias-label-secondary, #64748b)" }, children: t("action.updating") }),
      status === "success" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 12, color: "#15803d" }, children: messageText || t("action.success") }),
      status === "error" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeButton, { variant: "outline", size: "sm", onClick: () => void fetchCheck(), children: t("action.retry") })
    ] }),
    showMessage && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: status === "error" ? "#b91c1c" : "#15803d", maxWidth: 360 }, children: messageText })
  ] });
};
var SIDEBAR_BADGE_ATTR = "data-dsh-updater-sidebar-badge";
var ROW_BADGE_ATTR = "data-dsh-updater-row-badge";
var ROW_CONFLICT_ATTR = "data-dsh-updater-row-conflict";
var NATIVE_UPDATE_LABELS = /* @__PURE__ */ new Set(["\u53EF\u66F4\u65B0", "Update available"]);
function hasNativeUpdateTag(card, t) {
  const expectedLocal = t("badge.updateAvailable");
  const candidates = card.querySelectorAll("[data-dsw-tag], [data-tone], span");
  for (const el of Array.from(candidates)) {
    if (el.hasAttribute(ROW_BADGE_ATTR) || el.hasAttribute(ROW_CONFLICT_ATTR) || el.closest(`[${ROW_BADGE_ATTR}], [${ROW_CONFLICT_ATTR}]`) || el.querySelector(`[${ROW_BADGE_ATTR}], [${ROW_CONFLICT_ATTR}]`)) {
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
function hasNativeProblemTag(card) {
  if (card.getAttribute("data-plugin-status") === "problem") return true;
  const dangerTags = card.querySelectorAll('[data-tone="danger"]');
  for (const el of Array.from(dangerTags)) {
    if (el.hasAttribute(ROW_CONFLICT_ATTR) || el.hasAttribute(ROW_BADGE_ATTR) || el.closest(`[${ROW_CONFLICT_ATTR}], [${ROW_BADGE_ATTR}]`)) {
      continue;
    }
    return true;
  }
  return false;
}
function mountRowBadgeHost(card, pkgName, attrName, beforeSibling) {
  const host = document.createElement("span");
  host.setAttribute(attrName, pkgName);
  host.style.cssText = "display: inline-flex; align-items: center; flex: none; cursor: pointer;";
  if (beforeSibling?.parentElement) {
    beforeSibling.parentElement.insertBefore(host, beforeSibling);
    return host;
  }
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
  if (targetEl && (targetEl.hasAttribute(SIDEBAR_BADGE_ATTR) || targetEl.hasAttribute(ROW_BADGE_ATTR) || targetEl.hasAttribute(ROW_CONFLICT_ATTR) || targetEl.closest(`[${SIDEBAR_BADGE_ATTR}], [${ROW_BADGE_ATTR}], [${ROW_CONFLICT_ATTR}]`))) {
    return true;
  }
  if (mutation.type === "childList") {
    const nodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
    if (nodes.length > 0 && nodes.every(
      (node) => node instanceof Element && (node.hasAttribute(SIDEBAR_BADGE_ATTR) || node.hasAttribute(ROW_BADGE_ATTR) || node.hasAttribute(ROW_CONFLICT_ATTR))
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
var nativeSidebarTrailingDepth = 0;
var nativeSidebarTrailingListeners = /* @__PURE__ */ new Set();
function notifyNativeSidebarTrailingChanged() {
  for (const listener of nativeSidebarTrailingListeners) {
    try {
      listener();
    } catch {
    }
  }
}
function useNativeSidebarTrailingActive() {
  const [active, setActive] = (0, import_react.useState)(() => nativeSidebarTrailingDepth > 0);
  (0, import_react.useEffect)(() => {
    const sync = () => setActive(nativeSidebarTrailingDepth > 0);
    nativeSidebarTrailingListeners.add(sync);
    sync();
    return () => {
      nativeSidebarTrailingListeners.delete(sync);
    };
  }, []);
  return active;
}
var srOnlyStyle = {
  position: "absolute",
  width: "1px",
  height: "1px",
  padding: 0,
  margin: "-1px",
  overflow: "hidden",
  clip: "rect(0, 0, 0, 0)",
  whiteSpace: "nowrap",
  border: 0
};
function renderSidebarBadgeVisual(conflictCount, updatableCount, wide) {
  if (wide) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", { "aria-hidden": "true", style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: [
      conflictCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeTag, { tone: "danger", children: String(conflictCount) }),
      updatableCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeTag, { tone: "info", children: String(updatableCount) })
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", style: { position: "relative", display: "inline-flex", alignItems: "center" }, children: conflictCount > 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeTag, { tone: "danger", children: String(conflictCount) }),
    updatableCount > 0 && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "span",
      {
        style: {
          position: "absolute",
          top: -2,
          right: -2,
          width: 6,
          height: 6,
          borderRadius: 999,
          background: "var(--dsw-alias-primary, #2563eb)",
          boxShadow: "0 0 0 1.5px var(--dsw-alias-bg-elevated, #ffffff)"
        }
      }
    )
  ] }) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeTag, { tone: "info", children: String(updatableCount) }) });
}
var SidebarPluginsTrailingBadge = ({ wide = true, localeBridge }) => {
  useLocaleRevision(localeBridge);
  const t = localeBridge.t;
  const updatableEntries = useUpdatableSnapshot();
  const conflictEntries = useConflictsSnapshot();
  const updatableCount = updatableEntries.length;
  const conflictCount = conflictEntries.length;
  if (conflictCount <= 0 && updatableCount <= 0) return null;
  const tip = buildSidebarTip(t, conflictCount, updatableCount);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "span",
    {
      title: wide ? tip : void 0,
      style: wide ? { display: "inline-flex", alignItems: "center", gap: 4 } : {
        display: "inline-flex",
        alignItems: "center",
        pointerEvents: "none",
        transform: "scale(0.75) translate(3px, -3px)",
        transformOrigin: "top right"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: srOnlyStyle, children: tip }),
        renderSidebarBadgeVisual(conflictCount, updatableCount, wide)
      ]
    }
  );
};
var UpdateRemindersOverlay = ({ slots, localeBridge }) => {
  useLocaleRevision(localeBridge);
  const t = localeBridge.t;
  const updatableEntries = useUpdatableSnapshot();
  const conflictEntries = useConflictsSnapshot();
  const nativeSidebarTrailing = useNativeSidebarTrailingActive();
  const [sidebarHost, setSidebarHost] = (0, import_react.useState)(null);
  const [sidebarWide, setSidebarWide] = (0, import_react.useState)(true);
  const [rowTargets, setRowTargets] = (0, import_react.useState)([]);
  const [conflictTargets, setConflictTargets] = (0, import_react.useState)([]);
  const lastNativeDoneRef = (0, import_react.useRef)(false);
  const sidebarBtnRef = (0, import_react.useRef)(null);
  const lastSidebarCssRef = (0, import_react.useRef)("");
  const reconciledSwitchOnRef = (0, import_react.useRef)(/* @__PURE__ */ new Set());
  (0, import_react.useEffect)(() => {
    const timer = window.setTimeout(() => {
      runBatchCheck(false);
    }, 600);
    return () => window.clearTimeout(timer);
  }, []);
  (0, import_react.useEffect)(() => {
    const onWindowError = (event) => {
      const msg = String(event?.message || event?.error?.message || "");
      const stack = `${event?.filename || ""}
${event?.error?.stack || ""}`;
      if (stack.includes(`/${PLUGIN_NAME}/`) || stack.includes(`\\${PLUGIN_NAME}\\`) || msg.includes(`"${PLUGIN_NAME}"`)) {
        return;
      }
      const pkg = extractPackageFromStackText(`${stack}
${msg}`);
      if (pkg) {
        reportRuntimeConflictToBackend(pkg, msg || "Uncaught client runtime error");
      }
    };
    const onUnhandledRejection = (event) => {
      const reason = event?.reason;
      const msg = typeof reason === "string" ? reason : typeof reason?.message === "string" ? reason.message : String(reason || "");
      const stack = typeof reason?.stack === "string" ? reason.stack : "";
      if (stack.includes(`/${PLUGIN_NAME}/`) || stack.includes(`\\${PLUGIN_NAME}\\`) || msg.includes(`"${PLUGIN_NAME}"`)) {
        return;
      }
      const pkg = extractPackageFromStackText(`${stack}
${msg}`);
      if (pkg) {
        reportRuntimeConflictToBackend(pkg, msg || "Unhandled promise rejection");
      }
    };
    window.addEventListener("error", onWindowError);
    window.addEventListener("unhandledrejection", onUnhandledRejection);
    return () => {
      window.removeEventListener("error", onWindowError);
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);
  const syncDomTargets = (0, import_react.useCallback)(() => {
    try {
      const hasAnyBadge = updatablePlugins.size > 0 || conflictedPlugins.size > 0;
      if (nativeSidebarTrailingDepth > 0) {
        if (sidebarBtnRef.current) {
          sidebarBtnRef.current.querySelector(`span[${SIDEBAR_BADGE_ATTR}="true"]`)?.remove();
          sidebarBtnRef.current = null;
          lastSidebarCssRef.current = "";
        }
        setSidebarHost(null);
      } else {
        let pluginsBtn = sidebarBtnRef.current;
        if (!pluginsBtn || !pluginsBtn.isConnected) {
          pluginsBtn = findSidebarPluginsButton(slots);
          sidebarBtnRef.current = pluginsBtn;
          lastSidebarCssRef.current = "";
        }
        const hasNativeTrailingSlotInDom = Boolean(
          pluginsBtn?.querySelector('[data-slot="sidebar.panellist.trailing"]')
        );
        if (pluginsBtn && !hasNativeTrailingSlotInDom) {
          let host = pluginsBtn.querySelector(`span[${SIDEBAR_BADGE_ATTR}="true"]`);
          if (!host) {
            host = document.createElement("span");
            host.setAttribute(SIDEBAR_BADGE_ATTR, "true");
            pluginsBtn.appendChild(host);
            lastSidebarCssRef.current = "";
          }
          let nextCssText = "display: none;";
          const isCollapsed = pluginsBtn.clientWidth > 0 && pluginsBtn.clientWidth <= 48;
          setSidebarWide(!isCollapsed);
          if (hasAnyBadge) {
            if ((!pluginsBtn.style.position || pluginsBtn.style.position === "static") && window.getComputedStyle(pluginsBtn).position === "static") {
              pluginsBtn.style.position = "relative";
            }
            if (isCollapsed) {
              nextCssText = "position: absolute; top: 2px; right: 2px; display: inline-flex; align-items: center; pointer-events: none; transform: scale(0.8); transformOrigin: top right;";
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
          pluginsBtn?.querySelector(`span[${SIDEBAR_BADGE_ATTR}="true"]`)?.remove();
          setSidebarHost(null);
        }
      }
      const cards = Array.from(document.querySelectorAll("li[data-plugin-package]"));
      for (const card of cards) {
        const pkg = card.getAttribute("data-plugin-package");
        if (pkg && pkg !== PLUGIN_NAME && !isOfficialPackageName(pkg)) {
          knownThirdPartyPackages.add(pkg);
        }
      }
      const nextRowTargets = [];
      const nextConflictTargets = [];
      for (const card of cards) {
        const pkgName = card.getAttribute("data-plugin-package") || "";
        if (!pkgName) continue;
        const latestVersion = updatablePlugins.get(pkgName);
        const conflict = conflictedPlugins.get(pkgName);
        const switchAttr = card.querySelector('[role="switch"]')?.getAttribute("aria-checked");
        const isCardSwitchOn = switchAttr === "true";
        if (conflict && isCardSwitchOn) {
          if (!reconciledSwitchOnRef.current.has(pkgName)) {
            reconciledSwitchOnRef.current.add(pkgName);
            window.setTimeout(() => runBatchCheck(false, true), 600);
          }
        } else {
          reconciledSwitchOnRef.current.delete(pkgName);
        }
        const escapedPkg = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(pkgName) : pkgName.replace(/["\\]/g, "\\$&");
        let conflictHost = card.querySelector(`span[${ROW_CONFLICT_ATTR}="${escapedPkg}"]`);
        let updateHost = card.querySelector(`span[${ROW_BADGE_ATTR}="${escapedPkg}"]`);
        const showConflict = Boolean(conflict && !isCardSwitchOn && !hasNativeProblemTag(card));
        const showUpdate = Boolean(latestVersion && !hasNativeUpdateTag(card, t));
        if (showConflict && conflict) {
          const updateParent = updateHost?.parentElement;
          if (!conflictHost) {
            conflictHost = mountRowBadgeHost(card, pkgName, ROW_CONFLICT_ATTR, updateHost);
          } else if (updateHost && updateParent && conflictHost.parentElement === updateParent) {
            if (conflictHost.compareDocumentPosition(updateHost) & Node.DOCUMENT_POSITION_PRECEDING) {
              updateParent.insertBefore(conflictHost, updateHost);
            }
          }
          nextConflictTargets.push({
            packageName: pkgName,
            conflict,
            host: conflictHost,
            card
          });
        } else if (conflictHost) {
          conflictHost.remove();
        }
        if (showUpdate && latestVersion) {
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
      setConflictTargets((prev) => {
        if (prev.length === nextConflictTargets.length && prev.every(
          (item, i) => item.packageName === nextConflictTargets[i].packageName && sameConflictInfo(item.conflict, nextConflictTargets[i].conflict) && item.host === nextConflictTargets[i].host
        )) {
          return prev;
        }
        return nextConflictTargets;
      });
      setRowTargets((prev) => {
        if (prev.length === nextRowTargets.length && prev.every(
          (item, i) => item.packageName === nextRowTargets[i].packageName && item.latestVersion === nextRowTargets[i].latestVersion && item.host === nextRowTargets[i].host
        )) {
          return prev;
        }
        return nextRowTargets;
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
  }, [syncDomTargets, updatableEntries, conflictEntries, nativeSidebarTrailing]);
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
      attributeFilter: ["data-plugin-update", "data-install-phase", "aria-checked", "data-plugin-status"]
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
      document.querySelectorAll(`[${SIDEBAR_BADGE_ATTR}], [${ROW_BADGE_ATTR}], [${ROW_CONFLICT_ATTR}]`).forEach((el) => el.remove());
    };
  }, []);
  const updatableCount = updatableEntries.length;
  const conflictCount = conflictEntries.length;
  const hasAnySidebarBadge = conflictCount > 0 || updatableCount > 0;
  const sidebarTip = hasAnySidebarBadge ? buildSidebarTip(t, conflictCount, updatableCount) : "";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    sidebarHost && hasAnySidebarBadge && (0, import_react_dom.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { title: sidebarTip, style: { display: "inline-flex", alignItems: "center", gap: 4 }, children: renderSidebarBadgeVisual(conflictCount, updatableCount, sidebarWide) }),
      sidebarHost
    ),
    conflictTargets.map(
      ({ packageName, conflict, host, card }) => (0, import_react_dom.createPortal)(
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "span",
          {
            title: formatConflictTooltip(t, conflict),
            onClick: (event) => {
              event.stopPropagation();
              const openBtn = card.querySelector('button:not([role="switch"])');
              openBtn?.click();
            },
            style: { display: "inline-flex", alignItems: "center" },
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SafeTag, { tone: "danger", children: t("badge.conflictDisabled") })
          }
        ),
        host,
        `conflict:${packageName}`
      )
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
        `update:${packageName}`
      )
    )
  ] });
};
function apply(ctx, config) {
  const localeBridge = createDynamicLocaleBridge(ctx);
  if (!getLocaleService(ctx) && typeof ctx?.inject === "function") {
    try {
      ctx.inject(["locale"], (subCtx) => {
        localeBridge.attach(subCtx, getLocaleService(subCtx));
      });
    } catch {
    }
  }
  bindSyncedConfig(ctx, config);
  const slots = ctx.slots ?? ctx.get?.("slots");
  if (!slots?.inject || !slots?.register) return;
  let formInstance;
  const getForm = () => {
    if (formInstance) return formInstance;
    const cf = ctx.configForms ?? ctx.get?.("configForms");
    if (cf?.get) formInstance = cf.get(PLUGIN_NAME);
    return formInstance;
  };
  try {
    slots.inject("sidebar.panellist.trailing", () => {
      let disposeRegistration;
      try {
        disposeRegistration = slots.register(
          {
            name: "sidebar.panellist.trailing",
            id: "plugins",
            priority: 10
          },
          (props) => import_react.default.createElement(
            SafeErrorBoundary,
            { fallback: null },
            import_react.default.createElement(SidebarPluginsTrailingBadge, { ...props, localeBridge })
          )
        );
      } catch {
        return void 0;
      }
      nativeSidebarTrailingDepth += 1;
      notifyNativeSidebarTrailingChanged();
      return () => {
        nativeSidebarTrailingDepth = Math.max(0, nativeSidebarTrailingDepth - 1);
        notifyNativeSidebarTrailingChanged();
        if (typeof disposeRegistration === "function") {
          try {
            disposeRegistration();
          } catch {
          }
        }
      };
    });
  } catch {
  }
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
        import_react.default.createElement(UpdateRemindersOverlay, { ...props, slots, localeBridge })
      )
    )
  );
  try {
    slots.inject(
      "plugins.detail.badge",
      () => slots.register(
        {
          name: "plugins.detail.badge",
          id: `${PLUGIN_NAME}.conflict-badge`,
          order: -5
        },
        (props) => import_react.default.createElement(
          SafeErrorBoundary,
          { fallback: null },
          import_react.default.createElement(DetailConflictBadge, { ...props, localeBridge })
        )
      )
    );
  } catch {
  }
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
        import_react.default.createElement(UpdaterActionButton, { ...props, localeBridge })
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
        import_react.default.createElement(RegistrySettingsCard, { form: form || getForm(), localeBridge })
      )
    )
  );
  const bindConfigCard = (targetCtx, cf) => {
    if (cf?.whileServed) {
      targetCtx.effect(
        () => cf.whileServed([PLUGIN_NAME], () => {
          const form = cf.get(PLUGIN_NAME);
          formInstance = form;
          return registerBundleConfig(form);
        }),
        "dsh-plugins-update: bundle settings card"
      );
    } else {
      registerBundleConfig(cf?.get?.(PLUGIN_NAME));
    }
  };
  const immediateCf = ctx.configForms ?? ctx.get?.("configForms");
  if (immediateCf) {
    bindConfigCard(ctx, immediateCf);
  } else if (typeof ctx.inject === "function") {
    ctx.inject(["configForms"], (subCtx) => {
      bindConfigCard(subCtx, subCtx.configForms ?? subCtx.get?.("configForms"));
    });
  } else {
    registerBundleConfig();
  }
}
var name = PLUGIN_NAME;
var inject = ["slots"];

    return module.exports;
  }
});
