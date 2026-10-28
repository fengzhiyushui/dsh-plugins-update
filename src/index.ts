import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync, unlinkSync, writeFileSync } from 'node:fs';
import * as http from 'node:http';
import * as https from 'node:https';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import * as tls from 'node:tls';
import Schema from '@deepseek-ai/schemastery';
import {
  CANCEL_PATH,
  CHECK_PATH,
  DOMESTIC_REGISTRY,
  ERROR_CODES,
  OFFICIAL_REGISTRY,
  PROGRESS_PATH,
  UPDATE_PATH,
  normalizeRegistryUrl,
  registryLabel,
  type CheckUpdateParams,
  type CheckUpdateResult,
  type CustomRegistry,
  type DoUpdateParams,
  type DoUpdateResult,
  type ErrorCode,
  type PluginSettings,
  type UpdateJobState,
  type UpdatePhase
} from './types.js';

export const name = 'dsh-plugins-update';
export const inject = ['connection'];

/** This plugin's own package name; updating it from inside its own request needs a restart. */
const OWN_PACKAGE_NAME = 'dsh-plugins-update';
/** npm package name rules: lower-case, optional scope, at most 214 characters. */
const PACKAGE_NAME_PATTERN = /^(?:@[a-z0-9][a-z0-9._~-]*\/)?[a-z0-9][a-z0-9._~-]*$/;
/** Exact semantic version accepted as an update target (a leading v/^/~ is stripped first). */
const TARGET_VERSION_PATTERN = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
/** Characters safe to place on a shell command line for the guarded pnpm fallback path. */
const SHELL_SAFE_PATTERN = /^[A-Za-z0-9@._~:/\\+=,-]+$/;

/** Default / allowed bounds of one install command, in seconds (P1 config field). */
const DEFAULT_INSTALL_TIMEOUT_SECONDS = 120;
const MIN_INSTALL_TIMEOUT_SECONDS = 30;
const MAX_INSTALL_TIMEOUT_SECONDS = 900;
/** Git metadata (default branch / head commit / tags) is reused for this long. */
const GITHUB_METADATA_TTL_MS = 10 * 60 * 1000;
/** HTTP defaults: per-attempt timeout, attempts (1 try + 2 retries) and redirects. */
const HTTP_DEFAULT_TIMEOUT_MS = 6000;
const HTTP_MAX_ATTEMPTS = 3;
const HTTP_MAX_REDIRECTS = 3;
const HTTP_MAX_RESPONSE_BYTES = 4 * 1024 * 1024;
const HTTP_ETAG_CACHE_LIMIT = 256;
/** Async install jobs stay queryable for this long after they finish. */
const JOB_TTL_MS = 10 * 60 * 1000;
/** Progress responses only carry the tail of the install log. */
const LOG_TAIL_LIMIT = 2000;
/** Final results carry a longer log tail, still bounded to keep responses small. */
const RESULT_OUTPUT_LIMIT = 8000;
const INSTALL_OUTPUT_LIMIT = 64 * 1024;
/** Auto-registry completeness probing limits from the P1 spec. */
const MAX_LOCK_VERSION_CHECKS = 25;
const REGISTRY_CHECK_CONCURRENCY = 8;
const USER_AGENT = 'dsh-plugins-update';

/** Message-key catalogue reported to the client team; the client maps these locale keys. */
const PHASE_MESSAGE_KEYS: Record<UpdatePhase, string> = {
  queued: 'phaseQueued',
  resolving: 'phaseResolving',
  downloading: 'phaseDownloading',
  installing: 'phaseInstalling',
  verifying: 'phaseVerifying',
  'rolling-back': 'phaseRollingBack',
  done: 'phaseDone',
  failed: 'phaseFailed',
  cancelled: 'phaseCancelled'
};

/** Order of phases, used to keep progress updates from moving backwards. */
const PHASE_RANK: Record<UpdatePhase, number> = {
  queued: 0,
  resolving: 1,
  downloading: 2,
  installing: 3,
  verifying: 4,
  'rolling-back': 5,
  done: 6,
  failed: 6,
  cancelled: 6
};

const TERMINAL_PHASES: ReadonlySet<UpdatePhase> = new Set<UpdatePhase>(['done', 'failed', 'cancelled']);

/** Validate an npm package name from an HTTP request; returns undefined when invalid. */
function readPackageName(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const packageName = value.trim();
  if (!packageName || packageName.length > 214 || !PACKAGE_NAME_PATTERN.test(packageName)) return undefined;
  return packageName;
}

/** Validate the requested update target; `undefined` means "latest", `null` means invalid. */
function readTargetVersion(value: unknown): string | undefined | null {
  if (value === undefined || value === null || value === '') return undefined;
  if (typeof value !== 'string') return null;
  const version = value.trim().replace(/^[v^~]/, '');
  if (!version) return undefined;
  return TARGET_VERSION_PATTERN.test(version) ? version : null;
}

/** `@deepseek-ai/*` packages are official, even on DSH versions that do not expose `official` to slots. */
function isOfficialPackageName(packageName: string): boolean {
  return packageName.startsWith('@deepseek-ai/');
}

// Mark a schema volatile when the running schemastery supports it, so setting changes apply without a restart
function live<T>(schema: T): T {
  const s = schema as any;
  return typeof s?.volatile === 'function' ? s.volatile() : schema;
}

// Plugin configuration (persisted by DSH in the profile's cordis.patch.yml under `id: dsh-plugins-update`)
// Descriptions are bilingual ("中文 / English") because the Host renders the raw description in both locales.
export const Config: Schema<any> = Schema.object({
  registry: live(
    Schema.string()
      .default('auto')
      .description(
        '更新源：auto（自动）/ npmjs（npm 官方源）/ npmmirror（DSH 同款国内源）/ 自定义源 URL；Update source: auto | npmjs | npmmirror | custom https URL'
      )
  ),
  customRegistries: live(
    Schema.array(
      Schema.object({
        name: Schema.string().default(''),
        url: Schema.string().default('')
      })
    )
      .default([])
      .description('用户自行添加的更新源列表 / Custom update registries')
  ),
  fallbackToOfficial: live(
    Schema.boolean()
      .default(true)
      .description('使用非官方源更新失败时，自动改用 npm 官方源重试一次 / Retry once on the official npm registry after a failure')
  ),
  installTimeoutSeconds: live(
    Schema.number()
      .default(DEFAULT_INSTALL_TIMEOUT_SECONDS)
      .description(
        `安装超时（秒，${MIN_INSTALL_TIMEOUT_SECONDS}-${MAX_INSTALL_TIMEOUT_SECONDS}）/ Install timeout (seconds, ${MIN_INSTALL_TIMEOUT_SECONDS}-${MAX_INSTALL_TIMEOUT_SECONDS})`
      )
  )
});

// Read a config field that may be a plain value or a volatile wrapper with `.get()`
function readField<T>(field: any, fallback: T): T {
  let raw: any = field;
  if (field && typeof field === 'object' && typeof field.get === 'function') {
    try {
      raw = field.get();
    } catch {
      raw = undefined;
    }
  }
  return raw === undefined || raw === null ? fallback : (raw as T);
}

function readSettings(config: any): PluginSettings {
  const registryRaw = readField<string>(config?.registry, 'auto');
  const customRaw = readField<any[]>(config?.customRegistries, []);
  const fallback = readField<boolean>(config?.fallbackToOfficial, true);
  const timeoutRaw = Number(readField<number>(config?.installTimeoutSeconds, DEFAULT_INSTALL_TIMEOUT_SECONDS));
  const installTimeoutSeconds = Number.isFinite(timeoutRaw)
    ? Math.min(MAX_INSTALL_TIMEOUT_SECONDS, Math.max(MIN_INSTALL_TIMEOUT_SECONDS, Math.round(timeoutRaw)))
    : DEFAULT_INSTALL_TIMEOUT_SECONDS;

  const customRegistries: CustomRegistry[] = Array.isArray(customRaw)
    ? customRaw
        .map(item => ({
          name: typeof item?.name === 'string' ? item.name.trim() : '',
          url: normalizeRegistryUrl(item?.url) ?? ''
        }))
        .filter(item => item.url)
    : [];

  let registry = typeof registryRaw === 'string' ? registryRaw.trim() : 'auto';
  if (registry !== 'auto' && registry !== 'npmjs' && registry !== 'npmmirror') {
    registry = normalizeRegistryUrl(registry) ?? 'auto';
  }

  return { registry, customRegistries, fallbackToOfficial: fallback !== false, installTimeoutSeconds };
}

// --- Semantic version comparison (full prerelease precedence, P1) ----------------------

interface ParsedSemver {
  major: number;
  minor: number;
  patch: number;
  prerelease: string[];
}

/** Parse `v1.2.3-beta.1+build` tolerantly; returns null for non-semver strings. */
function parseSemver(input: string): ParsedSemver | null {
  if (typeof input !== 'string') return null;
  const cleaned = input.trim().replace(/^[=vV]+/, '');
  const withoutBuild = cleaned.split('+')[0];
  const match = withoutBuild.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?(?:-([0-9A-Za-z.-]+))?$/);
  if (!match) return null;
  return {
    major: Number(match[1]),
    minor: match[2] === undefined ? 0 : Number(match[2]),
    patch: match[3] === undefined ? 0 : Number(match[3]),
    prerelease: match[4] ? match[4].split('.') : []
  };
}

/** `true` when a prerelease identifier is a numeric one (leading zeros are compared numerically). */
function isNumericIdentifier(value: string): boolean {
  return /^\d+$/.test(value);
}

/** Semver prerelease precedence: numeric < alphanumeric, shorter identifier list wins on a prefix. */
function comparePrerelease(left: string[], right: string[]): number {
  if (left.length === 0 && right.length === 0) return 0;
  if (left.length === 0) return 1;
  if (right.length === 0) return -1;

  const length = Math.max(left.length, right.length);
  for (let i = 0; i < length; i += 1) {
    const a = left[i];
    const b = right[i];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
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

/** Tolerant fallback for non-semver strings: compares leading numeric groups, then the raw text. */
function compareTolerant(v1: string, v2: string): number {
  const clean = (value: string) => String(value ?? '').trim().replace(/^[vV]+/, '');
  const left = clean(v1);
  const right = clean(v2);
  const leftNumbers = left.match(/\d+/g)?.map(Number) ?? [];
  const rightNumbers = right.match(/\d+/g)?.map(Number) ?? [];
  const length = Math.max(leftNumbers.length, rightNumbers.length);
  for (let i = 0; i < length; i += 1) {
    const a = leftNumbers[i];
    const b = rightNumbers[i];
    if (a === undefined) return -1;
    if (b === undefined) return 1;
    if (a !== b) return a > b ? 1 : -1;
  }
  if (left === right) return 0;
  return left > right ? 1 : -1;
}

/** Returns >0 when v1 > v2, <0 when v1 < v2, 0 when equal. Build metadata is ignored. */
function compareSemver(v1: string, v2: string): number {
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

// Parse GitHub owner & repo from any string (spec, url, repository field)
function parseGithubSource(str?: string): { owner: string; repo: string } | null {
  if (typeof str !== 'string') return null;

  const cleaned = str
    .trim()
    .replace(/^git\+/, '')
    .replace(/#.*$/, '')
    .replace(/\.git$/i, '')
    .replace(/\/+$/, '');
  if (!cleaned) return null;

  const match = cleaned.match(
    /(?:github:|^https?:\/\/github\.com\/|^git@github\.com:|^git:\/\/github\.com\/|^ssh:\/\/git@github\.com\/)([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)/i
  );
  if (match) {
    return { owner: match[1], repo: match[2] };
  }

  // Bare owner/repo (e.g. fengzhiyushui/dsh-plugins-update)
  if (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(cleaned)) {
    const parts = cleaned.split('/');
    return { owner: parts[0], repo: parts[1] };
  }

  return null;
}

// Profile directories this installation may serve, preferring the active/desktop profile.
function profileCandidates(): Array<{ dir: string; profileName: string }> {
  const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh');
  const profilesDir = join(dshHome, 'profiles');
  const preferred = (process.env.DSH_PROFILE || '').trim();
  const names = [...new Set([preferred, 'desktop', 'default', 'web'].filter(Boolean))];

  const candidates = names
    .map(profileName => ({ dir: join(profilesDir, profileName), profileName }))
    .filter(candidate => existsSync(join(candidate.dir, 'package.json')));

  if (candidates.length === 0) candidates.push({ dir: join(profilesDir, 'desktop'), profileName: 'desktop' });
  return candidates;
}

// Locate the profile directory that owns the package, falling back to the desktop profile.
function resolveProfileDir(packageName?: string): { dir: string; profileName: string } {
  const candidates = profileCandidates();

  if (packageName) {
    const owner = candidates.find(candidate => {
      const dependencies = readProfileDependencies(candidate.dir);
      return Object.prototype.hasOwnProperty.call(dependencies, packageName);
    });
    if (owner) return owner;
  }

  return candidates.find(candidate => candidate.profileName === 'desktop') ?? candidates[0];
}

/** The subset of the Host plugin manager's `BundleInfo` this plugin relies on. */
interface BundleInfo {
  name?: string;
  official?: boolean;
  installed?: boolean;
  availability?: string;
  /** The spec `pnpm add` accepts for a profile dependency (GitHub installs appear as `github:owner/repo`). */
  source?: string;
  removable?: boolean;
  installTarget?: { spec?: string; version?: string };
}

/** Best-effort read of the Host plugin-manager metadata for one bundle; undefined when unavailable. */
async function readBundleInfo(ctx: any, packageName: string): Promise<BundleInfo | undefined> {
  for (const service of ['pluginManager', 'plugin-manager']) {
    try {
      const manager = ctx?.get?.(service);
      if (typeof manager?.listBundles !== 'function') continue;
      const bundles = await manager.listBundles();
      if (!Array.isArray(bundles)) continue;
      const bundle = bundles.find((item: any) => item && item.name === packageName);
      if (bundle) return bundle as BundleInfo;
    } catch {}
  }
  return undefined;
}

interface GuardFailure {
  error: string;
  errorCode: ErrorCode;
}

// Reject official plugins (DSH owns their update entry) and bundles the profile does not install.
function bundleGuardError(packageName: string, bundle: BundleInfo | undefined): GuardFailure | undefined {
  if (bundle?.official === true) {
    return {
      error: '官方插件由 DSH 自带的更新入口管理，请使用插件页右上角的「更新」按钮',
      errorCode: ERROR_CODES.officialPlugin
    };
  }
  if (bundle?.installed === false) {
    return {
      error: '该插件未安装到当前 profile，无法更新',
      errorCode: ERROR_CODES.notInstalled
    };
  }
  // Older DSH versions may not report `official`; official packages all live in this npm scope.
  if (!bundle && isOfficialPackageName(packageName)) {
    return {
      error: '官方插件由 DSH 自带的更新入口管理，请使用插件页右上角的「更新」按钮',
      errorCode: ERROR_CODES.officialPlugin
    };
  }
  return undefined;
}

// Read installed version directly from node_modules/<packageName>/package.json on disk
function readInstalledVersion(profileDir: string, packageName: string): string | undefined {
  const installedPkgJsonPath = join(profileDir, 'node_modules', packageName, 'package.json');
  if (existsSync(installedPkgJsonPath)) {
    try {
      const pkgJson = JSON.parse(readFileSync(installedPkgJsonPath, 'utf8'));
      if (typeof pkgJson.version === 'string' && pkgJson.version.trim()) {
        return pkgJson.version.trim();
      }
    } catch {}
  }
  return undefined;
}

// Read the profile manifest's direct dependencies
function readProfileDependencies(profileDir: string): Record<string, string> {
  const manifestPath = join(profileDir, 'package.json');
  if (!existsSync(manifestPath)) return {};
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    return {
      ...(manifest?.optionalDependencies || {}),
      ...(manifest?.devDependencies || {}),
      ...(manifest?.dependencies || {})
    };
  } catch {
    return {};
  }
}

interface PackageOrigin {
  isGithub: boolean;
  github?: { owner: string; repo: string };
  repoGithub?: { owner: string; repo: string };
  declaredSpec?: string;
}

// Resolve package origin from profile manifest and installed node_modules
function resolvePackageOrigin(profileDir: string, packageName: string, explicitSource?: string): PackageOrigin {
  // Read repository metadata from installed package.json as fallback info only (NOT install origin)
  let repoGithub: { owner: string; repo: string } | undefined;
  const installedPkgJsonPath = join(profileDir, 'node_modules', packageName, 'package.json');
  if (existsSync(installedPkgJsonPath)) {
    try {
      const pkgJson = JSON.parse(readFileSync(installedPkgJsonPath, 'utf8'));
      const repoUrl = typeof pkgJson.repository === 'string' ? pkgJson.repository : pkgJson.repository?.url;
      const parsedRepo = parseGithubSource(repoUrl);
      if (parsedRepo) repoGithub = parsedRepo;
    } catch {}
  }

  // 1. Check explicit source passed from client
  const explicitGithub = parseGithubSource(explicitSource);
  if (explicitGithub) {
    return { isGithub: true, github: explicitGithub, repoGithub: repoGithub || explicitGithub, declaredSpec: explicitSource };
  }

  // 2. Check profile's package.json dependencies
  const manifestPath = join(profileDir, 'package.json');
  if (existsSync(manifestPath)) {
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
      const spec =
        manifest?.dependencies?.[packageName] ||
        manifest?.devDependencies?.[packageName] ||
        manifest?.optionalDependencies?.[packageName];
      if (typeof spec === 'string') {
        const github = parseGithubSource(spec);
        if (github) {
          return { isGithub: true, github, repoGithub: repoGithub || github, declaredSpec: spec };
        }
        // Installed via npm registry / version range
        return { isGithub: false, repoGithub, declaredSpec: spec };
      }
    } catch {}
  }

  return { isGithub: false, repoGithub };
}

function encodePackageName(packageName: string): string {
  return encodeURIComponent(packageName).replace(/^%40/, '@');
}

// --- HTTP client (no new dependencies, P1) ---------------------------------------------
// node:https based GET with:
//  * per-request timeout and 2 retries with backoff on network errors / 5xx / 429
//  * conditional requests (ETag / If-None-Match / 304) for GitHub API metadata
//  * optional HTTPS_PROXY / HTTP_PROXY / NO_PROXY support (CONNECT tunnel + TLS wrap)
// Tokens are never logged: all URL/error text passes through redactSecrets().

interface HttpGetOptions {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxAttempts?: number;
  /** Reuse the cached body when the server answers 304 to If-None-Match. */
  etagCache?: boolean;
  /** Force a fresh response even when an ETag entry exists. */
  noCache?: boolean;
}

interface HttpGetResult {
  status: number;
  headers: http.IncomingHttpHeaders;
  body: string;
  fromCache: boolean;
}

interface HttpErrorOptions {
  status?: number;
  headers?: http.IncomingHttpHeaders;
  url?: string;
  retryable?: boolean;
}

/** HTTP failure with the status/headers needed to classify rate-limit / auth / offline errors. */
class HttpError extends Error {
  readonly status?: number;
  readonly headers?: http.IncomingHttpHeaders;
  readonly url?: string;
  readonly retryable: boolean;

  constructor(message: string, options: HttpErrorOptions = {}) {
    super(message);
    this.name = 'HttpError';
    this.status = options.status;
    this.headers = options.headers;
    this.url = options.url;
    this.retryable = options.retryable === true;
  }
}

/** Machine-readable remote failure carrying one of the shared ERROR_CODES values. */
class RemoteError extends Error {
  readonly errorCode: ErrorCode;
  readonly status?: number;

  constructor(errorCode: ErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'RemoteError';
    this.errorCode = errorCode;
    this.status = status;
  }
}

const etagCache = new Map<string, { etag: string; body: string; headers: http.IncomingHttpHeaders; at: number }>();
const proxyAgentCache = new Map<string, https.Agent>();

function delay(ms: number): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    timer.unref?.();
  });
}

/** Match NO_PROXY entries (host, domain suffix, `*.domain`, `*`, optional port). */
function isNoProxyTarget(hostname: string, noProxyValue: string | undefined): boolean {
  if (!noProxyValue) return false;
  const host = hostname.toLowerCase();
  for (const part of noProxyValue.split(',')) {
    const entry = part.trim().toLowerCase();
    if (!entry) continue;
    if (entry === '*') return true;
    const withoutPort = entry.includes(':') && !entry.startsWith('[') ? entry.slice(0, entry.lastIndexOf(':')) : entry;
    const domain = withoutPort.replace(/^\*\.?/, '').replace(/^\./, '');
    if (!domain) continue;
    if (host === domain || host.endsWith(`.${domain}`)) return true;
  }
  return false;
}

/** Resolve the proxy for a target URL from standard env vars (Node's fetch does not do this). */
function proxyUrlFor(target: URL): URL | null {
  const env = process.env;
  if (isNoProxyTarget(target.hostname, env.NO_PROXY || env.no_proxy)) return null;
  const raw =
    target.protocol === 'https:'
      ? env.HTTPS_PROXY || env.https_proxy || env.ALL_PROXY || env.all_proxy
      : env.HTTP_PROXY || env.http_proxy || env.ALL_PROXY || env.all_proxy;
  const value = typeof raw === 'string' ? raw.trim() : '';
  if (!value) return null;
  try {
    const proxy = new URL(value);
    if (proxy.protocol !== 'http:' && proxy.protocol !== 'https:') return null;
    return proxy;
  } catch {
    return null;
  }
}

/**
 * HTTPS agent that CONNECTs through an HTTP(S) proxy and wraps the tunnel in TLS.
 * This is the same trick undici's ProxyAgent uses, implemented without adding a dependency.
 */
class ProxyHttpsAgent extends https.Agent {
  private readonly proxyUrl: URL;

  constructor(proxyUrl: URL) {
    super({ keepAlive: false });
    this.proxyUrl = proxyUrl;
  }

  override createConnection(options: any, callback?: (error: Error | null, stream: any) => void): any {
    const proxy = this.proxyUrl;
    const targetHost = String(options?.host ?? '');
    const targetPort = Number(options?.port) || 443;
    const proxyPort = proxy.port ? Number(proxy.port) : proxy.protocol === 'https:' ? 443 : 80;
    const proxyModule = proxy.protocol === 'https:' ? https : http;
    let settled = false;
    const finish = (error: Error | null, stream?: any) => {
      if (settled) return;
      settled = true;
      callback?.(error, stream);
    };

    let connectRequest: http.ClientRequest;
    try {
      connectRequest = proxyModule.request({
        host: proxy.hostname,
        port: proxyPort,
        method: 'CONNECT',
        path: `${targetHost}:${targetPort}`,
        headers: { host: `${targetHost}:${targetPort}` },
        timeout: 15000
      });
    } catch (error: any) {
      finish(error instanceof Error ? error : new Error(String(error)));
      return undefined;
    }

    connectRequest.once('connect', (response: http.IncomingMessage, socket: any) => {
      if (response.statusCode !== 200) {
        try {
          socket.destroy();
        } catch {}
        finish(new Error(`Proxy CONNECT failed with HTTP ${response.statusCode}`));
        return;
      }
      const secureSocket = tls.connect({ socket, servername: targetHost }, () => finish(null, secureSocket));
      secureSocket.once('error', error => finish(error));
    });
    connectRequest.once('error', error => finish(error));
    connectRequest.once('timeout', () => connectRequest.destroy(new Error('Proxy connect timed out')));
    connectRequest.end();
    return undefined;
  }
}

function getProxyHttpsAgent(proxy: URL): https.Agent {
  const key = proxy.href;
  let agent = proxyAgentCache.get(key);
  if (!agent) {
    agent = new ProxyHttpsAgent(proxy);
    proxyAgentCache.set(key, agent);
  }
  return agent;
}

/** One GET request (no retries), optionally tunnelled through the env proxy. */
function rawRequest(target: URL, headers: Record<string, string>, timeoutMs: number): Promise<HttpGetResult> {
  return new Promise<HttpGetResult>((resolve, reject) => {
    let settled = false;
    let watchdog: NodeJS.Timeout | undefined;

    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      if (watchdog) clearTimeout(watchdog);
      action();
    };
    const fail = (error: Error) => finish(() => reject(error));

    const onResponse = (response: http.IncomingMessage) => {
      const chunks: Buffer[] = [];
      let size = 0;
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > HTTP_MAX_RESPONSE_BYTES) {
          try {
            response.destroy();
          } catch {}
          fail(new Error('HTTP response body exceeded the size limit'));
          return;
        }
        chunks.push(chunk);
      });
      response.on('end', () => {
        finish(() =>
          resolve({
            status: response.statusCode ?? 0,
            headers: response.headers,
            body: Buffer.concat(chunks).toString('utf8'),
            fromCache: false
          })
        );
      });
      response.on('error', error => fail(error));
    };

    let request: http.ClientRequest;
    try {
      request = createRequest(target, headers, onResponse);
    } catch (error: any) {
      fail(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    watchdog = setTimeout(() => {
      request.destroy(new Error(`HTTP request timed out after ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    watchdog.unref?.();

    request.once('error', error => fail(error));
    request.end();
  });
}

function createRequest(
  target: URL,
  headers: Record<string, string>,
  onResponse: (response: http.IncomingMessage) => void
): http.ClientRequest {
  const proxy = proxyUrlFor(target);

  if (target.protocol === 'https:') {
    return https.request(target, { method: 'GET', headers, agent: proxy ? getProxyHttpsAgent(proxy) : undefined }, onResponse);
  }

  if (proxy) {
    const proxyPort = proxy.port ? Number(proxy.port) : proxy.protocol === 'https:' ? 443 : 80;
    const proxiedHeaders = { ...headers, host: target.host };
    const requestOptions: https.RequestOptions = {
      host: proxy.hostname,
      port: proxyPort,
      method: 'GET',
      path: target.href,
      headers: proxiedHeaders
    };
    return proxy.protocol === 'https:'
      ? https.request(requestOptions, onResponse)
      : http.request(requestOptions as http.RequestOptions, onResponse);
  }

  return http.request(target, { method: 'GET', headers }, onResponse);
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 425 || status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}

/** Network-level errors worth retrying (TLS certificate failures are not. */
function isRetryableNetworkError(error: any): boolean {
  if (error instanceof HttpError) return error.retryable;
  const message = String(error?.message ?? '');
  if (/certificate|CERT_|self-signed/i.test(message)) return false;
  const code = typeof error?.code === 'string' ? error.code : '';
  if (
    [
      'ECONNRESET',
      'ECONNREFUSED',
      'ETIMEDOUT',
      'EAI_AGAIN',
      'EPIPE',
      'ENOTFOUND',
      'EHOSTUNREACH',
      'ENETUNREACH',
      'UND_ERR_CONNECT_TIMEOUT',
      'UND_ERR_HEADERS_TIMEOUT',
      'UND_ERR_BODY_TIMEOUT'
    ].includes(code)
  ) {
    return true;
  }
  return /socket hang up|timed out|timeout/i.test(message);
}

function readRetryAfterMs(headers?: http.IncomingHttpHeaders): number | undefined {
  if (!headers) return undefined;
  const raw = headers['retry-after'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds > 0) return Math.min(3000, Math.round(seconds * 1000));
  return undefined;
}

function isGithubRateLimited(headers?: http.IncomingHttpHeaders): boolean {
  if (!headers) return false;
  const raw = headers['x-ratelimit-remaining'];
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === '0';
}

async function httpGetFollowingRedirects(target: URL, options: HttpGetOptions, depth: number): Promise<HttpGetResult> {
  const cacheKey = target.href;
  const cached = options.etagCache && !options.noCache ? etagCache.get(cacheKey) : undefined;
  const headers: Record<string, string> = {
    'user-agent': USER_AGENT,
    accept: 'application/json',
    ...(options.headers ?? {})
  };
  if (cached?.etag) headers['if-none-match'] = cached.etag;

  const response = await rawRequest(target, headers, options.timeoutMs ?? HTTP_DEFAULT_TIMEOUT_MS);

  if (response.status === 304 && cached) {
    cached.at = Date.now();
    return { status: 200, headers: cached.headers, body: cached.body, fromCache: true };
  }

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.location;
    if (location && depth < HTTP_MAX_REDIRECTS) {
      let next: URL;
      try {
        next = new URL(location, target);
      } catch {
        throw new HttpError('Invalid redirect location', { status: response.status, retryable: false });
      }
      if (next.protocol !== 'http:' && next.protocol !== 'https:') {
        throw new HttpError('Unsupported redirect protocol', { status: response.status, retryable: false });
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
    if (typeof etag === 'string' && etag) {
      if (etagCache.size >= HTTP_ETAG_CACHE_LIMIT) {
        const oldest = etagCache.keys().next().value;
        if (oldest) etagCache.delete(oldest);
      }
      etagCache.set(cacheKey, { etag, body: response.body, headers: response.headers, at: Date.now() });
    }
  }

  return { ...response, fromCache: false };
}

/** GET with per-request timeout and up to `maxAttempts` attempts (2 retries by default). */
async function httpGet(rawUrl: string, options: HttpGetOptions = {}): Promise<HttpGetResult> {
  const maxAttempts = Math.max(1, options.maxAttempts ?? HTTP_MAX_ATTEMPTS);
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await httpGetFollowingRedirects(new URL(rawUrl), options, 0);
    } catch (error: any) {
      lastError = error;
      if (attempt >= maxAttempts || !isRetryableNetworkError(error)) break;
      const retryAfter = error instanceof HttpError ? readRetryAfterMs(error.headers) : undefined;
      await delay(retryAfter ?? 250 * attempt + Math.floor(Math.random() * 150));
    }
  }

  throw lastError instanceof Error ? lastError : new Error('HTTP request failed');
}

async function httpGetJson<T>(rawUrl: string, options: HttpGetOptions = {}): Promise<T> {
  const response = await httpGet(rawUrl, options);
  try {
    return JSON.parse(response.body) as T;
  } catch {
    let host = 'remote server';
    try {
      host = new URL(rawUrl).host;
    } catch {}
    throw new HttpError(`Response from ${host} is not valid JSON`, { retryable: false });
  }
}

// --- Secret handling / remote error classification -------------------------------------

/** GitHub token from the environment only (never persisted, never logged). */
function githubToken(): string | undefined {
  const token = (process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '').trim();
  return token || undefined;
}

function githubApiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'application/vnd.github+json',
    'x-github-api-version': '2022-11-28'
  };
  const token = githubToken();
  if (token) headers.authorization = `Bearer ${token}`;
  return headers;
}

/** Remove GitHub tokens and credential-bearing URLs from anything that may reach a log or response. */
function redactSecrets(input: string): string {
  let text = String(input ?? '');
  const token = githubToken();
  if (token && token.length >= 6) text = text.split(token).join('***');
  text = text.replace(/x-access-token:[^@\s/]+@/gi, 'x-access-token:***@');
  text = text.replace(/(https?:\/\/)[^@\s/]+@github\.com/gi, '$1***@github.com');
  return text;
}

/** Map a GitHub API failure to a shared error code with a clear Chinese fallback message. */
function githubRemoteError(error: any, owner: string, repo: string): RemoteError {
  if (error instanceof RemoteError) return error;
  if (error instanceof HttpError) {
    const status = error.status;
    if (status === 429 || (status === 403 && isGithubRateLimited(error.headers))) {
      return new RemoteError(
        ERROR_CODES.rateLimited,
        `GitHub API 请求次数受限（${owner}/${repo}），请稍后重试；设置 GITHUB_TOKEN 可提升额度`,
        status
      );
    }
    if (status === 401 || status === 403 || status === 404) {
      return new RemoteError(
        ERROR_CODES.githubAuth,
        `无法访问 GitHub 仓库 ${owner}/${repo}：仓库可能不存在或为私有仓库；私有仓库请设置 GITHUB_TOKEN 或 GH_TOKEN 后重试`,
        status
      );
    }
    return new RemoteError(ERROR_CODES.offline, `访问 GitHub 失败：${redactSecrets(error.message)}`, status);
  }
  return new RemoteError(ERROR_CODES.offline, `访问 GitHub 失败：${redactSecrets(error?.message || '网络错误')}`);
}

/** Map an npm registry failure to the matching shared error code. */
function npmRemoteError(error: any, registry: string): RemoteError {
  if (error instanceof RemoteError) return error;
  if (error instanceof HttpError) {
    const status = error.status;
    if (status === 429) {
      return new RemoteError(ERROR_CODES.rateLimited, `更新源 ${registry} 请求受限（429），请稍后重试`, status);
    }
    if (status === 401 || status === 403) {
      return new RemoteError(ERROR_CODES.offline, `更新源 ${registry} 拒绝访问（HTTP ${status}）`, status);
    }
    if (status === 404) {
      return new RemoteError(ERROR_CODES.unknown, `更新源 ${registry} 上找不到该包或版本（HTTP 404）`, status);
    }
    return new RemoteError(ERROR_CODES.unknown, `更新源 ${registry} 返回 HTTP ${status}`, status);
  }
  return new RemoteError(ERROR_CODES.offline, `无法访问更新源 ${registry}：${redactSecrets(error?.message || '网络错误')}`);
}

/** Coarse error-code classification for aggregated check failures. */
function classifyAggregateError(errors: any[]): ErrorCode {
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

// --- GitHub metadata (branch / head commit / tags / package.json) ----------------------

const GITHUB_API_BASE = 'https://api.github.com';

interface GithubTagInfo {
  name: string;
  commit: string;
}

interface GithubRepoMetadata {
  owner: string;
  repo: string;
  defaultBranch: string;
  headCommit?: string;
  tags: GithubTagInfo[];
  isPrivate?: boolean;
  description?: string;
  fetchedAt: number;
}

interface GithubPackageJsonInfo {
  version: string;
  description?: string;
}

const githubRepoCache = new Map<string, GithubRepoMetadata>();
const githubRepoInflight = new Map<string, Promise<GithubRepoMetadata>>();
const githubPackageJsonCache = new Map<string, { fetchedAt: number; info: GithubPackageJsonInfo }>();

function githubRepoKey(owner: string, repo: string): string {
  return `${owner}/${repo}`.toLowerCase();
}

/** `GET /repos/{owner}/{repo}` + head commit + tags. Throws RemoteError for auth/rate-limit failures. */
async function fetchGithubRepoMetadata(owner: string, repo: string): Promise<GithubRepoMetadata> {
  const apiHeaders = githubApiHeaders();

  let repoData: any;
  try {
    repoData = await httpGetJson<any>(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
      headers: apiHeaders,
      etagCache: true,
      timeoutMs: 8000
    });
  } catch (error: any) {
    throw githubRemoteError(error, owner, repo);
  }

  const defaultBranch =
    typeof repoData?.default_branch === 'string' && repoData.default_branch ? repoData.default_branch : 'main';

  // Head commit and tags are best-effort: a rate-limited auxiliary call must not hide the version.
  let headCommit: string | undefined;
  try {
    const commits = await httpGetJson<any[]>(
      `${GITHUB_API_BASE}/repos/${owner}/${repo}/commits?sha=${encodeURIComponent(defaultBranch)}&per_page=1`,
      { headers: apiHeaders, etagCache: true, timeoutMs: 8000 }
    );
    if (Array.isArray(commits) && typeof commits[0]?.sha === 'string') headCommit = commits[0].sha;
  } catch {}

  let tags: GithubTagInfo[] = [];
  try {
    const rawTags = await httpGetJson<any[]>(`${GITHUB_API_BASE}/repos/${owner}/${repo}/tags?per_page=100`, {
      headers: apiHeaders,
      etagCache: true,
      timeoutMs: 8000
    });
    if (Array.isArray(rawTags)) {
      tags = rawTags
        .filter(tag => typeof tag?.name === 'string' && typeof tag?.commit?.sha === 'string')
        .map(tag => ({ name: tag.name as string, commit: tag.commit.sha as string }));
    }
  } catch {}

  return {
    owner,
    repo,
    defaultBranch,
    headCommit,
    tags,
    isPrivate: repoData?.private === true,
    description: typeof repoData?.description === 'string' ? repoData.description : undefined,
    fetchedAt: Date.now()
  };
}

/** Cached (10 minutes) repository metadata; concurrent callers share one request. */
async function getGithubRepoMetadata(owner: string, repo: string, options: { noCache?: boolean } = {}): Promise<GithubRepoMetadata> {
  const key = githubRepoKey(owner, repo);
  if (!options.noCache) {
    const cached = githubRepoCache.get(key);
    if (cached && Date.now() - cached.fetchedAt < GITHUB_METADATA_TTL_MS) return cached;
    const inflight = githubRepoInflight.get(key);
    if (inflight) return inflight;
  }

  const task = fetchGithubRepoMetadata(owner, repo)
    .then(metadata => {
      githubRepoCache.set(key, metadata);
      return metadata;
    })
    .finally(() => {
      if (githubRepoInflight.get(key) === task) githubRepoInflight.delete(key);
    });

  githubRepoInflight.set(key, task);
  return task;
}

/** Find the exact tag for a version, trying `v<version>` first and then `<version>`. */
function findGithubTag(metadata: GithubRepoMetadata | undefined, version: string | undefined): GithubTagInfo | undefined {
  if (!metadata || !version) return undefined;
  const clean = version.trim().replace(/^[vV]/, '');
  const candidates = new Set([`v${clean}`, clean, version.trim()]);
  return metadata.tags.find(tag => candidates.has(tag.name));
}

/**
 * Resolve the commit a tag points to. The tags list already returns a commit for lightweight tags;
 * annotated tags are dereferenced here as a fallback when verification sees a mismatch.
 */
async function resolveGithubTagCommit(owner: string, repo: string, tag: string): Promise<string | undefined> {
  if (!tag) return undefined;
  try {
    const ref = await httpGetJson<any>(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/ref/tags/${encodeURIComponent(tag)}`, {
      headers: githubApiHeaders(),
      timeoutMs: 6000,
      maxAttempts: 2
    });
    const object = ref?.object;
    if (!object || typeof object.sha !== 'string') return undefined;
    if (object.type === 'commit') return object.sha.toLowerCase();
    if (object.type === 'tag') {
      const annotated = await httpGetJson<any>(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/tags/${object.sha}`, {
        headers: githubApiHeaders(),
        timeoutMs: 6000,
        maxAttempts: 2
      });
      const target = annotated?.object;
      if (target && typeof target.sha === 'string' && target.type === 'commit') return target.sha.toLowerCase();
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/** Encode a branch/ref for a raw GitHub URL while keeping path separators readable. */
function encodeGithubRef(ref: string): string {
  return ref
    .split('/')
    .map(segment => encodeURIComponent(segment))
    .join('/');
}

function parseGithubPackageJson(data: any, source: string): GithubPackageJsonInfo {
  if (!data || typeof data.version !== 'string' || !data.version.trim()) {
    throw new Error(`${source} returned no package version`);
  }
  return {
    version: data.version.trim(),
    description: typeof data.description === 'string' ? data.description : undefined
  };
}

/** Read package.json through the GitHub contents API (base64 payload); works for private repos with a token. */
async function loadGithubApiPackageJson(owner: string, repo: string, ref: string): Promise<GithubPackageJsonInfo> {
  const data = await httpGetJson<any>(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/package.json?ref=${encodeURIComponent(ref)}`,
    { headers: githubApiHeaders(), timeoutMs: 8000, maxAttempts: 2 }
  );
  if (data && typeof data.content === 'string' && data.encoding === 'base64') {
    const text = Buffer.from(data.content, 'base64').toString('utf8');
    return parseGithubPackageJson(JSON.parse(text), 'GitHub API');
  }
  throw new Error('GitHub API returned an unexpected package.json payload');
}

/**
 * Read package.json from a GitHub repository at a branch/tag. Keeps the old multi-source race
 * (jsDelivr x2 / raw.githubusercontent / GitHub API) but every endpoint honors the real branch
 * instead of a hardcoded `main`.
 */
async function readGithubPackageJson(
  owner: string,
  repo: string,
  ref: string,
  options: { noCache?: boolean } = {}
): Promise<GithubPackageJsonInfo> {
  const cacheKey = `${owner}/${repo}@${ref}`.toLowerCase();
  if (!options.noCache) {
    const cached = githubPackageJsonCache.get(cacheKey);
    if (cached && Date.now() - cached.fetchedAt < GITHUB_METADATA_TTL_MS) return cached.info;
  }

  const encodedRef = encodeGithubRef(ref);
  const errors: any[] = [];

  const load = async (source: string, url: string, headers: Record<string, string>, timeoutMs: number) => {
    try {
      const data = await httpGetJson<any>(url, { headers, timeoutMs, maxAttempts: 2 });
      return parseGithubPackageJson(data, source);
    } catch (error: any) {
      errors.push(error);
      throw error;
    }
  };

  const attempts: Array<Promise<GithubPackageJsonInfo>> = [
    load('jsDelivr', `https://cdn.jsdelivr.net/gh/${owner}/${repo}@${encodedRef}/package.json`, {}, 4000),
    load('jsDelivr (fastly)', `https://fastly.jsdelivr.net/gh/${owner}/${repo}@${encodedRef}/package.json`, {}, 4000),
    load(
      'raw.githubusercontent.com',
      `https://raw.githubusercontent.com/${owner}/${repo}/${encodedRef}/package.json`,
      {},
      5000
    )
  ];

  // The API endpoint is the only one that works for private repositories (token auth).
  if (githubToken()) {
    attempts.push(
      (async () => {
        try {
          return await loadGithubApiPackageJson(owner, repo, ref);
        } catch (error: any) {
          errors.push(error);
          throw error;
        }
      })()
    );
  }

  let info: GithubPackageJsonInfo | undefined;
  try {
    info = await Promise.any(attempts);
  } catch {
    const detail = errors.length > 0 ? redactSecrets(errors[errors.length - 1]?.message || '') : '';
    throw new RemoteError(
      ERROR_CODES.offline,
      `无法读取 GitHub 仓库 ${owner}/${repo} 的 package.json${detail ? `（${detail}）` : ''}`
    );
  }

  githubPackageJsonCache.set(cacheKey, { fetchedAt: Date.now(), info });
  if (githubPackageJsonCache.size > 64) {
    const oldest = githubPackageJsonCache.keys().next().value;
    if (oldest) githubPackageJsonCache.delete(oldest);
  }
  return info;
}

/**
 * Degraded fallback used when the GitHub API is unavailable (rate limit / network):
 * probe common branch names through the CDN without needing repo metadata.
 */
async function readGithubPackageJsonAnyBranch(
  owner: string,
  repo: string,
  branches: string[]
): Promise<{ branch: string; info: GithubPackageJsonInfo }> {
  const results = await Promise.allSettled(
    branches.map(async branch => ({ branch, info: await readGithubPackageJson(owner, repo, branch) }))
  );
  for (const result of results) {
    if (result.status === 'fulfilled') return result.value;
  }
  throw new RemoteError(ERROR_CODES.offline, `无法读取 GitHub 仓库 ${owner}/${repo} 的 package.json`);
}

// --- pnpm-lock.yaml reading (no YAML dependency) ---------------------------------------

function readTextFile(path: string): string | null {
  try {
    return existsSync(path) ? readFileSync(path, 'utf8') : null;
  } catch {
    return null;
  }
}

function readLockfileText(profileDir: string): string | null {
  return readTextFile(join(profileDir, 'pnpm-lock.yaml'));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Read the commit pnpm pinned for a GitHub dependency from `pnpm-lock.yaml`.
 * pnpm resolves tarball dependencies to `https://codeload.github.com/<owner>/<repo>/tar.gz/<sha>`.
 */
function extractGithubCommit(lockText: string | null, owner: string, repo: string): string | undefined {
  if (!lockText || !owner || !repo) return undefined;
  const ownerPattern = escapeRegExp(owner);
  const repoPattern = escapeRegExp(repo);
  const patterns = [
    new RegExp(`codeload\\.github\\.com/${ownerPattern}/${repoPattern}/tar\\.gz/([0-9a-f]{7,40})`, 'i'),
    new RegExp(`github\\.com/${ownerPattern}/${repoPattern}/(?:archive|tarball|tar\\.gz)/([0-9a-f]{7,40})`, 'i')
  ];
  for (const pattern of patterns) {
    const match = lockText.match(pattern);
    if (match) return match[1].toLowerCase();
  }
  return undefined;
}

/**
 * Extract `name@version` pairs from the `packages:` / `snapshots:` sections of pnpm-lock.yaml.
 * Handles lockfile v6 (`/name@1.2.3:`) and v9 (`'name@1.2.3':`, optional peer suffix).
 */
function parseLockedPackageVersions(lockText: string): Array<{ name: string; version: string }> {
  const entries: Array<{ name: string; version: string }> = [];
  const seen = new Set<string>();
  let section = '';

  for (const line of lockText.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const indent = line.length - line.trimStart().length;

    if (indent === 0) {
      section = trimmed.replace(/^['"]/, '').replace(/['"]$/, '').replace(/:$/, '').trim();
      continue;
    }
    if (section !== 'packages' && section !== 'snapshots') continue;
    if (indent !== 2) continue;

    let key = trimmed;
    if (key.startsWith("'") && key.endsWith("':")) key = key.slice(1, -2);
    else if (key.startsWith('"') && key.endsWith('":')) key = key.slice(1, -2);
    else if (key.endsWith(':')) key = key.slice(0, -1);
    key = key.trim().replace(/^\/+/, '');

    // Scoped names start with '@', so the version separator is the last '@' after the name.
    const atIndex = key.indexOf('@', 1);
    if (atIndex <= 0) continue;
    const packageName = key.slice(0, atIndex);
    let version = key.slice(atIndex + 1);
    // snapshots keys may append peer context, e.g. `1.2.3(react@18.2.0)`
    const peerIndex = version.indexOf('(');
    if (peerIndex >= 0) version = version.slice(0, peerIndex);
    version = version.trim();

    if (!PACKAGE_NAME_PATTERN.test(packageName)) continue;
    // Registry-resolved versions start with a digit; git/url/tarball specs are skipped.
    if (!/^\d/.test(version)) continue;
    if (version.includes('/') || version.includes(':') || version.includes(' ')) continue;

    const id = `${packageName}@${version}`;
    if (seen.has(id)) continue;
    seen.add(id);
    entries.push({ name: packageName, version });
  }

  return entries;
}

/** The manifest spec declared for a package (dependencies / devDependencies / optionalDependencies). */
function readManifestSpec(profileDir: string, packageName: string): string | undefined {
  const manifestPath = join(profileDir, 'package.json');
  if (!existsSync(manifestPath)) return undefined;
  try {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const spec =
      manifest?.dependencies?.[packageName] ??
      manifest?.devDependencies?.[packageName] ??
      manifest?.optionalDependencies?.[packageName];
    return typeof spec === 'string' ? spec : undefined;
  } catch {
    return undefined;
  }
}

interface ProfileSnapshot {
  packageJsonPath: string;
  lockfilePath: string;
  packageJson: string | null;
  lockfile: string | null;
  previousVersion?: string;
  previousSpec?: string;
}

/** Snapshot profile package.json + pnpm-lock.yaml before an install so it can be rolled back. */
function captureProfileSnapshot(profileDir: string, packageName: string): ProfileSnapshot {
  const packageJsonPath = join(profileDir, 'package.json');
  const lockfilePath = join(profileDir, 'pnpm-lock.yaml');
  return {
    packageJsonPath,
    lockfilePath,
    packageJson: readTextFile(packageJsonPath),
    lockfile: readTextFile(lockfilePath),
    previousVersion: readInstalledVersion(profileDir, packageName),
    previousSpec: readManifestSpec(profileDir, packageName)
  };
}

function restoreFile(path: string, content: string | null): void {
  if (content === null) {
    if (existsSync(path)) unlinkSync(path);
    return;
  }
  writeFileSync(path, content, 'utf8');
}

/** The `pnpm add` spec that puts the previously installed revision back on disk. */
function buildRollbackSpec(snapshot: ProfileSnapshot, packageName: string, origin: PackageOrigin): string | undefined {
  if (origin.isGithub && origin.github) {
    const previousCommit = extractGithubCommit(snapshot.lockfile, origin.github.owner, origin.github.repo);
    if (previousCommit) return `github:${origin.github.owner}/${origin.github.repo}#${previousCommit}`;
    const declared = parseGithubSource(snapshot.previousSpec);
    if (declared) {
      const refMatch = (snapshot.previousSpec || '').match(/#([^#\s]+)$/);
      return refMatch ? `github:${declared.owner}/${declared.repo}#${refMatch[1]}` : `github:${declared.owner}/${declared.repo}`;
    }
    return `github:${origin.github.owner}/${origin.github.repo}`;
  }

  const spec = snapshot.previousSpec;
  if (spec && /^(?:npm:|file:|link:|workspace:|portal:|patch:|https?:|git)/i.test(spec)) return spec;
  if (snapshot.previousVersion) return `${packageName}@${snapshot.previousVersion}`;
  if (spec) return `${packageName}@${spec}`;
  return undefined;
}

// --- Registry selection for installs ---------------------------------------------------

/** Registries consulted for version checks, by setting */
function checkRegistries(settings: PluginSettings): string[] {
  switch (settings.registry) {
    case 'auto':
      return [DOMESTIC_REGISTRY, OFFICIAL_REGISTRY];
    case 'npmjs':
      return [OFFICIAL_REGISTRY];
    case 'npmmirror':
      return [DOMESTIC_REGISTRY];
    default:
      return [settings.registry];
  }
}

async function fetchLatestFrom(registry: string, packageName: string) {
  const data = await httpGetJson<any>(`${registry}${encodePackageName(packageName)}/latest`, {
    headers: { accept: 'application/json' },
    timeoutMs: 6000
  });
  if (!data || typeof data.version !== 'string') {
    throw new RemoteError(ERROR_CODES.unknown, `更新源 ${registry} 未返回版本号`);
  }
  return {
    version: data.version as string,
    releaseDate: (data.time?.[data.version] as string | undefined) ?? undefined,
    description: typeof data.description === 'string' ? (data.description as string) : undefined,
    registry
  };
}

// Fetch package metadata from the configured registries.
// In auto mode both built-in registries are queried and the HIGHEST version wins,
// so a lagging mirror can no longer hide a newer release.
async function fetchNpmPackageInfo(
  packageName: string,
  settings: PluginSettings
): Promise<{ version: string; releaseDate?: string; description?: string; registry: string }> {
  const registries = checkRegistries(settings);
  const errors: any[] = [];

  const fetchAll = (targets: string[]) =>
    Promise.allSettled(
      targets.map(async registry => {
        try {
          return await fetchLatestFrom(registry, packageName);
        } catch (error: any) {
          errors.push(npmRemoteError(error, registry));
          throw error;
        }
      })
    );

  const pickHighest = (results: PromiseSettledResult<Awaited<ReturnType<typeof fetchLatestFrom>>>[]) => {
    let best: Awaited<ReturnType<typeof fetchLatestFrom>> | undefined;
    for (const result of results) {
      if (result.status !== 'fulfilled') continue;
      if (!best || compareSemver(result.value.version, best.version) > 0) best = result.value;
    }
    return best;
  };

  let best = pickHighest(await fetchAll(registries));

  if (!best && settings.fallbackToOfficial && !registries.includes(OFFICIAL_REGISTRY)) {
    best = pickHighest(await fetchAll([OFFICIAL_REGISTRY]));
  }

  if (best) return best;
  const firstRemote = errors.find(error => error instanceof RemoteError);
  throw firstRemote ?? new RemoteError(ERROR_CODES.offline, `无法获取 ${packageName} 的远端版本信息`);
}

// Ping a registry; resolves with the URL on a 2xx response, rejects otherwise
async function pingRegistry(registry: string, timeoutMs: number): Promise<string> {
  await httpGet(`${registry}-/ping`, { timeoutMs, maxAttempts: 1 });
  return registry;
}

// Same probing approach DSH's "Add plugin" dialog uses: first 2xx ping wins
async function probeFastestRegistry(): Promise<string | null> {
  try {
    return await Promise.any([pingRegistry(OFFICIAL_REGISTRY, 1500), pingRegistry(DOMESTIC_REGISTRY, 1500)]);
  } catch {
    return null;
  }
}

async function versionExists(registry: string, packageName: string, version: string): Promise<boolean> {
  try {
    await httpGet(`${registry}${encodePackageName(packageName)}/${encodeURIComponent(version)}`, {
      headers: { accept: 'application/json' },
      timeoutMs: 5000,
      maxAttempts: 1
    });
    return true;
  } catch {
    return false;
  }
}

function isRegistrySpec(spec: string): boolean {
  const value = spec.trim();
  if (!value) return false;
  if (/^(?:github:|gitlab:|bitbucket:|git[+:]|git@|https?:|file:|link:|workspace:|npm:|portal:|patch:)/i.test(value)) return false;
  if (parseGithubSource(value)) return false; // bare owner/repo
  return true;
}

/** Run async workers with a bounded concurrency and keep input order. */
async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runnerCount = Math.max(1, Math.min(limit, items.length));
  const runners: Array<Promise<void>> = [];
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

/**
 * Every `name@version` pnpm will have to resolve from a registry during this install.
 * P1: derived from the fully resolved pnpm-lock.yaml package list (transitive dependencies
 * included) instead of only direct dependencies, capped at 25 probes. Falls back to the
 * on-disk direct dependencies for profiles that do not have a lockfile yet.
 */
async function collectRequiredVersions(
  profileDir: string,
  packageName: string,
  targetVersion: string,
  targetIsGithub: boolean
): Promise<Array<{ name: string; version: string }>> {
  const required: Array<{ name: string; version: string }> = [];
  const seen = new Set<string>();
  const add = (name: string, version: string) => {
    if (!name || !version) return;
    const id = `${name}@${version}`;
    if (seen.has(id)) return;
    seen.add(id);
    required.push({ name, version });
  };

  // The target itself is the most important probe when it comes from a registry.
  if (!targetIsGithub && targetVersion) add(packageName, targetVersion);

  const lockText = readLockfileText(profileDir);
  if (lockText) {
    for (const entry of parseLockedPackageVersions(lockText)) {
      if (entry.name === packageName) continue;
      add(entry.name, entry.version);
      if (required.length >= MAX_LOCK_VERSION_CHECKS) break;
    }
  }

  // Fallback for profiles without a lockfile (first install): direct dependencies currently on disk.
  if (required.length === 0) {
    const dependencies = readProfileDependencies(profileDir);
    for (const [dependency, spec] of Object.entries(dependencies)) {
      if (dependency === packageName || typeof spec !== 'string' || !isRegistrySpec(spec)) continue;
      const installed = readInstalledVersion(profileDir, dependency);
      if (installed) add(dependency, installed);
    }
  }

  return required.slice(0, MAX_LOCK_VERSION_CHECKS);
}

async function resolveInstallRegistry(
  settings: PluginSettings,
  profileDir: string,
  packageName: string,
  targetVersion: string,
  targetIsGithub: boolean
): Promise<{ registry: string; reason: string }> {
  if (settings.registry === 'npmjs') return { registry: OFFICIAL_REGISTRY, reason: '设置中指定' };
  if (settings.registry === 'npmmirror') return { registry: DOMESTIC_REGISTRY, reason: '设置中指定' };
  if (settings.registry !== 'auto') return { registry: settings.registry, reason: '设置中指定' };

  // auto
  const fastest = await probeFastestRegistry();
  if (fastest === OFFICIAL_REGISTRY) {
    return { registry: OFFICIAL_REGISTRY, reason: '自动模式：npm 官方源响应更快' };
  }

  // Domestic registry is faster (or both pings failed): make sure it actually has everything this install needs.
  const required = await collectRequiredVersions(profileDir, packageName, targetVersion, targetIsGithub);
  if (required.length === 0) {
    return {
      registry: fastest ?? DOMESTIC_REGISTRY,
      reason: fastest ? '自动模式：国内源响应更快' : '自动模式：两个源均未响应 ping，按国内源尝试'
    };
  }

  const present = await mapWithConcurrency(required, REGISTRY_CHECK_CONCURRENCY, required => versionExists(DOMESTIC_REGISTRY, required.name, required.version));
  const missing = required.filter((item, index) => !present[index]);

  if (missing.length === 0) {
    return { registry: DOMESTIC_REGISTRY, reason: '自动模式：国内源响应更快，且包含本次所需的全部版本' };
  }
  const preview = missing
    .slice(0, 5)
    .map(item => `${item.name}@${item.version}`)
    .join('、');
  return {
    registry: OFFICIAL_REGISTRY,
    reason: `自动模式：国内源暂缺 ${preview}${missing.length > 5 ? ' 等' : ''}，改用 npm 官方源`
  };
}

// --- Install execution -----------------------------------------------------------------

/*
 * Host install channel evaluation (P1 item 12):
 * We evaluated moving from the DSH CLI spawn to `ctx.get('pluginManager').installBundle()`.
 * `installBundle` is exposed by the Host through its Remote service, so it only offers the
 * Host's own install path: no per-registry choice (`--registry`), no custom registry and no
 * official-registry fallback, and no arbitrary GitHub tag/commit spec. That is exactly the
 * feature set this plugin exists for, so the DSH CLI spawn is kept:
 *
 *   process.execPath --expose-internals <app.asar dsh cli.js> plugin --profile <name> add <spec> --registry=<url>
 *
 * This is the same code path DSH's own "Add plugin" dialog uses (shell-free, `ELECTRON_RUN_AS_NODE=1`).
 * Host progress events (`plugin-manager/install-state`, `install-log`) are not consumed directly;
 * progress, cancel, timeout, verification and rollback are implemented locally around the child
 * process, and `refreshAfterInstall()` still asks the Host to reconcile the profile afterwards.
 */

/** Candidate `cli.js` entries of the DSH desktop Host, next to the running executable. */
function desktopCliCandidates(): string[] {
  const candidates: string[] = [];
  const override = process.env.DSH_CLI_JS?.trim();
  if (override) candidates.push(override);

  const cliRel = join('resources', 'app.asar', 'dsh', 'node_modules', '@deepseek-ai', 'dsh-desktop-host', 'lib', 'cli.js');
  const execDir = process.execPath ? dirname(process.execPath) : '';
  if (execDir) {
    candidates.push(join(execDir, cliRel));
    candidates.push(join(execDir, '..', 'Resources', cliRel));
  }
  const localAppData = process.env.LOCALAPPDATA;
  if (localAppData) candidates.push(join(localAppData, 'Programs', 'DeepSeek Harness', cliRel));
  return candidates;
}

/**
 * GitHub auth for private repositories without persisting anything: git reads these env vars
 * as an in-memory `insteadOf` rewrite, and they are only ever passed to the child process.
 */
function withGithubAuthEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const token = githubToken();
  if (!token) return env;
  return {
    ...env,
    GH_TOKEN: token,
    GITHUB_TOKEN: token,
    GIT_CONFIG_COUNT: '1',
    GIT_CONFIG_KEY_0: `url.https://x-access-token:${token}@github.com/.insteadOf`,
    GIT_CONFIG_VALUE_0: 'https://github.com/'
  };
}

/**
 * Build the install command without letting request data reach a shell.
 * The DSH CLI is started the same way `dsh.cmd` starts it (Electron in Node mode + `cli.js`);
 * only the guarded pnpm fallback needs a shell on Windows.
 */
function buildInstallCommand(
  profileName: string,
  spec: string,
  registry: string
): { command: string; args: string[]; env: NodeJS.ProcessEnv } | { error: string } {
  const baseEnv: NodeJS.ProcessEnv = {
    ...process.env,
    // Keep the env registry identical to the --registry flag
    npm_config_registry: registry,
    ELECTRON_RUN_AS_NODE: '1'
  };
  const env = withGithubAuthEnv(baseEnv);

  const cliJs = desktopCliCandidates().find(candidate => existsSync(candidate));
  if (cliJs) {
    return {
      command: process.execPath,
      args: ['--expose-internals', cliJs, 'plugin', '--profile', profileName, 'add', spec, `--registry=${registry}`],
      env
    };
  }

  if ([profileName, spec, registry].some(value => !SHELL_SAFE_PATTERN.test(value))) {
    return { error: 'Could not locate the DSH CLI and the pnpm fallback would need unsafe characters' };
  }
  if (process.platform === 'win32') {
    return {
      command: process.env.ComSpec || 'cmd.exe',
      args: ['/d', '/s', '/c', `pnpm add ${spec} --registry=${registry}`],
      env
    };
  }
  return { command: 'pnpm', args: ['add', spec, `--registry=${registry}`], env };
}

/** Kill an install process and its children (pnpm spawns workers that would survive a plain kill). */
function killChildTree(child: ChildProcess | undefined): void {
  if (!child || child.exitCode !== null) return;
  const pid = child.pid;
  if (process.platform === 'win32' && pid) {
    try {
      const killer = spawn('taskkill', ['/pid', String(pid), '/T', '/F'], { shell: false, windowsHide: true, stdio: 'ignore' });
      killer.on('error', () => {});
      killer.unref?.();
    } catch {}
  }
  try {
    child.kill();
  } catch {}
  try {
    child.kill('SIGKILL');
  } catch {}
}

interface SpawnInstallOptions {
  profileDir: string;
  profileName: string;
  spec: string;
  registry: string;
  timeoutMs: number;
  onStart?: (child: ChildProcess) => void;
  onOutput?: (chunk: string) => void;
  isCancelled?: () => boolean;
}

interface InstallAttemptResult {
  ok: boolean;
  output: string;
  error?: string;
  timedOut: boolean;
  cancelled: boolean;
}

/** Spawn the install command, stream its output and enforce a hard timeout. */
function spawnInstall(options: SpawnInstallOptions): Promise<InstallAttemptResult> {
  const plan = buildInstallCommand(options.profileName, options.spec, options.registry);
  if ('error' in plan) {
    return Promise.resolve({ ok: false, output: '', error: plan.error, timedOut: false, cancelled: false });
  }

  return new Promise<InstallAttemptResult>(resolve => {
    let output = '';
    let settled = false;
    let timedOut = false;
    let timeoutTimer: NodeJS.Timeout | undefined;
    let forceTimer: NodeJS.Timeout | undefined;

    const finish = (ok: boolean, error?: string) => {
      if (settled) return;
      settled = true;
      if (timeoutTimer) clearTimeout(timeoutTimer);
      if (forceTimer) clearTimeout(forceTimer);
      resolve({ ok, output, error, timedOut, cancelled: options.isCancelled?.() === true });
    };

    let child: ChildProcess;
    try {
      child = spawn(plan.command, plan.args, {
        cwd: options.profileDir,
        shell: false,
        windowsHide: true,
        env: plan.env
      });
    } catch (error: any) {
      resolve({
        ok: false,
        output: '',
        error: redactSecrets(error?.message || 'Failed to spawn install process'),
        timedOut: false,
        cancelled: false
      });
      return;
    }

    options.onStart?.(child);

    const append = (chunk: Buffer | string) => {
      const text = typeof chunk === 'string' ? chunk : chunk.toString();
      output = output.length + text.length > INSTALL_OUTPUT_LIMIT ? (output + text).slice(-INSTALL_OUTPUT_LIMIT) : output + text;
      options.onOutput?.(text);
    };
    child.stdout?.on('data', append);
    child.stderr?.on('data', append);

    timeoutTimer = setTimeout(() => {
      if (settled) return;
      timedOut = true;
      killChildTree(child);
      // If the killed process never emits `close`, settle anyway.
      forceTimer = setTimeout(() => finish(false, `安装命令超时（${Math.round(options.timeoutMs / 1000)} 秒）`), 15000);
      forceTimer.unref?.();
    }, options.timeoutMs);
    timeoutTimer.unref?.();

    child.on('error', error => finish(false, redactSecrets(`Process error: ${error.message}`)));
    child.on('close', code => {
      if (timedOut) {
        finish(false, `安装命令超时（${Math.round(options.timeoutMs / 1000)} 秒）`);
        return;
      }
      if (options.isCancelled?.()) {
        finish(false, '更新已取消');
        return;
      }
      if (code === 0) finish(true);
      else finish(false, redactSecrets(`Install process exited with code ${code ?? 'unknown'}`));
    });
  });
}

interface GithubInstallPlan {
  owner: string;
  repo: string;
  branch: string;
  tag?: string;
  expectedCommit?: string;
}

interface InstallPlan {
  isGithub: boolean;
  spec: string;
  targetVersion?: string;
  github?: GithubInstallPlan;
  registry: string;
  registryReason: string;
  registryLabel: string;
}

/**
 * Resolve the exact `pnpm add` spec for the requested update:
 *  - GitHub with an explicit target version and a matching tag -> pinned `github:owner/repo#<tag>`
 *  - GitHub without a target version (commit-only update / latest) -> unpinned branch HEAD
 *  - npm -> exact version (`name@x.y.z`), never `@latest`
 */
async function resolveInstallPlan(
  settings: PluginSettings,
  profileDir: string,
  packageName: string,
  targetVersion: string | undefined,
  source: string | undefined
): Promise<InstallPlan> {
  const origin = resolvePackageOrigin(profileDir, packageName, source);
  const cleanTarget = targetVersion ? targetVersion.replace(/^[v^~]/, '').trim() : '';

  if (origin.isGithub && origin.github) {
    const { owner, repo } = origin.github;
    const metadata = await getGithubRepoMetadata(owner, repo);
    const remote = await readGithubPackageJson(owner, repo, metadata.defaultBranch);
    const remoteVersion = remote.version;

    let githubPlan: GithubInstallPlan;
    if (cleanTarget) {
      const tag = findGithubTag(metadata, cleanTarget);
      if (tag) {
        githubPlan = { owner, repo, branch: metadata.defaultBranch, tag: tag.name, expectedCommit: tag.commit };
      } else if (compareSemver(remoteVersion, cleanTarget) === 0) {
        // No matching tag, but the default branch already carries the requested version.
        githubPlan = { owner, repo, branch: metadata.defaultBranch, expectedCommit: metadata.headCommit };
      } else {
        throw new RemoteError(
          ERROR_CODES.invalidTargetVersion,
          `GitHub 仓库 ${owner}/${repo} 没有与版本 ${cleanTarget} 匹配的标签（v${cleanTarget} / ${cleanTarget}），当前默认分支版本为 ${remoteVersion}`
        );
      }
    } else {
      // Commit-only update (or "latest"): track the default-branch HEAD, never pin the current version's tag.
      githubPlan = { owner, repo, branch: metadata.defaultBranch, expectedCommit: metadata.headCommit };
    }

    const planTarget = cleanTarget || remoteVersion;
    const registryPlan = await resolveInstallRegistry(settings, profileDir, packageName, planTarget, true);
    return {
      isGithub: true,
      spec: githubPlan.tag ? `github:${owner}/${repo}#${githubPlan.tag}` : `github:${owner}/${repo}`,
      targetVersion: planTarget,
      github: githubPlan,
      registry: registryPlan.registry,
      registryReason: registryPlan.reason,
      registryLabel: registryLabel(registryPlan.registry, settings.customRegistries)
    };
  }

  // npm package: resolve an exact version and install exactly that version.
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

interface VerificationResult {
  ok: boolean;
  message?: string;
  installedCommit?: string;
}

function shortCommit(value?: string): string {
  return value ? value.slice(0, 7) : '';
}

/** Post-install verification (P1 item 5): disk version + lockfile commit must match the plan. */
async function verifyInstall(profileDir: string, packageName: string, plan: InstallPlan): Promise<VerificationResult> {
  const diskVersion = readInstalledVersion(profileDir, packageName);
  if (!diskVersion) {
    return { ok: false, message: `安装完成后未在 node_modules 中找到 ${packageName}，更新可能没有真正写入 profile` };
  }

  if (plan.targetVersion) {
    if (plan.isGithub) {
      if (compareSemver(diskVersion, plan.targetVersion) !== 0) {
        return { ok: false, message: `版本校验失败：期望 ${plan.targetVersion}，实际 ${diskVersion}` };
      }
    } else if (compareSemver(diskVersion, plan.targetVersion) < 0) {
      return { ok: false, message: `版本校验失败：期望至少 ${plan.targetVersion}，实际 ${diskVersion}` };
    }
  }

  if (!plan.isGithub || !plan.github) return { ok: true };

  const lockText = readLockfileText(profileDir);
  const installedCommit = extractGithubCommit(lockText, plan.github.owner, plan.github.repo);
  const expectedCommit = plan.github.expectedCommit;

  if (!expectedCommit) {
    // The remote head could not be resolved before installing; the version check above is all we have.
    return { ok: true, installedCommit };
  }
  if (!installedCommit) {
    return {
      ok: false,
      message: `无法从 pnpm-lock.yaml 读取 ${plan.github.owner}/${plan.github.repo} 的已安装提交，无法确认 GitHub 安装结果`
    };
  }
  if (installedCommit.toLowerCase() === expectedCommit.toLowerCase()) {
    return { ok: true, installedCommit };
  }
  if (plan.github.tag) {
    // Annotated tags: the tags list can expose the tag object instead of the commit it points to.
    const tagCommit = await resolveGithubTagCommit(plan.github.owner, plan.github.repo, plan.github.tag);
    if (tagCommit && tagCommit === installedCommit.toLowerCase()) {
      plan.github.expectedCommit = tagCommit;
      return { ok: true, installedCommit };
    }
  }
  if (!plan.github.tag) {
    // Unpinned install: a newer commit may have landed between planning and installing.
    try {
      const fresh = await getGithubRepoMetadata(plan.github.owner, plan.github.repo, { noCache: true });
      if (fresh.headCommit && installedCommit.toLowerCase() === fresh.headCommit.toLowerCase()) {
        plan.github.expectedCommit = fresh.headCommit;
        return { ok: true, installedCommit };
      }
    } catch {}
  }

  return {
    ok: false,
    message: `提交校验失败：期望 ${shortCommit(expectedCommit)}（${
      plan.github.tag ? `标签 ${plan.github.tag}` : `分支 ${plan.github.branch}`
    }），实际 ${shortCommit(installedCommit)}`
  };
}

interface RollbackResult {
  state: 'not-needed' | 'restored' | 'failed';
  output: string;
}

/**
 * Restore the profile after a failed / cancelled / unverified install:
 *  1. reinstall the previous revision (best-effort, from the snapshot) so node_modules matches again
 *  2. write back the exact package.json / pnpm-lock.yaml bytes captured before the install
 * Never throws; the caller reports `rollback: restored|failed|not-needed`.
 */
async function rollbackProfile(
  snapshot: ProfileSnapshot,
  profileDir: string,
  profileName: string,
  packageName: string,
  settings: PluginSettings,
  origin: PackageOrigin,
  registryUsed: string,
  timeoutMs: number
): Promise<RollbackResult> {
  let output = '';

  const currentPackageJson = readTextFile(snapshot.packageJsonPath);
  const currentLockfile = readTextFile(snapshot.lockfilePath);
  const filesChanged = currentPackageJson !== snapshot.packageJson || currentLockfile !== snapshot.lockfile;

  const previousVersion = snapshot.previousVersion;
  const currentVersion = readInstalledVersion(profileDir, packageName);
  const versionChanged = previousVersion !== undefined && currentVersion !== previousVersion;
  const previousCommit = origin.isGithub && origin.github ? extractGithubCommit(snapshot.lockfile, origin.github.owner, origin.github.repo) : undefined;
  const currentCommit = origin.isGithub && origin.github ? extractGithubCommit(currentLockfile, origin.github.owner, origin.github.repo) : undefined;
  const commitChanged = !!previousCommit && !!currentCommit && currentCommit !== previousCommit;

  if (!filesChanged && !versionChanged && !commitChanged) {
    return { state: 'not-needed', output: '' };
  }

  const previousSpec = buildRollbackSpec(snapshot, packageName, origin);
  let reinstallOk = true;

  if (!previousSpec && (versionChanged || commitChanged)) {
    reinstallOk = false;
    output += `\n[dsh-plugins-update] 回滚：找不到更新前的安装规格，无法恢复 node_modules\n`;
  }

  if (previousSpec) {
    output += `\n[dsh-plugins-update] 回滚：重新安装更新前的版本（${previousSpec}）…\n`;
    let attempt = await spawnInstall({ profileDir, profileName, spec: previousSpec, registry: registryUsed, timeoutMs });
    output += attempt.output;
    if (!attempt.ok) {
      if (settings.fallbackToOfficial && registryUsed !== OFFICIAL_REGISTRY && !origin.isGithub) {
        output += `\n[dsh-plugins-update] 回滚重试 npm 官方源…\n`;
        attempt = await spawnInstall({ profileDir, profileName, spec: previousSpec, registry: OFFICIAL_REGISTRY, timeoutMs });
        output += attempt.output;
        reinstallOk = attempt.ok;
      } else {
        reinstallOk = false;
      }
    }
  }

  // Always restore the exact snapshot bytes, even after a successful reinstall (pnpm rewrites both files).
  let filesRestored = true;
  try {
    restoreFile(snapshot.packageJsonPath, snapshot.packageJson);
    restoreFile(snapshot.lockfilePath, snapshot.lockfile);
  } catch (error: any) {
    filesRestored = false;
    output += `\n[dsh-plugins-update] 回滚时恢复 profile 文件失败：${redactSecrets(error?.message || 'unknown')}\n`;
  }

  if (!filesRestored || !reinstallOk) {
    output += `\n[dsh-plugins-update] 回滚未完全成功，建议在 DSH 中重新安装该插件。\n`;
    return { state: 'failed', output };
  }

  output += `\n[dsh-plugins-update] 回滚完成，profile 已恢复到更新前的状态。\n`;
  return { state: 'restored', output };
}

// --- Async update job pipeline (P1) ----------------------------------------------------

/** One in-memory install job; jobs outlive the HTTP request that started them. */
interface InternalJob extends UpdateJobState {
  targetVersion?: string;
  source?: string;
  cancelRequested: boolean;
  child?: ChildProcess;
  log: string;
  profileDir: string;
  profileName: string;
  settings: PluginSettings;
  startedInstall: boolean;
  fellBack: boolean;
  cleanupTimer?: NodeJS.Timeout;
}

const jobs = new Map<string, InternalJob>();
/** One running install per profile directory: concurrent `pnpm add` runs would corrupt node_modules. */
const runningByProfile = new Map<string, string>();

function limitText(text: string, limit: number): string {
  return text.length > limit ? text.slice(text.length - limit) : text;
}

/** Strip ANSI escapes / carriage returns and secrets so the log can be rendered by the client. */
function sanitizeLog(text: string): string {
  return redactSecrets(text)
    .replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');
}

function appendJobLog(job: InternalJob, text: string): void {
  if (!text) return;
  job.log = limitText(job.log + text, INSTALL_OUTPUT_LIMIT);
  job.logTail = limitText(sanitizeLog(job.log), LOG_TAIL_LIMIT);
  job.updatedAt = Date.now();
}

/** Set the job phase (never moves backwards while running) and refresh its locale key. */
function setJobPhase(job: InternalJob, phase: UpdatePhase, percent?: number): void {
  const currentRank = PHASE_RANK[job.phase];
  const nextRank = PHASE_RANK[phase];
  const terminal = TERMINAL_PHASES.has(phase);
  if (!terminal && phase !== 'rolling-back' && nextRank < currentRank && !TERMINAL_PHASES.has(job.phase)) return;

  job.phase = phase;
  job.messageKey = PHASE_MESSAGE_KEYS[phase];
  if (percent !== undefined) job.percent = Math.max(0, Math.min(100, Math.round(percent)));
  job.running = !terminal;
  job.updatedAt = Date.now();
}

/** Rough progress parsing from `pnpm add` output: resolving/downloading lines and package counters. */
function noteInstallOutput(job: InternalJob, chunk: string): void {
  if (TERMINAL_PHASES.has(job.phase)) return;
  const text = chunk.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '');

  for (const line of text.split(/\r?\n/)) {
    if (/Packages:\s*\+/i.test(line) || /added\s+[1-9]\d*\s+packages?/i.test(line) || /Done in/i.test(line)) {
      setJobPhase(job, 'installing', Math.max(job.percent ?? 0, 75));
      continue;
    }
    const resolvedMatch = line.match(/Progress:\s*resolved\s+(\d+)/i);
    if (resolvedMatch) {
      if (PHASE_RANK[job.phase] < PHASE_RANK.installing) setJobPhase(job, 'downloading');
      const resolved = Number(resolvedMatch[1]);
      job.percent = Math.max(job.percent ?? 25, Math.min(70, 30 + Math.min(35, Math.floor(resolved / 4))));
      job.updatedAt = Date.now();
    }
  }

  // Generic fallback so the bar keeps moving during silent network downloads.
  if (job.phase === 'downloading' || job.phase === 'installing') {
    job.percent = Math.min(80, (job.percent ?? 0) + 1);
    job.updatedAt = Date.now();
  }
}

function createJob(params: {
  packageName: string;
  targetVersion?: string;
  source?: string;
  profileDir: string;
  profileName: string;
  settings: PluginSettings;
}): InternalJob {
  const now = Date.now();
  return {
    ok: true,
    jobId: randomUUID(),
    packageName: params.packageName,
    targetVersion: params.targetVersion,
    source: params.source,
    phase: 'queued',
    running: true,
    percent: 0,
    messageKey: PHASE_MESSAGE_KEYS.queued,
    logTail: '',
    startedAt: now,
    updatedAt: now,
    cancelRequested: false,
    log: '',
    profileDir: params.profileDir,
    profileName: params.profileName,
    settings: params.settings,
    startedInstall: false,
    fellBack: false
  };
}

function clearRunning(job: InternalJob): void {
  if (runningByProfile.get(job.profileDir) === job.jobId) runningByProfile.delete(job.profileDir);
}

/** Keep finished jobs queryable for 10 minutes; bounded cleanup of old entries. */
function scheduleJobCleanup(job: InternalJob): void {
  if (job.cleanupTimer) clearTimeout(job.cleanupTimer);
  job.cleanupTimer = setTimeout(() => {
    jobs.delete(job.jobId);
  }, JOB_TTL_MS);
  job.cleanupTimer.unref?.();
}

function pruneOldJobs(): void {
  if (jobs.size <= 100) return;
  const finished = [...jobs.values()].filter(job => !job.running).sort((a, b) => a.updatedAt - b.updatedAt);
  const removeCount = jobs.size - 100;
  for (const job of finished.slice(0, removeCount)) jobs.delete(job.jobId);
}

function publicJobState(job: InternalJob): UpdateJobState {
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

function missingJobState(jobId: string): UpdateJobState {
  const now = Date.now();
  return {
    ok: false,
    jobId,
    packageName: '',
    phase: 'failed',
    running: false,
    messageKey: PHASE_MESSAGE_KEYS.failed,
    logTail: '',
    startedAt: now,
    updatedAt: now,
    error: '找不到该更新任务（可能已过期，或 DSH 已重启）',
    errorCode: ERROR_CODES.jobNotFound
  };
}

function jobFailureFromError(error: any): { errorCode: ErrorCode; message: string } {
  if (error instanceof RemoteError) return { errorCode: error.errorCode, message: redactSecrets(error.message) };
  if (error instanceof HttpError) return { errorCode: classifyAggregateError([error]), message: redactSecrets(error.message) };
  return { errorCode: ERROR_CODES.unknown, message: redactSecrets(error?.message || '更新失败') };
}

/** Run one install job to completion; never rejects (all failures are recorded on the job). */
async function runJob(job: InternalJob, refreshAfterInstall: () => Promise<void>): Promise<void> {
  const { packageName, profileDir, profileName, settings } = job;
  const installTimeoutMs = settings.installTimeoutSeconds * 1000;
  const rollbackTimeoutMs = Math.min(installTimeoutMs, 120_000);

  let plan: InstallPlan | undefined;
  let snapshot: ProfileSnapshot | undefined;
  let origin: PackageOrigin = { isGithub: false };
  let registryUsed = '';
  let output = '';
  let rollback: RollbackResult = { state: 'not-needed', output: '' };

  const append = (text: string) => {
    output = limitText(output + text, INSTALL_OUTPUT_LIMIT);
    appendJobLog(job, text);
  };
  const checkCancelled = () => {
    if (job.cancelRequested) throw new RemoteError(ERROR_CODES.cancelled, '更新已取消');
  };
  const spawnOptions = (spec: string, registry: string) => ({
    profileDir,
    profileName,
    spec,
    registry,
    timeoutMs: installTimeoutMs,
    onStart: (child: ChildProcess) => {
      job.child = child;
      job.startedInstall = true;
    },
    onOutput: (text: string) => {
      append(text);
      noteInstallOutput(job, text);
    },
    isCancelled: () => job.cancelRequested
  });

  try {
    setJobPhase(job, 'resolving', 8);
    origin = resolvePackageOrigin(profileDir, packageName, job.source);
    plan = await resolveInstallPlan(settings, profileDir, packageName, job.targetVersion, job.source);
    registryUsed = plan.registry;
    append(
      `[dsh-plugins-update] 目标：${packageName}${plan.targetVersion ? `@${plan.targetVersion}` : ''}（${
        plan.isGithub ? 'GitHub' : 'npm'
      }）\n`
    );
    append(`[dsh-plugins-update] 安装源：${plan.registryLabel}（${plan.registry}）— ${plan.registryReason}\n`);
    append(`[dsh-plugins-update] 安装规格：${plan.spec}\n`);
    checkCancelled();

    snapshot = captureProfileSnapshot(profileDir, packageName);
    setJobPhase(job, 'downloading', 25);

    let attempt = await spawnInstall(spawnOptions(plan.spec, plan.registry));

    if (!attempt.ok && !attempt.timedOut && !attempt.cancelled && settings.fallbackToOfficial && plan.registry !== OFFICIAL_REGISTRY) {
      job.fellBack = true;
      registryUsed = OFFICIAL_REGISTRY;
      append(`\n[dsh-plugins-update] ${plan.registryLabel} 安装失败（${attempt.error || '未知错误'}），改用 npm 官方源重试…\n`);
      attempt = await spawnInstall(spawnOptions(plan.spec, OFFICIAL_REGISTRY));
    }

    if (attempt.timedOut) {
      throw new RemoteError(ERROR_CODES.timeout, `安装超时（${settings.installTimeoutSeconds} 秒）`);
    }
    if (attempt.cancelled || job.cancelRequested) {
      throw new RemoteError(ERROR_CODES.cancelled, '更新已取消');
    }
    if (!attempt.ok) {
      throw new RemoteError(ERROR_CODES.installFailed, attempt.error || '安装进程失败');
    }
    checkCancelled();

    setJobPhase(job, 'verifying', 88);
    const verification = await verifyInstall(profileDir, packageName, plan);
    if (!verification.ok) {
      throw new RemoteError(ERROR_CODES.verificationFailed, verification.message || '安装后校验失败');
    }

    const selfUpdate = packageName === OWN_PACKAGE_NAME;
    setJobPhase(job, 'done', 100);
    job.result = {
      ok: true,
      packageName,
      targetVersion: plan.targetVersion,
      source: job.source,
      registryUsed,
      registryLabel: registryLabel(registryUsed, settings.customRegistries),
      fellBack: job.fellBack,
      selfUpdate,
      rollback: 'not-needed',
      installedCommit: verification.installedCommit,
      output: limitText(sanitizeLog(output), RESULT_OUTPUT_LIMIT)
    };
    clearRunning(job);

    if (selfUpdate) {
      // Let the client receive the final progress state before the Host reloads this very plugin.
      const timer = setTimeout(() => {
        void refreshAfterInstall();
      }, 1500);
      timer.unref?.();
    } else {
      try {
        await refreshAfterInstall();
      } catch {}
    }
  } catch (error: any) {
    const failure = jobFailureFromError(error);
    const wasCancelled = failure.errorCode === ERROR_CODES.cancelled;
    append(`\n[dsh-plugins-update] ${wasCancelled ? '更新已取消' : '更新失败'}：${failure.message}\n`);

    if (plan && snapshot && job.startedInstall) {
      setJobPhase(job, 'rolling-back', 92);
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
      } catch (rollbackError: any) {
        rollback = { state: 'failed', output: '' };
        append(`\n[dsh-plugins-update] 回滚失败：${redactSecrets(rollbackError?.message || 'unknown error')}\n`);
      }
    }

    setJobPhase(job, wasCancelled ? 'cancelled' : 'failed');
    job.error = failure.message;
    job.errorCode = failure.errorCode;
    job.result = {
      ok: false,
      packageName,
      targetVersion: plan?.targetVersion ?? job.targetVersion,
      source: job.source,
      registryUsed: registryUsed || undefined,
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
    job.child = undefined;
    if (!TERMINAL_PHASES.has(job.phase)) {
      setJobPhase(job, 'failed');
      job.error = job.error || '更新任务异常终止';
      job.errorCode = job.errorCode || ERROR_CODES.unknown;
    }
    job.updatedAt = Date.now();
    clearRunning(job);
    scheduleJobCleanup(job);
  }
}

// --- HTTP helpers for the routes -------------------------------------------------------

function jsonResponse(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { 'cache-control': 'no-store' } });
}

/** Error response with BOTH a Chinese fallback `error` and a machine-readable `errorCode`. */
function errorResponse(payload: Record<string, any>, errorCode: ErrorCode, error: string, status = 200): Response {
  return jsonResponse({ ...payload, ok: false, error, errorCode }, status);
}

async function parseJsonBody(req: Request): Promise<Record<string, any>> {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? (body as Record<string, any>) : {};
  } catch {
    return {};
  }
}

function readQueryParam(req: Request, name: string): string | undefined {
  try {
    const url = new URL(req.url, 'http://localhost');
    const value = url.searchParams.get(name);
    return value?.trim() || undefined;
  } catch {
    return undefined;
  }
}

// --- Plugin entry point ----------------------------------------------------------------

export function apply(ctx: any, config: any) {
  const conn = ctx.get('connection');
  const registerFetch = conn?.fetch?.register?.bind(conn.fetch);

  if (typeof registerFetch !== 'function') {
    return;
  }

  // Refresh the Host plugin list after an install; delayed for self-updates so the HTTP response can leave first.
  const refreshAfterInstall = async () => {
    try {
      const packages = ctx.get?.('pluginPackages');
      if (packages?.refresh) await packages.refresh();
    } catch {}
    try {
      const hmr = ctx.get?.('hmr');
      if (hmr?.reconcileProfile) await hmr.reconcileProfile([]);
    } catch {}
    try {
      ctx.emit?.('plugin-manager/changed', { reason: 'install' });
    } catch {}
  };

  // 1. API: Check update for a package (Supports npm & GitHub, including commit-level updates)
  ctx.effect(
    () =>
      registerFetch({
        path: CHECK_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (req: Request) => {
          try {
            const body = (await parseJsonBody(req)) as CheckUpdateParams;
            const packageName = readPackageName(body?.packageName);
            if (!packageName) {
              return errorResponse(
                { packageName: '', hasUpdate: false },
                ERROR_CODES.invalidPackageName,
                'packageName 必须是合法的 npm 包名',
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
            const clientVersion =
              typeof body.currentVersion === 'string' && body.currentVersion ? body.currentVersion : '0.0.0';
            const current =
              diskVersion && compareSemver(diskVersion, clientVersion) > 0
                ? diskVersion
                : clientVersion || diskVersion || '0.0.0';
            const origin = resolvePackageOrigin(
              dir,
              packageName,
              typeof body.source === 'string' && body.source ? body.source : bundle?.source
            );

            let latestVersion = current;
            let releaseDate: string | undefined;
            let description: string | undefined;
            let registry: string | undefined;
            let isGithub = false;
            let fetched = false;
            let fetchError = '';
            let fetchErrorCode: ErrorCode | undefined;
            let branch: string | undefined;
            let latestCommit: string | undefined;
            let installedCommit: string | undefined;
            let tag: GithubTagInfo | undefined;

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
              } catch (githubError: any) {
                const remote =
                  githubError instanceof RemoteError
                    ? githubError
                    : githubRemoteError(githubError, origin.github.owner, origin.github.repo);
                fetchError = remote.message;
                fetchErrorCode = remote.errorCode;

                // A private/renamed repository must surface as an auth error, not as a silent npm fallback.
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

                // Degraded path: the GitHub API can be rate limited while the CDN still has package.json.
                try {
                  const fallback = await readGithubPackageJsonAnyBranch(origin.github.owner, origin.github.repo, [
                    'main',
                    'master'
                  ]);
                  latestVersion = fallback.info.version;
                  description = fallback.info.description;
                  branch = fallback.branch;
                  fetched = true;
                } catch (branchError: any) {
                  // P0 fallback: GitHub unreachable -> try npm for this package name.
                  try {
                    const npmInfo = await fetchNpmPackageInfo(packageName, settings);
                    latestVersion = npmInfo.version;
                    releaseDate = npmInfo.releaseDate;
                    description = npmInfo.description;
                    registry = npmInfo.registry;
                    isGithub = false;
                    fetched = true;
                  } catch (npmError: any) {
                    const npmRemote =
                      npmError instanceof RemoteError
                        ? npmError
                        : npmRemoteError(npmError, checkRegistries(settings).join(', '));
                    fetchError = `${remote.message}；${npmRemote.message}`;
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
              } catch (npmError: any) {
                const npmRemote =
                  npmError instanceof RemoteError
                    ? npmError
                    : npmRemoteError(npmError, checkRegistries(settings).join(', '));
                fetchError = npmRemote.message;
                fetchErrorCode = npmRemote.errorCode;

                // P0 fallback: check the GitHub repository declared by the installed package.
                const fallbackGithub = origin.repoGithub || origin.github;
                if (fallbackGithub) {
                  try {
                    const metadata = await getGithubRepoMetadata(fallbackGithub.owner, fallbackGithub.repo);
                    const remote = await readGithubPackageJson(fallbackGithub.owner, fallbackGithub.repo, metadata.defaultBranch);
                    latestVersion = remote.version;
                    description = remote.description;
                    fetched = true;
                  } catch (githubError: any) {
                    const remote =
                      githubError instanceof RemoteError
                        ? githubError
                        : githubRemoteError(githubError, fallbackGithub.owner, fallbackGithub.repo);
                    fetchError = `${npmRemote.message}；${remote.message}`;
                    fetchErrorCode = remote.errorCode;
                  }
                }
              }
            }

            if (!fetched) {
              // A failed lookup must never be reported as "already up to date".
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
                `无法获取远端版本信息${fetchError ? `：${fetchError}` : '：网络不可达'}`
              );
            }

            const commitAhead = !!(installedCommit && latestCommit && installedCommit !== latestCommit);
            const hasUpdate =
              compareSemver(latestVersion, current) > 0 || (commitAhead && compareSemver(latestVersion, current) <= 0);

            const result: CheckUpdateResult = {
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
              commitAhead: installedCommit && latestCommit ? commitAhead : undefined,
              tag: tag?.name,
              pinAvailable: isGithub ? !!tag : undefined
            };

            return jsonResponse(result);
          } catch (error: any) {
            return errorResponse(
              { packageName: '', hasUpdate: false, latestVersion: '0.0.0' },
              ERROR_CODES.unknown,
              redactSecrets(error?.message || 'Check failed')
            );
          }
        }
      }),
    'dsh-plugins-update: check route'
  );

  // 2. API: Start an asynchronous plugin update (client polls the progress endpoint)
  ctx.effect(
    () =>
      registerFetch({
        path: UPDATE_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (req: Request) => {
          let packageName = '';
          try {
            const body = (await parseJsonBody(req)) as DoUpdateParams;
            packageName = readPackageName(body?.packageName) ?? '';
            if (!packageName) {
              return errorResponse({ packageName: '' }, ERROR_CODES.invalidPackageName, 'packageName 必须是合法的 npm 包名', 400);
            }
            const targetVersion = readTargetVersion(body?.targetVersion);
            if (targetVersion === null) {
              return errorResponse(
                { packageName },
                ERROR_CODES.invalidTargetVersion,
                'targetVersion 必须是合法的语义化版本',
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
            if (!existsSync(join(dir, 'package.json'))) {
              return errorResponse({ packageName }, ERROR_CODES.profileNotFound, '找不到可用的 DSH profile 目录');
            }

            const runningJobId = runningByProfile.get(dir);
            if (runningJobId && jobs.get(runningJobId)?.running) {
              return errorResponse({ packageName }, ERROR_CODES.installInProgress, '另一个插件正在更新，请稍后再试');
            }

            pruneOldJobs();
            const source = typeof body.source === 'string' && body.source ? body.source : bundle?.source;
            const job = createJob({ packageName, targetVersion, source, profileDir: dir, profileName, settings });
            jobs.set(job.jobId, job);
            runningByProfile.set(dir, job.jobId);

            void runJob(job, refreshAfterInstall).catch((error: any) => {
              // runJob handles its own errors; this guard only protects against a bug in the pipeline.
              const message = redactSecrets(error?.message || '更新任务异常终止');
              setJobPhase(job, 'failed');
              job.error = message;
              job.errorCode = ERROR_CODES.unknown;
              job.result = {
                ok: false,
                packageName,
                targetVersion,
                error: message,
                errorCode: ERROR_CODES.unknown,
                rollback: 'not-needed'
              };
              clearRunning(job);
              scheduleJobCleanup(job);
            });

            return jsonResponse({ ok: true, packageName, jobId: job.jobId, targetVersion, source });
          } catch (error: any) {
            return errorResponse({ packageName }, ERROR_CODES.unknown, redactSecrets(error?.message || 'Update failed'));
          }
        }
      }),
    'dsh-plugins-update: update route'
  );

  // 3. API: Poll one asynchronous update job (in-memory only, no network calls)
  ctx.effect(
    () =>
      registerFetch({
        path: PROGRESS_PATH,
        methods: ['GET'],
        fetch: async (req: Request) => {
          const jobId = readQueryParam(req, 'jobId');
          if (!jobId) return jsonResponse(missingJobState(''));
          const job = jobs.get(jobId);
          if (!job) return jsonResponse(missingJobState(jobId));
          return jsonResponse(publicJobState(job));
        }
      }),
    'dsh-plugins-update: progress route'
  );

  // 4. API: Cancel a running update job (kills the child and rolls the profile back)
  ctx.effect(
    () =>
      registerFetch({
        path: CANCEL_PATH,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: async (req: Request) => {
          try {
            const body = await parseJsonBody(req);
            const jobId = typeof body.jobId === 'string' ? body.jobId.trim() : '';
            if (!jobId) {
              return jsonResponse({ ok: false, jobId: '', error: '缺少 jobId 参数', errorCode: ERROR_CODES.jobNotFound });
            }
            const job = jobs.get(jobId);
            if (!job) {
              return jsonResponse({
                ok: false,
                jobId,
                error: '找不到该更新任务（可能已过期）',
                errorCode: ERROR_CODES.jobNotFound
              });
            }
            if (!job.running) {
              return jsonResponse({
                ok: false,
                jobId,
                cancelled: job.phase === 'cancelled',
                error: '任务已结束，无需取消',
                errorCode: ERROR_CODES.unknown
              });
            }

            job.cancelRequested = true;
            appendJobLog(job, '\n[dsh-plugins-update] 已请求取消更新…\n');
            try {
              killChildTree(job.child);
            } catch {}
            return jsonResponse({ ok: true, jobId, cancelled: false, cancelRequested: true });
          } catch (error: any) {
            return jsonResponse({
              ok: false,
              jobId: '',
              error: redactSecrets(error?.message || 'Cancel failed'),
              errorCode: ERROR_CODES.unknown
            });
          }
        }
      }),
    'dsh-plugins-update: cancel route'
  );
}
