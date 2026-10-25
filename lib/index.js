// src/index.ts
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
var name = "dsh-plugins-update";
var inject = ["connection"];
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
async function fetchNpmPackageInfo(packageName) {
  const encodedName = encodeURIComponent(packageName).replace(/^%40/, "@");
  const fetchEndpoints = [
    // 1. npmmirror (China domestic high speed, primary)
    async () => {
      const res = await fetch(`https://registry.npmmirror.com/${encodedName}/latest`, {
        headers: { "accept": "application/json" },
        signal: AbortSignal.timeout(4e3)
      });
      if (!res.ok) throw new Error(`npmmirror HTTP ${res.status}`);
      return await res.json();
    },
    // 2. npmjs.org official
    async () => {
      const res = await fetch(`https://registry.npmjs.org/${encodedName}/latest`, {
        headers: { "accept": "application/json" },
        signal: AbortSignal.timeout(5e3)
      });
      if (!res.ok) throw new Error(`npmjs HTTP ${res.status}`);
      return await res.json();
    }
  ];
  try {
    const data = await Promise.any(fetchEndpoints.map((fn) => fn()));
    if (data && typeof data.version === "string") {
      return {
        version: data.version,
        releaseDate: data.time?.[data.version],
        description: data.description
      };
    }
  } catch {
  }
  throw new Error(`Package ${packageName} not found on npm`);
}
async function runUpdateCommand(profileDir, profileName, packageName, targetVersion, source) {
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
  const registryFlag = "--registry=https://registry.npmmirror.com/";
  const execDir = process.execPath ? join(process.execPath, "..") : "";
  const dshCmdPaths = [
    join(execDir, "resources", "runtime", "cli", "bin", "dsh.cmd"),
    "D:\\dsh\\resources\\runtime\\cli\\bin\\dsh.cmd",
    "C:\\dsh\\resources\\runtime\\cli\\bin\\dsh.cmd",
    join(process.env.LOCALAPPDATA || "", "Programs", "DeepSeek Harness", "resources", "runtime", "cli", "bin", "dsh.cmd")
  ];
  let command = "pnpm";
  let args = ["add", spec, registryFlag];
  const useShell = process.platform === "win32";
  for (const p of dshCmdPaths) {
    if (existsSync(p)) {
      command = useShell && p.includes(" ") ? `"${p}"` : p;
      args = ["plugin", "--profile", profileName, "add", spec, registryFlag];
      break;
    }
  }
  return new Promise((resolve) => {
    let output = "";
    let settled = false;
    try {
      const child = spawn(command, args, {
        cwd: profileDir,
        shell: useShell,
        env: {
          ...process.env,
          npm_config_registry: process.env.npm_config_registry || "https://registry.npmmirror.com/"
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
          const afterVersion = readInstalledVersion(profileDir, packageName);
          if (!origin.isGithub && cleanTarget && afterVersion && compareSemver(afterVersion, cleanTarget) < 0) {
            resolve({
              ok: false,
              output,
              error: `Update process exited with 0, but installed version remained ${afterVersion} (expected ${cleanTarget})`
            });
            return;
          }
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
function apply(ctx) {
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
        const { dir } = resolveProfileDir();
        const diskVersion = readInstalledVersion(dir, body.packageName);
        const clientVersion = body.currentVersion || "0.0.0";
        const current = diskVersion && compareSemver(diskVersion, clientVersion) > 0 ? diskVersion : clientVersion || diskVersion || "0.0.0";
        const origin = resolvePackageOrigin(dir, body.packageName, body.source);
        let latestVersion = current;
        let releaseDate;
        let description;
        let isGithub = false;
        if (origin.isGithub && origin.github) {
          isGithub = true;
          try {
            const ghInfo = await fetchGithubPackageInfo(origin.github.owner, origin.github.repo);
            latestVersion = ghInfo.version;
            description = ghInfo.description;
          } catch (ghErr) {
            try {
              const npmInfo = await fetchNpmPackageInfo(body.packageName);
              latestVersion = npmInfo.version;
              releaseDate = npmInfo.releaseDate;
              description = npmInfo.description;
              isGithub = false;
            } catch {
              latestVersion = current;
            }
          }
        } else {
          try {
            const npmInfo = await fetchNpmPackageInfo(body.packageName);
            latestVersion = npmInfo.version;
            releaseDate = npmInfo.releaseDate;
            description = npmInfo.description;
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
          isGithub
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
        const { dir, profileName } = resolveProfileDir();
        const runRes = await runUpdateCommand(dir, profileName, body.packageName, body.targetVersion, body.source);
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
  apply,
  inject,
  name
};
