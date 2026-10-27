// src/index.ts
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import Schema from "@deepseek-ai/schemastery";

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
var INSTALL_TIMEOUT_MS = 12e4;
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
    Schema.string().default("auto").description("\u66F4\u65B0\u6E90\uFF1Aauto\uFF08\u81EA\u52A8\uFF09/ npmjs\uFF08npm \u5B98\u65B9\u6E90\uFF09/ npmmirror\uFF08DSH \u540C\u6B3E\u56FD\u5185\u6E90\uFF09/ \u81EA\u5B9A\u4E49\u6E90 URL")
  ),
  customRegistries: live(
    Schema.array(
      Schema.object({
        name: Schema.string().default(""),
        url: Schema.string().default("")
      })
    ).default([]).description("\u7528\u6237\u81EA\u884C\u6DFB\u52A0\u7684\u66F4\u65B0\u6E90\u5217\u8868")
  ),
  fallbackToOfficial: live(
    Schema.boolean().default(true).description("\u4F7F\u7528\u975E\u5B98\u65B9\u6E90\u66F4\u65B0\u5931\u8D25\u65F6\uFF0C\u81EA\u52A8\u6539\u7528 npm \u5B98\u65B9\u6E90\u91CD\u8BD5\u4E00\u6B21")
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
  const customRegistries = Array.isArray(customRaw) ? customRaw.map((item) => ({
    name: typeof item?.name === "string" ? item.name.trim() : "",
    url: normalizeRegistryUrl(item?.url) ?? ""
  })).filter((item) => item.url) : [];
  let registry = typeof registryRaw === "string" ? registryRaw.trim() : "auto";
  if (registry !== "auto" && registry !== "npmjs" && registry !== "npmmirror") {
    registry = normalizeRegistryUrl(registry) ?? "auto";
  }
  return { registry, customRegistries, fallbackToOfficial: fallback !== false };
}
function compareSemver(v1, v2) {
  const clean = (v) => v.replace(/^v/, "").trim();
  const parts1 = clean(v1).split(/[-+]/)[0].split(".").map((n) => parseInt(n, 10) || 0);
  const parts2 = clean(v2).split(/[-+]/)[0].split(".").map((n) => parseInt(n, 10) || 0);
  const len = Math.max(parts1.length, parts2.length);
  for (let i = 0; i < len; i++) {
    const p1 = parts1[i] ?? 0;
    const p2 = parts2[i] ?? 0;
    if (p1 > p2) return 1;
    if (p1 < p2) return -1;
  }
  return 0;
}
function parseGithubSource(str) {
  if (!str) return null;
  const cleaned = str.trim().replace(/\.git$/, "");
  const match = cleaned.match(/(?:github:|^https?:\/\/github\.com\/|^git@github\.com:|^git\+https:\/\/github\.com\/)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/i);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  if (/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(cleaned)) {
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
    return "\u5B98\u65B9\u63D2\u4EF6\u7531 DSH \u81EA\u5E26\u7684\u66F4\u65B0\u5165\u53E3\u7BA1\u7406\uFF0C\u8BF7\u4F7F\u7528\u63D2\u4EF6\u9875\u53F3\u4E0A\u89D2\u7684\u300C\u66F4\u65B0\u300D\u6309\u94AE";
  }
  if (bundle?.installed === false) {
    return "\u8BE5\u63D2\u4EF6\u672A\u5B89\u88C5\u5230\u5F53\u524D profile\uFF0C\u65E0\u6CD5\u66F4\u65B0";
  }
  if (!bundle && isOfficialPackageName(packageName)) {
    return "\u5B98\u65B9\u63D2\u4EF6\u7531 DSH \u81EA\u5E26\u7684\u66F4\u65B0\u5165\u53E3\u7BA1\u7406\uFF0C\u8BF7\u4F7F\u7528\u63D2\u4EF6\u9875\u53F3\u4E0A\u89D2\u7684\u300C\u66F4\u65B0\u300D\u6309\u94AE";
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
  let gh = parseGithubSource(explicitSource);
  if (gh) return { isGithub: true, github: gh, repoGithub: repoGithub || gh, declaredSpec: explicitSource };
  const manifestPath = join(profileDir, "package.json");
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
      const spec = manifest?.dependencies?.[packageName] || manifest?.devDependencies?.[packageName] || manifest?.optionalDependencies?.[packageName];
      if (typeof spec === "string") {
        gh = parseGithubSource(spec);
        if (gh) {
          return { isGithub: true, github: gh, repoGithub: repoGithub || gh, declaredSpec: spec };
        }
        return { isGithub: false, repoGithub, declaredSpec: spec };
      }
    } catch {
    }
  }
  return { isGithub: false, repoGithub };
}
async function fetchGithubPackageInfo(owner, repo) {
  const fetchEndpoints = [
    async () => {
      const res = await fetch(`https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/package.json`, {
        signal: AbortSignal.timeout(4e3)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },
    async () => {
      const res = await fetch(`https://fastly.jsdelivr.net/gh/${owner}/${repo}@main/package.json`, {
        signal: AbortSignal.timeout(4e3)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },
    async () => {
      const res = await fetch(`https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`, {
        signal: AbortSignal.timeout(5e3)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    },
    async () => {
      const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/package.json`, {
        headers: { "User-Agent": "dsh-plugins-update", "Accept": "application/json" },
        signal: AbortSignal.timeout(5e3)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.content && data.encoding === "base64") {
        return JSON.parse(Buffer.from(data.content, "base64").toString("utf8"));
      }
      throw new Error("Invalid format");
    }
  ];
  try {
    const pkgJson = await Promise.any(fetchEndpoints.map((fn) => fn()));
    if (pkgJson && typeof pkgJson.version === "string") {
      return {
        version: pkgJson.version,
        description: pkgJson.description
      };
    }
  } catch {
  }
  throw new Error(`Failed to read package.json from GitHub (${owner}/${repo})`);
}
function encodePackageName(packageName) {
  return encodeURIComponent(packageName).replace(/^%40/, "@");
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
  const res = await fetch(`${registry}${encodePackageName(packageName)}/latest`, {
    headers: { "accept": "application/json" },
    signal: AbortSignal.timeout(5e3)
  });
  if (!res.ok) throw new Error(`${registry} HTTP ${res.status}`);
  const data = await res.json();
  if (!data || typeof data.version !== "string") throw new Error(`${registry} returned no version`);
  return {
    version: data.version,
    releaseDate: data.time?.[data.version],
    description: data.description,
    registry
  };
}
async function fetchNpmPackageInfo(packageName, settings) {
  const registries = checkRegistries(settings);
  const pickHighest = (results) => {
    let best2;
    for (const r of results) {
      if (r.status !== "fulfilled") continue;
      if (!best2 || compareSemver(r.value.version, best2.version) > 0) best2 = r.value;
    }
    return best2;
  };
  let best = pickHighest(await Promise.allSettled(registries.map((reg) => fetchLatestFrom(reg, packageName))));
  if (!best && settings.fallbackToOfficial && !registries.includes(OFFICIAL_REGISTRY)) {
    best = pickHighest(await Promise.allSettled([fetchLatestFrom(OFFICIAL_REGISTRY, packageName)]));
  }
  if (best) return best;
  throw new Error(`Package ${packageName} not found on ${registries.join(", ")}`);
}
async function pingRegistry(registry, timeoutMs) {
  const res = await fetch(`${registry}-/ping`, { signal: AbortSignal.timeout(timeoutMs), redirect: "manual" });
  try {
    await res.body?.cancel();
  } catch {
  }
  if (res.status < 200 || res.status >= 300) throw new Error(`HTTP ${res.status}`);
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
    const res = await fetch(`${registry}${encodePackageName(packageName)}/${encodeURIComponent(version)}`, {
      headers: { "accept": "application/json" },
      signal: AbortSignal.timeout(5e3)
    });
    try {
      await res.body?.cancel();
    } catch {
    }
    return res.ok;
  } catch {
    return false;
  }
}
function isRegistrySpec(spec) {
  const s = spec.trim();
  if (!s) return false;
  if (/^(?:github:|gitlab:|bitbucket:|git[+:]|git@|https?:|file:|link:|workspace:|npm:|portal:|patch:)/i.test(s)) return false;
  if (parseGithubSource(s)) return false;
  return true;
}
function collectRequiredVersions(profileDir, packageName, targetVersion, targetIsGithub) {
  const required = [];
  const deps = readProfileDependencies(profileDir);
  for (const [dep, spec] of Object.entries(deps)) {
    if (dep === packageName) continue;
    if (typeof spec !== "string" || !isRegistrySpec(spec)) continue;
    const installed = readInstalledVersion(profileDir, dep);
    if (installed) required.push({ name: dep, version: installed });
  }
  if (!targetIsGithub && targetVersion) {
    required.push({ name: packageName, version: targetVersion });
  }
  return required;
}
async function resolveInstallRegistry(settings, profileDir, packageName, targetVersion, targetIsGithub) {
  if (settings.registry === "npmjs") return { registry: OFFICIAL_REGISTRY, reason: "\u8BBE\u7F6E\u4E2D\u6307\u5B9A" };
  if (settings.registry === "npmmirror") return { registry: DOMESTIC_REGISTRY, reason: "\u8BBE\u7F6E\u4E2D\u6307\u5B9A" };
  if (settings.registry !== "auto") return { registry: settings.registry, reason: "\u8BBE\u7F6E\u4E2D\u6307\u5B9A" };
  const fastest = await probeFastestRegistry();
  if (fastest === OFFICIAL_REGISTRY) {
    return { registry: OFFICIAL_REGISTRY, reason: "\u81EA\u52A8\u6A21\u5F0F\uFF1Anpm \u5B98\u65B9\u6E90\u54CD\u5E94\u66F4\u5FEB" };
  }
  const required = collectRequiredVersions(profileDir, packageName, targetVersion, targetIsGithub);
  const present = await Promise.all(required.map((r) => versionExists(DOMESTIC_REGISTRY, r.name, r.version)));
  const missing = required.filter((_, i) => !present[i]);
  if (missing.length === 0) {
    return { registry: DOMESTIC_REGISTRY, reason: "\u81EA\u52A8\u6A21\u5F0F\uFF1A\u56FD\u5185\u6E90\u54CD\u5E94\u66F4\u5FEB\uFF0C\u4E14\u5305\u542B\u672C\u6B21\u6240\u9700\u7684\u5168\u90E8\u7248\u672C" };
  }
  return {
    registry: OFFICIAL_REGISTRY,
    reason: `\u81EA\u52A8\u6A21\u5F0F\uFF1A\u56FD\u5185\u6E90\u6682\u7F3A ${missing.map((m) => `${m.name}@${m.version}`).join("\u3001")}\uFF0C\u6539\u7528 npm \u5B98\u65B9\u6E90`
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
function buildInstallCommand(profileName, spec, registry) {
  const env = {
    ...process.env,
    // Keep the env registry identical to the --registry flag
    npm_config_registry: registry,
    ELECTRON_RUN_AS_NODE: "1"
  };
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
function runInstall(profileDir, profileName, spec, registry) {
  const plan = buildInstallCommand(profileName, spec, registry);
  if ("error" in plan) {
    return Promise.resolve({ ok: false, output: "", error: plan.error });
  }
  return new Promise((resolve) => {
    let output = "";
    let settled = false;
    try {
      const child = spawn(plan.command, plan.args, {
        cwd: profileDir,
        shell: false,
        windowsHide: true,
        env: plan.env
      });
      child.stdout?.on("data", (data) => {
        output += data.toString();
      });
      child.stderr?.on("data", (data) => {
        output += data.toString();
      });
      const timeoutTimer = setTimeout(() => {
        if (!settled) {
          settled = true;
          try {
            child.kill();
          } catch {
          }
          resolve({
            ok: false,
            output,
            error: `Update command timed out after ${INSTALL_TIMEOUT_MS / 1e3} seconds`
          });
        }
      }, INSTALL_TIMEOUT_MS);
      timeoutTimer.unref?.();
      child.on("error", (err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        resolve({
          ok: false,
          output,
          error: `Process error: ${err.message}`
        });
      });
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        if (code === 0) {
          resolve({ ok: true, output });
        } else {
          resolve({
            ok: false,
            output,
            error: `Update process exited with code ${code}`
          });
        }
      });
    } catch (e) {
      resolve({
        ok: false,
        output: "",
        error: e?.message || "Failed to spawn update process"
      });
    }
  });
}
async function runUpdateCommand(settings, profileDir, profileName, packageName, targetVersion, source) {
  let spec;
  const origin = resolvePackageOrigin(profileDir, packageName, source);
  const cleanTarget = targetVersion ? targetVersion.replace(/^[v^~]/, "").trim() : "";
  if (cleanTarget && !TARGET_VERSION_PATTERN.test(cleanTarget)) {
    return { ok: false, output: "", error: `\u65E0\u6548\u7684\u76EE\u6807\u7248\u672C: ${targetVersion}`, registryUsed: "", fellBack: false };
  }
  if (origin.isGithub && origin.github) {
    spec = `github:${origin.github.owner}/${origin.github.repo}`;
  } else if (cleanTarget) {
    spec = `${packageName}@${cleanTarget}`;
  } else {
    spec = `${packageName}@latest`;
  }
  const plan = await resolveInstallRegistry(settings, profileDir, packageName, cleanTarget, origin.isGithub);
  const label = (url) => registryLabel(url, settings.customRegistries);
  let output = `[dsh-plugins-update] \u4F7F\u7528 ${label(plan.registry)}\uFF08${plan.registry}\uFF09\u2014 ${plan.reason}
`;
  let attempt = await runInstall(profileDir, profileName, spec, plan.registry);
  output += attempt.output;
  let registryUsed = plan.registry;
  let fellBack = false;
  if (!attempt.ok && settings.fallbackToOfficial && plan.registry !== OFFICIAL_REGISTRY) {
    output += `
[dsh-plugins-update] ${label(plan.registry)} \u66F4\u65B0\u5931\u8D25\uFF08${attempt.error || "unknown"}\uFF09\uFF0C\u6539\u7528 npm \u5B98\u65B9\u6E90\uFF08${OFFICIAL_REGISTRY}\uFF09\u91CD\u8BD5\u2026
`;
    attempt = await runInstall(profileDir, profileName, spec, OFFICIAL_REGISTRY);
    output += attempt.output;
    registryUsed = OFFICIAL_REGISTRY;
    fellBack = true;
  }
  if (attempt.ok) {
    const afterVersion = readInstalledVersion(profileDir, packageName);
    if (!origin.isGithub && cleanTarget && afterVersion && compareSemver(afterVersion, cleanTarget) < 0) {
      return {
        ok: false,
        output,
        error: `Update process exited with 0, but installed version remained ${afterVersion} (expected ${cleanTarget})`,
        registryUsed,
        fellBack
      };
    }
    return { ok: true, output, registryUsed, fellBack };
  }
  return { ok: false, output, error: attempt.error, registryUsed, fellBack };
}
function apply(ctx, config) {
  const conn = ctx.get("connection");
  const registerFetch = conn?.fetch?.register?.bind(conn.fetch);
  if (typeof registerFetch !== "function") {
    return;
  }
  const installing = /* @__PURE__ */ new Set();
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
  ctx.effect(() => registerFetch({
    path: "/api/dsh-plugins-update/check",
    methods: ["POST"],
    requestBody: "buffered",
    fetch: async (req) => {
      try {
        const body = await req.json().catch(() => ({})) ?? {};
        const packageName = readPackageName(body?.packageName);
        if (!packageName) {
          return Response.json({ ok: false, packageName: "", hasUpdate: false, error: "packageName \u5FC5\u987B\u662F\u5408\u6CD5\u7684 npm \u5305\u540D" }, { status: 400 });
        }
        const settings = readSettings(config);
        const bundle = await readBundleInfo(ctx, packageName);
        const blocked = bundleGuardError(packageName, bundle);
        if (blocked) {
          return Response.json({ ok: false, packageName, hasUpdate: false, error: blocked }, { status: 200 });
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
        if (origin.isGithub && origin.github) {
          isGithub = true;
          try {
            const ghInfo = await fetchGithubPackageInfo(origin.github.owner, origin.github.repo);
            latestVersion = ghInfo.version;
            description = ghInfo.description;
            fetched = true;
          } catch (ghErr) {
            fetchError = ghErr?.message || "GitHub request failed";
            try {
              const npmInfo = await fetchNpmPackageInfo(packageName, settings);
              latestVersion = npmInfo.version;
              releaseDate = npmInfo.releaseDate;
              description = npmInfo.description;
              registry = npmInfo.registry;
              isGithub = false;
              fetched = true;
            } catch (npmErr) {
              fetchError += `\uFF1B${npmErr?.message || "npm request failed"}`;
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
          } catch (npmErr) {
            fetchError = npmErr?.message || "npm request failed";
            const fallbackGh = origin.repoGithub || origin.github;
            if (fallbackGh) {
              try {
                const ghInfo = await fetchGithubPackageInfo(fallbackGh.owner, fallbackGh.repo);
                latestVersion = ghInfo.version;
                description = ghInfo.description;
                fetched = true;
              } catch (ghErr) {
                fetchError += `\uFF1B${ghErr?.message || "GitHub request failed"}`;
              }
            }
          }
        }
        if (!fetched) {
          return Response.json({
            ok: false,
            packageName,
            currentVersion: current,
            latestVersion: current,
            hasUpdate: false,
            isGithub,
            error: `\u65E0\u6CD5\u83B7\u53D6\u8FDC\u7AEF\u7248\u672C\u4FE1\u606F\uFF1A${fetchError || "\u7F51\u7EDC\u4E0D\u53EF\u8FBE"}`
          }, { status: 200 });
        }
        const hasUpdate = compareSemver(latestVersion, current) > 0;
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
          registry
        };
        return Response.json(result, {
          headers: { "cache-control": "no-store" }
        });
      } catch (err) {
        return Response.json({
          ok: false,
          packageName: "",
          hasUpdate: false,
          latestVersion: "0.0.0",
          error: err?.message || "Check failed"
        }, { status: 200 });
      }
    }
  }), "dsh-plugins-update: check route");
  ctx.effect(() => registerFetch({
    path: "/api/dsh-plugins-update/update",
    methods: ["POST"],
    requestBody: "buffered",
    fetch: async (req) => {
      let packageName = "";
      try {
        const body = await req.json().catch(() => ({})) ?? {};
        packageName = readPackageName(body?.packageName) ?? "";
        if (!packageName) {
          return Response.json({ ok: false, packageName: "", error: "packageName \u5FC5\u987B\u662F\u5408\u6CD5\u7684 npm \u5305\u540D" }, { status: 400 });
        }
        const targetVersion = readTargetVersion(body?.targetVersion);
        if (targetVersion === null) {
          return Response.json({ ok: false, packageName, error: "targetVersion \u5FC5\u987B\u662F\u5408\u6CD5\u7684\u8BED\u4E49\u5316\u7248\u672C" }, { status: 400 });
        }
        const settings = readSettings(config);
        const bundle = await readBundleInfo(ctx, packageName);
        const blocked = bundleGuardError(packageName, bundle);
        if (blocked) {
          return Response.json({ ok: false, packageName, error: blocked }, { status: 200 });
        }
        const { dir, profileName } = resolveProfileDir(packageName);
        if (!existsSync(join(dir, "package.json"))) {
          return Response.json({ ok: false, packageName, error: "\u627E\u4E0D\u5230\u53EF\u7528\u7684 DSH profile \u76EE\u5F55" }, { status: 200 });
        }
        if (installing.has(dir)) {
          return Response.json({ ok: false, packageName, error: "\u53E6\u4E00\u4E2A\u63D2\u4EF6\u6B63\u5728\u66F4\u65B0\uFF0C\u8BF7\u7A0D\u540E\u518D\u8BD5" }, { status: 200 });
        }
        installing.add(dir);
        try {
          const source = typeof body.source === "string" && body.source ? body.source : bundle?.source;
          const runRes = await runUpdateCommand(settings, dir, profileName, packageName, targetVersion, source);
          const selfUpdate = packageName === OWN_PACKAGE_NAME;
          if (runRes.ok) {
            if (selfUpdate) {
              const timer = setTimeout(() => {
                void refreshAfterInstall();
              }, 1500);
              timer.unref?.();
            } else {
              await refreshAfterInstall();
            }
          }
          const result = {
            ok: runRes.ok,
            packageName,
            targetVersion,
            source,
            registryUsed: runRes.registryUsed,
            registryLabel: registryLabel(runRes.registryUsed, settings.customRegistries),
            fellBack: runRes.fellBack,
            selfUpdate,
            output: runRes.output,
            error: runRes.error
          };
          return Response.json(result, {
            headers: { "cache-control": "no-store" }
          });
        } finally {
          installing.delete(dir);
        }
      } catch (err) {
        return Response.json({
          ok: false,
          packageName,
          error: err?.message || "Update failed"
        }, { status: 200 });
      }
    }
  }), "dsh-plugins-update: update route");
}
export {
  Config,
  apply,
  inject,
  name
};
