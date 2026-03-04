import type { RepoKey, TargetSpec } from "../lib/types";

export type LandingId = "A" | "B";

export type LandingEntry = {
  remoteDest: string;
  payload: string; // already stripped (no TARGET header)
  payloadSha256Hex: string;
  ts: number; // ms since epoch
  bak?: LandingEntry[]; // bounded history (most recent first)
};

const A_REPOS: ReadonlySet<RepoKey> = new Set(["backend", "frontend", "protocol", "architecture"]);

const B_REPOS: ReadonlySet<RepoKey> = new Set(["devkit", "sims", "portfolio"]);

export function chooseLanding(targetSpec: TargetSpec): LandingId {
  const p = targetSpec.pathInRepo;

  // path prefix override (strict, deterministic)
  if (p.startsWith("landing-a/")) return "A";
  if (p.startsWith("landing-b/")) return "B";

  // repoKey mapping
  if (B_REPOS.has(targetSpec.repoKey)) return "B";
  if (A_REPOS.has(targetSpec.repoKey)) return "A";

  // defensive default (should be unreachable if RepoKey is exhaustive)
  return "A";
}

export function applyLanding(
  prev: LandingEntry | null,
  next: LandingEntry,
  maxBak: number = 2,
): LandingEntry {
  if (!prev) return next;

  const bak = [prev, ...(prev.bak ?? [])].slice(0, Math.max(0, maxBak));
  return { ...next, bak: bak.length ? bak : undefined };
}
