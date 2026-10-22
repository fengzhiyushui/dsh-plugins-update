/**
 * dsh-plugins-update v0.1.0
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
  UpdaterActionButton: () => UpdaterActionButton,
  apply: () => apply,
  inject: () => inject,
  name: () => name
});
module.exports = __toCommonJS(client_exports);
var import_react = __toESM(require("react"), 1);
var import_jsx_runtime = require("react/jsx-runtime");
var checkCache = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 60 * 1e3;
var UpdaterActionButton = ({ subject }) => {
  const pkg = subject?.pkg;
  const packageName = pkg?.name;
  const currentVersion = pkg?.version || "0.0.0";
  const [status, setStatus] = (0, import_react.useState)("idle");
  const [latestVersion, setLatestVersion] = (0, import_react.useState)("");
  const [errorMsg, setErrorMsg] = (0, import_react.useState)("");
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
        body: JSON.stringify({ packageName, currentVersion })
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
  }, [packageName, currentVersion]);
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
        body: JSON.stringify({ packageName, targetVersion: latestVersion })
      });
      const data = await res.json();
      if (data.ok) {
        setStatus("success");
        checkCache.delete(packageName);
        alert(`\u{1F389} \u63D2\u4EF6\u300C${packageName}\u300D\u66F4\u65B0\u6210\u529F\uFF01
\u8BF7\u5237\u65B0\u5F53\u524D\u7A97\u53E3\u6216\u91CD\u542F DSH \u4EE5\u52A0\u8F7D\u65B0\u7248\u672C\u3002`);
      } else {
        setStatus("error");
        setErrorMsg(data.error || "\u66F4\u65B0\u5931\u8D25");
        alert(`\u274C \u63D2\u4EF6\u66F4\u65B0\u5931\u8D25\uFF1A
${data.error || "\u672A\u77E5\u9519\u8BEF"}

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
    userSelect: "none",
    marginRight: "6px"
  };
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
function apply(ctx) {
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
        (props) => import_react.default.createElement(UpdaterActionButton, props)
      )
    );
  }
}
var name = "dsh-plugins-update";
var inject = ["slots"];

    return module.exports;
  }
});
