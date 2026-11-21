// src/index.ts
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import Schema from "@deepseek-ai/schemastery";

// src/types.ts
var OFFICIAL_REGISTRY = "https://registry.npmjs.org/";
var DOMESTIC_REGISTRY = "https://registry.npmmirror.com/";
var PLUGIN_NAME = "dsh-plugins-update";
var OFFICIAL_PACKAGE_PREFIX = "@deepseek-ai/";
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

// src/index.ts
var name = PLUGIN_NAME;
var inject = ["connection"];
var PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;
var INSTALL_TIMEOUT_MS = 18e4;
var ROLLBACK_TIMEOUT_MS = 6e4;
var CHECK_TIMEOUT_MS = 12e3;
var OUTPUT_LIMIT = 8e3;
function live(schema) {
  const s = schema;
  return typeof s?.volatile === "function" ? s.volatile() : schema;
}
var Config = Schema.object({
  registry: live(
    Schema.string().default("npmjs").description("\u7B2C\u4E09\u65B9\u63D2\u4EF6\u66F4\u65B0\u6E90\uFF1Anpmjs\uFF08npm \u5B98\u65B9\uFF09/ npmmirror\uFF08\u56FD\u5185\u955C\u50CF\uFF09/ \u81EA\u5B9A\u4E49\u6E90 URL\uFF1BUpdate registry: npmjs | npmmirror | custom URL")
  ),
  customRegistries: live(
    Schema.array(
      Schema.object({
        name: Schema.string().default(""),
        url: Schema.string().default("")
      })
    ).default([]).description("\u81EA\u5B9A\u4E49\u66F4\u65B0\u6E90\u5217\u8868 / Custom update registries")
  ),
  fallbackToOfficial: live(
    Schema.boolean().default(true).description("\u975E\u5B98\u65B9\u6E90\u5B89\u88C5\u5931\u8D25\u65F6\uFF0C\u81EA\u52A8\u6539\u7528 npm \u5B98\u65B9\u6E90\u91CD\u8BD5\u4E00\u6B21 / Retry once on npm official after a non-official registry fails")
  ),
  alwaysShowDetailButton: live(
    Schema.boolean().default(false).description("\u59CB\u7EC8\u5728\u63D2\u4EF6\u8BE6\u60C5\u9875\u663E\u793A\u300C\u6781\u901F\u66F4\u65B0\u300D\u6309\u94AE / Always show the Fast Update button on plugin detail pages")
  )
});
function readField(field, fallback) {
  let raw = field;
  if (field && typeof field === "object" && typeof field.get === "function") {
    try {
      raw = field.get();
    } catch {
      raw = void 0;
    }
  }
  return raw === void 0 || raw === null ? fallback : raw;
}
function readSettings(config) {
  const registryRaw = readField(config?.registry, "npmjs");
  const customRaw = readField(config?.customRegistries, []);
  const customRegistries = Array.isArray(customRaw) ? customRaw.map((item) => ({
    name: typeof item?.name === "string" ? item.name.trim() : "",
    url: normalizeRegistryUrl(typeof item?.url === "string" ? item.url : "") ?? ""
  })).filter((item) => !!item.url) : [];
  return {
    registry: typeof registryRaw === "string" && registryRaw.trim() ? registryRaw.trim() : "npmjs",
    customRegistries,
    fallbackToOfficial: readField(config?.fallbackToOfficial, true),
    alwaysShowDetailButton: readField(config?.alwaysShowDetailButton, false)
  };
}
function readPackageName(value) {
  if (typeof value !== "string") return void 0;
  const packageName = value.trim();
  if (!packageName || packageName.length > 214 || !PACKAGE_NAME_PATTERN.test(packageName)) return void 0;
  return packageName;
}
function readTargetVersion(value) {
  if (value === void 0 || value === null || value === "") return void 0;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return void 0;
  const version = trimmed.replace(/^[v^~]/, "");
  if (!version || /^[v^~]/.test(version)) return null;
  return parseSemver(version) ? version : null;
}
function detectHostVersion(ctx) {
  const envVersion = process.env.DSH_VERSION?.trim();
  if (envVersion) return envVersion;
  const ctxVersion = ctx?.host?.version || ctx?.app?.version;
  if (typeof ctxVersion === "string" && ctxVersion.trim()) return ctxVersion.trim();
  const execDir = process.execPath ? dirname(process.execPath) : "";
  const dshHome = process.env.DSH_HOME?.trim() || join(homedir(), ".dsh");
  const candidates = [];
  if (execDir) {
    candidates.push(
      join(execDir, "resources", "app.asar", "package.json"),
      join(execDir, "..", "Resources", "app.asar", "package.json"),
      join(execDir, "resources", "app.asar", "dsh", "node_modules", "@deepseek-ai", "dsh-desktop-host", "package.json"),
      join(execDir, "..", "Resources", "app.asar", "dsh", "node_modules", "@deepseek-ai", "dsh-desktop-host", "package.json")
    );
  }
  candidates.push(join(dshHome, "dsh-runtimes", "dsh-primary-runtime", "package.json"));
  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) continue;
      const pkg = JSON.parse(readFileSync(candidate, "utf8"));
      if (typeof pkg?.version === "string" && pkg.version.trim()) {
        return pkg.version.trim();
      }
    } catch {
    }
  }
  return void 0;
}
function profileCandidates() {
  const dshHome = process.env.DSH_HOME || join(homedir(), ".dsh");
  const profilesDir = join(dshHome, "profiles");
  const preferred = (process.env.DSH_PROFILE || "").trim();
  const names = [...new Set([preferred, "desktop", "default", "web"].filter(Boolean))];
  const candidates = names.map((profileName) => ({ dir: join(profilesDir, profileName), profileName })).filter((candidate) => existsSync(join(candidate.dir, "package.json")));
  if (candidates.length === 0) candidates.push({ dir: join(profilesDir, "desktop"), profileName: "desktop" });
  return candidates;
}
function readProfileDependencies(profileDir) {
  const manifestPath = join(profileDir, "package.json");
  if (!existsSync(manifestPath)) return {};
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    return {
      ...manifest?.optionalDependencies || {},
      ...manifest?.devDependencies || {},
      ...manifest?.dependencies || {}
    };
  } catch {
    return {};
  }
}
function resolveProfileDir(packageName) {
  const candidates = profileCandidates();
  if (packageName) {
    const owner = candidates.find(
      (candidate) => Object.prototype.hasOwnProperty.call(readProfileDependencies(candidate.dir), packageName)
    );
    if (owner) return owner;
  }
  return candidates.find((candidate) => candidate.profileName === "desktop") ?? candidates[0];
}
async function readAllBundles(ctx) {
  for (const service of ["pluginManager", "plugin-manager"]) {
    try {
      const manager = ctx?.get?.(service);
      if (typeof manager?.listBundles !== "function") continue;
      const bundles = await manager.listBundles();
      if (Array.isArray(bundles)) return bundles;
    } catch {
    }
  }
  return [];
}
async function readBundleInfo(ctx, packageName) {
  const bundles = await readAllBundles(ctx);
  return bundles.find((item) => item && item.name === packageName);
}
function extractVersionFromSpec(spec) {
  if (typeof spec !== "string") return "0.0.0";
  const cleaned = spec.trim().replace(/^[v^~=]+/, "");
  return cleaned && parseSemver(cleaned) ? cleaned : "0.0.0";
}
function collectExportTargets(exp, out) {
  if (typeof exp === "string") {
    if (exp.trim() && !exp.includes("*")) out.push(exp.trim());
    return;
  }
  if (!exp || typeof exp !== "object") return;
  const obj = exp;
  for (const key of ["default", "import", "node", "browser", "require"]) {
    if (key in obj) collectExportTargets(obj[key], out);
  }
}
function inspectPackageDiskHealth(profileDir, packageName) {
  const pkgDir = join(profileDir, "node_modules", packageName);
  const manifestPath = join(pkgDir, "package.json");
  if (!existsSync(manifestPath)) {
    return { entryMissing: true, errorDetail: "node_modules \u4E2D\u7684 package.json \u7F3A\u5931" };
  }
  let pkg;
  try {
    pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return { entryMissing: true, errorDetail: "package.json \u89E3\u6790\u5931\u8D25\u6216\u6587\u4EF6\u635F\u574F" };
  }
  const currentVersion = typeof pkg?.version === "string" && pkg.version.trim() ? pkg.version.trim() : void 0;
  const entryPaths = [];
  if (typeof pkg?.main === "string" && pkg.main.trim()) {
    entryPaths.push(pkg.main.trim());
  }
  if (typeof pkg?.exports === "string") {
    collectExportTargets(pkg.exports, entryPaths);
  } else if (pkg?.exports && typeof pkg.exports === "object") {
    const exportsObj = pkg.exports;
    if ("." in exportsObj) collectExportTargets(exportsObj["."], entryPaths);
    if ("./client" in exportsObj) collectExportTargets(exportsObj["./client"], entryPaths);
  }
  for (const relPath of new Set(entryPaths)) {
    const cleanRel = relPath.replace(/^\.\//, "");
    if (!cleanRel) continue;
    if (!existsSync(join(pkgDir, cleanRel))) {
      return {
        entryMissing: true,
        currentVersion,
        errorDetail: `\u7F3A\u5C11\u5165\u53E3\u6587\u4EF6: ${relPath}`
      };
    }
  }
  return { entryMissing: false, currentVersion };
}
function extractBundleErrorDetail(bundle) {
  if (!bundle) return void 0;
  const raw = bundle.error ?? bundle.loadError ?? bundle.reason ?? bundle.message;
  if (!raw) return void 0;
  const text = typeof raw === "string" ? raw.trim() : typeof raw?.message === "string" ? raw.message.trim() : String(raw).trim();
  if (!text) return void 0;
  const redacted = redactSecrets(text);
  return redacted.length > 400 ? `${redacted.slice(0, 400)}...` : redacted;
}
async function inspectInstalledPluginsHealth(ctx) {
  const bundles = await readAllBundles(ctx);
  const bundleMap = /* @__PURE__ */ new Map();
  for (const b of bundles) {
    if (b && typeof b.name === "string") bundleMap.set(b.name, b);
  }
  const profiles = profileCandidates().map((candidate) => ({
    ...candidate,
    deps: readProfileDependencies(candidate.dir)
  }));
  const primaryProfile = profiles.find((p) => p.profileName === "desktop") ?? profiles[0];
  const manifestDepsByPackage = /* @__PURE__ */ new Map();
  for (const candidate of profiles) {
    for (const [depName, spec] of Object.entries(candidate.deps)) {
      if (!manifestDepsByPackage.has(depName) && typeof spec === "string") {
        manifestDepsByPackage.set(depName, spec);
      }
    }
  }
  const candidateNames = /* @__PURE__ */ new Set([...manifestDepsByPackage.keys(), ...bundleMap.keys()]);
  const result = [];
  for (const rawName of candidateNames) {
    const packageName = readPackageName(rawName);
    if (!packageName || isOfficialPackageName(packageName)) continue;
    const bundle = bundleMap.get(packageName);
    if (bundle?.official === true) continue;
    const declaredSpec = manifestDepsByPackage.get(packageName);
    const inManifest = Boolean(declaredSpec);
    if (!inManifest && bundle?.installed === false) continue;
    const owner = profiles.find((p) => Object.prototype.hasOwnProperty.call(p.deps, packageName)) ?? primaryProfile;
    const { dir, profileName } = owner;
    const disk = inspectPackageDiskHealth(dir, packageName);
    if (!inManifest && !disk.currentVersion) continue;
    const issues = [];
    const details = [];
    if (disk.entryMissing || inManifest && bundle?.installed === false) {
      issues.push("entry-missing");
      if (disk.errorDetail) details.push(disk.errorDetail);
      else if (bundle?.installed === false) details.push("\u5DF2\u5728\u914D\u7F6E\u4E2D\u58F0\u660E\u4F46\u672A\u6B63\u786E\u5B89\u88C5\u5230\u5F53\u524D profile");
    }
    const bundleErrorDetail = extractBundleErrorDetail(bundle);
    const hasErrorState = Boolean(bundleErrorDetail) || bundle?.status === "error" || bundle?.state === "error" || bundle?.state === "failed";
    if (hasErrorState) {
      issues.push("bundle-error");
      details.push(bundleErrorDetail || `Bundle state: ${bundle?.status || bundle?.state || "error"}`);
    }
    if (typeof bundle?.availability === "string" && bundle.availability !== "available") {
      issues.push("bundle-unavailable");
      details.push(`\u53EF\u7528\u6027\u5F02\u5E38: ${bundle.availability}`);
    }
    if (bundles.length > 0 && inManifest && !bundle) {
      issues.push("unregistered-bundle");
      details.push("\u5DF2\u5728 profile package.json \u4E2D\u58F0\u660E\uFF0C\u4F46 DSH \u63D2\u4EF6\u7BA1\u7406\u5668\u672A\u80FD\u52A0\u8F7D/\u6CE8\u518C");
    }
    result.push({
      packageName,
      dir,
      profileName,
      currentVersion: disk.currentVersion || extractVersionFromSpec(declaredSpec),
      source: bundle?.source || declaredSpec,
      bundle,
      issues: Array.from(new Set(issues)),
      errorDetail: details.filter(Boolean).join("; ") || void 0
    });
  }
  return result;
}
function isDeclaredInProfile(packageName) {
  const { dir } = resolveProfileDir(packageName);
  return Object.prototype.hasOwnProperty.call(readProfileDependencies(dir), packageName);
}
function bundleGuardError(packageName, bundle) {
  if (bundle?.official === true || isOfficialPackageName(packageName)) {
    return {
      error: "\u5B98\u65B9\u63D2\u4EF6\u7531 DSH \u81EA\u5E26\u7684\u66F4\u65B0\u5165\u53E3\u7BA1\u7406\uFF0C\u8BF7\u4F7F\u7528\u63D2\u4EF6\u9875\u53F3\u4E0A\u89D2\u7684\u300C\u66F4\u65B0\u300D\u6309\u94AE",
      errorCode: ERROR_CODES.officialPlugin
    };
  }
  if (bundle?.installed === false && !isDeclaredInProfile(packageName)) {
    return { error: "\u8BE5\u63D2\u4EF6\u672A\u5B89\u88C5\u5230\u5F53\u524D profile\uFF0C\u65E0\u6CD5\u66F4\u65B0", errorCode: ERROR_CODES.notInstalled };
  }
  return void 0;
}
function readInstalledVersion(profileDir, packageName) {
  const path = join(profileDir, "node_modules", packageName, "package.json");
  try {
    const pkg = JSON.parse(readFileSync(path, "utf8"));
    return typeof pkg.version === "string" && pkg.version.trim() ? pkg.version.trim() : void 0;
  } catch {
    return void 0;
  }
}
function parseGithubSource(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const hashIndex = trimmed.indexOf("#");
  const rawBase = hashIndex >= 0 ? trimmed.slice(0, hashIndex) : trimmed;
  const rawFragment = hashIndex >= 0 ? trimmed.slice(hashIndex + 1).trim() : "";
  const cleaned = rawBase.trim().replace(/^git\+/, "").replace(/\.git$/i, "").replace(/\/+$/, "");
  if (!cleaned) return null;
  let owner = "";
  let repo = "";
  const match = cleaned.match(
    /(?:github:|^https?:\/\/github\.com\/|^git@github\.com:|^git:\/\/github\.com\/|^ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i
  );
  if (match) {
    owner = match[1];
    repo = match[2];
  } else if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleaned)) {
    [owner, repo] = cleaned.split("/");
  } else {
    return null;
  }
  let ref;
  let subpath;
  if (rawFragment) {
    const parts = rawFragment.split("&").map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.startsWith("path:")) {
        const normalizedPath = part.slice("path:".length).trim().replace(/\\/g, "/").split("/").filter((seg) => seg && seg !== "." && seg !== "..").join("/");
        if (normalizedPath) subpath = normalizedPath;
      } else if (/^[0-9a-f]{40}$/i.test(part)) {
      } else if (!part.includes(":") && !part.includes("..") && /^[A-Za-z0-9._/-]+$/.test(part)) {
        ref = part;
      }
    }
  }
  return {
    owner,
    repo,
    ...ref ? { ref } : {},
    ...subpath ? { subpath } : {}
  };
}
function resolvePackageOrigin(profileDir, packageName, explicitSource) {
  const explicit = parseGithubSource(explicitSource);
  if (explicit) return { isGithub: true, github: explicit, declaredSpec: explicitSource };
  const spec = readProfileDependencies(profileDir)[packageName];
  const github = parseGithubSource(spec);
  return github ? { isGithub: true, github, declaredSpec: spec } : { isGithub: false, declaredSpec: spec };
}
var RemoteError = class extends Error {
  errorCode;
  constructor(errorCode, message) {
    super(message);
    this.errorCode = errorCode;
  }
};
function redactSecrets(input) {
  return String(input || "").replace(/\/\/[^/@\s]+:[^/@\s]+@/g, "//***:***@").replace(/(token|password|secret)=([^&\s]+)/gi, "$1=***");
}
function safeRegistryUrl(url) {
  if (!url) return void 0;
  try {
    const parsed = new URL(url);
    parsed.username = "";
    parsed.password = "";
    return parsed.href;
  } catch {
    return url;
  }
}
function encodePackageName(packageName) {
  return encodeURIComponent(packageName).replace(/^%40/i, "@");
}
async function fetchJson(url, timeoutMs = CHECK_TIMEOUT_MS, externalSignal, accept = "application/json") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = externalSignal ? AbortSignal.any([controller.signal, externalSignal]) : controller.signal;
  try {
    const parsed = new URL(url);
    const headers = {
      accept,
      "user-agent": PLUGIN_NAME
    };
    if (parsed.username || parsed.password) {
      const credentials = `${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`;
      headers.authorization = `Basic ${Buffer.from(credentials).toString("base64")}`;
      parsed.username = "";
      parsed.password = "";
    }
    const response = await fetch(parsed.href, { headers, signal });
    if (!response.ok) throw new RemoteError(ERROR_CODES.offline, `HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error instanceof RemoteError) throw error;
    if (controller.signal.aborted) throw new RemoteError(ERROR_CODES.timeout, "\u68C0\u67E5\u66F4\u65B0\u8D85\u65F6");
    if (externalSignal?.aborted || error?.name === "AbortError") throw error;
    throw new RemoteError(ERROR_CODES.offline, redactSecrets(error?.message || "\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25"));
  } finally {
    clearTimeout(timer);
  }
}
async function fetchNpmLatest(packageName, registry) {
  const data = await fetchJson(
    `${registry}${encodePackageName(packageName)}`,
    CHECK_TIMEOUT_MS,
    void 0,
    "application/vnd.npm.install-v1+json, application/json;q=0.9"
  );
  const version = data?.["dist-tags"]?.latest;
  if (typeof version !== "string" || !version.trim()) {
    throw new RemoteError(ERROR_CODES.offline, "\u66F4\u65B0\u6E90\u672A\u8FD4\u56DE\u6700\u65B0\u7248\u672C\u53F7");
  }
  return {
    version: version.trim(),
    registry,
    isGithub: false
  };
}
function encodeRefSegments(value) {
  return value.split("/").map((seg) => encodeURIComponent(seg)).join("/");
}
async function fetchGithubPackageJson(github) {
  const { owner, repo, ref, subpath } = github;
  const targetRef = encodeRefSegments(ref || "HEAD");
  const pkgPath = subpath ? `${encodeRefSegments(subpath)}/package.json` : "package.json";
  const urls = [
    `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${targetRef}/${pkgPath}`,
    `https://raw.githubusercontent.com/${owner}/${repo}/${targetRef}/${pkgPath}`
  ];
  const controller = new AbortController();
  const attempts = urls.map(async (url) => {
    const data = await fetchJson(url, CHECK_TIMEOUT_MS, controller.signal);
    if (typeof data?.version !== "string" || !data.version.trim()) {
      throw new RemoteError(ERROR_CODES.offline, "GitHub \u4ED3\u5E93 package.json \u7F3A\u5C11\u7248\u672C\u53F7");
    }
    return {
      version: data.version.trim(),
      isGithub: true
    };
  });
  try {
    return await Promise.any(attempts);
  } catch (error) {
    const errors = Array.isArray(error?.errors) ? error.errors : [];
    const remote = errors.find((e) => e instanceof RemoteError && e.errorCode !== ERROR_CODES.timeout) ?? errors.find((e) => e instanceof RemoteError);
    throw remote ?? new RemoteError(ERROR_CODES.offline, "\u65E0\u6CD5\u8BFB\u53D6 GitHub \u4ED3\u5E93\u7248\u672C\u4FE1\u606F");
  } finally {
    controller.abort();
  }
}
async function resolveRemotePackage(packageName, profileDir, settings, source) {
  const origin = resolvePackageOrigin(profileDir, packageName, source);
  const registry = resolveRegistryUrl(settings.registry);
  if (origin.isGithub && origin.github) {
    const info2 = await fetchGithubPackageJson(origin.github);
    return { info: info2, origin, registry };
  }
  const info = await fetchNpmLatest(packageName, registry);
  return { info, origin, registry };
}
function desktopCliCandidates() {
  const candidates = [];
  const override = process.env.DSH_CLI_JS?.trim();
  if (override) candidates.push(override);
  const appRel = join("app.asar", "dsh", "node_modules", "@deepseek-ai", "dsh-desktop-host", "lib", "cli.js");
  const cliRel = join("resources", appRel);
  const execDir = process.execPath ? dirname(process.execPath) : "";
  if (execDir) {
    candidates.push(join(execDir, cliRel));
    candidates.push(join(execDir, "..", "Resources", appRel));
  }
  if (process.env.LOCALAPPDATA) candidates.push(join(process.env.LOCALAPPDATA, "Programs", "DeepSeek Harness", cliRel));
  return candidates;
}
function pnpmCandidates() {
  const candidates = [];
  const override = process.env.DSH_PNPM_JS?.trim();
  if (override) candidates.push(override);
  const runtimeRel = join("runtime", "primary-runtime", "dependencies", "pnpm", "bin", "pnpm.mjs");
  const rel = join("resources", runtimeRel);
  const execDir = process.execPath ? dirname(process.execPath) : "";
  if (execDir) {
    candidates.push(join(execDir, rel));
    candidates.push(join(execDir, "..", "Resources", runtimeRel));
    candidates.push(join(execDir, "..", rel));
  }
  const dshHome = process.env.DSH_HOME?.trim() || join(homedir(), ".dsh");
  candidates.push(join(dshHome, "dsh-runtimes", "dsh-primary-runtime", "dependencies", "pnpm", "bin", "pnpm.mjs"));
  if (process.env.LOCALAPPDATA) candidates.push(join(process.env.LOCALAPPDATA, "Programs", "DeepSeek Harness", rel));
  return candidates;
}
function createChildEnv(registry) {
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    npm_config_update_notifier: "false",
    pnpm_config_update_notifier: "false",
    npm_config_fund: "false",
    npm_config_audit: "false"
  };
  if (registry) env.npm_config_registry = registry;
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  return env;
}
function buildInstallCommand(profileName, spec, registry, policyBypass) {
  const env = createChildEnv(registry);
  const extraArgs = [
    "--config.update-notifier=false",
    ...policyBypass ? ["--config.minimum-release-age=0"] : []
  ];
  const cliJs = desktopCliCandidates().find((candidate) => existsSync(candidate));
  if (cliJs) {
    return {
      command: process.execPath,
      args: ["--expose-internals", cliJs, "plugin", "--profile", profileName, "add", spec, `--registry=${registry}`, ...extraArgs],
      env
    };
  }
  const pnpmJs = pnpmCandidates().find((candidate) => existsSync(candidate));
  if (pnpmJs) {
    return {
      command: process.execPath,
      args: ["--expose-internals", pnpmJs, "add", spec, `--registry=${registry}`, ...extraArgs],
      env
    };
  }
  return { error: "\u627E\u4E0D\u5230 DSH CLI \u6216 pnpm\uFF0C\u65E0\u6CD5\u6267\u884C\u5B89\u88C5" };
}
function buildRemoveCommand(profileName, packageName) {
  const env = createChildEnv();
  const extraArgs = ["--config.update-notifier=false"];
  const cliJs = desktopCliCandidates().find((candidate) => existsSync(candidate));
  if (cliJs) {
    return {
      command: process.execPath,
      args: ["--expose-internals", cliJs, "plugin", "--profile", profileName, "remove", packageName, ...extraArgs],
      env
    };
  }
  const pnpmJs = pnpmCandidates().find((candidate) => existsSync(candidate));
  if (pnpmJs) {
    return {
      command: process.execPath,
      args: ["--expose-internals", pnpmJs, "remove", packageName, ...extraArgs],
      env
    };
  }
  return { error: "\u627E\u4E0D\u5230 DSH CLI \u6216 pnpm\uFF0C\u65E0\u6CD5\u6267\u884C\u5378\u8F7D" };
}
function killChildTree(child) {
  if (!child || child.exitCode !== null) return;
  if (process.platform === "win32" && child.pid) {
    try {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        shell: false,
        windowsHide: true,
        stdio: "ignore"
      });
      killer.on("error", () => {
      });
      killer.unref?.();
    } catch {
    }
  }
  try {
    child.kill();
  } catch {
  }
  try {
    child.kill("SIGKILL");
  } catch {
  }
}
function spawnCommand(command, args, cwd, env, timeoutMs) {
  return new Promise((resolve) => {
    let output = "";
    let settled = false;
    let timedOut = false;
    let timer;
    let forceTimer;
    const append = (chunk) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString();
      output = output.length + text.length > OUTPUT_LIMIT ? (output + text).slice(-OUTPUT_LIMIT) : output + text;
    };
    const finish = (ok, error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (forceTimer) clearTimeout(forceTimer);
      resolve({ ok, output, error, timedOut });
    };
    let child;
    try {
      child = spawn(command, args, {
        cwd,
        shell: false,
        windowsHide: true,
        env
      });
    } catch (error) {
      finish(false, redactSecrets(error?.message || "\u65E0\u6CD5\u542F\u52A8\u8FDB\u7A0B"));
      return;
    }
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    child.on("error", (error) => finish(false, redactSecrets(error?.message || "\u8FDB\u7A0B\u6267\u884C\u9519\u8BEF")));
    child.on("close", (code) => {
      if (timedOut) return finish(false, `\u547D\u4EE4\u8D85\u65F6\uFF08${Math.round(timeoutMs / 1e3)} \u79D2\uFF09`);
      if (code === 0) return finish(true);
      finish(false, redactSecrets(`\u8FDB\u7A0B\u9000\u51FA\u7801 ${code ?? "unknown"}`));
    });
    timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      killChildTree(child);
      forceTimer = setTimeout(() => finish(false, `\u547D\u4EE4\u8D85\u65F6\uFF08${Math.round(timeoutMs / 1e3)} \u79D2\uFF09`), 1e4);
      forceTimer.unref?.();
    }, timeoutMs);
    timer.unref?.();
  });
}
function spawnInstall(profileDir, profileName, spec, registry, policyBypass = false) {
  const plan = buildInstallCommand(profileName, spec, registry, policyBypass);
  if ("error" in plan) return Promise.resolve({ ok: false, output: "", error: plan.error, timedOut: false });
  return spawnCommand(plan.command, plan.args, profileDir, plan.env, INSTALL_TIMEOUT_MS);
}
function spawnRemove(profileDir, profileName, packageName) {
  const plan = buildRemoveCommand(profileName, packageName);
  if ("error" in plan) return Promise.resolve({ ok: false, output: "", error: plan.error, timedOut: false });
  return spawnCommand(plan.command, plan.args, profileDir, plan.env, INSTALL_TIMEOUT_MS);
}
function isSupplyChainPolicyFailure(output) {
  return /ERR_PNPM_NO_MATURE_MATCHING_VERSION|ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION|minimumReleaseAge/i.test(
    output || ""
  );
}
async function installWithPolicyFallback(profileDir, profileName, spec, registry, initialPolicyBypass = false) {
  const attempt = await spawnInstall(profileDir, profileName, spec, registry, initialPolicyBypass);
  if (!attempt.ok && !attempt.timedOut && !initialPolicyBypass && isSupplyChainPolicyFailure(attempt.output)) {
    return spawnInstall(profileDir, profileName, spec, registry, true);
  }
  return attempt;
}
function captureSnapshot(profileDir) {
  const manifestPath = join(profileDir, "package.json");
  const lockfilePath = join(profileDir, "pnpm-lock.yaml");
  return {
    manifest: existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : null,
    lockfile: existsSync(lockfilePath) ? readFileSync(lockfilePath, "utf8") : null
  };
}
function restoreSnapshot(profileDir, snapshot) {
  try {
    if (snapshot.manifest !== null) writeFileSync(join(profileDir, "package.json"), snapshot.manifest, "utf8");
    if (snapshot.lockfile !== null) writeFileSync(join(profileDir, "pnpm-lock.yaml"), snapshot.lockfile, "utf8");
    return true;
  } catch {
    return false;
  }
}
async function alignNodeModulesAfterRollback(profileDir) {
  const pnpmJs = pnpmCandidates().find((candidate) => existsSync(candidate));
  if (!pnpmJs) return "skipped";
  const result = await spawnCommand(
    process.execPath,
    [
      "--expose-internals",
      pnpmJs,
      "install",
      "--frozen-lockfile",
      "--prefer-offline",
      "--ignore-scripts",
      "--config.update-notifier=false",
      "--config.minimum-release-age=0"
    ],
    profileDir,
    createChildEnv(),
    ROLLBACK_TIMEOUT_MS
  );
  return result.ok ? "aligned" : "failed";
}
async function rollbackAfterFailure(profileDir, packageName, previousVersion, snapshot, forceAlign) {
  const restored = restoreSnapshot(profileDir, snapshot);
  if (!restored) return "failed";
  if (snapshot.lockfile === null) return "restored";
  const versionAfterRestore = readInstalledVersion(profileDir, packageName);
  const drifted = forceAlign || Boolean(previousVersion) && versionAfterRestore !== previousVersion;
  if (!drifted) return "restored";
  const alignment = await alignNodeModulesAfterRollback(profileDir);
  return alignment === "failed" ? "failed" : "restored";
}
function buildGithubInstallSpec(github) {
  const fragmentParts = [];
  if (github.ref) fragmentParts.push(github.ref);
  if (github.subpath) fragmentParts.push(`path:${github.subpath}`);
  const fragment = fragmentParts.length > 0 ? `#${fragmentParts.join("&")}` : "";
  return `github:${github.owner}/${github.repo}${fragment}`;
}
async function runInstallWithFallback(profileDir, profileName, spec, settings, initialPolicyBypass = false) {
  let registryUsed = resolveRegistryUrl(settings.registry);
  let fellBack = false;
  let attempt = await installWithPolicyFallback(profileDir, profileName, spec, registryUsed, initialPolicyBypass);
  if (!attempt.ok && !attempt.timedOut && settings.fallbackToOfficial && normalizeRegistryUrl(registryUsed) !== OFFICIAL_REGISTRY) {
    fellBack = true;
    registryUsed = OFFICIAL_REGISTRY;
    attempt = await installWithPolicyFallback(profileDir, profileName, spec, registryUsed, initialPolicyBypass);
  }
  return { attempt, registryUsed, fellBack };
}
function triggerPackageRefresh(packageName, refresh) {
  if (packageName === PLUGIN_NAME) {
    const timer = setTimeout(() => void refresh(), 1500);
    timer.unref?.();
    return Promise.resolve();
  }
  return refresh().catch(() => {
  });
}
async function performUpdate(config, profile, params, refresh) {
  const { packageName } = params;
  const { dir: profileDir, profileName } = profile;
  const settings = readSettings(config);
  const origin = resolvePackageOrigin(profileDir, packageName, params.source);
  const currentVersion = readInstalledVersion(profileDir, packageName);
  const registryUsed = resolveRegistryUrl(settings.registry);
  let targetVersion = params.targetVersion;
  let spec = "";
  if (origin.isGithub && origin.github) {
    if (!targetVersion) {
      const remote = await fetchGithubPackageJson(origin.github);
      targetVersion = remote.version;
    }
    spec = buildGithubInstallSpec(origin.github);
  } else {
    const remote = targetVersion ? void 0 : await fetchNpmLatest(packageName, registryUsed);
    targetVersion = targetVersion || remote.version;
    spec = `${packageName}@${targetVersion}`;
  }
  if (!targetVersion) {
    return { ok: false, packageName, error: "\u65E0\u6CD5\u786E\u5B9A\u76EE\u6807\u7248\u672C", errorCode: ERROR_CODES.invalidTargetVersion };
  }
  const snapshot = captureSnapshot(profileDir);
  const { attempt } = await runInstallWithFallback(profileDir, profileName, spec, settings);
  if (!attempt.ok) {
    const rollback = await rollbackAfterFailure(profileDir, packageName, currentVersion, snapshot, false);
    return {
      ok: false,
      packageName,
      targetVersion,
      source: origin.declaredSpec,
      rollback,
      error: attempt.timedOut ? "\u66F4\u65B0\u8D85\u65F6\uFF0C\u5DF2\u4E2D\u6B62\u5B89\u88C5" : attempt.error || "\u5B89\u88C5\u5931\u8D25",
      errorCode: attempt.timedOut ? ERROR_CODES.timeout : ERROR_CODES.installFailed
    };
  }
  const installedVersion = readInstalledVersion(profileDir, packageName);
  const verified = installedVersion !== void 0 && compareSemver(installedVersion, targetVersion) >= 0;
  if (!verified) {
    const rollback = await rollbackAfterFailure(profileDir, packageName, currentVersion, snapshot, true);
    return {
      ok: false,
      packageName,
      targetVersion,
      source: origin.declaredSpec,
      rollback,
      error: `\u5B89\u88C5\u540E\u6821\u9A8C\u672A\u901A\u8FC7\uFF1A\u671F\u671B ${targetVersion}\uFF0C\u5B9E\u9645 ${installedVersion || "\u672A\u77E5"}`,
      errorCode: ERROR_CODES.verificationFailed
    };
  }
  await triggerPackageRefresh(packageName, refresh);
  return {
    ok: true,
    packageName,
    targetVersion: installedVersion,
    source: origin.declaredSpec,
    rollback: "not-needed"
  };
}
async function performReinstall(config, profile, params, refresh) {
  const { packageName } = params;
  const { dir: profileDir, profileName } = profile;
  const settings = readSettings(config);
  const origin = resolvePackageOrigin(profileDir, packageName, params.source);
  const currentVersion = readInstalledVersion(profileDir, packageName);
  let targetVersion = params.targetVersion || currentVersion;
  let spec = "";
  if (origin.isGithub && origin.github) {
    if (!targetVersion) {
      try {
        const remote = await fetchGithubPackageJson(origin.github);
        targetVersion = remote.version;
      } catch {
      }
    }
    spec = buildGithubInstallSpec(origin.github);
  } else {
    const registry = resolveRegistryUrl(settings.registry);
    if (!targetVersion) {
      try {
        const remote = await fetchNpmLatest(packageName, registry);
        targetVersion = remote.version;
      } catch {
      }
    }
    spec = targetVersion ? `${packageName}@${targetVersion}` : packageName;
  }
  const snapshot = captureSnapshot(profileDir);
  const { attempt } = await runInstallWithFallback(profileDir, profileName, spec, settings, true);
  if (!attempt.ok) {
    const rollback = await rollbackAfterFailure(profileDir, packageName, currentVersion, snapshot, false);
    return {
      ok: false,
      packageName,
      action: "reinstall",
      targetVersion,
      rollback,
      error: attempt.timedOut ? "\u91CD\u88C5\u8D85\u65F6\uFF0C\u5DF2\u4E2D\u6B62\u64CD\u4F5C" : attempt.error || "\u91CD\u88C5\u5931\u8D25",
      errorCode: attempt.timedOut ? ERROR_CODES.timeout : ERROR_CODES.installFailed,
      output: redactSecrets(attempt.output)
    };
  }
  const disk = inspectPackageDiskHealth(profileDir, packageName);
  const installedVersion = disk.currentVersion;
  const versionOk = installedVersion !== void 0 && (!targetVersion || compareSemver(installedVersion, targetVersion) >= 0);
  if (disk.entryMissing || !versionOk) {
    const rollback = await rollbackAfterFailure(profileDir, packageName, currentVersion, snapshot, true);
    return {
      ok: false,
      packageName,
      action: "reinstall",
      targetVersion,
      rollback,
      error: disk.entryMissing ? `\u91CD\u88C5\u540E\u5165\u53E3\u6821\u9A8C\u4ECD\u7F3A\u5931\uFF1A${disk.errorDetail || "\u6587\u4EF6\u4E0D\u5B8C\u6574"}` : `\u91CD\u88C5\u540E\u7248\u672C\u6821\u9A8C\u672A\u901A\u8FC7\uFF1A\u671F\u671B ${targetVersion || "\u53EF\u7528\u7248\u672C"}\uFF0C\u5B9E\u9645 ${installedVersion || "\u672A\u77E5"}`,
      errorCode: ERROR_CODES.verificationFailed,
      output: redactSecrets(attempt.output)
    };
  }
  const selfUpdate = packageName === PLUGIN_NAME;
  await triggerPackageRefresh(packageName, refresh);
  return {
    ok: true,
    packageName,
    action: "reinstall",
    targetVersion: installedVersion,
    selfUpdate,
    rollback: "not-needed",
    output: redactSecrets(attempt.output)
  };
}
async function performUninstall(profile, packageName, bundle, refresh) {
  if (packageName === PLUGIN_NAME) {
    return {
      ok: false,
      packageName,
      action: "uninstall",
      error: "\u4E0D\u80FD\u5728\u6025\u6551\u4E2D\u5FC3\u5378\u8F7D dsh-plugins-update \u81EA\u8EAB",
      errorCode: ERROR_CODES.selfUninstallBlocked
    };
  }
  const { dir: profileDir, profileName } = profile;
  const inManifest = Object.prototype.hasOwnProperty.call(readProfileDependencies(profileDir), packageName);
  const inNodeModules = existsSync(join(profileDir, "node_modules", packageName));
  if (!inManifest && !inNodeModules && bundle?.installed === false) {
    return {
      ok: false,
      packageName,
      action: "uninstall",
      error: "\u8BE5\u63D2\u4EF6\u672A\u5B89\u88C5\u5230\u5F53\u524D profile\uFF0C\u65E0\u9700\u5378\u8F7D",
      errorCode: ERROR_CODES.notInstalled
    };
  }
  const currentVersion = readInstalledVersion(profileDir, packageName);
  const snapshot = captureSnapshot(profileDir);
  const attempt = await spawnRemove(profileDir, profileName, packageName);
  if (!attempt.ok) {
    const rollback = await rollbackAfterFailure(profileDir, packageName, currentVersion, snapshot, true);
    return {
      ok: false,
      packageName,
      action: "uninstall",
      rollback,
      error: attempt.timedOut ? "\u5378\u8F7D\u8D85\u65F6\uFF0C\u5DF2\u4E2D\u6B62\u64CD\u4F5C" : attempt.error || "\u5378\u8F7D\u5931\u8D25",
      errorCode: attempt.timedOut ? ERROR_CODES.timeout : ERROR_CODES.installFailed,
      output: redactSecrets(attempt.output)
    };
  }
  const stillInManifest = Object.prototype.hasOwnProperty.call(readProfileDependencies(profileDir), packageName);
  if (stillInManifest) {
    const rollback = await rollbackAfterFailure(profileDir, packageName, currentVersion, snapshot, true);
    return {
      ok: false,
      packageName,
      action: "uninstall",
      rollback,
      error: "\u5378\u8F7D\u540E\u6821\u9A8C\u672A\u901A\u8FC7\uFF1A\u63D2\u4EF6\u4ECD\u5B58\u5728\u4E8E profile \u914D\u7F6E\u4E2D",
      errorCode: ERROR_CODES.verificationFailed,
      output: redactSecrets(attempt.output)
    };
  }
  await refresh().catch(() => {
  });
  return {
    ok: true,
    packageName,
    action: "uninstall",
    rollback: "not-needed",
    output: redactSecrets(attempt.output)
  };
}
function jsonResponse(data, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}
function errorResponse(payload, errorCode, error, status = 200) {
  return jsonResponse({ ...payload, ok: false, error, errorCode }, status);
}
async function parseJsonBody(req) {
  try {
    const body = await req.json();
    return body && typeof body === "object" ? body : {};
  } catch {
    return {};
  }
}
function apply(ctx, config) {
  const conn = ctx.get("connection");
  const registerFetch = conn?.fetch?.register?.bind(conn.fetch);
  if (typeof registerFetch !== "function") return;
  const refreshAfterInstall = async () => {
    let reconciled = false;
    try {
      const hmr = ctx.get?.("hmr");
      if (hmr?.runExclusive && typeof hmr.reconcileProfile === "function") {
        await hmr.runExclusive(() => hmr.reconcileProfile([]));
        reconciled = true;
      }
    } catch {
    }
    if (!reconciled) {
      try {
        const packages = ctx.get?.("pluginPackages");
        if (packages?.refresh) await packages.refresh();
      } catch {
      }
    }
    try {
      ctx.emit?.("plugin-manager/changed", { reason: "install" });
      const root = ctx.root;
      if (root && root !== ctx && typeof root.emit === "function") {
        root.emit("plugin-manager/changed", { reason: "install" });
      }
    } catch {
    }
  };
  const runningProfiles = /* @__PURE__ */ new Set();
  let inFlightCheckAll = null;
  ctx.on?.("plugin-manager/changed", () => {
    inFlightCheckAll = null;
  });
  ctx.effect(
    () => registerFetch({
      path: CHECK_PATH,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: async (req) => {
        let packageName = "";
        try {
          const body = await parseJsonBody(req);
          packageName = readPackageName(body?.packageName) ?? "";
          if (!packageName) {
            return errorResponse(
              { packageName: "", hasUpdate: false },
              ERROR_CODES.invalidPackageName,
              "packageName \u5FC5\u987B\u662F\u5408\u6CD5\u7684 npm \u5305\u540D",
              400
            );
          }
          const bundle = await readBundleInfo(ctx, packageName);
          const blocked = bundleGuardError(packageName, bundle);
          if (blocked) return errorResponse({ packageName, hasUpdate: false }, blocked.errorCode, blocked.error);
          const { dir } = resolveProfileDir(packageName);
          const currentVersion = readInstalledVersion(dir, packageName) || body?.currentVersion || "0.0.0";
          const settings = readSettings(config);
          const { info, origin, registry } = await resolveRemotePackage(
            packageName,
            dir,
            settings,
            typeof body?.source === "string" ? body.source : bundle?.source
          );
          const result = {
            ok: true,
            packageName,
            currentVersion,
            latestVersion: info.version,
            hasUpdate: compareSemver(info.version, currentVersion) > 0,
            source: origin.declaredSpec || bundle?.source,
            isGithub: info.isGithub,
            registry: safeRegistryUrl(registry),
            alwaysShowDetailButton: settings.alwaysShowDetailButton
          };
          return jsonResponse(result);
        } catch (error) {
          const errorCode = error instanceof RemoteError ? error.errorCode : ERROR_CODES.unknown;
          return errorResponse(
            { packageName, hasUpdate: false },
            errorCode,
            redactSecrets(error?.message || "\u68C0\u67E5\u66F4\u65B0\u5931\u8D25")
          );
        }
      }
    }),
    "dsh-plugins-update: check route"
  );
  ctx.effect(
    () => registerFetch({
      path: CHECK_ALL_PATH,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: async (req) => {
        try {
          const body = await parseJsonBody(req);
          const force = body?.force === true;
          const reconcile = body?.reconcile === true;
          const rawKnown = body?.knownUpdates && typeof body.knownUpdates === "object" ? body.knownUpdates : {};
          const runBatch = async () => {
            const installed = await inspectInstalledPluginsHealth(ctx);
            const settings2 = readSettings(config);
            const updatable2 = {};
            const unhealthy2 = {};
            const toProbe = [];
            for (const item of installed) {
              const hasIssues = item.issues.length > 0;
              if (hasIssues) {
                unhealthy2[item.packageName] = {
                  issues: item.issues,
                  ...item.errorDetail ? { errorDetail: item.errorDetail } : {},
                  currentVersion: item.currentVersion
                };
              }
              const knownVer = !force && !hasIssues ? readTargetVersion(rawKnown[item.packageName]) : void 0;
              if (typeof knownVer === "string" && compareSemver(knownVer, item.currentVersion) > 0) {
                updatable2[item.packageName] = knownVer;
              } else {
                toProbe.push(item);
              }
            }
            const concurrency = 4;
            let cursor = 0;
            const workers = Array.from({ length: Math.min(concurrency, toProbe.length) }, async () => {
              while (cursor < toProbe.length) {
                const current = toProbe[cursor++];
                if (!current) break;
                try {
                  const { info } = await resolveRemotePackage(
                    current.packageName,
                    current.dir,
                    settings2,
                    current.source
                  );
                  if (compareSemver(info.version, current.currentVersion) > 0) {
                    updatable2[current.packageName] = info.version;
                  }
                } catch {
                }
              }
            });
            await Promise.all(workers);
            return { updatable: updatable2, unhealthy: unhealthy2 };
          };
          let task;
          if (!force && !reconcile && inFlightCheckAll) {
            task = inFlightCheckAll;
          } else {
            task = runBatch().finally(() => {
              if (inFlightCheckAll === task) inFlightCheckAll = null;
            });
            inFlightCheckAll = task;
          }
          const { updatable, unhealthy } = await task;
          const settings = readSettings(config);
          const result = {
            ok: true,
            updatable,
            hostVersion: detectHostVersion(ctx),
            unhealthy,
            registry: safeRegistryUrl(resolveRegistryUrl(settings.registry)),
            alwaysShowDetailButton: settings.alwaysShowDetailButton
          };
          return jsonResponse(result);
        } catch (error) {
          const errorCode = error instanceof RemoteError ? error.errorCode : ERROR_CODES.unknown;
          return errorResponse(
            { updatable: {} },
            errorCode,
            redactSecrets(error?.message || "\u6279\u91CF\u68C0\u67E5\u66F4\u65B0\u5931\u8D25")
          );
        }
      }
    }),
    "dsh-plugins-update: check-all route"
  );
  ctx.effect(
    () => registerFetch({
      path: DIAGNOSE_PATH,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: async (req) => {
        try {
          const body = await parseJsonBody(req);
          const rawCrashes = body?.clientCrashes && typeof body.clientCrashes === "object" ? body.clientCrashes : {};
          const clientCrashes = /* @__PURE__ */ new Map();
          for (const [rawName, rawMsg] of Object.entries(rawCrashes)) {
            const pkgName = readPackageName(rawName);
            if (!pkgName || isOfficialPackageName(pkgName) || pkgName === PLUGIN_NAME) continue;
            if (typeof rawMsg === "string" && rawMsg.trim()) {
              const msg = redactSecrets(rawMsg.trim());
              clientCrashes.set(pkgName, msg.length > 300 ? `${msg.slice(0, 300)}...` : msg);
            }
          }
          const installed = await inspectInstalledPluginsHealth(ctx);
          const settings = readSettings(config);
          const reports = [];
          let cursor = 0;
          const concurrency = 4;
          const workers = Array.from({ length: Math.min(concurrency, installed.length) }, async () => {
            while (cursor < installed.length) {
              const item = installed[cursor++];
              if (!item) break;
              let latestVersion;
              let hasUpdate = false;
              let isGithub = parseGithubSource(item.source) ? true : void 0;
              try {
                const { info } = await resolveRemotePackage(item.packageName, item.dir, settings, item.source);
                latestVersion = info.version;
                hasUpdate = compareSemver(info.version, item.currentVersion) > 0;
                isGithub = info.isGithub;
              } catch {
              }
              const issues = [...item.issues];
              const details = item.errorDetail ? [item.errorDetail] : [];
              const crashMsg = clientCrashes.get(item.packageName);
              if (crashMsg) {
                if (!issues.includes("client-crash")) issues.push("client-crash");
                details.push(`\u524D\u7AEF\u5F02\u5E38: ${crashMsg}`);
              }
              reports.push({
                packageName: item.packageName,
                currentVersion: item.currentVersion,
                latestVersion,
                hasUpdate,
                source: item.source,
                isGithub,
                enabled: item.bundle?.enabled,
                availability: item.bundle?.availability,
                healthy: issues.length === 0,
                issues,
                errorDetail: details.filter(Boolean).join("; ") || void 0
              });
            }
          });
          await Promise.all(workers);
          reports.sort((a, b) => {
            if (a.healthy !== b.healthy) return a.healthy ? 1 : -1;
            if (a.hasUpdate !== b.hasUpdate) return a.hasUpdate ? -1 : 1;
            return a.packageName.localeCompare(b.packageName);
          });
          const primaryProfile = resolveProfileDir();
          const result = {
            ok: true,
            hostVersion: detectHostVersion(ctx),
            profileName: primaryProfile.profileName,
            plugins: reports,
            registry: safeRegistryUrl(resolveRegistryUrl(settings.registry))
          };
          return jsonResponse(result);
        } catch (error) {
          const errorCode = error instanceof RemoteError ? error.errorCode : ERROR_CODES.unknown;
          return errorResponse(
            { plugins: [] },
            errorCode,
            redactSecrets(error?.message || "\u63D2\u4EF6\u5065\u5EB7\u8BCA\u65AD\u5931\u8D25")
          );
        }
      }
    }),
    "dsh-plugins-update: diagnose route"
  );
  ctx.effect(
    () => registerFetch({
      path: UPDATE_PATH,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: async (req) => {
        let packageName = "";
        try {
          const body = await parseJsonBody(req);
          packageName = readPackageName(body?.packageName) ?? "";
          if (!packageName) {
            return errorResponse({ packageName: "" }, ERROR_CODES.invalidPackageName, "packageName \u5FC5\u987B\u662F\u5408\u6CD5\u7684 npm \u5305\u540D", 400);
          }
          const targetVersion = readTargetVersion(body?.targetVersion);
          if (targetVersion === null) {
            return errorResponse({ packageName }, ERROR_CODES.invalidTargetVersion, "targetVersion \u5FC5\u987B\u662F\u5408\u6CD5\u7684\u8BED\u4E49\u5316\u7248\u672C", 400);
          }
          const bundle = await readBundleInfo(ctx, packageName);
          const blocked = bundleGuardError(packageName, bundle);
          if (blocked) return errorResponse({ packageName }, blocked.errorCode, blocked.error);
          const profile = resolveProfileDir(packageName);
          if (!existsSync(join(profile.dir, "package.json"))) {
            return errorResponse({ packageName }, ERROR_CODES.profileNotFound, "\u627E\u4E0D\u5230\u53EF\u7528\u7684 DSH profile \u76EE\u5F55");
          }
          if (runningProfiles.has(profile.dir)) {
            return errorResponse({ packageName }, ERROR_CODES.installInProgress, "\u53E6\u4E00\u4E2A\u63D2\u4EF6\u6B63\u5728\u66F4\u65B0\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5");
          }
          runningProfiles.add(profile.dir);
          try {
            const result = await performUpdate(
              config,
              profile,
              {
                packageName,
                targetVersion,
                source: typeof body?.source === "string" ? body.source : bundle?.source
              },
              refreshAfterInstall
            );
            return jsonResponse(result);
          } finally {
            runningProfiles.delete(profile.dir);
          }
        } catch (error) {
          return errorResponse(
            { packageName },
            error instanceof RemoteError ? error.errorCode : ERROR_CODES.unknown,
            redactSecrets(error?.message || "\u66F4\u65B0\u5931\u8D25")
          );
        }
      }
    }),
    "dsh-plugins-update: update route"
  );
  ctx.effect(
    () => registerFetch({
      path: RESCUE_PATH,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: async (req) => {
        let packageName = "";
        let action = "update";
        try {
          const body = await parseJsonBody(req);
          packageName = readPackageName(body?.packageName) ?? "";
          const rawAction = body?.action;
          if (rawAction === "update" || rawAction === "reinstall" || rawAction === "uninstall") {
            action = rawAction;
          } else {
            return errorResponse(
              { packageName, action },
              ERROR_CODES.unknown,
              "\u4E0D\u652F\u6301\u7684\u6025\u6551\u64CD\u4F5C\u7C7B\u578B",
              400
            );
          }
          if (!packageName) {
            return errorResponse(
              { packageName: "", action },
              ERROR_CODES.invalidPackageName,
              "packageName \u5FC5\u987B\u662F\u5408\u6CD5\u7684 npm \u5305\u540D",
              400
            );
          }
          const targetVersion = readTargetVersion(body?.targetVersion);
          if (targetVersion === null) {
            return errorResponse(
              { packageName, action },
              ERROR_CODES.invalidTargetVersion,
              "targetVersion \u5FC5\u987B\u662F\u5408\u6CD5\u7684\u8BED\u4E49\u5316\u7248\u672C",
              400
            );
          }
          const bundle = await readBundleInfo(ctx, packageName);
          const blocked = bundleGuardError(packageName, bundle);
          if (blocked) {
            return errorResponse({ packageName, action }, blocked.errorCode, blocked.error);
          }
          if (action === "uninstall" && packageName === PLUGIN_NAME) {
            return errorResponse(
              { packageName, action },
              ERROR_CODES.selfUninstallBlocked,
              "\u4E0D\u80FD\u5728\u6025\u6551\u4E2D\u5FC3\u5378\u8F7D dsh-plugins-update \u81EA\u8EAB"
            );
          }
          const profile = resolveProfileDir(packageName);
          if (!existsSync(join(profile.dir, "package.json"))) {
            return errorResponse({ packageName, action }, ERROR_CODES.profileNotFound, "\u627E\u4E0D\u5230\u53EF\u7528\u7684 DSH profile \u76EE\u5F55");
          }
          if (runningProfiles.has(profile.dir)) {
            return errorResponse(
              { packageName, action },
              ERROR_CODES.installInProgress,
              "\u53E6\u4E00\u4E2A\u63D2\u4EF6\u6B63\u5728\u66F4\u65B0\u6216\u4FEE\u590D\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5"
            );
          }
          runningProfiles.add(profile.dir);
          try {
            const source = typeof body?.source === "string" ? body.source : bundle?.source;
            if (action === "update") {
              const updated = await performUpdate(
                config,
                profile,
                { packageName, targetVersion, source },
                refreshAfterInstall
              );
              const result = {
                ok: updated.ok,
                packageName,
                action: "update",
                targetVersion: updated.targetVersion,
                selfUpdate: packageName === PLUGIN_NAME,
                rollback: updated.rollback,
                error: updated.error,
                errorCode: updated.errorCode
              };
              return jsonResponse(result);
            }
            if (action === "reinstall") {
              const reinstalled = await performReinstall(
                config,
                profile,
                { packageName, targetVersion, source },
                refreshAfterInstall
              );
              return jsonResponse(reinstalled);
            }
            const uninstalled = await performUninstall(profile, packageName, bundle, refreshAfterInstall);
            return jsonResponse(uninstalled);
          } finally {
            runningProfiles.delete(profile.dir);
          }
        } catch (error) {
          return errorResponse(
            { packageName, action },
            error instanceof RemoteError ? error.errorCode : ERROR_CODES.unknown,
            redactSecrets(error?.message || "\u6025\u6551\u64CD\u4F5C\u5931\u8D25")
          );
        }
      }
    }),
    "dsh-plugins-update: rescue route"
  );
}
export {
  Config,
  apply,
  inject,
  name
};
