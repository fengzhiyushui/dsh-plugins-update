// src/index.ts
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
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
function resolveProfileDir() {
  const dshHome = process.env.DSH_HOME || join(homedir(), ".dsh");
  const desktopDir = join(dshHome, "profiles", "desktop");
  if (existsSync(join(desktopDir, "package.json"))) {
    return { dir: desktopDir, profileName: "desktop" };
  }
  const profilesDir = join(dshHome, "profiles");
  for (const name2 of ["desktop", "default", "web"]) {
    const candidate = join(profilesDir, name2);
    if (existsSync(join(candidate, "package.json"))) {
      return { dir: candidate, profileName: name2 };
    }
  }
  return { dir: desktopDir, profileName: "desktop" };
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
function resolveCommand(profileName, spec, registry) {
  const registryFlag = `--registry=${registry}`;
  const useShell = process.platform === "win32";
  const execDir = process.execPath ? join(process.execPath, "..") : "";
  const dshCmdPaths = [
    join(execDir, "resources", "runtime", "cli", "bin", "dsh.cmd"),
    "D:\\dsh\\resources\\runtime\\cli\\bin\\dsh.cmd",
    "C:\\dsh\\resources\\runtime\\cli\\bin\\dsh.cmd",
    join(process.env.LOCALAPPDATA || "", "Programs", "DeepSeek Harness", "resources", "runtime", "cli", "bin", "dsh.cmd")
  ];
  for (const p of dshCmdPaths) {
    if (existsSync(p)) {
      return {
        command: useShell && p.includes(" ") ? `"${p}"` : p,
        args: ["plugin", "--profile", profileName, "add", spec, registryFlag],
        useShell
      };
    }
  }
  return { command: "pnpm", args: ["add", spec, registryFlag], useShell };
}
function runInstall(profileDir, profileName, spec, registry) {
  const { command, args, useShell } = resolveCommand(profileName, spec, registry);
  return new Promise((resolve) => {
    let output = "";
    let settled = false;
    try {
      const child = spawn(command, args, {
        cwd: profileDir,
        shell: useShell,
        env: {
          ...process.env,
          // Keep the env registry identical to the --registry flag
          npm_config_registry: registry
        }
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
            error: "Update command timed out after 120 seconds"
          });
        }
      }, 12e4);
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
  ctx.effect(() => registerFetch({
    path: "/api/dsh-plugins-update/check",
    methods: ["POST"],
    requestBody: "buffered",
    fetch: async (req) => {
      try {
        const body = await req.json();
        if (!body.packageName) {
          return Response.json({ ok: false, error: "packageName is required" }, { status: 400 });
        }
        const settings = readSettings(config);
        const { dir } = resolveProfileDir();
        const diskVersion = readInstalledVersion(dir, body.packageName);
        const clientVersion = body.currentVersion || "0.0.0";
        const current = diskVersion && compareSemver(diskVersion, clientVersion) > 0 ? diskVersion : clientVersion || diskVersion || "0.0.0";
        const origin = resolvePackageOrigin(dir, body.packageName, body.source);
        let latestVersion = current;
        let releaseDate;
        let description;
        let registry;
        let isGithub = false;
        if (origin.isGithub && origin.github) {
          isGithub = true;
          try {
            const ghInfo = await fetchGithubPackageInfo(origin.github.owner, origin.github.repo);
            latestVersion = ghInfo.version;
            description = ghInfo.description;
          } catch (ghErr) {
            try {
              const npmInfo = await fetchNpmPackageInfo(body.packageName, settings);
              latestVersion = npmInfo.version;
              releaseDate = npmInfo.releaseDate;
              description = npmInfo.description;
              registry = npmInfo.registry;
              isGithub = false;
            } catch {
              latestVersion = current;
            }
          }
        } else {
          try {
            const npmInfo = await fetchNpmPackageInfo(body.packageName, settings);
            latestVersion = npmInfo.version;
            releaseDate = npmInfo.releaseDate;
            description = npmInfo.description;
            registry = npmInfo.registry;
          } catch {
            const fallbackGh = origin.repoGithub || origin.github;
            if (fallbackGh) {
              try {
                const ghInfo = await fetchGithubPackageInfo(fallbackGh.owner, fallbackGh.repo);
                latestVersion = ghInfo.version;
                description = ghInfo.description;
              } catch {
                latestVersion = current;
              }
            } else {
              latestVersion = current;
            }
          }
        }
        const hasUpdate = compareSemver(latestVersion, current) > 0;
        const result = {
          ok: true,
          packageName: body.packageName,
          currentVersion: current,
          latestVersion,
          hasUpdate,
          releaseDate,
          description,
          source: body.source || origin.declaredSpec,
          isGithub,
          registry
        };
        return Response.json(result, {
          headers: { "cache-control": "no-store" }
        });
      } catch (err) {
        return Response.json({
          ok: true,
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
      try {
        const body = await req.json();
        if (!body.packageName) {
          return Response.json({ ok: false, error: "packageName is required" }, { status: 400 });
        }
        const settings = readSettings(config);
        const { dir, profileName } = resolveProfileDir();
        const runRes = await runUpdateCommand(settings, dir, profileName, body.packageName, body.targetVersion, body.source);
        if (runRes.ok) {
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
        }
        const result = {
          ok: runRes.ok,
          packageName: body.packageName,
          targetVersion: body.targetVersion,
          source: body.source,
          registryUsed: runRes.registryUsed,
          registryLabel: registryLabel(runRes.registryUsed, settings.customRegistries),
          fellBack: runRes.fellBack,
          output: runRes.output,
          error: runRes.error
        };
        return Response.json(result, {
          headers: { "cache-control": "no-store" }
        });
      } catch (err) {
        return Response.json({
          ok: false,
          packageName: "",
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
