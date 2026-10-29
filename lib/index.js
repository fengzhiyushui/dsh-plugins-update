// src/index.ts
import { spawn } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import Schema from "@deepseek-ai/schemastery";

// src/types.ts
var OFFICIAL_REGISTRY = "https://registry.npmjs.org/";
var DOMESTIC_REGISTRY = "https://registry.npmmirror.com/";
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
function registryLabel(url, customs = []) {
  const normalized = normalizeRegistryUrl(url) ?? url;
  if (normalized === OFFICIAL_REGISTRY) return "npm \u5B98\u65B9\u6E90";
  if (normalized === DOMESTIC_REGISTRY) return "\u56FD\u5185\u6E90 npmmirror";
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
var INSTALL_TIMEOUT_MS = 18e4;
var CHECK_TIMEOUT_MS = 15e3;
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
    fallbackToOfficial: readField(config?.fallbackToOfficial, true)
  };
}
function selectedRegistry(settings) {
  if (settings.registry === "npmjs") return OFFICIAL_REGISTRY;
  if (settings.registry === "npmmirror") return DOMESTIC_REGISTRY;
  return normalizeRegistryUrl(settings.registry) ?? OFFICIAL_REGISTRY;
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
  const version = value.trim().replace(/^[v^~]/, "");
  if (!version) return void 0;
  return TARGET_VERSION_PATTERN.test(version) ? version : null;
}
function isOfficialPackageName(packageName) {
  return packageName.startsWith("@deepseek-ai/");
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
  if (bundle?.official === true || isOfficialPackageName(packageName)) {
    return {
      error: "\u5B98\u65B9\u63D2\u4EF6\u7531 DSH \u81EA\u5E26\u7684\u66F4\u65B0\u5165\u53E3\u7BA1\u7406\uFF0C\u8BF7\u4F7F\u7528\u63D2\u4EF6\u9875\u53F3\u4E0A\u89D2\u7684\u300C\u66F4\u65B0\u300D\u6309\u94AE",
      errorCode: ERROR_CODES.officialPlugin
    };
  }
  if (bundle?.installed === false) {
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
  const cleaned = value.trim().replace(/^git\+/, "").replace(/#.*$/, "").replace(/\.git$/i, "").replace(/\/+$/, "");
  if (!cleaned) return null;
  const match = cleaned.match(
    /(?:github:|^https?:\/\/github\.com\/|^git@github\.com:|^git:\/\/github\.com\/|^ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i
  );
  if (match) return { owner: match[1], repo: match[2] };
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleaned)) {
    const [owner, repo] = cleaned.split("/");
    return { owner, repo };
  }
  return null;
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
async function fetchJson(url, timeoutMs = CHECK_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const parsed = new URL(url);
    const headers = {
      accept: "application/json",
      "user-agent": "dsh-plugins-update"
    };
    if (parsed.username || parsed.password) {
      const credentials = `${decodeURIComponent(parsed.username)}:${decodeURIComponent(parsed.password)}`;
      headers.authorization = `Basic ${Buffer.from(credentials).toString("base64")}`;
      parsed.username = "";
      parsed.password = "";
    }
    const response = await fetch(parsed.href, { headers, signal: controller.signal });
    if (!response.ok) throw new RemoteError(ERROR_CODES.offline, `HTTP ${response.status}`);
    return await response.json();
  } catch (error) {
    if (error instanceof RemoteError) throw error;
    if (error?.name === "AbortError") throw new RemoteError(ERROR_CODES.timeout, "\u68C0\u67E5\u66F4\u65B0\u8D85\u65F6");
    throw new RemoteError(ERROR_CODES.offline, redactSecrets(error?.message || "\u7F51\u7EDC\u8BF7\u6C42\u5931\u8D25"));
  } finally {
    clearTimeout(timer);
  }
}
async function fetchNpmLatest(packageName, registry) {
  const data = await fetchJson(`${registry}${encodePackageName(packageName)}`);
  const version = data?.["dist-tags"]?.latest;
  if (typeof version !== "string" || !version.trim()) {
    throw new RemoteError(ERROR_CODES.offline, "\u66F4\u65B0\u6E90\u672A\u8FD4\u56DE\u6700\u65B0\u7248\u672C\u53F7");
  }
  return {
    version: version.trim(),
    description: typeof data?.description === "string" ? data.description : void 0,
    registry,
    isGithub: false
  };
}
async function fetchGithubPackageJson(owner, repo) {
  const urls = [
    `https://raw.githubusercontent.com/${owner}/${repo}/HEAD/package.json`,
    `https://cdn.jsdelivr.net/gh/${owner}/${repo}@HEAD/package.json`
  ];
  let lastError;
  for (const url of urls) {
    try {
      const data = await fetchJson(url);
      if (typeof data?.version !== "string" || !data.version.trim()) {
        throw new RemoteError(ERROR_CODES.offline, "GitHub \u4ED3\u5E93 package.json \u7F3A\u5C11\u7248\u672C\u53F7");
      }
      return {
        version: data.version.trim(),
        description: typeof data?.description === "string" ? data.description : void 0,
        isGithub: true
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof RemoteError ? lastError : new RemoteError(ERROR_CODES.offline, "\u65E0\u6CD5\u8BFB\u53D6 GitHub \u4ED3\u5E93\u7248\u672C\u4FE1\u606F");
}
async function resolveRemotePackage(packageName, profileDir, settings, source) {
  const origin = resolvePackageOrigin(profileDir, packageName, source);
  if (origin.isGithub && origin.github) {
    const info2 = await fetchGithubPackageJson(origin.github.owner, origin.github.repo);
    return { info: info2, origin, registry: selectedRegistry(settings) };
  }
  const registry = selectedRegistry(settings);
  const info = await fetchNpmLatest(packageName, registry);
  return { info, origin, registry };
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
  if (process.env.LOCALAPPDATA) candidates.push(join(process.env.LOCALAPPDATA, "Programs", "DeepSeek Harness", cliRel));
  return candidates;
}
function pnpmCandidates() {
  const candidates = [];
  const override = process.env.DSH_PNPM_JS?.trim();
  if (override) candidates.push(override);
  const rel = join("resources", "runtime", "primary-runtime", "dependencies", "pnpm", "bin", "pnpm.mjs");
  const execDir = process.execPath ? dirname(process.execPath) : "";
  if (execDir) {
    candidates.push(join(execDir, rel));
    candidates.push(join(execDir, "..", rel));
  }
  if (process.env.LOCALAPPDATA) candidates.push(join(process.env.LOCALAPPDATA, "Programs", "DeepSeek Harness", rel));
  return candidates;
}
function buildInstallCommand(profileName, spec, registry, policyBypass) {
  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: "1",
    npm_config_registry: registry
  };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  const policyArgs = policyBypass ? ["--config.minimum-release-age=0"] : [];
  const cliJs = desktopCliCandidates().find((candidate) => existsSync(candidate));
  if (cliJs) {
    return {
      command: process.execPath,
      args: ["--expose-internals", cliJs, "plugin", "--profile", profileName, "add", spec, `--registry=${registry}`, ...policyArgs],
      env
    };
  }
  const pnpmJs = pnpmCandidates().find((candidate) => existsSync(candidate));
  if (pnpmJs) {
    return {
      command: process.execPath,
      args: ["--expose-internals", pnpmJs, "add", spec, `--registry=${registry}`, ...policyArgs],
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
function spawnInstall(profileDir, profileName, spec, registry, policyBypass = false) {
  const plan = buildInstallCommand(profileName, spec, registry, policyBypass);
  if ("error" in plan) return Promise.resolve({ ok: false, output: "", error: plan.error, timedOut: false });
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
      child = spawn(plan.command, plan.args, {
        cwd: profileDir,
        shell: false,
        windowsHide: true,
        env: plan.env
      });
    } catch (error) {
      finish(false, redactSecrets(error?.message || "\u65E0\u6CD5\u542F\u52A8\u5B89\u88C5\u8FDB\u7A0B"));
      return;
    }
    child.stdout?.on("data", append);
    child.stderr?.on("data", append);
    child.on("error", (error) => finish(false, redactSecrets(error?.message || "\u5B89\u88C5\u8FDB\u7A0B\u9519\u8BEF")));
    child.on("close", (code) => {
      if (timedOut) return finish(false, `\u5B89\u88C5\u547D\u4EE4\u8D85\u65F6\uFF08${Math.round(INSTALL_TIMEOUT_MS / 1e3)} \u79D2\uFF09`);
      if (code === 0) return finish(true);
      finish(false, redactSecrets(`\u5B89\u88C5\u8FDB\u7A0B\u9000\u51FA\u7801 ${code ?? "unknown"}`));
    });
    timer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      killChildTree(child);
      forceTimer = setTimeout(
        () => finish(false, `\u5B89\u88C5\u547D\u4EE4\u8D85\u65F6\uFF08${Math.round(INSTALL_TIMEOUT_MS / 1e3)} \u79D2\uFF09`),
        1e4
      );
      forceTimer.unref?.();
    }, INSTALL_TIMEOUT_MS);
    timer.unref?.();
  });
}
function isSupplyChainPolicyFailure(output) {
  return /ERR_PNPM_NO_MATURE_MATCHING_VERSION|ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION|minimumReleaseAge/i.test(
    output || ""
  );
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
async function performUpdate(ctx, config, params, refresh) {
  const { packageName } = params;
  const settings = readSettings(config);
  const { dir: profileDir, profileName } = resolveProfileDir(packageName);
  if (!existsSync(join(profileDir, "package.json"))) {
    return { ok: false, packageName, error: "\u627E\u4E0D\u5230\u53EF\u7528\u7684 DSH profile \u76EE\u5F55", errorCode: ERROR_CODES.profileNotFound };
  }
  const origin = resolvePackageOrigin(profileDir, packageName, params.source);
  const currentVersion = readInstalledVersion(profileDir, packageName);
  let targetVersion = params.targetVersion;
  let spec = "";
  let expectedGithub = false;
  if (origin.isGithub && origin.github) {
    expectedGithub = true;
    if (!targetVersion) {
      const remote = await fetchGithubPackageJson(origin.github.owner, origin.github.repo);
      targetVersion = remote.version;
    }
    spec = `github:${origin.github.owner}/${origin.github.repo}`;
  } else {
    const registry = selectedRegistry(settings);
    const remote = targetVersion ? void 0 : await fetchNpmLatest(packageName, registry);
    targetVersion = targetVersion || remote.version;
    spec = `${packageName}@${targetVersion}`;
  }
  if (!targetVersion) {
    return { ok: false, packageName, error: "\u65E0\u6CD5\u786E\u5B9A\u76EE\u6807\u7248\u672C", errorCode: ERROR_CODES.invalidTargetVersion };
  }
  const snapshot = captureSnapshot(profileDir);
  let registryUsed = selectedRegistry(settings);
  let fellBack = false;
  let attempt = await spawnInstall(profileDir, profileName, spec, registryUsed);
  if (!attempt.ok && !attempt.timedOut && isSupplyChainPolicyFailure(attempt.output)) {
    attempt = await spawnInstall(profileDir, profileName, spec, registryUsed, true);
  }
  if (!attempt.ok && !attempt.timedOut && settings.fallbackToOfficial && normalizeRegistryUrl(registryUsed) !== OFFICIAL_REGISTRY) {
    fellBack = true;
    registryUsed = OFFICIAL_REGISTRY;
    attempt = await spawnInstall(profileDir, profileName, spec, registryUsed);
    if (!attempt.ok && !attempt.timedOut && isSupplyChainPolicyFailure(attempt.output)) {
      attempt = await spawnInstall(profileDir, profileName, spec, registryUsed, true);
    }
  }
  if (!attempt.ok) {
    const restored = restoreSnapshot(profileDir, snapshot);
    return {
      ok: false,
      packageName,
      targetVersion,
      source: origin.declaredSpec,
      registryUsed: safeRegistryUrl(registryUsed),
      registryLabel: registryLabel(registryUsed, settings.customRegistries),
      fellBack,
      rollback: restored ? "restored" : "failed",
      error: attempt.timedOut ? "\u66F4\u65B0\u8D85\u65F6\uFF0C\u5DF2\u4E2D\u6B62\u5B89\u88C5" : attempt.error || "\u5B89\u88C5\u5931\u8D25",
      errorCode: attempt.timedOut ? ERROR_CODES.timeout : ERROR_CODES.installFailed,
      output: attempt.output
    };
  }
  const installedVersion = readInstalledVersion(profileDir, packageName);
  const verified = installedVersion !== void 0 && (expectedGithub ? installedVersion === targetVersion : compareSemver(installedVersion, targetVersion) >= 0);
  if (!verified) {
    const restored = restoreSnapshot(profileDir, snapshot);
    return {
      ok: false,
      packageName,
      targetVersion,
      source: origin.declaredSpec,
      registryUsed: safeRegistryUrl(registryUsed),
      registryLabel: registryLabel(registryUsed, settings.customRegistries),
      fellBack,
      rollback: restored ? "restored" : "failed",
      error: `\u5B89\u88C5\u540E\u6821\u9A8C\u672A\u901A\u8FC7\uFF1A\u671F\u671B ${targetVersion}\uFF0C\u5B9E\u9645 ${installedVersion || "\u672A\u77E5"}`,
      errorCode: ERROR_CODES.verificationFailed,
      output: attempt.output
    };
  }
  const selfUpdate = packageName === OWN_PACKAGE_NAME;
  if (selfUpdate) {
    const timer = setTimeout(() => void refresh(), 1500);
    timer.unref?.();
  } else {
    try {
      await refresh();
    } catch {
    }
  }
  return {
    ok: true,
    packageName,
    targetVersion,
    source: origin.declaredSpec,
    registryUsed: safeRegistryUrl(registryUsed),
    registryLabel: registryLabel(registryUsed, settings.customRegistries),
    fellBack,
    selfUpdate,
    rollback: "not-needed",
    output: attempt.output
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
    try {
      const packages = ctx.get?.("pluginPackages");
      if (packages?.refresh) await packages.refresh();
    } catch {
    }
    try {
      const hmr = ctx.get?.("hmr");
      if (hmr?.runExclusive && typeof hmr.reconcileProfile === "function") {
        await hmr.runExclusive(() => hmr.reconcileProfile([]));
      }
    } catch {
    }
    try {
      ctx.emit?.("plugin-manager/changed", { reason: "install" });
    } catch {
    }
  };
  const runningProfiles = /* @__PURE__ */ new Set();
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
          const bundle = await readBundleInfo(ctx, packageName);
          const blocked = bundleGuardError(packageName, bundle);
          if (blocked) return errorResponse({ packageName, hasUpdate: false }, blocked.errorCode, blocked.error);
          const { dir } = resolveProfileDir(packageName);
          const currentVersion = readInstalledVersion(dir, packageName) || body?.currentVersion || "0.0.0";
          const { info, origin, registry } = await resolveRemotePackage(
            packageName,
            dir,
            readSettings(config),
            typeof body?.source === "string" ? body.source : bundle?.source
          );
          const result = {
            ok: true,
            packageName,
            currentVersion,
            latestVersion: info.version,
            hasUpdate: compareSemver(info.version, currentVersion) > 0,
            description: info.description,
            source: origin.declaredSpec || bundle?.source,
            isGithub: info.isGithub,
            registry: safeRegistryUrl(registry)
          };
          return jsonResponse(result);
        } catch (error) {
          const errorCode = error instanceof RemoteError ? error.errorCode : ERROR_CODES.unknown;
          return errorResponse(
            { packageName: "", hasUpdate: false, latestVersion: "0.0.0" },
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
          const { dir } = resolveProfileDir(packageName);
          if (!existsSync(join(dir, "package.json"))) {
            return errorResponse({ packageName }, ERROR_CODES.profileNotFound, "\u627E\u4E0D\u5230\u53EF\u7528\u7684 DSH profile \u76EE\u5F55");
          }
          if (runningProfiles.has(dir)) {
            return errorResponse({ packageName }, ERROR_CODES.installInProgress, "\u53E6\u4E00\u4E2A\u63D2\u4EF6\u6B63\u5728\u66F4\u65B0\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5");
          }
          runningProfiles.add(dir);
          try {
            const result = await performUpdate(
              ctx,
              config,
              {
                packageName,
                targetVersion,
                source: typeof body?.source === "string" ? body.source : bundle?.source
              },
              refreshAfterInstall
            );
            return jsonResponse(result);
          } finally {
            runningProfiles.delete(dir);
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
}
export {
  Config,
  apply,
  inject,
  name
};
