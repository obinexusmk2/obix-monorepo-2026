#!/usr/bin/env python3
"""
commit.py -- stage the OBIX core-compatibility release across BOTH git repositories.

There are two repositories:
  1. the monorepo  (the ten core/obix-core-* packages, gates, docs, workflow)
  2. runtime/obix  (a NESTED repo, ignored by the monorepo's `/runtime/` rule,
                    holding the amended @obinexusltd/obix umbrella)

`plan`  inspects both repos and writes an explicit, allowlisted commit plan.
        It never stages, commits, pushes or opens a PR.
`apply` re-verifies the plan against the live trees and, ONLY with --execute,
        commits the nested umbrella first, records its SHA in a monorepo
        release-source manifest, commits the monorepo second, and (opt-in)
        pushes the review branches and opens draft PRs.

Safe by default: a bare `apply` previews the exact actions and writes a receipt;
nothing is mutated until --execute. Push and PR are additionally gated by
--push / --pr. Plain `--force` is never used.

    python scripts/commit.py plan  --out commit-plan.json
    python scripts/commit.py apply --plan commit-plan.json                 # preview
    python scripts/commit.py apply --plan commit-plan.json --execute       # local commits
    python scripts/commit.py apply --plan commit-plan.json --execute --push --pr
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path
from typing import Any

_HERE = Path(__file__).resolve().parent
if str(_HERE) not in sys.path:
    sys.path.insert(0, str(_HERE))

import _release_lib as rl  # noqa: E402

TOOL = "commit.py"
DEFAULT_REVIEW_BRANCH = "release/core-compat-rc1"
RELEASE_SOURCE_REL = "docs/core-compatibility/release-source.json"

# ── the release allowlist (globs, resolved to concrete paths at plan time) ──
MONOREPO_ALLOW = [
    "core/**",
    "docs/core-compatibility/**",
    ".github/workflows/core-compatibility.yml",
    "scripts/check-core-graph.mjs",
    "scripts/ci.mjs",
    "scripts/_release_lib.py",
    "scripts/commit.py",
    "scripts/publish.py",
    "scripts/RELEASE-TOOLS.md",
    "scripts/tests/**",
    "package.json",          # mixed -- a narrow patch is emitted by `plan`
]
# runtime/obix's HEAD is far behind its worktree (a pre-existing DOP-rewrite
# divergence). The release baseline is "the umbrella source as it stands now",
# so the allowlist is broad here and mixed files are handled with
# --include-divergence (recorded in the receipt).
UMBRELLA_ALLOW = [
    "package.json",
    "tsconfig.json",
    "src/**",
    "test/**",
    "examples/**",
    "dist/**",
    "README.md",
    "LICENSE",
]
UMBRELLA_ALLOW_IGNORED: list[str] = []  # nothing force-added

MIXED_NOTE_DEFAULT = (
    "The nested runtime/obix repository carries a pre-existing divergence from its "
    "HEAD (an earlier DOP-rewrite of the umbrella). This RC review branch commits "
    "the current umbrella source as the release baseline; files that also carry "
    "pre-existing hunks are listed under `mixed_files` in this receipt."
)


# ===========================================================================
# discovery
# ===========================================================================
def discover_repos(args: argparse.Namespace) -> dict[str, rl.Repo]:
    mono_root = Path(args.monorepo).resolve() if args.monorepo else Path.cwd()
    mono = rl.Repo(mono_root)
    umb_root = Path(args.umbrella).resolve() if args.umbrella else (mono.root / "runtime" / "obix")
    if not (umb_root / ".git").exists():
        raise rl.ReleaseError(
            f"nested umbrella repo not found at {umb_root} "
            f"(pass --umbrella <path> if it lives elsewhere)."
        )
    umb = rl.Repo(umb_root)
    if umb.root == mono.root:
        raise rl.ReleaseError("monorepo and umbrella resolved to the same git root.")
    return {"monorepo": mono, "umbrella": umb}


def repo_facts(repo: rl.Repo) -> dict[str, Any]:
    remotes = repo.remotes()
    gh = {name: rl.parse_github_remote(u.get("push") or u.get("fetch") or "")
          for name, u in remotes.items()}
    up = repo.upstream()
    ab = repo.ahead_behind(up)
    return {
        "root": str(repo.root),
        "head": repo.head(),
        "head_short": repo.head_short(),
        "branch": repo.branch(),
        "detached": repo.is_detached(),
        "remotes": remotes,
        "github": {k: (f"{v[0]}/{v[1]}" if v else None) for k, v in gh.items()},
        "upstream": up,
        "ahead": ab[0] if ab else None,
        "behind": ab[1] if ab else None,
    }


def _glob_match(rel: str, globs: list[str]) -> bool:
    for g in globs:
        if g.endswith("/**"):
            if rel.startswith(g[:-3].rstrip("/") + "/"):
                return True
        elif rel == g:
            return True
    return False


def _expand_globs(repo: rl.Repo, globs: list[str]) -> list[str]:
    """Resolve allowlist globs to concrete repo-relative paths that (a) match a
    glob and (b) actually differ from HEAD (tracked-modified, staged, untracked
    or deleted). Uses git plumbing so a brand-new directory is fully expanded."""
    root = repo.root
    candidates: set[str] = set()

    # tracked files that differ from HEAD (modified or deleted, staged or not)
    p = repo.g(["diff", "--name-only", "-z", "HEAD"])
    if p.ok:
        candidates.update(x for x in p.stdout.split("\x00") if x)
    p = repo.g(["diff", "--name-only", "-z", "--cached", "HEAD"])
    if p.ok:
        candidates.update(x for x in p.stdout.split("\x00") if x)

    # untracked, not-ignored files (fully expanded, one path per file)
    p = repo.g(["ls-files", "-z", "--others", "--exclude-standard"])
    if p.ok:
        candidates.update(x for x in p.stdout.split("\x00") if x)

    return sorted(
        rel for rel in candidates
        if _glob_match(rel, globs) and not rl.is_noise_path(rel)
    )


def _diff_digest(repo: rl.Repo, rel: str) -> str:
    p = repo.g(["diff", "HEAD", "--", rel])
    return "sha256:" + rl.sha256_bytes((p.stdout or "").encode("utf-8"))


def classify(repo: rl.Repo, paths: list[str]) -> dict[str, Any]:
    status = {e.path: e for e in repo.status_entries()}
    files: list[dict[str, Any]] = []
    deletions: list[str] = []
    review: list[str] = []
    for rel in paths:
        e = status.get(rel)
        in_head = repo.path_exists_in_head(rel)
        on_disk = (repo.root / rel).is_file()
        if not on_disk and in_head:
            kind = "deleted"
            deletions.append(rel)
        elif not in_head:
            kind = "new"
        else:
            kind = "modified"
        row: dict[str, Any] = {
            "path": rel,
            "kind": kind,
            "staged_before": bool(e and e.is_staged),
            "blob_head": repo.blob_hash_head(rel) if in_head else None,
            "blob_worktree": repo.blob_hash_worktree(rel),
        }
        if kind == "modified":
            # a tracked file that already differs from HEAD: it must not be
            # committed whole without the operator either isolating its release
            # hunks (--patch) or explicitly acknowledging (--ack). We show a
            # diffstat + a stable digest so review is possible from the plan.
            row["review_required"] = True
            stat = repo.g(["diff", "--stat", "HEAD", "--", rel])
            row["diffstat"] = (stat.stdout or "").strip().splitlines()[0] if stat.ok and stat.stdout.strip() else ""
            row["diff_digest"] = _diff_digest(repo, rel)
            review.append(rel)
        elif kind == "deleted":
            row["review_required"] = True
            review.append(rel)
        else:
            row["review_required"] = False
        files.append(row)
    return {"files": files, "deletions": deletions, "review_required": review}


def unrelated_report(repo: rl.Repo, selected: set[str]) -> dict[str, Any]:
    staged, worktree, untracked = [], [], []
    for e in repo.status_entries():
        if e.path in selected or rl.is_noise_path(e.path):
            continue
        if e.is_staged:
            staged.append(e.path)
        if e.is_untracked:
            untracked.append(e.path)
        elif e.is_worktree_dirty:
            worktree.append(e.path)
    return {
        "pre_staged": sorted(staged),
        "worktree_modified": sorted(worktree),
        "untracked": sorted(untracked),
        "note": "node_modules/, *.tsbuildinfo and __pycache__/ are omitted as noise.",
    }


# ===========================================================================
# narrow-patch emission -- isolate a known, small release hunk
# ===========================================================================
def emit_monorepo_pkgjson_patch(repo: rl.Repo, out_dir: Path) -> str | None:
    """The only release change the monorepo package.json NEEDS is adding "core/*"
    to `workspaces` (so a clean runner links the ten core packages). Emit a
    `git apply`-able patch, from HEAD:package.json, carrying ONLY that line."""
    head = repo.g(["show", "HEAD:package.json"])
    if not head.ok:
        return None
    old_text = head.stdout
    try:
        base = __import__("json").loads(old_text)
    except Exception:
        return None
    ws = list(base.get("workspaces") or [])
    if "core/*" in ws:
        return None
    new_obj = dict(base)
    new_obj["workspaces"] = ws + ["core/*"]
    new_text = __import__("json").dumps(new_obj, indent=2) + "\n"

    import difflib
    diff = difflib.unified_diff(
        old_text.splitlines(keepends=True), new_text.splitlines(keepends=True),
        fromfile="a/package.json", tofile="b/package.json", n=3,
    )
    body = "diff --git a/package.json b/package.json\n" + "".join(diff)
    patch_path = out_dir / "monorepo.package.json.release.patch"
    patch_path.write_text(body, encoding="utf-8", newline="")
    return str(patch_path)


# ===========================================================================
# plan
# ===========================================================================
def cmd_plan(args: argparse.Namespace) -> int:
    repos = discover_repos(args)
    out_path = Path(args.out).resolve()
    out_dir = out_path.parent
    out_dir.mkdir(parents=True, exist_ok=True)
    rl.assert_output_location(out_path, [r.root for r in repos.values()])

    plan: dict[str, Any] = {
        "schema": rl.COMMIT_PLAN_SCHEMA,
        "tool_version": rl.TOOL_VERSION,
        "generated_at": rl.now_iso(),
        "review_branch": args.branch,
        "coauthor": not args.no_coauthor,
        "repos": {},
        "notes": [],
        "how_to_resolve": {
            "modified_file": "isolate its release hunks with --patch <repo>:<path>=<file>, "
                             "OR acknowledge committing it whole with --ack <repo>:<path>",
            "umbrella_divergence": "the umbrella HEAD is far behind its worktree; pass "
                                   "--include-divergence to commit the current umbrella "
                                   "source as the release baseline (every such file is "
                                   "recorded in the receipt).",
        },
    }

    keep_patches: dict[str, dict[str, str]] = {"monorepo": {}, "umbrella": {}}
    mono = repos["monorepo"]
    pkg_patch = emit_monorepo_pkgjson_patch(mono, out_dir)
    if pkg_patch:
        keep_patches["monorepo"]["package.json"] = pkg_patch
        plan["notes"].append(
            f"monorepo package.json also carries unrelated hunks; a narrow release "
            f"patch (adds only 'core/*' to workspaces) was written to {Path(pkg_patch).name} "
            f"and is pre-wired as a --patch for apply."
        )

    for name, repo in repos.items():
        facts = repo_facts(repo)
        allow = MONOREPO_ALLOW if name == "monorepo" else UMBRELLA_ALLOW
        paths = _expand_globs(repo, allow)
        if name == "monorepo":
            paths = sorted(set(paths) | {RELEASE_SOURCE_REL})
        real_paths = [p for p in paths if p != RELEASE_SOURCE_REL]
        cls = classify(repo, real_paths)
        digest = rl.selection_digest(repo, real_paths)
        target_remote, target_slug = _pick_remote(facts)
        # umbrella divergence: node_modules tracked at HEAD?
        warnings: list[str] = []
        if name == "umbrella":
            nm = repo.g(["ls-tree", "-r", "--name-only", "HEAD", "node_modules"])
            if nm.ok and nm.stdout.strip():
                warnings.append(
                    "the umbrella base commit TRACKS node_modules/ -- the review branch "
                    "inherits it unchanged. Pass --prune-umbrella-node-modules to drop it "
                    "from the release commit's tree (worktree untouched)."
                )
        plan["repos"][name] = {
            "role": name,
            "facts": facts,
            "base_sha": facts["head"],
            "base_ref": args.base or facts["head"],
            "target_remote": target_remote,
            "target_github_slug": target_slug,
            "allowlist_globs": allow,
            "selected_files": cls["files"],
            "deletions": cls["deletions"],
            "review_required": cls["review_required"],
            "keep_patches": keep_patches[name],
            "selection_digest": digest,
            "unrelated": unrelated_report(repo, set(real_paths)),
            "warnings": warnings,
        }

    _print_plan_summary(plan)
    rl.write_json_atomic(out_path, plan)
    rl.oprint(f"\nwrote {out_path}")
    _print_resolution_hint(plan)
    return 0


def _print_resolution_hint(plan: dict[str, Any]) -> None:
    need: list[str] = []
    for name, r in plan["repos"].items():
        for f in r["selected_files"]:
            if not f.get("review_required"):
                continue
            covered = f["path"] in (r.get("keep_patches") or {})
            if not covered:
                need.append(f"{name}:{f['path']}  ({f['kind']}{', ' + f.get('diffstat','') if f.get('diffstat') else ''})")
    if need:
        rl.oprint("\napply --execute will REQUIRE a decision on each of these "
                  "(unless already pre-wired):")
        for n in need:
            rl.oprint("  - " + n)
        rl.oprint("  resolve with: --patch <repo>:<path>=<file>   or   --ack <repo>:<path>")
        rl.oprint("  umbrella pre-existing divergence: --include-divergence")


def _pick_remote(facts: dict[str, Any]) -> tuple[str | None, str | None]:
    for pref in ("origin",):
        if pref in facts["remotes"]:
            return pref, facts["github"].get(pref)
    if facts["remotes"]:
        name = sorted(facts["remotes"])[0]
        return name, facts["github"].get(name)
    return None, None


def _print_plan_summary(plan: dict[str, Any]) -> None:
    rl.oprint("=== commit plan ===")
    for name, r in plan["repos"].items():
        f = r["facts"]
        rl.oprint(f"\n[{name}] {f['root']}")
        rl.oprint(f"  HEAD      {f['head_short']} on {f['branch'] or '(detached)'}"
                  + (f"  (ahead {f['ahead']}, behind {f['behind']})" if f['ahead'] is not None else ""))
        rl.oprint(f"  remote    {r['target_remote']} -> {r['target_github_slug'] or '(not github)'}")
        rl.oprint(f"  branch    {plan['review_branch']}  (from base {r['base_sha'][:12]})")
        n_new = sum(1 for x in r["selected_files"] if x["kind"] == "new")
        n_mod = sum(1 for x in r["selected_files"] if x["kind"] == "modified")
        n_del = len(r["deletions"])
        n_rev = len(r["review_required"])
        rl.oprint(f"  selected  {len(r['selected_files'])} files "
                  f"({n_new} new, {n_mod} modified, {n_del} deleted; {n_rev} need review)")
        for x in r["selected_files"]:
            if x.get("review_required"):
                covered = x["path"] in (r.get("keep_patches") or {})
                mark = "patch" if covered else "NEEDS DECISION"
                ds = ("  " + x["diffstat"]) if x.get("diffstat") else ""
                rl.oprint(f"    [{mark}] {x['kind']:8} {x['path']}{ds}")
        u = r["unrelated"]
        if u["pre_staged"] or u["worktree_modified"] or u["untracked"]:
            rl.oprint(f"  unrelated (left untouched): "
                      f"{len(u['pre_staged'])} pre-staged, "
                      f"{len(u['worktree_modified'])} modified, "
                      f"{len(u['untracked'])} untracked  (node_modules/ etc. omitted)")
        for w in r.get("warnings", []):
            rl.oprint(f"  ! {w}")


# ===========================================================================
# apply
# ===========================================================================
def _parse_kv_list(items: list[str], *, flag: str) -> dict[str, dict[str, str]]:
    """--patch monorepo:package.json=path  ->  {'monorepo': {'package.json': 'path'}}"""
    out: dict[str, dict[str, str]] = {"monorepo": {}, "umbrella": {}}
    for it in items or []:
        if ":" not in it or "=" not in it:
            raise rl.ReleaseError(f"{flag} expects <repo>:<path>=<file>, got {it!r}")
        repo_part, rest = it.split(":", 1)
        path_part, file_part = rest.split("=", 1)
        if repo_part not in out:
            raise rl.ReleaseError(f"{flag}: unknown repo {repo_part!r} (use 'monorepo' or 'umbrella')")
        if not Path(file_part).is_file():
            raise rl.ReleaseError(f"{flag}: patch file not found: {file_part}")
        out[repo_part][path_part] = file_part
    return out


def _parse_ack_list(items: list[str]) -> dict[str, set[str]]:
    """--ack monorepo:scripts/ci.mjs  ->  {'monorepo': {'scripts/ci.mjs'}}"""
    out: dict[str, set[str]] = {"monorepo": set(), "umbrella": set()}
    for it in items or []:
        if ":" not in it:
            raise rl.ReleaseError(f"--ack expects <repo>:<path>, got {it!r}")
        repo_part, path_part = it.split(":", 1)
        if repo_part not in out:
            raise rl.ReleaseError(f"--ack: unknown repo {repo_part!r} (use 'monorepo' or 'umbrella')")
        out[repo_part].add(path_part)
    return out


def _stale_check(repos: dict[str, rl.Repo], plan: dict[str, Any]) -> None:
    problems = []
    for name, repo in repos.items():
        pr = plan["repos"][name]
        cur_head = repo.head()
        if cur_head != pr["base_sha"]:
            problems.append(f"[{name}] HEAD moved {pr['base_sha'][:12]} -> {cur_head[:12]}")
        sel = [f["path"] for f in pr["selected_files"]]
        cur_digest = rl.selection_digest(repo, sel)
        if cur_digest != pr["selection_digest"]:
            problems.append(f"[{name}] selected content changed since the plan was written "
                            f"(re-run `plan`)")
    if problems:
        raise rl.StalePlanError(
            "the plan is stale:\n  " + "\n  ".join(problems)
            + "\n\nRe-run `python scripts/commit.py plan` and review the new plan."
        )


def _render_umbrella_message(plan: dict[str, Any], reviewed: dict[str, str]) -> str:
    lines = [
        "release(core-compat): amend @obinexusltd/obix umbrella with the `obix` CLI",
        "",
        "Adds `bin: obix` -> dist/bin/obix.js, an `./cli` subpath export, the ten",
        "@obinexusltd/obix-core-* dependencies at exact 0.1.0, and a lazy provider",
        "registry behind `runCli(argv, io?)` with `obix doctor` / `obix doctor --json`.",
        "The `.` library export is unchanged; the frozen `obixc` binary is untouched.",
        "",
        MIXED_NOTE_DEFAULT,
    ]
    if reviewed:
        lines += ["", "Modified files committed by operator decision:"]
        lines += [f"  - {p} ({how})" for p, how in sorted(reviewed.items())]
    lines += [""]
    if plan.get("coauthor"):
        lines += [rl.COAUTHOR_TRAILER, ""]
    return "\n".join(lines)


def _render_monorepo_message(plan: dict[str, Any], umbrella_sha: str, umbrella_slug: str | None) -> str:
    slug = umbrella_slug or "obinexusmk2/obix"
    return (
        "release(core-compat): ten @obinexusltd/obix-core-* packages + graph gate\n"
        "\n"
        "Implements the ten host-compatibility packages under core/, the\n"
        "scripts/check-core-graph.mjs gate (wired into scripts/ci.mjs), the packed\n"
        "consumer fixture, the benchmark harness, the core-compatibility workflow\n"
        "and the docs/core-compatibility/* record.\n"
        "\n"
        f"Release-source manifest ({RELEASE_SOURCE_REL}) pins the amended umbrella\n"
        f"to {slug}@{umbrella_sha} so a clean CI runner builds the same source pair.\n"
        "\n"
        + (rl.COAUTHOR_TRAILER + "\n" if plan.get("coauthor") else "")
    )


def _render_pr_body(role: str, plan: dict[str, Any], umbrella_sha: str, monorepo_sha: str | None,
                    slugs: dict[str, str | None]) -> str:
    other = "umbrella (runtime/obix)" if role == "monorepo" else "monorepo"
    lines = [
        f"# OBIX core-compatibility release candidate -- {role}",
        "",
        "This PR is one half of a **two-repository** release.",
        "",
        "| repo | github | commit |",
        "| --- | --- | --- |",
        f"| monorepo | {slugs.get('monorepo') or '?'} | `{monorepo_sha or '(pending)'}` |",
        f"| umbrella (runtime/obix) | {slugs.get('umbrella') or '?'} | `{umbrella_sha}` |",
        "",
        f"The monorepo commit carries `{RELEASE_SOURCE_REL}` pinning the umbrella "
        f"to the exact SHA above; the core-compatibility workflow checks that SHA "
        f"out into `runtime/obix` so clean runners build the same pair.",
        "",
        "## Test evidence (as reported by the implementing session -- verify in CI)",
        "- 10/10 core packages built; 117 core contract tests + 18 umbrella tests, "
        "identical on Node 26.7.0 / Deno 2.9.6 / Bun 1.4.2 (Windows x64).",
        "- 7/7 real-Chromium DOM lifecycle tests (Playwright 1.63).",
        "- `check-core-graph` gate PASSED; frozen `obixc` / `obix-timer` regressions green.",
        "- packed-consumer fixture PASSED (clean install outside the workspace, "
        "`obix doctor --json` -> `ok:true` on Node/Deno/Bun).",
        "",
        "## Not covered by this candidate",
        "- native provider **execution** (no toolchain/fixture) -- registry + selection only.",
        "- Firefox / WebKit, Linux / macOS, Node 22 / 24 LTS -- authored CI lanes, not yet run.",
        "",
        "Draft until the core-compatibility workflow is green for this exact SHA pair.",
    ]
    return "\n".join(lines) + "\n"


def _tree_of_ref(repo: rl.Repo, ref: str) -> str | None:
    p = repo.g(["rev-parse", f"{ref}^{{tree}}"])
    return p.stdout.strip() if p.ok else None


def cmd_apply(args: argparse.Namespace) -> int:
    plan = rl.read_json(args.plan)
    if plan.get("schema") != rl.COMMIT_PLAN_SCHEMA:
        raise rl.ReleaseError(f"{args.plan}: not a {rl.COMMIT_PLAN_SCHEMA} document.")
    repos = discover_repos(args)
    branch = args.branch or plan["review_branch"]
    execute = bool(args.execute)
    patches = _parse_kv_list(args.patch, flag="--patch")
    acks = _parse_ack_list(args.ack)
    include_div = bool(args.include_divergence)

    receipt_path = Path(args.receipt or (Path(args.plan).parent / "commit-receipt.json"))
    rl.assert_output_location(receipt_path, [r.root for r in repos.values()])
    receipt = rl.Receipt(receipt_path, kind="commit-apply", extra={
        "execute": execute, "push": bool(args.push), "pr": bool(args.pr),
        "plan": str(Path(args.plan).resolve()), "review_branch": branch,
    })

    rl.oprint(f"mode: {'EXECUTE' if execute else 'PREVIEW (no mutation)'}"
              + ("  +push" if args.push else "") + ("  +pr" if args.pr else ""))

    # merge plan-provided narrow patches with any --patch on the command line
    for name in ("monorepo", "umbrella"):
        for path, f in (plan["repos"][name].get("keep_patches") or {}).items():
            patches.setdefault(name, {}).setdefault(path, f)

    _stale_check(repos, plan)
    receipt.step("stale-check", "ok")

    # review gate: every modified/deleted selected file needs a --patch, a --ack,
    # or (umbrella only) --include-divergence.
    blocked: list[str] = []
    resolved: dict[str, dict[str, str]] = {"monorepo": {}, "umbrella": {}}
    for name in ("umbrella", "monorepo"):
        pr = plan["repos"][name]
        for f in pr["selected_files"]:
            if not f.get("review_required"):
                continue
            p = f["path"]
            if p in patches.get(name, {}):
                resolved[name][p] = "patch"
            elif p in acks.get(name, {}):
                resolved[name][p] = "ack"
            elif name == "umbrella" and include_div:
                resolved[name][p] = "include-divergence"
            else:
                blocked.append(f"{name}:{p}  ({f['kind']}{'  ' + f.get('diffstat','') if f.get('diffstat') else ''})")
    if blocked:
        receipt.step("review-gate", "failed", blocked=blocked)
        receipt.finish("failed")
        raise rl.ReleaseError(
            "these selected files already differ from HEAD and were not resolved:\n  "
            + "\n  ".join(blocked)
            + "\n\nFor each: pass --patch <repo>:<path>=<file> to isolate its release "
            "hunks, or --ack <repo>:<path> to commit it whole (recorded in the receipt). "
            "For the umbrella's pre-existing divergence, pass --include-divergence."
        )
    receipt.step("review-gate", "ok", resolved=resolved)

    slugs = {n: plan["repos"][n]["target_github_slug"] for n in repos}
    reviewed_files = {n: resolved[n] for n in repos}

    # ---- preview ---------------------------------------------------------
    if not execute:
        _preview(repos, plan, branch, patches, resolved, args)
        receipt.step("preview", "ok", note="no repository was mutated")
        receipt.finish("previewed")
        rl.oprint(f"\nreceipt: {receipt_path}")
        rl.oprint("\nnothing was staged, committed, pushed or opened. Re-run with --execute to apply.")
        return 0

    # ---- execute --------------------------------------------------------
    with rl.InterruptGuard(receipt):
        # 1) nested umbrella FIRST
        umb = repos["umbrella"]
        upr = plan["repos"]["umbrella"]
        add_paths = [f["path"] for f in upr["selected_files"] if f["kind"] != "deleted"]
        # a --patch'd path is applied via the patch, not `git add`
        umb_patch_paths = set(patches.get("umbrella", {}))
        add_paths = [p for p in add_paths if p not in umb_patch_paths]
        del_paths = list(upr["deletions"])
        if args.prune_umbrella_node_modules:
            del_paths.append("node_modules")
        msg_dir = Path(args.workdir).resolve() if args.workdir else receipt_path.parent / "_commit_msgs"
        umb_msg = rl.write_text_file(msg_dir, "umbrella-commit.txt",
                                     _render_umbrella_message(plan, reviewed_files["umbrella"]))
        umbrella_sha = _commit_idempotent(
            umb, base=upr["base_ref"], add_paths=add_paths, delete_paths=del_paths,
            patches=list(patches.get("umbrella", {}).values()),
            message_file=str(umb_msg), branch=branch,
        )
        receipt.data["umbrella_sha"] = umbrella_sha
        receipt.data["umbrella_slug"] = slugs["umbrella"]
        receipt.data["reviewed_files"] = reviewed_files
        receipt.step("commit-umbrella", "ok", sha=umbrella_sha, branch=branch,
                     files=len(add_paths), deletions=len(del_paths),
                     reviewed=reviewed_files["umbrella"])

        # 2) monorepo release-source manifest (pins the umbrella SHA) -- written to
        #    a SCRATCH file and injected into the commit tree, NOT the worktree.
        mono = repos["monorepo"]
        mpr = plan["repos"]["monorepo"]
        wf_rel = ".github/workflows/core-compatibility.yml"
        rel_src = {
            # deterministic: no timestamp, so a re-run with the same umbrella SHA
            # produces the identical tree (idempotent apply).
            "schema": rl.RELEASE_SOURCE_SCHEMA,
            "tool_version": rl.TOOL_VERSION,
            "umbrella": {
                "role": "runtime/obix (nested repo, ignored by the monorepo /runtime/ rule)",
                "github_slug": slugs["umbrella"],
                "remote_url": (umb.remotes().get(upr["target_remote"], {}) or {}).get("push"),
                "sha": umbrella_sha,
                "branch": branch,
                "tree": _tree_of_ref(umb, umbrella_sha),
            },
            "monorepo": {
                "github_slug": slugs["monorepo"],
                "note": "this manifest is committed BY the monorepo release commit; it "
                        "does not and cannot contain that commit's own SHA.",
            },
            "ci": {
                "workflow": wf_rel,
                "requirement": "check out `umbrella.sha` into runtime/obix before build.",
            },
        }
        scratch = msg_dir / "_overrides"
        scratch.mkdir(parents=True, exist_ok=True)
        rel_src_file = scratch / "release-source.json"
        rl.write_json_atomic(rel_src_file, rel_src)
        overrides: dict[str, str] = {RELEASE_SOURCE_REL: str(rel_src_file)}
        receipt.step("write-release-source", "ok", path=RELEASE_SOURCE_REL,
                     umbrella_sha=umbrella_sha, scratch=str(rel_src_file))

        # 3) patch the workflow (into a scratch copy) to pin the umbrella checkout
        wf_src = mono.root / wf_rel
        wf_scratch = scratch / "core-compatibility.yml"
        wf_scratch.write_text(wf_src.read_text(encoding="utf-8"), encoding="utf-8", newline="")
        wf_patched, wf_note = patch_workflow(wf_scratch, umbrella_sha, slugs["umbrella"])
        if wf_patched:
            overrides[wf_rel] = str(wf_scratch)
        receipt.step("patch-workflow", "ok" if wf_patched else "skipped", note=wf_note,
                     scratch=str(wf_scratch) if wf_patched else None)

        # 4) monorepo commit SECOND (manifest + patched workflow injected via overrides)
        mono_patch_paths = set(patches.get("monorepo", {}))
        m_add = sorted(set(
            f["path"] for f in mpr["selected_files"]
            if f["kind"] != "deleted" and f["path"] not in mono_patch_paths and f["path"] != wf_rel
        ))
        m_del = mpr["deletions"]
        mono_msg = rl.write_text_file(msg_dir, "monorepo-commit.txt",
                                      _render_monorepo_message(plan, umbrella_sha, slugs["umbrella"]))
        monorepo_sha = _commit_idempotent(
            mono, base=mpr["base_ref"], add_paths=m_add, delete_paths=m_del,
            patches=list(patches.get("monorepo", {}).values()),
            message_file=str(mono_msg), branch=branch, overrides=overrides,
        )
        receipt.data["monorepo_sha"] = monorepo_sha
        receipt.data["monorepo_slug"] = slugs["monorepo"]
        receipt.step("commit-monorepo", "ok", sha=monorepo_sha, branch=branch, files=len(m_add))

        # 5) push (opt-in)
        if args.push:
            for name, repo in (("umbrella", umb), ("monorepo", mono)):
                pr = plan["repos"][name]
                remote = pr["target_remote"]
                slug = slugs[name]
                if not slug:
                    receipt.step(f"push-{name}", "skipped",
                                 reason=f"remote {remote!r} is not a github.com URL; "
                                        f"pass --allow-remote-change to override")
                    continue
                res = repo.push(remote=remote, branch=branch, dry_run=False,
                                set_upstream=not repo.upstream())
                if res.ok:
                    receipt.step(f"push-{name}", "ok", remote=remote, branch=branch)
                else:
                    receipt.step(f"push-{name}", "failed", remote=remote,
                                 detail=rl.redact((res.stderr or res.stdout).strip()[:800]))
                    receipt.finish("partial")
                    raise rl.ReleaseError(
                        f"push of {name} to {remote} failed; the other repository may already "
                        f"be pushed. See {receipt_path}."
                    )

        # 6) PR (opt-in)
        if args.pr:
            gh = rl.resolve_gh()
            for name, repo in (("umbrella", umb), ("monorepo", mono)):
                slug = args.gh_repo if (args.gh_repo and name == "monorepo") else slugs[name]
                r = open_or_reuse_pr(gh, repo, slug, branch,
                                     _render_pr_body(name, plan, umbrella_sha,
                                                     receipt.data.get("monorepo_sha"), slugs),
                                     title=f"OBIX core-compat RC -- {name}",
                                     workdir=msg_dir, execute=True)
                receipt.step(f"pr-{name}", r["status"], **{k: v for k, v in r.items() if k != "status"})

    final = "ok"
    if args.push and any(s["name"].startswith("push-") and s["status"] != "ok" for s in receipt.data["steps"]):
        final = "partial"
    if args.pr and any(s["name"].startswith("pr-") and s["status"] not in ("ok", "reused") for s in receipt.data["steps"]):
        final = "partial"
    receipt.finish(final)

    rl.oprint("\n=== result ===")
    rl.oprint(f"  umbrella  {receipt.data.get('umbrella_sha','')[:12]}  ({slugs['umbrella']})  branch {branch}")
    rl.oprint(f"  monorepo  {receipt.data.get('monorepo_sha','')[:12]}  ({slugs['monorepo']})  branch {branch}")
    rl.oprint(f"  receipt   {receipt_path}")
    if not args.push:
        rl.oprint("\nlocal commits only -- nothing was pushed. Re-run with --push (and --pr) when ready.")
    return 0 if final == "ok" else 2


def _commit_idempotent(repo: rl.Repo, *, base: str, add_paths, delete_paths, patches,
                       message_file: str, branch: str, overrides: dict[str, str] | None = None) -> str:
    """Build the release commit on top of `base` and point refs/heads/<branch>
    at it. This function OWNS the branch -- do not create it beforehand.

      * branch missing                       -> create it at the new commit
      * branch sits exactly at `base`        -> fast-forward it to the new commit
      * branch's tree == the intended tree   -> reuse it (idempotent re-run)
      * anything else                        -> refuse (branch has other content)
    """
    tmp_ref = f"{branch}__obix_tmp"
    repo.g(["update-ref", "-d", f"refs/heads/{tmp_ref}"])  # clear any leftover
    intended = repo.commit_from_allowlist(
        base=base, add_paths=add_paths, delete_paths=delete_paths, patches=patches,
        message_file=message_file, branch=tmp_ref, overrides=overrides,
    )
    intended_tree = _tree_of_ref(repo, intended)
    try:
        if repo.branch_exists(branch):
            branch_sha = repo.g_out(["rev-parse", branch])
            base_sha = repo.g_out(["rev-parse", f"{base}^{{commit}}"])
            if _tree_of_ref(repo, branch) == intended_tree:
                return branch_sha  # already committed identically
            if branch_sha == base_sha:
                repo.g(["update-ref", f"refs/heads/{branch}", intended, base_sha], check=True)
                return intended
            raise rl.ReleaseError(
                f"branch {branch} already exists in {repo.root} at {branch_sha[:12]} "
                f"with content that is neither the release commit nor the base. "
                f"Delete/rename it or pass --branch <other-name>."
            )
        repo.g(["update-ref", f"refs/heads/{branch}", intended], check=True)
        return intended
    finally:
        repo.g(["update-ref", "-d", f"refs/heads/{tmp_ref}"])


def _preview(repos, plan, branch, patches, resolved, args) -> None:
    rl.oprint("\n--- PREVIEW: the following would happen with --execute ---")
    umbrella_sha = "<computed at execute>"
    for name in ("umbrella", "monorepo"):
        pr = plan["repos"][name]
        repo = repos[name]
        rl.oprint(f"\n[{name}]  {repo.root}")
        rl.oprint(f"  1. create branch {branch} from {pr['base_sha'][:12]}")
        add = [f['path'] for f in pr['selected_files'] if f['kind'] != 'deleted']
        rl.oprint(f"  2. commit {len(add)} files (+{len(pr['deletions'])} deletions)"
                  + (f", applying {len(patches.get(name, {}))} narrow patch(es)" if patches.get(name) else ""))
        for f in pr["selected_files"][:12]:
            tag = f["kind"][0].upper()
            r = resolved.get(name, {}).get(f["path"])
            mx = f" [{r}]" if r else ""
            rl.oprint(f"       {tag} {f['path']}{mx}")
        if len(pr["selected_files"]) > 12:
            rl.oprint(f"       ... and {len(pr['selected_files']) - 12} more")
        if resolved.get(name):
            rl.oprint(f"     review decisions: "
                      + ", ".join(f"{p}={how}" for p, how in sorted(resolved[name].items())))
        if name == "umbrella" and args.prune_umbrella_node_modules:
            rl.oprint("     + drop node_modules/ from the release commit tree (worktree untouched)")
        if name == "monorepo":
            rl.oprint(f"  3. write {RELEASE_SOURCE_REL} pinning umbrella -> {umbrella_sha}")
            rl.oprint("  4. patch .github/workflows/core-compatibility.yml to check that SHA "
                      "into runtime/obix")
    if args.push:
        for name in ("umbrella", "monorepo"):
            pr = plan["repos"][name]
            rl.oprint(f"\n  push {name}: git push {pr['target_remote']} "
                      f"refs/heads/{branch}:refs/heads/{branch}  (no --force)")
    if args.pr:
        gh = rl.resolve_gh()
        rl.oprint(f"\n  PR: {'gh ' + gh if gh else 'gh NOT INSTALLED -- PR step will be skipped'}")
        for name in ("umbrella", "monorepo"):
            slug = args.gh_repo if (args.gh_repo and name == "monorepo") else plan["repos"][name]["target_github_slug"]
            acc = rl.gh_repo_view(gh, slug) if (gh and slug) else {"accessible": None}
            rl.oprint(f"     {name}: {slug}  access={acc.get('accessible')}"
                      + (f"  perm={acc.get('permission')}" if acc.get('permission') else ""))


# ===========================================================================
# workflow patch -- pin the nested umbrella checkout
# ===========================================================================
def patch_workflow(path: Path, umbrella_sha: str, umbrella_slug: str | None) -> tuple[bool, str]:
    """Insert, into the jobs that need the umbrella source, a checkout of the
    nested repo at `umbrella_sha` into `runtime/obix`, right after the job's
    `actions/checkout@v4` step. Line-oriented and conservative: if the anchors
    are not found the file is left untouched and the caller is told."""
    if not path.is_file():
        return False, f"{path} not found -- add the pinned checkout step manually"
    slug = umbrella_slug or "obinexusmk2/obix"
    text = path.read_text(encoding="utf-8")
    if "obix-release: pinned umbrella checkout" in text:
        # already patched -- refresh the ref line only
        new = _replace_pinned_ref(text, umbrella_sha)
        if new != text:
            path.write_text(new, encoding="utf-8", newline="\n")
            return True, f"updated existing pinned checkout to {umbrella_sha[:12]}"
        return True, "workflow already pins this SHA"

    lines = text.splitlines(keepends=False)
    JOBS_NEEDING_UMBRELLA = ("contract-node:", "packed-consumer:", "benchmark:")
    out: list[str] = []
    cur_job: str | None = None
    injected_jobs: list[str] = []
    i = 0
    while i < len(lines):
        ln = lines[i]
        stripped = ln.strip()
        # track current job header (2-space indent under `jobs:`)
        if len(ln) - len(ln.lstrip()) == 2 and stripped.endswith(":") and not stripped.startswith("- "):
            cur_job = stripped
        out.append(ln)
        if (cur_job in JOBS_NEEDING_UMBRELLA
                and stripped == "- uses: actions/checkout@v4"
                and cur_job not in injected_jobs):
            indent = " " * (len(ln) - len(ln.lstrip()))
            # skip any existing `with:` block that belongs to this checkout
            j = i + 1
            while j < len(lines) and (lines[j].strip() == "" or len(lines[j]) - len(lines[j].lstrip()) > len(indent)):
                out.append(lines[j])
                j += 1
            block = [
                f"{indent}# obix-release: pinned umbrella checkout (do not edit the ref by hand)",
                f"{indent}- name: check out the amended umbrella at the release-pinned SHA",
                f"{indent}  uses: actions/checkout@v4",
                f"{indent}  with:",
                f"{indent}    repository: {slug}",
                f"{indent}    ref: {umbrella_sha}",
                f"{indent}    path: runtime/obix",
                f"{indent}- name: record the pinned umbrella SHA in the run summary",
                f'{indent}  run: echo "umbrella_sha={umbrella_sha}" >> "$GITHUB_STEP_SUMMARY"',
            ]
            out.extend(block)
            injected_jobs.append(cur_job)
            i = j
            continue
        i += 1
    if not injected_jobs:
        return False, ("could not find `- uses: actions/checkout@v4` under "
                       f"{', '.join(JOBS_NEEDING_UMBRELLA)} -- add the pinned checkout manually")
    path.write_text("\n".join(out) + "\n", encoding="utf-8", newline="\n")
    return True, f"pinned umbrella checkout into jobs: {', '.join(j.rstrip(':') for j in injected_jobs)}"


def _replace_pinned_ref(text: str, sha: str) -> str:
    import re
    return re.sub(r"(#\s*obix-release: pinned umbrella checkout.*?\n(?:.*\n)*?\s*ref:\s*)[0-9a-f]{7,40}",
                  lambda m: m.group(1) + sha, text, flags=0)


# ===========================================================================
# gh PR helpers
# ===========================================================================
def open_or_reuse_pr(gh: str | None, repo: rl.Repo, slug: str | None, branch: str,
                     body: str, *, title: str, workdir: Path, execute: bool) -> dict[str, Any]:
    if not gh:
        return {"status": "skipped", "reason": "gh not installed"}
    if not slug:
        return {"status": "skipped", "reason": "no github slug for this repo"}
    acc = rl.gh_repo_view(gh, slug)
    if acc.get("accessible") is False:
        return {"status": "skipped", "reason": f"gh cannot access {slug}: {acc.get('reason', '')}"}
    # existing?
    lst = rl.run([gh, "pr", "list", "--repo", slug, "--head", branch, "--state", "open",
                  "--json", "number,url"], cwd=repo.root, timeout=60)
    if lst.ok and lst.stdout.strip() and lst.stdout.strip() != "[]":
        try:
            import json as _json
            arr = _json.loads(lst.stdout)
            if arr:
                return {"status": "reused", "number": arr[0]["number"], "url": arr[0]["url"]}
        except Exception:
            pass
    if not execute:
        return {"status": "skipped", "reason": "preview"}
    body_file = rl.write_text_file(workdir, f"pr-body-{slug.replace('/', '_')}.md", body)
    default_branch = acc.get("default_branch") or "main"
    cr = rl.run([gh, "pr", "create", "--repo", slug, "--draft", "--base", default_branch,
                 "--head", branch, "--title", title, "--body-file", str(body_file)],
                cwd=repo.root, timeout=120)
    if cr.ok:
        return {"status": "ok", "url": cr.stdout.strip().splitlines()[-1] if cr.stdout.strip() else None}
    return {"status": "failed", "detail": rl.redact((cr.stderr or cr.stdout).strip()[:800])}


# ===========================================================================
# args
# ===========================================================================
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog=TOOL, description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("--monorepo", metavar="PATH", help="monorepo git root (default: cwd's git toplevel)")
    p.add_argument("--umbrella", metavar="PATH", help="nested umbrella git root (default: <monorepo>/runtime/obix)")
    sub = p.add_subparsers(dest="cmd", required=True)

    sp = sub.add_parser("plan", help="inspect both repos and write an allowlisted commit plan")
    sp.add_argument("--out", default="commit-plan.json", help="plan file to write (default: %(default)s)")
    sp.add_argument("--branch", default=DEFAULT_REVIEW_BRANCH, help="review branch name (default: %(default)s)")
    sp.add_argument("--base", metavar="REF", help="commit base (default: each repo's current HEAD)")
    sp.add_argument("--no-coauthor", action="store_true", help="omit the Co-Authored-By trailer")
    sp.set_defaults(func=cmd_plan)

    sa = sub.add_parser("apply", help="verify the plan and (with --execute) commit / push / PR")
    sa.add_argument("--plan", required=True, help="plan file from `plan`")
    sa.add_argument("--branch", help="override the plan's review branch name")
    sa.add_argument("--execute", action="store_true", help="actually create the local commits")
    sa.add_argument("--push", action="store_true", help="with --execute: push both review branches (no --force)")
    sa.add_argument("--pr", action="store_true", help="with --execute: open/reuse draft PRs via gh")
    sa.add_argument("--gh-repo", metavar="OWNER/REPO",
                    help="override the monorepo github slug for gh operations (when the "
                         "remote is unreachable for the authenticated account)")
    sa.add_argument("--patch", action="append", default=[], metavar="REPO:PATH=FILE",
                    help="isolate a modified file's release hunks with a prepared patch (repeatable)")
    sa.add_argument("--ack", action="append", default=[], metavar="REPO:PATH",
                    help="acknowledge committing a modified file WHOLE (recorded in the receipt); repeatable")
    sa.add_argument("--include-divergence", action="store_true",
                    help="umbrella only: commit its current source as the release baseline, "
                         "recording every modified file in the receipt")
    sa.add_argument("--prune-umbrella-node-modules", action="store_true",
                    help="drop a node_modules/ tree from the umbrella release commit "
                         "(the worktree is not touched)")
    sa.add_argument("--receipt", metavar="FILE", help="receipt path (default: <plan dir>/commit-receipt.json)")
    sa.add_argument("--workdir", metavar="DIR", help="scratch dir for message/body files "
                                                     "(default: <plan dir>/_commit_msgs)")
    sa.set_defaults(func=cmd_apply)
    return p


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        return args.func(args)
    except rl.StalePlanError as e:
        rl.eprint("STALE PLAN: " + str(e))
        return 3
    except rl.Interrupted as e:
        rl.eprint(str(e))
        return 130
    except rl.ReleaseError as e:
        rl.eprint("ERROR: " + str(e))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
