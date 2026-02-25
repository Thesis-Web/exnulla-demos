# ExNulla Demo Engineering Spec

## Intent-Driven File Router Simulator (TARGET Header Workflow)

**Spec ID:** `exnulla-demo-intent-file-router-1.0.0`  
**Tier:** 2 (independent static demo embedded via iframe)  
**Shell host:** ExNulla Site (Astro)  
**Demo slug:** `/lab/intent-file-router`  
**Demo static path:** `/demos/intent-file-router/`  
**Primary alignment sources:**
- `docs/exnulla-demo-blueprint-intent-file-router.md` (behavior + UX blueprint)
- `docs/engineering-specs-1-0-1.md` (site architecture + demo tier rules)

---

## 0) Scope and non-goals

### In scope
- A client-side simulator that:
  - parses a line-1 `TARGET` header in **3 comment syntaxes**
  - validates repo keys + paths with safety rules
  - strips the header and normalizes payload
  - emits a deterministic route plan (dry-run)
  - renders a 3-pane UX (Input / Router Output / Audit+Diff)
  - includes a “repo hygiene guard” mini-panel simulation
- Build and integration into `exnulla-site` so the demo is served under `/demos/intent-file-router/` and embedded via `/lab/intent-file-router`.
- Table-driven unit tests for parser + validator + payload builder + determinism.

### Explicit non-goals
- No real SSH/SCP, no network, no filesystem writes outside browser memory.
- No loading arbitrary user files beyond a small capped text input.
- No auth, no persistence, no backend dependency.

---

## 1) Product requirements

### 1.1 Core behavior (must match blueprint intent)
1. **Explicit opt-in**: routable only if line 1 is a supported `TARGET` header.
2. **Header stripping**: routing metadata never lands in payload.
3. **Deterministic output**: same inputs → same `(repoKey, pathInRepo, payloadSha, dest)`.
4. **Safety defaults**:
   - refuse binary content (null byte heuristic)
   - denylist certain extensions (config)
   - refuse unknown repo keys
   - refuse invalid paths (empty, absolute, traversal)
   - support conflict and after policies (display-only)
5. **Repo hygiene guard**: detect and flag line-1 TARGET headers (simulated scan input).

### 1.2 UX requirements
- Three-pane layout:
  - **Input**: filename, contents textarea, toggles, example loader.
  - **Router Output**: parsed header, destination preview, action plan steps.
  - **Audit + Diff**: audit timeline + header-stripped preview.
- “Wow” affordances:
  - determinism badge showing `payload_sha256` and `route_id`
  - shareable permalink encoding *example id + toggles + filename* (not full content)

### 1.3 Accessibility
- Keyboard reachable controls.
- Visible focus states.
- `aria-live="polite"` for validation summaries.
- No color-only signaling (add icons/labels).

### 1.4 Performance
- Hard cap input size: **256 KiB** (post-normalization).
- Rendering must remain responsive for max input (avoid expensive diffing; show line previews only).
- All computation in main thread is acceptable; keep operations linear-time.

### 1.5 Security
- Strictly local execution.
- No `eval`.
- No external network calls.
- Iframe sandbox in host shell: `allow-scripts allow-same-origin` only.

---

## 2) Repository / directory layout

### 2.1 Target layout inside `exnulla-site`

```
exnulla-site/
  demos/
    intent-file-router/
      package.json
      vite.config.ts
      index.html
      src/
        main.tsx
        app/
          App.tsx
          state.ts
          routes/
            core.ts
            parse.ts
            validate.ts
            payload.ts
            plan.ts
            determinism.ts
          samples/
            samples.ts
          components/
            InputPane.tsx
            OutputPane.tsx
            AuditDiffPane.tsx
            ExampleSelector.tsx
            ToggleRow.tsx
            IssueList.tsx
            StepsList.tsx
            PreviewBlock.tsx
            Badge.tsx
            HygieneGuardPanel.tsx
          styles/
            base.css
        meta/
          meta.template.json
      public/
        meta.json          (generated at build time)
      dist/                (build output)
      tests/
        parse.test.ts
        validate.test.ts
        payload.test.ts
        plan.test.ts
        determinism.test.ts
```

Notes:
- Demo can be React or vanilla TS; React is recommended for clean pane composition.
- Styling: plain CSS (no dependency on Tailwind required). Keep it deterministic.

### 2.2 Host shell integration

```
site/src/pages/lab/intent-file-router.astro
site/public/demos/intent-file-router/   (copied from demo dist during build)
```

The lab page should embed:
- an iframe pointing to `/demos/intent-file-router/index.html`
- a small metadata card that reads `/demos/intent-file-router/meta.json`

---

## 3) Configuration (demo-local)

### 3.1 Repo map (display-only)
Hardcode a map mirroring real script keys:

```ts
export const REPO_MAP: Record<string, string> = {
  backend: "/home/deploy/repos/thesisweb-backend",
  frontend: "/home/deploy/repos/thesis-web-com-site",
  protocol: "/home/deploy/repos/the-thesis-chain-protocol",
  architecture: "/home/deploy/repos/the-thesis-project-architecture",
  devkit: "/home/deploy/repos/the-thesis-chain-ai-devkit",
  sims: "/home/deploy/repos/the-thesis-chain-test",
  portfolio: "/home/deploy/repos/thesis-portfolio",
};
```

### 3.2 Denylist extensions
Default denylist (case-insensitive):

```
.exe .msi .zip .7z .rar .3mf .stl .png .jpg .jpeg .gif .mp4 .mov .pdf
```

Allow users to “force treat as binary/media” for demonstration only; forced binary must still refuse routing.

### 3.3 Policies
Represent policies as enums:
- `conflictPolicy`: `overwrite | skip` (default: `skip`)
- `afterPolicy`: `move | delete | keep` (default: `keep`)

---

## 4) Data model

### 4.1 Types

```ts
export type HeaderFormat = "slash" | "hash" | "html";

export type TargetSpec = {
  repoKey: string;
  pathInRepo: string;
  raw: string;          // original header remainder (after TARGET:)
  format: HeaderFormat;
  line1: string;        // full original line 1
};

export type ValidationSeverity = "error" | "warn";

export type ValidationIssue = {
  severity: ValidationSeverity;
  code:
    | "NO_TARGET"
    | "TARGET_NOT_LINE1"
    | "UNKNOWN_REPO_KEY"
    | "EMPTY_PATH"
    | "ABSOLUTE_PATH"
    | "PATH_TRAVERSAL"
    | "BACKSLASH_IN_PATH"
    | "BINARY_DETECTED"
    | "DENYLIST_EXTENSION"
    | "INPUT_TOO_LARGE";
  message: string;
  hint?: string;
};

export type StepKind = "mkdir" | "upload" | "skip" | "post";

export type PlanStep = {
  kind: StepKind;
  command: string;
  notes?: string;
};

export type RoutePlan = {
  remoteRepoRoot: string;
  remoteDest: string;
  remoteDir: string;
  conflictPolicy: "overwrite" | "skip";
  afterPolicy: "move" | "delete" | "keep";
  steps: PlanStep[];
};

export type AuditEvent = {
  ts: number; // ms epoch
  event:
    | "input_received"
    | "normalized"
    | "header_parsed"
    | "validated"
    | "payload_built"
    | "route_computed"
    | "plan_emitted";
  details?: Record<string, unknown>;
};
```

### 4.2 App state

```ts
export type AppState = {
  filename: string;
  content: string;
  normalizeCrlf: boolean;
  forceBinary: boolean;
  conflictPolicy: "overwrite" | "skip";
  afterPolicy: "move" | "delete" | "keep";

  targetSpec: TargetSpec | null;
  payload: string;
  issues: ValidationIssue[];
  plan: RoutePlan | null;
  audit: AuditEvent[];

  payloadSha256Hex: string | null;
  routeId: string | null; // stable id derived from repoKey+path+sha
};
```

---

## 5) Algorithms and rules

### 5.1 Normalization
- If `normalizeCrlf`:
  - replace `\r\n` with `\n`
  - also strip trailing `\r` at end-of-line
- Preserve original for preview but compute payload and sha from normalized.

### 5.2 Binary detection
- If `forceBinary` is set: treat as binary.
- Else: if normalized content contains `\x00` (null byte) → binary.
- Binary inputs are **not routable** and must emit `BINARY_DETECTED` error.

### 5.3 Header parsing (line 1 only)

Supported line-1 forms:
- `// TARGET: <repo_key> <path>`
- `# TARGET: <repo_key> <path>`
- `<!-- TARGET: <repo_key> <path> -->`

Parsing steps:
1. Determine `line1` = first line of normalized content (split on `\n`).
2. Try match regexes (in order):
   - `^\s*//\s*TARGET:\s+(.+)$`
   - `^\s*#\s*TARGET:\s+(.+)$`
   - `^\s*<!--\s*TARGET:\s+(.+?)\s*-->\s*$`
3. If no match → return `null` (emit `NO_TARGET` error only when user presses Simulate).
4. If match:
   - `raw` = captured remainder
   - `repoKey` = first whitespace-delimited token of `raw`
   - `pathInRepo` = remaining text trimmed

Important: do **not** attempt to parse TARGET beyond line 1.

### 5.4 Path validation
Rules:
- empty → `EMPTY_PATH` error
- begins with `/` → `ABSOLUTE_PATH` error
- contains `..` as a segment (split on `/`) → `PATH_TRAVERSAL` error
- contains `\` → normalize to `/` and emit `BACKSLASH_IN_PATH` warn **or** refuse; choose one policy and keep tests consistent.
  - Recommended: normalize + warn (more user-friendly).

### 5.5 Filename denylist
- Extension check uses `filename` input.
- If extension in denylist → `DENYLIST_EXTENSION` error.

### 5.6 Payload build
- Payload is content with line 1 removed.
  - If content is a single line only, payload is empty string.
- Preserve exact payload bytes as the post-normalization remainder.

### 5.7 Route plan computation
Given `TargetSpec` and policies:
- `remoteRepoRoot = REPO_MAP[repoKey]`
- `remoteDest = remoteRepoRoot + "/" + pathInRepo`
- `remoteDir = remoteDest up to last '/'` (if none, remoteRepoRoot)

Steps (dry-run display):
1. `mkdir -p <remoteDir>`
2. Upload step:
   - If `conflictPolicy=skip`: show `scp <payload> <remoteDest>  # if missing` and note that existing dest would skip.
   - If `overwrite`: show `scp <payload> <remoteDest>  # overwrite`.
3. Post step:
   - keep: `# keep local input`
   - delete: `rm <local>` (simulated)
   - move: `mv <local> <local_routed_dir>` (simulated)

### 5.8 Determinism outputs
Compute:
- `payloadSha256Hex` using Web Crypto (`crypto.subtle.digest('SHA-256', ...)`) over UTF-8 bytes of payload.
- `routeId = sha256("${repoKey}|${pathInRepo}|${payloadSha256Hex}")` (hex).

Show a badge:
- `payload_sha256: <first12>…`
- `route_id: <first12>…`

---

## 6) UI composition

### 6.1 Pane responsibilities

#### InputPane
- Inputs:
  - filename (default: `draft.md`)
  - textarea for content
  - toggles: normalize CRLF, force binary
  - selects: conflictPolicy, afterPolicy
  - buttons: Simulate Route, Reset, Load Example
- Behavior:
  - Simulate triggers the full pipeline and populates Output/Audit.
  - Content edits should *not* auto-run simulation (avoid expensive loops); optionally add “Auto-simulate” toggle off by default.

#### OutputPane
- Displays:
  - parsed header summary or parse failure
  - destination preview (repo root + full dest)
  - steps list (commands)
  - issues list (errors/warnings)

#### AuditDiffPane
- Audit timeline list (most recent last)
- Preview blocks:
  - Original first 5 lines
  - Payload first 5 lines
  - Highlight that line 1 was removed (use a small callout)

#### HygieneGuardPanel
- Explains: “no-target-headers.sh fails commits if TARGET is present on line 1.”
- Provides a simulated scan:
  - textarea where each line is `path | first_line`
  - parse and flag any line where first_line matches a TARGET header

### 6.2 Error display rules
- If any `error` severity issues exist:
  - do not render a plan
  - still render parsed info if available
- Warnings do not block plan.

### 6.3 Visual constraints
- Use CSS grid:
  - desktop: 3 columns
  - narrow screens: stack panes
- Keep typography consistent with ExNulla site (neutral fonts, readable size).

---

## 7) Example set (must ship)

Implement `samples.ts` exporting `Sample[]`:

```ts
export type Sample = {
  id: string;
  label: string;
  filename: string;
  content: string;
  expectRoutable: boolean;
};
```

Required samples:
- valid JS comment header
- valid HTML comment header routing JSON
- invalid: TARGET not on line 1
- invalid: unknown repo key
- invalid: path traversal
- invalid: denied extension (e.g. `clip.mp4`)

---

## 8) Test plan (table-driven)

### 8.1 Parser tests (`parse.test.ts`)
Cases:
- each header format parses correctly
- whitespace tolerance (leading spaces)
- CRLF line ending on header line
- no target returns null
- target not on line 1 returns null (and validation path for TARGET_NOT_LINE1 is handled at UX/sample level if you choose to detect it)

### 8.2 Validation tests (`validate.test.ts`)
Cases:
- unknown repo key
- empty path
- absolute path
- traversal (`../` and `/../` segments)
- backslash path normalization emits warn
- denylisted extension
- binary detection
- size cap (257KiB)

### 8.3 Payload tests (`payload.test.ts`)
- line 1 removal
- single-line file → empty payload
- CRLF normalized

### 8.4 Plan tests (`plan.test.ts`)
- correct remoteDest/remoteDir
- step rendering differs by conflictPolicy + afterPolicy

### 8.5 Determinism tests (`determinism.test.ts`)
- stable `payloadSha` for same payload
- stable `routeId` for same tuple

---

## 9) Build + integration

### 9.1 Demo build (Vite)
- `npm run build` outputs `dist/`.
- Ensure assets are relative paths (Vite default).
- Base path:
  - set Vite `base: '/demos/intent-file-router/'` for correct hosting under the site.

### 9.2 Meta stamping
At demo build, generate `/demos/intent-file-router/dist/meta.json` with:

```json
{
  "name": "Intent-Driven File Router",
  "slug": "intent-file-router",
  "tier": 2,
  "source_repo": "dev-tools-main",
  "source_paths": ["thesis-sync.sh", "scripts/no-target-headers.sh", "README.md"],
  "commit_sha": "<from build arg or unknown>",
  "build_timestamp_utc": "<ISO-8601>ებულ"
}
```

Implementation notes:
- For determinism, prefer an env-injected `GIT_SHA` (same pattern as site provenance).
- If not available, set `commit_sha` to `unknown`.

### 9.3 Copy into Astro public
Add a root orchestration step (preferred):
- `npm run build` at repo root should:
  1. build site
  2. build demos
  3. copy demo dist to `site/public/demos/intent-file-router/`

Copy rule:
- `site/public/demos/intent-file-router/**` replaced atomically within build output.

### 9.4 Lab page
Create `site/src/pages/lab/intent-file-router.astro`:
- Title, short hook, and embed runner:
  - iframe `src="/demos/intent-file-router/"`
  - include a small “Meta” section that fetches and renders `meta.json`

---

## 10) Acceptance criteria

### Correctness
- Each supported header format parses **only** when on line 1.
- Header stripping: payload begins at original line 2.
- Route computation uses `REPO_MAP[repoKey] + '/' + pathInRepo`.
- Denied/binary inputs are refused with explicit reason codes.

### Explainability
- Audit log shows the full pipeline steps.
- Original vs Payload preview makes header removal obvious.

### Determinism
- Badge shows stable hashes.
- Re-running Simulate Route without input change yields identical output.

### Integration
- Demo is served at `/demos/intent-file-router/`.
- Lab page `/lab/intent-file-router` embeds demo via iframe.
- Demo does not impact landing bundle size (Tier 2 isolation).

---

## 11) Implementation notes / edge cases

- **TARGET not on line 1**: by strict spec, file is not routable; do not attempt to “helpfully” search other lines.
- **Backslash paths**: normalize and warn so Windows users can still demo.
- **Huge inputs**: fail fast before parsing to avoid memory churn.
- **Preview**: do not compute full diffs; show top N lines (default N=5, optionally adjustable).

---

## 12) Delivery checklist

- [ ] Demo source added under `demos/intent-file-router/`.
- [ ] Unit tests added and passing.
- [ ] Root build copies demo dist to `site/public/demos/intent-file-router/`.
- [ ] Lab page created and linked from `/lab` index tile list.
- [ ] `meta.json` generated with commit SHA (when provided) and build timestamp.
- [ ] CI runs format/lint/build and does not regress shell performance.
