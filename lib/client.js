/**
 * dsh-plugins-update v0.2.0
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
var import_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");

// src/types.ts
var OFFICIAL_REGISTRY = "https://registry.npmjs.org/";
var DOMESTIC_REGISTRY = "https://registry.npmmirror.com/";
var LOCALE_NAMESPACE = "dsh-plugins-update";
var CHECK_PATH = "/api/dsh-plugins-update/check";
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
  "action.checking": "\u68C0\u67E5\u4E2D\u2026",
  "action.checkUpdate": "\u68C0\u67E5\u66F4\u65B0",
  "action.upToDate": "\u5DF2\u662F\u6700\u65B0",
  "action.updateTo": "\u66F4\u65B0\u81F3 v{version}",
  "action.updating": "\u66F4\u65B0\u4E2D\u2026",
  "action.success": "\u5DF2\u66F4\u65B0",
  "action.retry": "\u91CD\u8BD5",
  "action.updateFailed": "\u66F4\u65B0\u5931\u8D25(\u91CD\u8BD5)",
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
  "action.checkUpdate": "Check for updates",
  "action.upToDate": "Up to date",
  "action.updateTo": "Update to v{version}",
  "action.updating": "Updating\u2026",
  "action.success": "Updated",
  "action.retry": "Retry",
  "action.updateFailed": "Update failed (retry)",
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
var CHECK_TIMEOUT_MS = 12e3;
var UPDATE_TIMEOUT_MS = 19e4;
var SELF_PACKAGE_NAME = "dsh-plugins-update";
var DEFAULT_SETTINGS = {
  registry: "npmjs",
  customRegistries: [],
  fallbackToOfficial: true
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
  return pkg?.official === true || typeof pkg?.name === "string" && pkg.name.startsWith("@deepseek-ai/");
}
function versionGte(installed, target) {
  if (!installed || !target) return false;
  const a = installed.trim().replace(/^[v^~]/, "").split("-")[0].split(".").map(Number);
  const b = target.trim().replace(/^[v^~]/, "").split("-")[0].split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return true;
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
    fallbackToOfficial: typeof raw?.fallbackToOfficial === "boolean" ? raw.fallbackToOfficial : DEFAULT_SETTINGS.fallbackToOfficial
  };
  const updateField = (0, import_react.useCallback)(
    async (field, value) => {
      if (!form?.set) return false;
      try {
        return await form.set(field, value) !== false;
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
var RegistrySettingsCard = ({ form, t, locale }) => {
  useLocaleRevision(locale);
  const { settings, writable, updateField } = useConfigFormState(form);
  const [adding, setAdding] = (0, import_react.useState)(false);
  const [name2, setName] = (0, import_react.useState)("");
  const [url, setUrl] = (0, import_react.useState)("");
  const [errorKey, setErrorKey] = (0, import_react.useState)("");
  const [notice, setNotice] = (0, import_react.useState)(null);
  const showNotice = (key, params) => {
    setNotice({ key, params });
    window.setTimeout(() => setNotice(null), 2500);
  };
  const select = async (value) => {
    if (!writable) return;
    if (await updateField("registry", value)) showNotice("settings.notice.registryUpdated");
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
    if (!await updateField("customRegistries", next)) {
      setErrorKey("settings.error.saveFailed");
      return;
    }
    await updateField("registry", normalized);
    setName("");
    setUrl("");
    setAdding(false);
    showNotice("settings.notice.customAdded");
  };
  const removeCustom = async (target) => {
    const normalized = normalizeRegistryUrl(target);
    const next = settings.customRegistries.filter((item) => normalizeRegistryUrl(item.url) !== normalized);
    await updateField("customRegistries", next);
    if (normalizeRegistryUrl(settings.registry) === normalized) await updateField("registry", "npmjs");
    showNotice("settings.notice.customRemoved");
  };
  const isCurrent = (value) => value === "npmjs" || value === "npmmirror" ? settings.registry === value : normalizeRegistryUrl(settings.registry) === normalizeRegistryUrl(value);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: cardStyle, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 15, fontWeight: 600 }, children: t("settings.title") }),
      notice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: 11, color: "#16a34a" }, children: t(notice.key, notice.params) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...hintStyle, marginBottom: 10 }, children: t("settings.intro") }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: optionStyle(isCurrent("npmjs")), onClick: () => void select("npmjs"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "radio", checked: isCurrent("npmjs"), onChange: () => void select("npmjs"), disabled: !writable, style: { marginRight: 10, marginTop: 3 } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontWeight: 600 }, children: [
          t("settings.npmjs"),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontFamily: "monospace", fontWeight: 400 }, children: OFFICIAL_REGISTRY })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: t("settings.npmjsHint") })
      ] })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: optionStyle(isCurrent("npmmirror")), onClick: () => void select("npmmirror"), children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "radio", checked: isCurrent("npmmirror"), onChange: () => void select("npmmirror"), disabled: !writable, style: { marginRight: 10, marginTop: 3 } }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontWeight: 600 }, children: [
          t("settings.npmmirror"),
          " ",
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontFamily: "monospace", fontWeight: 400 }, children: DOMESTIC_REGISTRY })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: t("settings.npmmirrorHint") })
      ] })
    ] }),
    settings.customRegistries.map((item) => {
      const active = isCurrent(item.url);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: optionStyle(active), onClick: () => void select(item.url), children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("input", { type: "radio", checked: active, onChange: () => void select(item.url), disabled: !writable, style: { marginRight: 10, marginTop: 3 } }),
        /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { flex: 1 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { fontWeight: 600 }, children: [
            item.name || t("settings.customFallbackName"),
            " ",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontFamily: "monospace", fontWeight: 400 }, children: item.url })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: t("settings.customHint") })
        ] }),
        writable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            style: { ...smallButtonStyle, color: "#dc2626", borderColor: "#fca5a5" },
            onClick: (event) => {
              event.stopPropagation();
              void removeCustom(item.url);
            },
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
    ] })
  ] });
};
var UpdaterActionButton = ({ subject, t, locale }) => {
  useLocaleRevision(locale);
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
  const abortRef = (0, import_react.useRef)(null);
  const successVersionRef = (0, import_react.useRef)(null);
  (0, import_react.useEffect)(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      tokenRef.current += 1;
      abortRef.current?.abort();
    };
  }, []);
  const fetchCheck = (0, import_react.useCallback)(async () => {
    if (!renderable) return null;
    const token = ++tokenRef.current;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
    setStatus("checking");
    setMessage(null);
    try {
      const response = await fetch(CHECK_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageName, currentVersion: clientVersion }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null);
      if (token !== tokenRef.current || !mountedRef.current) return null;
      if (!payload || typeof payload !== "object") throw new Error(`HTTP ${response.status}`);
      if (payload.ok === false) {
        setCheckResult(null);
        setStatus("error");
        setMessage({ key: "", params: { text: errorText(t, payload.errorCode, payload.error) } });
        return payload;
      }
      setCheckResult(payload);
      setStatus(payload.hasUpdate ? "has_update" : "up_to_date");
      return payload;
    } catch (error) {
      if (token !== tokenRef.current || !mountedRef.current) return null;
      setCheckResult(null);
      setStatus("error");
      setMessage({ key: error?.name === "AbortError" ? "check.timeout" : "check.network" });
      return null;
    } finally {
      window.clearTimeout(timer);
      if (abortRef.current === controller) abortRef.current = null;
    }
  }, [clientVersion, packageName, renderable, t]);
  (0, import_react.useEffect)(() => {
    if (!renderable) return;
    if (successVersionRef.current && clientVersion === successVersionRef.current) return;
    void fetchCheck();
  }, [clientVersion, fetchCheck, renderable]);
  const runUpdate = async () => {
    if (!checkResult?.hasUpdate || status === "updating") return;
    const targetVersion = checkResult.latestVersion;
    const source = checkResult.source;
    setConfirmOpen(false);
    setStatus("updating");
    setMessage(null);
    const controller = new AbortController();
    abortRef.current = controller;
    const timer = window.setTimeout(() => controller.abort(), UPDATE_TIMEOUT_MS);
    try {
      const response = await fetch(UPDATE_PATH, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ packageName, targetVersion, source }),
        signal: controller.signal
      });
      const payload = await response.json().catch(() => null);
      if (!mountedRef.current) return;
      if (!payload || typeof payload !== "object") throw new Error(`HTTP ${response.status}`);
      if (payload.ok === false) {
        setStatus("error");
        setMessage({ key: "", params: { text: errorText(t, payload.errorCode, payload.error) } });
        return;
      }
      const version = payload.targetVersion || targetVersion || clientVersion;
      successVersionRef.current = version;
      setStatus("success");
      setMessage({
        key: packageName === SELF_PACKAGE_NAME ? "update.selfUpdate" : "update.success",
        params: { version }
      });
    } catch {
      await new Promise((resolve) => window.setTimeout(resolve, 1500));
      const checked = await fetchCheck();
      if (checked && versionGte(checked.currentVersion, targetVersion)) {
        const version = checked.currentVersion || targetVersion || clientVersion;
        successVersionRef.current = version;
        setStatus("success");
        setMessage({
          key: packageName === SELF_PACKAGE_NAME ? "update.selfUpdate" : "update.success",
          params: { version }
        });
      } else {
        setStatus("error");
        setMessage({ key: "update.failed" });
      }
    } finally {
      window.clearTimeout(timer);
      if (abortRef.current === controller) abortRef.current = null;
    }
  };
  if (!renderable) return null;
  const latestVersion = checkResult?.latestVersion || "";
  const buttonLabel = status === "checking" ? t("action.checking") : status === "has_update" ? t("action.updateTo", { version: latestVersion }) : status === "updating" ? t("action.updating") : status === "success" ? t("action.success") : status === "up_to_date" ? t("action.upToDate") : t("action.retry");
  const onButtonClick = () => {
    if (status === "has_update") {
      setConfirmOpen(true);
      return;
    }
    if (status === "checking" || status === "updating") return;
    successVersionRef.current = null;
    void fetchCheck();
  };
  const messageText = message ? message.key ? t(message.key, message.params) : String(message.params?.text || "") : "";
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "inline-flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        type: "button",
        onClick: onButtonClick,
        disabled: status === "checking" || status === "updating",
        style: {
          padding: "6px 14px",
          borderRadius: 6,
          border: "1px solid var(--dsw-alias-border-l1, #cbd5e1)",
          background: status === "has_update" ? "#2563eb" : "var(--dsw-alias-bg-elevated, #ffffff)",
          color: status === "has_update" ? "#fff" : "var(--dsw-alias-label-primary, #1e293b)",
          cursor: status === "checking" || status === "updating" ? "default" : "pointer",
          fontWeight: 500,
          fontSize: 13
        },
        children: buttonLabel
      }
    ),
    messageText && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontSize: 12, color: status === "error" ? "#b91c1c" : "#15803d", maxWidth: 360 }, children: messageText }),
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
function apply(ctx) {
  const locale = getLocaleService(ctx);
  const t = createTranslator(locale);
  registerLocaleDictionaries(ctx, locale);
  let formInstance;
  const getForm = () => {
    if (formInstance) return formInstance;
    if (ctx.configForms?.get) formInstance = ctx.configForms.get("dsh-plugins-update");
    return formInstance;
  };
  if (!ctx.slots?.inject || !ctx.slots?.register) return;
  ctx.slots.inject(
    "plugins.detail.actions",
    () => ctx.slots.register(
      {
        name: "plugins.detail.actions",
        id: "dsh-plugins-update.action-button",
        order: -10
      },
      (props) => import_react.default.createElement(UpdaterActionButton, { ...props, t, locale })
    )
  );
  const registerBundleConfig = (form) => {
    ctx.slots.inject(
      "plugins.bundle.config",
      () => ctx.slots.register(
        {
          name: "plugins.bundle.config",
          key: "dsh-plugins-update"
        },
        () => import_react.default.createElement(RegistrySettingsCard, { form: form || getForm(), t, locale })
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
var name = "dsh-plugins-update";
var inject = ["slots", "configForms", "locale"];

    return module.exports;
  }
});
