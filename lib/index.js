// src/index.ts
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { homedir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Schema from "@deepseek-ai/schemastery";

// src/types.ts
var OFFICIAL_REGISTRY = "https://registry.npmjs.org/";
var DOMESTIC_REGISTRY = "https://registry.npmmirror.com/";
var PLUGIN_NAME = "dsh-plugins-update";
var OFFICIAL_PACKAGE_PREFIX = "@deepseek-ai/";
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

// src/index.ts
var name = PLUGIN_NAME;
var inject = [];
var PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;
var PROFILE_NAME_PATTERN = /^[a-zA-Z0-9._-]+$/;
var INSTALL_TIMEOUT_MS = 18e4;
var ROLLBACK_TIMEOUT_MS = 6e4;
var CHECK_TIMEOUT_MS = 12e3;
var OUTPUT_LIMIT = 8e3;
var MAX_REDIRECTS = 3;
var FIBER_PENDING = 0;
var FIBER_FAILED = 3;
var CRASH_LOOP_WINDOW_MS = 9e4;
var CRASH_LOOP_CLEAR_MS = 5e3;
var CRASH_LOOP_THRESHOLD = 3;
var RELEASE_COOLING_WINDOW_MS = 24 * 60 * 60 * 1e3;
var MARKET_CACHE_TTL_MS = 10 * 60 * 1e3;
var MARKET_FETCH_TIMEOUT_MS = 1e4;
var DEFAULT_MARKET_INDEX_URLS = [
  "https://awesome-dsh-plugin.com/index.json",
  "https://dshmarket.com/index.json",
  "https://cdn.jsdelivr.net/npm/dsh-plugin-catalog/index.json"
];
var ALLOWED_CHILD_ENV_KEYS = [
  "PATH",
  "Path",
  "PATHEXT",
  "SystemRoot",
  "SYSTEMROOT",
  "SystemDrive",
  "WINDIR",
  "windir",
  "COMSPEC",
  "ComSpec",
  "TEMP",
  "TMP",
  "TMPDIR",
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "APPDATA",
  "LOCALAPPDATA",
  "ProgramData",
  "ProgramFiles",
  "ProgramFiles(x86)",
  "CommonProgramFiles",
  "USERNAME",
  "USER",
  "LOGNAME",
  "SHELL",
  "LANG",
  "LC_ALL",
  "LC_CTYPE",
  "TZ",
  "XDG_CACHE_HOME",
  "XDG_CONFIG_HOME",
  "XDG_DATA_HOME",
  "XDG_STATE_HOME",
  "PNPM_HOME",
  "PNPM_STORE_DIR",
  "NPM_CONFIG_CACHE",
  "npm_config_cache",
  "DSH_HOME",
  "DSH_PROFILE",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
  "http_proxy",
  "https_proxy",
  "all_proxy",
  "no_proxy",
  "SSL_CERT_FILE",
  "SSL_CERT_DIR",
  "NODE_EXTRA_CA_CERTS",
  "REQUESTS_CA_BUNDLE",
  "CURL_CA_BUNDLE"
];
function live(schema) {
  const s = schema;
  return typeof s?.volatile === "function" ? s.volatile() : schema;
}
function createConfigSchema() {
  try {
    return Schema.object({
      registry: live(
        Schema.string().default("npmjs").description("\u7B2C\u4E09\u65B9\u63D2\u4EF6\u66F4\u65B0\u6E90\uFF1Anpmjs\uFF08npm \u5B98\u65B9\uFF09/ npmmirror\uFF08\u56FD\u5185\u955C\u50CF\uFF09/ \u81EA\u5B9A\u4E49 HTTPS \u6E90 URL\uFF1BUpdate registry: npmjs | npmmirror | custom HTTPS URL")
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
      ),
      allowFreshRelease: live(
        Schema.boolean().default(false).description("\u5141\u8BB8\u63A2\u6D4B\u5E76\u66F4\u65B0\u672A\u6EE1 24 \u5C0F\u65F6\u53D1\u5E03\u89C2\u5BDF\u671F\u7684\u7248\u672C\uFF08\u9AD8\u98CE\u9669\uFF09/ Allow probing and updating npm releases under the 24h cooling period (high risk)")
      ),
      allowUnreviewed: live(
        Schema.boolean().default(false).description("\u5141\u8BB8\u63A2\u6D4B\u5E76\u66F4\u65B0\u672A\u7ECF\u5E02\u573A\u5B89\u5168\u5BA1\u6838\u7684\u7248\u672C\u4E0E\u6765\u6E90\uFF08\u9AD8\u98CE\u9669\uFF09/ Allow probing and updating versions or sources without market security review (high risk)")
      )
    });
  } catch {
    return void 0;
  }
}
var Config = createConfigSchema();
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
    alwaysShowDetailButton: readField(config?.alwaysShowDetailButton, false),
    allowFreshRelease: readField(config?.allowFreshRelease, false),
    allowUnreviewed: readField(config?.allowUnreviewed, false)
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
function writeFileAtomicSync(filePath, content) {
  const dir = dirname(filePath);
  mkdirSync(dir, { recursive: true });
  const tmpPath = join(
    dir,
    `.${basename(filePath)}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
  );
  try {
    writeFileSync(tmpPath, content, { encoding: "utf8", mode: 384 });
    renameSync(tmpPath, filePath);
  } catch (error) {
    try {
      rmSync(tmpPath, { force: true });
    } catch {
    }
    throw error;
  }
}
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
function detectHostVersion(ctx) {
  const envVersion = process.env.DSH_VERSION?.trim();
  if (envVersion) return envVersion;
  const ctxVersion = ctx?.host?.version || ctx?.app?.version;
  if (typeof ctxVersion === "string" && ctxVersion.trim()) return ctxVersion.trim();
  try {
    const req = createRequire(import.meta.url);
    const bootPkgPath = req.resolve("@deepseek-ai/dsh-app-boot/package.json");
    if (bootPkgPath && existsSync(bootPkgPath)) {
      const bootPkg = JSON.parse(readFileSync(bootPkgPath, "utf8"));
      if (typeof bootPkg?.version === "string" && bootPkg.version.trim()) {
        return bootPkg.version.trim();
      }
    }
  } catch {
  }
  const execDir = process.execPath ? dirname(process.execPath) : "";
  const dshHome = process.env.DSH_HOME?.trim() || join(homedir(), ".dsh");
  const candidates = [];
  if (execDir) {
    candidates.push(
      join(execDir, "resources", "app.asar", "package.json"),
      join(execDir, "..", "Resources", "app.asar", "package.json"),
      join(execDir, "resources", "app.asar", "dsh", "package.json"),
      join(execDir, "..", "Resources", "app.asar", "dsh", "package.json"),
      join(execDir, "resources", "app.asar", "dsh", "node_modules", "@deepseek-ai", "dsh-desktop-host", "package.json"),
      join(execDir, "..", "Resources", "app.asar", "dsh", "node_modules", "@deepseek-ai", "dsh-desktop-host", "package.json")
    );
  }
  candidates.push(
    join(dshHome, "dsh-runtimes", "dsh-primary-runtime", "runtime.json"),
    join(dshHome, "dsh-runtimes", "dsh-primary-runtime", "package.json")
  );
  for (const candidate of candidates) {
    try {
      if (!existsSync(candidate)) continue;
      const data = JSON.parse(readFileSync(candidate, "utf8"));
      const ver = data?.desktopVersion ?? data?.version;
      if (typeof ver === "string" && ver.trim()) {
        return ver.trim();
      }
    } catch {
    }
  }
  return void 0;
}
function profileCandidates() {
  const dshHome = process.env.DSH_HOME || join(homedir(), ".dsh");
  const profilesDir = join(dshHome, "profiles");
  const rawPreferred = (process.env.DSH_PROFILE || "").trim();
  const preferred = rawPreferred && PROFILE_NAME_PATTERN.test(rawPreferred) ? rawPreferred : "";
  const names = [...new Set([preferred, "desktop", "default", "web"].filter(Boolean))];
  const candidates = names.map((profileName) => ({ dir: join(profilesDir, profileName), profileName })).filter((candidate) => existsSync(join(candidate.dir, "package.json")));
  if (candidates.length === 0) candidates.push({ dir: join(profilesDir, "desktop"), profileName: "desktop" });
  return candidates;
}
function readProfileManifest(profileDir) {
  const manifestPath = join(profileDir, "package.json");
  if (!existsSync(manifestPath)) return null;
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    return null;
  }
}
function readProfileDependencies(profileDir) {
  const manifest = readProfileManifest(profileDir);
  if (!manifest) return {};
  return {
    ...manifest?.optionalDependencies || {},
    ...manifest?.devDependencies || {},
    ...manifest?.dependencies || {}
  };
}
function readActiveBundlesFromManifest(profileDir) {
  const manifest = readProfileManifest(profileDir);
  const bundles = manifest?.dsh?.profile?.bundles;
  if (!Array.isArray(bundles)) return [];
  return bundles.filter((item) => typeof item === "string");
}
function disableBundleOnDisk(profileDir, packageName) {
  if (isOfficialPackageName(packageName) || packageName === PLUGIN_NAME) return false;
  const manifestPath = join(profileDir, "package.json");
  const manifest = readProfileManifest(profileDir);
  const bundles = manifest?.dsh?.profile?.bundles;
  if (!manifest || !Array.isArray(bundles) || !bundles.includes(packageName)) return false;
  const updated = {
    ...manifest,
    dsh: {
      ...manifest.dsh,
      profile: {
        ...manifest.dsh.profile,
        bundles: bundles.filter((name2) => name2 !== packageName)
      }
    }
  };
  try {
    writeFileAtomicSync(manifestPath, `${JSON.stringify(updated, null, 2)}
`);
    return true;
  } catch {
    return false;
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
function getService(ctx, names) {
  for (const service of names) {
    try {
      const direct = ctx?.get?.(service);
      if (direct !== void 0) return direct;
    } catch {
    }
    try {
      const rootSvc = ctx?.root?.get?.(service);
      if (rootSvc !== void 0) return rootSvc;
    } catch {
    }
  }
  return void 0;
}
async function readAllBundles(ctx) {
  for (const service of ["pluginManager", "plugin-manager"]) {
    for (const scope of [ctx, ctx?.root]) {
      try {
        const manager = scope?.get?.(service);
        if (typeof manager?.listBundles !== "function") continue;
        const bundles = await manager.listBundles();
        if (Array.isArray(bundles)) return bundles;
      } catch {
      }
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
  const nodeModulesRoot = resolve(profileDir, "node_modules");
  const pkgDir = resolve(nodeModulesRoot, packageName);
  const pkgRel = relative(nodeModulesRoot, pkgDir);
  if (!pkgRel || pkgRel.startsWith("..") || isAbsolute(pkgRel)) {
    return { entryMissing: true, errorDetail: "\u63D2\u4EF6\u76EE\u5F55\u8DEF\u5F84\u8D8A\u754C" };
  }
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
    const targetPath = resolve(pkgDir, cleanRel);
    const rel = relative(pkgDir, targetPath);
    if (!rel || rel.startsWith("..") || isAbsolute(rel)) {
      return {
        entryMissing: true,
        currentVersion,
        errorDetail: `\u5165\u53E3\u8DEF\u5F84\u8D8A\u754C: ${relPath}`
      };
    }
    if (!existsSync(targetPath)) {
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
  if (bundle.error && typeof bundle.error === "object") {
    const code = typeof bundle.error.code === "string" ? bundle.error.code : "";
    if (code === "incompatible-version") return "\u58F0\u660E\u7684 DSH \u517C\u5BB9\u7248\u672C\u4E0E\u5F53\u524D\u5BBF\u4E3B\u4E0D\u5339\u914D";
    if (code === "unsupported-platform") return "\u4E0D\u652F\u6301\u5F53\u524D\u64CD\u4F5C\u7CFB\u7EDF\u5E73\u53F0";
    if (typeof bundle.error.diagnostic === "string" && bundle.error.diagnostic.trim()) {
      const redacted2 = redactSecrets(bundle.error.diagnostic.trim());
      return redacted2.length > 300 ? `${redacted2.slice(0, 300)}...` : redacted2;
    }
    if (code) return `\u5BBF\u4E3B\u62D2\u7EDD\u52A0\u8F7D (${code})`;
  }
  const raw = bundle.error ?? bundle.loadError ?? bundle.reason ?? bundle.message;
  if (!raw) return void 0;
  const text = typeof raw === "string" ? raw.trim() : typeof raw?.message === "string" ? raw.message.trim() : String(raw).trim();
  if (!text) return void 0;
  const redacted = redactSecrets(text);
  return redacted.length > 300 ? `${redacted.slice(0, 300)}...` : redacted;
}
async function listInstalledThirdPartyPackages(ctx) {
  const bundles = await readAllBundles(ctx);
  const bundleMap = /* @__PURE__ */ new Map();
  for (const b of bundles) {
    if (b && typeof b.name === "string") bundleMap.set(b.name, b);
  }
  const profiles = profileCandidates().map((candidate) => ({
    ...candidate,
    deps: readProfileDependencies(candidate.dir),
    activeBundles: new Set(readActiveBundlesFromManifest(candidate.dir))
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
    const { dir, profileName, activeBundles } = owner;
    const installedVersion = readInstalledVersion(dir, packageName);
    if (!inManifest && !installedVersion) continue;
    const enabled = bundle ? bundle.enabled === true : activeBundles.has(packageName);
    result.push({
      packageName,
      dir,
      profileName,
      currentVersion: installedVersion || extractVersionFromSpec(declaredSpec),
      source: declaredSpec || bundle?.source,
      bundle,
      enabled
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
  const nodeModulesRoot = resolve(profileDir, "node_modules");
  const pkgDir = resolve(nodeModulesRoot, packageName);
  const rel = relative(nodeModulesRoot, pkgDir);
  if (!rel || rel.startsWith("..") || isAbsolute(rel)) return void 0;
  const manifestPath = join(pkgDir, "package.json");
  try {
    const pkg = JSON.parse(readFileSync(manifestPath, "utf8"));
    return typeof pkg.version === "string" && pkg.version.trim() ? pkg.version.trim() : void 0;
  } catch {
    return void 0;
  }
}
function guardStatePath(profileDir) {
  return join(profileDir, ".plugin-manager", "dsh-plugins-update-state.json");
}
function loadGuardState(profileDir) {
  const empty = { conflicts: {} };
  const filePath = guardStatePath(profileDir);
  if (!existsSync(filePath)) return empty;
  try {
    const raw = JSON.parse(readFileSync(filePath, "utf8"));
    if (!raw || typeof raw !== "object") return empty;
    const conflicts = {};
    if (raw.conflicts && typeof raw.conflicts === "object") {
      for (const [k, v] of Object.entries(raw.conflicts)) {
        const pkgName = readPackageName(k);
        if (!pkgName || isOfficialPackageName(pkgName) || pkgName === PLUGIN_NAME) continue;
        if (!v || typeof v !== "object") continue;
        const entry = v;
        const pluginVersion = typeof entry.pluginVersion === "string" && entry.pluginVersion.trim() ? entry.pluginVersion.trim() : "0.0.0";
        const hostVersion = typeof entry.hostVersion === "string" && entry.hostVersion.trim() ? entry.hostVersion.trim() : void 0;
        const reason = typeof entry.reason === "string" && entry.reason.trim() ? redactSecrets(entry.reason.trim()) : void 0;
        conflicts[pkgName] = { pluginVersion, ...hostVersion ? { hostVersion } : {}, ...reason ? { reason } : {} };
      }
    }
    const lastHostVersion = typeof raw.lastHostVersion === "string" && raw.lastHostVersion.trim() ? raw.lastHostVersion.trim() : void 0;
    let bootStreak;
    if (raw.bootStreak && typeof raw.bootStreak === "object" && typeof raw.bootStreak.hostVersion === "string" && typeof raw.bootStreak.count === "number" && typeof raw.bootStreak.timestamp === "number") {
      bootStreak = {
        hostVersion: raw.bootStreak.hostVersion.trim(),
        count: raw.bootStreak.count,
        timestamp: raw.bootStreak.timestamp
      };
    }
    return { lastHostVersion, bootStreak, conflicts };
  } catch {
    return empty;
  }
}
function saveGuardState(profileDir, state) {
  if (!existsSync(join(profileDir, "package.json"))) return;
  try {
    writeFileAtomicSync(guardStatePath(profileDir), `${JSON.stringify(state, null, 2)}
`);
  } catch {
  }
}
function clearConflictInState(profileDir, packageName) {
  const state = loadGuardState(profileDir);
  if (!Object.prototype.hasOwnProperty.call(state.conflicts, packageName)) return false;
  delete state.conflicts[packageName];
  saveGuardState(profileDir, state);
  return true;
}
function pathMatchesPackage(candidatePath, packageName) {
  if (!candidatePath) return false;
  let normalized = candidatePath;
  if (normalized.startsWith("file:")) {
    try {
      normalized = fileURLToPath(normalized);
    } catch {
      return false;
    }
  }
  normalized = normalized.replace(/\\/g, "/");
  const idx = normalized.lastIndexOf("/node_modules/");
  if (idx < 0) return false;
  const rest = normalized.slice(idx + "/node_modules/".length);
  return rest === packageName || rest.startsWith(`${packageName}/`);
}
function entryBelongsToPackage(entry, packageName, bundleRowIds) {
  if (!entry) return false;
  const entryId = typeof entry.id === "string" ? entry.id : typeof entry.options?.id === "string" ? entry.options.id : "";
  if (entryId && bundleRowIds.has(entryId)) return true;
  const modName = typeof entry.options?.name === "string" ? entry.options.name : "";
  if (modName === packageName || modName.startsWith(`${packageName}/`) || pathMatchesPackage(modName, packageName)) {
    return true;
  }
  const baseUrl = typeof entry.parent?.tree?.ctx?.baseUrl === "string" ? entry.parent.tree.ctx.baseUrl : "";
  return pathMatchesPackage(baseUrl, packageName);
}
function detectPluginConflict(profileDir, packageName, bundle, loaderEntries) {
  if (isOfficialPackageName(packageName) || packageName === PLUGIN_NAME) return void 0;
  const bundleError = extractBundleErrorDetail(bundle);
  const hasBundleError = Boolean(bundleError) || bundle?.status === "error" || bundle?.state === "error" || bundle?.state === "failed";
  if (hasBundleError) {
    return bundleError || `\u63D2\u4EF6\u5F02\u5E38 (${bundle?.status || bundle?.state || "error"})`;
  }
  const disk = inspectPackageDiskHealth(profileDir, packageName);
  if (disk.entryMissing) {
    return disk.errorDetail || "\u63D2\u4EF6\u5165\u53E3\u6587\u4EF6\u7F3A\u5931\u6216\u635F\u574F";
  }
  if (loaderEntries.length > 0) {
    const bundleRowIds = /* @__PURE__ */ new Set();
    for (const row of bundle?.rows || []) {
      if (row?.rowId) bundleRowIds.add(row.rowId);
      if (row?.entryId) bundleRowIds.add(row.entryId);
    }
    for (const entry of loaderEntries) {
      if (!entryBelongsToPackage(entry, packageName, bundleRowIds)) continue;
      let disabled = false;
      try {
        disabled = entry?.disabled === true;
      } catch {
        return "\u63D2\u4EF6\u542F\u7528\u6761\u4EF6\u8868\u8FBE\u5F0F\u6267\u884C\u5F02\u5E38";
      }
      if (disabled) continue;
      const fiber = entry.fiber;
      if (!fiber || fiber.state === FIBER_FAILED) {
        return "\u63D2\u4EF6\u540E\u7AEF\u6A21\u5757\u52A0\u8F7D\u6216\u521D\u59CB\u5316\u5931\u8D25";
      }
      if (fiber.state === FIBER_PENDING) {
        const missing = Object.keys(fiber.inject || {}).filter((service) => {
          try {
            return fiber.ctx?.get?.(service) === void 0;
          } catch {
            return true;
          }
        });
        if (missing.length > 0) {
          return `\u4F9D\u8D56\u7684\u5BBF\u4E3B\u670D\u52A1\u7F3A\u5931\u6216\u5DF2\u53D8\u66F4: ${missing.join(", ")}`;
        }
      }
    }
  }
  return void 0;
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
  let pinnedCommit;
  let subpath;
  if (rawFragment) {
    const parts = rawFragment.split("&").map((s) => s.trim()).filter(Boolean);
    for (const part of parts) {
      if (part.startsWith("path:")) {
        const normalizedPath = part.slice("path:".length).trim().replace(/\\/g, "/").split("/").filter((seg) => seg && seg !== "." && seg !== "..").join("/");
        if (normalizedPath) subpath = normalizedPath;
      } else if (/^[0-9a-f]{40}$/i.test(part)) {
        pinnedCommit = part.toLowerCase();
      } else if (!part.includes(":") && !part.includes("..") && /^[A-Za-z0-9._/-]+$/.test(part)) {
        ref = part;
      }
    }
  }
  return {
    owner,
    repo,
    ...ref ? { ref } : {},
    ...pinnedCommit ? { pinnedCommit } : {},
    ...subpath ? { subpath } : {}
  };
}
function resolvePackageOrigin(profileDir, packageName, hostBundleSource) {
  const spec = readProfileDependencies(profileDir)[packageName];
  const fromManifest = parseGithubSource(spec);
  if (fromManifest) return { isGithub: true, github: fromManifest, declaredSpec: spec };
  if (!spec && hostBundleSource) {
    const fromHost = parseGithubSource(hostBundleSource);
    if (fromHost) return { isGithub: true, github: fromHost, declaredSpec: hostBundleSource };
  }
  return { isGithub: false, declaredSpec: spec || hostBundleSource };
}
var RemoteError = class extends Error {
  errorCode;
  constructor(errorCode, message) {
    super(message);
    this.errorCode = errorCode;
  }
};
function encodePackageName(packageName) {
  return encodeURIComponent(packageName).replace(/^%40/i, "@");
}
function assertSafeHttpsUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new RemoteError(ERROR_CODES.offline, "\u66F4\u65B0\u6E90 URL \u683C\u5F0F\u4E0D\u5408\u6CD5");
  }
  if (parsed.protocol !== "https:") {
    throw new RemoteError(ERROR_CODES.offline, "\u4EC5\u652F\u6301 HTTPS \u66F4\u65B0\u6E90\u5730\u5740");
  }
  if (parsed.username || parsed.password) {
    throw new RemoteError(ERROR_CODES.offline, "\u66F4\u65B0\u6E90\u5730\u5740\u4E0D\u5141\u8BB8\u5305\u542B\u5185\u5D4C\u8D26\u53F7\u51ED\u636E");
  }
  if (isDisallowedHost(parsed.hostname)) {
    throw new RemoteError(ERROR_CODES.offline, "\u66F4\u65B0\u6E90\u4E3B\u673A\u5730\u5740\u88AB\u5B89\u5168\u7B56\u7565\u62D2\u7EDD");
  }
  return parsed;
}
async function fetchJson(url, timeoutMs = CHECK_TIMEOUT_MS, externalSignal, accept = "application/json") {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const signal = externalSignal ? AbortSignal.any([controller.signal, externalSignal]) : controller.signal;
  try {
    let currentUrl = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      const parsed = assertSafeHttpsUrl(currentUrl);
      const response = await fetch(parsed.href, {
        headers: {
          accept,
          "user-agent": PLUGIN_NAME
        },
        signal,
        redirect: "manual"
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        try {
          await response.body?.cancel?.();
        } catch {
        }
        if (!location || hop === MAX_REDIRECTS) {
          throw new RemoteError(ERROR_CODES.offline, "\u66F4\u65B0\u6E90\u91CD\u5B9A\u5411\u6B21\u6570\u8FC7\u591A\u6216\u76EE\u6807\u5730\u5740\u7F3A\u5931");
        }
        currentUrl = new URL(location, parsed.href).href;
        continue;
      }
      if (!response.ok) throw new RemoteError(ERROR_CODES.offline, `HTTP ${response.status}`);
      return await response.json();
    }
    throw new RemoteError(ERROR_CODES.offline, "\u66F4\u65B0\u6E90\u91CD\u5B9A\u5411\u5F02\u5E38");
  } catch (error) {
    if (error instanceof RemoteError) throw error;
    if (controller.signal.aborted) throw new RemoteError(ERROR_CODES.timeout, "\u68C0\u67E5\u66F4\u65B0\u8D85\u65F6");
    if (externalSignal?.aborted || error?.name === "AbortError") throw error;
    throw new RemoteError(ERROR_CODES.offline, redactSecrets(error?.message || "\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25"));
  } finally {
    clearTimeout(timer);
  }
}
var marketIndexCache = /* @__PURE__ */ new Map();
var inFlightMarketIndex = /* @__PURE__ */ new Map();
var defaultMarketCache = null;
var inFlightDefaultMarket = null;
function parseMarketPluginVersions(rawPlugin) {
  const out = [];
  if (!Array.isArray(rawPlugin?.versions)) return out;
  for (const v of rawPlugin.versions) {
    const version = readTargetVersion(v?.version);
    if (!version) continue;
    const publishTimestampMs = typeof v?.publishTimestamp === "number" && Number.isFinite(v.publishTimestamp) ? v.publishTimestamp * 1e3 : void 0;
    const rawType = v?.source?.type;
    if (rawType === "npm") {
      out.push({ version, publishTimestampMs, sourceType: "npm" });
    } else if (rawType === "git") {
      out.push({
        version,
        publishTimestampMs,
        sourceType: "git",
        gitUrl: typeof v?.source?.url === "string" ? v.source.url : void 0,
        gitCommit: typeof v?.source?.commit === "string" ? v.source.commit.toLowerCase() : void 0,
        gitPath: typeof v?.source?.path === "string" ? v.source.path.replace(/^\/+|\/+$/g, "") : void 0
      });
    } else {
      out.push({ version, publishTimestampMs, sourceType: "other" });
    }
  }
  return out;
}
function parseMarketIndexPayload(raw) {
  if (!raw || raw.format !== 1 || !Array.isArray(raw.plugins)) {
    throw new Error("Invalid format-1 market index payload");
  }
  const map = /* @__PURE__ */ new Map();
  for (const plugin of raw.plugins) {
    const pkgName = readPackageName(plugin?.name);
    if (!pkgName) continue;
    const parsedVersions = parseMarketPluginVersions(plugin);
    if (parsedVersions.length > 0) {
      map.set(pkgName, parsedVersions);
    }
  }
  return map;
}
async function fetchCachedMarketIndexByUrl(url) {
  const normalized = url.trim();
  const cached = marketIndexCache.get(normalized);
  if (cached && Date.now() - cached.fetchedAt < MARKET_CACHE_TTL_MS) {
    return cached.plugins;
  }
  const existing = inFlightMarketIndex.get(normalized);
  if (existing) return existing;
  const task = (async () => {
    const raw = await fetchJson(normalized, MARKET_FETCH_TIMEOUT_MS);
    const plugins = parseMarketIndexPayload(raw);
    marketIndexCache.set(normalized, { fetchedAt: Date.now(), plugins });
    return plugins;
  })().finally(() => {
    if (inFlightMarketIndex.get(normalized) === task) {
      inFlightMarketIndex.delete(normalized);
    }
  });
  inFlightMarketIndex.set(normalized, task);
  return task;
}
async function loadDefaultCommunityMarketIndex() {
  if (defaultMarketCache && Date.now() - defaultMarketCache.fetchedAt < MARKET_CACHE_TTL_MS) {
    return defaultMarketCache.plugins;
  }
  if (inFlightDefaultMarket) return inFlightDefaultMarket;
  const task = (async () => {
    const controller = new AbortController();
    try {
      const parsed = await Promise.any(
        DEFAULT_MARKET_INDEX_URLS.map(async (url) => {
          const raw = await fetchJson(url, MARKET_FETCH_TIMEOUT_MS, controller.signal);
          return parseMarketIndexPayload(raw);
        })
      );
      defaultMarketCache = { fetchedAt: Date.now(), plugins: parsed };
      return parsed;
    } finally {
      controller.abort();
    }
  })().finally(() => {
    if (inFlightDefaultMarket === task) {
      inFlightDefaultMarket = null;
    }
  });
  inFlightDefaultMarket = task;
  return task;
}
async function getReviewedVersionsForPackage(ctx, packageName) {
  const market = getService(ctx, ["pluginMarket", "plugin-market"]);
  let indexUrls = [];
  if (market && typeof market.listIndexes === "function") {
    try {
      const summaries = market.listIndexes();
      if (Array.isArray(summaries)) {
        indexUrls = summaries.map((item) => typeof item?.url === "string" ? item.url.trim() : "").filter(Boolean);
      }
    } catch {
      indexUrls = [];
    }
  }
  if (indexUrls.length > 0) {
    const merged = [];
    let anySucceeded = false;
    await Promise.all(
      indexUrls.map(async (url) => {
        if (typeof market?.entry === "function") {
          try {
            const entry = await market.entry(url, packageName);
            anySucceeded = true;
            if (entry) merged.push(...parseMarketPluginVersions(entry));
            return;
          } catch {
          }
        }
        try {
          const map = await fetchCachedMarketIndexByUrl(url);
          anySucceeded = true;
          const entries = map.get(packageName);
          if (entries) merged.push(...entries);
        } catch {
        }
      })
    );
    return { available: anySucceeded, versions: merged };
  }
  try {
    const map = await loadDefaultCommunityMarketIndex();
    return { available: true, versions: map.get(packageName) ?? [] };
  } catch {
    return { available: false, versions: [] };
  }
}
async function fetchNpmPackument(packageName, registry) {
  const data = await fetchJson(
    `${registry}${encodePackageName(packageName)}`,
    CHECK_TIMEOUT_MS,
    void 0,
    "application/json"
  );
  const versions = data?.versions && typeof data.versions === "object" ? data.versions : {};
  const distTags = data?.["dist-tags"] && typeof data["dist-tags"] === "object" ? data["dist-tags"] : {};
  const time = data?.time && typeof data.time === "object" ? data.time : {};
  if (Object.keys(versions).length === 0 && typeof distTags.latest !== "string") {
    throw new RemoteError(ERROR_CODES.offline, "\u66F4\u65B0\u6E90\u672A\u8FD4\u56DE\u6709\u6548\u7684\u7248\u672C\u5217\u8868");
  }
  return { versions, distTags, time };
}
function inspectNpmVersionPolicy(packument, version, reviewedVersions, reviewAvailable) {
  const versionObj = packument.versions[version];
  const exists = Boolean(versionObj && typeof versionObj === "object");
  const deprecated = Boolean(versionObj?.deprecated);
  const timeIso = packument.time?.[version];
  const timeMs = typeof timeIso === "string" ? Date.parse(timeIso) : NaN;
  const reviewedEntry = reviewAvailable ? reviewedVersions.find((rv) => rv.version === version && rv.sourceType === "npm") : void 0;
  const effectiveTimeMs = Number.isFinite(timeMs) ? timeMs : reviewedEntry?.publishTimestampMs;
  const isFreshRelease = typeof effectiveTimeMs === "number" && Number.isFinite(effectiveTimeMs) ? Date.now() - effectiveTimeMs < RELEASE_COOLING_WINDOW_MS : true;
  const isUnreviewed = !reviewedEntry;
  return { exists, deprecated, isFreshRelease, isUnreviewed };
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
      version: data.version.trim()
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
function findMatchingReviewedGitVersions(review, github) {
  if (!review.available) return [];
  const expectedRepo = `${github.owner}/${github.repo}`.toLowerCase();
  const expectedPath = (github.subpath || "").replace(/^\/+|\/+$/g, "");
  return review.versions.filter((rv) => {
    if (rv.sourceType !== "git" || !rv.gitCommit || !/^[0-9a-f]{40}$/i.test(rv.gitCommit)) return false;
    const parsedRepo = parseGithubSource(rv.gitUrl);
    if (!parsedRepo) return false;
    const rvRepo = `${parsedRepo.owner}/${parsedRepo.repo}`.toLowerCase();
    const rvPath = (rv.gitPath || "").replace(/^\/+|\/+$/g, "");
    return rvRepo === expectedRepo && rvPath === expectedPath;
  }).sort((a, b) => compareSemver(b.version, a.version));
}
async function evaluatePackageCandidate(ctx, packageName, currentVersion, profileDir, settings, hostBundleSource) {
  const origin = resolvePackageOrigin(profileDir, packageName, hostBundleSource);
  const registry = resolveRegistryUrl(settings.registry);
  if (origin.isGithub && origin.github) {
    const github = origin.github;
    const review2 = await getReviewedVersionsForPackage(ctx, packageName);
    if (!github.ref) {
      const reviewedGit = findMatchingReviewedGitVersions(review2, github);
      let blockedByFresh2 = false;
      for (const rv of reviewedGit) {
        if (compareSemver(rv.version, currentVersion) <= 0) continue;
        const isFreshRelease = typeof rv.publishTimestampMs === "number" && Number.isFinite(rv.publishTimestampMs) ? Date.now() - rv.publishTimestampMs < RELEASE_COOLING_WINDOW_MS : false;
        if (isFreshRelease && !settings.allowFreshRelease) {
          blockedByFresh2 = true;
          continue;
        }
        return {
          info: {
            version: rv.version,
            hasUpdate: true,
            registry,
            isGithub: true,
            isFreshRelease,
            isUnreviewed: false,
            reviewedGitCommit: rv.gitCommit
          },
          origin,
          registry
        };
      }
      if (!settings.allowUnreviewed) {
        if (!review2.available) {
          throw new RemoteError(ERROR_CODES.offline, "\u65E0\u6CD5\u83B7\u53D6\u63D2\u4EF6\u5B89\u5168\u5BA1\u6838\u7D22\u5F15");
        }
        return {
          info: {
            version: currentVersion || "0.0.0",
            hasUpdate: false,
            registry,
            isGithub: true,
            isFreshRelease: false,
            isUnreviewed: false,
            ...blockedByFresh2 ? { blockedReason: "freshReleaseBlocked" } : {}
          },
          origin,
          registry
        };
      }
    } else if (!settings.allowUnreviewed) {
      if (!review2.available) {
        throw new RemoteError(ERROR_CODES.offline, "\u65E0\u6CD5\u83B7\u53D6\u63D2\u4EF6\u5B89\u5168\u5BA1\u6838\u7D22\u5F15");
      }
      return {
        info: {
          version: currentVersion || "0.0.0",
          hasUpdate: false,
          registry,
          isGithub: true,
          isFreshRelease: false,
          isUnreviewed: true,
          blockedReason: "unreviewedBlocked"
        },
        origin,
        registry
      };
    }
    const remote = await fetchGithubPackageJson(github);
    const cleanLatest = remote.version.trim().replace(/^[v^~]/, "");
    return {
      info: {
        version: cleanLatest,
        hasUpdate: compareSemver(cleanLatest, currentVersion) > 0,
        registry,
        isGithub: true,
        isFreshRelease: false,
        isUnreviewed: true
      },
      origin,
      registry
    };
  }
  const [packument, review] = await Promise.all([
    fetchNpmPackument(packageName, registry),
    getReviewedVersionsForPackage(ctx, packageName)
  ]);
  if (!settings.allowUnreviewed && !review.available) {
    throw new RemoteError(ERROR_CODES.offline, "\u65E0\u6CD5\u83B7\u53D6\u63D2\u4EF6\u5B89\u5168\u5BA1\u6838\u7D22\u5F15");
  }
  const rawLatest = typeof packument.distTags?.latest === "string" ? packument.distTags.latest.trim() : "";
  const latestTag = rawLatest ? rawLatest.replace(/^[v^~]/, "") : "";
  const latestParsed = latestTag ? parseSemver(latestTag) : null;
  const capAtLatest = Boolean(latestTag && latestParsed && latestParsed.prerelease.length === 0);
  const currentParsed = parseSemver(currentVersion);
  const currentIsPrerelease = Boolean(currentParsed && currentParsed.prerelease.length > 0);
  const candidates = [];
  for (const rawVer of Object.keys(packument.versions)) {
    const parsed = parseSemver(rawVer);
    if (!parsed) continue;
    const vObj = packument.versions[rawVer];
    if (!vObj || typeof vObj !== "object" || vObj.deprecated) continue;
    if (compareSemver(rawVer, currentVersion) <= 0) continue;
    if (parsed.prerelease.length > 0 && !(rawVer === latestTag && currentIsPrerelease)) continue;
    if (capAtLatest && rawVer !== latestTag && compareSemver(rawVer, latestTag) > 0) continue;
    candidates.push(rawVer);
  }
  candidates.sort((a, b) => compareSemver(b, a));
  let blockedByUnreviewed = false;
  let blockedByFresh = false;
  for (const candidateVer of candidates) {
    const policy = inspectNpmVersionPolicy(packument, candidateVer, review.versions, review.available);
    if (policy.isUnreviewed && !settings.allowUnreviewed) {
      blockedByUnreviewed = true;
      continue;
    }
    if (policy.isFreshRelease && !settings.allowFreshRelease) {
      blockedByFresh = true;
      continue;
    }
    return {
      info: {
        version: candidateVer,
        hasUpdate: true,
        registry,
        isGithub: false,
        isFreshRelease: policy.isFreshRelease,
        isUnreviewed: policy.isUnreviewed
      },
      origin,
      registry
    };
  }
  const blockedReason = blockedByFresh ? "freshReleaseBlocked" : blockedByUnreviewed ? "unreviewedBlocked" : void 0;
  return {
    info: {
      version: currentVersion || "0.0.0",
      hasUpdate: false,
      registry,
      isGithub: false,
      isFreshRelease: false,
      isUnreviewed: false,
      ...blockedReason ? { blockedReason } : {}
    },
    origin,
    registry
  };
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
    ELECTRON_RUN_AS_NODE: "1",
    GIT_TERMINAL_PROMPT: "0",
    npm_config_update_notifier: "false",
    pnpm_config_update_notifier: "false",
    npm_config_fund: "false",
    npm_config_audit: "false"
  };
  for (const key of ALLOWED_CHILD_ENV_KEYS) {
    const val = process.env[key];
    if (typeof val === "string") env[key] = val;
  }
  if (registry) env.npm_config_registry = registry;
  return env;
}
function formatWorkspaceExcludeScalar(entry) {
  if (/^[A-Za-z0-9][A-Za-z0-9@._/| -]*$/.test(entry) && !entry.includes(" #")) {
    return entry;
  }
  return `"${entry.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}
function unquoteWorkspaceExcludeScalar(raw) {
  const trimmed = raw.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  if (trimmed.length >= 2 && trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1).replace(/''/g, "'");
  }
  return trimmed.replace(/\s+#.*$/, "").trim();
}
function matchWorkspaceExcludeEntry(entry, packageName) {
  if (entry === packageName) return { exactAll: true };
  if (entry.startsWith(`${packageName}@`)) {
    const rawVers = entry.slice(packageName.length + 1).trim();
    const versions = rawVers.split(/\s*\|\|\s*/).map((v) => v.trim()).filter(Boolean);
    return { exactAll: false, versions };
  }
  return null;
}
function applyMinimumReleaseAgeExemptionYaml(existingContent, packageName, targetVersion) {
  const eol = existingContent?.includes("\r\n") ? "\r\n" : "\n";
  const newScalar = formatWorkspaceExcludeScalar(`${packageName}@${targetVersion}`);
  if (!existingContent || !existingContent.trim()) {
    return [`packages:`, `  - .`, ``, `minimumReleaseAgeExclude:`, `  - ${newScalar}`, ``].join(eol);
  }
  const lines = existingContent.split(/\r?\n/);
  const keyLineIdx = lines.findIndex((line) => /^minimumReleaseAgeExclude\s*:/.test(line));
  if (keyLineIdx === -1) {
    while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
      lines.pop();
    }
    lines.push("minimumReleaseAgeExclude:", `  - ${newScalar}`, "");
    return lines.join(eol);
  }
  const keyMatch = lines[keyLineIdx].match(/^minimumReleaseAgeExclude\s*:(.*)$/);
  const inlineRaw = (keyMatch?.[1] || "").replace(/\s+#.*$/, "").trim();
  if (inlineRaw.startsWith("[") && inlineRaw.endsWith("]")) {
    const inner = inlineRaw.slice(1, -1).trim();
    const existingItems = inner ? inner.split(",").map((s) => unquoteWorkspaceExcludeScalar(s)).filter(Boolean) : [];
    let matched = false;
    const nextItems = [];
    for (const item of existingItems) {
      const m = matchWorkspaceExcludeEntry(item, packageName);
      if (!m) {
        nextItems.push(item);
        continue;
      }
      matched = true;
      if (m.exactAll || m.versions && m.versions.includes(targetVersion)) {
        return existingContent;
      }
      nextItems.push(`${packageName}@${[...m.versions || [], targetVersion].join(" || ")}`);
    }
    if (!matched) nextItems.push(`${packageName}@${targetVersion}`);
    lines.splice(keyLineIdx, 1, "minimumReleaseAgeExclude:", ...nextItems.map((it) => `  - ${formatWorkspaceExcludeScalar(it)}`));
    return lines.join(eol);
  }
  const listItems = [];
  let blockEndIdx = keyLineIdx;
  for (let i = keyLineIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^[^\s#-]/.test(line)) break;
    const itemMatch = line.match(/^(\s*)-\s+(.*)$/);
    if (itemMatch) {
      listItems.push({
        index: i,
        indent: itemMatch[1] || "  ",
        entry: unquoteWorkspaceExcludeScalar(itemMatch[2])
      });
      blockEndIdx = i;
    }
  }
  for (const item of listItems) {
    const m = matchWorkspaceExcludeEntry(item.entry, packageName);
    if (!m) continue;
    if (m.exactAll || m.versions && m.versions.includes(targetVersion)) {
      return existingContent;
    }
    const merged = formatWorkspaceExcludeScalar(`${packageName}@${[...m.versions || [], targetVersion].join(" || ")}`);
    lines[item.index] = `${item.indent}- ${merged}`;
    return lines.join(eol);
  }
  const indent = listItems[0]?.indent || "  ";
  lines.splice(blockEndIdx + 1, 0, `${indent}- ${newScalar}`);
  return lines.join(eol);
}
function writeTargetedReleaseAgeExemption(profileDir, packageName, targetVersion) {
  const workspacePath = join(profileDir, "pnpm-workspace.yaml");
  const existing = existsSync(workspacePath) ? readFileSync(workspacePath, "utf8") : null;
  const next = applyMinimumReleaseAgeExemptionYaml(existing, packageName, targetVersion);
  if (next !== existing) {
    writeFileAtomicSync(workspacePath, next);
  }
}
function buildInstallCommand(profileName, spec, registry) {
  if (!PROFILE_NAME_PATTERN.test(profileName)) {
    return { error: "profile \u540D\u79F0\u4E0D\u5408\u6CD5" };
  }
  if (!spec || spec.startsWith("-")) {
    return { error: "\u5B89\u88C5\u89C4\u683C\u4E0D\u5408\u6CD5" };
  }
  const env = createChildEnv(registry);
  const extraArgs = ["--config.update-notifier=false"];
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
      args: ["--expose-internals", pnpmJs, "add", spec, "--ignore-scripts", `--registry=${registry}`, ...extraArgs],
      env
    };
  }
  return { error: "\u627E\u4E0D\u5230 DSH CLI \u6216 pnpm\uFF0C\u65E0\u6CD5\u6267\u884C\u5B89\u88C5" };
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
  return new Promise((resolvePromise) => {
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
      resolvePromise({ ok, output, error, timedOut });
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
function spawnInstall(profileDir, profileName, spec, registry) {
  const plan = buildInstallCommand(profileName, spec, registry);
  if ("error" in plan) return Promise.resolve({ ok: false, output: "", error: plan.error, timedOut: false });
  return spawnCommand(plan.command, plan.args, profileDir, plan.env, INSTALL_TIMEOUT_MS);
}
function isSupplyChainPolicyFailure(output) {
  return /ERR_PNPM_NO_MATURE_MATCHING_VERSION|ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION|minimumReleaseAge/i.test(
    output || ""
  );
}
async function installWithPolicyFallback(profileDir, profileName, packageName, targetVersion, isGithub, spec, registry, allowFreshRelease, preExempt) {
  if (!isGithub && allowFreshRelease && preExempt) {
    writeTargetedReleaseAgeExemption(profileDir, packageName, targetVersion);
  }
  const attempt = await spawnInstall(profileDir, profileName, spec, registry);
  if (!attempt.ok && !attempt.timedOut && isSupplyChainPolicyFailure(attempt.output) && !isGithub && allowFreshRelease && !preExempt) {
    writeTargetedReleaseAgeExemption(profileDir, packageName, targetVersion);
    return spawnInstall(profileDir, profileName, spec, registry);
  }
  return attempt;
}
function captureSnapshot(profileDir) {
  const manifestPath = join(profileDir, "package.json");
  const lockfilePath = join(profileDir, "pnpm-lock.yaml");
  const workspacePath = join(profileDir, "pnpm-workspace.yaml");
  return {
    manifest: existsSync(manifestPath) ? readFileSync(manifestPath, "utf8") : null,
    lockfile: existsSync(lockfilePath) ? readFileSync(lockfilePath, "utf8") : null,
    workspace: existsSync(workspacePath) ? readFileSync(workspacePath, "utf8") : null
  };
}
function restoreSnapshot(profileDir, snapshot) {
  try {
    if (snapshot.manifest !== null) writeFileAtomicSync(join(profileDir, "package.json"), snapshot.manifest);
    if (snapshot.lockfile !== null) writeFileAtomicSync(join(profileDir, "pnpm-lock.yaml"), snapshot.lockfile);
    const workspacePath = join(profileDir, "pnpm-workspace.yaml");
    if (snapshot.workspace !== null) {
      writeFileAtomicSync(workspacePath, snapshot.workspace);
    } else if (existsSync(workspacePath)) {
      rmSync(workspacePath, { force: true });
    }
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
      "--config.update-notifier=false"
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
function buildGithubInstallSpec(github, commitOverride) {
  if (commitOverride) {
    const fragmentParts2 = [commitOverride.toLowerCase()];
    if (github.subpath) fragmentParts2.push(`path:${github.subpath}`);
    return `git+https://github.com/${github.owner}/${github.repo}.git#${fragmentParts2.join("&")}`;
  }
  const fragmentParts = [];
  if (github.ref) fragmentParts.push(github.ref);
  if (github.subpath) fragmentParts.push(`path:${github.subpath}`);
  const fragment = fragmentParts.length > 0 ? `#${fragmentParts.join("&")}` : "";
  return `github:${github.owner}/${github.repo}${fragment}`;
}
async function runInstallWithFallback(profileDir, profileName, packageName, targetVersion, isGithub, spec, settings, preExempt) {
  let registryUsed = resolveRegistryUrl(settings.registry);
  let fellBack = false;
  let attempt = await installWithPolicyFallback(
    profileDir,
    profileName,
    packageName,
    targetVersion,
    isGithub,
    spec,
    registryUsed,
    settings.allowFreshRelease,
    preExempt
  );
  if (!attempt.ok && !attempt.timedOut && !isSupplyChainPolicyFailure(attempt.output) && settings.fallbackToOfficial && normalizeRegistryUrl(registryUsed) !== OFFICIAL_REGISTRY) {
    fellBack = true;
    registryUsed = OFFICIAL_REGISTRY;
    attempt = await installWithPolicyFallback(
      profileDir,
      profileName,
      packageName,
      targetVersion,
      isGithub,
      spec,
      registryUsed,
      settings.allowFreshRelease,
      preExempt
    );
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
async function performUpdate(ctx, config, profile, params, refresh) {
  const { packageName } = params;
  const { dir: profileDir, profileName } = profile;
  const settings = readSettings(config);
  const origin = resolvePackageOrigin(profileDir, packageName, params.hostBundleSource);
  const currentVersion = readInstalledVersion(profileDir, packageName) || "0.0.0";
  const registryUsed = resolveRegistryUrl(settings.registry);
  let targetVersion = params.targetVersion;
  let spec = "";
  let preExempt = false;
  if (origin.isGithub && origin.github) {
    const github = origin.github;
    const review = await getReviewedVersionsForPackage(ctx, packageName);
    let matchedCommit;
    if (!github.ref) {
      const reviewedGit = findMatchingReviewedGitVersions(review, github);
      const chosen = targetVersion ? reviewedGit.find((rv) => rv.version === targetVersion) : reviewedGit.find((rv) => compareSemver(rv.version, currentVersion) > 0);
      if (chosen) {
        const isFreshRelease = typeof chosen.publishTimestampMs === "number" && Number.isFinite(chosen.publishTimestampMs) ? Date.now() - chosen.publishTimestampMs < RELEASE_COOLING_WINDOW_MS : false;
        if (isFreshRelease && !settings.allowFreshRelease) {
          return {
            ok: false,
            packageName,
            targetVersion: chosen.version,
            source: origin.declaredSpec,
            error: "\u8BE5\u7248\u672C\u672A\u6EE1 24 \u5C0F\u65F6\u5B89\u5168\u89C2\u5BDF\u671F\uFF0C\u8BF7\u5148\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u5F00\u542F\u5BF9\u5E94\u6743\u9650",
            errorCode: ERROR_CODES.freshReleaseBlocked
          };
        }
        targetVersion = chosen.version;
        matchedCommit = chosen.gitCommit;
      }
    }
    if (matchedCommit) {
      spec = buildGithubInstallSpec(github, matchedCommit);
    } else {
      if (!settings.allowUnreviewed) {
        if (!review.available) {
          throw new RemoteError(ERROR_CODES.offline, "\u65E0\u6CD5\u83B7\u53D6\u63D2\u4EF6\u5B89\u5168\u5BA1\u6838\u7D22\u5F15");
        }
        return {
          ok: false,
          packageName,
          targetVersion,
          source: origin.declaredSpec,
          error: "\u8BE5\u7248\u672C\u6216\u6765\u6E90\u672A\u7ECF\u5E02\u573A\u5B89\u5168\u5BA1\u6838\uFF0C\u8BF7\u5148\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u5F00\u542F\u5BF9\u5E94\u6743\u9650",
          errorCode: ERROR_CODES.unreviewedBlocked
        };
      }
      if (!targetVersion) {
        const remote = await fetchGithubPackageJson(github);
        targetVersion = remote.version;
      }
      spec = buildGithubInstallSpec(github);
    }
  } else if (targetVersion) {
    let packument;
    let review;
    try {
      [packument, review] = await Promise.all([
        fetchNpmPackument(packageName, registryUsed),
        getReviewedVersionsForPackage(ctx, packageName)
      ]);
    } catch (error) {
      if (settings.fallbackToOfficial && normalizeRegistryUrl(registryUsed) !== OFFICIAL_REGISTRY) {
        [packument, review] = await Promise.all([
          fetchNpmPackument(packageName, OFFICIAL_REGISTRY),
          getReviewedVersionsForPackage(ctx, packageName)
        ]);
      } else {
        throw error;
      }
    }
    if (!packument.versions?.[targetVersion] && settings.fallbackToOfficial && normalizeRegistryUrl(registryUsed) !== OFFICIAL_REGISTRY) {
      try {
        const officialPack = await fetchNpmPackument(packageName, OFFICIAL_REGISTRY);
        if (officialPack.versions?.[targetVersion]) packument = officialPack;
      } catch {
      }
    }
    if (!settings.allowUnreviewed && !review.available) {
      throw new RemoteError(ERROR_CODES.offline, "\u65E0\u6CD5\u83B7\u53D6\u63D2\u4EF6\u5B89\u5168\u5BA1\u6838\u7D22\u5F15");
    }
    const policy = inspectNpmVersionPolicy(packument, targetVersion, review.versions, review.available);
    if (!policy.exists) {
      return {
        ok: false,
        packageName,
        targetVersion,
        source: origin.declaredSpec,
        error: `\u66F4\u65B0\u6E90\u4E2D\u4E0D\u5B58\u5728\u7248\u672C v${targetVersion}`,
        errorCode: ERROR_CODES.invalidTargetVersion
      };
    }
    if (policy.isUnreviewed && !settings.allowUnreviewed) {
      return {
        ok: false,
        packageName,
        targetVersion,
        source: origin.declaredSpec,
        error: "\u8BE5\u7248\u672C\u6216\u6765\u6E90\u672A\u7ECF\u5E02\u573A\u5B89\u5168\u5BA1\u6838\uFF0C\u8BF7\u5148\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u5F00\u542F\u5BF9\u5E94\u6743\u9650",
        errorCode: ERROR_CODES.unreviewedBlocked
      };
    }
    if (policy.isFreshRelease && !settings.allowFreshRelease) {
      return {
        ok: false,
        packageName,
        targetVersion,
        source: origin.declaredSpec,
        error: "\u8BE5\u7248\u672C\u672A\u6EE1 24 \u5C0F\u65F6\u5B89\u5168\u89C2\u5BDF\u671F\uFF0C\u8BF7\u5148\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u5F00\u542F\u5BF9\u5E94\u6743\u9650",
        errorCode: ERROR_CODES.freshReleaseBlocked
      };
    }
    preExempt = policy.isFreshRelease;
    spec = `${packageName}@${targetVersion}`;
  } else {
    const evaluated = await evaluatePackageCandidate(
      ctx,
      packageName,
      currentVersion,
      profileDir,
      settings,
      params.hostBundleSource
    );
    if (!evaluated.info.hasUpdate) {
      if (evaluated.info.blockedReason === "freshReleaseBlocked") {
        return {
          ok: false,
          packageName,
          source: origin.declaredSpec,
          error: "\u8BE5\u7248\u672C\u672A\u6EE1 24 \u5C0F\u65F6\u5B89\u5168\u89C2\u5BDF\u671F\uFF0C\u8BF7\u5148\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u5F00\u542F\u5BF9\u5E94\u6743\u9650",
          errorCode: ERROR_CODES.freshReleaseBlocked
        };
      }
      if (evaluated.info.blockedReason === "unreviewedBlocked") {
        return {
          ok: false,
          packageName,
          source: origin.declaredSpec,
          error: "\u8BE5\u7248\u672C\u6216\u6765\u6E90\u672A\u7ECF\u5E02\u573A\u5B89\u5168\u5BA1\u6838\uFF0C\u8BF7\u5148\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u5F00\u542F\u5BF9\u5E94\u6743\u9650",
          errorCode: ERROR_CODES.unreviewedBlocked
        };
      }
      return {
        ok: false,
        packageName,
        source: origin.declaredSpec,
        error: "\u65E0\u6CD5\u786E\u5B9A\u7B26\u5408\u5B89\u5168\u7B56\u7565\u7684\u65B0\u7248\u672C",
        errorCode: ERROR_CODES.invalidTargetVersion
      };
    }
    targetVersion = evaluated.info.version;
    preExempt = evaluated.info.isFreshRelease;
    spec = `${packageName}@${targetVersion}`;
  }
  if (!targetVersion) {
    return { ok: false, packageName, error: "\u65E0\u6CD5\u786E\u5B9A\u76EE\u6807\u7248\u672C", errorCode: ERROR_CODES.invalidTargetVersion };
  }
  const snapshot = captureSnapshot(profileDir);
  const { attempt } = await runInstallWithFallback(
    profileDir,
    profileName,
    packageName,
    targetVersion,
    origin.isGithub,
    spec,
    settings,
    preExempt
  );
  if (!attempt.ok) {
    const policyBlocked = isSupplyChainPolicyFailure(attempt.output);
    const rollback = await rollbackAfterFailure(profileDir, packageName, currentVersion, snapshot, false);
    if (policyBlocked && !settings.allowFreshRelease) {
      return {
        ok: false,
        packageName,
        targetVersion,
        source: origin.declaredSpec,
        rollback,
        error: "\u8BE5\u7248\u672C\u672A\u6EE1 24 \u5C0F\u65F6\u5B89\u5168\u89C2\u5BDF\u671F\uFF0C\u8BF7\u5148\u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u5F00\u542F\u5BF9\u5E94\u6743\u9650",
        errorCode: ERROR_CODES.freshReleaseBlocked
      };
    }
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
  clearConflictInState(profileDir, packageName);
  await triggerPackageRefresh(packageName, refresh);
  return {
    ok: true,
    packageName,
    targetVersion: installedVersion,
    source: origin.declaredSpec,
    rollback: "not-needed"
  };
}
function jsonResponse(data, status = 200) {
  return Response.json(data, { status, headers: { "cache-control": "no-store" } });
}
function errorResponse(payload, errorCode, error, status = 200) {
  return jsonResponse({ ...payload, ok: false, error, errorCode }, status);
}
function verifyUpdaterRequest(req) {
  const headerVal = req.headers.get(UPDATER_REQUEST_HEADER);
  const contentType = (req.headers.get("content-type") || "").toLowerCase();
  if (headerVal !== "1" || !contentType.includes("application/json")) {
    return errorResponse({}, ERROR_CODES.forbidden, "\u8BF7\u6C42\u5B89\u5168\u6821\u9A8C\u672A\u901A\u8FC7", 403);
  }
  return null;
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
  let disposed = false;
  const cleanupTimers = [];
  ctx.effect?.(() => () => {
    disposed = true;
    for (const t of cleanupTimers) clearTimeout(t);
    cleanupTimers.length = 0;
  }, "dsh-plugins-update: lifecycle cleanup");
  const refreshAfterInstall = async () => {
    let reconciled = false;
    try {
      const hmr = getService(ctx, ["hmr"]);
      if (hmr?.runExclusive && typeof hmr.reconcileProfile === "function") {
        await hmr.runExclusive(() => hmr.reconcileProfile([]));
        reconciled = true;
      }
    } catch {
    }
    if (!reconciled) {
      try {
        const packages = getService(ctx, ["pluginPackages"]);
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
  const selfDisablingPackages = /* @__PURE__ */ new Set();
  let inFlightCheckAll = null;
  let scanRunning = false;
  let rescanDebounceTimer;
  const disableConflictingPlugin = async (profileDir, packageName, pluginVersion, hostVersion, reason) => {
    const conflict = {
      pluginVersion: pluginVersion || "0.0.0",
      ...hostVersion ? { hostVersion } : {},
      ...reason ? { reason } : {}
    };
    if (isOfficialPackageName(packageName) || packageName === PLUGIN_NAME) {
      return { disabled: false, conflict };
    }
    const state = loadGuardState(profileDir);
    state.conflicts[packageName] = conflict;
    saveGuardState(profileDir, state);
    inFlightCheckAll = null;
    let disabledViaManager = false;
    selfDisablingPackages.add(packageName);
    try {
      const manager = getService(ctx, ["pluginManager", "plugin-manager"]);
      if (typeof manager?.setBundleEnabled === "function") {
        await Promise.race([
          manager.setBundleEnabled(packageName, false),
          new Promise((_, reject) => setTimeout(() => reject(new Error("setBundleEnabled timeout")), 15e3))
        ]);
        disabledViaManager = true;
      }
    } catch {
      disabledViaManager = false;
    } finally {
      selfDisablingPackages.delete(packageName);
    }
    const stillActiveInManifest = readActiveBundlesFromManifest(profileDir).includes(packageName);
    let disabledOnDisk = false;
    if (stillActiveInManifest) {
      disabledOnDisk = disableBundleOnDisk(profileDir, packageName);
      if (disabledOnDisk) {
        await refreshAfterInstall();
      }
    }
    return { disabled: disabledViaManager || disabledOnDisk || !stillActiveInManifest, conflict };
  };
  const getLoaderEntries = () => {
    const loader = getService(ctx, ["loader"]);
    if (typeof loader?.entries !== "function") return [];
    try {
      return [...loader.entries()];
    } catch {
      return [];
    }
  };
  const reconcileAllConflicts = async (checkEnabledConflicts) => {
    const installed = await listInstalledThirdPartyPackages(ctx);
    const loaderEntries = checkEnabledConflicts ? getLoaderEntries() : [];
    const currentHostVersion = detectHostVersion(ctx);
    const byProfile = /* @__PURE__ */ new Map();
    for (const item of installed) {
      const list = byProfile.get(item.dir) ?? [];
      list.push(item);
      byProfile.set(item.dir, list);
    }
    const activeConflicts = {};
    const primaryDir = resolveProfileDir().dir;
    if (!byProfile.has(primaryDir)) byProfile.set(primaryDir, []);
    for (const [profileDir, items] of byProfile.entries()) {
      const state = loadGuardState(profileDir);
      const itemMap = new Map(items.map((i) => [i.packageName, i]));
      let dirty = false;
      if (currentHostVersion && state.lastHostVersion !== currentHostVersion && checkEnabledConflicts) {
        state.lastHostVersion = currentHostVersion;
        dirty = true;
      }
      for (const [pkgName, info] of Object.entries(state.conflicts)) {
        const item = itemMap.get(pkgName);
        if (!item) {
          delete state.conflicts[pkgName];
          dirty = true;
          continue;
        }
        if (parseSemver(item.currentVersion) && parseSemver(info.pluginVersion) && compareSemver(item.currentVersion, info.pluginVersion) > 0) {
          delete state.conflicts[pkgName];
          dirty = true;
          continue;
        }
        if (item.enabled && checkEnabledConflicts) {
          const reason = detectPluginConflict(profileDir, pkgName, item.bundle, loaderEntries);
          if (!reason) {
            delete state.conflicts[pkgName];
            dirty = true;
          }
        }
      }
      if (dirty) {
        saveGuardState(profileDir, state);
      }
      if (checkEnabledConflicts) {
        for (const item of items) {
          if (item.packageName === PLUGIN_NAME || !item.enabled) continue;
          const reason = detectPluginConflict(profileDir, item.packageName, item.bundle, loaderEntries);
          if (!reason) continue;
          await disableConflictingPlugin(
            profileDir,
            item.packageName,
            item.currentVersion,
            currentHostVersion,
            reason
          );
        }
      }
      const finalState = loadGuardState(profileDir);
      for (const [pkgName, info] of Object.entries(finalState.conflicts)) {
        activeConflicts[pkgName] = info;
      }
    }
    return activeConflicts;
  };
  let needCrashLoopRefresh = false;
  try {
    const primaryProfile = resolveProfileDir();
    const hostVersion = detectHostVersion(ctx);
    if (hostVersion && existsSync(join(primaryProfile.dir, "package.json"))) {
      const state = loadGuardState(primaryProfile.dir);
      const now = Date.now();
      let nextCount = 0;
      if (state.bootStreak && state.bootStreak.hostVersion === hostVersion && now - state.bootStreak.timestamp < CRASH_LOOP_WINDOW_MS) {
        nextCount = state.bootStreak.count + 1;
      } else if (state.lastHostVersion !== hostVersion) {
        nextCount = 1;
      }
      if (nextCount >= CRASH_LOOP_THRESHOLD) {
        const active = readActiveBundlesFromManifest(primaryProfile.dir);
        for (const pkgName of active) {
          if (isOfficialPackageName(pkgName) || pkgName === PLUGIN_NAME) continue;
          if (disableBundleOnDisk(primaryProfile.dir, pkgName)) {
            needCrashLoopRefresh = true;
          }
          const ver = readInstalledVersion(primaryProfile.dir, pkgName) || "0.0.0";
          state.conflicts[pkgName] = {
            pluginVersion: ver,
            hostVersion,
            reason: "DSH \u5347\u7EA7\u540E\u8FDE\u7EED\u542F\u52A8\u5F02\u5E38\u9000\u51FA\uFF0C\u5DF2\u81EA\u52A8\u505C\u7528\u4EE5\u6062\u590D\u542F\u52A8"
          };
        }
        state.bootStreak = void 0;
        state.lastHostVersion = hostVersion;
        saveGuardState(primaryProfile.dir, state);
      } else if (nextCount > 0) {
        state.bootStreak = { hostVersion, count: nextCount, timestamp: now };
        saveGuardState(primaryProfile.dir, state);
        const clearTimer = setTimeout(() => {
          if (disposed) return;
          const latest = loadGuardState(primaryProfile.dir);
          latest.bootStreak = void 0;
          latest.lastHostVersion = hostVersion;
          saveGuardState(primaryProfile.dir, latest);
        }, CRASH_LOOP_CLEAR_MS);
        clearTimer.unref?.();
        cleanupTimers.push(clearTimer);
      }
    }
  } catch {
  }
  const runStartupConflictScan = async () => {
    if (disposed || scanRunning) return;
    scanRunning = true;
    try {
      const loader = getService(ctx, ["loader"]);
      if (typeof loader?.await === "function") {
        await Promise.race([
          loader.await(),
          new Promise((resolvePromise) => setTimeout(resolvePromise, 5e3))
        ]);
      }
      await new Promise((resolvePromise) => {
        const settleTimer = setTimeout(resolvePromise, 250);
        settleTimer.unref?.();
        cleanupTimers.push(settleTimer);
      });
      if (disposed) return;
      if (needCrashLoopRefresh) {
        needCrashLoopRefresh = false;
        await refreshAfterInstall();
      }
      await reconcileAllConflicts(true);
    } catch {
    } finally {
      scanRunning = false;
    }
  };
  const startupScanPromise = runStartupConflictScan();
  ctx.on?.("plugin-manager/changed", () => {
    inFlightCheckAll = null;
    if (disposed || selfDisablingPackages.size > 0) return;
    if (rescanDebounceTimer) clearTimeout(rescanDebounceTimer);
    rescanDebounceTimer = setTimeout(() => {
      rescanDebounceTimer = void 0;
      void runStartupConflictScan();
    }, 500);
    rescanDebounceTimer.unref?.();
    cleanupTimers.push(rescanDebounceTimer);
  });
  let routesRegistered = false;
  const registerRoutes = (conn, scopeCtx = ctx) => {
    if (routesRegistered || disposed) return;
    const registerFetch = conn?.fetch?.register?.bind(conn.fetch);
    if (typeof registerFetch !== "function") return;
    routesRegistered = true;
    scopeCtx.effect?.(() => () => {
      routesRegistered = false;
    }, "dsh-plugins-update: routes registration state");
    ctx.effect(
      () => registerFetch({
        path: CHECK_PATH,
        methods: ["POST"],
        requestBody: "buffered",
        fetch: async (req) => {
          const rejected = verifyUpdaterRequest(req);
          if (rejected) return rejected;
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
            const { info, origin, registry } = await evaluatePackageCandidate(
              ctx,
              packageName,
              currentVersion,
              dir,
              settings,
              bundle?.source
            );
            const state = loadGuardState(dir);
            let conflict = state.conflicts[packageName];
            if (conflict && parseSemver(currentVersion) && parseSemver(conflict.pluginVersion) && compareSemver(currentVersion, conflict.pluginVersion) > 0) {
              clearConflictInState(dir, packageName);
              conflict = void 0;
            }
            const result = {
              ok: true,
              packageName,
              currentVersion,
              latestVersion: info.version,
              hasUpdate: info.hasUpdate,
              source: origin.declaredSpec,
              isGithub: info.isGithub,
              isFreshRelease: info.isFreshRelease,
              isUnreviewed: info.isUnreviewed,
              registry: safeRegistryUrl(registry),
              alwaysShowDetailButton: settings.alwaysShowDetailButton,
              allowFreshRelease: settings.allowFreshRelease,
              allowUnreviewed: settings.allowUnreviewed,
              ...conflict ? { conflict } : {}
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
          const rejected = verifyUpdaterRequest(req);
          if (rejected) return rejected;
          try {
            const body = await parseJsonBody(req);
            const force = body?.force === true;
            const reconcile = body?.reconcile === true;
            const runBatch = async () => {
              await Promise.race([
                startupScanPromise,
                new Promise((resolvePromise) => setTimeout(resolvePromise, 4e3))
              ]);
              const conflicts2 = await reconcileAllConflicts(reconcile);
              const installed = await listInstalledThirdPartyPackages(ctx);
              const settings2 = readSettings(config);
              const updatable2 = {};
              const concurrency = 4;
              let cursor = 0;
              const workers = Array.from({ length: Math.min(concurrency, installed.length) }, async () => {
                while (cursor < installed.length) {
                  const current = installed[cursor++];
                  if (!current) break;
                  try {
                    const { info } = await evaluatePackageCandidate(
                      ctx,
                      current.packageName,
                      current.currentVersion,
                      current.dir,
                      settings2,
                      current.bundle?.source
                    );
                    if (info.hasUpdate && compareSemver(info.version, current.currentVersion) > 0) {
                      updatable2[current.packageName] = info.version;
                    }
                  } catch {
                  }
                }
              });
              await Promise.all(workers);
              return { updatable: updatable2, conflicts: conflicts2 };
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
            const { updatable, conflicts } = await task;
            const settings = readSettings(config);
            const result = {
              ok: true,
              updatable,
              conflicts,
              hostVersion: detectHostVersion(ctx),
              registry: safeRegistryUrl(resolveRegistryUrl(settings.registry)),
              alwaysShowDetailButton: settings.alwaysShowDetailButton,
              allowFreshRelease: settings.allowFreshRelease,
              allowUnreviewed: settings.allowUnreviewed
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
        path: UPDATE_PATH,
        methods: ["POST"],
        requestBody: "buffered",
        fetch: async (req) => {
          const rejected = verifyUpdaterRequest(req);
          if (rejected) return rejected;
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
                ctx,
                config,
                profile,
                {
                  packageName,
                  targetVersion,
                  hostBundleSource: bundle?.source
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
        path: REPORT_CONFLICT_PATH,
        methods: ["POST"],
        requestBody: "buffered",
        fetch: async (req) => {
          const rejected = verifyUpdaterRequest(req);
          if (rejected) return rejected;
          let packageName = "";
          try {
            const body = await parseJsonBody(req);
            packageName = readPackageName(body?.packageName) ?? "";
            if (!packageName) {
              return errorResponse(
                { packageName: "" },
                ERROR_CODES.invalidPackageName,
                "packageName \u5FC5\u987B\u662F\u5408\u6CD5\u7684 npm \u5305\u540D",
                400
              );
            }
            if (isOfficialPackageName(packageName) || packageName === PLUGIN_NAME) {
              return errorResponse({ packageName }, ERROR_CODES.officialPlugin, "\u4E0D\u5141\u8BB8\u81EA\u52A8\u505C\u7528\u5B98\u65B9\u63D2\u4EF6\u6216\u66F4\u65B0\u5668\u81EA\u8EAB");
            }
            const bundle = await readBundleInfo(ctx, packageName);
            const blocked = bundleGuardError(packageName, bundle);
            if (blocked) return errorResponse({ packageName }, blocked.errorCode, blocked.error);
            const profile = resolveProfileDir(packageName);
            if (!existsSync(join(profile.dir, "package.json"))) {
              return errorResponse({ packageName }, ERROR_CODES.profileNotFound, "\u627E\u4E0D\u5230\u53EF\u7528\u7684 DSH profile \u76EE\u5F55");
            }
            const currentVersion = readInstalledVersion(profile.dir, packageName) || "0.0.0";
            const hostVersion = detectHostVersion(ctx);
            const rawReason = typeof body?.reason === "string" && body.reason.trim() ? body.reason.trim() : "\u524D\u7AEF\u8FD0\u884C\u65F6\u89E6\u53D1\u5F02\u5E38";
            const reason = redactSecrets(rawReason).slice(0, 260);
            const { disabled, conflict } = await disableConflictingPlugin(
              profile.dir,
              packageName,
              currentVersion,
              hostVersion,
              reason
            );
            const result = {
              ok: true,
              packageName,
              disabled,
              conflict
            };
            return jsonResponse(result);
          } catch (error) {
            return errorResponse(
              { packageName },
              error instanceof RemoteError ? error.errorCode : ERROR_CODES.unknown,
              redactSecrets(error?.message || "\u8BB0\u5F55\u51B2\u7A81\u5931\u8D25")
            );
          }
        }
      }),
      "dsh-plugins-update: report-conflict route"
    );
  };
  const immediateConn = getService(ctx, ["connection"]);
  if (immediateConn) {
    registerRoutes(immediateConn, ctx);
  } else if (typeof ctx.inject === "function") {
    ctx.inject(["connection"], (connCtx) => {
      registerRoutes(connCtx?.get?.("connection") ?? connCtx?.connection, connCtx);
    });
  }
}
export {
  Config,
  apply,
  applyMinimumReleaseAgeExemptionYaml,
  inject,
  name,
  parseMarketIndexPayload
};
