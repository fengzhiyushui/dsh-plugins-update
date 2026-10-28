// src/index.ts
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import * as http from "node:http";
import * as https from "node:https";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import * as tls from "node:tls";
import Schema from "@deepseek-ai/schemastery";

// src/types.ts
var OFFICIAL_REGISTRY = "https://registry.npmjs.org/";
var DOMESTIC_REGISTRY = "https://registry.npmmirror.com/";
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
function registryLabel(url, customs = []) {
  const normalized = normalizeRegistryUrl(url) ?? url;
  if (normalized === OFFICIAL_REGISTRY) return "npm \u5B98\u65B9\u6E90";
  if (normalized === DOMESTIC_REGISTRY) return "\u56FD\u5185\u6E90 npmmirror\uFF08DSH \u540C\u6B3E\uFF09";
  const custom = customs.find((c) => normalizeRegistryUrl(c.url) === normalized);
  if (custom?.name) return `\u81EA\u5B9A\u4E49\u6E90\u300C${custom.name}\u300D`;
  try {
    return `\u81EA\u5B9A\u4E49\u6E90 ${new URL(normalized).host}`;
  } catch {
    return normalized;
  }
}

// src/index.ts
var name = "dsh-plugins-update";
var inject = ["connection"];
var OWN_PACKAGE_NAME = "dsh-plugins-update";
var PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;
var TARGET_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
var SHELL_SAFE_PATTERN = /^[A-Za-z0-9@._~:/\\+=,-]+$/;
var DEFAULT_INSTALL_TIMEOUT_SECONDS = 120;
var MIN_INSTALL_TIMEOUT_SECONDS = 30;
var MAX_INSTALL_TIMEOUT_SECONDS = 900;
var GITHUB_METADATA_TTL_MS = 10 * 60 * 1e3;
var HTTP_DEFAULT_TIMEOUT_MS = 6e3;
var HTTP_MAX_ATTEMPTS = 3;
var HTTP_MAX_REDIRECTS = 3;
var HTTP_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
var HTTP_ETAG_CACHE_LIMIT = 256;
var JOB_TTL_MS = 10 * 60 * 1e3;
var LOG_TAIL_LIMIT = 2e3;
var RESULT_OUTPUT_LIMIT = 8e3;
var INSTALL_OUTPUT_LIMIT = 64 * 1024;
var MAX_LOCK_VERSION_CHECKS = 25;
var REGISTRY_CHECK_CONCURRENCY = 8;
var USER_AGENT = "dsh-plugins-update";
var PHASE_MESSAGE_KEYS = {
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
var PHASE_RANK = {
  queued: 0,
  resolving: 1,
  downloading: 2,
  installing: 3,
  verifying: 4,
  "rolling-back": 5,
  done: 6,
  failed: 6,
  cancelled: 6
};
var TERMINAL_PHASES = /* @__PURE__ */ new Set(["done", "failed", "cancelled"]);
function readPackageName(value) {
  if (typeof value !== "string") return void 0;
  const packageName = value.trim();
  if (!packageName || packageName.length > 214 || !PACKAGE_NAME_PATTERN.test(packageName)) return void 0;
  return packageName;
}
function readTargetVersion(value) {
  if (value === void 0 || value === null || value === "") return void 0;
  if (typeof value !== "string") return null;
  const version = value.trim().replace(/^[v^~]/, "");
  if (!version) return void 0;
  return TARGET_VERSION_PATTERN.test(version) ? version : null;
}
function isOfficialPackageName(packageName) {
  return packageName.startsWith("@deepseek-ai/");
}
function live(schema) {
  const s = schema;
  return typeof s?.volatile === "function" ? s.volatile() : schema;
}
var Config = Schema.object({
  registry: live(
    Schema.string().default("auto").description(
      "\u66F4\u65B0\u6E90\uFF1Aauto\uFF08\u81EA\u52A8\uFF09/ npmjs\uFF08npm \u5B98\u65B9\u6E90\uFF09/ npmmirror\uFF08DSH \u540C\u6B3E\u56FD\u5185\u6E90\uFF09/ \u81EA\u5B9A\u4E49\u6E90 URL\uFF1BUpdate source: auto | npmjs | npmmirror | custom https URL"
    )
  ),
  customRegistries: live(
    Schema.array(
      Schema.object({
        name: Schema.string().default(""),
        url: Schema.string().default("")
      })
    ).default([]).description("\u7528\u6237\u81EA\u884C\u6DFB\u52A0\u7684\u66F4\u65B0\u6E90\u5217\u8868 / Custom update registries")
  ),
  fallbackToOfficial: live(
    Schema.boolean().default(true).description("\u4F7F\u7528\u975E\u5B98\u65B9\u6E90\u66F4\u65B0\u5931\u8D25\u65F6\uFF0C\u81EA\u52A8\u6539\u7528 npm \u5B98\u65B9\u6E90\u91CD\u8BD5\u4E00\u6B21 / Retry once on the official npm registry after a failure")
  ),
  installTimeoutSeconds: live(
    Schema.number().default(DEFAULT_INSTALL_TIMEOUT_SECONDS).description(
      `\u5B89\u88C5\u8D85\u65F6\uFF08\u79D2\uFF0C${MIN_INSTALL_TIMEOUT_SECONDS}-${MAX_INSTALL_TIMEOUT_SECONDS}\uFF09/ Install timeout (seconds, ${MIN_INSTALL_TIMEOUT_SECONDS}-${MAX_INSTALL_TIMEOUT_SECONDS})`
    )
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
  const registryRaw = readField(config?.registry, "auto");
  const customRaw = readField(config?.customRegistries, []);
  const fallback = readField(config?.fallbackToOfficial, true);
  const timeoutRaw = Number(readField(config?.installTimeoutSeconds, DEFAULT_INSTALL_TIMEOUT_SECONDS));
  const installTimeoutSeconds = Number.isFinite(timeoutRaw) ? Math.min(MAX_INSTALL_TIMEOUT_SECONDS, Math.max(MIN_INSTALL_TIMEOUT_SECONDS, Math.round(timeoutRaw))) : DEFAULT_INSTALL_TIMEOUT_SECONDS;
  const customRegistries = Array.isArray(customRaw) ? customRaw.map((item) => ({
    name: typeof item?.name === "string" ? item.name.trim() : "",
    url: normalizeRegistryUrl(item?.url) ?? ""
  })).filter((item) => item.url) : [];
  let registry = typeof registryRaw === "string" ? registryRaw.trim() : "auto";
  if (registry !== "auto" && registry !== "npmjs" && registry !== "npmmirror") {
    registry = normalizeRegistryUrl(registry) ?? "auto";
  }
  return { registry, customRegistries, fallbackToOfficial: fallback !== false, installTimeoutSeconds };
}
function parseSemver(input) {
  if (typeof input !== "string") return null;
  const cleaned = input.trim().replace(/^[=vV]+/, "");
  const withoutBuild = cleaned.split("+")[0];
  const match = withoutBuild.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: match[2] === void 0 ? 0 : Number(match[2]),
    patch: match[3] === void 0 ? 0 : Number(match[3]),
    prerelease: match[4] ? match[4].split(".") : []
  };
}
function isNumericIdentifier(value) {
  return /^\d+$/.test(value);
}
function comparePrerelease(left, right) {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;
  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const a = left[i];
    const b = right[i];
    if (a === void 0) return -1;
    if (b === void 0) return 1;
    const aNumeric = isNumericIdentifier(a);
    const bNumeric = isNumericIdentifier(b);
    if (aNumeric && bNumeric) {
      const diff = Number(a) - Number(b);
      if (diff !== 0) return diff > 0 ? 1 : -1;
      continue;
    }
    if (aNumeric) return -1;
    if (bNumeric) return 1;
    if (a !== b) return a > b ? 1 : -1;
  }
  return 0;
}
function compareTolerant(v1, v2) {
  const clean = (value) => String(value ?? "").trim().replace(/^[vV]+/, "");
  const left = clean(v1);
  const right = clean(v2);
  const leftNumbers = left.match(/\d+/g)?.map(Number) ?? [];
  const rightNumbers = right.match(/\d+/g)?.map(Number) ?? [];
  const length = Math.max(leftNumbers.length, rightNumbers.length);
  for (let i = 0; i < length; i += 1) {
    const a = leftNumbers[i];
    const b = rightNumbers[i];
    if (a === void 0) return -1;
    if (b === void 0) return 1;
    if (a !== b) return a > b ? 1 : -1;
  }
  if (left === right) return 0;
  return left > right ? 1 : -1;
}
function compareSemver(v1, v2) {
  const left = parseSemver(v1);
  const right = parseSemver(v2);
  if (left && right) {
    if (left.major !== right.major) return left.major > right.major ? 1 : -1;
    if (left.minor !== right.minor) return left.minor > right.minor ? 1 : -1;
    if (left.patch !== right.patch) return left.patch > right.patch ? 1 : -1;
    return comparePrerelease(left.prerelease, right.prerelease);
  }
  return compareTolerant(v1, v2);
}
function parseGithubSource(str) {
  if (typeof str !== "string") return null;
  const cleaned = str.trim().replace(/^git\+/, "").replace(/#.*$/, "").replace(/\.git$/i, "").replace(/\/+$/, "");
  if (!cleaned) return null;
  const match = cleaned.match(
    /(?:github:|^https?:\/\/github\.com\/|^git@github\.com:|^git:\/\/github\.com\/|^ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i
  );
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleaned)) {
    const parts = cleaned.split("/");
    return { owner: parts[0], repo: parts[1] };
  }
  return null;
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
function resolveProfileDir(packageName) {
  const candidates = profileCandidates();
  if (packageName) {
    const owner = candidates.find((candidate) => {
      const dependencies = readProfileDependencies(candidate.dir);
      return Object.prototype.hasOwnProperty.call(dependencies, packageName);
    });
    if (owner) return owner;
  }
  return candidates.find((candidate) => candidate.profileName === "desktop") ?? candidates[0];
}
async function readBundleInfo(ctx, packageName) {
  for (const service of ["pluginManager", "plugin-manager"]) {
    try {
      const manager = ctx?.get?.(service);
      if (typeof manager?.listBundles !== "function") continue;
      const bundles = await manager.listBundles();
      if (!Array.isArray(bundles)) continue;
      const bundle = bundles.find((item) => item && item.name === packageName);
      if (bundle) return bundle;
    } catch {
    }
  }
  return void 0;
}
function bundleGuardError(packageName, bundle) {
  if (bundle?.official === true) {
    return {
      error: "\u5B98\u65B9\u63D2\u4EF6\u7531 DSH \u81EA\u5E26\u7684\u66F4\u65B0\u5165\u53E3\u7BA1\u7406\uFF0C\u8BF7\u4F7F\u7528\u63D2\u4EF6\u9875\u53F3\u4E0A\u89D2\u7684\u300C\u66F4\u65B0\u300D\u6309\u94AE",
      errorCode: ERROR_CODES.officialPlugin
    };
  }
  if (bundle?.installed === false) {
    return {
      error: "\u8BE5\u63D2\u4EF6\u672A\u5B89\u88C5\u5230\u5F53\u524D profile\uFF0C\u65E0\u6CD5\u66F4\u65B0",
      errorCode: ERROR_CODES.notInstalled
    };
  }
  if (!bundle && isOfficialPackageName(packageName)) {
    return {
      error: "\u5B98\u65B9\u63D2\u4EF6\u7531 DSH \u81EA\u5E26\u7684\u66F4\u65B0\u5165\u53E3\u7BA1\u7406\uFF0C\u8BF7\u4F7F\u7528\u63D2\u4EF6\u9875\u53F3\u4E0A\u89D2\u7684\u300C\u66F4\u65B0\u300D\u6309\u94AE",
      errorCode: ERROR_CODES.officialPlugin
    };
  }
  return void 0;
}
function readInstalledVersion(profileDir, packageName) {
  const installedPkgJsonPath = join(profileDir, "node_modules", packageName, "package.json");
  if (existsSync(installedPkgJsonPath)) {
    try {
      const pkgJson = JSON.parse(readFileSync(installedPkgJsonPath, "utf8"));
      if (typeof pkgJson.version === "string" && pkgJson.version.trim()) {
        return pkgJson.version.trim();
      }
    } catch {
    }
  }
  return void 0;
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
function resolvePackageOrigin(profileDir, packageName, explicitSource) {
  let repoGithub;
  const installedPkgJsonPath = join(profileDir, "node_modules", packageName, "package.json");
  if (existsSync(installedPkgJsonPath)) {
    try {
      const pkgJson = JSON.parse(readFileSync(installedPkgJsonPath, "utf8"));
      const repoUrl = typeof pkgJson.repository === "string" ? pkgJson.repository : pkgJson.repository?.url;
      const parsedRepo = parseGithubSource(repoUrl);
      if (parsedRepo) repoGithub = parsedRepo;
    } catch {
    }
  }
  const explicitGithub = parseGithubSource(explicitSource);
  if (explicitGithub) {
    return { isGithub: true, github: explicitGithub, repoGithub: repoGithub || explicitGithub, declaredSpec: explicitSource };
  }
  const manifestPath = join(profileDir, "package.json");
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const spec = manifest?.dependencies?.[packageName] || manifest?.devDependencies?.[packageName] || manifest?.optionalDependencies?.[packageName];
      if (typeof spec === "string") {
        const github = parseGithubSource(spec);
        if (github) {
          return { isGithub: true, github, repoGithub: repoGithub || github, declaredSpec: spec };
        }
        return { isGithub: false, repoGithub, declaredSpec: spec };
      }
    } catch {
    }
  }
  return { isGithub: false, repoGithub };
}
function encodePackageName(packageName) {
  return encodeURIComponent(packageName).replace(/^%40/, "@");
}
var HttpError = class extends Error {
  status;
  headers;
  url;
  retryable;
  constructor(message, options = {}) {
    super(message);
    this.name = "HttpError";
    this.status = options.status;
    this.headers = options.headers;
    this.url = options.url;
    this.retryable = options.retryable === true;
  }
};
var RemoteError = class extends Error {
  errorCode;
  status;
  constructor(errorCode, message, status) {
    super(message);
    this.name = "RemoteError";
    this.errorCode = errorCode;
    this.status = status;
  }
};
var etagCache = /* @__PURE__ */ new Map();
var proxyAgentCache = /* @__PURE__ */ new Map();
function delay(ms) {
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}
function isNoProxyTarget(hostname, noProxyValue) {
  if (!noProxyValue) return false;
  const host = hostname.toLowerCase();
  for (const part of noProxyValue.split(",")) {
    const entry = part.trim().toLowerCase();
    if (!entry) continue;
    if (entry === "*") return true;
    const withoutPort = entry.includes(":") && !entry.startsWith("[") ? entry.slice(0, entry.lastIndexOf(":")) : entry;
    const domain = withoutPort.replace(/^\*\.?/, "").replace(/^\./, "");
    if (!domain) continue;
    if (host === domain || host.endsWith(`.${domain}`)) return true;
  }
  return false;
}
function proxyUrlFor(target) {
  const env = process.env;
  if (isNoProxyTarget(target.hostname, env.NO_PROXY || env.no_proxy)) return null;
  const raw = target.protocol === "https:" ? env.HTTPS_PROXY || env.https_proxy || env.ALL_PROXY || env.all_proxy : env.HTTP_PROXY || env.http_proxy || env.ALL_PROXY || env.all_proxy;
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return null;
  try {
    const proxy = new URL(value);
    if (proxy.protocol !== "http:" && proxy.protocol !== "https:") return null;
    return proxy;
  } catch {
    return null;
  }
}
var ProxyHttpsAgent = class extends https.Agent {
  proxyUrl;
  constructor(proxyUrl) {
    super({ keepAlive: false });
    this.proxyUrl = proxyUrl;
  }
  createConnection(options, callback) {
    const proxy = this.proxyUrl;
    const targetHost = String(options?.host ?? "");
    const targetPort = Number(options?.port) || 443;
    const proxyPort = proxy.port ? Number(proxy.port) : proxy.protocol === "https:" ? 443 : 80;
    const proxyModule = proxy.protocol === "https:" ? https : http;
    let settled = false;
    const finish = (error, stream) => {
      if (settled) return;
      settled = true;
      callback?.(error, stream);
    };
    let connectRequest;
    try {
      connectRequest = proxyModule.request({
        host: proxy.hostname,
        port: proxyPort,
        method: "CONNECT",
        path: `${targetHost}:${targetPort}`,
        headers: { host: `${targetHost}:${targetPort}` },
        timeout: 15e3
      });
    } catch (error) {
      finish(error instanceof Error ? error : new Error(String(error)));
      return void 0;
    }
    connectRequest.once("connect", (response, socket) => {
      if (response.statusCode !== 200) {
        try {
          socket.destroy();
        } catch {
        }
        finish(new Error(`Proxy CONNECT failed with HTTP ${response.statusCode}`));
        return;
      }
      const secureSocket = tls.connect({ socket, servername: targetHost }, () => finish(null, secureSocket));
      secureSocket.once("error", (error) => finish(error));
    });
    connectRequest.once("error", (error) => finish(error));
    connectRequest.once("timeout", () => connectRequest.destroy(new Error("Proxy connect timed out")));
    connectRequest.end();
    return void 0;
  }
};
function getProxyHttpsAgent(proxy) {
  const key = proxy.href;
  let agent = proxyAgentCache.get(key);
  if (!agent) {
    agent = new ProxyHttpsAgent(proxy);
    proxyAgentCache.set(key, agent);
  }
  return agent;
}
function rawRequest(target, headers, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;
    let watchdog;
    const finish = (action) => {
      if (settled) return;
      settled = true;
      if (watchdog) clearTimeout(watchdog);
      action();
    };
    const fail = (error) => finish(() => reject(error));
    const onResponse = (response) => {
      const chunks = [];
      let size = 0;
      response.on("data", (chunk) => {
        size += chunk.length;
        if (size > HTTP_MAX_RESPONSE_BYTES) {
          try {
            response.destroy();
          } catch {
          }
          fail(new Error("HTTP response body exceeded the size limit"));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => {
        finish(
          () => resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString("utf8"),
            fromCache: false
          })
        );
      });
      response.on("error", (error) => fail(error));
    };
    let request3;
    try {
      request3 = createRequest(target, headers, onResponse);
    } catch (error) {
      fail(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    watchdog = setTimeout(() => {
      request3.destroy(new Error(`HTTP request timed out after ${Math.round(timeoutMs / 1e3)}s`));
    }, timeoutMs);
    watchdog.unref?.();
    request3.once("error", (error) => fail(error));
    request3.end();
  });
}
function createRequest(target, headers, onResponse) {
  const proxy = proxyUrlFor(target);
  if (target.protocol === "https:") {
    return https.request(target, { method: "GET", headers, agent: proxy ? getProxyHttpsAgent(proxy) : void 0 }, onResponse);
  }
  if (proxy) {
    const proxyPort = proxy.port ? Number(proxy.port) : proxy.protocol === "https:" ? 443 : 80;
    const proxiedHeaders = { ...headers, host: target.host };
    const requestOptions = {
      host: proxy.hostname,
      port: proxyPort,
      method: "GET",
      path: target.href,
      headers: proxiedHeaders
    };
    return proxy.protocol === "https:" ? https.request(requestOptions, onResponse) : http.request(requestOptions, onResponse);
  }
  return http.request(target, { method: "GET", headers }, onResponse);
}
function isRetryableStatus(status) {
  return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}
function isRetryableNetworkError(error) {
  if (error instanceof HttpError) return error.retryable;
  const message = String(error?.message ?? "");
  if (/certificate|CERT_|self-signed/i.test(message)) return false;
  const code = typeof error?.code === "string" ? error.code : "";
  if ([
    "ECONNRESET",
    "ECONNREFUSED",
    "ETIMEDOUT",
    "EAI_AGAIN",
    "EPIPE",
    "ENOTFOUND",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_BODY_TIMEOUT"
  ].includes(code)) {
    return true;
  }
  return /socket hang up|timed out|timeout/i.test(message);
}
function readRetryAfterMs(headers) {
  if (!headers) return void 0;
  const raw = headers["retry-after"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return void 0;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(3e3, Math.round(seconds * 1e3));
  return void 0;
}
function isGithubRateLimited(headers) {
  if (!headers) return false;
  const raw = headers["x-ratelimit-remaining"];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "0";
}
async function httpGetFollowingRedirects(target, options, depth) {
  const cacheKey = target.href;
  const cached = options.etagCache && !options.noCache ? etagCache.get(cacheKey) : void 0;
  const headers = {
    "user-agent": USER_AGENT,
    accept: "application/json",
    ...options.headers ?? {}
  };
  if (cached?.etag) headers["if-none-match"] = cached.etag;
  const response = await rawRequest(target, headers, options.timeoutMs ?? HTTP_DEFAULT_TIMEOUT_MS);
  if (response.status === 304 && cached) {
    cached.at = Date.now();
    return { status: 200, headers: cached.headers, body: cached.body, fromCache: true };
  }
  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.location;
    if (location && depth < HTTP_MAX_REDIRECTS) {
      let next;
      try {
        next = new URL(location, target);
      } catch {
        throw new HttpError("Invalid redirect location", { status: response.status, retryable: false });
      }
      if (next.protocol !== "http:" && next.protocol !== "https:") {
        throw new HttpError("Unsupported redirect protocol", { status: response.status, retryable: false });
      }
      return httpGetFollowingRedirects(next, options, depth + 1);
    }
  }
  if (response.status < 200 || response.status >= 300) {
    throw new HttpError(`HTTP ${response.status} from ${target.host}${target.pathname}`, {
      status: response.status,
      headers: response.headers,
      url: target.href,
      retryable: isRetryableStatus(response.status)
    });
  }
  if (options.etagCache) {
    const etag = response.headers.etag;
    if (typeof etag === "string" && etag) {
      if (etagCache.size >= HTTP_ETAG_CACHE_LIMIT) {
        const oldest = etagCache.keys().next().value;
        if (oldest) etagCache.delete(oldest);
      }
      etagCache.set(cacheKey, { etag, body: response.body, headers: response.headers, at: Date.now() });
    }
  }
  return { ...response, fromCache: false };
}
async function httpGet(rawUrl, options = {}) {
  const maxAttempts = Math.max(1, options.maxAttempts ?? HTTP_MAX_ATTEMPTS);
  let lastError;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await httpGetFollowingRedirects(new URL(rawUrl), options, 0);
    } catch (error) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryableNetworkError(error)) break;
      const retryAfter = error instanceof HttpError ? readRetryAfterMs(error.headers) : void 0;
      await delay(retryAfter ?? 250 * attempt + Math.floor(Math.random() * 150));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("HTTP request failed");
}
async function httpGetJson(rawUrl, options = {}) {
  const response = await httpGet(rawUrl, options);
  try {
    return JSON.parse(response.body);
  } catch {
    let host = "remote server";
    try {
      host = new URL(rawUrl).host;
    } catch {
    }
    throw new HttpError(`Response from ${host} is not valid JSON`, { retryable: false });
  }
}
function githubToken() {
  const token = (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || "").trim();
  return token || void 0;
}
function githubApiHeaders() {
  const headers = {
    accept: "application/vnd.github+json",
    "x-github-api-version": "2022-11-28"
  };
  const token = githubToken();
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}
function redactSecrets(input) {
  let text = String(input ?? "");
  const token = githubToken();
  if (token && token.length >= 6) text = text.split(token).join("***");
  text = text.replace(/x-access-token:[^@\s/]+@/gi, "x-access-token:***@");
  text = text.replace(/(https?:\/\/)[^@\s/]+@github\.com/gi, "$1***@github.com");
  return text;
}
function githubRemoteError(error, owner, repo) {
  if (error instanceof RemoteError) return error;
  if (error instanceof HttpError) {
    const status = error.status;
    if (status === 429 || status === 403 && isGithubRateLimited(error.headers)) {
      return new RemoteError(
        ERROR_CODES.rateLimited,
        `GitHub API \u8BF7\u6C42\u6B21\u6570\u53D7\u9650\uFF08${owner}/${repo}\uFF09\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\uFF1B\u8BBE\u7F6E GITHUB_TOKEN \u53EF\u63D0\u5347\u989D\u5EA6`,
        status
      );
    }
    if (status === 401 || status === 403 || status === 404) {
      return new RemoteError(
        ERROR_CODES.githubAuth,
        `\u65E0\u6CD5\u8BBF\u95EE GitHub \u4ED3\u5E93 ${owner}/${repo}\uFF1A\u4ED3\u5E93\u53EF\u80FD\u4E0D\u5B58\u5728\u6216\u4E3A\u79C1\u6709\u4ED3\u5E93\uFF1B\u79C1\u6709\u4ED3\u5E93\u8BF7\u8BBE\u7F6E GITHUB_TOKEN \u6216 GH_TOKEN \u540E\u91CD\u8BD5`,
        status
      );
    }
    return new RemoteError(ERROR_CODES.offline, `\u8BBF\u95EE GitHub \u5931\u8D25\uFF1A${redactSecrets(error.message)}`, status);
  }
  return new RemoteError(ERROR_CODES.offline, `\u8BBF\u95EE GitHub \u5931\u8D25\uFF1A${redactSecrets(error?.message || "\u7F51\u7EDC\u9519\u8BEF")}`);
}
function npmRemoteError(error, registry) {
  if (error instanceof RemoteError) return error;
  if (error instanceof HttpError) {
    const status = error.status;
    if (status === 429) {
      return new RemoteError(ERROR_CODES.rateLimited, `\u66F4\u65B0\u6E90 ${registry} \u8BF7\u6C42\u53D7\u9650\uFF08429\uFF09\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5`, status);
    }
    if (status === 401 || status === 403) {
      return new RemoteError(ERROR_CODES.offline, `\u66F4\u65B0\u6E90 ${registry} \u62D2\u7EDD\u8BBF\u95EE\uFF08HTTP ${status}\uFF09`, status);
    }
    if (status === 404) {
      return new RemoteError(ERROR_CODES.unknown, `\u66F4\u65B0\u6E90 ${registry} \u4E0A\u627E\u4E0D\u5230\u8BE5\u5305\u6216\u7248\u672C\uFF08HTTP 404\uFF09`, status);
    }
    return new RemoteError(ERROR_CODES.unknown, `\u66F4\u65B0\u6E90 ${registry} \u8FD4\u56DE HTTP ${status}`, status);
  }
  return new RemoteError(ERROR_CODES.offline, `\u65E0\u6CD5\u8BBF\u95EE\u66F4\u65B0\u6E90 ${registry}\uFF1A${redactSecrets(error?.message || "\u7F51\u7EDC\u9519\u8BEF")}`);
}
function classifyAggregateError(errors) {
  for (const error of errors) {
    if (error instanceof RemoteError) return error.errorCode;
  }
  for (const error of errors) {
    if (error instanceof HttpError) {
      if (error.status === 429) return ERROR_CODES.rateLimited;
      if (error.status === 401 || error.status === 403) return ERROR_CODES.githubAuth;
    }
    if (isRetryableNetworkError(error)) return ERROR_CODES.offline;
  }
  return ERROR_CODES.unknown;
}
var GITHUB_API_BASE = "https://api.github.com";
var githubRepoCache = /* @__PURE__ */ new Map();
var githubRepoInflight = /* @__PURE__ */ new Map();
var githubPackageJsonCache = /* @__PURE__ */ new Map();
function githubRepoKey(owner, repo) {
  return `${owner}/${repo}`.toLowerCase();
}
async function fetchGithubRepoMetadata(owner, repo) {
  const apiHeaders = githubApiHeaders();
  let repoData;
  try {
    repoData = await httpGetJson(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers: apiHeaders,
      etagCache: true,
      timeoutMs: 8e3
    });
  } catch (error) {
    throw githubRemoteError(error, owner, repo);
  }
  const defaultBranch = typeof repoData?.default_branch === "string" && repoData.default_branch ? repoData.default_branch : "main";
  let headCommit;
  try {
    const commits = await httpGetJson(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(defaultBranch)}&per_page=1`,
      { headers: apiHeaders, etagCache: true, timeoutMs: 8e3 }
    );
    if (Array.isArray(commits) && typeof commits[0]?.sha === "string") headCommit = commits[0].sha;
  } catch {
  }
  let tags = [];
  try {
    const rawTags = await httpGetJson(`${GITHUB_API_BASE}/repos/${owner}/${repo}/tags?per_page=100`, {
      headers: apiHeaders,
      etagCache: true,
      timeoutMs: 8e3
    });
    if (Array.isArray(rawTags)) {
      tags = rawTags.filter((tag) => typeof tag?.name === "string" && typeof tag?.commit?.sha === "string").map((tag) => ({ name: tag.name, commit: tag.commit.sha }));
    }
  } catch {
  }
  return {
    owner,
    repo,
    defaultBranch,
    headCommit,
    tags,
    isPrivate: repoData?.private === true,
    description: typeof repoData?.description === "string" ? repoData.description : void 0,
    fetchedAt: Date.now()
  };
}
async function getGithubRepoMetadata(owner, repo, options = {}) {
  const key = githubRepoKey(owner, repo);
  if (!options.noCache) {
    const cached = githubRepoCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < GITHUB_METADATA_TTL_MS) return cached;
    const inflight = githubRepoInflight.get(key);
    if (inflight) return inflight;
  }
  const task = fetchGithubRepoMetadata(owner, repo).then((metadata) => {
    githubRepoCache.set(key, metadata);
    return metadata;
  }).finally(() => {
    if (githubRepoInflight.get(key) === task) githubRepoInflight.delete(key);
  });
  githubRepoInflight.set(key, task);
  return task;
}
function findGithubTag(metadata, version) {
  if (!metadata || !version) return void 0;
  const clean = version.trim().replace(/^[vV]/, "");
  const candidates = /* @__PURE__ */ new Set([`v${clean}`, clean, version.trim()]);
  return metadata.tags.find((tag) => candidates.has(tag.name));
}
async function resolveGithubTagCommit(owner, repo, tag) {
  if (!tag) return void 0;
  try {
    const ref = await httpGetJson(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/tags/${encodeURIComponent(tag)}`, {
      headers: githubApiHeaders(),
      timeoutMs: 6e3,
      maxAttempts: 2
    });
    const object = ref?.object;
    if (!object || typeof object.sha !== "string") return void 0;
    if (object.type === "commit") return object.sha.toLowerCase();
    if (object.type === "tag") {
      const annotated = await httpGetJson(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/tags/${object.sha}`, {
        headers: githubApiHeaders(),
        timeoutMs: 6e3,
        maxAttempts: 2
      });
      const target = annotated?.object;
      if (target && typeof target.sha === "string" && target.type === "commit") return target.sha.toLowerCase();
    }
    return void 0;
  } catch {
    return void 0;
  }
}
function encodeGithubRef(ref) {
  return ref.split("/").map((segment) => encodeURIComponent(segment)).join("/");
}
function parseGithubPackageJson(data, source) {
  if (!data || typeof data.version !== "string" || !data.version.trim()) {
    throw new Error(`${source} returned no package version`);
  }
  return {
    version: data.version.trim(),
    description: typeof data.description === "string" ? data.description : void 0
  };
}
async function loadGithubApiPackageJson(owner, repo, ref) {
  const data = await httpGetJson(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/package.json?ref=${encodeURIComponent(ref)}`,
    { headers: githubApiHeaders(), timeoutMs: 8e3, maxAttempts: 2 }
  );
  if (data && typeof data.content === "string" && data.encoding === "base64") {
    const text = Buffer.from(data.content, "base64").toString("utf8");
    return parseGithubPackageJson(JSON.parse(text), "GitHub API");
  }
  throw new Error("GitHub API returned an unexpected package.json payload");
}
async function readGithubPackageJson(owner, repo, ref, options = {}) {
  const cacheKey = `${owner}/${repo}@${ref}`.toLowerCase();
  if (!options.noCache) {
    const cached = githubPackageJsonCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < GITHUB_METADATA_TTL_MS) return cached.info;
  }
  const encodedRef = encodeGithubRef(ref);
  const errors = [];
  const load = async (source, url, headers, timeoutMs) => {
    try {
      const data = await httpGetJson(url, { headers, timeoutMs, maxAttempts: 2 });
      return parseGithubPackageJson(data, source);
    } catch (error) {
      errors.push(error);
      throw error;
    }
  };
  const attempts = [
    load("jsDelivr", `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${encodedRef}/package.json`, {}, 4e3),
    load("jsDelivr (fastly)", `https://fastly.jsdelivr.net/gh/${owner}/${repo}@${encodedRef}/package.json`, {}, 4e3),
    load(
      "raw.githubusercontent.com",
      `https://raw.githubusercontent.com/${owner}/${repo}/${encodedRef}/package.json`,
      {},
      5e3
    )
  ];
  if (githubToken()) {
    attempts.push(
      (async () => {
        try {
          return await loadGithubApiPackageJson(owner, repo, ref);
        } catch (error) {
          errors.push(error);
          throw error;
        }
      })()
    );
  }
  let info;
  try {
    info = await Promise.any(attempts);
  } catch {
    const detail = errors.length > 0 ? redactSecrets(errors[errors.length - 1]?.message || "") : "";
    throw new RemoteError(
      ERROR_CODES.offline,
      `\u65E0\u6CD5\u8BFB\u53D6 GitHub \u4ED3\u5E93 ${owner}/${repo} \u7684 package.json${detail ? `\uFF08${detail}\uFF09` : ""}`
    );
  }
  githubPackageJsonCache.set(cacheKey, { fetchedAt: Date.now(), info });
  if (githubPackageJsonCache.size > 64) {
    const oldest = githubPackageJsonCache.keys().next().value;
    if (oldest) githubPackageJsonCache.delete(oldest);
  }
  return info;
}
async function readGithubPackageJsonAnyBranch(owner, repo, branches) {
  const results = await Promise.allSettled(
    branches.map(async (branch) => ({ branch, info: await readGithubPackageJson(owner, repo, branch) }))
  );
  for (const result of results) {
    if (result.status === "fulfilled") return result.value;
  }
  throw new RemoteError(ERROR_CODES.offline, `\u65E0\u6CD5\u8BFB\u53D6 GitHub \u4ED3\u5E93 ${owner}/${repo} \u7684 package.json`);
}
function readTextFile(path) {
  try {
    return existsSync(path) ? readFileSync(path, "utf8") : null;
  } catch {
    return null;
  }
}
function readLockfileText(profileDir) {
  return readTextFile(join(profileDir, "pnpm-lock.yaml"));
}
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function extractGithubCommit(lockText, owner, repo) {
  if (!lockText || !owner || !repo) return void 0;
  const ownerPattern = escapeRegExp(owner);
  const repoPattern = escapeRegExp(repo);
  const patterns = [
    new RegExp(`codeload\\.github\\.com/${ownerPattern}/${repoPattern}/tar\\.gz/([0-9a-f]{7,40})`, "i"),
    new RegExp(`github\\.com/${ownerPattern}/${repoPattern}/(?:archive|tarball|tar\\.gz)/([0-9a-f]{7,40})`, "i")
  ];
  for (const pattern of patterns) {
    const match = lockText.match(pattern);
    if (match) return match[1].toLowerCase();
  }
  return void 0;
}
function parseLockedPackageVersions(lockText) {
  const entries = [];
  const seen = /* @__PURE__ */ new Set();
  let section = "";
  for (const line of lockText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;
    if (indent === 0) {
      section = trimmed.replace(/^['"]/, "").replace(/['"]$/, "").replace(/:$/, "").trim();
      continue;
    }
    if (section !== "packages" && section !== "snapshots") continue;
    if (indent !== 2) continue;
    let key = trimmed;
    if (key.startsWith("'") && key.endsWith("':")) key = key.slice(1, -2);
    else if (key.startsWith('"') && key.endsWith('":')) key = key.slice(1, -2);
    else if (key.endsWith(":")) key = key.slice(0, -1);
    key = key.trim().replace(/^\/+/, "");
    const atIndex = key.indexOf("@", 1);
    if (atIndex <= 0) continue;
    const packageName = key.slice(0, atIndex);
    let version = key.slice(atIndex + 1);
    const peerIndex = version.indexOf("(");
    if (peerIndex >= 0) version = version.slice(0, peerIndex);
    version = version.trim();
    if (!PACKAGE_NAME_PATTERN.test(packageName)) continue;
    if (!/^\d/.test(version)) continue;
    if (version.includes("/") || version.includes(":") || version.includes(" ")) continue;
    const id = `${packageName}@${version}`;
    if (seen.has(id)) continue;
    seen.add(id);
    entries.push({ name: packageName, version });
  }
  return entries;
}
function readManifestSpec(profileDir, packageName) {
  const manifestPath = join(profileDir, "package.json");
  if (!existsSync(manifestPath)) return void 0;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const spec = manifest?.dependencies?.[packageName] ?? manifest?.devDependencies?.[packageName] ?? manifest?.optionalDependencies?.[packageName];
    return typeof spec === "string" ? spec : void 0;
  } catch {
    return void 0;
  }
}
function captureProfileSnapshot(profileDir, packageName) {
  const packageJsonPath = join(profileDir, "package.json");
  const lockfilePath = join(profileDir, "pnpm-lock.yaml");
  return {
    packageJsonPath,
    lockfilePath,
    packageJson: readTextFile(packageJsonPath),
    lockfile: readTextFile(lockfilePath),
    previousVersion: readInstalledVersion(profileDir, packageName),
    previousSpec: readManifestSpec(profileDir, packageName)
  };
}
function restoreFile(path, content) {
  if (content === null) {
    if (existsSync(path)) unlinkSync(path);
    return;
  }
  writeFileSync(path, content, "utf8");
}
function buildRollbackSpec(snapshot, packageName, origin) {
  if (origin.isGithub && origin.github) {
    const previousCommit = extractGithubCommit(snapshot.lockfile, origin.github.owner, origin.github.repo);
    if (previousCommit) return `github:${origin.github.owner}/${origin.github.repo}#${previousCommit}`;
    const declared = parseGithubSource(snapshot.previousSpec);
    if (declared) {
      const refMatch = (snapshot.previousSpec || "").match(/#([^#\s]+)$/);
      return refMatch ? `github:${declared.owner}/${declared.repo}#${refMatch[1]}` : `github:${declared.owner}/${declared.repo}`;
    }
    return `github:${origin.github.owner}/${origin.github.repo}`;
  }
  const spec = snapshot.previousSpec;
  if (spec && /^(?:npm:|file:|link:|workspace:|portal:|patch:|https?:|git)/i.test(spec)) return spec;
  if (snapshot.previousVersion) return `${packageName}@${snapshot.previousVersion}`;
  if (spec) return `${packageName}@${spec}`;
  return void 0;
}
function checkRegistries(settings) {
  switch (settings.registry) {
    case "auto":
      return [DOMESTIC_REGISTRY, OFFICIAL_REGISTRY];
    case "npmjs":
      return [OFFICIAL_REGISTRY];
    case "npmmirror":
      return [DOMESTIC_REGISTRY];
    default:
      return [settings.registry];
  }
}
async function fetchLatestFrom(registry, packageName) {
  const data = await httpGetJson(`${registry}${encodePackageName(packageName)}/latest`, {
    headers: { accept: "application/json" },
    timeoutMs: 6e3
  });
  if (!data || typeof data.version !== "string") {
    throw new RemoteError(ERROR_CODES.unknown, `\u66F4\u65B0\u6E90 ${registry} \u672A\u8FD4\u56DE\u7248\u672C\u53F7`);
  }
  return {
    version: data.version,
    releaseDate: data.time?.[data.version] ?? void 0,
    description: typeof data.description === "string" ? data.description : void 0,
    registry
  };
}
async function fetchNpmPackageInfo(packageName, settings) {
  const registries = checkRegistries(settings);
  const errors = [];
  const fetchAll = (targets) => Promise.allSettled(
    targets.map(async (registry) => {
      try {
        return await fetchLatestFrom(registry, packageName);
      } catch (error) {
        errors.push(npmRemoteError(error, registry));
        throw error;
      }
    })
  );
  const pickHighest = (results) => {
    let best2;
    for (const result of results) {
      if (result.status !== "fulfilled") continue;
      if (!best2 || compareSemver(result.value.version, best2.version) > 0) best2 = result.value;
    }
    return best2;
  };
  let best = pickHighest(await fetchAll(registries));
  if (!best && settings.fallbackToOfficial && !registries.includes(OFFICIAL_REGISTRY)) {
    best = pickHighest(await fetchAll([OFFICIAL_REGISTRY]));
  }
  if (best) return best;
  const firstRemote = errors.find((error) => error instanceof RemoteError);
  throw firstRemote ?? new RemoteError(ERROR_CODES.offline, `\u65E0\u6CD5\u83B7\u53D6 ${packageName} \u7684\u8FDC\u7AEF\u7248\u672C\u4FE1\u606F`);
}
async function pingRegistry(registry, timeoutMs) {
  await httpGet(`${registry}-/ping`, { timeoutMs, maxAttempts: 1 });
  return registry;
}
async function probeFastestRegistry() {
  try {
    return await Promise.any([pingRegistry(OFFICIAL_REGISTRY, 1500), pingRegistry(DOMESTIC_REGISTRY, 1500)]);
  } catch {
    return null;
  }
}
async function versionExists(registry, packageName, version) {
  try {
    await httpGet(`${registry}${encodePackageName(packageName)}/${encodeURIComponent(version)}`, {
      headers: { accept: "application/json" },
      timeoutMs: 5e3,
      maxAttempts: 1
    });
    return true;
  } catch {
    return false;
  }
}
function isRegistrySpec(spec) {
  const value = spec.trim();
  if (!value) return false;
  if (/^(?:github:|gitlab:|bitbucket:|git[+:]|git@|https?:|file:|link:|workspace:|npm:|portal:|patch:)/i.test(value)) return false;
  if (parseGithubSource(value)) return false;
  return true;
}
async function mapWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let cursor = 0;
  const runnerCount = Math.max(1, Math.min(limit, items.length));
  const runners = [];
  for (let i = 0; i < runnerCount; i += 1) {
    runners.push(
      (async () => {
        while (cursor < items.length) {
          const index = cursor;
          cursor += 1;
          results[index] = await worker(items[index], index);
        }
      })()
    );
  }
  await Promise.all(runners);
  return results;
}
async function collectRequiredVersions(profileDir, packageName, targetVersion, targetIsGithub) {
  const required = [];
  const seen = /* @__PURE__ */ new Set();
  const add = (name2, version) => {
    if (!name2 || !version) return;
    const id = `${name2}@${version}`;
    if (seen.has(id)) return;
    seen.add(id);
    required.push({ name: name2, version });
  };
  if (!targetIsGithub && targetVersion) add(packageName, targetVersion);
  const lockText = readLockfileText(profileDir);
  if (lockText) {
    for (const entry of parseLockedPackageVersions(lockText)) {
      if (entry.name === packageName) continue;
      add(entry.name, entry.version);
      if (required.length >= MAX_LOCK_VERSION_CHECKS) break;
    }
  }
  if (required.length === 0) {
    const dependencies = readProfileDependencies(profileDir);
    for (const [dependency, spec] of Object.entries(dependencies)) {
      if (dependency === packageName || typeof spec !== "string" || !isRegistrySpec(spec)) continue;
      const installed = readInstalledVersion(profileDir, dependency);
      if (installed) add(dependency, installed);
    }
  }
  return required.slice(0, MAX_LOCK_VERSION_CHECKS);
}
async function resolveInstallRegistry(settings, profileDir, packageName, targetVersion, targetIsGithub) {
  if (settings.registry === "npmjs") return { registry: OFFICIAL_REGISTRY, reason: "\u8BBE\u7F6E\u4E2D\u6307\u5B9A" };
  if (settings.registry === "npmmirror") return { registry: DOMESTIC_REGISTRY, reason: "\u8BBE\u7F6E\u4E2D\u6307\u5B9A" };
  if (settings.registry !== "auto") return { registry: settings.registry, reason: "\u8BBE\u7F6E\u4E2D\u6307\u5B9A" };
  const fastest = await probeFastestRegistry();
  if (fastest === OFFICIAL_REGISTRY) {
    return { registry: OFFICIAL_REGISTRY, reason: "\u81EA\u52A8\u6A21\u5F0F\uFF1Anpm \u5B98\u65B9\u6E90\u54CD\u5E94\u66F4\u5FEB" };
  }
  const required = await collectRequiredVersions(profileDir, packageName, targetVersion, targetIsGithub);
  if (required.length === 0) {
    return {
      registry: fastest ?? DOMESTIC_REGISTRY,
      reason: fastest ? "\u81EA\u52A8\u6A21\u5F0F\uFF1A\u56FD\u5185\u6E90\u54CD\u5E94\u66F4\u5FEB" : "\u81EA\u52A8\u6A21\u5F0F\uFF1A\u4E24\u4E2A\u6E90\u5747\u672A\u54CD\u5E94 ping\uFF0C\u6309\u56FD\u5185\u6E90\u5C1D\u8BD5"
    };
  }
  const present = await mapWithConcurrency(required, REGISTRY_CHECK_CONCURRENCY, (required2) => versionExists(DOMESTIC_REGISTRY, required2.name, required2.version));
  const missing = required.filter((item, index) => !present[index]);
  if (missing.length === 0) {
    return { registry: DOMESTIC_REGISTRY, reason: "\u81EA\u52A8\u6A21\u5F0F\uFF1A\u56FD\u5185\u6E90\u54CD\u5E94\u66F4\u5FEB\uFF0C\u4E14\u5305\u542B\u672C\u6B21\u6240\u9700\u7684\u5168\u90E8\u7248\u672C" };
  }
  const preview = missing.slice(0, 5).map((item) => `${item.name}@${item.version}`).join("\u3001");
  return {
    registry: OFFICIAL_REGISTRY,
    reason: `\u81EA\u52A8\u6A21\u5F0F\uFF1A\u56FD\u5185\u6E90\u6682\u7F3A ${preview}${missing.length > 5 ? " \u7B49" : ""}\uFF0C\u6539\u7528 npm \u5B98\u65B9\u6E90`
  };
}
function desktopCliCandidates() {
  const candidates = [];
  const override = process.env.DSH_CLI_JS?.trim();
  if (override) candidates.push(override);
  const cliRel = join("resources", "app.asar", "dsh", "node_modules", "@deepseek-ai", "dsh-desktop-host", "lib", "cli.js");
  const execDir = process.execPath ? dirname(process.execPath) : "";
  if (execDir) {
    candidates.push(join(execDir, cliRel));
    candidates.push(join(execDir, "..", "Resources", cliRel));
  }
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) candidates.push(join(localAppData, "Programs", "DeepSeek Harness", cliRel));
  return candidates;
}
function withGithubAuthEnv(env) {
  const token = githubToken();
  if (!token) return env;
  return {
    ...env,
    GH_TOKEN: token,
    GITHUB_TOKEN: token,
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: `url.https://x-access-token:${token}@github.com/.insteadOf`,
    GIT_CONFIG_VALUE_0: "https://github.com/"
  };
}
function buildInstallCommand(profileName, spec, registry) {
  const baseEnv = {
    ...process.env,
    // Keep the env registry identical to the --registry flag
    npm_config_registry: registry,
    ELECTRON_RUN_AS_NODE: "1"
  };
  const env = withGithubAuthEnv(baseEnv);
  const cliJs = desktopCliCandidates().find((candidate) => existsSync(candidate));
  if (cliJs) {
    return {
      command: process.execPath,
      args: ["--expose-internals", cliJs, "plugin", "--profile", profileName, "add", spec, `--registry=${registry}`],
      env
    };
  }
  if ([profileName, spec, registry].some((value) => !SHELL_SAFE_PATTERN.test(value))) {
    return { error: "Could not locate the DSH CLI and the pnpm fallback would need unsafe characters" };
  }
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", `pnpm add ${spec} --registry=${registry}`],
      env
    };
  }
  return { command: "pnpm", args: ["add", spec, `--registry=${registry}`], env };
}
function killChildTree(child) {
  if (!child || child.exitCode !== null) return;
  const pid = child.pid;
  if (process.platform === "win32" && pid) {
    try {
      const killer = spawn("taskkill", ["/pid", String(pid), "/T", "/F"], { shell: false, windowsHide: true, stdio: "ignore" });
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
function spawnInstall(options) {
  const plan = buildInstallCommand(options.profileName, options.spec, options.registry);
  if ("error" in plan) {
    return Promise.resolve({ ok: false, output: "", error: plan.error, timedOut: false, cancelled: false });
  }
  return new Promise((resolve) => {
    let output = "";
    let settled = false;
    let timedOut = false;
    let timeoutTimer;
    let forceTimer;
    const finish = (ok, error) => {
      if (settled) return;
      settled = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (forceTimer) clearTimeout(forceTimer);
      resolve({ ok, output, error, timedOut, cancelled: options.isCancelled?.() === true });
    };
    let child;
    try {
      child = spawn(plan.command, plan.args, {
        cwd: options.profileDir,
        shell: false,
        windowsHide: true,
        env: plan.env
      });
    } catch (error) {
      resolve({
        ok: false,
        output: "",
        error: redactSecrets(error?.message || "Failed to spawn install process"),
        timedOut: false,
        cancelled: false
      });
      return;
    }
    options.onStart?.(child);
    const append = (chunk) => {
      const text = typeof chunk === "string" ? chunk : chunk.toString();
      output = output.length + text.length > INSTALL_OUTPUT_LIMIT ? (output + text).slice(-INSTALL_OUTPUT_LIMIT) : output + text;
      options.onOutput?.(text);
    };
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    timeoutTimer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      killChildTree(child);
      forceTimer = setTimeout(() => finish(false, `\u5B89\u88C5\u547D\u4EE4\u8D85\u65F6\uFF08${Math.round(options.timeoutMs / 1e3)} \u79D2\uFF09`), 15e3);
      forceTimer.unref?.();
    }, options.timeoutMs);
    timeoutTimer.unref?.();
    child.on("error", (error) => finish(false, redactSecrets(`Process error: ${error.message}`)));
    child.on("close", (code) => {
      if (timedOut) {
        finish(false, `\u5B89\u88C5\u547D\u4EE4\u8D85\u65F6\uFF08${Math.round(options.timeoutMs / 1e3)} \u79D2\uFF09`);
        return;
      }
      if (options.isCancelled?.()) {
        finish(false, "\u66F4\u65B0\u5DF2\u53D6\u6D88");
        return;
      }
      if (code === 0) finish(true);
      else finish(false, redactSecrets(`Install process exited with code ${code ?? "unknown"}`));
    });
  });
}
async function resolveInstallPlan(settings, profileDir, packageName, targetVersion, source) {
  const origin = resolvePackageOrigin(profileDir, packageName, source);
  const cleanTarget = targetVersion ? targetVersion.replace(/^[v^~]/, "").trim() : "";
  if (origin.isGithub && origin.github) {
    const { owner, repo } = origin.github;
    const metadata = await getGithubRepoMetadata(owner, repo);
    const remote = await readGithubPackageJson(owner, repo, metadata.defaultBranch);
    const remoteVersion = remote.version;
    let githubPlan;
    if (cleanTarget) {
      const tag = findGithubTag(metadata, cleanTarget);
      if (tag) {
        githubPlan = { owner, repo, branch: metadata.defaultBranch, tag: tag.name, expectedCommit: tag.commit };
      } else if (compareSemver(remoteVersion, cleanTarget) === 0) {
        githubPlan = { owner, repo, branch: metadata.defaultBranch, expectedCommit: metadata.headCommit };
      } else {
        throw new RemoteError(
          ERROR_CODES.invalidTargetVersion,
          `GitHub \u4ED3\u5E93 ${owner}/${repo} \u6CA1\u6709\u4E0E\u7248\u672C ${cleanTarget} \u5339\u914D\u7684\u6807\u7B7E\uFF08v${cleanTarget} / ${cleanTarget}\uFF09\uFF0C\u5F53\u524D\u9ED8\u8BA4\u5206\u652F\u7248\u672C\u4E3A ${remoteVersion}`
        );
      }
    } else {
      githubPlan = { owner, repo, branch: metadata.defaultBranch, expectedCommit: metadata.headCommit };
    }
    const planTarget = cleanTarget || remoteVersion;
    const registryPlan2 = await resolveInstallRegistry(settings, profileDir, packageName, planTarget, true);
    return {
      isGithub: true,
      spec: githubPlan.tag ? `github:${owner}/${repo}#${githubPlan.tag}` : `github:${owner}/${repo}`,
      targetVersion: planTarget,
      github: githubPlan,
      registry: registryPlan2.registry,
      registryReason: registryPlan2.reason,
      registryLabel: registryLabel(registryPlan2.registry, settings.customRegistries)
    };
  }
  const npmTarget = cleanTarget || (await fetchNpmPackageInfo(packageName, settings)).version;
  const registryPlan = await resolveInstallRegistry(settings, profileDir, packageName, npmTarget, false);
  return {
    isGithub: false,
    spec: `${packageName}@${npmTarget}`,
    targetVersion: npmTarget,
    registry: registryPlan.registry,
    registryReason: registryPlan.reason,
    registryLabel: registryLabel(registryPlan.registry, settings.customRegistries)
  };
}
function shortCommit(value) {
  return value ? value.slice(0, 7) : "";
}
async function verifyInstall(profileDir, packageName, plan) {
  const diskVersion = readInstalledVersion(profileDir, packageName);
  if (!diskVersion) {
    return { ok: false, message: `\u5B89\u88C5\u5B8C\u6210\u540E\u672A\u5728 node_modules \u4E2D\u627E\u5230 ${packageName}\uFF0C\u66F4\u65B0\u53EF\u80FD\u6CA1\u6709\u771F\u6B63\u5199\u5165 profile` };
  }
  if (plan.targetVersion) {
    if (plan.isGithub) {
      if (compareSemver(diskVersion, plan.targetVersion) !== 0) {
        return { ok: false, message: `\u7248\u672C\u6821\u9A8C\u5931\u8D25\uFF1A\u671F\u671B ${plan.targetVersion}\uFF0C\u5B9E\u9645 ${diskVersion}` };
      }
    } else if (compareSemver(diskVersion, plan.targetVersion) < 0) {
      return { ok: false, message: `\u7248\u672C\u6821\u9A8C\u5931\u8D25\uFF1A\u671F\u671B\u81F3\u5C11 ${plan.targetVersion}\uFF0C\u5B9E\u9645 ${diskVersion}` };
    }
  }
  if (!plan.isGithub || !plan.github) return { ok: true };
  const lockText = readLockfileText(profileDir);
  const installedCommit = extractGithubCommit(lockText, plan.github.owner, plan.github.repo);
  const expectedCommit = plan.github.expectedCommit;
  if (!expectedCommit) {
    return { ok: true, installedCommit };
  }
  if (!installedCommit) {
    return {
      ok: false,
      message: `\u65E0\u6CD5\u4ECE pnpm-lock.yaml \u8BFB\u53D6 ${plan.github.owner}/${plan.github.repo} \u7684\u5DF2\u5B89\u88C5\u63D0\u4EA4\uFF0C\u65E0\u6CD5\u786E\u8BA4 GitHub \u5B89\u88C5\u7ED3\u679C`
    };
  }
  if (installedCommit.toLowerCase() === expectedCommit.toLowerCase()) {
    return { ok: true, installedCommit };
  }
  if (plan.github.tag) {
    const tagCommit = await resolveGithubTagCommit(plan.github.owner, plan.github.repo, plan.github.tag);
    if (tagCommit && tagCommit === installedCommit.toLowerCase()) {
      plan.github.expectedCommit = tagCommit;
      return { ok: true, installedCommit };
    }
  }
  if (!plan.github.tag) {
    try {
      const fresh = await getGithubRepoMetadata(plan.github.owner, plan.github.repo, { noCache: true });
      if (fresh.headCommit && installedCommit.toLowerCase() === fresh.headCommit.toLowerCase()) {
        plan.github.expectedCommit = fresh.headCommit;
        return { ok: true, installedCommit };
      }
    } catch {
    }
  }
  return {
    ok: false,
    message: `\u63D0\u4EA4\u6821\u9A8C\u5931\u8D25\uFF1A\u671F\u671B ${shortCommit(expectedCommit)}\uFF08${plan.github.tag ? `\u6807\u7B7E ${plan.github.tag}` : `\u5206\u652F ${plan.github.branch}`}\uFF09\uFF0C\u5B9E\u9645 ${shortCommit(installedCommit)}`
  };
}
async function rollbackProfile(snapshot, profileDir, profileName, packageName, settings, origin, registryUsed, timeoutMs) {
  let output = "";
  const currentPackageJson = readTextFile(snapshot.packageJsonPath);
  const currentLockfile = readTextFile(snapshot.lockfilePath);
  const filesChanged = currentPackageJson !== snapshot.packageJson || currentLockfile !== snapshot.lockfile;
  const previousVersion = snapshot.previousVersion;
  const currentVersion = readInstalledVersion(profileDir, packageName);
  const versionChanged = previousVersion !== void 0 && currentVersion !== previousVersion;
  const previousCommit = origin.isGithub && origin.github ? extractGithubCommit(snapshot.lockfile, origin.github.owner, origin.github.repo) : void 0;
  const currentCommit = origin.isGithub && origin.github ? extractGithubCommit(currentLockfile, origin.github.owner, origin.github.repo) : void 0;
  const commitChanged = !!previousCommit && !!currentCommit && currentCommit !== previousCommit;
  if (!filesChanged && !versionChanged && !commitChanged) {
    return { state: "not-needed", output: "" };
  }
  const previousSpec = buildRollbackSpec(snapshot, packageName, origin);
  let reinstallOk = true;
  if (!previousSpec && (versionChanged || commitChanged)) {
    reinstallOk = false;
    output += `
[dsh-plugins-update] \u56DE\u6EDA\uFF1A\u627E\u4E0D\u5230\u66F4\u65B0\u524D\u7684\u5B89\u88C5\u89C4\u683C\uFF0C\u65E0\u6CD5\u6062\u590D node_modules
`;
  }
  if (previousSpec) {
    output += `
[dsh-plugins-update] \u56DE\u6EDA\uFF1A\u91CD\u65B0\u5B89\u88C5\u66F4\u65B0\u524D\u7684\u7248\u672C\uFF08${previousSpec}\uFF09\u2026
`;
    let attempt = await spawnInstall({ profileDir, profileName, spec: previousSpec, registry: registryUsed, timeoutMs });
    output += attempt.output;
    if (!attempt.ok) {
      if (settings.fallbackToOfficial && registryUsed !== OFFICIAL_REGISTRY && !origin.isGithub) {
        output += `
[dsh-plugins-update] \u56DE\u6EDA\u91CD\u8BD5 npm \u5B98\u65B9\u6E90\u2026
`;
        attempt = await spawnInstall({ profileDir, profileName, spec: previousSpec, registry: OFFICIAL_REGISTRY, timeoutMs });
        output += attempt.output;
        reinstallOk = attempt.ok;
      } else {
        reinstallOk = false;
      }
    }
  }
  let filesRestored = true;
  try {
    restoreFile(snapshot.packageJsonPath, snapshot.packageJson);
    restoreFile(snapshot.lockfilePath, snapshot.lockfile);
  } catch (error) {
    filesRestored = false;
    output += `
[dsh-plugins-update] \u56DE\u6EDA\u65F6\u6062\u590D profile \u6587\u4EF6\u5931\u8D25\uFF1A${redactSecrets(error?.message || "unknown")}
`;
  }
  if (!filesRestored || !reinstallOk) {
    output += `
[dsh-plugins-update] \u56DE\u6EDA\u672A\u5B8C\u5168\u6210\u529F\uFF0C\u5EFA\u8BAE\u5728 DSH \u4E2D\u91CD\u65B0\u5B89\u88C5\u8BE5\u63D2\u4EF6\u3002
`;
    return { state: "failed", output };
  }
  output += `
[dsh-plugins-update] \u56DE\u6EDA\u5B8C\u6210\uFF0Cprofile \u5DF2\u6062\u590D\u5230\u66F4\u65B0\u524D\u7684\u72B6\u6001\u3002
`;
  return { state: "restored", output };
}
var jobs = /* @__PURE__ */ new Map();
var runningByProfile = /* @__PURE__ */ new Map();
function limitText(text, limit) {
  return text.length > limit ? text.slice(text.length - limit) : text;
}
function sanitizeLog(text) {
  return redactSecrets(text).replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}
function appendJobLog(job, text) {
  if (!text) return;
  job.log = limitText(job.log + text, INSTALL_OUTPUT_LIMIT);
  job.logTail = limitText(sanitizeLog(job.log), LOG_TAIL_LIMIT);
  job.updatedAt = Date.now();
}
function setJobPhase(job, phase, percent) {
  const currentRank = PHASE_RANK[job.phase];
  const nextRank = PHASE_RANK[phase];
  const terminal = TERMINAL_PHASES.has(phase);
  if (!terminal && phase !== "rolling-back" && nextRank < currentRank && !TERMINAL_PHASES.has(job.phase)) return;
  job.phase = phase;
  job.messageKey = PHASE_MESSAGE_KEYS[phase];
  if (percent !== void 0) job.percent = Math.max(0, Math.min(100, Math.round(percent)));
  job.running = !terminal;
  job.updatedAt = Date.now();
}
function noteInstallOutput(job, chunk) {
  if (TERMINAL_PHASES.has(job.phase)) return;
  const text = chunk.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, "");
  for (const line of text.split(/\r?\n/)) {
    if (/Packages:\s*\+/i.test(line) || /added\s+[1-9]\d*\s+packages?/i.test(line) || /Done in/i.test(line)) {
      setJobPhase(job, "installing", Math.max(job.percent ?? 0, 75));
      continue;
    }
    const resolvedMatch = line.match(/Progress:\s*resolved\s+(\d+)/i);
    if (resolvedMatch) {
      if (PHASE_RANK[job.phase] < PHASE_RANK.installing) setJobPhase(job, "downloading");
      const resolved = Number(resolvedMatch[1]);
      job.percent = Math.max(job.percent ?? 25, Math.min(70, 30 + Math.min(35, Math.floor(resolved / 4))));
      job.updatedAt = Date.now();
    }
  }
  if (job.phase === "downloading" || job.phase === "installing") {
    job.percent = Math.min(80, (job.percent ?? 0) + 1);
    job.updatedAt = Date.now();
  }
}
function createJob(params) {
  const now = Date.now();
  return {
    ok: true,
    jobId: randomUUID(),
    packageName: params.packageName,
    targetVersion: params.targetVersion,
    source: params.source,
    phase: "queued",
    running: true,
    percent: 0,
    messageKey: PHASE_MESSAGE_KEYS.queued,
    logTail: "",
    startedAt: now,
    updatedAt: now,
    cancelRequested: false,
    log: "",
    profileDir: params.profileDir,
    profileName: params.profileName,
    settings: params.settings,
    startedInstall: false,
    fellBack: false
  };
}
function clearRunning(job) {
  if (runningByProfile.get(job.profileDir) === job.jobId) runningByProfile.delete(job.profileDir);
}
function scheduleJobCleanup(job) {
  if (job.cleanupTimer) clearTimeout(job.cleanupTimer);
  job.cleanupTimer = setTimeout(() => {
    jobs.delete(job.jobId);
  }, JOB_TTL_MS);
  job.cleanupTimer.unref?.();
}
function pruneOldJobs() {
  if (jobs.size <= 100) return;
  const finished = [...jobs.values()].filter((job) => !job.running).sort((a, b) => a.updatedAt - b.updatedAt);
  const removeCount = jobs.size - 100;
  for (const job of finished.slice(0, removeCount)) jobs.delete(job.jobId);
}
function publicJobState(job) {
  return {
    ok: job.ok,
    jobId: job.jobId,
    packageName: job.packageName,
    phase: job.phase,
    running: job.running,
    percent: job.percent,
    messageKey: job.messageKey,
    logTail: job.logTail,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
    result: job.result,
    error: job.error,
    errorCode: job.errorCode
  };
}
function missingJobState(jobId) {
  const now = Date.now();
  return {
    ok: false,
    jobId,
    packageName: "",
    phase: "failed",
    running: false,
    messageKey: PHASE_MESSAGE_KEYS.failed,
    logTail: "",
    startedAt: now,
    updatedAt: now,
    error: "\u627E\u4E0D\u5230\u8BE5\u66F4\u65B0\u4EFB\u52A1\uFF08\u53EF\u80FD\u5DF2\u8FC7\u671F\uFF0C\u6216 DSH \u5DF2\u91CD\u542F\uFF09",
    errorCode: ERROR_CODES.jobNotFound
  };
}
function jobFailureFromError(error) {
  if (error instanceof RemoteError) return { errorCode: error.errorCode, message: redactSecrets(error.message) };
  if (error instanceof HttpError) return { errorCode: classifyAggregateError([error]), message: redactSecrets(error.message) };
  return { errorCode: ERROR_CODES.unknown, message: redactSecrets(error?.message || "\u66F4\u65B0\u5931\u8D25") };
}
async function runJob(job, refreshAfterInstall) {
  const { packageName, profileDir, profileName, settings } = job;
  const installTimeoutMs = settings.installTimeoutSeconds * 1e3;
  const rollbackTimeoutMs = Math.min(installTimeoutMs, 12e4);
  let plan;
  let snapshot;
  let origin = { isGithub: false };
  let registryUsed = "";
  let output = "";
  let rollback = { state: "not-needed", output: "" };
  const append = (text) => {
    output = limitText(output + text, INSTALL_OUTPUT_LIMIT);
    appendJobLog(job, text);
  };
  const checkCancelled = () => {
    if (job.cancelRequested) throw new RemoteError(ERROR_CODES.cancelled, "\u66F4\u65B0\u5DF2\u53D6\u6D88");
  };
  const spawnOptions = (spec, registry) => ({
    profileDir,
    profileName,
    spec,
    registry,
    timeoutMs: installTimeoutMs,
    onStart: (child) => {
      job.child = child;
      job.startedInstall = true;
    },
    onOutput: (text) => {
      append(text);
      noteInstallOutput(job, text);
    },
    isCancelled: () => job.cancelRequested
  });
  try {
    setJobPhase(job, "resolving", 8);
    origin = resolvePackageOrigin(profileDir, packageName, job.source);
    plan = await resolveInstallPlan(settings, profileDir, packageName, job.targetVersion, job.source);
    registryUsed = plan.registry;
    append(
      `[dsh-plugins-update] \u76EE\u6807\uFF1A${packageName}${plan.targetVersion ? `@${plan.targetVersion}` : ""}\uFF08${plan.isGithub ? "GitHub" : "npm"}\uFF09
`
    );
    append(`[dsh-plugins-update] \u5B89\u88C5\u6E90\uFF1A${plan.registryLabel}\uFF08${plan.registry}\uFF09\u2014 ${plan.registryReason}
`);
    append(`[dsh-plugins-update] \u5B89\u88C5\u89C4\u683C\uFF1A${plan.spec}
`);
    checkCancelled();
    snapshot = captureProfileSnapshot(profileDir, packageName);
    setJobPhase(job, "downloading", 25);
    let attempt = await spawnInstall(spawnOptions(plan.spec, plan.registry));
    if (!attempt.ok && !attempt.timedOut && !attempt.cancelled && settings.fallbackToOfficial && plan.registry !== OFFICIAL_REGISTRY) {
      job.fellBack = true;
      registryUsed = OFFICIAL_REGISTRY;
      append(`
[dsh-plugins-update] ${plan.registryLabel} \u5B89\u88C5\u5931\u8D25\uFF08${attempt.error || "\u672A\u77E5\u9519\u8BEF"}\uFF09\uFF0C\u6539\u7528 npm \u5B98\u65B9\u6E90\u91CD\u8BD5\u2026
`);
      attempt = await spawnInstall(spawnOptions(plan.spec, OFFICIAL_REGISTRY));
    }
    if (attempt.timedOut) {
      throw new RemoteError(ERROR_CODES.timeout, `\u5B89\u88C5\u8D85\u65F6\uFF08${settings.installTimeoutSeconds} \u79D2\uFF09`);
    }
    if (attempt.cancelled || job.cancelRequested) {
      throw new RemoteError(ERROR_CODES.cancelled, "\u66F4\u65B0\u5DF2\u53D6\u6D88");
    }
    if (!attempt.ok) {
      throw new RemoteError(ERROR_CODES.installFailed, attempt.error || "\u5B89\u88C5\u8FDB\u7A0B\u5931\u8D25");
    }
    checkCancelled();
    setJobPhase(job, "verifying", 88);
    const verification = await verifyInstall(profileDir, packageName, plan);
    if (!verification.ok) {
      throw new RemoteError(ERROR_CODES.verificationFailed, verification.message || "\u5B89\u88C5\u540E\u6821\u9A8C\u5931\u8D25");
    }
    const selfUpdate = packageName === OWN_PACKAGE_NAME;
    setJobPhase(job, "done", 100);
    job.result = {
      ok: true,
      packageName,
      targetVersion: plan.targetVersion,
      source: job.source,
      registryUsed,
      registryLabel: registryLabel(registryUsed, settings.customRegistries),
      fellBack: job.fellBack,
      selfUpdate,
      rollback: "not-needed",
      installedCommit: verification.installedCommit,
      output: limitText(sanitizeLog(output), RESULT_OUTPUT_LIMIT)
    };
    clearRunning(job);
    if (selfUpdate) {
      const timer = setTimeout(() => {
        void refreshAfterInstall();
      }, 1500);
      timer.unref?.();
    } else {
      try {
        await refreshAfterInstall();
      } catch {
      }
    }
  } catch (error) {
    const failure = jobFailureFromError(error);
    const wasCancelled = failure.errorCode === ERROR_CODES.cancelled;
    append(`
[dsh-plugins-update] ${wasCancelled ? "\u66F4\u65B0\u5DF2\u53D6\u6D88" : "\u66F4\u65B0\u5931\u8D25"}\uFF1A${failure.message}
`);
    if (plan && snapshot && job.startedInstall) {
      setJobPhase(job, "rolling-back", 92);
      try {
        rollback = await rollbackProfile(
          snapshot,
          profileDir,
          profileName,
          packageName,
          settings,
          origin,
          registryUsed || plan.registry,
          rollbackTimeoutMs
        );
        append(rollback.output);
      } catch (rollbackError) {
        rollback = { state: "failed", output: "" };
        append(`
[dsh-plugins-update] \u56DE\u6EDA\u5931\u8D25\uFF1A${redactSecrets(rollbackError?.message || "unknown error")}
`);
      }
    }
    setJobPhase(job, wasCancelled ? "cancelled" : "failed");
    job.error = failure.message;
    job.errorCode = failure.errorCode;
    job.result = {
      ok: false,
      packageName,
      targetVersion: plan?.targetVersion ?? job.targetVersion,
      source: job.source,
      registryUsed: registryUsed || void 0,
      registryLabel: registryLabel(registryUsed || plan?.registry || OFFICIAL_REGISTRY, settings.customRegistries),
      fellBack: job.fellBack,
      selfUpdate: packageName === OWN_PACKAGE_NAME,
      rollback: rollback.state,
      error: failure.message,
      errorCode: failure.errorCode,
      output: limitText(sanitizeLog(output), RESULT_OUTPUT_LIMIT)
    };
    clearRunning(job);
  } finally {
    job.child = void 0;
    if (!TERMINAL_PHASES.has(job.phase)) {
      setJobPhase(job, "failed");
      job.error = job.error || "\u66F4\u65B0\u4EFB\u52A1\u5F02\u5E38\u7EC8\u6B62";
      job.errorCode = job.errorCode || ERROR_CODES.unknown;
    }
    job.updatedAt = Date.now();
    clearRunning(job);
    scheduleJobCleanup(job);
  }
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
function readQueryParam(req, name2) {
  try {
    const url = new URL(req.url, "http://localhost");
    const value = url.searchParams.get(name2);
    return value?.trim() || void 0;
  } catch {
    return void 0;
  }
}
function apply(ctx, config) {
  const conn = ctx.get("connection");
  const registerFetch = conn?.fetch?.register?.bind(conn.fetch);
  if (typeof registerFetch !== "function") {
    return;
  }
  const refreshAfterInstall = async () => {
    try {
      const packages = ctx.get?.("pluginPackages");
      if (packages?.refresh) await packages.refresh();
    } catch {
    }
    try {
      const hmr = ctx.get?.("hmr");
      if (hmr?.reconcileProfile) await hmr.reconcileProfile([]);
    } catch {
    }
    try {
      ctx.emit?.("plugin-manager/changed", { reason: "install" });
    } catch {
    }
  };
  ctx.effect(
    () => registerFetch({
      path: CHECK_PATH,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: async (req) => {
        try {
          const body = await parseJsonBody(req);
          const packageName = readPackageName(body?.packageName);
          if (!packageName) {
            return errorResponse(
              { packageName: "", hasUpdate: false },
              ERROR_CODES.invalidPackageName,
              "packageName \u5FC5\u987B\u662F\u5408\u6CD5\u7684 npm \u5305\u540D",
              400
            );
          }
          const settings = readSettings(config);
          const bundle = await readBundleInfo(ctx, packageName);
          const blocked = bundleGuardError(packageName, bundle);
          if (blocked) {
            return errorResponse({ packageName, hasUpdate: false }, blocked.errorCode, blocked.error);
          }
          const { dir } = resolveProfileDir(packageName);
          const diskVersion = readInstalledVersion(dir, packageName);
          const clientVersion = typeof body.currentVersion === "string" && body.currentVersion ? body.currentVersion : "0.0.0";
          const current = diskVersion && compareSemver(diskVersion, clientVersion) > 0 ? diskVersion : clientVersion || diskVersion || "0.0.0";
          const origin = resolvePackageOrigin(
            dir,
            packageName,
            typeof body.source === "string" && body.source ? body.source : bundle?.source
          );
          let latestVersion = current;
          let releaseDate;
          let description;
          let registry;
          let isGithub = false;
          let fetched = false;
          let fetchError = "";
          let fetchErrorCode;
          let branch;
          let latestCommit;
          let installedCommit;
          let tag;
          if (origin.isGithub && origin.github) {
            isGithub = true;
            installedCommit = extractGithubCommit(readLockfileText(dir), origin.github.owner, origin.github.repo);
            try {
              const metadata = await getGithubRepoMetadata(origin.github.owner, origin.github.repo);
              branch = metadata.defaultBranch;
              latestCommit = metadata.headCommit;
              const remote = await readGithubPackageJson(origin.github.owner, origin.github.repo, metadata.defaultBranch);
              latestVersion = remote.version;
              description = remote.description;
              tag = findGithubTag(metadata, latestVersion);
              fetched = true;
            } catch (githubError) {
              const remote = githubError instanceof RemoteError ? githubError : githubRemoteError(githubError, origin.github.owner, origin.github.repo);
              fetchError = remote.message;
              fetchErrorCode = remote.errorCode;
              if (remote.errorCode === ERROR_CODES.githubAuth) {
                return errorResponse(
                  {
                    packageName,
                    currentVersion: current,
                    latestVersion: current,
                    hasUpdate: false,
                    isGithub: true,
                    installedCommit
                  },
                  remote.errorCode,
                  remote.message
                );
              }
              try {
                const fallback = await readGithubPackageJsonAnyBranch(origin.github.owner, origin.github.repo, [
                  "main",
                  "master"
                ]);
                latestVersion = fallback.info.version;
                description = fallback.info.description;
                branch = fallback.branch;
                fetched = true;
              } catch (branchError) {
                try {
                  const npmInfo = await fetchNpmPackageInfo(packageName, settings);
                  latestVersion = npmInfo.version;
                  releaseDate = npmInfo.releaseDate;
                  description = npmInfo.description;
                  registry = npmInfo.registry;
                  isGithub = false;
                  fetched = true;
                } catch (npmError) {
                  const npmRemote = npmError instanceof RemoteError ? npmError : npmRemoteError(npmError, checkRegistries(settings).join(", "));
                  fetchError = `${remote.message}\uFF1B${npmRemote.message}`;
                  fetchErrorCode = remote.errorCode;
                }
              }
            }
          } else {
            try {
              const npmInfo = await fetchNpmPackageInfo(packageName, settings);
              latestVersion = npmInfo.version;
              releaseDate = npmInfo.releaseDate;
              description = npmInfo.description;
              registry = npmInfo.registry;
              fetched = true;
            } catch (npmError) {
              const npmRemote = npmError instanceof RemoteError ? npmError : npmRemoteError(npmError, checkRegistries(settings).join(", "));
              fetchError = npmRemote.message;
              fetchErrorCode = npmRemote.errorCode;
              const fallbackGithub = origin.repoGithub || origin.github;
              if (fallbackGithub) {
                try {
                  const metadata = await getGithubRepoMetadata(fallbackGithub.owner, fallbackGithub.repo);
                  const remote = await readGithubPackageJson(fallbackGithub.owner, fallbackGithub.repo, metadata.defaultBranch);
                  latestVersion = remote.version;
                  description = remote.description;
                  fetched = true;
                } catch (githubError) {
                  const remote = githubError instanceof RemoteError ? githubError : githubRemoteError(githubError, fallbackGithub.owner, fallbackGithub.repo);
                  fetchError = `${npmRemote.message}\uFF1B${remote.message}`;
                  fetchErrorCode = remote.errorCode;
                }
              }
            }
          }
          if (!fetched) {
            return errorResponse(
              {
                packageName,
                currentVersion: current,
                latestVersion: current,
                hasUpdate: false,
                isGithub,
                installedCommit
              },
              fetchErrorCode ?? ERROR_CODES.offline,
              `\u65E0\u6CD5\u83B7\u53D6\u8FDC\u7AEF\u7248\u672C\u4FE1\u606F${fetchError ? `\uFF1A${fetchError}` : "\uFF1A\u7F51\u7EDC\u4E0D\u53EF\u8FBE"}`
            );
          }
          const commitAhead = !!(installedCommit && latestCommit && installedCommit !== latestCommit);
          const hasUpdate = compareSemver(latestVersion, current) > 0 || commitAhead && compareSemver(latestVersion, current) <= 0;
          const result = {
            ok: true,
            packageName,
            currentVersion: current,
            latestVersion,
            hasUpdate,
            releaseDate,
            description,
            source: origin.declaredSpec,
            isGithub,
            registry,
            branch,
            latestCommit,
            installedCommit,
            commitAhead: installedCommit && latestCommit ? commitAhead : void 0,
            tag: tag?.name,
            pinAvailable: isGithub ? !!tag : void 0
          };
          return jsonResponse(result);
        } catch (error) {
          return errorResponse(
            { packageName: "", hasUpdate: false, latestVersion: "0.0.0" },
            ERROR_CODES.unknown,
            redactSecrets(error?.message || "Check failed")
          );
        }
      }
    }),
    "dsh-plugins-update: check route"
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
            return errorResponse(
              { packageName },
              ERROR_CODES.invalidTargetVersion,
              "targetVersion \u5FC5\u987B\u662F\u5408\u6CD5\u7684\u8BED\u4E49\u5316\u7248\u672C",
              400
            );
          }
          const settings = readSettings(config);
          const bundle = await readBundleInfo(ctx, packageName);
          const blocked = bundleGuardError(packageName, bundle);
          if (blocked) {
            return errorResponse({ packageName }, blocked.errorCode, blocked.error);
          }
          const { dir, profileName } = resolveProfileDir(packageName);
          if (!existsSync(join(dir, "package.json"))) {
            return errorResponse({ packageName }, ERROR_CODES.profileNotFound, "\u627E\u4E0D\u5230\u53EF\u7528\u7684 DSH profile \u76EE\u5F55");
          }
          const runningJobId = runningByProfile.get(dir);
          if (runningJobId && jobs.get(runningJobId)?.running) {
            return errorResponse({ packageName }, ERROR_CODES.installInProgress, "\u53E6\u4E00\u4E2A\u63D2\u4EF6\u6B63\u5728\u66F4\u65B0\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5");
          }
          pruneOldJobs();
          const source = typeof body.source === "string" && body.source ? body.source : bundle?.source;
          const job = createJob({ packageName, targetVersion, source, profileDir: dir, profileName, settings });
          jobs.set(job.jobId, job);
          runningByProfile.set(dir, job.jobId);
          void runJob(job, refreshAfterInstall).catch((error) => {
            const message = redactSecrets(error?.message || "\u66F4\u65B0\u4EFB\u52A1\u5F02\u5E38\u7EC8\u6B62");
            setJobPhase(job, "failed");
            job.error = message;
            job.errorCode = ERROR_CODES.unknown;
            job.result = {
              ok: false,
              packageName,
              targetVersion,
              error: message,
              errorCode: ERROR_CODES.unknown,
              rollback: "not-needed"
            };
            clearRunning(job);
            scheduleJobCleanup(job);
          });
          return jsonResponse({ ok: true, packageName, jobId: job.jobId, targetVersion, source });
        } catch (error) {
          return errorResponse({ packageName }, ERROR_CODES.unknown, redactSecrets(error?.message || "Update failed"));
        }
      }
    }),
    "dsh-plugins-update: update route"
  );
  ctx.effect(
    () => registerFetch({
      path: PROGRESS_PATH,
      methods: ["GET"],
      fetch: async (req) => {
        const jobId = readQueryParam(req, "jobId");
        if (!jobId) return jsonResponse(missingJobState(""));
        const job = jobs.get(jobId);
        if (!job) return jsonResponse(missingJobState(jobId));
        return jsonResponse(publicJobState(job));
      }
    }),
    "dsh-plugins-update: progress route"
  );
  ctx.effect(
    () => registerFetch({
      path: CANCEL_PATH,
      methods: ["POST"],
      requestBody: "buffered",
      fetch: async (req) => {
        try {
          const body = await parseJsonBody(req);
          const jobId = typeof body.jobId === "string" ? body.jobId.trim() : "";
          if (!jobId) {
            return jsonResponse({ ok: false, jobId: "", error: "\u7F3A\u5C11 jobId \u53C2\u6570", errorCode: ERROR_CODES.jobNotFound });
          }
          const job = jobs.get(jobId);
          if (!job) {
            return jsonResponse({
              ok: false,
              jobId,
              error: "\u627E\u4E0D\u5230\u8BE5\u66F4\u65B0\u4EFB\u52A1\uFF08\u53EF\u80FD\u5DF2\u8FC7\u671F\uFF09",
              errorCode: ERROR_CODES.jobNotFound
            });
          }
          if (!job.running) {
            return jsonResponse({
              ok: false,
              jobId,
              cancelled: job.phase === "cancelled",
              error: "\u4EFB\u52A1\u5DF2\u7ED3\u675F\uFF0C\u65E0\u9700\u53D6\u6D88",
              errorCode: ERROR_CODES.unknown
            });
          }
          job.cancelRequested = true;
          appendJobLog(job, "\n[dsh-plugins-update] \u5DF2\u8BF7\u6C42\u53D6\u6D88\u66F4\u65B0\u2026\n");
          try {
            killChildTree(job.child);
          } catch {
          }
          return jsonResponse({ ok: true, jobId, cancelled: false, cancelRequested: true });
        } catch (error) {
          return jsonResponse({
            ok: false,
            jobId: "",
            error: redactSecrets(error?.message || "Cancel failed"),
            errorCode: ERROR_CODES.unknown
          });
        }
      }
    }),
    "dsh-plugins-update: cancel route"
  );
}
export {
  Config,
  apply,
  inject,
  name
};
