import type { RoutePlan } from "../lib/types";
import { REPO_MAP } from "../lib/repoMap";

export function computePlan(args: {
  repoKey: keyof typeof REPO_MAP;
  pathInRepo: string;
  conflictPolicy: "overwrite" | "skip";
  afterPolicy: "move" | "delete" | "keep";
}): RoutePlan {
  const remoteRepoRoot = REPO_MAP[args.repoKey];
  const remoteDest = `${remoteRepoRoot}/${args.pathInRepo}`;
  const lastSlash = remoteDest.lastIndexOf("/");
  const remoteDir = lastSlash === -1 ? remoteRepoRoot : remoteDest.slice(0, lastSlash);

  const steps: RoutePlan["steps"] = [
    { label: "Ensure directory", command: `mkdir -p ${remoteDir}` },
    {
      label: "Upload",
      command:
        args.conflictPolicy === "skip"
          ? `scp <payload> ${remoteDest}  # if missing (skip if exists)`
          : `scp <payload> ${remoteDest}  # overwrite`,
    },
  ];

  if (args.afterPolicy === "keep") steps.push({ label: "After", command: "# keep local input" });
  if (args.afterPolicy === "delete")
    steps.push({ label: "After", command: "rm <local>  # simulated" });
  if (args.afterPolicy === "move")
    steps.push({ label: "After", command: "mv <local> <local_routed_dir>  # simulated" });

  return { remoteRepoRoot, remoteDest, steps };
}
