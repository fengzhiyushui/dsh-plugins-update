/**
 * dsh-plugins-update v0.2.6
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
  "error.unknown": "Unknown error"
};

// src/client.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var CHECK_TIMEOUT_MS = 15e3;
var BATCH_CHECK_TIMEOUT_MS = 25e3;
var UPDATE_TIMEOUT_MS = 3e5;
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
  [ERROR_CODES.rollbackFailed]: "error.rollbackFailed"
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
    syncUiPrefs(next);
  };
  const setup = () => {
    applySnapshot();
    const disposers = [];
    if (isSyncedConfigRef(registryRef) && typeof registryRef.subscribe === "function") {
      try {
        const off = registryRef.subscribe(applySnapshot);
        if (typeof off === "function") disposers.push(off);
      } catch {
      }
    }
    if (isSyncedConfigRef(alwaysShowRef) && typeof alwaysShowRef.subscribe === "function") {
      try {
        const off = alwaysShowRef.subscribe(applySnapshot);
        if (typeof off === "function") disposers.push(off);
      } catch {
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
    if (!payload.updatable || typeof payload.updatable !== "object") return;
    const nextMap = /* @__PURE__ */ new Map();
    for (const [rawName, rawVer] of Object.entries(payload.updatable)) {
      if (typeof rawName !== "string" || typeof rawVer !== "string") continue;
      const name2 = rawName.trim();
      const ver = rawVer.trim().replace(/^[v^~]/, "");
      if (!name2 || !ver || isOfficialPackageName(name2)) continue;
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
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: cardStyle, children: [
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
      import_dsh_client_ui_primitives.Button,
      {
        variant: status === "has_update" ? "primary" : "outline",
        size: "sm",
        onClick: onButtonClick,
        disabled: status === "checking" || status === "updating",
        children: buttonLabel
      }
    ) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      status === "has_update" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        import_dsh_client_ui_primitives.Button,
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
      status === "error" && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", size: "sm", onClick: () => void fetchCheck(), children: t("action.retry") })
    ] }),
    showMessage && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: status === "error" ? "#b91c1c" : "#15803d", maxWidth: 360 }, children: messageText }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      import_dsh_client_ui_primitives.Modal,
      {
        open: confirmOpen,
        onClose: () => setConfirmOpen(false),
        title: t("confirm.title"),
        closeLabel: t("confirm.close"),
        description: t("confirm.body", { packageName, version: latestVersion }),
        footer: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "outline", onClick: () => setConfirmOpen(false), children: t("confirm.cancel") }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Button, { variant: "primary", onClick: () => void runUpdate(), children: t("confirm.ok") })
        ] })
      }
    )
  ] });
};
var SIDEBAR_BADGE_ATTR = "data-dsh-updater-sidebar-badge";
var ROW_BADGE_ATTR = "data-dsh-updater-row-badge";
var NATIVE_UPDATE_LABELS = /* @__PURE__ */ new Set(["\u53EF\u66F4\u65B0", "Update available"]);
function hasNativeUpdateTag(card, t) {
  const expectedLocal = t("badge.updateAvailable");
  const candidates = card.querySelectorAll("[data-dsw-tag], [data-tone], span");
  for (const el of Array.from(candidates)) {
    if (el.hasAttribute(ROW_BADGE_ATTR) || el.closest(`[${ROW_BADGE_ATTR}]`) || el.querySelector(`[${ROW_BADGE_ATTR}]`)) {
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
function mountRowBadgeHost(card, pkgName) {
  const host = document.createElement("span");
  host.setAttribute(ROW_BADGE_ATTR, pkgName);
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
  if (targetEl && (targetEl.hasAttribute(SIDEBAR_BADGE_ATTR) || targetEl.hasAttribute(ROW_BADGE_ATTR) || targetEl.closest(`[${SIDEBAR_BADGE_ATTR}], [${ROW_BADGE_ATTR}]`))) {
    return true;
  }
  if (mutation.type === "childList") {
    const nodes = [...Array.from(mutation.addedNodes), ...Array.from(mutation.removedNodes)];
    if (nodes.length > 0 && nodes.every(
      (node) => node instanceof Element && (node.hasAttribute(SIDEBAR_BADGE_ATTR) || node.hasAttribute(ROW_BADGE_ATTR))
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
var SidebarPluginsTrailingBadge = ({ wide = true, t, locale }) => {
  useLocaleRevision(locale);
  const updatableEntries = useUpdatableSnapshot();
  const count = updatableEntries.length;
  if (count <= 0) return null;
  const tip = t("badge.sidebarTip", { count });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
    "span",
    {
      title: wide ? tip : void 0,
      style: wide ? { display: "inline-flex", alignItems: "center" } : {
        display: "inline-flex",
        alignItems: "center",
        pointerEvents: "none",
        transform: "scale(0.75) translate(3px, -3px)",
        transformOrigin: "top right"
      },
      children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: srOnlyStyle, children: tip }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { "aria-hidden": "true", style: { display: "inline-flex", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tag, { tone: "info", children: String(count) }) })
      ]
    }
  );
};
var UpdateRemindersOverlay = ({ slots, t, locale }) => {
  useLocaleRevision(locale);
  const updatableEntries = useUpdatableSnapshot();
  const nativeSidebarTrailing = useNativeSidebarTrailingActive();
  const [sidebarHost, setSidebarHost] = (0, import_react.useState)(null);
  const [rowTargets, setRowTargets] = (0, import_react.useState)([]);
  const lastNativeDoneRef = (0, import_react.useRef)(false);
  const sidebarBtnRef = (0, import_react.useRef)(null);
  const lastSidebarCssRef = (0, import_react.useRef)("");
  (0, import_react.useEffect)(() => {
    const timer = window.setTimeout(() => {
      runBatchCheck(false);
    }, 600);
    return () => window.clearTimeout(timer);
  }, []);
  const syncDomTargets = (0, import_react.useCallback)(() => {
    try {
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
          pluginsBtn?.querySelector(`span[${SIDEBAR_BADGE_ATTR}="true"]`)?.remove();
          setSidebarHost(null);
        }
      }
      const cards = Array.from(document.querySelectorAll("li[data-plugin-package]"));
      const nextRowTargets = [];
      for (const card of cards) {
        const pkgName = card.getAttribute("data-plugin-package") || "";
        if (!pkgName) continue;
        const latestVersion = updatablePlugins.get(pkgName);
        const escapedPkg = typeof CSS !== "undefined" && typeof CSS.escape === "function" ? CSS.escape(pkgName) : pkgName.replace(/["\\]/g, "\\$&");
        let host = card.querySelector(`span[${ROW_BADGE_ATTR}="${escapedPkg}"]`);
        if (latestVersion && !hasNativeUpdateTag(card, t)) {
          if (!host) {
            host = mountRowBadgeHost(card, pkgName);
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
  }, [syncDomTargets, updatableEntries, nativeSidebarTrailing]);
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
      document.querySelectorAll(`[${SIDEBAR_BADGE_ATTR}], [${ROW_BADGE_ATTR}]`).forEach((el) => el.remove());
    };
  }, []);
  const count = updatableEntries.length;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
    sidebarHost && count > 0 && (0, import_react_dom.createPortal)(
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { title: t("badge.sidebarTip", { count }), style: { display: "inline-flex", alignItems: "center" }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tag, { tone: "info", children: String(count) }) }),
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
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(import_dsh_client_ui_primitives.Tag, { tone: "info", children: t("badge.updateAvailable") })
          }
        ),
        host,
        packageName
      )
    )
  ] });
};
function apply(ctx, config) {
  const locale = getLocaleService(ctx);
  const t = createTranslator(locale);
  registerLocaleDictionaries(ctx, locale);
  bindSyncedConfig(ctx, config);
  let formInstance;
  const getForm = () => {
    if (formInstance) return formInstance;
    if (ctx.configForms?.get) formInstance = ctx.configForms.get(PLUGIN_NAME);
    return formInstance;
  };
  const slots = ctx.slots;
  if (!slots?.inject || !slots?.register) return;
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
          (props) => import_react.default.createElement(SidebarPluginsTrailingBadge, { ...props, t, locale })
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
      (props) => import_react.default.createElement(UpdateRemindersOverlay, { ...props, slots, t, locale })
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
      (props) => import_react.default.createElement(UpdaterActionButton, { ...props, t, locale })
    )
  );
  const registerBundleConfig = (form) => slots.inject(
    "plugins.bundle.config",
    () => slots.register(
      {
        name: "plugins.bundle.config",
        key: PLUGIN_NAME
      },
      () => import_react.default.createElement(RegistrySettingsCard, { form: form || getForm(), t, locale })
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
