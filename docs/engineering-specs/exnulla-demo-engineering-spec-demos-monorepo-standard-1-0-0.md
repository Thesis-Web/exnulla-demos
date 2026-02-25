# Engineering Spec — `exnulla-demos` Monorepo Standard (Tier‑2 Static Demos)
**Project:** ExNulla / ThesisWeb  
**Version:** 1.0.0  
**Purpose:** Establish a senior-grade, scalable monorepo for all Tier‑2 iframe demos while keeping `exnulla-site` as the single deploy unit and preserving deterministic builds (pinned SHAs, reproducible artifacts, CI gates, Docker compatibility, atomic deploy).

---

## 0) Outcomes (acceptance-level)

When this spec is implemented:

- All demos live in **one repo**: `Thesis-Web/exnulla-demos`
- Each demo builds to a **static artifact** directory containing `index.html`.
- `exnulla-site` pulls demos via its existing **Model A** integration:
  - `demos/manifest.json` pins a commit SHA in `exnulla-demos`
  - `scripts/demos-sync.mjs` checks out that SHA, builds, copies per-demo `dist/` into `site/public/demos/<slug>/`
  - `scripts/generate-demos-meta.mjs` emits `/meta/demos.json`
- CI gates:
  - the demos monorepo has its own CI (format/typecheck/test/build)
  - `exnulla-site` CI fails if it cannot build the pinned demos commit
- Docker runtime gate on `exnulla-site` verifies:
  - `/meta/demos.json` exists
  - `/demos/<slug>/index.html` returns 200 for enabled demos
- Atomic deploy on the droplet remains **unchanged** (one static site artifact deploy).

---

## 1) Repository decision: tooling baseline

### 1.1 Package manager (locked)
Use **pnpm** + workspaces.

**Rationale (senior posture):**
- fast installs; content-addressed store reduces CI time
- deterministic lockfile (`pnpm-lock.yaml`)
- strong workspace support

### 1.2 Task runner (locked)
Use **Turborepo** for caching and pipeline discipline.

**Rationale:**
- build/test/lint caching across apps
- scalable to 6+ demos without CI bloat

---

## 2) `exnulla-demos` repo layout (authoritative)

```
exnulla-demos/
  apps/
    identity-without-disclosure/
    intent-file-router/
    lottery-fairness-sim/
    orbital-node-sizing-50kw/
    safe-agent-pipeline/
    micro-backend-showcase/
  packages/
    ui/              (optional shared components; keep minimal)
    core-sim/        (optional shared deterministic primitives)
  .github/workflows/
    ci.yml
  .editorconfig
  .gitignore
  package.json
  pnpm-workspace.yaml
  pnpm-lock.yaml
  turbo.json
  prettier.config.cjs
  tsconfig.base.json
  docs/
    demos/           (optional internal docs)
```

### 2.1 Demo app constraints
Each `apps/<slug>/` must:
- build to `apps/<slug>/dist/`
- include `dist/index.html`
- include a `public/meta.json` (optional but recommended)
- be runnable in dev with `pnpm dev --filter <slug>`

---

## 3) Per-demo contract

### 3.1 Required `package.json` scripts (per app)
Each demo app must implement:

- `dev` — local dev server
- `build` — builds to `dist/`
- `preview` — serves built output (optional but recommended)
- `test` — runs unit tests (required if demo contains logic; may be no-op for pure static pages)
- `typecheck` — TS compile check (if TS is used)
- `format:check` — should be inherited from root (see §4), but app may also expose it

**Expected stack:**
- Vite + React + TS (default)
- Plain Vite + TS (allowed)
- Astro inside demo (discouraged; keep shell as `exnulla-site`)

### 3.2 Artifact rules
- Assets should be hashed (Vite default) to allow caching.
- All URLs must resolve under `/demos/<slug>/` when embedded.
  - Use relative links or set `base: "./"` in Vite config.

**Vite requirement (critical):**
Set base to relative to avoid absolute `/assets` links:

```ts
// vite.config.ts
export default defineConfig({
  base: "./",
  build: { outDir: "dist" }
});
```

---

## 4) Root repo configuration

### 4.1 `pnpm-workspace.yaml` (required)
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### 4.2 Root `package.json` (authoritative)
Root scripts must enforce formatting and runnable pipelines.

```json
{
  "name": "exnulla-demos",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "scripts": {
    "format": "prettier . --write",
    "format:check": "prettier . --check",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "build": "turbo run build",
    "ci:gate": "pnpm format:check && pnpm typecheck && pnpm test && pnpm build"
  },
  "devDependencies": {
    "prettier": "^3.0.0",
    "turbo": "^2.0.0",
    "typescript": "^5.0.0"
  }
}
```

### 4.3 `turbo.json` (authoritative)
```json
{
  "pipeline": {
    "typecheck": { "dependsOn": ["^typecheck"], "outputs": [] },
    "test": { "dependsOn": ["^test"], "outputs": [] },
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] }
  }
}
```

### 4.4 Shared TS config
`tsconfig.base.json` at root; apps extend it.

---

## 5) CI in `exnulla-demos` (required)

### 5.1 `.github/workflows/ci.yml`
Workflow goals:
- deterministic install (`pnpm install --frozen-lockfile`)
- run `pnpm ci:gate`
- cache pnpm store and turbo cache
- run on PRs + main pushes

Minimum required steps:
- checkout
- setup Node 20
- setup pnpm
- install
- `pnpm ci:gate`

---

## 6) How `exnulla-site` consumes the monorepo

### 6.1 Manifest entries in `exnulla-site/demos/manifest.json`
Each demo points to the same `repo` and pinned `ref` commit (the monorepo SHA), but with different `outDir` and `build2`.

**Option 1 (simple): build all demos once**
- `build2: ["pnpm", "build"]`
- `outDir: "apps/<slug>/dist"`

Pros: simplest, uses turbo caching  
Cons: building all demos even if only one is enabled (acceptable)

**Option 2 (targeted): build one demo**
- `build2: ["pnpm", "build", "--filter", "<slug>"]`
- same `outDir`

Pros: faster if few demos enabled  
Cons: needs careful filter naming

**Recommendation:** Option 1 for v1 (simplicity, fewer edge cases).

Example entry:

```json
"identity-without-disclosure": {
  "repo": "Thesis-Web/exnulla-demos",
  "ref": "40_HEX_SHA_PINNED",
  "build": ["pnpm", "install", "--frozen-lockfile"],
  "build2": ["pnpm", "build"],
  "outDir": "apps/identity-without-disclosure/dist",
  "enabled": true,
  "tier": 2,
  "iframe": { "sandbox": "allow-scripts allow-forms", "allowSameOrigin": false },
  "budgets": { "maxGzipBytes": 3145728 }
}
```

### 6.2 Required change to `scripts/demos-sync.mjs` (exnulla-site)
The existing skeleton assumed `npm ci` and `npm run build`. It must support:
- pnpm
- a monorepo build that outputs multiple app `dist/` directories

**Contract:** `demos-sync.mjs` builds each **unique** `(repo, ref)` once per run, then copies each enabled demo’s `outDir`.

#### Implementation details
- Group demos by `repo@ref`.
- For each group:
  - clone/fetch/checkout once
  - run `build` and `build2` once (root of repo)
- For each demo in group:
  - verify `outDir/index.html`
  - rsync/copy to `site/public/demos/<slug>/`

This prevents rebuilding the monorepo 6 times.

**Pseudo:**
```js
// group key = `${repo}@${ref}`
for group in groups:
  prepare repoDir
  run group.build
  run group.build2
  for demo in group.demos:
    verify repoDir/demo.outDir/index.html
    copy to site/public/demos/<slug>/
```

### 6.3 Cache directory structure
Use:
- `.cache/demos/<repoSlug>/<ref>/` to avoid collisions and support multiple pinned SHAs

Example:
- `.cache/demos/exnulla-demos/0123abcd.../`

---

## 7) Docker + atomic deploy impacts (exnulla-site)

No changes to Docker or atomic deploy model are required *as long as*:
- demo sync + meta generation happen before `astro build` in CI/deploy workflow
- the built `site/dist` includes `/demos/**` and `/meta/demos.json`

The deploy unit remains the site artifact.

---

## 8) Micro-backend demo constraint (the one special demo)

`apps/micro-backend-showcase` is allowed in the monorepo with one strict rule:
- The demo must support `mode=mock` so the static artifact works with **no server**.

### 8.1 Runtime API configuration
Use query param or env substitution at build time:

- Query param: `?mode=live&api=/api`
- Default: `mode=mock`

For `mode=live`, it should call `/api/...` relative to origin so it works behind Nginx rewrites.

---

## 9) Senior-grade governance

### 9.1 Versioning and provenance
- The demos monorepo uses commit SHA pinning (no floating branches).
- Optionally add tags `demo-pack/v1.0.0` for human readability (pin still uses SHA).

### 9.2 Code ownership (recommended)
Add `CODEOWNERS` in `exnulla-demos`:
- each app owned by a person/team
- shared packages owned by core maintainer

### 9.3 Dependabot / Renovate (optional)
To keep the monorepo healthy.

---

## 10) Acceptance tests checklist

### 10.1 In `exnulla-demos`
- `pnpm ci:gate` passes on PR
- `pnpm build` generates `apps/*/dist/index.html`

### 10.2 In `exnulla-site`
- `node scripts/demos-sync.mjs`:
  - clones `exnulla-demos`
  - checks out pinned `ref`
  - runs `pnpm install` + `pnpm build`
  - copies each enabled demo into `site/public/demos/<slug>/`
- `node scripts/generate-demos-meta.mjs` emits `/meta/demos.json`
- Docker runtime serves:
  - `/meta/demos.json` (200)
  - `/demos/<slug>/index.html` (200)

### 10.3 Production smoke
- lab runner loads each demo in iframe
- iframe sandbox excludes `allow-same-origin` unless explicitly allowed per demo

---

## 11) Implementation order (do this in sequence)

1. Create `exnulla-demos` repo with pnpm + turbo baseline config.
2. Add one pilot app (start with `identity-without-disclosure`) and get `pnpm build` producing `dist/`.
3. Add the remaining demo apps (thin scaffolds OK; placeholders allowed initially).
4. Add CI workflow in `exnulla-demos`.
5. Update `exnulla-site/demos/manifest.json` to point demos to `exnulla-demos` and pinned SHA.
6. Update `exnulla-site/scripts/demos-sync.mjs` to group by repo@ref and support pnpm.
7. Validate exnulla-site CI + docker gate + atomic deploy.

---

## 12) Notes: when to split back into separate repos

Split a demo out only if:
- it needs a materially different build toolchain (native deps, non-node builds)
- it has independent publishing/lifecycle requirements
- it has sensitive access controls that shouldn’t live alongside other demos

Otherwise the monorepo is the correct long-term posture.
