# Engineering Spec — ExNulla Demo: Micro-Backend Showcase (v1.0.0)

**Spec ID:** `exnulla-demo-engineering-spec-micro-backend-1-0-0`  
**Demo slug:** `micro-backend-showcase`  
**Tier:** 2 (iframe-isolated Vite artifact)  
**Shell repo:** `exnulla-site`  
**Backend source-of-truth:** `thesisweb-backend` (Fastify + SQLite)  

This spec converts the blueprint (`docs/exnulla-demo-blueprint-micro-backend-showcase.md`) into an implementable build plan. It is written to **avoid disclosing or encouraging any production-sensitive deployment details**: bind backend to localhost, route via same-origin nginx rewrite, and keep demo traffic bounded.

---

## 1) Objective

Deliver a **browser-driven request harness** embedded in ExNulla Lab that makes “boring but real” backend behaviors observable:

- strict JSON schema validation (Fastify route schema; `additionalProperties: false`)
- security headers (helmet)
- global rate limiting (Fastify rate-limit plugin)
- safe persistence (SQLite WAL) and idempotent duplicates
- honeypot bot trap returning `204`

**Primary hiring signal:** the demo shows the operator understands validation, abuse resistance, and operational boundaries.

---

## 2) Constraints & Non-Goals

### Constraints

- **Same-origin requests** in production: browser talks to `exnulla.com/api/...` (no CORS).
- Demo must be safe to run repeatedly by public visitors:
  - hard caps on concurrency and total requests
  - no “open-ended” stress testing
- Demo runs in **iframe sandbox** to keep the shell static-first.
- Demo must degrade cleanly when the backend is unavailable.

### Non-Goals

- No admin UI for viewing stored rows.
- No real email delivery in demo environment.
- No auth flows (JWT/OAuth) in v1.
- No exposing internal service addresses/ports to the public internet.

---

## 3) Inputs: Backend Contract (Must Match)

The demo assumes the backend implements the following (verified in `thesisweb-backend-main/src/server.ts` and `src/migrate.ts`):

### 3.1 Endpoints

- `POST /v1/signup`
  - request schema:
    - `email` required (`string`, 3..320)
    - optional `name` (`string`, 1..80)
    - optional `source` (`string`, 1..80)
    - optional honeypot `hp` (`string`, <=200)
    - `additionalProperties: false`
  - responses:
    - `201 { ok: true }` on first insert
    - `200 { ok: true, already: true }` on duplicate email (idempotent)
    - `204` when honeypot is filled (no side effects)
    - `400 { error: "invalid_email" }` when regex fails
    - `429` when rate-limited
    - `5xx { error: "server_error" }` unexpected failures

- `GET /healthz` → `200 { ok: true }`

### 3.2 Server behaviors

- `helmet` registered globally.
- `rate-limit` registered globally (defaults in code: `max: 30`, `timeWindow: "1 minute"`).
- body limit in Fastify: `10 KB`.
- SQLite:
  - WAL mode enabled.
  - `signups` table with unique index on `email`.

### 3.3 Email behavior (demo-safe)

The backend contains best-effort email sending, guarded by config (`provider === "none"` means no email). For the demo environment, run with a **no-email provider**.

---

## 4) Deliverables

### 4.1 Demo artifact

A Vite-built static app served at:

- `GET /demos/micro-backend-showcase/` (static files)

The artifact must contain:

- `index.html` + JS/CSS bundle
- `meta.json` describing the demo (see §9)

### 4.2 ExNulla Lab integration

A new tile in the Lab that launches the iframe for this demo.

### 4.3 Ops wiring (boundary only)

Same-origin rewrite paths exposed by the site’s fronting nginx:

- `POST /api/signup` → backend `POST /v1/signup`
- `GET /api/healthz` → backend `GET /healthz`

> The spec intentionally does **not** include any production hostnames, service ports, or credentials. Use existing ops conventions.

---

## 5) Repo Layout & Build Plumbing

### 5.1 Directory structure (in `exnulla-site`)

Add a **source** folder for the demo and publish its built output into `site/public/demos/...`.

Recommended structure:

```
exnulla-site/
  demos/
    micro-backend-showcase/
      package.json
      vite.config.ts
      tsconfig.json
      index.html
      src/
        main.ts
        app.ts
        api.ts
        generator.ts
        classify.ts
        ui/
          components.ts
          render.ts
      public/
        meta.json (template, replaced/filled at build)
  site/
    public/
      demos/
        micro-backend-showcase/
          (built artifact output)
```

### 5.2 Build integration policy

- The demo is built via Vite to a deterministic output dir under the Astro site’s static root:
  - `demos/micro-backend-showcase/dist` → copied/synced to `site/public/demos/micro-backend-showcase/`
- The shell build remains the source of truth for deploy artifacts; demos are baked into the same release directory.

### 5.3 Root scripts (recommended)

Add root-level scripts that can be run locally and in CI:

- `npm run demo:micro-backend:build` (builds the demo and copies output into `site/public/demos/...`)
- `npm run build` should build:
  1) demos (or at least this demo)
  2) site

If you already have a root orchestrator, wire this into it instead of duplicating.

---

## 6) Demo UI Requirements

### 6.1 Layout

Implement a **three-column** layout (collapses to single column on small screens):

1) **Controls**
2) **Live results**
3) **Explainer + Inspector**

Keep styling consistent with ExNulla’s minimal black/gray aesthetic. No heavy animations.

### 6.2 Controls (exact)

**Target mode**

- `Same-origin (/api/signup)` — default
- `Direct (/v1/signup)` — for local setups when using a dev proxy
- `Custom URL` — behind “Advanced” toggle

**Burst controls**

- `total requests` (1–300; hard cap enforced)
- `concurrency` (1–25; hard cap enforced)
- `inter-request delay (ms)` (0–500)

**Payload mode**

- `valid`
- `invalid_email`
- `extra_property`
- `honeypot_filled`
- `duplicate_email`

**Deterministic seed**

- text input `seed` controlling email generation and request order

**Actions**

- Run
- Stop
- Reset

### 6.3 Live results

- Reverse-chronological timeline list; each row shows:
  - request number
  - timestamp
  - status code
  - latency (ms)
  - reason tag

- Aggregates:
  - status histogram
  - p50/p95 latencies (approx ok; computed from sample)
  - count of rate-limited responses

### 6.4 Inspector

- last response JSON body (pretty printed)
- last response headers:
  - show a curated subset (security/rate-limit/`retry-after`)
  - expandable raw header map

### 6.5 Explainer panels

Accordion sections:

- Schema validation
- Rate limiting
- Security headers
- SQLite idempotency
- Honeypot behavior

Each section must contain:

- 1–2 sentences describing the behavior
- “What to try” bullet list pointing to the payload modes

---

## 7) Demo Client Logic

### 7.1 Deterministic request generator

**Goal:** same inputs ⇒ same sequence.

Inputs:

- `seed: string`
- `mode: PayloadMode`
- `total: number`
- `concurrency: number`
- `delayMs: number`

Outputs:

- list of request descriptors:
  - URL (resolved from target mode)
  - payload object
  - stable request id (index)

Implementation guidance:

- Use a small deterministic PRNG (e.g., xorshift32) seeded from a stable hash of the seed string.
- Deterministically generate emails under a non-real domain:
  - `demo+<hash>@example.invalid`
- Deterministically generate request ordering (e.g., precomputed array; no randomness from `Math.random`).

### 7.2 Payloads (must match backend schema)

Base schema:

```ts
type SignupBody = {
  email: string;
  name?: string;
  source?: string;
  hp?: string;
};
```

Payload modes:

- `valid`
  - `email`: generated
  - `name`: `"ExNulla Demo"`
  - `source`: `"exnulla-lab"`
  - `hp`: omitted or `""`

- `invalid_email`
  - `email`: `"not-an-email"`

- `extra_property`
  - include an unknown key (e.g., `role: "admin"`) to force schema rejection

- `honeypot_filled`
  - include `hp: "I am a bot"` and a valid email

- `duplicate_email`
  - use the **same** deterministic email for all requests in the run

### 7.3 Concurrency runner

Requirements:

- Use `AbortController` to support Stop.
- Implement a simple worker pool:
  - spawn `concurrency` workers
  - each worker pulls next request index from a shared counter
  - respects `delayMs` between its own requests

Per request:

- measure latency with `performance.now()`
- parse body as JSON when possible, else treat as text/empty
- always capture headers (build a plain object map)

### 7.4 Classification

Map response → `ReasonTag`:

- `201` → `OK_CREATED`
- `200` with JSON `{ already: true }` → `OK_IDEMPOTENT`
- `204` → `HONEYPOT`
- `400` with `{ error: "invalid_email" }` → `INVALID_EMAIL`
- `400` otherwise → `SCHEMA_REJECT`
- `429` → `RATE_LIMIT`
- `>=500` → `SERVER_ERROR`
- fetch/network error → `NETWORK_ERROR`

**Important:** do not rely on any single header name or exact Fastify error payload format.

---

## 8) “Backend Offline” Behavior

When the backend cannot be reached (network error, non-JSON, etc.):

- Show a prominent but non-alarming status:
  - `Backend unreachable — demo still loads; requests are failing`
- Disable Run until either:
  - `GET /api/healthz` succeeds, or
  - user toggles Advanced and explicitly runs anyway

Health polling policy:

- On page load and every 10s while the demo is open, call `/api/healthz`.
- Stop polling after N consecutive failures (e.g., 6) and show the offline panel.

---

## 9) Demo Metadata

Create `site/public/demos/micro-backend-showcase/meta.json` at build time.

Fields:

```json
{
  "name": "Micro-Backend Showcase",
  "slug": "micro-backend-showcase",
  "tier": 2,
  "requiresBackend": true,
  "backendRoutes": ["/api/signup", "/api/healthz"],
  "version": {
    "builtAt": "<ISO8601 UTC>",
    "gitSha": "<demo repo commit sha or 'unknown'>"
  }
}
```

If demo code lives inside the `exnulla-site` repo, `gitSha` may reuse the shell’s SHA.

---

## 10) ExNulla Site Integration

### 10.1 Add Lab tile

Update `site/src/components/siteConfig.ts` (`LAB_TILES`) and add a new entry:

- `name`: `Micro-Backend: Abuse-Resistant Signup`
- `tier`: `2`
- `tags`: include `fastify`, `security`, `rate-limit`, `sqlite`, `schema`
- `href`: `/lab`
- `demoPath`: `/demos/micro-backend-showcase/`
- `source`: reference backend files (repo + paths)

### 10.2 Iframe sandbox

The Lab currently uses:

- `sandbox="allow-scripts allow-same-origin"`

Keep this for v1. Do **not** add broader permissions (popups, top navigation) unless required.

---

## 11) Reverse Proxy Boundary (High-Level)

Expose same-origin API routes for the demo:

- `POST /api/signup` → internal backend `POST /v1/signup`
- `GET /api/healthz` → internal backend `GET /healthz`

Security boundary requirements:

- backend should bind to **localhost only**
- nginx should only proxy these specific paths
- do not proxy arbitrary paths or allow open redirects
- request body size should remain capped (backend already caps at 10KB; nginx may also cap)

> Implementation-specific details (ports, service names, units) must follow your existing droplet conventions and must not be copied into public docs.

---

## 12) Backend Demo Mode (Operational Requirements)

Run backend with demo-safe environment settings:

- **no-email provider** (`provider: none` via env used by `loadEmailConfig`)
- stable data directory (SQLite) located in a non-web-served path
- optional: separate DB path for demo traffic (recommended if you already collect real signups elsewhere)

Do **not** expose:

- raw DB file
- admin endpoints
- logs containing sensitive headers

---

## 13) Testing & Acceptance

### 13.1 Local dev acceptance (demo)

From the demo UI:

1) `valid`, `total=1`
   - expect `201` or `200 already`
2) `invalid_email`
   - expect `400` and reason `INVALID_EMAIL`
3) `extra_property`
   - expect `400` and reason `SCHEMA_REJECT`
4) `honeypot_filled`
   - expect `204` and reason `HONEYPOT`
5) `duplicate_email`, `total=10`
   - expect at least one `OK_IDEMPOTENT`
6) `valid`, `total=100`, `concurrency=25`, `delay=0`
   - expect some `RATE_LIMIT`

### 13.2 Automated smoke checks (recommended)

Add a lightweight test script that:

- builds the demo
- serves the site locally
- runs `curl` to `/demos/micro-backend-showcase/meta.json`

Optionally add a Playwright smoke test later; v1 can ship without it.

### 13.3 Definition of Done

- Demo loads inside Lab iframe.
- Demo can run the 6 narrative scenarios (valid, invalid email, schema reject, honeypot, rate-limit, idempotency).
- Inspector displays headers and body for the last request.
- “Backend unreachable” panel works and does not crash the UI.
- Demo enforces caps (`total<=300`, `concurrency<=25`).

---

## 14) Implementation Notes (Pragmatic Defaults)

- Use vanilla TypeScript + DOM for v1 (fast, minimal deps). React is allowed but not required.
- Keep the bundle small; do not import charting libraries. If you want charts, implement simple bars with `<canvas>` or plain DOM.
- Avoid storing run history in LocalStorage in v1 (privacy). An explicit “Copy run report” button is sufficient.

### 14.1 Run report export

Provide a button that copies JSON to clipboard:

- `inputs` (seed, mode, total, concurrency, delay, target)
- `summary` (counts, p50/p95)
- `firstN` results (cap at 50)

---

## 15) Security Review Checklist

Before shipping:

- [ ] Backend reachable only via same-origin proxy; not directly exposed.
- [ ] Demo does not include any internal addresses/ports in rendered UI.
- [ ] Rate-limit caps remain in place client-side and server-side.
- [ ] Demo uses `.invalid` email domain by default.
- [ ] No email sending in demo environment.
- [ ] Iframe sandbox remains minimal.

---

## 16) Work Plan (Concrete Steps)

1) **Scaffold demo app** under `exnulla-site/demos/micro-backend-showcase` (Vite + TS).
2) Implement UI shell (3-column) and state model.
3) Implement deterministic generator (`generator.ts`) and payload builders.
4) Implement runner with concurrency pool + AbortController.
5) Implement classification + timeline + aggregates.
6) Implement inspector + explainer accordions.
7) Add health polling and offline panel.
8) Build output into `site/public/demos/micro-backend-showcase/` and add `meta.json`.
9) Add Lab tile entry and verify iframe load.
10) Validate acceptance scenarios.

