export type RepoKey =
  | "backend"
  | "frontend"
  | "protocol"
  | "architecture"
  | "devkit"
  | "sims"
  | "portfolio";

export type TargetSpec = {
  raw: string;
  repoKey: RepoKey;
  pathInRepo: string;
};

export type ValidationIssue = {
  code:
    | "NO_TARGET"
    | "UNKNOWN_REPO"
    | "EMPTY_PATH"
    | "ABSOLUTE_PATH"
    | "PATH_TRAVERSAL"
    | "BACKSLASH_IN_PATH"
    | "DENYLIST_EXTENSION"
    | "PAYLOAD_TOO_LARGE"
    | "BINARY_DETECTED";
  severity: "error" | "warn";
  message: string;
  details?: Record<string, unknown>;
};

export type RoutePlanStep = { label: string; command: string };

export type RoutePlan = {
  remoteRepoRoot: string;
  remoteDest: string;
  steps: RoutePlanStep[];
};

export type AuditEvent = {
  ts: string;
  action: string;
  meta?: Record<string, unknown>;
};

export type AppState = {
  filename: string;
  content: string;
  normalizeCrlf: boolean;
  forceBinary: boolean;
  conflictPolicy: "overwrite" | "skip";
  afterPolicy: "move" | "delete" | "keep";

  targetSpec: TargetSpec | null;
  payload: string;
  issues: ValidationIssue[];
  plan: RoutePlan | null;
  audit: AuditEvent[];

  payloadSha256Hex: string | null;
  routeId: string | null;
};
