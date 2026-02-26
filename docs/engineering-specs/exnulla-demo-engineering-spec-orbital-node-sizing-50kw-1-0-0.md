# ExNulla Demo Engineering Spec — Orbital Compute Node Sizing Sandbox (Class S 50 kW) — v1.0.0

**Spec ID:** `exnulla-demo-engineering-spec-orbital-node-sizing-1-0-0`  
**Implements blueprint:** `docs/exnulla-demo-blueprint-orbital-node-sizing-50kw.md`  
**Demo ID:** `orbital-node-sizing-50kw`  
**Tier:** Lab Tier 2 (static-built mini-app → iframe embed)  
**Primary reference repo:** `space-server-heat-dissipation-main` (docs-only references; no runtime coupling)

---

## 1) Objective

Deliver an **interactive, deterministic sizing sandbox** for a **Class S 50 kW orbital compute node**. The demo must:

- Let a user vary a small set of compute + thermal inputs.
- Produce **repeatable** outputs (no randomness, no hidden state).
- Present a **clear PASS/OVER** verdict against a fixed 50 kW bus.
- Provide an **order-of-magnitude radiator area estimate** using a single effective temperature.
- Remain **static-only**: no backend calls, no secrets, no telemetry keys.

This is a _portfolio demo_, not a flight design tool.

---

## 2) Constraints and non-goals

### 2.1 Hard constraints

- **Static artifact**: output is a self-contained build (HTML/CSS/JS assets) embedded in the Astro site via iframe.
- **No network dependencies at runtime** other than loading the demo’s own assets.
- **No secrets**: do not include API keys, tokens, endpoints, or internal hostnames.
- **Deterministic math**: identical inputs → identical outputs.
- **Fast**: recompute on input change with no noticeable delay (<16ms typical).

### 2.2 Explicit non-goals (v1)

- Detailed thermal modeling (multi-node, transient, conduction paths, view factors, shadowing).
- Attitude/orbit/seasonal power simulations.
- Mission-specific constraints (launch vehicle, exact deployment mechanism).
- Any real operational data or coupling to production backend systems.

---

## 3) Deliverables

### 3.1 Repo deliverables (ExNulla Site)

Add a new demo package at:

```
site/src/demos/orbital-node-sizing-50kw/
  meta.json
  index.html
  assets/
    app.css
    app.js
    zone-diagram.svg
    favicon.svg (optional)
```

Plus an Astro page embedding it (or a route entry depending on current demo system):

```
site/src/pages/lab/orbital-node-sizing.astro
```

### 3.2 Required UI outputs

- **Verdict**: PASS / OVER vs 50 kW bus
- **Compute payload (kW)**
- **Overhead (kW)**
- **Node total (kW)**
- **Radiator area (m²)**
- **Area per kW (m²/kW)**
- **Constraint classification**: “likely array-limited” vs “radiator likely significant”
- **Trim suggestions** when OVER (deterministic suggestions only)

---

## 4) Information architecture

### 4.1 Routing + embed

- The Astro site links to a page `/lab/orbital-node-sizing/` (or nearest existing convention).
- That page embeds the demo with an iframe:
  - `src` points at the built demo artifact inside the Astro `public/` or `dist/` path used by the project’s demo pipeline.
  - iframe sandbox attributes should be restrictive (see §11).

### 4.2 Demo metadata (`meta.json`)

Minimum schema:

```json
{
  "id": "orbital-node-sizing-50kw",
  "title": "Orbital Compute Node Sizing (50 kW)",
  "description": "Deterministic sizing sandbox for a Class S 50 kW orbital compute node: compute power, overhead, radiator area estimate, and constraint heuristics.",
  "tier": 2,
  "version": "1.0.0",
  "entry": "index.html",
  "tags": ["orbital", "thermal", "sizing", "50kw", "compute"],
  "updated": "YYYY-MM-DD"
}
```

---

## 5) UX and layout specification

### 5.1 Desktop layout (three columns)

Use a three-column layout:

1. **Controls (left)**
2. **Results (center)**
3. **Explanations / Diagrams (right)**

Columns should collapse to a single column on narrow viewports.

### 5.2 Mobile layout

- Controls first, results second, explanations last.
- Sticky verdict bar (optional, but recommended) showing PASS/OVER and total kW.

### 5.3 Interaction rules

- All inputs update results **immediately** (`input` events), with **debounce not required** (math is trivial).
- Numeric inputs:
  - Use sliders where it improves comprehension (e.g., radiator temperature).
  - Always show exact numeric value next to sliders.
  - Enforce min/max bounds (see §6).
- Provide a **Reset to baseline** button.
- Provide an **Info** affordance for the radiator equation and the “array-limited vs radiator-limited” heuristic.

### 5.4 Visual style

- Match site styling: minimal, technical.
- Results should highlight:
  - PASS: neutral/positive styling.
  - OVER: warning styling.
- Avoid heavy animations.

---

## 6) Inputs and bounds (v1)

All inputs are local-only UI controls; they map 1:1 to the calculation model.

### 6.1 Compute configuration

| Input               | Key               |      Type | Default | Min |  Max | Notes                             |
| ------------------- | ----------------- | --------: | ------: | --: | ---: | --------------------------------- |
| Blocks              | `blocks`          |       int |       4 |   1 |    8 | “Block” = repeatable compute unit |
| GPU TDP (W)         | `gpuTdp_W`        |       int |     700 | 300 | 1000 | Per GPU                           |
| GPUs per block      | `gpusPerBlock`    | const int |      10 |   — |    — | Fixed v1 constant                 |
| Host per block (kW) | `hostPerBlock_kW` |     float |     1.0 | 0.5 |  2.0 | CPU+DRAM+NIC share                |
| Fixed BMC (kW)      | `fixedBmc_kW`     |     float |     0.2 | 0.0 |  0.5 | Fixed overhead for mgmt           |

### 6.2 Power envelope

| Input          | Key           |        Type | Default | Min |  Max | Notes                                          |
| -------------- | ------------- | ----------: | ------: | --: | ---: | ---------------------------------------------- |
| Bus power (kW) | `bus_kW`      | const float |    50.0 |   — |    — | Fixed for this demo                            |
| Overhead (kW)  | `overhead_kW` |       float |     6.0 | 2.0 | 15.0 | Non-compute: pumps, avionics, conversion, etc. |

### 6.3 Thermal / radiator

| Input                              | Key          |  Type | Default | Min |  Max | Notes                        |
| ---------------------------------- | ------------ | ----: | ------: | --: | ---: | ---------------------------- |
| Effective radiator temperature (K) | `T_K`        |   int |    1000 | 600 | 1200 | Slider recommended           |
| Effective emissivity               | `emissivity` | float |    0.85 | 0.5 | 0.95 | Single scalar (order-of-mag) |

### 6.4 Packaging heuristic threshold

| Input               | Key             |  Type | Default | Min | Max | Notes                            |
| ------------------- | --------------- | ----: | ------: | --: | --: | -------------------------------- |
| Area threshold (m²) | `thresholdA_m2` | float |     100 |  50 | 150 | Used in heuristic classification |

---

## 7) Calculation model (deterministic)

All calculations run in a pure function with explicit inputs and outputs.

### 7.1 Definitions

- `gpusPerBlock = 10` (constant v1)
- `sigma = 5.670374419e-8` (Stefan–Boltzmann constant, W/m²/K⁴)

### 7.2 Compute power

```
gpuPower_kW  = blocks * gpusPerBlock * gpuTdp_W / 1000
hostPower_kW = blocks * hostPerBlock_kW + fixedBmc_kW
computePayload_kW = gpuPower_kW + hostPower_kW
```

### 7.3 Node total + verdict

```
nodeTotal_kW = computePayload_kW + overhead_kW

verdict = "PASS" if nodeTotal_kW <= bus_kW else "OVER"
overBy_kW = max(0, nodeTotal_kW - bus_kW)
```

### 7.4 Radiator effective area estimate

Use Stefan–Boltzmann with a single effective emissivity (order-of-magnitude sizing):

```
P_W  = nodeTotal_kW * 1000
A_m2 = P_W / (emissivity * sigma * T_K^4)

A_m2_per_kW = A_m2 / nodeTotal_kW
```

**Implementation notes**

- Ensure `T_K` is treated as a real number in computation (even if UI is int).
- Guard against division by zero:
  - If `nodeTotal_kW <= 0` or `emissivity <= 0` → return `A_m2 = null` and show “—”.

### 7.5 Constraint classification heuristic (v1)

Rules-based classification:

- If `T_K >= 900` **and** `A_m2 < thresholdA_m2` → label **“likely array-limited”**
- Else → label **“radiator likely significant”**

Also compute an explanation string listing which conditions were met.

### 7.6 Trim suggestions (only when OVER)

When `nodeTotal_kW > bus_kW`, generate deterministic suggestions **without mutating inputs**:

1. If `gpuTdp_W > 600`, suggest lowering toward **600 W**
2. Suggest reducing `blocks` by **1**
3. If `hostPerBlock_kW > 0.8`, suggest lowering toward **0.8 kW**

Suggestions must be shown in priority order and expressed as _recommendations_.

---

## 8) State model and TypeScript contracts

Implement as a single state object plus derived outputs.

### 8.1 Types

```ts
export type Inputs = {
  blocks: number;
  gpuTdp_W: number;
  hostPerBlock_kW: number;
  fixedBmc_kW: number;
  overhead_kW: number;
  T_K: number;
  emissivity: number;
  thresholdA_m2: number;
};

export type Outputs = {
  gpuPower_kW: number;
  hostPower_kW: number;
  computePayload_kW: number;
  nodeTotal_kW: number;
  verdict: "PASS" | "OVER";
  overBy_kW: number;
  radiatorArea_m2: number | null;
  areaPerkW_m2_per_kW: number | null;
  constraintLabel: "likely array-limited" | "radiator likely significant";
  constraintWhy: string;
  trimSuggestions: string[];
};
```

### 8.2 Pure calculation function

```ts
export function computeOutputs(inputs: Inputs): Outputs;
```

Rules:

- No DOM access.
- No reliance on global mutable state.
- Unit-testable with snapshots.

---

## 9) UI implementation details

### 9.1 Technology

- **No framework required** (preferred): vanilla TS/JS module + small DOM binding.
- Allowed if already standard in demos: lightweight component approach, but keep bundle minimal.
- One CSS file; avoid runtime CSS frameworks unless already used by other demos.

### 9.2 DOM structure (recommended)

- Left: `<form>` controls grouped by section.
- Center: results card with a top verdict banner.
- Right: explanation blocks + SVG diagram.

### 9.3 Rendering rules

- On any input change:
  1. Parse + clamp inputs.
  2. Compute outputs.
  3. Render outputs.
- Use fixed decimal formatting:
  - kW values: 1 decimal
  - m² values: 1 decimal (or 0 decimals when >1000)
  - emissivity: 2 decimals

### 9.4 Assets

- `zone-diagram.svg` must ship with the demo.
- The SVG should visually convey zones:
  - compute payload
  - overhead
  - thermal rejection (radiator)

Keep it schematic; avoid sensitive system diagrams.

---

## 10) Testing and quality gates

### 10.1 Unit tests (required)

Add a small test suite (preferred in demo folder) covering:

- Baseline inputs produce expected outputs (snapshot).
- PASS boundary: exactly 50.0 kW → PASS.
- OVER: 50.01 kW → OVER and non-empty trim suggestions.
- Radiator area monotonicity:
  - higher `T_K` → lower `A_m2`
  - higher `emissivity` → lower `A_m2`
- Classification toggles at:
  - `T_K = 900`
  - `A_m2 = thresholdA_m2`

### 10.2 Lint/format

- Prettier formatting enforced.
- No console noise (remove debug logs).

### 10.3 Accessibility

- All inputs have labels.
- Keyboard navigation works end-to-end.
- Color is not the only indicator of PASS/OVER (include text + icon).

---

## 11) Security posture (do not regress)

This demo must not create risk for the real infrastructure.

- **No backend calls**: do not fetch from `thesisweb-backend` or any service domain.
- **No environment secrets** in build artifacts.
- iframe embed must set restrictive sandboxing:

Recommended iframe attributes:

- `sandbox="allow-scripts allow-same-origin"`  
  (Do **not** add `allow-forms` unless needed; do **not** add `allow-top-navigation`.)
- `referrerpolicy="no-referrer"`
- Consider `csp` headers at the site level if already in place.

Inside the demo, set a conservative Content Security Policy if possible via a `<meta http-equiv="Content-Security-Policy" ...>`:

- `default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'none';`

---

## 12) Integration into ExNulla Site

### 12.1 Build pipeline

- The demo is built/placed so it ends up in the final Astro output and is served as static assets.
- If the project uses a “demos build” step, register this demo in the existing manifest/list.

### 12.2 Astro embed page requirements

- Title + short description matching `meta.json`.
- iframe with fixed aspect ratio and responsive resizing.
- A short “Math Notes” section:
  - Stefan–Boltzmann used with effective emissivity and temperature.
  - Order-of-magnitude sizing; placeholders until radiator design is locked.

---

## 13) Acceptance criteria

A build is accepted when:

1. The page renders and the iframe loads locally and in the Docker runtime image.
2. Changing any control updates results instantly.
3. PASS/OVER verdict is correct at and around 50 kW.
4. Radiator area decreases as temperature increases.
5. No network requests occur at runtime (browser devtools → Network shows only local assets).
6. `meta.json` is present and accurate.
7. Tests pass in CI (or local test command if CI not yet wired for demos).

---

## 14) Reference notes (for developers)

The demo’s posture intentionally mirrors the upstream documentation:

- `space-server-heat-dissipation-main/docs/architecture/node-class-s-50kw.md`
- `space-server-heat-dissipation-main/docs/compute/compute-baseline-50kw.md`
- `space-server-heat-dissipation-main/docs/architecture/launch-packaging-assumptions.md`

These docs inform _narrative and defaults_, not runtime dependencies.
