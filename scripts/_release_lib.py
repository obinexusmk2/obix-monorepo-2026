#!/usr/bin/env python3
"""
Shared helpers for the OBIX release tools (`scripts/commit.py`, `scripts/publish.py`).

Design rules (enforced throughout):
  * every external process is launched with an argument ARRAY, shell=False,
    an explicit cwd and a timeout; exit status is always captured.
  * `git` and `gh` are resolved as real executables. `npm` is invoked as
    `<node> <npm-cli.js> ...` so a Windows `npm.cmd` launcher is never handed
    to Node and never interpreted by a shell.
  * project paths and human text (commit messages, PR bodies) are passed via
    files or argv items, never concatenated into a shell string.
  * nothing here stages, commits, pushes, tags, opens PRs or publishes. Those
    live behind explicit flags in the entrypoint scripts.

This module is intentionally standard-library only.
"""
from __future__ import annotations

import dataclasses
import hashlib
import json
import os
import re
import shutil
import signal
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from typing import Any, Callable, Iterable, Sequence

TOOL_VERSION = "1.0.0"

# ── schema identifiers (bump the integer on a breaking change) ───────────────
COMMIT_PLAN_SCHEMA = "obix-release/commit-plan@1"
RELEASE_PLAN_SCHEMA = "obix-release/release-plan@1"
RELEASE_MANIFEST_SCHEMA = "obix-release/release-manifest@1"
RECEIPT_SCHEMA = "obix-release/receipt@1"
RELEASE_SOURCE_SCHEMA = "obix-release/release-source@1"

# ── the ten core packages, in DEPENDENCY (topological) order ─────────────────
CORE_SUFFIXES: tuple[str, ...] = (
    "capabilities",
    "diagnostics",
    "modules",
    "scheduler",
    "streams",
    "filesystem",
    "process",
    "workers",
    "native",
    "web",
)
CORE_PACKAGES: tuple[str, ...] = tuple(f"@obinexusltd/obix-core-{s}" for s in CORE_SUFFIXES)
UMBRELLA_PACKAGE = "@obinexusltd/obix"
# the ONLY names publish.py will ever touch
PUBLISH_ALLOWLIST: tuple[str, ...] = CORE_PACKAGES + (UMBRELLA_PACKAGE,)

DEFAULT_DIST_TAG = "next"
COAUTHOR_TRAILER = "Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"


# ── errors ──────────────────────────────────────────────────────────────────
class ReleaseError(Exception):
    """Actionable, expected failure. The entrypoints print .args[0] and exit 1."""


class StalePlanError(ReleaseError):
    """A saved plan no longer matches the working tree / HEAD it was built from."""


class Interrupted(ReleaseError):
    """Ctrl+C during an apply/execute phase (a partial receipt was written)."""


# ── redaction ──────────────────────────────────────────────────────────────
_SECRET_RX = re.compile(
    r"(gh[opsru]_[A-Za-z0-9_]{20,})"           # GitHub tokens
    r"|(github_pat_[A-Za-z0-9_]{20,})"
    r"|(npm_[A-Za-z0-9]{30,})"                  # npm automation tokens
    r"|(//[^/\s:@]+:[^/\s@]+@)"                 # user:pass@ in a URL
)


def redact(text: str) -> str:
    if not text:
        return text
    return _SECRET_RX.sub("[REDACTED]", text)


for _stream in (sys.stdout, sys.stderr):
    try:  # make console output robust on code-page-limited Windows terminals
        _stream.reconfigure(encoding="utf-8", errors="replace")  # type: ignore[union-attr]
    except (AttributeError, ValueError):
        pass


def _safe(msg: object) -> str:
    s = redact(str(msg))
    enc = (getattr(sys.stdout, "encoding", None) or "utf-8")
    try:
        return s.encode(enc, "replace").decode(enc, "replace")
    except LookupError:
        return s.encode("ascii", "replace").decode("ascii")


def eprint(msg: str = "") -> None:
    print(_safe(msg), file=sys.stderr, flush=True)


def oprint(msg: str = "") -> None:
    print(_safe(msg), flush=True)


# ── subprocess ────────────────────────────────────────────────────────────
@dataclasses.dataclass
class Proc:
    argv: list[str]
    cwd: str
    returncode: int
    stdout: str
    stderr: str
    duration_s: float
    timed_out: bool = False

    @property
    def ok(self) -> bool:
        return self.returncode == 0 and not self.timed_out

    def summary(self) -> str:
        head = redact(" ".join(self.argv))
        if self.timed_out:
            return f"TIMEOUT after {self.duration_s:.1f}s: {head}"
        return f"exit {self.returncode} in {self.duration_s:.2f}s: {head}"


def run(
    argv: Sequence[str],
    *,
    cwd: str | os.PathLike[str],
    timeout: float = 120.0,
    check: bool = False,
    input_text: str | None = None,
    env: dict[str, str] | None = None,
) -> Proc:
    """Run `argv` (a real argument array) with shell=False. Never raises on a
    non-zero exit unless `check=True`; a timeout is reported on the Proc."""
    argv = [str(a) for a in argv]
    cwd = os.fspath(cwd)
    started = time.monotonic()
    timed_out = False
    try:
        cp = subprocess.run(
            argv,
            cwd=cwd,
            input=input_text,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="replace",
            timeout=timeout,
            env=env,
            shell=False,
        )
        rc, out, err = cp.returncode, cp.stdout or "", cp.stderr or ""
    except subprocess.TimeoutExpired as exc:
        timed_out = True
        rc = 124
        out = exc.stdout.decode("utf-8", "replace") if isinstance(exc.stdout, bytes) else (exc.stdout or "")
        err = exc.stderr.decode("utf-8", "replace") if isinstance(exc.stderr, bytes) else (exc.stderr or "")
    except FileNotFoundError as exc:
        raise ReleaseError(f"executable not found: {argv[0]} ({exc})") from exc
    dur = time.monotonic() - started
    p = Proc(argv=argv, cwd=cwd, returncode=rc, stdout=out, stderr=err, duration_s=dur, timed_out=timed_out)
    if check and not p.ok:
        raise ReleaseError(
            f"command failed ({p.summary()})\n"
            f"  stdout: {redact(out.strip())[:2000]}\n"
            f"  stderr: {redact(err.strip())[:2000]}"
        )
    return p


def which_exe(name: str) -> str | None:
    return shutil.which(name)


def resolve_git() -> str:
    g = shutil.which("git")
    if not g:
        raise ReleaseError("git was not found on PATH.")
    return g


def resolve_gh() -> str | None:
    return shutil.which("gh")


# ── npm invoked through Node (never the .cmd launcher) ─────────────────────
@dataclasses.dataclass
class Npm:
    node: str
    cli_js: str
    version: str

    def argv(self, args: Sequence[str]) -> list[str]:
        return [self.node, self.cli_js, *[str(a) for a in args]]

    def run(self, args: Sequence[str], *, cwd: str | os.PathLike[str], timeout: float = 300.0,
            check: bool = False, env: dict[str, str] | None = None) -> Proc:
        return run(self.argv(args), cwd=cwd, timeout=timeout, check=check, env=env)


def resolve_npm(node_exe: str | None = None) -> Npm:
    node = node_exe or shutil.which("node")
    if not node:
        raise ReleaseError("node was not found on PATH.")
    node_path = Path(node).resolve()
    candidates = [
        node_path.parent / "node_modules" / "npm" / "bin" / "npm-cli.js",
        node_path.parent.parent / "lib" / "node_modules" / "npm" / "bin" / "npm-cli.js",
    ]
    # last resort: ask npm where its global root is (npm.cmd is fine here -- one call, output only)
    if not any(c.is_file() for c in candidates):
        npm_launcher = shutil.which("npm")
        if npm_launcher:
            p = run([npm_launcher, "root", "-g"], cwd=".", timeout=60)
            if p.ok:
                candidates.append(Path(p.stdout.strip()) / "npm" / "bin" / "npm-cli.js")
    cli = next((c for c in candidates if c.is_file()), None)
    if cli is None:
        raise ReleaseError(
            "could not locate npm's npm-cli.js next to the Node executable "
            f"({node_path}). Install npm or pass --node explicitly."
        )
    ver = run([str(node), str(cli), "--version"], cwd=".", timeout=60)
    return Npm(node=str(node_path), cli_js=str(cli.resolve()), version=ver.stdout.strip() or "?")


# ── git repository handle ────────────────────────────────────────────────
@dataclasses.dataclass
class StatusEntry:
    path: str
    index_status: str      # X in porcelain v1
    worktree_status: str   # Y
    orig_path: str | None  # rename/copy source

    @property
    def is_untracked(self) -> bool:
        return self.index_status == "?" and self.worktree_status == "?"

    @property
    def is_staged(self) -> bool:
        return self.index_status not in (" ", "?", "!")

    @property
    def is_worktree_dirty(self) -> bool:
        return self.worktree_status not in (" ", "?", "!")


class Repo:
    """A git working tree. Every method runs `git` as an executable with an
    explicit cwd; none of them mutate refs, the index or the worktree unless
    the method name says so (`commit_from_allowlist`, `create_branch`, `push`)."""

    def __init__(self, root: str | os.PathLike[str], git_exe: str | None = None):
        self.git = git_exe or resolve_git()
        top = run([self.git, "rev-parse", "--show-toplevel"], cwd=root, timeout=30)
        if not top.ok:
            raise ReleaseError(f"{root} is not inside a git repository.")
        self.root = Path(top.stdout.strip()).resolve()

    # -- low level -------------------------------------------------------------
    def g(self, args: Sequence[str], *, timeout: float = 60.0, check: bool = False,
          env: dict[str, str] | None = None, input_text: str | None = None) -> Proc:
        return run([self.git, *args], cwd=self.root, timeout=timeout, check=check,
                   env=env, input_text=input_text)

    def g_out(self, args: Sequence[str], *, timeout: float = 60.0) -> str:
        p = self.g(args, timeout=timeout)
        return p.stdout.strip() if p.ok else ""

    # -- inspection ---------------------------------------------------------
    def head(self) -> str:
        return self.g_out(["rev-parse", "HEAD"])

    def head_short(self) -> str:
        return self.g_out(["rev-parse", "--short", "HEAD"])

    def branch(self) -> str | None:
        b = self.g_out(["branch", "--show-current"])
        return b or None

    def is_detached(self) -> bool:
        return self.branch() is None

    def remotes(self) -> dict[str, dict[str, str]]:
        out: dict[str, dict[str, str]] = {}
        p = self.g(["remote", "-v"])
        if not p.ok:
            return out
        for line in p.stdout.splitlines():
            parts = line.split()
            if len(parts) >= 3:
                name, url, kind = parts[0], parts[1], parts[2].strip("()")
                out.setdefault(name, {})[kind] = url
        return out

    def upstream(self) -> str | None:
        p = self.g(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"])
        return p.stdout.strip() if p.ok else None

    def ahead_behind(self, upstream: str | None = None) -> tuple[int, int] | None:
        up = upstream or self.upstream()
        if not up:
            return None
        p = self.g(["rev-list", "--left-right", "--count", f"{up}...HEAD"])
        if not p.ok:
            return None
        try:
            behind, ahead = (int(x) for x in p.stdout.split())
            return ahead, behind
        except ValueError:
            return None

    def status_entries(self) -> list[StatusEntry]:
        """Parse `git status --porcelain=v1 -z` (NUL-delimited, rename-safe)."""
        p = self.g(["-c", "core.quotepath=false", "status", "--porcelain=v1", "-z", "--untracked-files=all"])
        if not p.ok:
            raise ReleaseError(f"git status failed in {self.root}: {redact(p.stderr)}")
        raw = p.stdout
        entries: list[StatusEntry] = []
        i = 0
        n = len(raw)
        # records are NUL-separated; a rename/copy record is followed by an
        # extra NUL-terminated field (the original path).
        tokens = raw.split("\x00")
        idx = 0
        while idx < len(tokens):
            tok = tokens[idx]
            if tok == "":
                idx += 1
                continue
            xy, path = tok[:2], tok[3:]
            x, y = xy[0], xy[1]
            orig = None
            if x in ("R", "C") or y in ("R", "C"):
                idx += 1
                orig = tokens[idx] if idx < len(tokens) else None
            entries.append(StatusEntry(path=path, index_status=x, worktree_status=y, orig_path=orig))
            idx += 1
        return entries

    def is_ignored(self, rel: str) -> bool:
        p = self.g(["check-ignore", "-q", "--", rel])
        return p.returncode == 0

    def path_exists_in_head(self, rel: str) -> bool:
        p = self.g(["cat-file", "-e", f"HEAD:{rel}"])
        return p.returncode == 0

    def blob_hash_head(self, rel: str) -> str | None:
        p = self.g(["rev-parse", f"HEAD:{rel}"])
        return p.stdout.strip() if p.ok else None

    def blob_hash_worktree(self, rel: str) -> str | None:
        fp = self.root / rel
        if not fp.exists():
            return None
        p = self.g(["hash-object", "--", rel])
        return p.stdout.strip() if p.ok else None

    def branch_exists(self, name: str) -> bool:
        return self.g(["show-ref", "--verify", "--quiet", f"refs/heads/{name}"]).returncode == 0

    def remote_branch_exists(self, remote: str, name: str, *, timeout: float = 60.0) -> bool:
        p = self.g(["ls-remote", "--exit-code", "--heads", remote, name], timeout=timeout)
        return p.returncode == 0

    def diff_names_against_head(self, rel: str) -> bool:
        """True if `rel` differs from HEAD (tracked & modified)."""
        return self.g(["diff", "--quiet", "HEAD", "--", rel]).returncode != 0

    def unrelated_hunks(self, rel: str, keep_patch: str | None) -> bool:
        """Heuristic: a tracked file is 'mixed' when it differs from HEAD and no
        narrowly-prepared patch was supplied to isolate the release hunks."""
        if not self.path_exists_in_head(rel):
            return False  # brand-new file: nothing unrelated can hide in it
        if not self.diff_names_against_head(rel):
            return False
        return keep_patch is None

    # -- mutation (only via explicit callers) ------------------------------
    def create_branch(self, name: str, start_point: str) -> None:
        if self.branch_exists(name):
            cur = self.g_out(["rev-parse", name])
            want = self.g_out(["rev-parse", start_point])
            if cur != want:
                raise ReleaseError(
                    f"branch {name} already exists at {cur[:12]} but the plan starts from "
                    f"{want[:12]}. Delete or rename it, or choose another --branch."
                )
            return
        self.g(["branch", name, start_point], check=True)

    def commit_from_allowlist(
        self,
        *,
        base: str,
        add_paths: Sequence[str],
        delete_paths: Sequence[str],
        patches: Sequence[str],
        message_file: str,
        branch: str,
        author_env: dict[str, str] | None = None,
        allow_ignored: Sequence[str] = (),
        overrides: dict[str, str] | None = None,
    ) -> str:
        """Build a commit that contains ONLY `add_paths`/`delete_paths` (plus any
        `patches` applied on top of `base`), on top of `base`, and point
        refs/heads/<branch> at it. Uses a private temporary index -- the real
        index and worktree are never touched. Returns the new commit SHA.
        """
        base_sha = self.g_out(["rev-parse", f"{base}^{{commit}}"])
        if not base_sha:
            raise ReleaseError(f"cannot resolve base commit {base!r} in {self.root}")
        tmp_index = self.root / ".git" / f"obix-release-index-{os.getpid()}-{int(time.time())}"
        env = os.environ.copy()
        env["GIT_INDEX_FILE"] = str(tmp_index)
        if author_env:
            env.update(author_env)
        try:
            self.g(["read-tree", base_sha], env=env, check=True)
            for patch in patches:
                self.g(["apply", "--cached", "--whitespace=nowarn", "--", patch], env=env, check=True)
            for rel in delete_paths:
                self.g(["rm", "-r", "--cached", "--ignore-unmatch", "--", rel], env=env, check=True)
            ignored = set(allow_ignored)
            plain = [r for r in add_paths if r not in ignored]
            forced = [r for r in add_paths if r in ignored]
            if plain:
                self.g(["add", "--pathspec-from-file=-", "--pathspec-file-nul"],
                       env=env, check=True, input_text="\x00".join(plain))
            if forced:
                self.g(["add", "-f", "--pathspec-from-file=-", "--pathspec-file-nul"],
                       env=env, check=True, input_text="\x00".join(forced))
            # inject exact content for a path WITHOUT touching the worktree
            for rel, src in (overrides or {}).items():
                blob = self.g(["hash-object", "-w", "--path", rel, "--", src],
                              env=env, check=True).stdout.strip()
                self.g(["update-index", "--add", "--cacheinfo", f"100644,{blob},{rel}"],
                       env=env, check=True)
            # write-tree MUST see GIT_INDEX_FILE (env), or it writes the default index
            tree = self.g(["write-tree"], env=env, check=True, timeout=120).stdout.strip()
            if not tree:
                raise ReleaseError("git write-tree produced no tree (nothing selected?)")
            commit = self.g(
                ["commit-tree", tree, "-p", base_sha, "-F", message_file],
                env=env, check=True,
            ).stdout.strip()
            self.g(["update-ref", f"refs/heads/{branch}", commit], check=True)
            return commit
        finally:
            try:
                tmp_index.unlink()
            except OSError:
                pass

    def push(self, *, remote: str, branch: str, dry_run: bool, set_upstream: bool = False,
             timeout: float = 300.0) -> Proc:
        args = ["push"]
        if dry_run:
            args.append("--dry-run")
        if set_upstream:
            args.append("--set-upstream")
        # explicit refspec: never rely on push.default
        args += [remote, f"refs/heads/{branch}:refs/heads/{branch}"]
        return self.g(args, timeout=timeout)


# ── remote URL parsing ─────────────────────────────────────────────────────
_GH_RX = re.compile(
    r"^(?:https?://(?:[^@/]+@)?github\.com/|(?:ssh://)?git@github\.com[:/]|git://github\.com/)"
    r"(?P<owner>[^/]+)/(?P<repo>[^/]+?)(?:\.git)?/?$"
)


def parse_github_remote(url: str) -> tuple[str, str] | None:
    m = _GH_RX.match((url or "").strip())
    if not m:
        return None
    return m.group("owner"), m.group("repo")


# ── digests ───────────────────────────────────────────────────────────────
def sha256_file(path: str | os.PathLike[str]) -> str:
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def sha256_bytes(b: bytes) -> str:
    return hashlib.sha256(b).hexdigest()


def selection_digest(repo: Repo, rel_paths: Iterable[str]) -> str:
    """Stable digest over (path -> current worktree blob hash | '<deleted>').
    Changes if any selected file's content changes or the selection set changes.
    Does NOT fold in HEAD -- callers store base SHA separately."""
    items: dict[str, str] = {}
    for rel in sorted(set(rel_paths)):
        bh = repo.blob_hash_worktree(rel)
        items[rel] = bh if bh else "<deleted>"
    payload = json.dumps({"paths": items}, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return "sha256:" + sha256_bytes(payload)


# ── JSON plan / receipt IO ────────────────────────────────────────────────
def read_json(path: str | os.PathLike[str]) -> dict[str, Any]:
    with open(path, "r", encoding="utf-8") as fh:
        return json.load(fh)


def write_json_atomic(path: str | os.PathLike[str], obj: Any) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    fd, tmp = tempfile.mkstemp(dir=str(path.parent), prefix=path.name + ".", suffix=".tmp")
    try:
        with os.fdopen(fd, "w", encoding="utf-8", newline="\n") as fh:
            json.dump(obj, fh, indent=2, sort_keys=False)
            fh.write("\n")
        os.replace(tmp, path)
    finally:
        if os.path.exists(tmp):
            os.unlink(tmp)


def now_iso() -> str:
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def new_receipt(kind: str, *, extra: dict[str, Any] | None = None) -> dict[str, Any]:
    r = {
        "schema": RECEIPT_SCHEMA,
        "kind": kind,
        "tool_version": TOOL_VERSION,
        "started_at": now_iso(),
        "finished_at": None,
        "status": "in-progress",
        "steps": [],
    }
    if extra:
        r.update(extra)
    return r


class Receipt:
    """A durable, append-as-you-go receipt. Every `step()` flushes to disk so a
    crash or Ctrl+C still leaves a machine-readable record of what completed."""

    def __init__(self, path: str | os.PathLike[str], kind: str, *, extra: dict[str, Any] | None = None):
        self.path = Path(path)
        self.data = new_receipt(kind, extra=extra)
        self.flush()

    @classmethod
    def load(cls, path: str | os.PathLike[str]) -> "Receipt":
        r = cls.__new__(cls)
        r.path = Path(path)
        r.data = read_json(path)
        return r

    def flush(self) -> None:
        write_json_atomic(self.path, self.data)

    def step(self, name: str, status: str, **fields: Any) -> None:
        entry = {"name": name, "status": status, "at": now_iso()}
        entry.update(fields)
        self.data["steps"].append(entry)
        self.flush()

    def finish(self, status: str) -> None:
        self.data["status"] = status
        self.data["finished_at"] = now_iso()
        self.flush()

    def succeeded_steps(self) -> set[str]:
        return {s["name"] for s in self.data["steps"] if s["status"] == "ok"}


# ── Ctrl+C guard ─────────────────────────────────────────────────────────
class InterruptGuard:
    """On SIGINT: mark the receipt interrupted, flush, and raise Interrupted."""

    def __init__(self, receipt: Receipt):
        self.receipt = receipt
        self._prev = None

    def __enter__(self) -> "InterruptGuard":
        self._prev = signal.getsignal(signal.SIGINT)

        def handler(signum, frame):  # noqa: ANN001
            self.receipt.step("interrupt", "interrupted", note="SIGINT received")
            self.receipt.finish("interrupted")
            raise Interrupted("interrupted by SIGINT; a partial receipt was written to " + str(self.receipt.path))

        signal.signal(signal.SIGINT, handler)
        return self

    def __exit__(self, exc_type, exc, tb) -> None:  # noqa: ANN001
        if self._prev is not None:
            signal.signal(signal.SIGINT, self._prev)


# ── UTF-8 message / body files ───────────────────────────────────────────
def write_text_file(dir_: str | os.PathLike[str], name: str, text: str) -> Path:
    d = Path(dir_)
    d.mkdir(parents=True, exist_ok=True)
    p = d / name
    # newline="" keeps the caller's exact line endings; encoding is UTF-8, no BOM
    with open(p, "w", encoding="utf-8", newline="") as fh:
        fh.write(text)
    return p


# ── npm registry inspection ──────────────────────────────────────────────
def npm_view(npm: Npm, pkg: str, *, timeout: float = 90.0) -> dict[str, Any]:
    """Return {status: ok|absent|error, versions, dist_tags, raw_error}.
    A 404 => 'absent' (name has no published metadata). It does NOT prove the
    name is free to claim."""
    p = npm.run(["view", pkg, "versions", "dist-tags", "--json"], cwd=".", timeout=timeout)
    text = (p.stdout or "").strip()
    err = (p.stderr or "")
    if p.ok and text:
        try:
            data = json.loads(text)
        except json.JSONDecodeError:
            return {"status": "error", "raw_error": redact(text[:500]), "versions": [], "dist_tags": {}}
        versions = data.get("versions") if isinstance(data, dict) else None
        if isinstance(versions, str):
            versions = [versions]
        return {
            "status": "ok",
            "versions": versions or [],
            "dist_tags": (data.get("dist-tags") if isinstance(data, dict) else {}) or {},
        }
    if "E404" in err or "404 Not Found" in err or '"code": "E404"' in text:
        return {"status": "absent", "versions": [], "dist_tags": {}, "raw_error": "404"}
    return {"status": "error", "versions": [], "dist_tags": {}, "raw_error": redact((err or text)[:800])}


def npm_pack_integrity(npm: Npm, pkg_at_version: str, *, timeout: float = 120.0) -> dict[str, Any] | None:
    """`npm view <pkg@ver> dist.integrity dist.shasum --json` -- the registry's
    recorded archive hashes, for an already-published-version comparison."""
    p = npm.run(["view", pkg_at_version, "dist.integrity", "dist.shasum", "--json"], cwd=".", timeout=timeout)
    if not p.ok or not p.stdout.strip():
        return None
    try:
        data = json.loads(p.stdout)
    except json.JSONDecodeError:
        return None
    if isinstance(data, dict):
        return {"integrity": data.get("dist.integrity") or data.get("integrity"),
                "shasum": data.get("dist.shasum") or data.get("shasum")}
    return None


def sri_sha512_of_file(path: str | os.PathLike[str]) -> str:
    import base64
    h = hashlib.sha512()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return "sha512-" + base64.b64encode(h.digest()).decode("ascii")


# ── gh inspection ────────────────────────────────────────────────────────
def gh_auth_status(gh: str | None, *, timeout: float = 30.0) -> dict[str, Any]:
    if not gh:
        return {"available": False, "logged_in": False, "reason": "gh not installed"}
    p = run([gh, "auth", "status"], cwd=".", timeout=timeout)
    text = redact(p.stdout + "\n" + p.stderr)
    logged_in = "Logged in to" in text
    account = None
    scopes: list[str] = []
    m = re.search(r"account\s+([A-Za-z0-9-]+)", text)
    if m:
        account = m.group(1)
    m = re.search(r"Token scopes:\s*(.+)", text)
    if m:
        scopes = [s.strip().strip("'\"") for s in m.group(1).split(",") if s.strip()]
    return {"available": True, "logged_in": logged_in, "account": account, "scopes": scopes, "raw": text.strip()}


def gh_repo_view(gh: str | None, slug: str, *, timeout: float = 30.0) -> dict[str, Any]:
    """{'accessible': bool|None, 'permission': str|None, 'default_branch': str|None}.
    accessible=None means gh is unavailable (cannot determine)."""
    if not gh:
        return {"accessible": None, "permission": None, "default_branch": None, "reason": "gh not installed"}
    p = run([gh, "repo", "view", slug, "--json", "name,defaultBranchRef,viewerPermission"], cwd=".", timeout=timeout)
    if p.ok:
        try:
            d = json.loads(p.stdout)
            return {
                "accessible": True,
                "permission": d.get("viewerPermission"),
                "default_branch": (d.get("defaultBranchRef") or {}).get("name"),
            }
        except json.JSONDecodeError:
            pass
    return {"accessible": False, "permission": None, "default_branch": None,
            "reason": redact((p.stderr or p.stdout).strip()[:300])}


# ── misc ─────────────────────────────────────────────────────────────────
def rel_to(root: Path, p: str | os.PathLike[str]) -> str:
    return str(Path(p).resolve().relative_to(root)).replace("\\", "/")


def is_noise_path(rel: str) -> bool:
    """Paths we never reason about in a release plan (build caches, deps)."""
    parts = rel.replace("\\", "/").split("/")
    return "node_modules" in parts or rel.endswith((".tsbuildinfo",)) or "__pycache__" in parts


def assert_output_location(path: str | os.PathLike[str], repo_roots: Iterable[Path]) -> None:
    """Warn (do not fail) if a plan/receipt/manifest would be written inside a
    repo working tree and is not git-ignored there -- it could dirty the release
    inputs or slip into a tarball."""
    p = Path(path).resolve()
    for root in repo_roots:
        try:
            rel = p.relative_to(root)
        except ValueError:
            continue
        git = shutil.which("git")
        ignored = False
        if git:
            r = run([git, "check-ignore", "-q", "--", str(rel).replace("\\", "/")], cwd=root, timeout=15)
            ignored = r.returncode == 0
        if not ignored:
            eprint(
                f"WARNING: {p} is inside the {root.name} working tree and is not git-ignored. "
                f"Prefer an --out path outside both repositories (e.g. a temp dir)."
            )


def load_pkg_json(path: str | os.PathLike[str]) -> dict[str, Any]:
    return read_json(path)


def is_local_dep_spec(spec: str) -> bool:
    s = (spec or "").strip()
    return s.startswith(("file:", "link:", "workspace:", "portal:")) or s in (".", "..")


def _tempfile_dir(prefix: str) -> str:
    """A fresh temp directory OUTSIDE any repo (system temp)."""
    return tempfile.mkdtemp(prefix=prefix)


def _runtime_guess(key: str) -> str | None:
    """Best-effort path to a deno/bun binary not on PATH (mirrors the fixture)."""
    home = os.environ.get("USERPROFILE") or os.environ.get("HOME") or ""
    if not home:
        return None
    if os.name == "nt":
        cand = Path(home) / f".{key}" / "bin" / f"{key}.exe"
    else:
        cand = Path(home) / f".{key}" / "bin" / key
    return str(cand) if cand.exists() else None
