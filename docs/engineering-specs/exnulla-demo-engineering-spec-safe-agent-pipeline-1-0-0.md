# Engineering Spec — Safe Agent Pipeline Demo (Spec‑Lint + Threat‑Sketch + PR Synthesis)

**Project:** ExNulla / ThesisWeb  
**Repo:** `Thesis-Project/exnulla-demos`  
**Demo ID:** `safe-agent-pipeline`  
**Tier:** 2 (iframe‑isolated static artifact)  
**Version:** 1.0.0  
**Status:** NEW (fills spec gap)

## 0) Outcomes (acceptance-level)

When implemented:

1. A new demo app exists at `apps/safe-agent-pipeline/` and builds to `apps/safe-agent-pipeline/dist/index.html`.
2. The demo runs fully **offline** (no network, no API keys) using a deterministic **stub provider**.
3. The demo reproduces the pipeline guardrail order used in the devkit:
   - **redaction → injection guard (policy) → prompt envelope build → cache check → budget enforcement → provider call (stub) → parse + schema validate (fail closed) → audit events**
4. The UI exposes guardrail toggles and makes **blocked vs allowed** behavior explicit.
5. The demo supports:
   - **Presets A–F** (baseline, injection blocked, redaction, schema fail-closed, cache hit, path policy flags)
   - **Export/Import** of full state
   - **Permalink** encoding full state (deterministic replay)
6. The demo embeds cleanly under `exnulla-demos` as `/demos/safe-agent-pipeline/` and is safe in an iframe sandbox (no top-nav, no popups, no network).
7. CI in `exnulla-demos` passes: format, typecheck, test, build.

---

## 1) Source of truth: devkit modules to mirror (authoritative behavior)

This demo must mirror the semantics in `the-thesis-chain-ai-devkit` (you already own it). The following are “reference implementations” for behavior and type shapes:

- Agents:
  - `src/agents/spec-lint.agent.ts` → `runSpecLint(ctx)`
  - `src/agents/threat-sketch.agent.ts` → `runThreatSketch(ctx)`
  - `src/agents/pr-synthesis.agent.ts` → `runPRSynthesis(ctx)`
- Core guardrails:
  - `src/core/llm-client.ts` (pipeline order)
  - `src/core/types.ts` (canonical types: `AgentContext`, `Report`, `Finding`, `LLMRequest/Response`)
  - `src/core/redaction.ts`, `src/core/injection-guards.ts`
  - `src/core/cache.ts`, `src/core/audit.ts`, `src/core/policy.ts`, `src/core/prompt-templates.ts`
  - `src/adapters/provider.stub.ts`

**Constraint:** the demo must remain public-safe: **no real provider integrations** and **no secrets**.

---

## 2) Repo placement and build contract (authoritative)

### 2.1 App location

Create:

```
apps/safe-agent-pipeline/
  index.html
  package.json
  vite.config.ts
  tsconfig.json
  src/
  public/
    meta.json
```

### 2.2 Required Vite base

Because the demo is hosted under `/demos/<slug>/` inside `exnulla-demos`, Vite **must** build with relative asset paths:

```ts
// vite.config.ts
export default defineConfig({
  base: "./",
  build: { outDir: "dist" },
});
```

### 2.3 Demo metadata

Add `apps/safe-agent-pipeline/public/meta.json`:

```json
{
  "id": "safe-agent-pipeline",
  "title": "Safe Agent Pipeline",
  "tier": 2,
  "tags": ["ai", "guardrails", "schema", "redaction", "injection", "audit", "determinism"]
}
```

---

## 3) Architecture decision: vendored core vs dependency

### 3.1 Decision (locked for v1.0.0)

**Vendor a minimal copy** of the devkit pipeline modules into this monorepo as a local package:

```
packages/safe-agent-core/
  package.json
  src/
    agents/
    core/
    adapters/
```

**Rationale:** deterministic, no cross-repo build coupling, and the demo can be pinned/updated explicitly later.

### 3.2 Vendoring rules

- Copy only the modules needed for the demo (agents + core + stub provider).
- Keep file names and exports **as close as possible** to devkit to prevent drift.
- Add a small header comment per file:

```ts
// Vendored from the-thesis-chain-ai-devkit @ <PINNED_SHA>
// Local modifications: <list>
```

### 3.3 Package exports

`packages/safe-agent-core/src/index.ts` should export:

- `runThreatSketch`, `runSpecLint`, `runPRSynthesis`
- `createLLMClient` (but demo uses a demo-configured wrapper; see §4)
- Types: `AgentContext`, `Report`, `Finding`, `LLMRequest`, `LLMResponse`, `Budget`, `ModelSpec`

---

## 4) Demo-core wrapper (required)

The UI must not call the vendored `createLLMClient()` directly. Create a demo wrapper that injects demo-specific adapters (audit sink + cache + provider behavior switches).

Create:

```
apps/safe-agent-pipeline/src/demo-core/
  demoClient.ts
  demoAuditStore.ts
  demoCache.ts
  demoProvider.ts
  state.ts
```

### 4.1 Demo audit store (in-app)

Implement an in-memory event store that mirrors devkit `AuditEvent` semantics but is UI-friendly:

- `append(event)`
- `clear()`
- `getAll(): AuditEvent[]`

Also include demo-added event kinds:

- `cache_hit`, `cache_miss`
- `redaction_applied`
- `injection_blocked`
- `budget_checked`

### 4.2 Demo cache

Use a simple in-memory cache keyed identically to the devkit concept:

- `aidev:{provider}:{model}:{promptHash}:{contextHash}`

Add a UI panel that shows:

- computed cache key
- whether hit/miss
- TTL (optional; v1 can be “session only” without TTL)

### 4.3 Demo provider (deterministic stub + failure modes)

Wrap the vendored stub provider so the demo can simulate:

- **OK**: valid JSON matching `Report`
- **NON_JSON**: returns plain text
- **WRONG_SCHEMA**: returns JSON with missing/invalid fields

Expose a UI toggle: “Simulate bad provider output” with a dropdown for the failure mode.

**Determinism requirement:** given the same demo state + mode, the provider output must be identical on every run.

Implementation recommendation:

- Use a fixed PRNG seed derived from `sha256(promptHash + contextHash + mode)` and generate a stable set of findings.
- Or return a canned fixture per mode (simplest).

### 4.4 Budget enforcement

Budget counters must be visible in UI:

- calls made / maxCalls
- total input tokens / maxTotalInputTokens
- total output tokens / maxTotalOutputTokens

For v1:

- Token “usage” may be simulated deterministically by:
  - `inputTokens = ceil(len(promptEnvelope)/4)`
  - `outputTokens = ceil(len(rawText)/4)`
    This is sufficient to demonstrate the control plane without provider dependency.

---

## 5) Data model and state (authoritative)

### 5.1 Canonical demo state

Create `apps/safe-agent-pipeline/src/demo-core/state.ts` and define:

```ts
export type SafeAgentDemoState = {
  repo: { owner: string; name: string };
  promptVersion: string;

  diffSummary: string;
  changedFiles: Array<{ path: string; content: string }>;

  injection: {
    enabled: boolean;
    where: "none" | "diffSummary" | "firstFile" | "both";
    payload: string;
  };

  guardrails: {
    redaction: boolean;
    injectionGuard: boolean;
    strictSchema: boolean;
    caching: boolean;
    policy: {
      allowPaths: string[];
      denyPaths: string[];
      budget: { maxCalls: number; maxTotalInputTokens: number; maxTotalOutputTokens: number };
      model: { provider: string; model: string; temperature: number; maxOutputTokens: number };
    };
  };

  ui: {
    activeAgent: "pipeline" | "ThreatSketchAgent" | "SpecLint" | "PRSynthesis";
    showPromptEnvelope: boolean;
    showDiffAfterRedaction: boolean;
    providerMode: "OK" | "NON_JSON" | "WRONG_SCHEMA";
  };
};
```

### 5.2 Import/Export

- Export: download state as JSON file.
- Import: load JSON and validate shape (basic runtime checks; fail with a readable error).

---

## 6) Permalink and determinism (required)

### 6.1 Permalink encoding

Permalink must encode full state into URL so a fresh browser can reproduce.

Recommended approach:

- Serialize state JSON (stable key order if you want extra rigor)
- Compress (e.g., `pako` gzip/deflate) and base64url encode
- URL format: `?s=<base64url>`

### 6.2 Determinism rules

Given identical state and provider mode:

- prompt envelope text must match exactly
- `promptHash`, `contextHash`, `outputHash` must match
- caching must hit/miss identically
- the rendered findings must be identical

Add a small “Determinism panel” showing:

- requestIds (agent-scoped)
- hashes
- cache key

---

## 7) Prompt envelope (must be visible and hashed)

The prompt envelope must be rendered exactly as it is hashed:

- `SYSTEM: ...`
- `TASK: ...`
- `CONSTRAINTS: ...`
- `OUTPUT_SCHEMA: ...`
- `CONTEXT_DIFF_SUMMARY: ...`
- `CONTEXT_FILES: ...`

**Requirement:** UI must display:

- the envelope text
- the computed `promptHash` and `contextHash`

---

## 8) Guardrails and policy behaviors (authoritative UX behavior)

### 8.1 Redaction

- Default ON
- Show active rules (at minimum):
  - `sk-...`-like tokens → `sk-REDACTED`
  - emails → `EMAIL_REDACTED`
- Provide a “before vs after” diff panel for redaction.

### 8.2 Prompt injection guard

- Default ON
- When triggered, the run must:
  - stop before provider call
  - emit `injection_blocked` audit event
  - show “why blocked” with the matching pattern name (or pattern text)

### 8.3 Schema gate (fail closed)

- Default ON
- If provider returns invalid JSON → show parse error, do not render findings as valid.
- If JSON wrong shape → show validation error, do not render findings as valid.
- When strictSchema is OFF, show a yellow “unsafe mode” banner.

### 8.4 Path allow/deny policy flags

- Default allow paths: `docs/`, `specs/`, `src/`, `pseudocode/`, `math/`
- Default deny paths: `.github/`, `secrets/`, `configs/`, `deploy/`

UI must:

- flag violating files in the changed-files table
- optionally allow excluding flagged files (recommended)
- explain allow/deny logic in the Explain panel

---

## 9) Agent pipeline orchestration (authoritative)

### 9.1 Execution order (pipeline mode)

When `activeAgent = "pipeline"`:

1. ThreatSketch
2. SpecLint
3. PRSynthesis

### 9.2 Single-agent mode

When user selects a single agent:

- run only that agent
- audit grouping must still identify the agent run

### 9.3 Request ID rules

Match devkit structure (must be deterministic):

- SpecLint: `speclint:{promptVersion}:{sha256(diffSummary)}`
- ThreatSketch: `threatsketch:{promptVersion}:{sha256(diffSummary)}`
- PRSynthesis: `prsynth:{promptVersion}:{sha256(diffSummary)}` (or whatever devkit uses; mirror it)

---

## 10) UI requirements (wireframe-level, authoritative)

### 10.1 Layout

Single page with:

- Header: title, presets, permalink, export/import, reset
- 3 columns:
  1. Inputs + policy toggles
  2. Run controls + outputs per agent
  3. Audit timeline + Explain panel

### 10.2 Outputs

Per agent:

- Rendered findings table
- Raw JSON report (copyable)
- Schema gate result (pass/fail + error)

### 10.3 Audit timeline

Show event cards with:

- kind
- timestamp
- requestId
- provider/model
- promptHash/contextHash/outputHash
- usage (simulated tokens)
- cache info (hit/miss)

Group visually by agent.

---

## 11) Presets (must ship)

Implement presets A–F from the blueprint:

- A: Clean PR baseline
- B: Injection attempt blocked
- C: Redaction demonstration
- D: Schema gate fail closed (NON_JSON or WRONG_SCHEMA)
- E: Cache hit (run twice)
- F: Path policy flags (`.github/` or `deploy/` paths included)

Presets must be synthetic (no secrets) and realistic.

---

## 12) Testing and quality gates (required)

### 12.1 Unit tests (Vitest)

Add tests under:

- `packages/safe-agent-core` (if modified) or
- `apps/safe-agent-pipeline/src/demo-core`

Minimum required tests:

1. Redaction replaces email + `sk-...` pattern
2. Injection guard blocks the canonical payload (`ignore previous instructions`)
3. Schema gate:
   - non-JSON fails
   - wrong-schema fails
   - correct passes
4. Cache hit/miss:
   - identical state → hit on second run
   - changed diffSummary → miss
5. Budget:
   - exceeding `maxCalls` fails
   - counters update deterministically

### 12.2 Build smoke test

A simple test that asserts `dist/index.html` exists after `pnpm build --filter safe-agent-pipeline`.

---

## 13) Integration contract with `exnulla-demos` (for later wiring)

This demo must be compatible with the existing integration spec:

- `exnulla-demos` copies `apps/safe-agent-pipeline/dist/` into `site/public/demos/safe-agent-pipeline/`
- The lab iframe should use a restrictive sandbox by default:
  - recommended: `allow-scripts allow-forms`
  - avoid `allow-same-origin` unless a real need arises

**No external network calls** (keep it CSP-friendly).

---

## 14) Implementation checklist (step-by-step)

1. Create `packages/safe-agent-core` and vendor the devkit modules listed in §1.
2. Create `apps/safe-agent-pipeline` Vite+React+TS app.
3. Implement demo-core wrappers (§4): audit store, cache, provider modes, budget simulation.
4. Implement state model + presets (§5, §11).
5. Implement permalink + import/export (§6).
6. Implement UI layout + panels (§10).
7. Add tests (§12).
8. Confirm `pnpm -w build` produces `apps/safe-agent-pipeline/dist/index.html`.
9. Confirm the app works when served from a subpath (`base: "./"`).

---

## Appendix A — Canonical type shapes (mirror devkit)

From devkit `src/core/types.ts`:

```ts
export type Severity = "info" | "warn" | "high";
export type Category = "structure" | "invariant" | "threat" | "diff" | "test";

export type Finding = Readonly<{
  id: string;
  severity: Severity;
  category: Category;
  claim: string;
  evidence_refs: string[];
  suggested_action?: string;
}>;

export type Report = Readonly<{
  agent: string;
  version: string;
  input_hash: string;
  output_hash: string;
  findings: Finding[];
  notes?: string[];
}>;
```
