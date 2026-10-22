// src/index.ts
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
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
function parseGithubSource(source) {
  if (!source) return null;
  const cleaned = source.trim().replace(/\.git$/, "");
  const match = cleaned.match(/(?:github:|^https?:\/\/github\.com\/|^git@github\.com:)([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
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
async function fetchGithubPackageInfo(owner, repo) {
  const urls = [
    `https://cdn.jsdelivr.net/gh/${owner}/${repo}@main/package.json`,
    `https://fastly.jsdelivr.net/gh/${owner}/${repo}@main/package.json`,
    `https://raw.githubusercontent.com/${owner}/${repo}/main/package.json`,
    `https://api.github.com/repos/${owner}/${repo}/contents/package.json`
  ];
  let lastError = null;
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: {
          "Accept": "application/json",
          "User-Agent": "dsh-plugins-update"
        },
        signal: AbortSignal.timeout(6e3)
      });
      if (res.ok) {
        let pkgJson;
        if (url.includes("api.github.com")) {
          const data = await res.json();
          if (data.content && data.encoding === "base64") {
            const raw = Buffer.from(data.content, "base64").toString("utf8");
            pkgJson = JSON.parse(raw);
          }
        } else {
          pkgJson = await res.json();
        }
        if (pkgJson && typeof pkgJson.version === "string") {
          return {
            version: pkgJson.version,
            description: pkgJson.description
          };
        }
      }
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError || new Error(`Failed to fetch package.json from GitHub (${owner}/${repo})`);
}
async function fetchNpmPackageInfo(packageName) {
  const registries = [
    "https://registry.npmjs.org/",
    "https://registry.npmmirror.com/"
  ];
  let lastError = null;
  for (const registry of registries) {
    try {
      const url = new URL(encodeURIComponent(packageName).replace(/^%40/, "@") + "/latest", registry).toString();
      const res = await fetch(url, {
        headers: { "accept": "application/json" },
        signal: AbortSignal.timeout(6e3)
      });
      if (res.ok) {
        const data = await res.json();
        return {
          version: data.version,
          releaseDate: data.time?.[data.version],
          description: data.description
        };
      }
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError || new Error(`Package ${packageName} not found on npm`);
}
async function runUpdateCommand(profileDir, profileName, packageName, targetVersion, source) {
  let spec;
  const gh = parseGithubSource(source);
  if (gh) {
    spec = `github:${gh.owner}/${gh.repo}`;
  } else if (targetVersion) {
    spec = `${packageName}@${targetVersion}`;
  } else {
    spec = `${packageName}@latest`;
  }
  const execDir = process.execPath ? join(process.execPath, "..") : "";
  const dshCmdPaths = [
    join(execDir, "resources", "runtime", "cli", "bin", "dsh.cmd"),
    "D:\\dsh\\resources\\runtime\\cli\\bin\\dsh.cmd",
    "C:\\dsh\\resources\\runtime\\cli\\bin\\dsh.cmd",
    join(process.env.LOCALAPPDATA || "", "Programs", "DeepSeek Harness", "resources", "runtime", "cli", "bin", "dsh.cmd")
  ];
  let command = "pnpm";
  let args = ["update", spec];
  let useShell = process.platform === "win32";
  for (const p of dshCmdPaths) {
    if (existsSync(p)) {
      command = p;
      args = ["plugin", "--profile", profileName, "update", spec];
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
      child.on("error", (err) => {
        if (settled) return;
        settled = true;
        resolve({
          ok: false,
          output,
          error: `Process error: ${err.message}`
        });
      });
      child.on("close", (code) => {
        if (settled) return;
        settled = true;
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
      setTimeout(() => {
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
        const current = body.currentVersion || "0.0.0";
        const gh = parseGithubSource(body.source) || parseGithubSource(body.packageName);
        let latestVersion = current;
        let releaseDate;
        let description;
        let isGithub = false;
        if (gh) {
          isGithub = true;
          try {
            const ghInfo = await fetchGithubPackageInfo(gh.owner, gh.repo);
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
              throw ghErr;
            }
          }
        } else {
          try {
            const npmInfo = await fetchNpmPackageInfo(body.packageName);
            latestVersion = npmInfo.version;
            releaseDate = npmInfo.releaseDate;
            description = npmInfo.description;
          } catch (npmErr) {
            throw npmErr;
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
          source: body.source,
          isGithub
        };
        return Response.json(result, {
          headers: { "cache-control": "no-store" }
        });
      } catch (err) {
        return Response.json({
          ok: false,
          packageName: "",
          hasUpdate: false,
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
