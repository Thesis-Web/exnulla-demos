import React, { useMemo, useState } from "react";
import type { AppState, ValidationIssue } from "./lib/types";
import { SAMPLES } from "./lib/samples";
import { simulate } from "./routes/simulate";
import { LandingAreas } from "./components/LandingAreas";

function isoNow() {
  return new Date().toISOString();
}

function issueBadge(i: ValidationIssue) {
  const t = i.severity.toUpperCase();
  return `${t}: ${i.code}`;
}

const DEFAULT_SAMPLE_ID = "valid-js";

function initialStateFromSample(sampleId: string): AppState {
  const sample = SAMPLES.find((s) => s.id === sampleId) ?? SAMPLES[0];
  return {
    filename: sample.filename,
    content: sample.content,
    normalizeCrlf: true,
    forceBinary: false,
    conflictPolicy: "overwrite",
    afterPolicy: "keep",
    targetSpec: null,
    payload: "",
    issues: [],
    plan: null,
    audit: [{ ts: isoNow(), action: "init", meta: { sampleId: sample.id } }],
    payloadSha256Hex: null,
    routeId: null,
    landings: { A: null, B: null },
  };
}

export function App() {
  const [sampleId, setSampleId] = useState(DEFAULT_SAMPLE_ID);
  const [state, setState] = useState<AppState>(() => initialStateFromSample(DEFAULT_SAMPLE_ID));
  const [busy, setBusy] = useState(false);

  const hasErrors = state.issues.some((i) => i.severity === "error");
  const statusText = useMemo(() => {
    if (busy) return "Simulating…";
    if (state.plan) return "Routable";
    if (hasErrors) return "Blocked";
    return "Ready";
  }, [busy, state.plan, hasErrors]);

  async function onLoadSample(id: string) {
    setSampleId(id);
    setState(initialStateFromSample(id));
  }

  async function onSimulate() {
    setBusy(true);
    try {
      const out = await simulate(state);
      setState(out);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <div className="title">Intent File Router</div>
          <div className="subtitle">deterministic routing simulator</div>
        </div>

        <div className="controls">
          <select
            className="select"
            value={sampleId}
            onChange={(e) => void onLoadSample(e.target.value)}
            aria-label="Sample"
          >
            {SAMPLES.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>

          <button className="btn primary" onClick={() => void onSimulate()} disabled={busy}>
            Simulate
          </button>

          <div className={`pill ${state.plan ? "ok" : hasErrors ? "bad" : "idle"}`}>
            {statusText}
          </div>
        </div>
      </header>

      <main className="grid">
        <section className="panel">
          <div className="panelHeader">Input</div>

          <div className="row">
            <label className="label">Filename</label>
            <input
              className="input"
              value={state.filename}
              onChange={(e) => setState((s) => ({ ...s, filename: e.target.value }))}
            />
          </div>

          <div className="row toggles">
            <label className="toggle">
              <input
                type="checkbox"
                checked={state.normalizeCrlf}
                onChange={(e) => setState((s) => ({ ...s, normalizeCrlf: e.target.checked }))}
              />
              normalize CRLF
            </label>

            <label className="toggle">
              <input
                type="checkbox"
                checked={state.forceBinary}
                onChange={(e) => setState((s) => ({ ...s, forceBinary: e.target.checked }))}
              />
              force binary
            </label>
          </div>

          <textarea
            className="textarea"
            value={state.content}
            onChange={(e) => setState((s) => ({ ...s, content: e.target.value }))}
            spellCheck={false}
          />
        </section>

        <section className="panel">
          <div className="panelHeader">Routing Plan</div>

          <div className="kv">
            <div className="k">Route ID</div>
            <div className="v mono">{state.routeId ?? "—"}</div>

            <div className="k">Payload SHA256</div>
            <div className="v mono">{state.payloadSha256Hex ?? "—"}</div>

            <div className="k">Target</div>
            <div className="v mono">
              {state.targetSpec
                ? `${state.targetSpec.repoKey} :: ${state.targetSpec.pathInRepo}`
                : "—"}
            </div>

            <div className="k">Remote dest</div>
            <div className="v mono">{state.plan?.remoteDest ?? "—"}</div>
          </div>

          <div className="divider" />

          <LandingAreas landings={state.landings} />

          <div className="divider" />

          {state.plan ? (
            <ol className="steps">
              {state.plan.steps.map((s, idx) => (
                <li key={idx}>
                  <div className="stepLabel">{s.label}</div>
                  <pre className="code">{s.command}</pre>
                </li>
              ))}
            </ol>
          ) : (
            <div className="hint">
              Run simulate to generate a plan. Errors/warnings show in the next panel.
            </div>
          )}
        </section>

        <section className="panel">
          <div className="panelHeader">Validation + Audit</div>

          {state.issues.length ? (
            <ul className="issues">
              {state.issues.map((i, idx) => (
                <li key={idx} className={`issue ${i.severity}`}>
                  <div className="issueTop">
                    <span className="issueBadge">{issueBadge(i)}</span>
                    <span className="issueMsg">{i.message}</span>
                  </div>
                  {i.details ? (
                    <pre className="code">{JSON.stringify(i.details, null, 2)}</pre>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <div className="hint">No issues.</div>
          )}

          <div className="divider" />

          <div className="auditTitle">Audit</div>
          <ul className="audit">
            {state.audit
              .slice()
              .reverse()
              .map((a, idx) => (
                <li key={idx} className="auditItem">
                  <span className="mono">{a.ts}</span>
                  <span className="auditAction">{a.action}</span>
                </li>
              ))}
          </ul>
        </section>
      </main>

      <footer className="footer">
        <span className="muted">
          Tip: header must be on <span className="mono">line 1</span> (// TARGET:, # TARGET:, or
          &lt;!-- TARGET: --&gt;).
        </span>
      </footer>
    </div>
  );
}
