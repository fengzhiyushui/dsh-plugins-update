/**
 * dsh-plugins-update v0.1.2
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

// src/client.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var checkCache = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 60 * 1e3;
var DEFAULT_SETTINGS = {
  registry: "auto",
  customRegistries: [],
  fallbackToOfficial: true
};
function useConfigFormState(form) {
  const [snapshot, setSnapshot] = (0, import_react.useState)(() => form?.getSnapshot ? form.getSnapshot() : { status: "idle" });
  (0, import_react.useEffect)(() => {
    if (!form?.subscribe) return;
    const unsub = form.subscribe(() => {
      setSnapshot(form.getSnapshot?.() ?? {});
    });
    setSnapshot(form.getSnapshot?.() ?? {});
    return unsub;
  }, [form]);
  const rawValue = snapshot?.value;
  const settings = {
    registry: typeof rawValue?.registry === "string" ? rawValue.registry : DEFAULT_SETTINGS.registry,
    customRegistries: Array.isArray(rawValue?.customRegistries) ? rawValue.customRegistries.filter((c) => c && typeof c.url === "string") : DEFAULT_SETTINGS.customRegistries,
    fallbackToOfficial: typeof rawValue?.fallbackToOfficial === "boolean" ? rawValue.fallbackToOfficial : DEFAULT_SETTINGS.fallbackToOfficial
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
var RegistrySettingsCard = ({ form, onClose }) => {
  const { settings, writable, updateField } = useConfigFormState(form);
  const [isAddingCustom, setIsAddingCustom] = (0, import_react.useState)(false);
  const [newCustomName, setNewCustomName] = (0, import_react.useState)("");
  const [newCustomUrl, setNewCustomUrl] = (0, import_react.useState)("");
  const [customError, setCustomError] = (0, import_react.useState)("");
  const [savingNotice, setSavingNotice] = (0, import_react.useState)("");
  const showNotice = (msg) => {
    setSavingNotice(msg);
    setTimeout(() => setSavingNotice(""), 2500);
  };
  const handleSelectRegistry = async (val) => {
    const ok = await updateField("registry", val);
    if (ok) showNotice("\u5DF2\u66F4\u65B0\u9ED8\u8BA4\u66F4\u65B0\u6E90");
  };
  const handleToggleFallback = async () => {
    const next = !settings.fallbackToOfficial;
    const ok = await updateField("fallbackToOfficial", next);
    if (ok) showNotice(next ? "\u5DF2\u5F00\u542F\u81EA\u52A8\u56DE\u9000" : "\u5DF2\u5173\u95ED\u81EA\u52A8\u56DE\u9000");
  };
  const handleAddCustom = async () => {
    setCustomError("");
    const name2 = newCustomName.trim() || "\u81EA\u5B9A\u4E49\u6E90";
    const normalized = normalizeRegistryUrl(newCustomUrl);
    if (!normalized) {
      setCustomError("\u8BF7\u8F93\u5165\u5408\u6CD5\u7684 HTTP/HTTPS \u6E90\u5730\u5740 (\u4F8B\u5982 https://mirrors.cloud.tencent.com/npm/)");
      return;
    }
    if (normalized === OFFICIAL_REGISTRY || normalized === DOMESTIC_REGISTRY || settings.customRegistries.some((c) => normalizeRegistryUrl(c.url) === normalized)) {
      setCustomError("\u8BE5\u6E90\u5730\u5740\u5DF2\u5B58\u5728\u4E8E\u5217\u8868\u4E2D\uFF0C\u65E0\u9700\u91CD\u590D\u6DFB\u52A0");
      return;
    }
    const nextList = [...settings.customRegistries, { name: name2, url: normalized }];
    const ok = await updateField("customRegistries", nextList);
    if (ok) {
      await updateField("registry", normalized);
      setNewCustomName("");
      setNewCustomUrl("");
      setIsAddingCustom(false);
      showNotice(`\u5DF2\u6DFB\u52A0\u5E76\u5207\u6362\u4E3A\u300C${name2}\u300D`);
    } else {
      setCustomError("\u4FDD\u5B58\u81EA\u5B9A\u4E49\u6E90\u5931\u8D25");
    }
  };
  const handleDeleteCustom = async (urlToDelete) => {
    const norm = normalizeRegistryUrl(urlToDelete);
    const nextList = settings.customRegistries.filter((c) => normalizeRegistryUrl(c.url) !== norm);
    await updateField("customRegistries", nextList);
    if (normalizeRegistryUrl(settings.registry) === norm) {
      await updateField("registry", "auto");
    }
    showNotice("\u5DF2\u79FB\u9664\u81EA\u5B9A\u4E49\u6E90");
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
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "15px", fontWeight: 600 }, children: "\u2699\uFE0F \u63D2\u4EF6\u9ED8\u8BA4\u66F4\u65B0\u6E90\u914D\u7F6E" }),
        savingNotice && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { fontSize: "11px", color: "#16a34a", background: "#dcfce7", padding: "1px 6px", borderRadius: "4px" }, children: savingNotice })
      ] }),
      onClose && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "button",
        {
          type: "button",
          onClick: onClose,
          style: { ...btnStyle, padding: "2px 8px", fontSize: "12px" },
          title: "\u5173\u95ED\u8BBE\u7F6E",
          children: "\u2715 \u5173\u95ED"
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { marginBottom: "14px" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { ...hintStyle, marginBottom: "10px" }, children: "\u5728\u6B64\u8BBE\u7F6E\u8FDB\u884C\u7B2C\u4E09\u65B9\u63D2\u4EF6\u66F4\u65B0\u65F6\u9ED8\u8BA4\u4F7F\u7528\u7684 npm \u4ED3\u5E93\u6E90\u3002" }),
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
            "\u81EA\u52A8\u6A21\u5F0F\uFF08\u667A\u80FD\u63A2\u6D4B\u4E0E\u5305\u5B8C\u6574\u5EA6\u68C0\u67E5\uFF09",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { marginLeft: 6, fontSize: "11px", color: "#2563eb", background: "#eff6ff", padding: "1px 5px", borderRadius: "3px" }, children: "\u63A8\u8350" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: "\u4F18\u5148\u5E76\u53D1 ping \u6D4B\u901F\u3002\u82E5\u56FD\u5185\u6E90\u8F83\u5FEB\uFF0C\u4F1A\u81EA\u52A8\u9884\u68C0\u56FD\u5185\u6E90\u662F\u5426\u5305\u542B\u672C\u6B21\u66F4\u65B0\u53CA\u73B0\u6709\u5168\u90E8\u76F4\u63A5\u4F9D\u8D56\u7684\u5BF9\u5E94\u7248\u672C\uFF1B\u82E5\u65E0\u7F3A\u5931\u5219\u91C7\u7528\u56FD\u5185\u9AD8\u901F\u6E90\uFF0C\u82E5\u53D1\u73B0\u7248\u672C\u843D\u540E/\u7F3A\u5931\u5219\u65E0\u7F1D\u5207\u6362\u5B98\u65B9\u6E90\uFF0C\u5F7B\u5E95\u907F\u514D\u7248\u672C\u4E0D\u5339\u914D\u62A5\u9519\u3002" })
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
            "npm \u5B98\u65B9\u6E90",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { marginLeft: 6, fontSize: "11px", color: "#475569", fontFamily: "monospace" }, children: "https://registry.npmjs.org/" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: "\u7248\u672C\u53D1\u5E03\u7B2C\u4E00\u65F6\u95F4\u5373\u65F6\u53EF\u7528\uFF0C\u7EDD\u5BF9\u6743\u5A01\u4E14\u65E0\u955C\u50CF\u540C\u6B65\u5EF6\u8FDF\uFF1B\u56FD\u5185\u7F51\u7EDC\u8BF7\u6C42\u53EF\u80FD\u5076\u6709\u8F7B\u5FAE\u6CE2\u52A8\u3002" })
        ] })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: optionItemStyle(isCurrent("npmmirror")), onClick: () => writable && handleSelectRegistry("npmmirror"), children: [
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
            "\u56FD\u5185\u6E90 npmmirror\uFF08\u4E0E DSH \u5BA2\u6237\u7AEF\u81EA\u5E26\u6E90\u4E00\u81F4\uFF09",
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { marginLeft: 6, fontSize: "11px", color: "#475569", fontFamily: "monospace" }, children: "https://registry.npmmirror.com/" })
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: "\u4E2D\u56FD\u5927\u9646\u5730\u533A\u4E0B\u8F7D\u4E0E\u89E3\u6790\u6781\u901F\u3002\u6CE8\u610F\uFF1A\u955C\u50CF\u8282\u70B9\u4E3A\u5468\u671F\u540C\u6B65\uFF0C\u5C0F\u4F17\u63D2\u4EF6\u65B0\u7248\u672C\u53EF\u80FD\u5B58\u5728\u6570\u5C0F\u65F6\u6216\u6570\u5929\u7684\u540C\u6B65\u5EF6\u8FDF\u3002\u672C\u63D2\u4EF6\u4E0D\u4F1A\u4E3B\u52A8\u5411\u955C\u50CF\u53D1\u8D77\u540C\u6B65\u8BF7\u6C42\u3002" })
        ] })
      ] }),
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
              cust.name || "\u81EA\u5B9A\u4E49\u6E90",
              /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { marginLeft: 6, fontSize: "11px", color: "#475569", fontFamily: "monospace" }, children: cust.url })
            ] }),
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: hintStyle, children: "\u81EA\u5B9A\u4E49\u6E90\u5730\u5740" })
          ] }),
          writable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
            "button",
            {
              type: "button",
              style: { ...btnStyle, color: "#dc2626", borderColor: "#fca5a5", padding: "2px 6px", fontSize: "11px" },
              onClick: (e) => {
                e.stopPropagation();
                handleDeleteCustom(cust.url);
              },
              title: "\u5220\u9664\u6B64\u81EA\u5B9A\u4E49\u6E90",
              children: "\u5220\u9664"
            }
          )
        ] }, norm);
      })
    ] }),
    writable && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { marginBottom: "14px", padding: "10px 12px", background: "var(--dsw-alias-bg-subtle, #f8fafc)", borderRadius: "8px" }, children: !isAddingCustom ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        type: "button",
        style: { ...btnStyle, display: "inline-flex", alignItems: "center", gap: "4px" },
        onClick: () => setIsAddingCustom(true),
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { children: "+" }),
          " \u6DFB\u52A0\u81EA\u5B9A\u4E49\u66F4\u65B0\u6E90"
        ]
      }
    ) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { fontWeight: 600, fontSize: "12px", marginBottom: "8px" }, children: "\u6DFB\u52A0\u81EA\u5B9A\u4E49\u6E90" }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "input",
          {
            type: "text",
            placeholder: "\u6E90\u5907\u6CE8\u540D\u79F0 (\u5982: \u817E\u8BAF\u4E91\u955C\u50CF)",
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
            placeholder: "\u6E90 URL \u5730\u5740 (\u5982: https://mirrors.cloud.tencent.com/npm/)",
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
      customError && /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { style: { color: "#dc2626", fontSize: "11px", marginBottom: "6px" }, children: customError }),
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", gap: "6px" }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            style: { ...btnStyle, background: "var(--dsw-alias-primary, #2563eb)", color: "#ffffff", borderColor: "#2563eb" },
            onClick: handleAddCustom,
            children: "\u4FDD\u5B58\u5E76\u4F7F\u7528"
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
          "button",
          {
            type: "button",
            style: btnStyle,
            onClick: () => {
              setIsAddingCustom(false);
              setCustomError("");
            },
            children: "\u53D6\u6D88"
          }
        )
      ] })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", alignItems: "center", gap: "8px", paddingTop: "8px", borderTop: "1px solid var(--dsw-alias-border-l2, #f1f5f9)" }, children: [
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
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { htmlFor: "fallbackToOfficialCheckbox", style: { fontSize: "12px", cursor: writable ? "pointer" : "default", color: "var(--dsw-alias-label-primary, #1e293b)" }, children: "\u5F53\u56FD\u5185\u6E90\u6216\u81EA\u5B9A\u4E49\u6E90\u5B89\u88C5\u5931\u8D25\uFF08\u5982\u9047\u5230\u7248\u672C\u672A\u540C\u6B65\u6216 404\uFF09\u65F6\uFF0C\u81EA\u52A8\u6539\u7528 npm \u5B98\u65B9\u6E90\u91CD\u8BD5\u4E00\u6B21\uFF08\u63A8\u8350\u5F00\u542F\uFF09" })
    ] })
  ] });
};
var UpdaterActionButton = ({ subject, form }) => {
  const pkg = subject?.pkg;
  const packageName = pkg?.name;
  const currentVersion = pkg?.version || "0.0.0";
  const source = pkg?.source;
  const [status, setStatus] = (0, import_react.useState)("idle");
  const [latestVersion, setLatestVersion] = (0, import_react.useState)("");
  const [errorMsg, setErrorMsg] = (0, import_react.useState)("");
  const [showSettingsModal, setShowSettingsModal] = (0, import_react.useState)(false);
  const checkingRef = (0, import_react.useRef)(false);
  if (subject?.kind !== "bundle" || !packageName) {
    return null;
  }
  const doCheck = (0, import_react.useCallback)(async (force = false) => {
    if (checkingRef.current) return;
    if (!force) {
      const cached = checkCache.get(packageName);
      if (cached && Date.now() - cached.time < CACHE_TTL_MS) {
        if (cached.result.hasUpdate) {
          setStatus("has_update");
          setLatestVersion(cached.result.latestVersion || "");
        } else {
          setStatus("up_to_date");
        }
        return;
      }
    }
    checkingRef.current = true;
    setStatus("checking");
    setErrorMsg("");
    try {
      const res = await fetch("/api/dsh-plugins-update/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageName, currentVersion, source })
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = await res.json();
      checkCache.set(packageName, { time: Date.now(), result: data });
      if (data.ok) {
        if (data.hasUpdate) {
          setStatus("has_update");
          setLatestVersion(data.latestVersion || "");
        } else {
          setStatus("up_to_date");
          setLatestVersion(data.latestVersion || currentVersion);
        }
      } else {
        setStatus("error");
        setErrorMsg(data.error || "\u68C0\u67E5\u5931\u8D25");
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg(e?.message || "\u7F51\u7EDC\u5F02\u5E38");
    } finally {
      checkingRef.current = false;
    }
  }, [packageName, currentVersion, source]);
  (0, import_react.useEffect)(() => {
    doCheck();
  }, [packageName, currentVersion, doCheck]);
  const handleUpdate = async () => {
    if (status === "updating") return;
    const confirmed = window.confirm(`\u786E\u8BA4\u8981\u5C06\u63D2\u4EF6\u300C${packageName}\u300D\u66F4\u65B0\u81F3\u6700\u65B0\u7248\u672C ${latestVersion || ""} \u5417\uFF1F`);
    if (!confirmed) return;
    setStatus("updating");
    setErrorMsg("");
    try {
      const res = await fetch("/api/dsh-plugins-update/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packageName, targetVersion: latestVersion, source })
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("success");
        checkCache.delete(packageName);
        const usedMsg = data.registryLabel || data.registryUsed ? `
\uFF08\u672C\u6B21\u66F4\u65B0\u4F7F\u7528\u6E90\uFF1A${data.registryLabel || data.registryUsed}${data.fellBack ? "\uFF0C\u89E6\u53D1\u6545\u969C\u81EA\u52A8\u56DE\u9000" : ""}\uFF09` : "";
        alert(`\u{1F389} \u63D2\u4EF6\u300C${packageName}\u300D\u66F4\u65B0\u6210\u529F\uFF01${usedMsg}

\u8BF7\u5237\u65B0\u5F53\u524D\u7A97\u53E3\u6216\u91CD\u542F DSH \u4EE5\u52A0\u8F7D\u65B0\u7248\u672C\u3002`);
      } else {
        setStatus("error");
        setErrorMsg(data.error || "\u66F4\u65B0\u5931\u8D25");
        const usedMsg = data.registryLabel || data.registryUsed ? `\u4F7F\u7528\u6E90\uFF1A${data.registryLabel || data.registryUsed}
` : "";
        alert(`\u274C \u63D2\u4EF6\u66F4\u65B0\u5931\u8D25\uFF1A
${data.error || "\u672A\u77E5\u9519\u8BEF"}
${usedMsg}
\u8BE6\u7EC6\u8F93\u51FA\uFF1A
${data.output || ""}`);
      }
    } catch (e) {
      setStatus("error");
      setErrorMsg(e?.message || "\u8BF7\u6C42\u5931\u8D25");
      alert(`\u274C \u66F4\u65B0\u8BF7\u6C42\u51FA\u9519\uFF1A${e?.message || "\u7F51\u7EDC\u8FDE\u63A5\u5F02\u5E38"}`);
    }
  };
  const RefreshIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.2", strokeLinecap: "round", strokeLinejoin: "round", style: { marginRight: 5 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 3v5h5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M16 16h5v5" })
  ] });
  const ArrowUpIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", style: { marginRight: 5 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M12 19V5" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "m5 12 7-7 7 7" })
  ] });
  const CheckIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2.5", strokeLinecap: "round", strokeLinejoin: "round", style: { marginRight: 5 }, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("polyline", { points: "20 6 9 17 4 12" }) });
  const GearIcon = () => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("svg", { width: "13", height: "13", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("circle", { cx: "12", cy: "12", r: "3" }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("path", { d: "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" })
  ] });
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
          title: `\u70B9\u51FB\u66F4\u65B0\u6B64\u63D2\u4EF6\u81F3\u6700\u65B0\u7248\u672C v${latestVersion}`,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ArrowUpIcon, {}),
            "\u66F4\u65B0\u81F3 v",
            latestVersion
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
            "\u6B63\u5728\u66F4\u65B0..."
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
            "\u68C0\u67E5\u4E2D..."
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
          title: "\u66F4\u65B0\u6210\u529F\uFF01\u70B9\u51FB\u91CD\u65B0\u68C0\u6D4B",
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckIcon, {}),
            "\u5DF2\u66F4\u65B0 (\u5F85\u91CD\u8F7D)"
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
          title: `\u5F53\u524D\u5DF2\u662F\u6700\u65B0\u7248\u672C (${currentVersion})\u3002\u70B9\u51FB\u53EF\u91CD\u65B0\u68C0\u67E5`,
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime.jsx)(CheckIcon, {}),
            "\u5DF2\u662F\u6700\u65B0"
          ]
        }
      );
    }
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(
      "button",
      {
        type: "button",
        style: {
          ...baseButtonStyle,
          ...status === "error" ? { borderColor: "#fca5a5", color: "#b91c1c" } : {}
        },
        onClick: () => doCheck(true),
        title: errorMsg ? `\u68C0\u67E5\u66F4\u65B0\u5931\u8D25: ${errorMsg}\uFF0C\u70B9\u51FB\u91CD\u8BD5` : "\u68C0\u67E5\u8BE5\u63D2\u4EF6\u662F\u5426\u6709\u65B0\u7248\u672C",
        children: [
          /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RefreshIcon, {}),
          status === "error" ? "\u68C0\u67E5\u5931\u8D25(\u91CD\u8BD5)" : "\u68C0\u67E5\u66F4\u65B0"
        ]
      }
    );
  };
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "inline-flex", alignItems: "center" }, children: [
    renderMainButton(),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
      "button",
      {
        type: "button",
        style: gearButtonStyle,
        onClick: () => setShowSettingsModal(true),
        title: "\u8BBE\u7F6E\u63D2\u4EF6\u9ED8\u8BA4\u66F4\u65B0\u6E90 / \u81EA\u5B9A\u4E49\u6E90",
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
            children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(RegistrySettingsCard, { form, onClose: () => setShowSettingsModal(false) })
          }
        )
      }
    )
  ] });
};
function apply(ctx) {
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
        (props) => import_react.default.createElement(UpdaterActionButton, { ...props, form: getForm() })
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
          () => import_react.default.createElement(RegistrySettingsCard, { form: f || getForm() })
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
