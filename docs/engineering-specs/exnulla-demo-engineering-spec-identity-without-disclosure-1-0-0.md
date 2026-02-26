# Engineering Spec — ExNulla Demo: Identity Without Disclosure (Predicate Attestation Flow)

**Demo ID:** `identity-without-disclosure`  
**Tier:** 2 (iframe-isolated interactive artifact)  
**Source blueprint:** `docs/exnulla-demo-blueprint-indentity-without-disclosure.md` fileciteturn0file0  
**Integration model:** _Model A — Static Artifact Embedding_ (see `demo-integration-engineering-spec-exnulla-demos-1-0-0.md`)

---

## 0) Scope

Build a deterministic, shareable, iframe-embedded demo that explains:

- **Predicate attestations**: protocol verifies _properties_ (predicates), not identity material.
- **Epoch freshness**: assertions expire or become stale across epochs.
- **Vendor isolation**: commitments are **non-linkable** across vendors by default.
- **Optional bridged equality**: explicit, **epoch-bound** resolver transform can create controlled equivalence without revealing identity.

This demo is an **explanatory simulator** (not production crypto). It must still be precise about threat model and constraints.

---

## 1) Hard constraints (non-negotiable)

### 1.1 No identity leakage

- The UI must **never** render any identity material (`m(h)`), raw KYC/biometric data, or “input fields” that resemble identity capture.
- Identity material is represented only as a **redacted label** (e.g., `"identity material (redacted)"`).

### 1.2 Determinism

Same URL + same parameters must always produce identical:

- commitment(s)
- proof placeholder fields
- ACCEPT/REJECT
- audit log sequence

### 1.3 Static artifact output

Demo builds to a static directory (`dist/`) containing:

- `index.html`
- hashed assets (preferred)
- optional `meta.json` under `public/` so it ends up at `dist/meta.json`

### 1.4 Iframe isolation

- Default iframe sandbox **must not** include `allow-same-origin`.
- The demo must function without `allow-same-origin`.

### 1.5 Integration compatibility

Must integrate via `exnulla-demos` **demo manifest + sync** pipeline:

- `exnulla-demos/demos/manifest.json` pins commit SHA
- `scripts/demos-sync.mjs` builds and copies `dist/` to `site/public/demos/identity-without-disclosure/`
- `scripts/generate-demos-meta.mjs` includes entry for this demo

---

## 2) Deliverables

### 2.1 New demo repo

Create a dedicated demo repo (recommended):

- `Thesis-Web/exnulla-demo-identity-without-disclosure`

(If you prefer to colocate under an existing demo monorepo later, keep the same `dist/` contract.)

### 2.2 Required files in demo repo

```
exnulla-demo-identity-without-disclosure/
  package.json
  vite.config.ts
  tsconfig.json
  index.html
  public/
    meta.json
  src/
    main.tsx
    app/App.tsx
    app/state.ts
    core/types.ts
    core/crypto.ts
    core/issuer.ts
    core/verifier.ts
    core/audit.ts
    ui/Controls.tsx
    ui/FlowCanvas.tsx
    ui/AuditLog.tsx
    ui/WhyPanel.tsx
    ui/CopyPermalink.tsx
    ui/layout.css
  tests/
    verifier.test.ts
    determinism.test.ts
  README.md
```

### 2.3 Output contract

After `npm run build`:

- `dist/index.html` exists
- `dist/assets/*` exists
- `dist/meta.json` exists

---

## 3) Tech stack (locked)

- **Build tool:** Vite 5+
- **Language:** TypeScript (strict)
- **UI:** React 18 (functional components)
- **Testing:** Vitest
- **Styling:** minimal CSS (no Tailwind required in demo)
- **Hash primitive:** SHA-256 (Web Crypto API in browser; Node fallback in tests)

> Rationale: keeps the artifact small, portable, and familiar to reviewers.

---

## 4) UX specification

### 4.1 Layout

Single-screen, three-column layout (desktop), collapsing to stacked sections on mobile:

1. **Controls (left)**

- Predicate dropdown:
  - `is_unique_human`
  - `is_over_18`
  - `is_not_sanctioned`
  - `is_regionally_valid`
- Issuer selector:
  - Vendor A
  - Vendor B
- Epoch slider (integer 1–20)
- Toggles:
  - Show vendor boundary (default ON)
  - Enable bridged equality (resolver) (default OFF)
  - Rotate epoch keys (default ON)
  - Simulate stale assertion (default OFF)

2. **Flow canvas (center)**
   SVG diagram with stepwise highlights:

- User → Authority/Vendor → Assertion → Protocol Verifier → Result
- Vendor boundary box encloses:
  - `m(h)` label (redacted)
  - secret `S_{v,e}` label (redacted)
  - output commitment `c_e(v,h)` (visible)
- Protocol verifier box displays checks:
  - structure valid
  - issuer allowlisted
  - predicate allowlisted
  - epoch freshness

3. **Audit + explanation (right)**

- Deterministic timeline log:
  - `derive_epoch_secret()`
  - `derive_commitment()`
  - `issue_assertion()`
  - `verify_structure()`
  - `verify_issuer()`
  - `verify_predicate()`
  - `verify_freshness()`
  - `verify_vendor_isolation()`
  - `optional_bridge()`
- “Why?” panel updates to explain the current verdict.

### 4.2 Required interactions

- Changing **epoch**:
  - If stale toggle ON, verdict becomes `REJECT: EPOCH_STALE`
- Switching **issuer**:
  - changes commitment and breaks linkability
- Enabling **bridge**:
  - changes cross-vendor comparison outcome to an explicit “equivalent under resolver”

### 4.3 Required copy (honesty box)

A small panel near the top:

- “This demo simulates predicate attestations: the protocol verifies _properties_, not identity.”
- “Crypto primitives are deterministic placeholders to illustrate constraints and failure modes.”

---

## 5) Domain model (authoritative)

### 5.1 Types (`src/core/types.ts`)

```ts
export type Epoch = number; // integer
export type AuthorityId = "vendor_a" | "vendor_b";

export type IdentityPredicate =
  | "is_unique_human"
  | "is_over_18"
  | "is_not_sanctioned"
  | "is_regionally_valid";

export type Proof = {
  kind: "zk_like_placeholder";
  statementHash: string;
  issuerSig: string;
};

export type PredicateAssertion = {
  predicate: IdentityPredicate;
  issuer: AuthorityId;
  epoch: Epoch;
  commitment: string; // c_e(v,h)
  proof: Proof;
};

export type VerificationReason =
  | "STRUCTURE_INVALID"
  | "EPOCH_STALE"
  | "ISSUER_UNKNOWN"
  | "PREDICATE_UNKNOWN"
  | "BRIDGE_DISABLED_NONLINKABLE"
  | "BRIDGE_OK_EQUIVALENT"
  | "OK_VALID";

export type VerificationResult = {
  ok: boolean;
  reason: VerificationReason;
  details?: Record<string, string | number | boolean>;
};
```

---

## 6) Deterministic placeholder “crypto” (math + code)

### 6.1 Placeholder primitives

We implement a **one-way hash** placeholder for:

- epoch secrets
- commitments
- proof fields
- optional bridge transform

This is not real ZK; it is deterministic structure to simulate schema checks.

### 6.2 Definitions

Let:

- vendor `v ∈ {vendor_a, vendor_b}`
- epoch `e ∈ ℤ`
- identity material placeholder `m(h) = "user_material"` (constant, never displayed)

**Epoch secret**
\[
S\_{v,e} = H(v \parallel ":" \parallel e)
\]

**Commitment**
\[
c*e(v,h) = H(S*{v,e} \parallel ":" \parallel m(h))
\]

**Statement hash**
\[
statementHash = H(predicate \parallel ":" \parallel c_e(v,h) \parallel ":" \parallel e)
\]

**Issuer signature placeholder**
\[
issuerSig = H(statementHash \parallel ":" \parallel v)
\]

**Bridge transform (optional, resolver-enabled)**
\[
t\_{a\to b}(c_a) = H("bridge:" \parallel e \parallel ":" \parallel c_a)
\]

### 6.3 Implementation (`src/core/crypto.ts`)

Requirements:

- Browser: use `crypto.subtle.digest("SHA-256", ...)`
- Node/test: use `node:crypto` when `globalThis.crypto?.subtle` unavailable

API:

```ts
export async function sha256Hex(input: string): Promise<string>;
export async function epochSecret(v: AuthorityId, e: Epoch): Promise<string>;
export async function commitment(v: AuthorityId, e: Epoch): Promise<string>;
export async function statementHash(p: IdentityPredicate, c: string, e: Epoch): Promise<string>;
export async function issuerSig(statementHash: string, v: AuthorityId): Promise<string>;
export async function bridgeTransform(epoch: Epoch, c: string): Promise<string>;
```

---

## 7) Issuance and verification logic

### 7.1 Issuance (`src/core/issuer.ts`)

```ts
export async function issueAssertion(args: {
  predicate: IdentityPredicate;
  issuer: AuthorityId;
  epoch: Epoch;
}): Promise<PredicateAssertion>;
```

Must:

- derive `commitment`
- derive `statementHash`
- derive `issuerSig`
- return full `PredicateAssertion`

### 7.2 Verification (`src/core/verifier.ts`)

```ts
export async function verifyAssertion(args: {
  assertion: PredicateAssertion;
  currentEpoch: Epoch;
  issuerAllowlist: AuthorityId[];
  predicateAllowlist: IdentityPredicate[];
  simulateStale: boolean;
}): Promise<VerificationResult>;
```

Checks:

1. **Structure**: required fields exist; epoch integer; strings non-empty; proof.kind correct.
2. **Issuer**: in allowlist else `ISSUER_UNKNOWN`.
3. **Predicate**: in allowlist else `PREDICATE_UNKNOWN`.
4. **Freshness**:
   - if `simulateStale` then treat assertion as stale by comparing `assertion.epoch !== currentEpoch`
   - strict mode: `assertion.epoch === currentEpoch` else `EPOCH_STALE`
5. **Proof derivation**:
   - recompute expected `commitment`, `statementHash`, `issuerSig`
   - if mismatch, return `STRUCTURE_INVALID` with details

Return `OK_VALID` if all pass.

### 7.3 Cross-vendor uniqueness check (optional panel)

The demo must visualize this scenario:

- Vendor A issues assertion for “same human” (represented by constant `m(h)`).
- Vendor B issues assertion for “same human”.
- Commitments differ by default: `c(a,h) != c(b,h)`.

We add helper:

```ts
export async function compareAcrossVendors(args: {
  epoch: Epoch;
  aCommitment: string;
  bCommitment: string;
  bridgeEnabled: boolean;
}): Promise<VerificationResult>;
```

Behavior:

- If `bridgeEnabled === false` → `ok:false`, reason `BRIDGE_DISABLED_NONLINKABLE`
- If `bridgeEnabled === true`:
  - compute `t = bridgeTransform(epoch, aCommitment)`
  - if `t === bCommitment` then `BRIDGE_OK_EQUIVALENT`
  - else still non-equivalent (return `BRIDGE_OK_EQUIVALENT` false with details)

**Note:** Because commitments are derived from `S_{v,e}`, `t === bCommitment` will generally _not_ hold unless you explicitly model “resolver accepted mapping”.  
Therefore, for v1, implement **resolver acceptance flag**:

- When bridge enabled, treat “equivalence under resolver” as:
  - `bridgeTransform(epoch, aCommitment)` is the “resolver token”
  - Display “Resolver token” and show that _protocol_ can accept the resolver token without learning identity.
  - The verdict becomes `BRIDGE_OK_EQUIVALENT` regardless of literal equality, but you must clearly label it as “equivalent under resolver policy”.

This avoids a false claim that the transform equals the other commitment; it shows that **resolver policy** mediates equivalence.

---

## 8) State, permalink, and determinism

### 8.1 Query params (authoritative)

- `p` predicate
- `i` issuer (`vendor_a|vendor_b`)
- `e` epoch (int)
- `b` bridge (`0|1`)
- `s` simulate stale (`0|1`)
- `k` rotate epoch keys (`0|1`) *(still deterministic because keys derived from epoch; toggle controls whether you *display* rotation as active)*

Example:
`?p=is_over_18&i=vendor_a&e=7&b=0&s=0&k=1`

### 8.2 State parsing rules

- Missing params → defaults:
  - predicate: `is_unique_human`
  - issuer: `vendor_a`
  - epoch: `7`
  - bridge: `0`
  - stale: `0`
  - rotate: `1`

### 8.3 “Copy permalink”

Button writes current URL (with params) to clipboard.

### 8.4 Determinism tests

Add tests to ensure the same params produce same outputs.

---

## 9) UI rendering details

### 9.1 FlowCanvas (SVG)

Implement as SVG with simple nodes and arrows:

- Nodes: `User`, `Authority`, `Assertion`, `Verifier`, `Result`
- Vendor boundary: rectangle around authority internals
- Highlight active steps based on audit log pointer (simple: animate through steps every 600ms, loop)

### 9.2 Audit log

`src/core/audit.ts` defines:

```ts
export type AuditEvent = {
  ts: number;
  code: string;
  message: string;
  data?: Record<string, unknown>;
};
export function buildAudit(events: Omit<AuditEvent, "ts">[]): AuditEvent[];
```

Determinism: timestamps must be **virtual** (e.g., index-based or derived from a fixed base), not real time.

Implementation:

- `ts = 1000 * index` (or similar).

---

## 10) Testing (must implement)

### 10.1 Vitest setup

- `npm run test` runs vitest in Node.
- Provide crypto fallback for Node.

### 10.2 Required tests

#### `tests/verifier.test.ts`

- Valid assertion passes (OK_VALID)
- Wrong issuer fails (ISSUER_UNKNOWN)
- Wrong predicate fails (PREDICATE_UNKNOWN)
- Epoch mismatch fails (EPOCH_STALE)
- Tampered statementHash fails (STRUCTURE_INVALID)

#### `tests/determinism.test.ts`

- Given fixed params, issue+verify twice returns identical:
  - commitment
  - proof fields
  - result.reason
  - audit event sequence (codes + data)

---

## 11) Demo metadata (`public/meta.json`)

Create `public/meta.json`:

```json
{
  "id": "identity-without-disclosure",
  "title": "Identity Without Disclosure",
  "tier": 2,
  "tags": ["privacy", "identity", "protocol", "attestation"],
  "source": {
    "repo": "the-thesis-chain-protocol",
    "paths": [
      "specs/010-identity-without-disclosure.md",
      "math/identity-mapping.md",
      "pseudocode/identity.ts"
    ]
  },
  "inputs": ["predicate", "issuer", "epoch", "bridgeToggle", "staleToggle"],
  "outputs": ["accept/reject", "commitment", "audit-log", "resolver-token"],
  "determinism": { "seeded": true, "shareable": true }
}
```

---

## 12) Build commands (demo repo)

### 12.1 `package.json` scripts (required)

- `dev`: `vite`
- `build`: `vite build`
- `preview`: `vite preview`
- `test`: `vitest run`
- `format`: `prettier . --write`
- `format:check`: `prettier . --check`
- `lint:ts`: `tsc -p tsconfig.json --noEmit`

> Keep lint simple: typecheck + prettier. (Avoid ESLint unless you already use it elsewhere in demos.)

---

## 13) ExNulla site integration steps (must pass)

### 13.1 Add to `exnulla-demos/demos/manifest.json`

Example entry (pin the commit SHA once repo exists):

```json
{
  "identity-without-disclosure": {
    "repo": "Thesis-Web/exnulla-demo-identity-without-disclosure",
    "ref": "PUT_COMMIT_SHA_HERE_40_HEX",
    "build": ["npm", "ci"],
    "build2": ["npm", "run", "build"],
    "outDir": "dist",
    "enabled": true,
    "tier": 2,
    "iframe": {
      "sandbox": "allow-scripts allow-forms",
      "allowSameOrigin": false
    },
    "budgets": { "maxGzipBytes": 3145728 }
  }
}
```

### 13.2 Lab tile wiring

Ensure the lab tile routes iframe to:

- `/demos/identity-without-disclosure/index.html`

### 13.3 CI gating

With the integration spec installed:

- CI must build this demo and fail if it breaks.

---

## 14) Security review checklist (must complete before enabling in prod)

- [ ] iframe sandbox excludes `allow-same-origin`
- [ ] no network calls required (demo should work offline)
- [ ] no identity capture UI elements exist
- [ ] permalink params do not store sensitive content
- [ ] demo does not attempt to reach parent window (`window.top` access not needed)

---

## 15) Acceptance criteria

### 15.1 Demo-level

- Opening `dist/index.html` works in a static server
- Permalink determinism works
- Visual flow communicates the four concepts within ~60 seconds
- Audit log and Why panel are coherent and consistent with verifier output

### 15.2 ExNulla integration

- `node scripts/demos-sync.mjs` pulls and builds the demo from pinned SHA
- `node scripts/generate-demos-meta.mjs` includes it
- Docker runtime serves:
  - `/demos/identity-without-disclosure/index.html`
  - `/meta/demos.json` includes entry for it
- Atomic deploy includes the demo artifacts

---

## 16) Implementation order (junior checklist)

1. Create demo repo with Vite+React+TS skeleton.
2. Implement core types + crypto helpers.
3. Implement issuance + verifier + audit builder.
4. Build UI controls + flow canvas + audit log + why panel.
5. Implement permalink parse + copy permalink.
6. Add vitest tests (verifier + determinism).
7. Ensure `npm run build` outputs `dist/` with `meta.json`.
8. Pin commit SHA in `exnulla-demos/demos/manifest.json` and enable.
9. Run `exnulla-demos` CI locally (or via PR) to validate pipeline.
