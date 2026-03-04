import { describe, expect, test } from "vitest";
import { applyLanding, chooseLanding } from "../src/routes/landing";
import type { TargetSpec } from "../src/lib/types";

describe("landing.chooseLanding", () => {
  test("path override landing-a/", () => {
    const t: TargetSpec = { raw: "x", repoKey: "sims", pathInRepo: "landing-a/foo.md" };
    expect(chooseLanding(t)).toBe("A");
  });

  test("path override landing-b/", () => {
    const t: TargetSpec = { raw: "x", repoKey: "backend", pathInRepo: "landing-b/foo.md" };
    expect(chooseLanding(t)).toBe("B");
  });

  test("repoKey mapping", () => {
    const a: TargetSpec = { raw: "x", repoKey: "backend", pathInRepo: "x.md" };
    const b: TargetSpec = { raw: "x", repoKey: "devkit", pathInRepo: "x.md" };
    expect(chooseLanding(a)).toBe("A");
    expect(chooseLanding(b)).toBe("B");
  });
});

describe("landing.applyLanding", () => {
  test("latest wins + bounded .bak", () => {
    const e1 = { remoteDest: "/a", payload: "p1", payloadSha256Hex: "h1", ts: 1 };
    const e2 = { remoteDest: "/b", payload: "p2", payloadSha256Hex: "h2", ts: 2 };
    const e3 = { remoteDest: "/c", payload: "p3", payloadSha256Hex: "h3", ts: 3 };

    const s1 = applyLanding(null, e1, 2);
    expect(s1.remoteDest).toBe("/a");
    expect(s1.bak).toBeUndefined();

    const s2 = applyLanding(s1, e2, 2);
    expect(s2.remoteDest).toBe("/b");
    expect(s2.bak?.length).toBe(1);
    expect(s2.bak?.[0].remoteDest).toBe("/a");

    const s3 = applyLanding(s2, e3, 2);
    expect(s3.remoteDest).toBe("/c");
    expect(s3.bak?.length).toBe(2);
    expect(s3.bak?.[0].remoteDest).toBe("/b");
    expect(s3.bak?.[1].remoteDest).toBe("/a");
  });
});
