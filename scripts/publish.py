#!/usr/bin/env python3
"""
publish.py -- publish the OBIX core-compatibility release candidate to npm.

Publishes ONLY these eleven packages, never `npm publish --workspaces`:

    @obinexusltd/obix-core-capabilities   @obinexusltd/obix-core-modules
    @obinexusltd/obix-core-filesystem     @obinexusltd/obix-core-process
    @obinexusltd/obix-core-scheduler      @obinexusltd/obix-core-streams
    @obinexusltd/obix-core-workers        @obinexusltd/obix-core-native
    @obinexusltd/obix-core-web            @obinexusltd/obix-core-diagnostics
    @obinexusltd/obix                     (the umbrella, published LAST)

Phases:
  plan     inspect the registry + manifests, propose RC versions + pin rewrites
  prepare  apply the version rewrites to a work copy, build, `npm pack` the
           eleven, hash + inspect every tarball, write the release manifest
  verify   require green required CI for the EXACT source SHA pair, then re-pack
           from a clean checkout, install the tarballs in a fresh consumer and
           check `obix doctor --json` + runtime identity
  execute  (needs --execute + a verified manifest) publish the exact tested
           tarballs, deps first, umbrella last, `--access public --tag next`
  resume   continue a partially-completed execute from its receipt

Safe by default: only `execute --execute` uploads anything. `plan` and `prepare`
read the registry and write their own files but never publish, tag, deprecate or
unpublish. `--tag next` is used; `latest` is never moved.

    python scripts/publish.py plan    --out release-plan.json
    python scripts/publish.py prepare --plan release-plan.json --out release-manifest.json
    python scripts/publish.py verify  --manifest release-manifest.json
    python scripts/publish.py execute --manifest release-manifest.json --execute
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import sys
import time
from pathlib import Path
from typing import Any

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))
import _release_lib as rl  # noqa: E402

TOOL = "publish.py"
DEFAULT_CORE_RC = "0.1.0-rc.1"
DEFAULT_UMBRELLA_RC = "0.3.0-rc.1"
DEFAULT_TAG = "next"
CORE_VERSION_REL = "core/version.json"


# ═══════════════════════════════════════════════════════════════════════════
# repo / package discovery
# ═══════════════════════════════════════════════════════════════════════════
def find_monorepo(arg: str | None) -> rl.Repo:
    return rl.Repo(Path(arg).resolve() if arg else Path.cwd())


def core_dir(mono: rl.Repo, suffix: str) -> Path:
    return mono.root / "core" / f"obix-core-{suffix}"


def umbrella_dir(mono: rl.Repo) -> Path:
    return mono.root / "runtime" / "obix"


_PKG_DIR_CACHE: dict[tuple[str, str], Path] = {}


def pkg_dir(mono: rl.Repo, name: str) -> Path:
    if name == rl.UMBRELLA_PACKAGE:
        return umbrella_dir(mono)
    key = (str(mono.root), name)
    if key in _PKG_DIR_CACHE:
        return _PKG_DIR_CACHE[key]
    # conventional location first
    suffix = name.rsplit("-", 1)[-1]
    conv = core_dir(mono, suffix)
    if (conv / "package.json").is_file():
        _PKG_DIR_CACHE[key] = conv
        return conv
    # otherwise scan core/* for the dir whose manifest carries this name
    base = mono.root / "core"
    if base.is_dir():
        for d in sorted(base.iterdir()):
            pj = d / "package.json"
            if pj.is_file():
                try:
                    if rl.read_json(pj).get("name") == name:
                        _PKG_DIR_CACHE[key] = d
                        return d
                except Exception:
                    pass
    _PKG_DIR_CACHE[key] = conv
    return conv


def load_manifests(mono: rl.Repo) -> dict[str, dict[str, Any]]:
    out: dict[str, dict[str, Any]] = {}
    for name in rl.PUBLISH_ALLOWLIST:
        pj = pkg_dir(mono, name) / "package.json"
        if not pj.is_file():
            raise rl.ReleaseError(f"missing manifest for {name}: {pj}")
        m = rl.read_json(pj)
        if m.get("name") != name:
            raise rl.ReleaseError(f"{pj}: name is {m.get('name')!r}, expected {name!r}")
        out[name] = m
    return out


# ═══════════════════════════════════════════════════════════════════════════
# version proposal + pin rewrite
# ═══════════════════════════════════════════════════════════════════════════
def propose_versions(core_rc: str, umbrella_rc: str) -> dict[str, str]:
    v = {n: core_rc for n in rl.CORE_PACKAGES}
    v[rl.UMBRELLA_PACKAGE] = umbrella_rc
    return v


def rewrite_manifest(m: dict[str, Any], versions: dict[str, str]) -> dict[str, Any]:
    """Return a copy of `m` with its own version + every internal
    @obinexusltd/obix-core-* dependency pinned EXACT to the RC version."""
    out = json.loads(json.dumps(m))  # deep copy
    out["version"] = versions[m["name"]]
    for field in ("dependencies", "peerDependencies", "optionalDependencies"):
        deps = out.get(field)
        if not isinstance(deps, dict):
            continue
        for dep in list(deps):
            # a published package must never carry a local spec -- flag it even
            # for an internal package rather than silently "fixing" it.
            if rl.is_local_dep_spec(str(deps[dep])):
                raise rl.ReleaseError(
                    f"{m['name']}: dependency {dep} has a local spec {deps[dep]!r} -- "
                    f"a published package must not carry file:/link:/workspace: specs. "
                    f"Set an exact version in the source manifest instead."
                )
            if dep in versions:
                deps[dep] = versions[dep]  # exact pin, no ^ or ~
    return out


# ═══════════════════════════════════════════════════════════════════════════
# plan
# ═══════════════════════════════════════════════════════════════════════════
def cmd_plan(args: argparse.Namespace) -> int:
    mono = find_monorepo(args.monorepo)
    npm = rl.resolve_npm(args.node)
    out_path = Path(args.out).resolve()
    rl.assert_output_location(out_path, [mono.root])

    manifests = load_manifests(mono)
    core_rc = args.core_version or DEFAULT_CORE_RC
    umb_rc = args.umbrella_version or DEFAULT_UMBRELLA_RC
    if args.rc is not None:
        core_rc = _bump_rc(DEFAULT_CORE_RC, args.rc)
        umb_rc = _bump_rc(DEFAULT_UMBRELLA_RC, args.rc)
    versions = propose_versions(core_rc, umb_rc)

    rl.oprint(f"npm {npm.version} via {npm.node}")
    rl.oprint(f"proposed RC: core={core_rc}  umbrella={umb_rc}  tag={args.tag}\n")

    registry: dict[str, Any] = {}
    collisions: list[str] = []
    errors: list[str] = []
    for name in rl.PUBLISH_ALLOWLIST:
        info = rl.npm_view(npm, name)
        registry[name] = info
        proposed = versions[name]
        status = info["status"]
        note = ""
        if status == "ok":
            if proposed in info["versions"]:
                collisions.append(f"{name}@{proposed}")
                note = "  <-- version ALREADY PUBLISHED"
            latest = info["dist_tags"].get("latest")
            note += f"  (published: {len(info['versions'])}, latest={latest})"
        elif status == "absent":
            note = "  (404 -- no published metadata; NOT proof the name is free)"
        else:
            errors.append(f"{name}: {info.get('raw_error','?')}")
            note = f"  (registry error: {info.get('raw_error','?')[:80]})"
        rl.oprint(f"  {name:38} -> {proposed}{note}")

    plan = {
        "schema": rl.RELEASE_PLAN_SCHEMA,
        "tool_version": rl.TOOL_VERSION,
        "generated_at": rl.now_iso(),
        "monorepo_root": str(mono.root),
        "monorepo_head": mono.head(),
        "node": npm.node,
        "npm_version": npm.version,
        "tag": args.tag,
        "proposed_versions": versions,
        "current_versions": {n: manifests[n]["version"] for n in rl.PUBLISH_ALLOWLIST},
        "core_version_json": rl.read_json(mono.root / CORE_VERSION_REL),
        "pin_rewrites": _describe_pin_rewrites(manifests, versions),
        "registry": {n: {"status": registry[n]["status"],
                         "published_versions": registry[n]["versions"],
                         "dist_tags": registry[n]["dist_tags"]} for n in rl.PUBLISH_ALLOWLIST},
        "collisions": collisions,
        "registry_errors": errors,
        "publish_order": list(rl.PUBLISH_ALLOWLIST),
        "notes": [
            "publish deps first, umbrella LAST",
            "npm publish per-tarball only; NEVER `npm publish --workspaces`",
            f"dist-tag `{args.tag}` -- `latest` is never moved",
            "a 404 is 'absent metadata', not proof of name ownership",
        ],
    }
    rl.write_json_atomic(out_path, plan)
    rl.oprint(f"\nwrote {out_path}")
    if collisions:
        rl.oprint(f"\nCOLLISION: {', '.join(collisions)} already exist on the registry. "
                  f"Pass --rc <N> to move the RC number deliberately (never auto-bumped).")
    if errors:
        rl.oprint(f"\nREGISTRY ERRORS (not 404s) for: {', '.join(e.split(':')[0] for e in errors)} "
                  f"-- resolve auth/network before prepare.")
    return 0 if not (collisions or errors) else 2


def _bump_rc(base: str, n: int) -> str:
    stem = base.split("-rc.")[0]
    return f"{stem}-rc.{n}"


def _describe_pin_rewrites(manifests: dict[str, dict[str, Any]], versions: dict[str, str]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for name, m in manifests.items():
        entry: dict[str, Any] = {"version": [m["version"], versions[name]], "deps": {}}
        for dep, spec in (m.get("dependencies") or {}).items():
            if dep in versions:
                entry["deps"][dep] = [spec, versions[dep]]
        out[name] = entry
    out["__core_version_json__"] = {"version": [None, versions[rl.CORE_PACKAGES[0]]]}
    return out


# ═══════════════════════════════════════════════════════════════════════════
# prepare
# ═══════════════════════════════════════════════════════════════════════════
def _publishable_files(pkg_root: Path, manifest: dict[str, Any]) -> list[str]:
    """Approximate `npm pack`'s file set from `files` + always-included names."""
    keep: set[str] = set()
    globs = list(manifest.get("files") or [])
    for g in globs:
        g = g.strip("./")
        base = pkg_root / g
        if base.is_dir():
            for f in base.rglob("*"):
                if f.is_file():
                    keep.add(str(f.relative_to(pkg_root)).replace("\\", "/"))
        else:
            for f in pkg_root.glob(g):
                if f.is_file():
                    keep.add(str(f.relative_to(pkg_root)).replace("\\", "/"))
    for always in ("package.json", "README.md", "readme.md", "LICENSE", "LICENSE.md", "LICENCE"):
        if (pkg_root / always).is_file():
            keep.add(always)
    return sorted(keep)


def cmd_prepare(args: argparse.Namespace) -> int:
    plan = rl.read_json(args.plan)
    if plan.get("schema") != rl.RELEASE_PLAN_SCHEMA:
        raise rl.ReleaseError(f"{args.plan}: not a {rl.RELEASE_PLAN_SCHEMA} document.")
    mono = find_monorepo(args.monorepo)
    npm = rl.resolve_npm(plan.get("node") or args.node)
    if plan["collisions"] and not args.allow_collision:
        raise rl.ReleaseError(
            f"the plan records version collisions ({', '.join(plan['collisions'])}). "
            f"Re-run `plan --rc <N>` to choose a new RC number, or pass --allow-collision "
            f"to prepare tarballs anyway (execute will still refuse to overwrite)."
        )

    work = Path(args.work).resolve() if args.work else Path(rl._tempfile_dir("obix-prepare-"))
    work.mkdir(parents=True, exist_ok=True)
    rl.assert_output_location(args.out, [mono.root])
    tar_dir = work / "tarballs"
    tar_dir.mkdir(exist_ok=True)
    copy_root = work / "pkg"
    copy_root.mkdir(exist_ok=True)

    versions = plan["proposed_versions"]
    manifests = load_manifests(mono)

    # source SHAs from the commit receipt / release-source manifest, if present
    src = _resolve_source_shas(mono, args)

    rl.oprint(f"prepare: work dir {work}")
    rl.oprint(f"source pair: monorepo={src['monorepo_sha'][:12] if src['monorepo_sha'] else '?'}  "
              f"umbrella={src['umbrella_sha'][:12] if src['umbrella_sha'] else '?'}\n")

    # optional: build first so dist/ is current
    if not args.no_build:
        rl.oprint("building core packages via scripts/check-core-graph.mjs ...")
        b = rl.run([npm.node, str(mono.root / "scripts" / "check-core-graph.mjs"), "--no-frozen-check"],
                   cwd=mono.root, timeout=900)
        if not b.ok:
            raise rl.ReleaseError("build (check-core-graph.mjs) failed:\n" + rl.redact(b.stdout[-2000:] + b.stderr[-2000:]))
        ub = rl.run([npm.node, str(_resolve_local_tsc(umbrella_dir(mono))), "-p", "tsconfig.json"],
                    cwd=umbrella_dir(mono), timeout=300)
        if not ub.ok:
            raise rl.ReleaseError("umbrella tsc build failed:\n" + rl.redact(ub.stdout[-1500:] + ub.stderr[-1500:]))
        rl.oprint("  build ok\n")

    tarballs: dict[str, dict[str, Any]] = {}
    for name in plan["publish_order"]:
        root = pkg_dir(mono, name)
        m = manifests[name]
        rewritten = rewrite_manifest(m, versions)
        dst = copy_root / name.replace("/", "__")
        if dst.exists():
            shutil.rmtree(dst)
        dst.mkdir(parents=True)
        files = _publishable_files(root, m)
        for rel in files:
            s = root / rel
            d = dst / rel
            d.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(s, d)
        rl.write_json_atomic(dst / "package.json", rewritten)

        # pack the rewritten copy
        p = npm.run(["pack", "--pack-destination", str(tar_dir)], cwd=dst, timeout=300)
        if not p.ok:
            raise rl.ReleaseError(f"npm pack failed for {name}:\n" + rl.redact(p.stdout + p.stderr))
        tgz_name = p.stdout.strip().splitlines()[-1].strip()
        tgz = tar_dir / tgz_name
        if not tgz.is_file():
            raise rl.ReleaseError(f"npm pack for {name} produced no tarball ({tgz_name})")

        contents = _inspect_tarball(npm, tgz, name, versions[name], rewritten)
        tarballs[name] = {
            "version": versions[name],
            "tarball": tgz.name,
            "path": str(tgz),
            "sha512": rl.sri_sha512_of_file(tgz),
            "sha256": rl.sha256_file(tgz),
            "bytes": tgz.stat().st_size,
            "contents": contents,
        }
        rl.oprint(f"  packed {name:38} {versions[name]:14} {tgz.name}  ({tgz.stat().st_size} B)")
        for w in contents["warnings"]:
            rl.oprint(f"      ! {w}")

    manifest = {
        "schema": rl.RELEASE_MANIFEST_SCHEMA,
        "tool_version": rl.TOOL_VERSION,
        "generated_at": rl.now_iso(),
        "source": src,
        "tag": plan["tag"],
        "registry": args.registry,
        "node": npm.node,
        "npm_version": npm.version,
        "runtimes": _runtime_versions(args),
        "proposed_versions": versions,
        "publish_order": plan["publish_order"],
        "work_dir": str(work),
        "tarball_dir": str(tar_dir),
        "packages": tarballs,
        "ci": {"verified": False, "reason": "not run -- call publish.py verify"},
        "verified": False,
        "prepare_warnings": sorted({w for t in tarballs.values() for w in t["contents"]["warnings"]}),
        "version_commit": None,
    }

    if args.commit_versions:
        vc = _commit_version_bump(mono, plan, versions, src, work, args)
        manifest["version_commit"] = vc

    rl.write_json_atomic(args.out, manifest)
    rl.oprint(f"\nwrote {args.out}")
    if manifest["prepare_warnings"]:
        rl.oprint("\nprepare warnings:")
        for w in manifest["prepare_warnings"]:
            rl.oprint("  ! " + w)
    rl.oprint("\nnext: `publish.py verify --manifest " + str(args.out) + "`")
    return 0


def _inspect_tarball(npm: rl.Npm, tgz: Path, name: str, version: str, manifest: dict[str, Any]) -> dict[str, Any]:
    """Read the tarball's file list + its embedded package.json; flag anything
    unexpected."""
    import tarfile
    warnings: list[str] = []
    entries: list[str] = []
    embedded: dict[str, Any] | None = None
    with tarfile.open(tgz, "r:gz") as tf:
        for ti in tf.getmembers():
            if not ti.isfile():
                continue
            rel = ti.name.split("/", 1)[1] if "/" in ti.name else ti.name  # strip leading "package/"
            entries.append(rel)
            if rel == "package.json" and embedded is None:
                f = tf.extractfile(ti)
                if f:
                    embedded = json.loads(f.read().decode("utf-8"))
    if embedded is None:
        warnings.append("no package.json inside the tarball")
    else:
        if embedded.get("name") != name:
            warnings.append(f"embedded name {embedded.get('name')!r} != {name!r}")
        if embedded.get("version") != version:
            warnings.append(f"embedded version {embedded.get('version')!r} != {version!r}")
        for field in ("dependencies", "peerDependencies", "optionalDependencies"):
            for dep, spec in (embedded.get(field) or {}).items():
                if rl.is_local_dep_spec(str(spec)):
                    warnings.append(f"published dep {dep} has a local spec {spec!r}")
                if dep in rl.PUBLISH_ALLOWLIST and not _is_exact(str(spec)):
                    warnings.append(f"internal dep {dep} pin {spec!r} is not exact")
        bin_field = embedded.get("bin")
        bins = [bin_field] if isinstance(bin_field, str) else list((bin_field or {}).values())
        for b in bins:
            b = b.lstrip("./")
            if b and b not in entries:
                warnings.append(f"bin target {b!r} is not in the tarball")
        exp = embedded.get("exports")
        for target in _export_targets(exp):
            t = target.lstrip("./")
            if t and t not in entries and not t.endswith("package.json"):
                warnings.append(f"exports target {t!r} is not in the tarball")
    has_js = any(e.endswith(".js") for e in entries)
    has_dts = any(e.endswith(".d.ts") for e in entries)
    has_license = any(e.lower().startswith("license") or e.lower().startswith("licence") for e in entries)
    has_readme = any(e.lower() == "readme.md" for e in entries)
    if not has_js:
        warnings.append("no .js files in the tarball")
    if not has_dts:
        warnings.append("no .d.ts files in the tarball")
    if not has_license:
        warnings.append("no LICENSE in the tarball")
    if not has_readme and name != rl.UMBRELLA_PACKAGE:
        warnings.append("no README.md in the tarball")
    # unexpected top-level dirs
    top = {e.split("/", 1)[0] for e in entries if "/" in e}
    allowed_top = {"dist", "src", "docs", "examples", "bin", "types"}
    for d in sorted(top - allowed_top):
        warnings.append(f"unexpected top-level entry in tarball: {d}/")
    return {"files": sorted(entries), "embedded_pkg": embedded, "warnings": warnings}


def _is_exact(spec: str) -> bool:
    s = spec.strip()
    return bool(s) and s[0].isdigit()


def _export_targets(exp: Any) -> list[str]:
    out: list[str] = []
    if isinstance(exp, str):
        out.append(exp)
    elif isinstance(exp, dict):
        for v in exp.values():
            out.extend(_export_targets(v))
    return out


def _runtime_versions(args: argparse.Namespace) -> dict[str, str | None]:
    out: dict[str, str | None] = {}
    node = shutil.which("node")
    if node:
        out["node"] = rl.run([node, "--version"], cwd=".", timeout=30).stdout.strip()
    for key, envvar, default in (("deno", "OBIX_DENO", None), ("bun", "OBIX_BUN", None)):
        exe = os.environ.get(envvar) or shutil.which(key) or rl._runtime_guess(key)
        if exe and Path(exe).exists():
            r = rl.run([exe, "--version"], cwd=".", timeout=30)
            out[key] = r.stdout.strip().splitlines()[0] if r.ok else None
        else:
            out[key] = None
    return out


def _resolve_local_tsc(from_dir: Path) -> str:
    import importlib.util  # noqa: F401
    node = shutil.which("node")
    r = rl.run([node, "-e",
                "process.stdout.write(require('module').createRequire(process.argv[1]).resolve('typescript/bin/tsc'))",
                str(from_dir / "package.json")], cwd=str(from_dir), timeout=30)
    if not r.ok or not r.stdout.strip():
        raise rl.ReleaseError(f"could not resolve typescript/bin/tsc from {from_dir}")
    return r.stdout.strip()


def _resolve_source_shas(mono: rl.Repo, args: argparse.Namespace) -> dict[str, Any]:
    rel_src_path = mono.root / "docs" / "core-compatibility" / "release-source.json"
    umbrella_sha = args.umbrella_sha
    monorepo_sha = args.monorepo_sha
    slug_u = None
    if not umbrella_sha and rel_src_path.is_file():
        try:
            rs = rl.read_json(rel_src_path)
            umbrella_sha = rs.get("umbrella", {}).get("sha")
            slug_u = rs.get("umbrella", {}).get("github_slug")
        except Exception:
            pass
    if args.commit_receipt and Path(args.commit_receipt).is_file():
        try:
            cr = rl.read_json(args.commit_receipt)
            umbrella_sha = umbrella_sha or cr.get("umbrella_sha")
            monorepo_sha = monorepo_sha or cr.get("monorepo_sha")
            slug_u = slug_u or cr.get("umbrella_slug")
        except Exception:
            pass
    return {
        "monorepo_sha": monorepo_sha,
        "monorepo_slug": _slug_of(mono),
        "umbrella_sha": umbrella_sha,
        "umbrella_slug": slug_u,
        "resolved_from": "release-source.json / commit receipt / --*-sha flags",
    }


def _slug_of(repo: rl.Repo) -> str | None:
    for n, u in repo.remotes().items():
        gh = rl.parse_github_remote(u.get("push") or u.get("fetch") or "")
        if gh:
            return f"{gh[0]}/{gh[1]}"
    return None


def _commit_version_bump(mono: rl.Repo, plan: dict[str, Any], versions: dict[str, str],
                         src: dict[str, Any], work: Path, args: argparse.Namespace) -> dict[str, Any]:
    """Create the RC version-bump commit ON TOP of the review branch in BOTH
    repos (nested umbrella first), via the same alt-index machinery commit.py
    uses. Returns {umbrella_sha, monorepo_sha}. Requires the review branch to
    already exist (from commit.py apply --execute)."""
    branch = args.review_branch
    umb = rl.Repo(umbrella_dir(mono))
    for repo, role in ((umb, "umbrella"), (mono, "monorepo")):
        if not repo.branch_exists(branch):
            raise rl.ReleaseError(
                f"--commit-versions needs the review branch {branch!r} in {repo.root}; "
                f"run `python scripts/commit.py apply --execute` first."
            )
    scratch = work / "_vbump"
    scratch.mkdir(parents=True, exist_ok=True)
    manifests = load_manifests(mono)

    # umbrella: rewrite its package.json
    umb_over: dict[str, str] = {}
    um = rewrite_manifest(manifests[rl.UMBRELLA_PACKAGE], versions)
    umf = scratch / "umbrella.package.json"
    rl.write_json_atomic(umf, um)
    umb_over["package.json"] = str(umf)
    umb_msg = rl.write_text_file(scratch, "umbrella-vbump.txt",
                                 f"release(core-compat): version -> {versions[rl.UMBRELLA_PACKAGE]} (rc)\n\n"
                                 f"Exact-pin the ten @obinexusltd/obix-core-* deps to "
                                 f"{versions[rl.CORE_PACKAGES[0]]}.\n\n"
                                 + (rl.COAUTHOR_TRAILER + "\n"))
    umb_sha = umb.commit_from_allowlist(
        base=branch, add_paths=[], delete_paths=[], patches=[],
        message_file=str(umb_msg), branch=branch, overrides=umb_over,
    )

    # monorepo: rewrite the ten core manifests + core/version.json
    mono_over: dict[str, str] = {}
    for name in rl.CORE_PACKAGES:
        rw = rewrite_manifest(manifests[name], versions)
        suffix = name.rsplit("-", 1)[-1]
        f = scratch / f"core-{suffix}.package.json"
        rl.write_json_atomic(f, rw)
        mono_over[f"core/obix-core-{suffix}/package.json"] = str(f)
    cvj = scratch / "core.version.json"
    rl.write_json_atomic(cvj, {"version": versions[rl.CORE_PACKAGES[0]]})
    mono_over[CORE_VERSION_REL] = str(cvj)
    mono_msg = rl.write_text_file(scratch, "monorepo-vbump.txt",
                                  f"release(core-compat): core version -> {versions[rl.CORE_PACKAGES[0]]} (rc)\n\n"
                                  f"Bump core/version.json and all ten core manifests + exact internal pins. "
                                  f"Umbrella bumped to {versions[rl.UMBRELLA_PACKAGE]} in its own repo "
                                  f"({umb_sha}).\n\n" + (rl.COAUTHOR_TRAILER + "\n"))
    mono_sha = mono.commit_from_allowlist(
        base=branch, add_paths=[], delete_paths=[], patches=[],
        message_file=str(mono_msg), branch=branch, overrides=mono_over,
    )
    return {"umbrella_sha": umb_sha, "monorepo_sha": mono_sha, "branch": branch}


# ═══════════════════════════════════════════════════════════════════════════
# verify
# ═══════════════════════════════════════════════════════════════════════════
REQUIRED_JOBS = ("graph-gate", "contract-node", "packed-consumer")


def cmd_verify(args: argparse.Namespace) -> int:
    manifest = rl.read_json(args.manifest)
    if manifest.get("schema") != rl.RELEASE_MANIFEST_SCHEMA:
        raise rl.ReleaseError(f"{args.manifest}: not a {rl.RELEASE_MANIFEST_SCHEMA} document.")
    mono = find_monorepo(args.monorepo)
    npm = rl.resolve_npm(manifest.get("node") or args.node)
    gh = rl.resolve_gh()

    receipt_path = Path(args.receipt or (Path(args.manifest).parent / "verify-receipt.json"))
    rl.assert_output_location(receipt_path, [mono.root])
    receipt = rl.Receipt(receipt_path, kind="publish-verify",
                         extra={"manifest": str(Path(args.manifest).resolve())})

    src = manifest["source"]
    rl.oprint("verify: source pair")
    rl.oprint(f"  monorepo {src.get('monorepo_slug')}@{(src.get('monorepo_sha') or '?')[:12]}")
    rl.oprint(f"  umbrella {src.get('umbrella_slug')}@{(src.get('umbrella_sha') or '?')[:12]}")

    # ---- 1. CI evidence for the EXACT monorepo SHA -----------------------
    ci = _verify_ci(gh, src, receipt, args)
    manifest["ci"] = ci
    receipt.step("ci-evidence", "ok" if ci["verified"] else "unmet", **ci)

    # ---- 2. tarball hashes still match ----------------------------------
    tb_ok = _verify_tarball_hashes(manifest, receipt)

    # ---- 3. re-pack from a clean checkout (heavy; REQUIRED for verified) --
    if args.no_clean_checkout:
        clean_state = "skipped"
        receipt.step("clean-checkout", "skipped", reason="--no-clean-checkout (blocks verified=true)")
    elif not (src.get("monorepo_sha") and src.get("umbrella_sha")):
        clean_state = "skipped"
        receipt.step("clean-checkout", "skipped", reason="source SHAs not recorded (run commit.py apply --execute)")
    else:
        clean_state = "ok" if _verify_clean_checkout(mono, npm, src, manifest, receipt, args) else "failed"

    # ---- 4. install the tarballs + doctor + runtime identity ----------
    consumer_ok = _verify_consumer(npm, manifest, receipt, args)

    verified = bool(ci["verified"] and tb_ok and clean_state == "ok" and consumer_ok)
    manifest["verified"] = verified
    manifest["verified_at"] = rl.now_iso() if verified else None
    rl.write_json_atomic(args.manifest, manifest)
    receipt.finish("ok" if verified else "unmet")

    def mark(b: bool) -> str:
        return "PASS" if b else "FAIL"
    rl.oprint("\n=== verify summary ===")
    rl.oprint(f"  CI evidence (exact SHA)   : {'PASS' if ci['verified'] else 'UNMET -- ' + ci.get('reason','')}")
    rl.oprint(f"  tarball hashes unchanged  : {mark(tb_ok)}")
    rl.oprint(f"  clean-checkout gates      : {clean_state.upper()}"
              + ("  (pass --no-clean-checkout=false / record source SHAs to run this)"
                 if clean_state == "skipped" else ""))
    rl.oprint(f"  installed-consumer doctor : {mark(consumer_ok)}")
    rl.oprint(f"  -> manifest.verified = {verified}")
    if not verified:
        rl.oprint("\n`execute` will refuse until every line above is PASS. "
                  "The CI line needs `gh` access to the monorepo repository for the "
                  "authenticated account, or a run triggered from an account that has it.")
    return 0 if verified else 2


def _verify_ci(gh: str | None, src: dict[str, Any], receipt: rl.Receipt,
               args: argparse.Namespace) -> dict[str, Any]:
    slug = args.gh_repo or src.get("monorepo_slug")
    sha = src.get("monorepo_sha")
    umb_sha = src.get("umbrella_sha")
    if not slug or not sha:
        return {"verified": False, "reason": "monorepo slug/SHA not recorded in the manifest"}
    if not gh:
        return {"verified": False, "reason": "gh CLI not installed -- cannot read Actions results"}
    acc = rl.gh_repo_view(gh, slug)
    if acc.get("accessible") is not True:
        return {"verified": False, "reason": f"gh cannot access {slug} "
                f"({acc.get('reason', acc.get('permission'))}) -- CI results are unreadable "
                f"for the authenticated account"}
    runs = rl.run([gh, "run", "list", "--repo", slug, "--workflow", "core-compatibility.yml",
                   "--commit", sha, "--json",
                   "databaseId,headSha,status,conclusion,workflowName,url", "--limit", "20"],
                  cwd=".", timeout=90)
    if not runs.ok:
        return {"verified": False, "reason": f"`gh run list` failed: {rl.redact(runs.stderr[:300])}"}
    try:
        arr = json.loads(runs.stdout or "[]")
    except json.JSONDecodeError:
        return {"verified": False, "reason": "could not parse `gh run list` output"}
    arr = [r for r in arr if r.get("headSha") == sha]
    if not arr:
        return {"verified": False, "reason": f"no core-compatibility run found for {slug}@{sha[:12]}"}
    run = arr[0]
    if run.get("status") != "completed" or run.get("conclusion") != "success":
        return {"verified": False, "reason": f"run {run.get('databaseId')} is "
                f"{run.get('status')}/{run.get('conclusion')} (need completed/success)",
                "run_url": run.get("url")}
    jobs = rl.run([gh, "run", "view", str(run["databaseId"]), "--repo", slug,
                   "--json", "jobs"], cwd=".", timeout=90)
    job_concl: dict[str, str] = {}
    umbrella_in_evidence = None
    try:
        jd = json.loads(jobs.stdout or "{}")
        for j in jd.get("jobs", []):
            job_concl[j.get("name", "")] = j.get("conclusion", "")
            for step in j.get("steps", []):
                if "umbrella" in step.get("name", "").lower():
                    umbrella_in_evidence = True
    except json.JSONDecodeError:
        pass
    missing = [j for j in REQUIRED_JOBS if not any(name.startswith(j) for name in job_concl)]
    failed = [name for name, c in job_concl.items()
              if any(name.startswith(j) for j in REQUIRED_JOBS) and c not in ("success",)]
    skipped_required = [name for name, c in job_concl.items()
                        if any(name.startswith(j) for j in REQUIRED_JOBS) and c == "skipped"]
    ok = not missing and not failed and not skipped_required
    return {
        "verified": ok,
        "reason": "" if ok else f"missing={missing} failed={failed} skipped_required={skipped_required}",
        "run_id": run["databaseId"],
        "run_url": run.get("url"),
        "monorepo_sha": sha,
        "umbrella_sha_expected": umb_sha,
        "umbrella_sha_in_evidence": bool(umbrella_in_evidence),
        "job_conclusions": job_concl,
    }


def _verify_tarball_hashes(manifest: dict[str, Any], receipt: rl.Receipt) -> bool:
    ok = True
    for name, info in manifest["packages"].items():
        p = Path(info["path"])
        if not p.is_file():
            receipt.step(f"hash-{name}", "failed", reason=f"tarball missing: {p}")
            ok = False
            continue
        cur = rl.sri_sha512_of_file(p)
        if cur != info["sha512"]:
            receipt.step(f"hash-{name}", "failed", expected=info["sha512"], actual=cur)
            ok = False
        else:
            receipt.step(f"hash-{name}", "ok", sha512=cur)
    return ok


def _verify_clean_checkout(mono: rl.Repo, npm: rl.Npm, src: dict[str, Any],
                           manifest: dict[str, Any], receipt: rl.Receipt,
                           args: argparse.Namespace) -> bool:
    tmp = Path(rl._tempfile_dir("obix-clean-"))
    try:
        # local clone of the monorepo, checkout the recorded SHA
        cl = rl.run([mono.git, "clone", "--no-local" if args.clone_no_local else "--local",
                     "--no-checkout", str(mono.root), str(tmp / "monorepo")], cwd=".", timeout=300)
        if not cl.ok:
            receipt.step("clean-checkout", "failed", stage="clone", detail=rl.redact(cl.stderr[:400]))
            return False
        co = rl.run([mono.git, "-C", str(tmp / "monorepo"), "checkout", "--detach", src["monorepo_sha"]],
                    cwd=".", timeout=120)
        if not co.ok:
            receipt.step("clean-checkout", "failed", stage="checkout-monorepo",
                         detail=rl.redact(co.stderr[:400]))
            return False
        # nested umbrella at its recorded SHA into runtime/obix
        umb = umbrella_dir(mono)
        cl2 = rl.run([mono.git, "clone", "--local", "--no-checkout", str(umb),
                      str(tmp / "monorepo" / "runtime" / "obix")], cwd=".", timeout=300)
        if cl2.ok:
            rl.run([mono.git, "-C", str(tmp / "monorepo" / "runtime" / "obix"),
                    "checkout", "--detach", src["umbrella_sha"]], cwd=".", timeout=120)
        else:
            receipt.step("clean-checkout", "failed", stage="clone-umbrella",
                         detail=rl.redact(cl2.stderr[:400]))
            return False
        root = tmp / "monorepo"
        steps = [
            ("graph-gate", [npm.node, "scripts/check-core-graph.mjs"]),
            ("packed-consumer", [npm.node, "core/fixtures/pack-and-verify.mjs"]),
        ]
        # graph-gate needs deps linked
        inst = npm.run(["ci", "--no-audit", "--no-fund"], cwd=root, timeout=1200)
        if not inst.ok:
            inst = npm.run(["install", "--no-audit", "--no-fund"], cwd=root, timeout=1200)
        receipt.step("clean-install", "ok" if inst.ok else "failed",
                     detail=None if inst.ok else rl.redact((inst.stderr or "")[-600:]))
        all_ok = inst.ok
        for label, cmd in steps:
            r = rl.run(cmd, cwd=root, timeout=1800)
            receipt.step(f"clean-{label}", "ok" if r.ok else "failed",
                         detail=None if r.ok else rl.redact((r.stdout[-800:] + r.stderr[-800:])))
            all_ok = all_ok and r.ok
        return all_ok
    finally:
        if not args.keep_temp:
            shutil.rmtree(tmp, ignore_errors=True)


def _verify_consumer(npm: rl.Npm, manifest: dict[str, Any], receipt: rl.Receipt,
                     args: argparse.Namespace) -> bool:
    tmp = Path(rl._tempfile_dir("obix-consume-"))
    try:
        (tmp / "package.json").write_text(
            json.dumps({"name": "obix-rc-consumer", "version": "0.0.0", "private": True, "type": "module"}, indent=2),
            encoding="utf-8")
        tarballs = [manifest["packages"][n]["path"] for n in manifest["publish_order"]]
        for t in tarballs:
            if not Path(t).is_file():
                receipt.step("consumer-install", "failed", reason=f"missing tarball {t}")
                return False
        inst = npm.run(["install", "--no-audit", "--no-fund", "--install-strategy=hoisted", *tarballs],
                       cwd=tmp, timeout=900)
        if not inst.ok:
            receipt.step("consumer-install", "failed", detail=rl.redact((inst.stderr or "")[-800:]))
            return False
        receipt.step("consumer-install", "ok", packages=len(tarballs))
        obix_js = tmp / "node_modules" / "@obinexusltd" / "obix" / "dist" / "bin" / "obix.js"
        if not obix_js.is_file():
            receipt.step("consumer-doctor", "failed", reason="installed umbrella has no dist/bin/obix.js")
            return False
        ok = True
        # node + (if present) deno + bun each run the installed entrypoint and
        # must report their OWN runtime identity from inside the process
        runners = [("node", npm.node, [])]
        for key, envvar in (("deno", "OBIX_DENO"), ("bun", "OBIX_BUN")):
            exe = os.environ.get(envvar) or shutil.which(key) or rl._runtime_guess(key)
            if exe and Path(exe).exists():
                runners.append((key, exe, ["run", "-A"] if key == "deno" else []))
        for key, exe, pre in runners:
            r = rl.run([exe, *pre, str(obix_js), "doctor", "--json"], cwd=tmp, timeout=180)
            try:
                doc = json.loads(r.stdout)
            except Exception:
                doc = None
            good = bool(doc and doc.get("schema") == "obix-core-diagnostics/doctor@1"
                        and doc.get("runtime") == key and isinstance(doc.get("ok"), bool)
                        and r.returncode in (0, 1))
            receipt.step(f"consumer-doctor-{key}", "ok" if good else "failed",
                         runtime_reported=(doc or {}).get("runtime"), exit=r.returncode)
            ok = ok and good
        # required-native failure path
        rn = rl.run([npm.node, str(obix_js), "doctor", "--json", "--require", "native"], cwd=tmp, timeout=120)
        receipt.step("consumer-require-native", "ok" if rn.returncode == 1 else "failed", exit=rn.returncode)
        ok = ok and rn.returncode == 1
        return ok
    finally:
        if not args.keep_temp:
            shutil.rmtree(tmp, ignore_errors=True)


# ═══════════════════════════════════════════════════════════════════════════
# execute + resume
# ═══════════════════════════════════════════════════════════════════════════
def cmd_execute(args: argparse.Namespace) -> int:
    manifest = rl.read_json(args.manifest)
    if manifest.get("schema") != rl.RELEASE_MANIFEST_SCHEMA:
        raise rl.ReleaseError(f"{args.manifest}: not a {rl.RELEASE_MANIFEST_SCHEMA} document.")
    if not args.execute:
        raise rl.ReleaseError("execute requires --execute (nothing is published without it).")
    if not manifest.get("verified"):
        raise rl.ReleaseError(
            "manifest.verified is not true -- run `publish.py verify` and get every "
            "line to PASS (including green required CI for the exact source SHA). "
            "Publication is not permitted on a dry run or local checks alone."
        )
    ci = manifest.get("ci") or {}
    if not ci.get("verified"):
        raise rl.ReleaseError("manifest.ci.verified is not true -- refusing to publish without CI evidence.")

    mono = find_monorepo(args.monorepo)
    npm = rl.resolve_npm(manifest.get("node") or args.node)

    receipt_path = Path(args.receipt or (Path(args.manifest).parent / "publish-receipt.json"))
    rl.assert_output_location(receipt_path, [mono.root])
    if args.resume and receipt_path.is_file():
        receipt = rl.Receipt.load(receipt_path)
        rl.oprint(f"resuming from {receipt_path} ({len(receipt.data['steps'])} prior steps)")
    else:
        receipt = rl.Receipt(receipt_path, kind="publish-execute",
                             extra={"manifest": str(Path(args.manifest).resolve()),
                                    "tag": manifest["tag"], "registry": manifest.get("registry")})

    done = {s["name"].split("publish-", 1)[-1] for s in receipt.data["steps"]
            if s["name"].startswith("publish-") and s["status"] in ("ok", "already-published")}

    tag = manifest["tag"]
    if tag == "latest":
        raise rl.ReleaseError("refusing to publish to dist-tag 'latest'. Use 'next' (or another prerelease tag).")

    whoami = npm.run(["whoami"], cwd=".", timeout=30)
    rl.oprint(f"npm user: {whoami.stdout.strip() or '(unknown -- publish will fail if unauthenticated)'}")

    with rl.InterruptGuard(receipt):
        for name in manifest["publish_order"]:
            if name in done:
                rl.oprint(f"  skip {name} (already recorded)")
                continue
            info = manifest["packages"][name]
            res = _publish_one(npm, name, info, tag, manifest.get("registry"), args)
            receipt.step(f"publish-{name}", res["status"], **{k: v for k, v in res.items() if k != "status"})
            if res["status"] in ("failed", "conflict"):
                receipt.finish("partial")
                raise rl.ReleaseError(
                    f"stopped at {name}: {res.get('detail', res['status'])}. "
                    f"Fix, then `publish.py execute --manifest {args.manifest} --execute --resume`."
                )
            time.sleep(args.settle_ms / 1000.0)

    receipt.finish("ok")
    rl.oprint("\n=== published ===")
    for s in receipt.data["steps"]:
        if s["name"].startswith("publish-"):
            rl.oprint(f"  {s['status']:18} {s['name'][8:]}")
    if not args.skip_final_consumer:
        _final_registry_consumer(npm, manifest, receipt)
    return 0


def _publish_one(npm: rl.Npm, name: str, info: dict[str, Any], tag: str,
                 registry: str | None, args: argparse.Namespace) -> dict[str, Any]:
    tgz = Path(info["path"])
    version = info["version"]
    if not tgz.is_file():
        return {"status": "failed", "detail": f"tarball not found: {tgz}"}
    # re-hash right before upload
    if rl.sri_sha512_of_file(tgz) != info["sha512"]:
        return {"status": "failed", "detail": "tarball hash changed since prepare/verify"}
    # inside-tarball name/version sanity
    ins = _peek_tarball_pkg(tgz)
    if not ins or ins.get("name") != name or ins.get("version") != version:
        return {"status": "failed", "detail": f"tarball identity mismatch: {ins}"}

    # already published?
    remote = rl.npm_view(npm, f"{name}")
    if remote["status"] == "ok" and version in remote["versions"]:
        integ = rl.npm_pack_integrity(npm, f"{name}@{version}")
        if integ and integ.get("integrity") and integ["integrity"] == info["sha512"]:
            return {"status": "already-published", "version": version, "detail": "identical artifact on registry"}
        return {"status": "conflict", "version": version,
                "detail": f"{name}@{version} exists on the registry with DIFFERENT content "
                          f"(registry integrity {integ.get('integrity') if integ else '?'} != "
                          f"{info['sha512']}). Not overwriting; choose a new RC number."}

    argv = ["publish", str(tgz), "--access", "public", "--tag", tag]
    if registry:
        argv += ["--registry", registry]
    if args.otp:
        argv += ["--otp", args.otp]
    if args.provenance:
        argv += ["--provenance"]

    last_err = ""
    for attempt in range(1, args.retries + 2):
        p = npm.run(argv, cwd=str(tgz.parent), timeout=args.publish_timeout)
        if p.ok:
            return {"status": "ok", "version": version, "tarball": tgz.name,
                    "sha512": info["sha512"], "attempt": attempt}
        err = rl.redact((p.stderr or p.stdout))
        last_err = err[-600:]
        if "EPUBLISHCONFLICT" in err or "cannot publish over" in err or "You cannot publish over" in err:
            # became published concurrently -- re-check integrity
            integ = rl.npm_pack_integrity(npm, f"{name}@{version}")
            if integ and integ.get("integrity") == info["sha512"]:
                return {"status": "already-published", "version": version,
                        "detail": "published concurrently with identical content"}
            return {"status": "conflict", "version": version, "detail": "EPUBLISHCONFLICT with different content"}
        if p.timed_out or "ETIMEDOUT" in err or "ECONNRESET" in err or "503" in err or "429" in err:
            # uncertain: check registry state before retrying
            time.sleep(min(30, 2 ** attempt))
            chk = rl.npm_view(npm, name)
            if chk["status"] == "ok" and version in chk["versions"]:
                integ = rl.npm_pack_integrity(npm, f"{name}@{version}")
                if integ and integ.get("integrity") == info["sha512"]:
                    return {"status": "already-published", "version": version,
                            "detail": "appeared after a timed-out attempt; content matches"}
            continue
        break  # non-retryable
    return {"status": "failed", "version": version, "detail": last_err}


def _final_registry_consumer(npm: rl.Npm, manifest: dict[str, Any], receipt: rl.Receipt) -> None:
    tmp = Path(rl._tempfile_dir("obix-final-"))
    try:
        (tmp / "package.json").write_text(
            json.dumps({"name": "obix-rc-final", "version": "0.0.0", "private": True, "type": "module"}, indent=2),
            encoding="utf-8")
        specs = [f"{n}@{manifest['proposed_versions'][n]}" for n in manifest["publish_order"]]
        inst = npm.run(["install", "--no-audit", "--no-fund", *specs], cwd=tmp, timeout=600)
        if not inst.ok:
            receipt.step("final-consumer-install", "failed", detail=rl.redact((inst.stderr or "")[-500:]))
            return
        obix_js = tmp / "node_modules" / "@obinexusltd" / "obix" / "dist" / "bin" / "obix.js"
        r = rl.run([npm.node, str(obix_js), "doctor", "--json"], cwd=tmp, timeout=120)
        try:
            doc = json.loads(r.stdout)
        except Exception:
            doc = None
        rn = rl.run([npm.node, str(obix_js), "doctor", "--json", "--require", "native"], cwd=tmp, timeout=120)
        receipt.step("final-consumer", "ok" if (doc and r.returncode in (0, 1) and rn.returncode == 1) else "failed",
                     resolved_versions={n: manifest["proposed_versions"][n] for n in manifest["publish_order"]},
                     doctor_ok=(doc or {}).get("ok"), require_native_exit=rn.returncode)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)


def _peek_tarball_pkg(tgz: Path) -> dict[str, Any] | None:
    import tarfile
    try:
        with tarfile.open(tgz, "r:gz") as tf:
            for ti in tf.getmembers():
                if ti.name.endswith("package.json") and ti.name.count("/") == 1:
                    f = tf.extractfile(ti)
                    return json.loads(f.read().decode("utf-8")) if f else None
    except (tarfile.TarError, OSError, json.JSONDecodeError):
        return None
    return None


# ═══════════════════════════════════════════════════════════════════════════
# args
# ═══════════════════════════════════════════════════════════════════════════
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog=TOOL, description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--monorepo", metavar="PATH", help="monorepo git root (default: cwd)")
    p.add_argument("--node", metavar="PATH", help="node executable (npm is invoked as `<node> npm-cli.js ...`)")
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("plan", help="inspect registry + manifests, propose RC versions")
    sp.add_argument("--out", default="release-plan.json")
    sp.add_argument("--tag", default=DEFAULT_TAG, help="dist-tag (default: %(default)s; never 'latest')")
    sp.add_argument("--core-version", help=f"core RC version (default: {DEFAULT_CORE_RC})")
    sp.add_argument("--umbrella-version", help=f"umbrella RC version (default: {DEFAULT_UMBRELLA_RC})")
    sp.add_argument("--rc", type=int, help="RC number; sets both to X.Y.Z-rc.<N> (deliberate, never auto)")
    sp.set_defaults(func=cmd_plan)

    pr = sub.add_parser("prepare", help="rewrite versions in a work copy, build, pack the eleven, write the manifest")
    pr.add_argument("--plan", required=True)
    pr.add_argument("--out", default="release-manifest.json")
    pr.add_argument("--work", metavar="DIR", help="work dir (default: a fresh temp dir)")
    pr.add_argument("--registry", help="target registry URL (default: npm's configured registry)")
    pr.add_argument("--no-build", action="store_true", help="skip the pre-pack build (use current dist/)")
    pr.add_argument("--allow-collision", action="store_true", help="prepare tarballs even though the plan records a version collision")
    pr.add_argument("--commit-versions", action="store_true",
                    help="also commit the RC version bump onto the review branch in BOTH repos")
    pr.add_argument("--review-branch", default="release/core-compat-rc1")
    pr.add_argument("--commit-receipt", metavar="FILE", help="commit.py receipt (source of the two SHAs)")
    pr.add_argument("--monorepo-sha", help="override the recorded monorepo source SHA")
    pr.add_argument("--umbrella-sha", help="override the recorded umbrella source SHA")
    pr.set_defaults(func=cmd_prepare)

    ve = sub.add_parser("verify", help="require green CI for the exact SHA pair, re-pack + install-test")
    ve.add_argument("--manifest", required=True)
    ve.add_argument("--gh-repo", metavar="OWNER/REPO", help="override the monorepo slug for gh Actions queries")
    ve.add_argument("--no-clean-checkout", action="store_true", help="skip the clone+gates re-run")
    ve.add_argument("--clone-no-local", action="store_true", help="use `git clone --no-local` (slower, more isolated)")
    ve.add_argument("--keep-temp", action="store_true")
    ve.add_argument("--receipt", metavar="FILE")
    ve.set_defaults(func=cmd_verify)

    ex = sub.add_parser("execute", help="publish the verified tarballs (deps first, umbrella last)")
    ex.add_argument("--manifest", required=True)
    ex.add_argument("--execute", action="store_true", help="actually run `npm publish` (required)")
    ex.add_argument("--resume", action="store_true", help="continue from an existing publish receipt")
    ex.add_argument("--retries", type=int, default=2, help="bounded retries for transient/propagation failures")
    ex.add_argument("--settle-ms", type=int, default=1500, help="pause between packages")
    ex.add_argument("--publish-timeout", type=int, default=300)
    ex.add_argument("--otp", help="npm one-time password (not logged)")
    ex.add_argument("--provenance", action="store_true", help="pass --provenance to npm publish")
    ex.add_argument("--skip-final-consumer", action="store_true")
    ex.add_argument("--receipt", metavar="FILE")
    ex.set_defaults(func=cmd_execute)

    rs = sub.add_parser("resume", help="alias for `execute --resume`")
    rs.add_argument("--manifest", required=True)
    rs.add_argument("--execute", action="store_true")
    rs.add_argument("--retries", type=int, default=2)
    rs.add_argument("--settle-ms", type=int, default=1500)
    rs.add_argument("--publish-timeout", type=int, default=300)
    rs.add_argument("--otp")
    rs.add_argument("--provenance", action="store_true")
    rs.add_argument("--skip-final-consumer", action="store_true")
    rs.add_argument("--receipt", metavar="FILE")
    rs.set_defaults(func=lambda a: cmd_execute(argparse.Namespace(**{**vars(a), "resume": True})))
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except rl.StalePlanError as e:
        rl.eprint("STALE: " + str(e))
        return 3
    except rl.Interrupted as e:
        rl.eprint(str(e))
        return 130
    except rl.ReleaseError as e:
        rl.eprint("ERROR: " + str(e))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
