import type { TargetSpec, RepoKey } from "../lib/types";

const RX = [
  /^\s*\/\/\s*TARGET:\s+(.+)$/i,
  /^\s*#\s*TARGET:\s+(.+)$/i,
  /^\s*<!--\s*TARGET:\s+(.+?)\s*-->\s*$/i,
];

export function parseTargetHeader(
  line1: string,
): { raw: string; repoKey: string; pathInRepo: string } | null {
  for (const rx of RX) {
    const m = line1.match(rx);
    if (!m) continue;
    const raw = m[1].trim();
    const [repoKey, ...rest] = raw.split(/\s+/);
    const pathInRepo = rest.join(" ").trim();
    return { raw, repoKey, pathInRepo };
  }
  return null;
}

export function coerceRepoKey(k: string): RepoKey | null {
  const allowed: RepoKey[] = [
    "backend",
    "frontend",
    "protocol",
    "architecture",
    "devkit",
    "sims",
    "portfolio",
  ];
  return (allowed as string[]).includes(k) ? (k as RepoKey) : null;
}

export function toTargetSpec(line1: string): TargetSpec | null {
  const parsed = parseTargetHeader(line1);
  if (!parsed) return null;
  const repoKey = coerceRepoKey(parsed.repoKey);
  if (!repoKey) return null; // validation layer will emit UNKNOWN_REPO when simulating
  return { raw: parsed.raw, repoKey, pathInRepo: parsed.pathInRepo };
}
