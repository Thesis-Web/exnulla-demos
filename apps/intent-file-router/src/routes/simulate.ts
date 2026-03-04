import type { AppState, TargetSpec, ValidationIssue } from "../lib/types";
import { normalizeContent, splitLine1AndRest } from "./normalize";
import { parseTargetHeader, coerceRepoKey } from "./parseTarget";
import { computePlan } from "./plan";
import {
  detectBinary,
  validateFilename,
  validatePath,
  validatePayloadSizeBytes,
  validateRepoKey,
} from "./validate";
import { sha256HexUtf8 } from "./hash";
import { applyLanding, chooseLanding } from "./landing";

const MAX_BYTES = 256 * 1024;

export async function simulate(state: AppState): Promise<AppState> {
  const audit = state.audit.concat([{ ts: new Date().toISOString(), action: "simulate" }]);

  const normalized = normalizeContent(state.content, state.normalizeCrlf);
  const binIssues = detectBinary(normalized, state.forceBinary);
  const { line1, rest } = splitLine1AndRest(normalized);

  const issues: ValidationIssue[] = [];
  issues.push(...validateFilename(state.filename));
  issues.push(...binIssues);

  const parsed = parseTargetHeader(line1);

  let targetSpec: TargetSpec | null = null;
  let payload = rest; // spec: payload is content with line1 removed

  if (!parsed) {
    issues.push({ code: "NO_TARGET", severity: "error", message: "No TARGET header on line 1." });
  } else {
    const repoKey = coerceRepoKey(parsed.repoKey);
    issues.push(...validateRepoKey(parsed.repoKey, repoKey));
    const { normalizedPath, issues: pathIssues } = validatePath(parsed.pathInRepo);
    issues.push(...pathIssues);

    if (repoKey) {
      targetSpec = { raw: parsed.raw, repoKey, pathInRepo: normalizedPath };
    }
  }

  issues.push(...validatePayloadSizeBytes(payload, MAX_BYTES));

  const hasError = issues.some((i) => i.severity === "error");
  if (hasError || !targetSpec) {
    return {
      ...state,
      audit,
      targetSpec,
      payload,
      issues,
      plan: null,
      payloadSha256Hex: null,
      routeId: null,
    };
  }

  const payloadSha256Hex = await sha256HexUtf8(payload);
  const routeId = await sha256HexUtf8(
    `${targetSpec.repoKey}|${targetSpec.pathInRepo}|${payloadSha256Hex}`,
  );

  const plan = computePlan({
    repoKey: targetSpec.repoKey,
    pathInRepo: targetSpec.pathInRepo,
    conflictPolicy: state.conflictPolicy,
    afterPolicy: state.afterPolicy,
  });

  const landingId = chooseLanding(targetSpec);
  const nextEntry = {
    remoteDest: plan.remoteDest,
    payload,
    payloadSha256Hex,
    ts: Date.now(),
  };

  const landings = {
    ...state.landings,
    [landingId]: applyLanding(state.landings[landingId], nextEntry, 2),
  } as AppState["landings"];

  return {
    ...state,
    audit,
    targetSpec,
    payload,
    issues,
    plan,
    payloadSha256Hex,
    routeId,
    landings,
  };
}
