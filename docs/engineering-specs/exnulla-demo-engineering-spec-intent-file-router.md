# ExNulla Demo Engineering Spec

## Intent-Driven File Router Simulator (TARGET Header Workflow)

**Spec ID:** `exnulla-demo-intent-file-router-1.0.1`  
**Tier:** 2 (independent static demo embedded via iframe)  
**Shell host:** ExNulla Site (Astro)  
**Demo slug:** `/lab/intent-file-router`  
**Demo static path:** `/demos/intent-file-router/`  
**Primary alignment sources:**

- `docs/blueprints/exnulla-demo-blueprint-intent-file-router.md` (behavior + UX blueprint)
- `docs/engineering-specs/exnulla-demo-engineering-spec-demos-monorepo-standard-1-0-0.md` (demo repo standards)

---

## 0) Delta from v1.0.0

This revision adds a **proof-forward Landing Areas surface**:

- Two always-visible landing areas (`frontend/`, `backend/`) that show the stripped payload at the routed path.
- Deterministic overwrite semantics.
- Optional bounded `.bak` chain (N=2) on overwrite (no timestamps).

---

## 1) Scope and non-goals

### In scope

- A client-side simulator that:
  - parses a line-1 `TARGET` header in **3 comment syntaxes**
  - validates repo keys + paths with safety rules
  - strips the header and normalizes payload
  - emits a deterministic route plan (dry-run)
  - renders a **proof-forward UI** (Input / Router Output / Audit+Diff / Landing Areas)
  - performs a **virtual write** into landing areas (in-memory only)
  - includes optional bounded `.bak` backups on overwrite
  - includes a “repo hygiene guard” mini-panel simulation
- Build and integration into `exnulla-demos` so the demo is served under `/demos/intent-file-router/` and embedded via `/lab/intent-file-router`.
- Table-driven unit tests for parser + validator + payload builder + determinism + virtual write semantics.

### Explicit non-goals

- No real SSH/SCP, no network, no filesystem writes outside browser memory.
- No loading arbitrary user files beyond a small capped text input.
- No auth, no persistence, no backend dependency.

---

## 2) Current repo reality and placement

This demo currently lives at:

- `apps/intent-file-router/`

Do **not** restructure into a new `demos/` folder in this change. All UI/logic additions happen inside `apps/intent-file-router/src`.

Build output must remain compatible with being served at:

- `/demos/intent-file-router/` (Vite base is already configured for this hosting model)

---

## 3) Product requirements

### 3.1 Core behavior

1. **Explicit opt-in**: routable only if line 1 is a supported `TARGET` header.
2. **Header stripping**: routing metadata never lands in payload.
3. **Deterministic output**: same inputs → same `(repoKey, pathInRepo, payloadSha, dest)`.
4. **Safety defaults**:
   - refuse binary content (null byte heuristic)
   - denylist certain extensions (config)
   - refuse unknown repo keys
   - refuse invalid paths (empty, absolute, traversal)
   - support conflict and after policies (display-only except overwrite/skip impacts virtual write)
5. **Proof-forward landing**:
   - Simulate performs a **virtual write** into landing areas.
   - Landing areas are always visible and previewable.
   - Overwrite updates the landing file live.
6. **Bounded backups (optional, deterministic)**:
   - On overwrite, keep last N versions (N=2 default).
   - Expose backups as `.bak1` / `.bak2` nodes in the landing tree.
   - No timestamps.
7. **Repo hygiene guard**: detect and flag line-1 TARGET headers (simulated scan input).

### 3.2 UX requirements

- Four-pane layout (or 3-pane + bottom strip) with Landing Areas always visible:
  - **Input**
  - **Router Output**
  - **Audit + Diff**
  - **Landing Areas (Virtual FS: frontend + backend)**
- “Wow” affordances:
  - determinism badge showing `payload_sha256` and `route_id`
  - shareable permalink encoding _example id + toggles + filename_ (not full content)
- Learnability tips:
  - “You can type directly into the payload.”
  - “Change the TARGET header to route into the other landing area and watch it land.”

---

## 4) Configuration

### 4.1 Repo map (display-only)

Hardcode a map mirroring real script keys (display-only in plan):

```ts
export const REPO_MAP: Record<string, string> = {
  backend: "/srv/repos/backend",
  frontend: "/srv/repos/frontend",
};
```

Notes:

- The demo’s landing areas only need `frontend` and `backend` to support the “split landing” proof.
- The plan may still show other keys if desired later, but landing proof only requires two.

### 4.2 Denylist extensions

Default denylist (case-insensitive):

```
.exe .msi .zip .7z .rar .3mf .stl .png .jpg .jpeg .gif .mp4 .mov .pdf
```

### 4.3 Policies

- `conflictPolicy`: `overwrite | skip` (default: `overwrite` for a more vivid demo; spec permits either)
- `afterPolicy`: `move | delete | keep` (default: `keep`)

In demo:

- `conflictPolicy` affects both plan text and virtual write behavior (skip blocks writes if file exists).
- `afterPolicy` remains display-only.

---

## 5) Data model

### 5.1 Core types

(Keep existing types; add virtual FS types below.)

### 5.2 Landing areas (Virtual FS)

```ts
export type RepoKey = "frontend" | "backend";

export type VirtualFS = Record<RepoKey, Record<string, string>>;
// virtualFS.frontend["public/data/demo.json"] = "stripped payload"

export type Backups = Record<RepoKey, Record<string, string[]>>;
// backups.frontend["public/data/demo.json"] = ["prev1", "prev2"] (newest first)

export type LastWrite = { repo: RepoKey; path: string } | null;
```

### 5.3 Deterministic overwrite + bounded backup rule

- Write target is `repoKey` + `pathInRepo`.
- If the target does not exist:
  - write new file, no backups created.
- If the target exists:
  - if `conflictPolicy=skip`: do not write; emit a warning/notice and leave landing unchanged.
  - if `conflictPolicy=overwrite`:
    - push previous contents into backups (newest first)
    - cap backups length to `MAX_BAK=2`
    - write new contents

No timestamps anywhere in filenames or backup keys.

---

## 6) Virtual write algorithm (authoritative)

Add a single authoritative helper:

```ts
const MAX_BAK = 2;

export function writeVirtualFile(
  repo: RepoKey,
  path: string,
  content: string,
  conflictPolicy: "overwrite" | "skip",
  virtualFS: VirtualFS,
  backups: Backups,
): { virtualFS: VirtualFS; backups: Backups; wrote: boolean; didBackup: boolean } {
  const existing = virtualFS[repo][path];

  if (existing !== undefined && conflictPolicy === "skip") {
    return { virtualFS, backups, wrote: false, didBackup: false };
  }

  const nextFS: VirtualFS = { ...virtualFS, [repo]: { ...virtualFS[repo] } };
  const nextBackups: Backups = { ...backups, [repo]: { ...backups[repo] } };

  let didBackup = false;

  if (existing !== undefined) {
    const arr = (nextBackups[repo][path] ?? []).slice(0, MAX_BAK);
    nextBackups[repo][path] = [existing, ...arr].slice(0, MAX_BAK);
    didBackup = true;
  }

  nextFS[repo][path] = content;

  return { virtualFS: nextFS, backups: nextBackups, wrote: true, didBackup };
}
```

---

## 7) UI requirements for Landing Areas

### 7.1 Always-visible split

Show landing areas concurrently:

- **Landing: frontend/**
  - file tree of `virtualFS.frontend` + backup nodes
  - preview panel
- **Landing: backend/**
  - file tree of `virtualFS.backend` + backup nodes
  - preview panel

### 7.2 Tree model

- Primary nodes come from `Object.keys(virtualFS[repo])`.
- Backup nodes are _virtual_:
  - for base file `p`, expose:
    - `p.bak1` (backups[repo][p][0])
    - `p.bak2` (backups[repo][p][1])
- Clicking a `.bakN` node previews that backup content.
- Disallow writing to `.bak*` targets (validation should treat `.bak` suffix as legal path, but virtual write must never target `.bak` names).

### 7.3 UX polish

- On successful write:
  - auto-select written file in its landing tree
  - briefly highlight row (e.g., 600ms)
  - show “Last write: <path> (new|overwrite + bak1|skipped)” indicator.

---

## 8) Tests (additive)

Add unit tests for virtual write semantics:

- new write creates file, no backups
- overwrite creates bak1
- overwrite twice creates bak1/bak2
- third overwrite drops oldest (still only 2 backups)
- skip policy blocks overwrite and backups unchanged

---

## 9) Acceptance criteria

Demo is “done” when:

- Landing areas show the stripped payload at the routed path immediately after simulate.
- Overwrite updates content; backups retain last 2 versions.
- Switching TARGET header between `frontend` and `backend` visibly changes landing destination.
- Existing parser/validator/determinism behaviors remain correct and tested.
