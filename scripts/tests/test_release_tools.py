#!/usr/bin/env python3
"""
Isolated tests for scripts/commit.py + scripts/publish.py.

    <python> -m unittest discover -s scripts/tests -v
    <python> scripts/tests/test_release_tools.py            # same thing

Every test builds its OWN throwaway git repositories under a temp dir; nothing
touches the real OBIX checkout, and no test performs a network / registry / gh
mutation. `gh` and the npm registry are faked by monkeypatching `_release_lib`.

Covered (mapped to the task's test list):
  * nested ignored repo committed via its own repo + a pinned CI checkout
  * unrelated staged + worktree edits preserved; a mixed file requires a decision
  * filenames with spaces + unicode; a multi-line commit body round-trips
  * stale-plan rejection; a diverged review branch is refused
  * partial two-repo failure leaves an honest receipt; idempotent re-run
  * wrong CI SHA / missing nested SHA / failed + skipped required jobs -> not verified
  * version/pin mismatch, an unexpected tarball entry, a changed tarball -> rejected
  * an already-published identical version is accepted; a conflicting one stops
  * a partial publish resumes; a timed-out upload re-checks the registry
  * preview / prepare never mutate a remote
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import tarfile
import tempfile
import textwrap
import unittest
from pathlib import Path
from unittest import mock

_SCRIPTS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_SCRIPTS))
import _release_lib as rl          # noqa: E402
import commit as commit_tool       # noqa: E402
import publish as publish_tool     # noqa: E402

GIT = rl.resolve_git()


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------
def git(cwd, *args, check=True, input_text=None):
    p = subprocess.run([GIT, *args], cwd=str(cwd), capture_output=True, text=True,
                       encoding="utf-8", input=input_text)
    if check and p.returncode != 0:
        raise AssertionError(f"git {' '.join(args)} failed in {cwd}:\n{p.stdout}\n{p.stderr}")
    return p.stdout.strip()


def git_raw(cwd, *args):
    """git output WITHOUT stripping (for -z / porcelain where leading spaces matter)."""
    return subprocess.run([GIT, *args], cwd=str(cwd), capture_output=True, text=True,
                          encoding="utf-8").stdout


def status_map(cwd) -> dict:
    return {ln[3:]: ln[:2] for ln in git_raw(cwd, "status", "--porcelain", "-z").split("\x00") if ln}


def init_repo(path: Path, remote_url: str) -> None:
    path.mkdir(parents=True, exist_ok=True)
    git(path, "init", "-q", "-b", "main")
    git(path, "config", "user.email", "t@t.t")
    git(path, "config", "user.name", "T")
    git(path, "config", "commit.gpgsign", "false")
    git(path, "remote", "add", "origin", remote_url)
    (path / ".gitignore").write_text("node_modules/\n/runtime/\n*.tgz\n", encoding="utf-8")
    (path / "README.md").write_text("base\n", encoding="utf-8")
    git(path, "add", "-A")
    git(path, "commit", "-qm", "initial")


def write(path: Path, rel: str, content: str) -> None:
    f = path / rel
    f.parent.mkdir(parents=True, exist_ok=True)
    f.write_text(content, encoding="utf-8", newline="")


def make_pair(tmp: Path):
    """A monorepo with `/runtime/` ignored + a nested umbrella repo inside it,
    both dirty with a plausible release change set."""
    mono = tmp / "mono"
    init_repo(mono, "git@github.com:acme/mono.git")
    umb = mono / "runtime" / "obix"
    init_repo(umb, "https://github.com/acme/umb.git")

    # --- monorepo release content (all new) ---
    write(mono, "core/version.json", json.dumps({"version": "0.1.0"}, indent=2) + "\n")
    for suf in ("capabilities", "web"):
        dep = {} if suf == "capabilities" else {"dependencies": {"@acme/core-capabilities": "0.1.0"}}
        write(mono, f"core/acme-core-{suf}/package.json",
              json.dumps({"name": f"@acme/core-{suf}", "version": "0.1.0", "license": "MIT",
                          "files": ["dist", "README.md"], **dep}, indent=2) + "\n")
        write(mono, f"core/acme-core-{suf}/dist/index.js", "export const x=1;\n")
        write(mono, f"core/acme-core-{suf}/dist/index.d.ts", "export declare const x: number;\n")
        write(mono, f"core/acme-core-{suf}/README.md", f"# {suf}\n")
        write(mono, f"core/acme-core-{suf}/LICENSE", "MIT\n")
    write(mono, "docs/core-compatibility/architecture.md", "# arch\n")
    write(mono, ".github/workflows/core-compatibility.yml", _WORKFLOW)
    write(mono, "scripts/check-core-graph.mjs", "// gate\n")
    # a tracked file that gets ONE release hunk + is otherwise unrelated -> "modified"
    write(mono, "scripts/ci.mjs", "GATES=[1]\n")
    git(mono, "add", "scripts/ci.mjs")
    git(mono, "commit", "-qm", "add ci.mjs (pre-existing)")
    write(mono, "scripts/ci.mjs", "GATES=[1]\n// core-graph gate\n")   # the release hunk
    # a truly UNRELATED modification + an unrelated staged add
    write(mono, "README.md", "base\nUNRELATED EDIT\n")
    write(mono, "unrelated_staged.txt", "please keep me staged\n")
    git(mono, "add", "unrelated_staged.txt")
    write(mono, "unrelated_untracked.txt", "keep me untracked\n")

    # --- nested umbrella: pre-existing divergence + my additions ---
    write(umb, "package.json", json.dumps(
        {"name": "@acme/umb", "version": "0.3.0", "license": "MIT",
         "bin": {"acme": "./dist/bin/acme.js"},
         "files": ["dist", "README.md"],
         "dependencies": {"@acme/core-capabilities": "0.1.0", "@acme/core-web": "0.1.0",
                          "@acme/adapter": "0.3.0"}}, indent=2) + "\n")
    write(umb, "dist/bin/acme.js", "#!/usr/bin/env node\nconsole.log('acme');\n")
    write(umb, "dist/index.js", "export const y=2;\n")
    write(umb, "dist/index.d.ts", "export declare const y: number;\n")
    write(umb, "README.md", "base\nREWRITTEN UMBRELLA README\n")   # pre-existing divergence
    write(umb, "src/cli.ts", "export const cli = 1;\n")            # my addition
    write(umb, "LICENSE", "MIT\n")
    return mono, umb


_WORKFLOW = textwrap.dedent("""\
    name: core-compatibility
    on: [push]
    jobs:
      graph-gate:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - run: node scripts/check-core-graph.mjs
      contract-node:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - run: node --test "runtime/obix/test/"*.test.mjs
      packed-consumer:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - run: node core/fixtures/pack-and-verify.mjs
      benchmark:
        runs-on: ubuntu-latest
        steps:
          - uses: actions/checkout@v4
          - run: node core/bench/run-bench.mjs
""")


def ns(**kw):
    base = dict(monorepo=None, umbrella=None, branch=None, base=None, no_coauthor=False,
               out=None, plan=None, execute=False, push=False, pr=False, gh_repo=None,
               patch=[], ack=[], include_divergence=False, prune_umbrella_node_modules=False,
               receipt=None, workdir=None)
    base.update(kw)
    return type("NS", (), base)()


# ---------------------------------------------------------------------------
# commit.py
# ---------------------------------------------------------------------------
class CommitPlan(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="obixt-"))
        self.mono, self.umb = make_pair(self.tmp)
        self.addCleanup(lambda: _rmtree(self.tmp))

    def _plan(self, **over):
        out = self.tmp / "commit-plan.json"
        commit_tool.cmd_plan(ns(monorepo=str(self.mono), out=str(out), branch="release/rc1",
                                **over))
        return rl.read_json(out)

    def test_allowlist_separates_release_from_unrelated(self):
        plan = self._plan()
        mono = plan["repos"]["monorepo"]
        sel = {f["path"] for f in mono["selected_files"]}
        self.assertIn("core/version.json", sel)
        self.assertIn(".github/workflows/core-compatibility.yml", sel)
        self.assertIn("scripts/ci.mjs", sel)
        # unrelated content is reported, never selected
        self.assertNotIn("README.md", sel)
        self.assertNotIn("unrelated_staged.txt", sel)
        self.assertIn("README.md", mono["unrelated"]["worktree_modified"])
        self.assertIn("unrelated_staged.txt", mono["unrelated"]["pre_staged"])
        self.assertIn("unrelated_untracked.txt", mono["unrelated"]["untracked"])

    def test_modified_file_flagged_for_review(self):
        plan = self._plan()
        ci = next(f for f in plan["repos"]["monorepo"]["selected_files"] if f["path"] == "scripts/ci.mjs")
        self.assertTrue(ci["review_required"])
        self.assertEqual(ci["kind"], "modified")
        self.assertIn("scripts/ci.mjs", plan["repos"]["monorepo"]["review_required"])

    def test_umbrella_discovered_via_its_own_repo(self):
        plan = self._plan()
        umb = plan["repos"]["umbrella"]
        self.assertEqual(umb["target_github_slug"], "acme/umb")
        self.assertEqual(plan["repos"]["monorepo"]["target_github_slug"], "acme/mono")
        self.assertNotEqual(umb["base_sha"], plan["repos"]["monorepo"]["base_sha"])

    def test_node_modules_never_selected(self):
        (self.mono / "runtime" / "obix" / "node_modules" / "x").mkdir(parents=True)
        write(self.mono / "runtime" / "obix", "node_modules/x/y.js", "junk\n")
        plan = self._plan()
        for f in plan["repos"]["umbrella"]["selected_files"]:
            self.assertNotIn("node_modules/", f["path"])


class CommitApplyPreview(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="obixt-"))
        self.mono, self.umb = make_pair(self.tmp)
        self.addCleanup(lambda: _rmtree(self.tmp))
        self.plan_path = self.tmp / "p.json"
        commit_tool.cmd_plan(ns(monorepo=str(self.mono), out=str(self.plan_path), branch="release/rc1"))

    def _apply(self, **over):
        a = ns(monorepo=str(self.mono), plan=str(self.plan_path), branch="release/rc1",
               receipt=str(self.tmp / "rcpt.json"), workdir=str(self.tmp / "wd"), **over)
        return commit_tool.cmd_apply(a), rl.read_json(self.tmp / "rcpt.json")

    def test_preview_mutates_nothing(self):
        before_mono = git(self.mono, "rev-parse", "HEAD")
        before_umb = git(self.umb, "rev-parse", "HEAD")
        rc, rcpt = self._apply(execute=False, push=True, pr=True,
                               ack=["monorepo:scripts/ci.mjs"], include_divergence=True)
        self.assertEqual(rc, 0)
        self.assertEqual(rcpt["status"], "previewed")
        self.assertEqual(git(self.mono, "rev-parse", "HEAD"), before_mono)
        self.assertEqual(git(self.umb, "rev-parse", "HEAD"), before_umb)
        self.assertEqual(git(self.mono, "branch", "--list", "release/rc1"), "")
        self.assertEqual(git(self.umb, "branch", "--list", "release/rc1"), "")

    def test_review_gate_blocks_undecided_modified_file(self):
        with self.assertRaises(rl.ReleaseError) as cm:
            self._apply(execute=True, include_divergence=True)   # ci.mjs undecided
        self.assertIn("scripts/ci.mjs", str(cm.exception))


class CommitApplyExecute(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="obixt-"))
        self.mono, self.umb = make_pair(self.tmp)
        self.addCleanup(lambda: _rmtree(self.tmp))
        self.plan_path = self.tmp / "p.json"
        commit_tool.cmd_plan(ns(monorepo=str(self.mono), out=str(self.plan_path), branch="release/rc1"))

    def _apply(self, receipt="r.json", **over):
        a = ns(monorepo=str(self.mono), plan=str(self.plan_path), branch="release/rc1",
               receipt=str(self.tmp / receipt), workdir=str(self.tmp / ("wd_" + receipt)),
               ack=["monorepo:scripts/ci.mjs"], include_divergence=True,
               prune_umbrella_node_modules=True, **over)
        return commit_tool.cmd_apply(a), rl.read_json(self.tmp / receipt)

    def test_two_repo_commit_nested_first_and_pinned(self):
        before_umb = git(self.umb, "rev-parse", "HEAD")
        rc, rcpt = self._apply(execute=True)
        self.assertEqual(rc, 0)
        self.assertEqual(rcpt["status"], "ok")
        umb_sha = rcpt["umbrella_sha"]
        mono_sha = rcpt["monorepo_sha"]
        # nested repo committed on its own review branch, parented on its own base
        self.assertEqual(git(self.umb, "rev-parse", "release/rc1"), umb_sha)
        self.assertEqual(git(self.umb, "rev-parse", umb_sha + "^"), before_umb)
        # HEADs untouched (only refs/heads/release/rc1 created)
        self.assertEqual(git(self.mono, "symbolic-ref", "HEAD"), "refs/heads/main")
        # release-source.json in the monorepo commit pins the umbrella SHA
        rs = json.loads(git(self.mono, "show", f"release/rc1:docs/core-compatibility/release-source.json"))
        self.assertEqual(rs["umbrella"]["sha"], umb_sha)
        self.assertNotIn(mono_sha, json.dumps(rs))          # not self-referential
        # workflow in the commit checks that SHA into runtime/obix
        wf = git(self.mono, "show", "release/rc1:.github/workflows/core-compatibility.yml")
        self.assertIn(f"ref: {umb_sha}", wf)
        self.assertIn("path: runtime/obix", wf)
        # worktree preserved: unrelated staged + modified + untracked intact
        rows = status_map(self.mono)
        self.assertEqual(rows.get("unrelated_staged.txt"), "A ")   # still staged
        self.assertEqual(rows.get("README.md"), " M")              # still worktree-modified
        self.assertEqual(rows.get("unrelated_untracked.txt"), "??")
        # the workflow file on disk was NOT modified (override went to the tree only)
        self.assertNotIn("ref: " + umb_sha, (self.mono / ".github/workflows/core-compatibility.yml").read_text())

    def test_node_modules_pruned_from_umbrella_tree(self):
        write(self.umb, "node_modules/dep/index.js", "x\n")
        git(self.umb, "add", "-f", "node_modules")
        git(self.umb, "commit", "-qm", "vendor node_modules")
        commit_tool.cmd_plan(ns(monorepo=str(self.mono), out=str(self.plan_path), branch="release/rc1"))
        rc, rcpt = self._apply(execute=True)
        files = git(self.umb, "ls-tree", "-r", "--name-only", "release/rc1")
        self.assertNotIn("node_modules/", files)
        self.assertIn("src/cli.ts", files)

    def test_idempotent_rerun(self):
        rc1, r1 = self._apply(execute=True, receipt="a.json")
        rc2, r2 = self._apply(execute=True, receipt="b.json")
        self.assertEqual(rc1, 0)
        self.assertEqual(rc2, 0)
        self.assertEqual(r1["umbrella_sha"], r2["umbrella_sha"])
        self.assertEqual(r1["monorepo_sha"], r2["monorepo_sha"])
        self.assertEqual(len(git(self.umb, "rev-list", "release/rc1").splitlines()),
                         len(git(self.umb, "rev-list", "HEAD").splitlines()) + 1)

    def test_stale_plan_rejected(self):
        write(self.mono, "core/acme-core-web/dist/index.js", "export const x=999;\n")
        with self.assertRaises(rl.StalePlanError):
            self._apply(execute=True)

    def test_diverged_review_branch_refused(self):
        # point release/rc1 at a commit that is NEITHER the base NOR the release
        # commit, WITHOUT disturbing the worktree (so the stale-check passes and
        # the branch-content check is what fires).
        base = git(self.umb, "rev-parse", "HEAD")
        junk_tree = git(self.umb, "rev-parse", "HEAD^{tree}")
        junk = git(self.umb, "commit-tree", junk_tree, "-p", base, "-m", "unrelated branch commit")
        git(self.umb, "branch", "release/rc1", junk)
        with self.assertRaises(rl.ReleaseError) as cm:
            self._apply(execute=True)
        self.assertIn("neither the release commit nor the base", str(cm.exception))

    def test_multiline_commit_body_roundtrips(self):
        rc, rcpt = self._apply(execute=True)
        body = git(self.umb, "log", "-1", "--format=%B", "release/rc1")
        self.assertIn("\n\n", body)
        self.assertIn("Co-Authored-By:", body)
        self.assertIn("committed by operator decision", body)

    def test_unicode_and_space_filenames(self):
        write(self.mono, "core/acme-core-web/docs/é– spaced note.md", "x\n")
        commit_tool.cmd_plan(ns(monorepo=str(self.mono), out=str(self.plan_path), branch="release/rc1"))
        rc, rcpt = self._apply(execute=True)
        files = git(self.mono, "ls-tree", "-r", "--name-only", "release/rc1")
        self.assertIn("spaced note.md", files)


class CommitPartialFailure(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="obixt-"))
        self.mono, self.umb = make_pair(self.tmp)
        self.addCleanup(lambda: _rmtree(self.tmp))
        self.plan_path = self.tmp / "p.json"
        commit_tool.cmd_plan(ns(monorepo=str(self.mono), out=str(self.plan_path), branch="release/rc1"))

    def test_push_failure_leaves_honest_partial_receipt(self):
        rcpt_path = self.tmp / "r.json"
        a = ns(monorepo=str(self.mono), plan=str(self.plan_path), branch="release/rc1",
               receipt=str(rcpt_path), workdir=str(self.tmp / "wd"),
               ack=["monorepo:scripts/ci.mjs"], include_divergence=True,
               execute=True, push=True)
        real_push = rl.Repo.push

        def fake_push(self, *, remote, branch, dry_run, set_upstream=False, timeout=300.0):
            if "umb" in str(self.root) or self.root.name == "obix":
                return rl.Proc(argv=["git", "push"], cwd=str(self.root), returncode=1,
                               stdout="", stderr="fatal: permission denied", duration_s=0.1)
            return real_push(self, remote=remote, branch=branch, dry_run=dry_run,
                             set_upstream=set_upstream, timeout=timeout)

        with mock.patch.object(rl.Repo, "push", fake_push):
            with self.assertRaises(rl.ReleaseError):
                commit_tool.cmd_apply(a)
        rcpt = rl.read_json(rcpt_path)
        self.assertEqual(rcpt["status"], "partial")
        names = {s["name"]: s["status"] for s in rcpt["steps"]}
        self.assertEqual(names.get("commit-umbrella"), "ok")
        self.assertEqual(names.get("commit-monorepo"), "ok")
        self.assertEqual(names.get("push-umbrella"), "failed")
        self.assertNotIn("push-monorepo", names)          # never claims both pushed


# ---------------------------------------------------------------------------
# publish.py
# ---------------------------------------------------------------------------
class PublishPlanPrepare(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="obixp-"))
        self.mono, self.umb = make_pair(self.tmp)
        self.addCleanup(lambda: _rmtree(self.tmp))
        # publish.py works off PUBLISH_ALLOWLIST (real @obinexusltd names); point
        # its discovery at our fixture by patching the constants.
        self._patchers = [
            mock.patch.object(rl, "CORE_PACKAGES", ("@acme/core-capabilities", "@acme/core-web")),
            mock.patch.object(rl, "CORE_SUFFIXES", ("capabilities", "web")),
            mock.patch.object(rl, "UMBRELLA_PACKAGE", "@acme/umb"),
            mock.patch.object(rl, "PUBLISH_ALLOWLIST",
                              ("@acme/core-capabilities", "@acme/core-web", "@acme/umb")),
        ]
        for p in self._patchers:
            p.start()
            self.addCleanup(p.stop)

    def _pub_ns(self, **kw):
        base = dict(monorepo=str(self.mono), node=None, out=None, plan=None, tag="next",
                   core_version=None, umbrella_version=None, rc=None, work=None, registry=None,
                   no_build=True, allow_collision=False, commit_versions=False,
                   review_branch="release/rc1", commit_receipt=None, monorepo_sha="deadbeef",
                   umbrella_sha="cafebabe", manifest=None, gh_repo=None, no_clean_checkout=True,
                   clone_no_local=False, keep_temp=False, receipt=None, execute=False,
                   resume=False, retries=1, settle_ms=0, publish_timeout=30, otp=None,
                   provenance=False, skip_final_consumer=True)
        base.update(kw)
        return type("PNS", (), base)()

    def _fake_registry_absent(self, npm, pkg, **kw):
        return {"status": "absent", "versions": [], "dist_tags": {}}

    def test_plan_proposes_rc_and_flags_no_collision(self):
        with mock.patch.object(rl, "npm_view", self._fake_registry_absent):
            out = self.tmp / "rp.json"
            rc = publish_tool.cmd_plan(self._pub_ns(out=str(out)))
        self.assertEqual(rc, 0)
        plan = rl.read_json(out)
        self.assertEqual(plan["proposed_versions"]["@acme/core-web"], "0.1.0-rc.1")
        self.assertEqual(plan["proposed_versions"]["@acme/umb"], "0.3.0-rc.1")
        self.assertEqual(plan["collisions"], [])
        self.assertEqual(plan["publish_order"][-1], "@acme/umb")

    def test_plan_collision_is_not_auto_bumped(self):
        def existing(npm, pkg, **kw):
            if pkg == "@acme/core-web":
                return {"status": "ok", "versions": ["0.1.0-rc.1"], "dist_tags": {"latest": "0.1.0-rc.1"}}
            return {"status": "absent", "versions": [], "dist_tags": {}}
        with mock.patch.object(rl, "npm_view", existing):
            out = self.tmp / "rp.json"
            rc = publish_tool.cmd_plan(self._pub_ns(out=str(out)))
        self.assertEqual(rc, 2)                            # collision -> non-zero
        plan = rl.read_json(out)
        self.assertIn("@acme/core-web@0.1.0-rc.1", plan["collisions"])
        self.assertEqual(plan["proposed_versions"]["@acme/core-web"], "0.1.0-rc.1")  # NOT rc.2

    def test_prepare_rewrites_pins_and_rejects_local_specs(self):
        with mock.patch.object(rl, "npm_view", self._fake_registry_absent):
            plan_p = self.tmp / "rp.json"
            publish_tool.cmd_plan(self._pub_ns(out=str(plan_p)))
        man_p = self.tmp / "rm.json"
        rc = publish_tool.cmd_prepare(self._pub_ns(plan=str(plan_p), out=str(man_p),
                                                  work=str(self.tmp / "prep"), no_build=True))
        self.assertEqual(rc, 0)
        man = rl.read_json(man_p)
        umb = man["packages"]["@acme/umb"]["contents"]["embedded_pkg"]
        self.assertEqual(umb["version"], "0.3.0-rc.1")
        self.assertEqual(umb["dependencies"]["@acme/core-web"], "0.1.0-rc.1")   # exact
        self.assertEqual(umb["dependencies"]["@acme/adapter"], "0.3.0")         # untouched
        self.assertTrue(all("sha512" in p and "sha256" in p for p in man["packages"].values()))
        self.assertFalse(man["verified"])
        self.assertFalse(man["ci"]["verified"])

    def test_prepare_flags_local_dep_spec(self):
        write(self.mono, "core/acme-core-web/package.json",
              json.dumps({"name": "@acme/core-web", "version": "0.1.0", "license": "MIT",
                          "files": ["dist", "README.md"],
                          "dependencies": {"@acme/core-capabilities": "file:../acme-core-capabilities"}},
                         indent=2) + "\n")
        with mock.patch.object(rl, "npm_view", self._fake_registry_absent):
            plan_p = self.tmp / "rp.json"
            publish_tool.cmd_plan(self._pub_ns(out=str(plan_p)))
        with self.assertRaises(rl.ReleaseError) as cm:
            publish_tool.cmd_prepare(self._pub_ns(plan=str(plan_p), out=str(self.tmp / "rm.json"),
                                                 work=str(self.tmp / "prep")))
        self.assertIn("local spec", str(cm.exception))


class PublishVerifyCI(unittest.TestCase):
    """The CI-evidence gate: exact SHA, no skipped required jobs, nested SHA present."""

    def _ci(self, gh_runs, gh_jobs, *, slug_ok=True, src=None):
        src = src or {"monorepo_slug": "acme/mono", "monorepo_sha": "abc123",
                      "umbrella_sha": "umb999", "umbrella_slug": "acme/umb"}

        def fake_run(argv, *, cwd, timeout=90, **kw):
            a = " ".join(argv)
            if "repo view" in a:
                return rl.Proc(argv, str(cwd), 0 if slug_ok else 1,
                               json.dumps({"name": "mono", "viewerPermission": "ADMIN",
                                           "defaultBranchRef": {"name": "main"}}) if slug_ok else "",
                               "" if slug_ok else "Could not resolve to a Repository", 0.0)
            if "run list" in a:
                return rl.Proc(argv, str(cwd), 0, json.dumps(gh_runs), "", 0.0)
            if "run view" in a:
                return rl.Proc(argv, str(cwd), 0, json.dumps(gh_jobs), "", 0.0)
            return rl.Proc(argv, str(cwd), 0, "", "", 0.0)

        with mock.patch.object(rl, "run", fake_run):
            recpt = rl.Receipt(Path(tempfile.mktemp()), "t")
            return publish_tool._verify_ci("gh", src, recpt,
                                           type("A", (), {"gh_repo": None})())

    def test_green_exact_sha_with_nested_evidence_passes(self):
        runs = [{"databaseId": 7, "headSha": "abc123", "status": "completed",
                 "conclusion": "success", "url": "u"}]
        jobs = {"jobs": [
            {"name": "graph-gate", "conclusion": "success", "steps": []},
            {"name": "contract-node (ubuntu, 24)", "conclusion": "success",
             "steps": [{"name": "record the pinned umbrella SHA"}]},
            {"name": "packed-consumer (ubuntu)", "conclusion": "success", "steps": []},
        ]}
        res = self._ci(runs, jobs)
        self.assertTrue(res["verified"])
        self.assertTrue(res["umbrella_sha_in_evidence"])

    def test_wrong_sha_rejected(self):
        runs = [{"databaseId": 7, "headSha": "WRONG", "status": "completed",
                 "conclusion": "success", "url": "u"}]
        res = self._ci(runs, {"jobs": []})
        self.assertFalse(res["verified"])
        self.assertIn("no core-compatibility run", res["reason"])

    def test_skipped_required_job_rejected(self):
        runs = [{"databaseId": 7, "headSha": "abc123", "status": "completed",
                 "conclusion": "success", "url": "u"}]
        jobs = {"jobs": [
            {"name": "graph-gate", "conclusion": "success", "steps": []},
            {"name": "contract-node", "conclusion": "skipped", "steps": []},
            {"name": "packed-consumer", "conclusion": "success", "steps": []},
        ]}
        res = self._ci(runs, jobs)
        self.assertFalse(res["verified"])
        self.assertIn("skipped_required", res["reason"])

    def test_unreadable_repo_is_unmet_not_pass(self):
        res = self._ci([], {"jobs": []}, slug_ok=False)
        self.assertFalse(res["verified"])
        self.assertIn("cannot access", res["reason"])


class PublishExecuteGuards(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="obixe-"))
        self.mono, _ = make_pair(self.tmp)
        self.addCleanup(lambda: _rmtree(self.tmp))

    def _manifest(self, **over):
        tgz = self.tmp / "pkg.tgz"
        _make_tgz(tgz, "@acme/core-capabilities", "0.1.0-rc.1")
        m = {
            "schema": rl.RELEASE_MANIFEST_SCHEMA, "tag": "next", "node": None,
            "publish_order": ["@acme/core-capabilities"],
            "proposed_versions": {"@acme/core-capabilities": "0.1.0-rc.1"},
            "source": {"monorepo_sha": "s", "umbrella_sha": "u"},
            "packages": {"@acme/core-capabilities": {
                "version": "0.1.0-rc.1", "tarball": tgz.name, "path": str(tgz),
                "sha512": rl.sri_sha512_of_file(tgz), "sha256": rl.sha256_file(tgz)}},
            "verified": True, "ci": {"verified": True},
        }
        m.update(over)
        p = self.tmp / "m.json"
        rl.write_json_atomic(p, m)
        return p, tgz

    def _ex_ns(self, manifest, **kw):
        base = dict(monorepo=str(self.mono), node=None, manifest=str(manifest), execute=True,
                   resume=False, retries=1, settle_ms=0, publish_timeout=30, otp=None,
                   provenance=False, skip_final_consumer=True, receipt=str(self.tmp / "pr.json"))
        base.update(kw)
        return type("E", (), base)()

    def test_refuses_without_execute_flag(self):
        p, _ = self._manifest()
        with self.assertRaises(rl.ReleaseError):
            publish_tool.cmd_execute(self._ex_ns(p, execute=False))

    def test_refuses_unverified_manifest(self):
        p, _ = self._manifest(verified=False)
        with self.assertRaises(rl.ReleaseError) as cm:
            publish_tool.cmd_execute(self._ex_ns(p))
        self.assertIn("verified", str(cm.exception))

    def test_refuses_without_ci_evidence(self):
        p, _ = self._manifest(ci={"verified": False})
        with self.assertRaises(rl.ReleaseError) as cm:
            publish_tool.cmd_execute(self._ex_ns(p))
        self.assertIn("CI evidence", str(cm.exception))

    def test_refuses_dist_tag_latest(self):
        p, _ = self._manifest(tag="latest")
        with self.assertRaises(rl.ReleaseError) as cm:
            publish_tool.cmd_execute(self._ex_ns(p))
        self.assertIn("latest", str(cm.exception))

    def test_changed_tarball_rejected(self):
        p, tgz = self._manifest()
        tgz.write_bytes(tgz.read_bytes() + b"tamper")
        with mock.patch.object(rl, "npm_view", lambda *a, **k: {"status": "absent", "versions": [], "dist_tags": {}}), \
             mock.patch.object(publish_tool, "_peek_tarball_pkg", lambda t: {"name": "@acme/core-capabilities", "version": "0.1.0-rc.1"}):
            npm = _FakeNpm()
            with mock.patch.object(rl, "resolve_npm", lambda *_: npm):
                with self.assertRaises(rl.ReleaseError):
                    publish_tool.cmd_execute(self._ex_ns(p))
        self.assertEqual(npm.published, [])                # nothing uploaded

    def test_identical_existing_version_is_ok_conflicting_stops(self):
        p, tgz = self._manifest()
        sri = rl.sri_sha512_of_file(tgz)
        npm = _FakeNpm()
        # identical: registry has our version with matching integrity
        with mock.patch.object(rl, "resolve_npm", lambda *_: npm), \
             mock.patch.object(rl, "npm_view", lambda n, pk, **k: {"status": "ok", "versions": ["0.1.0-rc.1"], "dist_tags": {}}), \
             mock.patch.object(rl, "npm_pack_integrity", lambda n, s, **k: {"integrity": sri}), \
             mock.patch.object(publish_tool, "_peek_tarball_pkg", lambda t: {"name": "@acme/core-capabilities", "version": "0.1.0-rc.1"}):
            rc = publish_tool.cmd_execute(self._ex_ns(p))
        self.assertEqual(rc, 0)
        rcpt = rl.read_json(self.tmp / "pr.json")
        self.assertEqual(rcpt["steps"][-1]["status"], "already-published")
        self.assertEqual(npm.published, [])

        # conflicting: same version, different integrity -> stop
        npm2 = _FakeNpm()
        with mock.patch.object(rl, "resolve_npm", lambda *_: npm2), \
             mock.patch.object(rl, "npm_view", lambda n, pk, **k: {"status": "ok", "versions": ["0.1.0-rc.1"], "dist_tags": {}}), \
             mock.patch.object(rl, "npm_pack_integrity", lambda n, s, **k: {"integrity": "sha512-DIFFERENT"}), \
             mock.patch.object(publish_tool, "_peek_tarball_pkg", lambda t: {"name": "@acme/core-capabilities", "version": "0.1.0-rc.1"}):
            with self.assertRaises(rl.ReleaseError):
                publish_tool.cmd_execute(self._ex_ns(p, receipt=str(self.tmp / "pr2.json")))
        rcpt2 = rl.read_json(self.tmp / "pr2.json")
        self.assertEqual(rcpt2["status"], "partial")
        self.assertEqual(rcpt2["steps"][-1]["status"], "conflict")

    def test_resume_skips_completed_and_finishes(self):
        p, tgz = self._manifest(publish_order=["@acme/core-capabilities", "@acme/umb"],
                                proposed_versions={"@acme/core-capabilities": "0.1.0-rc.1",
                                                   "@acme/umb": "0.3.0-rc.1"})
        man = rl.read_json(p)
        umb_tgz = self.tmp / "umb.tgz"
        _make_tgz(umb_tgz, "@acme/umb", "0.3.0-rc.1")
        man["packages"]["@acme/umb"] = {"version": "0.3.0-rc.1", "tarball": umb_tgz.name,
                                        "path": str(umb_tgz), "sha512": rl.sri_sha512_of_file(umb_tgz),
                                        "sha256": rl.sha256_file(umb_tgz)}
        rl.write_json_atomic(p, man)
        # pre-seed a receipt: core already published
        rcpt = rl.new_receipt("publish-execute")
        rcpt["steps"].append({"name": "publish-@acme/core-capabilities", "status": "ok", "at": "x"})
        rl.write_json_atomic(self.tmp / "pr.json", rcpt)
        npm = _FakeNpm()
        with mock.patch.object(rl, "resolve_npm", lambda *_: npm), \
             mock.patch.object(rl, "npm_view", lambda *a, **k: {"status": "absent", "versions": [], "dist_tags": {}}), \
             mock.patch.object(publish_tool, "_peek_tarball_pkg",
                               lambda t: {"name": "@acme/umb" if "umb" in str(t) else "@acme/core-capabilities",
                                          "version": "0.3.0-rc.1" if "umb" in str(t) else "0.1.0-rc.1"}):
            rc = publish_tool.cmd_execute(self._ex_ns(p, resume=True))
        self.assertEqual(rc, 0)
        self.assertEqual(npm.published, ["@acme/umb"])     # only the not-yet-done one


class PublishTimeout(unittest.TestCase):
    def setUp(self):
        self.tmp = Path(tempfile.mkdtemp(prefix="obixto-"))
        self.addCleanup(lambda: _rmtree(self.tmp))
        self.tgz = self.tmp / "p.tgz"
        _make_tgz(self.tgz, "@acme/core-capabilities", "0.1.0-rc.1")
        self.info = {"version": "0.1.0-rc.1", "path": str(self.tgz),
                     "sha512": rl.sri_sha512_of_file(self.tgz), "tarball": self.tgz.name}

    def test_uncertain_timeout_rechecks_registry_then_accepts_match(self):
        npm = _FakeNpm(publish_result="timeout")
        seen = {"views": 0}

        def view(n, pk, **k):
            seen["views"] += 1
            if seen["views"] == 1:
                return {"status": "absent", "versions": [], "dist_tags": {}}   # pre-publish check
            return {"status": "ok", "versions": ["0.1.0-rc.1"], "dist_tags": {}}  # appeared after timeout

        with mock.patch.object(rl, "npm_view", view), \
             mock.patch.object(rl, "npm_pack_integrity", lambda n, s, **k: {"integrity": self.info["sha512"]}), \
             mock.patch.object(publish_tool, "_peek_tarball_pkg",
                               lambda t: {"name": "@acme/core-capabilities", "version": "0.1.0-rc.1"}), \
             mock.patch("time.sleep", lambda *_: None):
            res = publish_tool._publish_one(npm, "@acme/core-capabilities", self.info, "next", None,
                                            type("A", (), {"retries": 2, "publish_timeout": 5,
                                                           "otp": None, "provenance": False})())
        self.assertEqual(res["status"], "already-published")
        self.assertIn("timed-out", res["detail"])


# ---------------------------------------------------------------------------
# fakes
# ---------------------------------------------------------------------------
class _FakeNpm:
    def __init__(self, publish_result="ok"):
        self.node = sys.executable
        self.cli_js = "npm-cli.js"
        self.version = "0.0.0-fake"
        self.published: list[str] = []
        self.publish_result = publish_result

    def run(self, args, *, cwd, timeout=300.0, check=False, env=None):
        a = list(args)
        if a[:1] == ["whoami"]:
            return rl.Proc(a, str(cwd), 0, "fake-user", "", 0.0)
        if a[:1] == ["publish"]:
            if self.publish_result == "timeout":
                return rl.Proc(a, str(cwd), 124, "", "ETIMEDOUT", 0.0, timed_out=True)
            if self.publish_result == "conflict":
                return rl.Proc(a, str(cwd), 1, "", "npm ERR! EPUBLISHCONFLICT", 0.0)
            name = _peek_name(a[1])
            self.published.append(name)
            return rl.Proc(a, str(cwd), 0, f"+ {name}", "", 0.0)
        return rl.Proc(a, str(cwd), 0, "", "", 0.0)


def _peek_name(tgz_path):
    p = publish_tool._peek_tarball_pkg(Path(tgz_path))
    return p["name"] if p else "?"


def _make_tgz(path: Path, name: str, version: str) -> None:
    stage = path.parent / ("_stage_" + path.stem)
    (stage / "package").mkdir(parents=True, exist_ok=True)
    (stage / "package" / "package.json").write_text(
        json.dumps({"name": name, "version": version, "license": "MIT",
                    "main": "dist/index.js", "types": "dist/index.d.ts"}), encoding="utf-8")
    (stage / "package" / "dist").mkdir()
    (stage / "package" / "dist" / "index.js").write_text("export const x=1;\n", encoding="utf-8")
    (stage / "package" / "dist" / "index.d.ts").write_text("export declare const x:number;\n", encoding="utf-8")
    (stage / "package" / "README.md").write_text("# x\n", encoding="utf-8")
    (stage / "package" / "LICENSE").write_text("MIT\n", encoding="utf-8")
    with tarfile.open(path, "w:gz") as tf:
        tf.add(stage / "package", arcname="package")
    _rmtree(stage)


def _rmtree(p: Path) -> None:
    import shutil
    shutil.rmtree(p, ignore_errors=True)


if __name__ == "__main__":
    unittest.main(verbosity=2)
