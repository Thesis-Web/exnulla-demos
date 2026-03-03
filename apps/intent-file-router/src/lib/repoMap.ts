import type { RepoKey } from "./types";

export const REPO_MAP: Record<RepoKey, string> = {
  backend: "/srv/repos/backend",
  frontend: "/srv/repos/frontend",
  protocol: "/srv/repos/protocol",
  architecture: "/srv/repos/architecture",
  devkit: "/srv/repos/devkit",
  sims: "/srv/repos/sims",
  portfolio: "/srv/repos/portfolio",
} as const;
