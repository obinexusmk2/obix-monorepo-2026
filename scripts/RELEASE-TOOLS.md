# OBIX release tools — `commit.py` + `publish.py`

Two Python 3 tools that stage and publish the **OBIX core-compatibility release
candidate**. Standard library only. Every external process is run with an
argument array, `shell=False`, an explicit `cwd`, a timeout and a captured exit
status; `git`/`gh` are resolved as executables; **`npm` is invoked as
`<node> <npm-cli.js> …`** so a Windows `npm.cmd` launcher is never handed to Node
or a shell.

```
scripts/
  _release_lib.py   shared helpers (subprocess, Repo, digests, receipts, npm/gh)
  commit.py         stage the release across BOTH git repositories
  publish.py        publish exactly eleven packages to npm
  tests/            isolated unittest suite (synthetic repos, faked gh/npm)
```

Run the tests:

```bash
python -m unittest discover -s scripts/tests -v
```

---

## The two repositories

| repo | where | remote (this checkout) | holds |
| --- | --- | --- | --- |
| **monorepo** | repo root | `git@github.com:obinexusmk2/obix-monorepo-2026.git` (SSH) | the ten `core/obix-core-*` packages, `scripts/check-core-graph.mjs`, `core/fixtures/`, `core/bench/`, `docs/core-compatibility/`, the workflow |
| **umbrella** | `runtime/obix/` | `https://github.com/obinexusmk2/obix.git` (HTTPS) | the amended `@obinexusltd/obix` umbrella (`bin: obix`, `./cli`, ten core deps) |

`runtime/obix` is a **nested git repository** that the monorepo ignores via its
`/runtime/` rule, so a monorepo push alone omits the umbrella. Both tools treat
the two repos, their remotes and their auth as independent. `gh` (HTTPS/OAuth)
and `git push` (SSH) are separate auth paths — one can work while the other does
not.

On this machine, the authenticated `gh` account (`obinexus`) **cannot resolve**
`obinexusmk2/obix-monorepo-2026`, and has only **READ** on `obinexusmk2/obix`.
The tools report this precisely and never fabricate CI evidence or a push.

---

## Safety model

| phase | reads | writes locally | writes remotely |
| --- | --- | --- | --- |
| `commit.py plan` | both repos, `gh` metadata | the plan file + a narrow patch | never |
| `commit.py apply` (no `--execute`) | both repos | a preview receipt | never |
| `commit.py apply --execute` | both repos | two review-branch commits + a receipt | never |
| `commit.py apply --execute --push` | + | + | `git push` (no `--force`) |
| `commit.py apply --execute --pr` | + `gh` | + | draft PRs (reused, never duplicated) |
| `publish.py plan` / `prepare` | manifests, registry | plan / manifest / tarballs (in a temp dir) | never |
| `publish.py verify` | `gh` Actions, registry; clones the SHA pair | a receipt; flips `manifest.verified` | never |
| `publish.py execute --execute` | verified manifest | a receipt after **each** upload | `npm publish … --tag next` (never `latest`) |

Plans, manifests and receipts are written where you point them; keep them
**outside both working trees** (a temp dir). The tools warn if an output path is
inside a repo and not git-ignored.

---

## `commit.py`

### `plan`

```bash
python scripts/commit.py plan --out /tmp/commit-plan.json
```

Inspects both repos (HEAD, branch, remotes, upstream, ahead/behind, full status),
resolves an **explicit allowlist** of release files, classifies each as
`new` / `modified` / `deleted`, and separately lists pre-existing staged entries
and unrelated worktree/untracked changes (`node_modules/`, `*.tsbuildinfo`,
`__pycache__/` are omitted as noise). A tracked file that already differs from
HEAD is marked **review-required** with a diffstat and a stable diff digest.

For the monorepo `package.json` (which carries unrelated hunks) `plan` writes a
**narrow patch** next to the plan that adds only `"core/*"` to `workspaces`, and
pre-wires it as a `--patch` for `apply`.

The plan records each repo's `base_sha` and a `selection_digest` over the exact
selected content, so `apply` can detect a stale plan.

### `apply`

```bash
# preview — mutates nothing
python scripts/commit.py apply --plan /tmp/commit-plan.json --push --pr

# create the two local review-branch commits
python scripts/commit.py apply --plan /tmp/commit-plan.json --execute \
    --ack monorepo:scripts/ci.mjs \
    --include-divergence \
    --prune-umbrella-node-modules

# …then push the branches and open draft PRs
python scripts/commit.py apply --plan /tmp/commit-plan.json --execute --push --pr \
    --ack monorepo:scripts/ci.mjs --include-divergence --prune-umbrella-node-modules \
    --gh-repo obinexusmk2/obix-monorepo-2026
```

**Resolving a review-required file** (one per line, choose one):

| flag | meaning |
| --- | --- |
| `--patch <repo>:<path>=<file>` | apply a prepared patch that carries only the release hunks |
| `--ack <repo>:<path>` | commit the file **whole**, recorded in the receipt as an operator decision |
| `--include-divergence` | umbrella only — commit its current source as the release baseline (its HEAD is months behind its worktree); every such file is listed in the receipt |

`--prune-umbrella-node-modules` drops a `node_modules/` tree from the umbrella
release commit **without touching the worktree** (the nested repo's base commit
vendors it).

**What `--execute` does, in order:**

1. commit the **nested umbrella first** on `release/core-compat-rc1`, parented on
   the umbrella's own base — via a private temporary index (`git read-tree` +
   `git add` + `git write-tree` + `git commit-tree`), so the real index and
   worktree are never staged, reset, cleaned or stashed. Record `umbrella_sha`.
2. write `docs/core-compatibility/release-source.json` (deterministic — no
   timestamp) pinning the umbrella to that SHA + its remote slug/URL. It does
   **not** contain the monorepo commit SHA it will live in (not self-referential).
3. patch `.github/workflows/core-compatibility.yml` — into a scratch copy — to
   add, in the jobs that need the umbrella (`contract-node`, `packed-consumer`,
   `benchmark`), a checkout of the nested repo at `umbrella_sha` into
   `runtime/obix`, plus a step that echoes the SHA into the run summary.
4. commit the **monorepo second** on the same branch, injecting the manifest and
   the patched workflow via a content override (again, no worktree write).
   Record `monorepo_sha`.
5. `--push`: `git push <remote> refs/heads/<branch>:refs/heads/<branch>` per repo
   (no `--force`, no `--force-with-lease`).
6. `--pr`: `gh pr create --draft` per repo, or reuse an existing open PR from the
   branch. If `gh` cannot access a repo, the step is **skipped with the precise
   reason**; the run does not claim a PR was opened.

**Idempotent**: re-running with the same plan + flags produces the identical two
SHAs and does not create duplicate commits or PRs. A review branch that already
exists is fast-forwarded from base or reused if its tree already matches;
otherwise the run **refuses** (never force-moves it).

**Partial failure**: the run stops and the receipt records exactly which of
`commit-umbrella` / `commit-monorepo` / `push-*` / `pr-*` succeeded. It never
reports both repositories updated when only one was.

**Stale plan** (`exit 3`): if either HEAD moved or the selected content changed
since `plan`, `apply` refuses and tells you to re-run `plan`.

---

## `publish.py`

Publishes **only** these eleven names, in this order (deps first, umbrella last),
one `npm publish <tarball>` per package — **never** `npm publish --workspaces`:

```
@obinexusltd/obix-core-capabilities   @obinexusltd/obix-core-diagnostics
@obinexusltd/obix-core-modules        @obinexusltd/obix-core-scheduler
@obinexusltd/obix-core-streams        @obinexusltd/obix-core-filesystem
@obinexusltd/obix-core-process        @obinexusltd/obix-core-workers
@obinexusltd/obix-core-native         @obinexusltd/obix-core-web
@obinexusltd/obix
```

### `plan`

```bash
python scripts/publish.py plan --out /tmp/release-plan.json
```

Reads registry metadata for all eleven (`npm view … --json`), distinguishing
**absent** (404 — *not* proof the name is free), **error** (auth/network — must
be resolved before `prepare`), and **ok** (with published versions + dist-tags).
Proposes `0.1.0-rc.1` for the ten and `0.3.0-rc.1` for the umbrella and computes
the exact-pin rewrites (`core/version.json`, every internal
`@obinexusltd/obix-core-*` dependency, the umbrella's ten deps). A version that
already exists is a **collision** (non-zero exit) and is **never auto-bumped** —
move it deliberately with `--rc <N>`.

### `prepare`

```bash
python scripts/publish.py prepare --plan /tmp/release-plan.json \
    --out /tmp/release-manifest.json --work /tmp/obix-prep \
    --commit-receipt /tmp/commit-receipt.json --no-build
```

Copies each package's publishable file set into a work dir, rewrites the version
+ exact internal pins on the **copy** (a `file:` / `link:` / `workspace:` spec in
any published dep is rejected), `npm pack`s the eleven, and for every tarball
records `sha512` (SRI) + `sha256` + byte size and inspects the archive: embedded
name/version, exact internal pins, `bin` targets present, `exports` targets
present, LICENSE + README + `.js` + `.d.ts` present, no unexpected top-level
entries. Writes `release-manifest.json` with both source SHAs (from
`release-source.json` / the commit receipt / `--*-sha`), the tag (`next`), the
registry, node/npm/deno/bun versions, the publish order and every tarball hash.
`ci.verified` and `verified` start **false**.

`--commit-versions` additionally creates the RC version-bump commit on the review
branch in **both** repos (nested first). Drop `--no-build` to rebuild `dist/`
first via `scripts/check-core-graph.mjs`.

### `verify`

```bash
python scripts/publish.py verify --manifest /tmp/release-manifest.json \
    --gh-repo obinexusmk2/obix-monorepo-2026
```

Four gates — **all four must PASS** for `manifest.verified` to become true:

1. **CI evidence for the exact monorepo SHA.** `gh run list --commit <sha>` for
   `core-compatibility.yml`; the run must be `completed/success`; every required
   job (`graph-gate`, `contract-node`, `packed-consumer`) must be present and
   `success` — a **skipped** required job fails verification; a top-level green
   badge is not accepted. The run's evidence must reference the pinned umbrella
   SHA. If `gh` cannot read the repo, this gate is **UNMET** (never "PASS").
2. **tarball hashes unchanged** since `prepare`.
3. **clean-checkout gates.** `git clone --local` the monorepo at `monorepo_sha`
   + the nested umbrella at `umbrella_sha` into `runtime/obix`, `npm ci`, then
   `scripts/check-core-graph.mjs` and `core/fixtures/pack-and-verify.mjs`.
   Skipping it (`--no-clean-checkout`) blocks `verified`.
4. **installed-consumer doctor.** `npm install` the eleven tarballs into a fresh
   project outside workspace resolution; run the installed `dist/bin/obix.js`
   under node **and deno and bun**, asserting each reports **its own**
   `runtime` from inside the process (`doctor --json` → `runtime: "deno"` etc.);
   `--require native` must exit 1.

### `execute` / `resume`

```bash
python scripts/publish.py execute --manifest /tmp/release-manifest.json --execute
# after a partial run:
python scripts/publish.py execute --manifest /tmp/release-manifest.json --execute --resume
```

Refuses unless `--execute` **and** `manifest.verified` **and**
`manifest.ci.verified` are all true, and refuses `--tag latest`. Publishes the
exact tested tarballs in dependency order, umbrella last, `--access public --tag
next`. Before each upload it re-hashes the tarball and re-checks the embedded
name/version. After each result it writes the receipt.

* **already published, identical content** (registry `dist.integrity` == our
  `sha512`) → recorded `already-published`, not re-uploaded.
* **already published, different content** → `conflict`, the run **stops**;
  nothing is overwritten, unpublished or auto-bumped.
* **timeout / `ETIMEDOUT` / 429 / 503** → bounded retries; before each retry the
  registry is re-checked, and an appeared-with-matching-content version is
  accepted as `already-published`.

`resume` reads its own receipt and skips packages already `ok` /
`already-published`. After the umbrella publishes, a final consumer installs the
**exact published versions** from the registry and re-checks `doctor --json` +
`--require native`.

---

## File / schema reference

All are JSON with a `schema` string; bump the trailing `@N` on a breaking change.

| file | schema | produced by | consumed by |
| --- | --- | --- | --- |
| commit plan | `obix-release/commit-plan@1` | `commit.py plan` | `commit.py apply` |
| commit receipt | `obix-release/receipt@1` | `commit.py apply` | humans; `publish.py prepare` (`--commit-receipt`) |
| release-source manifest | `obix-release/release-source@1` | `commit.py apply --execute` (committed into the monorepo) | CI; `publish.py prepare` |
| release plan | `obix-release/release-plan@1` | `publish.py plan` | `publish.py prepare` |
| release manifest | `obix-release/release-manifest@1` | `publish.py prepare`; updated by `verify` | `publish.py verify` / `execute` |
| verify / publish receipt | `obix-release/receipt@1` | `publish.py verify` / `execute` | `publish.py execute --resume`; humans |

### `commit-plan@1` (shape)

```jsonc
{
  "schema": "obix-release/commit-plan@1",
  "review_branch": "release/core-compat-rc1",
  "coauthor": true,
  "repos": {
    "monorepo": {
      "facts": { "head": "...", "branch": "main", "github": {"origin": "owner/repo"}, "ahead": 0, "behind": null },
      "base_sha": "<HEAD at plan time>",
      "base_ref": "<HEAD or --base>",
      "target_remote": "origin",
      "target_github_slug": "owner/repo",
      "allowlist_globs": ["core/**", "..."],
      "selected_files": [ { "path": "...", "kind": "new|modified|deleted",
                           "review_required": false, "diffstat": "...", "diff_digest": "sha256:..." } ],
      "deletions": [],
      "review_required": ["scripts/ci.mjs"],
      "keep_patches": { "package.json": "/abs/monorepo.package.json.release.patch" },
      "selection_digest": "sha256:...",
      "unrelated": { "pre_staged": [], "worktree_modified": [], "untracked": [] },
      "warnings": []
    },
    "umbrella": { "...": "same shape" }
  }
}
```

### `release-source@1` (committed into the monorepo)

```jsonc
{
  "schema": "obix-release/release-source@1",
  "umbrella": {
    "github_slug": "obinexusmk2/obix",
    "remote_url": "https://github.com/obinexusmk2/obix.git",
    "sha": "<nested umbrella commit>",
    "branch": "release/core-compat-rc1",
    "tree": "<tree hash>"
  },
  "monorepo": { "github_slug": "obinexusmk2/obix-monorepo-2026",
                "note": "does not and cannot contain that commit's own SHA" },
  "ci": { "workflow": ".github/workflows/core-compatibility.yml",
          "requirement": "check out `umbrella.sha` into runtime/obix before build." }
}
```

### `release-manifest@1` (shape)

```jsonc
{
  "schema": "obix-release/release-manifest@1",
  "source": { "monorepo_sha": "...", "monorepo_slug": "...", "umbrella_sha": "...", "umbrella_slug": "..." },
  "tag": "next",
  "registry": null,
  "node": "…/node.exe", "npm_version": "11.19.0",
  "runtimes": { "node": "v26.7.0", "deno": "deno 2.9.6 …", "bun": "1.4.2" },
  "proposed_versions": { "@obinexusltd/obix-core-capabilities": "0.1.0-rc.1", "…": "…",
                          "@obinexusltd/obix": "0.3.0-rc.1" },
  "publish_order": ["@obinexusltd/obix-core-capabilities", "…", "@obinexusltd/obix"],
  "packages": {
    "@obinexusltd/obix-core-web": {
      "version": "0.1.0-rc.1", "tarball": "obinexusltd-obix-core-web-0.1.0-rc.1.tgz",
      "path": "/abs/…tgz", "sha512": "sha512-…", "sha256": "…", "bytes": 13431,
      "contents": { "files": ["dist/index.js", "…"], "embedded_pkg": { "…": "…" }, "warnings": [] }
    }
  },
  "ci": { "verified": false, "reason": "…", "run_id": null, "run_url": null,
          "umbrella_sha_in_evidence": false, "job_conclusions": {} },
  "verified": false,
  "version_commit": null
}
```

### receipt@1

```jsonc
{
  "schema": "obix-release/receipt@1",
  "kind": "commit-apply | publish-verify | publish-execute",
  "started_at": "…Z", "finished_at": "…Z",
  "status": "in-progress | previewed | ok | partial | failed | interrupted",
  "umbrella_sha": "…", "monorepo_sha": "…",          // commit-apply
  "steps": [ { "name": "commit-umbrella", "status": "ok", "at": "…Z", "sha": "…" }, "…" ]
}
```

Every `step()` flushes to disk immediately, so a Ctrl+C or crash still leaves a
machine-readable record; `--resume` reads it back.

---

## Why this exists

The `docs/obix-docs/BOTTLENECK_ANALYSIS.md` audit called out a *"53-repo
architecture with no monorepo … version drift … unmaintainable release
process"* and *"SSR claims are untrue — components crash in Node.js"*. The
core-compatibility work answers the architecture and server gaps
(`obix-core-web` `/dom` + `/server` boundaries, one `core/version.json`, exact
pins, the `check-core-graph` gate). These tools give that work a **reproducible,
two-repository, allowlisted** release path: an operator can commit, push, verify
against real CI, and publish a prerelease under `next` without repeated
interactive prompts and without the tool ever guessing an owner, moving
`latest`, or claiming a push or a green CI run that did not happen.

The RC deliberately does **not** claim: native provider *execution*,
Firefox / WebKit, Linux / macOS, or Node 22 / 24 LTS — those are authored CI
lanes that have not run. Describe the release as *"OBIX core-compatibility
release candidate; native provider execution not yet verified."*
