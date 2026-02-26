# Engineering Spec — `exnulla-demo-blueprint-lottery-fairness-sim`

**Doc type:** implementation-grade engineering spec (no drift)  
**Demo ID / slug:** `lottery-fairness-sim`  
**Tier:** 2 (iframe-isolated static artifact)  
**Target host repo:** `exnulla-demos`  
**Artifact mount point:** `site/public/demos/lottery-fairness-sim/`

---

## 1) Objective

Build a deterministic, auditable simulator demo with two tabs:

- **Mining Cohort (v2)** — deterministic cohort selection
- **Reward Winner (v2)** — deterministic reward winner selection with fairness weighting

**Non-negotiables**

- **Bit-for-bit deterministic outputs given identical inputs** (same seed context + params + candidate/report sets) across modern browsers.
- **Selection math uses integer math / `BigInt`** for all comparisons. Floats may exist only for display.
- **Full-state permalink** (URL encodes demo state) that reproduces results.
- **Auditability**: user can see why entities were rejected, how buckets were scanned, and why the final ordering picked the winner.

---

## 2) Source of truth (must match chain behavior)

This demo must **exactly match** the behavior of the existing selection engines in `the-thesis-chain-main`:

### Mining cohort selection (v2)

- `src/primitives/lottery/mining/engine.ts`
- `src/primitives/lottery/mining/multipliers.ts`
- `src/primitives/lottery/mining/types.ts`
- `src/primitives/lottery/mining/vrf.ts`

### Reward lottery selection (v2)

- `src/primitives/lottery/reward/engine.ts`
- `src/primitives/lottery/reward/weights.ts`
- `src/primitives/lottery/reward/types.ts`
- `src/primitives/lottery/reward/vrf.ts`

### Reference sims (for presets + validation)

- `dev/sims/lottery-v2-mining-sim.ts`
- `dev/sims/lottery-v2-reward-sim.ts`
- `src/l1/miner-lottery/mining-lottery.ts`
- `src/l1/reward-lottery/block-lottery.ts`

**Policy:** do not “re-implement” algorithms from memory. Either **import** the chain code or **vendor** it exactly.

---

## 3) Integration model in ExNulla site

### 3.1 Runtime model

- Demo ships as static assets.
- Shell loads demo via iframe:

```html
<iframe
  src="/demos/lottery-fairness-sim/index.html"
  sandbox="allow-scripts allow-forms"
  loading="lazy"
  referrerpolicy="no-referrer"
></iframe>
```

### 3.2 Directory contract

The built demo artifact must end up at:

```
exnulla-demos/
  site/public/demos/lottery-fairness-sim/
    index.html
    assets/*
    meta.json
```

### 3.3 Provenance

The demo must ship a `meta.json` inside its folder:

```json
{
  "id": "lottery-fairness-sim",
  "title": "Deterministic Lottery + Fairness Simulator",
  "tier": 2,
  "source_repo": "<repo or monorepo path>",
  "source_paths": [
    "the-thesis-chain-main/src/primitives/lottery/mining/*",
    "the-thesis-chain-main/src/primitives/lottery/reward/*"
  ],
  "commit_sha": "<pinned-sha>",
  "built_at": "<iso8601 utc>",
  "tags": ["determinism", "fairness", "lottery", "protocol"]
}
```

If the site already generates `/meta/demos.json`, ensure this demo appears there as well.

---

## 4) Build strategy (no drift)

### 4.1 Preferred: demo as a first-class Vite app inside `exnulla-demos`

Create a demo workspace folder:

```
exnulla-demos/
  demos/
    lottery-fairness-sim/
      package.json
      vite.config.ts
      tsconfig.json
      src/
        main.tsx (or main.ts)
        app/
        core/
        presets/
        state/
        ui/
      public/ (optional)
```

Then add a CI step that:

1. Builds the demo to `demos/lottery-fairness-sim/dist/`
2. Copies `dist/*` to `site/public/demos/lottery-fairness-sim/`
3. Writes `meta.json`

**Rationale:** one repo build = one docker image = one deterministic artifact set.

### 4.2 Chain code consumption (choose one and lock it)

**Option A (recommended if feasible):** add `the-thesis-chain-main` as a git submodule (or CI checkout) at a pinned SHA and import TS sources.

- Location suggestion:
  - `vendor/the-thesis-chain/` (submodule)
- Vite must be configured to allow TS source imports from outside the demo root.

**Option B:** create `demos/lottery-fairness-sim/src/vendor/thesis-chain/` and copy the required modules at a pinned SHA.

- Must include a small `VENDORING.md` noting the pinned SHA and exact copied paths.

**Hard rule:** whichever option you choose, the pinned SHA must be recorded in `meta.json` and in a manifest file (see §11).

---

## 5) Determinism contract (implementation requirements)

### 5.1 Input normalization

Implement the exact rules from the blueprint:

- Lowercase hex strings and strip `0x` prefix:
  - mining `pubkey_hex`
  - reward `proof_hex`
- Strict validation (enabled by params):
  - mining pubkey: `/^[0-9a-f]{64,}$/`
  - reward proof: `/^[0-9a-f]{2,}$/`
- Defaults for missing optional reward factors must match chain defaults:
  - `device_ratio_r = 1.0`
  - `perf_normalizer = 1.0`
  - `uptime_score = 1.0`
  - `tenure_factor = 1.0`
  - `priority_factor = 1.0`

**Implementation detail:** normalization must occur _before_ calling the selection engine so that audit logs reflect the normalized state.

### 5.2 Sorting and tie-break rules

Selection ordering must be explicitly:

1. `metric` ascending
2. `score_int` ascending
3. `wallet_id` lexicographic ascending

The UI must display this rule (static text) and show the first K ordered rows.

### 5.3 BigInt handling

- All BigInt inputs are entered as **base-10 strings** and parsed with `BigInt(str)`.
- BigInt values in state are stored as **strings**.
- Any serialization of BigInt to JSON must be stringified.
- Any selection comparisons must use BigInt.

### 5.4 No nondeterministic randomness

If the UI offers “Generate N candidates/reports”, generation must use a **seeded RNG** with the seed stored in state and permalink.

- Use a small pure JS deterministic PRNG (e.g., `mulberry32`, `xorshift32`) where seed is a uint32 derived from an explicit input string.
- No `Math.random()`.
- No use of current time or locale-specific formatting for values that feed selection.

---

## 6) Application architecture

### 6.1 Tech choices

- Vite
- TypeScript `strict: true`
- UI: **vanilla TS + minimal DOM** is acceptable; React is optional.
  - If React is used: keep dependency footprint minimal; avoid heavy component libs.

### 6.2 Modules and boundaries

**Core rule:** selection engines are pure and testable.

Recommended structure:

```
src/
  core/
    mining.ts          # thin wrapper around chain engine
    reward.ts          # thin wrapper around chain engine
    normalize.ts       # input normalization + validation
    metrics.ts         # helper: compute metric rows for audit tables
    types.ts           # local UI/state types (stringified BigInt)
  state/
    schema.ts          # DemoState + zod-like validators (hand-rolled ok)
    permalink.ts       # encode/decode
    migrate.ts         # schema version migration
  presets/
    mining.ts
    reward.ts
  ui/
    components/*
    pages/*
  main.ts(x)
```

### 6.3 State model

Use the blueprint’s conceptual state, but **BigInt fields stored as strings**.

```ts
type DemoState = {
  version: 1;
  tab: "mining" | "reward";
  mining: {
    ctx: MiningSeedContextV2_S;
    params: MiningParamsV2_S;
    candidates: MiningCandidateV2_S[];
    ui: { showTopK: number; generatorSeed: string };
  };
  reward: {
    ctx: RewardLotteryContext_S;
    params: RewardLotteryParamsV2_S;
    rewardUnits: number;
    reports: RewardWorkReportV2_S[];
    ui: { showTopK: number; generatorSeed: string };
  };
};
```

Where `*_S` indicates “stringified BigInt” types.

### 6.4 Permalink encoding

**Requirement:** permalink encodes full `DemoState`.

- Encode format: `#s=<payload>` (hash fragment preferred to avoid server involvement)
- Payload: JSON → UTF-8 → gzip/deflate (optional) → base64url
- Stability requirements:
  - stable array ordering
  - stable key ordering (either canonical stringifier or explicit struct serialization)

**Recommendation:** implement a canonical serializer:

- write objects in a fixed key order
- write arrays as-is

### 6.5 Import / export JSON

Provide:

- **Export State JSON** (exact `DemoState`)
- **Import State JSON** (validate schema; migrate old versions)

Also provide **Export Output JSON** (see §9).

---

## 7) UI specification (implementation-level)

### 7.1 Global layout

Top bar:

- Title: “Deterministic Lottery + Fairness Simulator”
- Buttons:
  - **Presets** (dropdown)
  - **Reset** (restore default preset for active tab)
  - **Copy Permalink** (writes URL with encoded state)

Main content:

- Tabs: **Mining Cohort (v2)**, **Reward Winner (v2)**
- 3-column layout on desktop:
  - Left: Inputs
  - Center: Run + Output
  - Right: Audit trail
- Mobile: stack columns vertically.

### 7.2 Mining tab

#### Inputs

- Seed context inputs:
  - `domain_tag` (string)
  - `scope_tag` (string)
  - `extra_tag` (string optional)
  - `epoch_id` (decimal → BigInt string)
  - `slot_index` (decimal → BigInt string)
  - `prev_hash_hex` (hex)

- Params inputs:
  - `pool_floor` (int)
  - `max_bucket_scan` (int)
  - `strict_pubkey` (bool)
  - cohort thresholds:
    - `cohort_small_max`, `cohort_medium_max`
    - `cohort_small_size`, `cohort_medium_size`, `cohort_large_size`

- Candidates editor:
  - Generate N candidates:
    - N input
    - uses seeded RNG (seed in `mining.ui.generatorSeed`)
  - Import/Export JSON
  - Table:
    - `wallet_id`, `pubkey_hex`, `eligible`, `wins_bucket`

#### Run + Output

- Button: **Run Deterministic Selection**
- Output card:
  - `baseBucket`
  - `included_buckets[]`
  - `cohort_size`
  - `cohort_wallet_ids[]` (ordered)
  - multipliers summary

#### Audit

- Rejections list (wallet_id → reason)
- Bucket scan trace (bucket → count → running total → stop reason)
- Deterministic ordering preview (top K rows):
  - wallet_id
  - score_hex
  - score_int (decimal)
  - multiplier
  - metric (score_int / multiplier)
  - plus explicit tie-break rule text

### 7.3 Reward tab

#### Inputs

- Context:
  - `line` enum
  - `region_id` optional
  - `epoch_id`, `slot_index`, `block_height` decimal BigInt strings
  - `prev_hash_hex` hex
  - `domain_tag` optional

- Params:
  - `reverse_a`, `reverse_b`, `reverse_floor`
  - `scale` (decimal BigInt string)
  - `enforce_work_cap` bool
  - `min_weight_scaled` (decimal BigInt string)
  - `miner_share_bps`, `bot_share_bps`
  - `strict_proof_hex` bool

- Work reports editor:
  - Generate N reports (seed in `reward.ui.generatorSeed`)
  - Import/Export JSON
  - Table fields:
    - wallet_id
    - work_assigned
    - work_completed
    - redundancy_confirmed
    - proof_hex
    - device_ratio_r
    - perf_normalizer
    - uptime_score
    - tenure_factor
    - priority_factor

- Reward units input

#### Run + Output

- Button: **Run Deterministic Winner**
- Output card:
  - winner wallet_id
  - reward_units
  - miner/bot split
  - winner score_hex
  - winner weight_scaled

#### Audit

- Events list (including rejection events)
- Fairness breakdown for top K:
  - effective_work
  - reverse_weight
  - weight_float (display)
  - weight_scaled
  - metric

---

## 8) Presets (must ship)

Implement presets exactly as blueprint specifies.

### 8.1 Mining presets

1. Normal day
2. Under-filled pool
3. Malformed + strict
4. Tie-break demo

### 8.2 Reward presets

1. Fairness penalty (device dominance)
2. Redundancy failure
3. Work cap enforcement
4. Invalid proof (strict)

**Preset requirements**

- Each preset is fully deterministic.
- Each preset is valid against schema.
- Preset selection updates state and permalink.

---

## 9) Output artifacts (copyable JSON)

Provide download/copy for:

- Mining output: `MiningSelectionV2` (exact engine output)
- Reward output: `RewardLotterySelectionV2` (exact engine output)

Additionally provide a derived “explain” JSON (not authoritative) that includes:

- bucket scan trace
- multiplier map
- ordered top K rows with computed fields used for audit

**Rule:** the authoritative outputs must remain raw engine outputs.

---

## 10) Performance requirements

- Mining: supports **10,000** candidates
- Reward: supports **5,000** reports

UI constraints:

- Use table virtualization for large lists (or paging) to avoid DOM blow-ups.
- Keep audit “top K” default low (e.g., 25) with user control.

---

## 11) Repo wiring + manifests

### 11.1 Demo manifest entry

If the repo uses `demos/manifest.json`, add:

```json
{
  "lottery-fairness-sim": {
    "type": "in-repo",
    "path": "demos/lottery-fairness-sim",
    "build": "npm ci && npm run build",
    "outDir": "dist",
    "artifactTarget": "site/public/demos/lottery-fairness-sim"
  }
}
```

### 11.2 Pinning the chain SHA

Create `demos/lottery-fairness-sim/CHAIN_PIN.json`:

```json
{
  "repo": "the-thesis-chain-main",
  "sha": "<PINNED_COMMIT_SHA>",
  "paths": ["src/primitives/lottery/mining", "src/primitives/lottery/reward"]
}
```

The build must fail if this file is missing or `sha` is empty.

---

## 12) CI / Docker build hooks (acceptance-level)

### 12.1 CI steps

Add a pipeline step (prior to `astro build`) that:

1. Installs demo deps
2. Builds demo
3. Copies demo `dist/` to `site/public/demos/lottery-fairness-sim/`
4. Writes demo `meta.json`

### 12.2 Docker

The Docker build must include the demo artifact folder in the final image.

- No runtime build on droplet.
- Demo artifact must be present in `runtime` stage.

### 12.3 Runtime gate

If repo has a “docker runtime gate” workflow, add a curl check:

- `GET /demos/lottery-fairness-sim/index.html` returns 200
- `GET /demos/lottery-fairness-sim/meta.json` returns 200

---

## 13) Testing plan

### 13.1 Determinism acceptance tests (required)

For each preset:

1. Run preset → Copy permalink
2. Open permalink in a private window
3. Click Run
4. Outputs must match **byte-for-byte** (compare exported JSON)

Also:

- Export State JSON → Import State JSON → Run → outputs identical

### 13.2 Correctness tests (must match chain)

Create a small test harness that runs the same inputs through:

- the demo’s imported/vendored engine
- the reference sim data (from chain repo)

Expected: engine output matches exactly.

### 13.3 Edge cases

- Mining empty candidates
- Mining all rejected
- Reward all rejected

UI must show:

- `ok:false` conditions
- clear rejection reasons/events

---

## 14) Security / sandbox

- Default iframe sandbox: `allow-scripts allow-forms`
- Do **not** request `allow-same-origin` unless an explicit technical blocker is found.
- Demo must not reach outside iframe (no parent DOM access).

---

## 15) Delivery checklist

- [ ] Demo builds via `npm run build` producing `dist/index.html`
- [ ] Artifacts copied to `site/public/demos/lottery-fairness-sim/`
- [ ] `meta.json` written and includes pinned SHAs
- [ ] Permalink reproduces state + output
- [ ] Presets present (8 total)
- [ ] Audit views show bucket scan + tie-break + fairness breakdown
- [ ] Handles 10k/5k with acceptable responsiveness
- [ ] CI runtime gate passes for `/demos/lottery-fairness-sim/*`

---

## Appendix A — Canonical UI copy (for consistency)

- Mining metric: `metric = score_int / multiplier`
- Reward metric: `metric = score_int / weight_scaled`
- Tie-break: `metric → score_int → wallet_id`
