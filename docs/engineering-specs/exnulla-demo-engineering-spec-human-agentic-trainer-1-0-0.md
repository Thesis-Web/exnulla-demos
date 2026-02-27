# ExNulla Demo Engineering Spec

## Human Agentic Pipeline Trainer (Pre-API Orchestration Lab)

**Slug:** `human-agentic-trainer`  
**Version:** 1.0.0  
**Target Repository:** `exnulla-demos`  
**Spec Type:** Implementation-grade engineering specification  
**Last Updated:** 2026-02-27

---

## 0. Scope Control

This document is the **engineering-spec companion** to the blueprint:

- `docs/blueprints/exnulla-demo-blueprint-human-agentic-pipeline-trainer-1-0-0.md`

The engineering spec is written so a senior developer can implement the demo with minimal follow-up, and so the project can later be upgraded from **Human Mode** (manual copy/paste transport) to **API Mode** (programmatic transport) without changing the state machine.

### 0.1 Goals

1. Deliver a working **Local Orchestration Console (LOC)** that:
   - Initializes and manages “runs”
   - Generates role-routed prompts
   - Accepts human-pasted agent responses
   - Updates deterministic state
   - Detects drift (rule-based v1)
   - Estimates token budgets
   - Scores via rubric
   - Exports a complete replay artifact

2. Provide a clean **provider adapter boundary**:
   - `HumanProvider` (waits for paste)
   - Future `ApiProvider` (OpenAI/other) can be plugged in later.

3. Make the orchestration mechanics **visible and teachable**:
   - Explicit state machine
   - Explicit role separation and instructions
   - Explicit budget discipline and revision loops

4. Ensure portfolio-grade hygiene:
   - Dockerized environment
   - TypeScript strict
   - Prettier + ESLint
   - Deterministic run outputs
   - GIT_SHA stamping

### 0.2 Non-goals (v1)

- No UI automation/scraping of ChatGPT UI (explicitly out of scope).
- No remote backend required (local file persistence only).
- No long-term multi-user auth (single local operator).
- Drift detection is rule-based v1 (no ML classifier in v1).
- API Mode provider integration is a **stub interface** only (not implemented).

---

## 1. Product Definition

### 1.1 What this demo is

A local teaching tool that guides a learner through a multi-agent workflow where each role is executed in **separate ChatGPT Projects** (or equivalent) with persistent instructions. The LOC coordinates the workflow with explicit prompts and state tracking; the human is the transport layer.

### 1.2 Primary user

A developer/learner who wants to understand agent orchestration fundamentals:

- separation of roles (Architect / Developer / Critic / Tester)
- routing
- state discipline
- budget constraints
- deterministic replay

### 1.3 Key workflows

- Start a run (select scenario / acceptance criteria / budget)
- LOC produces a prompt for a specific role
- Learner executes prompt in the correct ChatGPT Project
- Learner pastes response into LOC
- LOC updates state, scores, flags drift, emits next prompt
- Run completes when rubric thresholds + acceptance criteria satisfied
- Export run artifact for replay and portfolio

---

## 2. System Architecture

### 2.1 High-level components

1. **LOC CLI App** (v1 target):
   - Terminal interactive (TUI optional), deterministic
   - Creates run folders under `runs/`
   - Manages run state and “turns”
   - Handles import/paste of responses
   - Outputs next prompt + routing instructions

2. **State Machine / Orchestrator**
   - Pure functions over state + new observation (agent response)
   - Determines next role + next prompt template
   - Manages iteration loops (Critic/Revise, Tester/Debug)

3. **Rubric Scorer**
   - Rule-based rubric: completeness, correctness signals, adherence, clarity
   - Tracks scoring per turn and overall

4. **Drift Detector (v1)**
   - Rule-based checks:
     - missing required headers/sections
     - breaking formatting constraints
     - role confusion (e.g., Developer performing Architect duties)
     - disallowed actions (web scraping, secrets, etc.)
   - Emits drift flags with severity

5. **Budget Estimator**
   - token estimate: `tokens ≈ chars / 4`
   - per turn and cumulative
   - warns at thresholds

6. **Provider Boundary**
   - `Provider` interface:
     - `requestCompletion(...)` (for API mode)
     - `awaitHumanPaste(...)` (for human mode)
   - v1 uses HumanProvider only

### 2.2 Deployment modes

- **Human Mode (v1):** local CLI + manual copy/paste.
- **API Mode (future):** same orchestrator and state schema; provider changes.

---

## 3. Repository Layout (Implementation)

This demo should live inside `exnulla-demos` under an app package. Recommended structure (pnpm workspace friendly, but works standalone too).

```
exnulla-demos/
  apps/
    human-agentic-trainer/
      README.md
      package.json
      tsconfig.json
      eslint.config.js
      prettier.config.cjs
      Dockerfile
      .dockerignore
      src/
        index.ts
        cli/
          commands/
            init.ts
            next.ts
            paste.ts
            status.ts
            export.ts
            replay.ts
          ui/
            printer.ts
            prompts.ts
        core/
          orchestrator.ts
          state.ts
          schema.ts
          provider.ts
          providers/
            humanProvider.ts
            apiProvider.stub.ts
          budget.ts
          drift.ts
          rubric.ts
          templates/
            roles/
              architect.md
              developer.md
              critic.md
              tester.md
            prompts/
              architect-01-kickoff.md
              developer-01-implement.md
              critic-01-review.md
              tester-01-test.md
              ...
        io/
          fs.ts
          git.ts
          validation.ts
        util/
          id.ts
          time.ts
          hash.ts
      runs/                  # runtime artifacts (gitignored or sample-only)
      examples/
        scenarios/
          hello-orchestrator.json
      docs/
        run-artifact-schema.md
```

### 3.1 Git hygiene

- `runs/` should be `.gitignore` by default (contains generated artifacts).
- Include **one** sample run artifact in `examples/` for demo and tests.
- Enforce formatting via repo-level scripts and CI (consistent with the rest of ExNulla).

---

## 4. Tooling Requirements

### 4.1 Node/TypeScript

- Node LTS (recommend 20.x or repo standard)
- TypeScript `strict: true`
- No implicit any
- Use `zod` for runtime validation of JSON artifacts

### 4.2 Quality gates

- `eslint` (typescript-eslint)
- `prettier`
- `vitest` for unit tests
- `ts-node` or `tsx` for local execution

### 4.3 Docker (deterministic)

- Multi-stage optional, but must run deterministically.
- Accept `ARG GIT_SHA` and stamp it into exported artifacts.
- Container runs the CLI; artifacts are written to a mounted volume.

---

## 5. LOC CLI UX Specification

### 5.1 Commands

The CLI entrypoint is `exnulla-human-agentic-trainer` (bin) or `pnpm hat` alias.

#### `init`

Create a new run folder + initial state.

**Args**

- `--scenario <path>`: JSON scenario file describing the task.
- `--budgetTokens <n>`: optional budget cap.
- `--runId <id>`: optional explicit id.

**Output**

- Prints:
  - runId
  - next role to execute
  - routing instruction: “Open ChatGPT Project: Architect”
  - prompt text to copy

#### `next`

Print the next prompt for the current run.

**Args**

- `--run <path>` or `--runId <id>`

#### `paste`

Accept an agent response and advance the state machine.

**Input**

- Reads from stdin OR `--file response.md`.

**Behavior**

- Validates:
  - response is non-empty
  - required formatting rules for that role (see §7)
- Appends a new turn in the run artifact
- Runs drift + rubric + budget update
- Prints next routing and next prompt

#### `status`

Summarize run: stage, role, budgets, rubric, drift flags, completion.

#### `export`

Emit an export bundle:

- `runs/<runId>/export/run.json` (canonical)
- `runs/<runId>/export/transcript.md`
- `runs/<runId>/export/summary.md`

#### `replay`

Reads a run.json and prints the deterministic sequence of prompts/turns.

### 5.2 Interactive mode (optional)

If time permits, provide `--interactive`:

- prompts for scenario fields
- opens an editor (`$EDITOR`) for paste entry
- still deterministic and file-backed

---

## 6. Data Model and File Formats

### 6.1 Run folder structure

```
runs/<runId>/
  run.json                 # canonical state artifact (append-only turns)
  inputs/
    scenario.json
  turns/
    0001-architect.prompt.md
    0001-architect.response.md
    0002-developer.prompt.md
    0002-developer.response.md
  export/
    run.json
    transcript.md
    summary.md
  logs/
    events.ndjson
```

### 6.2 Canonical Run Artifact Schema (run.json)

Use a **single JSON file** as the source of truth, updated transactionally (write temp + rename).

**Top-level**

```ts
type RunArtifact = {
  version: "1.0.0";
  slug: "human-agentic-trainer";
  runId: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  git: {
    sha: string; // from env/ARG, fallback "unknown"
    dirty: boolean; // optional local detection
  };
  mode: "human";
  budget: {
    tokenEstimateCap?: number;
    tokenEstimateUsed: number;
    warnings: BudgetWarning[];
  };
  scenario: Scenario;
  roles: RoleSpec[];
  turns: Turn[];
  rubric: {
    thresholds: RubricThresholds;
    scores: RubricScore[];
    pass: boolean;
  };
  drift: {
    flags: DriftFlag[];
    maxSeverity: "none" | "low" | "medium" | "high";
  };
  status: {
    stage: Stage;
    nextRole: RoleName | null;
    done: boolean;
    doneReason?: string;
  };
};
```

**Scenario**

```ts
type Scenario = {
  name: string;
  description: string;
  acceptanceCriteria: string[]; // explicit
  constraints: string[]; // e.g., "no web calls", "ts strict"
  deliverables: string[]; // expected artifacts
};
```

**Roles**

```ts
type RoleName = "architect" | "developer" | "critic" | "tester";

type RoleSpec = {
  name: RoleName;
  displayName: string;
  chatgptProjectName: string; // e.g., "HAT - Architect"
  instructionTemplateRef: string; // path under templates/roles/
  requiredResponseFormat: {
    mustIncludeHeadings: string[];
    mustIncludeSections?: string[];
    forbiddenPhrases?: string[];
  };
};
```

**Turn**

```ts
type Turn = {
  turnId: number; // 1-based
  role: RoleName;
  prompt: {
    text: string;
    charCount: number;
    tokenEstimate: number;
    templateRef: string;
  };
  response: {
    text: string;
    charCount: number;
    tokenEstimate: number;
  };
  analysis: {
    driftFlags: DriftFlag[];
    rubricScore: RubricScore;
    notes?: string[];
  };
  timestamps: {
    promptedAt: string;
    respondedAt: string;
  };
};
```

**Budget**

```ts
type BudgetWarning = {
  atTurn: number;
  severity: "low" | "medium" | "high";
  message: string;
};
```

**Drift**

```ts
type DriftFlag = {
  id: string; // stable code, e.g. DRIFT_ROLE_CONFUSION
  severity: "low" | "medium" | "high";
  message: string;
  turnId?: number;
  evidence?: string[];
};
```

**Rubric**

```ts
type RubricThresholds = {
  overallPassScore: number; // e.g., 80/100
  maxAllowedDriftSeverity: "low" | "medium";
};

type RubricScore = {
  turnId: number;
  score: number; // 0-100
  breakdown: {
    completeness: number; // 0-25
    correctnessSignals: number; // 0-25
    constraintAdherence: number; // 0-25
    clarity: number; // 0-25
  };
  notes: string[];
};
```

### 6.3 Validation

- All reads of `run.json` must validate with `zod` schemas.
- If invalid: fail with actionable error; do not auto-repair.

---

## 7. Role Instructions and Prompting System

### 7.1 Separation requirement

Each role must be executed in a separate ChatGPT Project with its own persistent instructions.

This demo must ship:

- `templates/roles/architect.md`
- `templates/roles/developer.md`
- `templates/roles/critic.md`
- `templates/roles/tester.md`

These templates are _copied into ChatGPT Project instructions_ by the learner.

### 7.2 Role instruction template requirements

Each role template MUST include:

- **Mission**
- **Allowed outputs**
- **Forbidden actions**
- **Required response format**
- **Interaction protocol** (what to do when info missing)
- **Determinism rules** (avoid hallucinated file names; require explicit assumptions)

#### Example: required response format (all roles)

Every response must start with:

```
# Role: <Architect|Developer|Critic|Tester>
# Run: <runId>
# Turn: <n>
```

Followed by role-specific sections.

### 7.3 Prompt templates

Prompt templates live under `templates/prompts/` and are parameterized with:

- runId
- scenario summary
- current stage
- constraints
- prior turn summaries (bounded)

The LOC must support:

- Prompt rendering with a small templating engine (e.g., mustache) OR simple string interpolation.
- A hard cap on included history to prevent runaway context:
  - Include only the last N turn summaries (default N=2)
  - Include a “state digest” always (see §8)

---

## 8. Orchestrator and State Machine

### 8.1 Stage model

Stages are explicit:

1. `kickoff` (Architect)
2. `implementation` (Developer)
3. `review` (Critic)
4. `test` (Tester)
5. `revise` (Developer)
6. `finalize` (Architect summary + export readiness)

The orchestrator transitions based on:

- rubric thresholds
- drift severity
- tester results flags

### 8.2 Deterministic “state digest”

The LOC must maintain a compact digest in `run.json`:

```ts
type StateDigest = {
  scenarioDigest: string; // short
  lastDecisions: string[]; // last 3
  openIssues: string[]; // from critic/tester
  artifactsExpected: string[]; // from scenario deliverables
};
```

This digest is regenerated deterministically after each turn from the canonical run artifact.

### 8.3 Transition rules (v1)

- After Architect kickoff:
  - next: Developer implement
- After Developer implement:
  - next: Critic review
- After Critic review:
  - if critic score < threshold OR has blocking issues -> Developer revise
  - else -> Tester test
- After Tester test:
  - if failures -> Developer revise
  - else -> Architect finalize
- After Developer revise:
  - next: Critic review (loop)
  - cap loops with `maxIterations` (default 5) then force finalize with warnings

---

## 9. Drift Detection (Rule-based v1)

### 9.1 Drift categories

1. **Format drift**: missing required headers/sections
2. **Role drift**: role outputs content outside role scope
3. **Constraint drift**: disallowed actions suggested (scraping UI, secrets)
4. **Scope drift**: introducing new deliverables not in scenario

### 9.2 Implemented checks

- Regex checks for required headings
- “Forbidden phrases” (config per role), e.g.:
  - “I ran the code”
  - “I accessed your account”
  - “I scraped ChatGPT”
- Role confusion heuristics:
  - Architect response includes code blocks above a size threshold -> warning
  - Developer response contains “rubric score” -> warning
- Constraint adherence:
  - presence of “web.run”, “browser”, “scrape”, “selenium” etc. triggers medium/high

### 9.3 Output

Drift flags are recorded per turn and aggregated into run-level status:

- `maxSeverity` = max of all flags.

---

## 10. Rubric Scoring (Rule-based v1)

### 10.1 Scoring approach

Rubric is deterministic and inspectable:

- Score each dimension using simple heuristics:
  - Completeness: required sections present, acceptance criteria referenced
  - Correctness signals: includes explicit assumptions, cites artifacts, no contradictions
  - Constraint adherence: no forbidden actions/phrases
  - Clarity: uses headings, lists, actionable steps

### 10.2 Threshold defaults

- `overallPassScore = 80`
- `maxAllowedDriftSeverity = "medium"`

Run completes when:

- last two turns have score ≥ 80
- no `high` drift flags exist
- acceptance criteria are explicitly checked off in finalization

---

## 11. Budget Estimation

### 11.1 Calculation

- `tokenEstimate = ceil(charCount / 4)`
- Budget used is sum of prompt + response estimates across turns.

### 11.2 Warnings

If `tokenEstimateCap` is set:

- Warn at 70%, 85%, 100%:
  - `low` at 70%
  - `medium` at 85%
  - `high` at 100% (and require user confirmation to continue, unless `--force`)

---

## 12. Provider Interface (Upgrade Path)

### 12.1 Provider API

```ts
export interface Provider {
  kind: "human" | "api";
  getRoutingInstruction(role: RoleSpec): string;
  // Human Mode: LOC prints prompt, waits for paste via CLI `paste`
  // API Mode: orchestrator could call provider.requestCompletion
  requestCompletion?: (req: {
    role: RoleSpec;
    prompt: string;
    budget?: { maxTokens?: number };
  }) => Promise<string>;
}
```

### 12.2 Human provider

- Implements `getRoutingInstruction`:
  - “Open ChatGPT Project: <chatgptProjectName>”
- Does not implement `requestCompletion` (undefined)

### 12.3 API stub

- Provide `apiProvider.stub.ts` with TODOs and clear boundaries
- No keys, no live calls in v1

---

## 13. Determinism and Provenance

### 13.1 GIT_SHA stamping

- Resolve SHA in this priority:
  1. `process.env.GIT_SHA`
  2. `git rev-parse HEAD` (if available)
  3. `"unknown"`

Record in:

- `run.json` at `git.sha`
- `export/summary.md`

### 13.2 Transactional writes

- Always write JSON as:
  - `run.json.tmp` then atomic rename to `run.json`
- Never partially write.

### 13.3 Replay

The `replay` command must:

- Read `run.json`
- Print each prompt/response pair in order
- Verify deterministic digest regeneration matches stored digests (optional check mode)

---

## 14. README and Learning Materials

`apps/human-agentic-trainer/README.md` must include:

1. What this demo teaches (short)
2. Setup:
   - Node/pnpm
   - Docker option
3. Create ChatGPT Projects:
   - Names, copy role instructions from `templates/roles/`
4. Running a scenario:
   - `init`, `next`, `paste`, `status`, `export`
5. How to create new scenarios
6. How API mode would be added (conceptual)

---

## 15. Scenarios

### 15.1 Scenario JSON format

```json
{
  "name": "Hello Orchestration",
  "description": "Build a tiny CLI that prints a deterministic greeting with version stamping.",
  "acceptanceCriteria": [
    "CLI runs and prints expected output",
    "Includes version info via env GIT_SHA"
  ],
  "constraints": ["TypeScript strict", "No web calls"],
  "deliverables": ["A proposed file tree", "A test plan", "A final checklist"]
}
```

### 15.2 Provide at least one scenario

- `examples/scenarios/hello-orchestrator.json`

---

## 16. Testing Plan

### 16.1 Unit tests (vitest)

- schema validation roundtrip
- budget estimator correctness
- drift detector flags for known cases
- orchestrator transitions based on mock rubric/drift/tester signals
- transactional file write helper

### 16.2 Snapshot tests (optional)

- prompt template rendering snapshots for a given scenario + digest

---

## 17. Security / Safety Considerations

- No credential handling in v1
- No UI automation
- Clear “do not paste secrets” guidance in CLI output and README
- If user pastes something matching common secret patterns (AWS keys, GH tokens), warn and suggest removal before saving (best-effort regex; do not block by default unless `--strict-secrets`)

---

## 18. Implementation Checklist

### 18.1 Files to implement (minimum)

- `src/index.ts` (CLI wiring)
- `src/core/schema.ts` (zod schemas)
- `src/core/state.ts` (types + digest)
- `src/core/orchestrator.ts` (transitions)
- `src/core/budget.ts`
- `src/core/drift.ts`
- `src/core/rubric.ts`
- `src/core/providers/humanProvider.ts`
- `src/io/fs.ts` (transactional writes)
- `src/cli/commands/*.ts` (init/next/paste/status/export/replay)
- `templates/roles/*.md`
- `templates/prompts/*.md`
- `README.md`
- `Dockerfile`

### 18.2 Definition of Done

- `pnpm lint` passes
- `pnpm test` passes
- `pnpm build` produces runnable CLI
- Demo run can be executed end-to-end on a sample scenario
- `export` produces complete artifacts including stamped SHA
- `replay` reproduces sequence deterministically

---

## 19. Appendix: Dockerfile (reference)

A minimal Dockerfile is acceptable; example:

```dockerfile
FROM node:20-alpine AS base
WORKDIR /app
ARG GIT_SHA=unknown
ENV GIT_SHA=$GIT_SHA

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && corepack prepare pnpm@latest --activate
RUN pnpm install --frozen-lockfile || pnpm install

COPY . .
RUN pnpm build

CMD ["node", "dist/index.js", "status"]
```

> Notes: adjust to repo’s existing pnpm/turbo setup.

---

## 20. Appendix: CLI Output Format (reference)

Every `next` output must include:

1. **Routing**
   - Role name and ChatGPT Project name
2. **Copy block**
   - The exact prompt in a fenced block
3. **Paste instructions**
   - `pnpm hat paste --runId <id> < <file>` or paste into terminal

---

## 21. Traceability to Blueprint

This spec directly implements blueprint sections:

- Separate ChatGPT Projects for roles → §7
- LOC responsibilities → §5, §8–§11
- Run lifecycle → §5, §8
- State model export → §6
- Budget pedagogy → §11
- Upgrade path to API → §12
- Determinism requirements → §13
