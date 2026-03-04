# ExNulla Lab Demo Blueprint

## Intent-Driven File Router Simulator (TARGET Header Workflow)

**Status:** blueprint-ready (engineering-specs next)  
**Demo tier:** Tier 2 (iframe sandbox)  
**Primary source repo:** `dev-tools-main`  
**Primary source files:**

- `thesis-sync.sh` (router)
- `scripts/no-target-headers.sh` (repo hygiene guard)
- `README.md` (workflow + supported header formats)

---

## 1) One-line hook

A deterministic, safe-by-default file router that **moves artifacts to the correct repo/path only when the file explicitly opts-in via a first-line `TARGET` header**—and strips routing metadata before it ever lands in Git.

---

## 2) Why this demo exists (portfolio intent)

Hiring managers immediately recognize the pain this solves:

- "I’m tired of copy/paste + SCP + putting files in the wrong repo."
- "I want intent-based automation that reduces mistakes."
- "I want tooling that is auditable and refuses ambiguous or unsafe inputs."

This demo communicates **ops maturity**: narrow scope, explicit intent, deterministic routing, and clean repo hygiene.

---

## 3) What is being demonstrated (non-negotiable behaviors)

### 3.1 Explicit opt-in

A file is routable **only** when line 1 matches a supported `TARGET` header format.

Supported formats (must be line 1):

```text
// TARGET: <repo_key> <path/in/repo>
// TARGET: backend docs/notes.md

# TARGET: <repo_key> <path/in/repo>
# TARGET: portfolio docs/blueprint.md

<!-- TARGET: <repo_key> <path/in/repo> -->
<!-- TARGET: protocol specs/010-identity-without-disclosure.md -->
```

### 3.2 Header stripping (clean payload)

The router **removes the TARGET header** before upload/write, enabling routing of formats that don’t support comments (e.g., JSON) without polluting repo contents.

### 3.3 Deterministic routing result

Given `(repo_key, path_in_repo)` and a repo map, the computed destination is deterministic:

`remote_dest = REPO_MAP[repo_key] + "/" + path_in_repo`

### 3.4 Safety defaults

- Reject or ignore binaries/media/archives (null bytes, known extensions).
- Reject unknown repo keys.
- Reject empty/invalid paths.
- Provide conflict policy: `overwrite | skip`.
- Provide post-action: `move | delete | keep` (for local input).

### 3.5 Repo hygiene guardrail

The _inverse_ tool (`no-target-headers.sh`) prevents accidental commits of `TARGET` headers by failing CI/locally if found at line 1 inside a repo.

---

## 4) Demo user story

> As James (or a reviewer), I can paste a file (or drop a text file) that includes a `TARGET` header, and the simulator shows exactly where it would go, what would be stripped, what would be executed remotely (dry-run), and why unsafe or ambiguous inputs are refused.

---

## 5) Demo UX (iframe layout)

### 5.1 Page layout (four-pane, proof-forward)

**Left pane — Input**

- Filename (text input)
- File contents (textarea; paste or drag/drop)
- Optional toggle: “Normalize CRLF (Windows)” (default on)
- Optional toggle: “Treat as binary/media?” (auto-detect; can force for demo)
- Buttons:
  - **Simulate Route**
  - Reset
  - Load Example ▼ (good + failure samples)

**Center pane — Router Output**

- Parsed header (repo_key + path_in_repo) or parse error
- Destination preview:
  - Local source (simulated path)
  - Remote repo root (from REPO_MAP)
  - Full remote destination path
- Action plan (dry-run):
  1. `mkdir -p <remote_dir>`
  2. `scp <payload> <remote_dest>` (or "skip" if conflict + skip policy)
  3. Post-upload local action: move/delete/keep

**Right pane — Audit + Diff**

- Audit log timeline:
  - input_received → normalized → header_parsed → validated → payload_built → route_computed → plan_emitted → (virtual_write)
- Diff / preview:
  - “Original (first 5 lines)”
  - “Payload (first 5 lines)” (header removed)
  - Highlight that routing metadata does not land in repo

**Bottom (or 4th pane) — Landing Areas (Virtual FS, always visible)**

Purpose: make the “proof” visible. Users can see the stripped payload land in the target location.

- **Two landing areas shown at all times**:
  - Landing: `frontend/` (tree + preview)
  - Landing: `backend/` (tree + preview)
- Simulate performs a **virtual write** into the selected landing area:
  - Writes are repo-relative paths (e.g., `public/data/demo.json`)
  - The file is previewable immediately (click to open)
- **Overwrite is explicit**:
  - If the same target is written again, the landing file updates live.

**Optional bounded .bak chain (anti-spam)**

- On overwrite, preserve last N previous versions (N=2 default):
  - `demo.json.bak1` = most recent previous
  - `demo.json.bak2` = next previous
  - Drop oldest if more than N
- No timestamps (keeps the demo deterministic).

### 5.2 “Wow” affordances

- **Determinism badge**: show that identical inputs yield identical routing output (hash of payload + destination).
- **Tip + learnability**:
  - “You can type directly into the payload.”
  - “Change the TARGET header to route into the other landing area and watch it land.”

---

## 6) Core data model (demo internal)

### 6.1 Types

- `RepoKey`: string (validated against configured `REPO_MAP`)
- `TargetSpec`:
  - `repoKey: RepoKey`
  - `pathInRepo: string`
  - `raw: string` (original header payload)
  - `format: "slash" | "hash" | "html"`
- `RoutePlan`:
  - `remoteRepoRoot: string`
  - `remoteDest: string`
  - `remoteDir: string`
  - `conflictPolicy: "overwrite" | "skip"`
  - `afterPolicy: "move" | "delete" | "keep"`
  - `steps: Step[]`
- `Step`:
  - `kind: "mkdir" | "upload" | "skip" | "post"`
  - `command: string`
  - `notes?: string`
- `ValidationIssue`:
  - `severity: "error" | "warn"`
  - `code: string`
  - `message: string`

### 6.2 Virtual landing FS types (proof surface)

- `VirtualFS`:
  - `frontend: Record<path, contents>`
  - `backend: Record<path, contents>`
- `Backups` (bounded, per file):
  - `frontend: Record<path, string[]>` (newest first)
  - `backend: Record<path, string[]>`
- `LastWrite`: `{ repo: "frontend"|"backend", path: string } | null`

---

## 7) Parsing + validation rules (must match real tool intent)

### 7.1 Header parsing (line 1 only)

Trim trailing `\r` (Windows CRLF). Match one of:

- `^\s*//\s*TARGET:\s+(.+)$`
- `^\s*#\s*TARGET:\s+(.+)$`
- `^\s*<!--\s*TARGET:\s+(.+?)\s*-->\s*$`

Then parse `(repoKey, pathInRepo)` from the remainder:

- `repoKey` = first whitespace-delimited token
- `pathInRepo` = remaining text, trimmed

### 7.2 Validate repo key

- Error if `repoKey` not present in `REPO_MAP`.

### 7.3 Validate path

- Error if empty
- Error if contains `..` segments (path traversal)
- Error if begins with `/` (must be repo-relative)
- Error if contains `\` (normalize to `/` or reject; recommend normalize + warn)

### 7.4 File type safety (demo approximation)

The real script skips by extension. The demo should:

- Auto-detect binary via null byte heuristic (`\x00` present) → refuse routing
- Additionally treat a configurable denylist of extensions (matches real script):
  - `.exe .msi .zip .7z .rar .3mf .stl .png .jpg .jpeg .gif .mp4 .mov .pdf`
- If denied: show _why_ (issue code + hint)

### 7.5 Payload build

- Payload = content minus line 1.
- Normalize CRLF to LF (remove trailing `\r` per line) to mirror `sed 's/\r$//'`.

### 7.6 Conflict + after policies

Expose toggles that correspond to env vars in the script:

- `ON_CONFLICT=overwrite|skip`
- `AFTER=move|delete|keep`

In demo: affects plan text + virtual landing write behavior (overwrite/skip).

---

## 8) Example scenarios (must ship with demo)

### 8.1 Valid: JS comment header

Filename: `draft-blueprint.md`

```text
// TARGET: portfolio docs/demos/file-router.md
# Title
Some content...
```

Expected:

- repoKey=portfolio
- pathInRepo=docs/demos/file-router.md
- payload starts at `# Title`

### 8.2 Valid: HTML comment header

Filename: `spec.json` (intentionally shows routing JSON)

```text
<!-- TARGET: backend data/example.json -->
{"ok": true}
```

Expected:

- header stripped; payload is valid JSON.

### 8.3 Invalid: header not first line

```text
# Notes
// TARGET: backend docs/notes.md
hello
```

Expected: Not routable; warn: "TARGET must be line 1"

### 8.4 Invalid: unknown repo key

```text
# TARGET: unknown docs/a.md
hi
```

Expected: error + list known keys.

### 8.5 Invalid: path traversal

```text
// TARGET: backend ../secrets.txt
```

Expected: error "path traversal refused".

### 8.6 Denied: binary/media

Filename: `clip.mp4`
Expected: ignored/refused with clear reason.

---

## 9) Acceptance criteria (demo is “done” when)

- **Correctness**
  - All supported header formats parse correctly when on line 1.
  - Header stripping produces correct payload.
  - Repo key mapping + destination computation matches the real tool logic.
- **Safety**
  - Path traversal refused.
  - Binary/media/archives refused with explicit reasons.
- **Explainability**
  - Audit log clearly shows each transformation and the virtual write.
  - Diff/preview proves routing metadata does not land in repo.
  - Landing areas show the stripped payload at the destination path.
- **Portfolio value**
  - A reviewer can understand the workflow in <60 seconds.
  - The demo feels deterministic and “real,” not a toy.

---

## 10) Source alignment notes (to keep us honest)

This demo is intentionally aligned to the real script behaviors:

- Header parsing: `extract_target()` in `thesis-sync.sh`
- Payload stripping + CRLF normalization: `make_payload()` in `thesis-sync.sh`
- Repo key map: `REPO_MAP` in `thesis-sync.sh`
- Binary/media skip: extension denylist in `thesis-sync.sh`
- Hygiene enforcement: `scripts/no-target-headers.sh` (flags line-1 TARGET headers inside repos)
