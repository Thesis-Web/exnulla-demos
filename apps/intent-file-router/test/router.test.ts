import { describe, expect, test } from "vitest";
import { simulate } from "../src/routes/simulate";
import type { AppState } from "../src/lib/types";
import { SAMPLES } from "../src/lib/samples";

function baseState(): AppState {
  return {
    filename: "draft.md",
    content: "",
    normalizeCrlf: true,
    forceBinary: false,
    conflictPolicy: "overwrite",
    afterPolicy: "keep",
    targetSpec: null,
    payload: "",
    issues: [],
    plan: null,
    audit: [],
    payloadSha256Hex: null,
    routeId: null,
  };
}

describe("Intent File Router (table-driven)", () => {
  for (const s of SAMPLES) {
    test(s.id, async () => {
      const st = baseState();
      st.filename = s.filename;
      st.content = s.content;

      const out = await simulate(st);

      const hasError = out.issues.some((i) => i.severity === "error");
      const routable = !hasError && out.plan !== null && out.payloadSha256Hex && out.routeId;

      expect(Boolean(routable)).toBe(s.expectRoutable);

      // determinism invariants when routable
      if (s.expectRoutable) {
        expect(out.payloadSha256Hex).toMatch(/^[0-9a-f]{64}$/);
        expect(out.routeId).toMatch(/^[0-9a-f]{64}$/);

        // payload must not include line1
        const line1 = s.content.split(/\r?\n/)[0];
        expect(out.payload.includes(line1)).toBe(false);
      }
    });
  }
});
