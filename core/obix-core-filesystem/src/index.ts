/**
 * @obinexusltd/obix-core-filesystem
 *
 * Explicit project-root path resolution, path/URL separation, byte/text reads,
 * serialized safe writes and normalized watch invalidations with a polling
 * fallback.
 *
 * Portable root: no `node:fs` import. All I/O goes through an injected
 * `FsProvider`; timing goes through injected hooks. `createNodeFilesystem`
 * (`./node`) wires the real implementations.
 *
 * Guarantees and non-guarantees:
 *   - `writeFileSafely` writes a sibling temp file then renames it over the
 *     target. On a local disk `rename` is atomic *within the same directory*;
 *     across filesystems or on network/virtualised mounts it may fall back to a
 *     copy and is not atomic. Durability (fsync of the directory entry) is NOT
 *     guaranteed unless the provider does it.
 *   - `watchTree` treats every event as an *invalidation*: you get a set of
 *     affected paths and must reconcile a snapshot. It does NOT promise that
 *     every native OS event is delivered. Under the polling fallback, detection
 *     is eventual — within `pollMs` plus bounded processing time.
 *   - Writes to the same resolved target are serialized. Writes to different
 *     targets run concurrently.
 *   - A browser local filesystem is unsupported unless you pass an explicit
 *     `FsProvider`.
 */
import { CompatError } from "@obinexusltd/obix-core-capabilities";

export { CompatError } from "@obinexusltd/obix-core-capabilities";

// ── injected interfaces ─────────────────────────────────────────────────────

export interface FsStat {
  isFile: boolean;
  isDirectory: boolean;
  size: number;
  /** epoch ms; 0 when the provider cannot report it */
  mtimeMs: number;
}

export interface FsProvider {
  readFile(path: string): Promise<Uint8Array>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
  rename(from: string, to: string): Promise<void>;
  mkdir(path: string, opts: { recursive: boolean }): Promise<void>;
  rm(path: string, opts: { force: boolean }): Promise<void>;
  stat(path: string): Promise<FsStat>;
  /** List a directory (names only). */
  readdir(path: string): Promise<string[]>;
  /** Optional native recursive watch. Returns a stop function. */
  watch?(
    path: string,
    onEvent: (evt: { type: "rename" | "change"; path: string }) => void,
  ): { close(): void };
  /** Path helpers so the portable root never imports `node:path`. */
  join(...parts: string[]): string;
  dirname(path: string): string;
  basename(path: string): string;
  resolve(...parts: string[]): string;
  /** `true` when `child` is inside `parent` (after normalisation). */
  isInside(parent: string, child: string): boolean;
  sep: string;
}

export interface TimingHooks {
  now(): number;
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export interface FilesystemOptions {
  provider: FsProvider;
  timing: TimingHooks;
  /** Absolute path (not a URL). CLI-relative paths resolve against this. */
  projectRoot: string;
  /** Random token generator for temp file names. Default `Math.random`. */
  randomToken?: () => string;
}

// ── API ─────────────────────────────────────────────────────────────────────

export interface WriteResult {
  path: string;
  bytes: number;
  strategy: "temp-file-rename";
  /** Honest note on what the rename guaranteed. */
  durability: string;
}

export interface WatchOptions {
  mode?: "native" | "poll" | "auto";
  /** Coalesce a burst of events within this window into one invalidation. */
  debounceMs?: number;
  /** Poll interval for the fallback. */
  pollMs?: number;
  signal?: AbortSignal;
}

export interface WatchHandle {
  close(): void;
  readonly mode: "native" | "poll";
}

export interface FilesystemAPI {
  /** Resolve a CLI-relative path against the project root. Rejects `..` escapes and `file:` URLs. */
  resolveProjectPath(relOrAbs: string): string;
  /** Convert a `file:` URL to a filesystem path. Throws for non-file URLs. */
  urlToPath(url: string | URL): string;
  /** Convert a filesystem path to a `file:` URL string. */
  pathToUrl(path: string): string;
  readBytes(relOrAbs: string): Promise<Uint8Array>;
  /** Reads text without altering line endings (CRLF is preserved). */
  readText(relOrAbs: string, encoding?: string): Promise<string>;
  /** Write via sibling temp file + rename. Serialized per resolved target. */
  writeFileSafely(relOrAbs: string, data: Uint8Array | string, encoding?: string): Promise<WriteResult>;
  /** Watch a subtree; `onInvalidate` receives affected absolute paths (deduped, debounced). */
  watchTree(relOrAbs: string, onInvalidate: (paths: string[]) => void, opts?: WatchOptions): WatchHandle;
}

const FILE_URL = /^file:\/\//i;
const ANY_URL = /^[a-z][a-z0-9+.-]*:\/\//i;

export function createFilesystem(opts: FilesystemOptions): FilesystemAPI {
  const { provider: fs, timing } = opts;
  const root = fs.resolve(opts.projectRoot);
  const rand = opts.randomToken ?? (() => Math.random().toString(36).slice(2, 10));
  const writeChains = new Map<string, Promise<unknown>>();

  function fail(code: CompatError["code"], operation: string, reason: string, extra?: Partial<{ cause: unknown; remediation: string }>): CompatError {
    return new CompatError({ code, package: "obix-core-filesystem", operation, reason, ...extra });
  }

  function resolveProjectPath(input: string): string {
    if (typeof input !== "string" || input === "") {
      throw fail("fs/read", "resolveProjectPath", "path must be a non-empty string");
    }
    if (ANY_URL.test(input)) {
      throw fail("fs/read", "resolveProjectPath", `got a URL (${input}); pass a filesystem path, or convert with urlToPath()`, {
        remediation: "URLs and filesystem paths are distinct — use urlToPath() first.",
      });
    }
    const abs = fs.resolve(root, input);
    if (!fs.isInside(root, abs) && abs !== root) {
      throw fail("fs/read", "resolveProjectPath", `"${input}" resolves outside the project root (${root})`, {
        remediation: "Keep paths within the project; pass an explicit absolute path only when you mean to.",
      });
    }
    return abs;
  }

  function absOf(relOrAbs: string): string {
    // an absolute path inside root is fine; otherwise resolve against root
    if (fs.resolve(relOrAbs) === relOrAbs && fs.isInside(root, relOrAbs)) return relOrAbs;
    return resolveProjectPath(relOrAbs);
  }

  function urlToPath(url: string | URL): string {
    const s = typeof url === "string" ? url : url.href;
    if (!FILE_URL.test(s)) {
      throw fail("fs/read", "urlToPath", `not a file: URL: ${s}`);
    }
    const u = new URL(s);
    // decode %XX, handle Windows drive: file:///C:/x -> C:\x
    let p = decodeURIComponent(u.pathname);
    if (/^\/[a-z]:/i.test(p)) p = p.slice(1);
    return fs.resolve(p.replace(/\//g, fs.sep));
  }

  function pathToUrl(path: string): string {
    const abs = fs.resolve(path);
    const asPosix = abs.replace(/\\/g, "/");
    const withSlash = /^[a-z]:/i.test(asPosix) ? `/${asPosix}` : asPosix;
    return `file://${withSlash.split("/").map((seg) => (seg.includes(":") ? seg : encodeURIComponent(seg))).join("/")}`;
  }

  async function readBytes(relOrAbs: string): Promise<Uint8Array> {
    const p = absOf(relOrAbs);
    try {
      return await fs.readFile(p);
    } catch (err) {
      throw fail("fs/read", "readBytes", `cannot read ${p}: ${errMsg(err)}`, { cause: err });
    }
  }

  async function readText(relOrAbs: string, encoding = "utf-8"): Promise<string> {
    const bytes = await readBytes(relOrAbs);
    return new TextDecoder(encoding).decode(bytes); // no newline translation
  }

  function writeFileSafely(relOrAbs: string, data: Uint8Array | string, encoding = "utf-8"): Promise<WriteResult> {
    const target = absOf(relOrAbs);
    const bytes = typeof data === "string" ? new TextEncoder().encode(encoding === "utf-8" ? data : data) : data;

    const run = async (): Promise<WriteResult> => {
      const dir = fs.dirname(target);
      await fs.mkdir(dir, { recursive: true });
      const tmp = fs.join(dir, `.${fs.basename(target)}.${rand()}.tmp`);
      try {
        await fs.writeFile(tmp, bytes);
        await fs.rename(tmp, target);
      } catch (err) {
        try {
          await fs.rm(tmp, { force: true });
        } catch {
          /* best effort cleanup */
        }
        throw fail("fs/write", "writeFileSafely", `cannot write ${target}: ${errMsg(err)}`, { cause: err });
      }
      return {
        path: target,
        bytes: bytes.byteLength,
        strategy: "temp-file-rename",
        durability:
          "rename replaced the target; atomic within one directory on a local disk, " +
          "not guaranteed across filesystems / on network mounts; directory fsync not performed",
      };
    };

    // serialize per resolved target
    const prev = writeChains.get(target) ?? Promise.resolve();
    const next = prev.then(run, run);
    writeChains.set(
      target,
      next.finally(() => {
        if (writeChains.get(target) === next) writeChains.delete(target);
      }),
    );
    return next;
  }

  function watchTree(relOrAbs: string, onInvalidate: (paths: string[]) => void, o: WatchOptions = {}): WatchHandle {
    const base = absOf(relOrAbs);
    const debounceMs = Math.max(0, o.debounceMs ?? 40);
    const pollMs = Math.max(10, o.pollMs ?? 250);
    const wantNative = (o.mode ?? "auto") !== "poll" && typeof fs.watch === "function";
    const mode: "native" | "poll" = wantNative ? "native" : "poll";

    let closed = false;
    let debounceHandle: unknown = null;
    const dirty = new Set<string>();

    const flush = () => {
      debounceHandle = null;
      if (dirty.size === 0 || closed) return;
      const paths = [...dirty];
      dirty.clear();
      try {
        onInvalidate(paths);
      } catch {
        /* consumer error is theirs */
      }
    };
    const invalidate = (p: string) => {
      if (closed) return;
      dirty.add(p);
      if (debounceHandle == null) debounceHandle = timing.setTimeout(flush, debounceMs);
    };

    let stopNative: { close(): void } | null = null;
    let pollHandle: unknown = null;

    if (mode === "native") {
      stopNative = fs.watch!(base, (evt) => invalidate(fs.resolve(evt.path)));
    } else {
      // polling fallback: snapshot mtime+size, diff each interval
      const snap = new Map<string, string>();
      const scan = async (): Promise<Map<string, string>> => {
        const acc = new Map<string, string>();
        const walk = async (d: string): Promise<void> => {
          let entries: string[] = [];
          try {
            entries = await fs.readdir(d);
          } catch {
            return;
          }
          for (const name of entries) {
            const p = fs.join(d, name);
            let st: FsStat;
            try {
              st = await fs.stat(p);
            } catch {
              continue;
            }
            if (st.isDirectory) await walk(p);
            else acc.set(p, `${st.size}:${st.mtimeMs}`);
          }
        };
        try {
          const bst = await fs.stat(base);
          if (bst.isDirectory) await walk(base);
          else acc.set(base, `${bst.size}:${bst.mtimeMs}`);
        } catch {
          /* base gone */
        }
        return acc;
      };
      const tick = async () => {
        if (closed) return;
        const cur = await scan();
        for (const [p, sig] of cur) if (snap.get(p) !== sig) invalidate(p);
        for (const p of snap.keys()) if (!cur.has(p)) invalidate(p); // deletion
        snap.clear();
        for (const [p, sig] of cur) snap.set(p, sig);
        if (!closed) pollHandle = timing.setTimeout(() => void tick(), pollMs);
      };
      // prime the snapshot without firing, then start polling
      void scan().then((first) => {
        for (const [p, sig] of first) snap.set(p, sig);
        if (!closed) pollHandle = timing.setTimeout(() => void tick(), pollMs);
      });
    }

    const close = () => {
      if (closed) return;
      closed = true;
      if (debounceHandle != null) timing.clearTimeout(debounceHandle);
      if (pollHandle != null) timing.clearTimeout(pollHandle);
      stopNative?.close();
    };
    o.signal?.addEventListener("abort", close, { once: true });

    return { close, mode };
  }

  return { resolveProjectPath, urlToPath, pathToUrl, readBytes, readText, writeFileSafely, watchTree };
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
