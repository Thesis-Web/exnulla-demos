import React from "react";
import type { LandingEntry } from "../routes/landing";

export type LandingAreasProps = {
  landings: { A: LandingEntry | null; B: LandingEntry | null };
};

function EntryView({ entry }: { entry: LandingEntry | null }) {
  if (!entry) return <div className="hint">—</div>;

  return (
    <div>
      <div className="kv">
        <div className="k">Dest</div>
        <div className="v mono">{entry.remoteDest}</div>

        <div className="k">Payload SHA256</div>
        <div className="v mono">{entry.payloadSha256Hex}</div>

        <div className="k">Payload</div>
        <div className="v">
          <pre className="code">{entry.payload || " "}</pre>
        </div>
      </div>

      {entry.bak?.length ? (
        <>
          <div className="divider" />
          <div className="hint">.bak (max {entry.bak.length})</div>
          <ol className="steps">
            {entry.bak.map((b, idx) => (
              <li key={idx}>
                <div className="stepLabel mono">{new Date(b.ts).toISOString()}</div>
                <div className="kv">
                  <div className="k">Dest</div>
                  <div className="v mono">{b.remoteDest}</div>

                  <div className="k">SHA256</div>
                  <div className="v mono">{b.payloadSha256Hex}</div>
                </div>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}

export function LandingAreas({ landings }: LandingAreasProps) {
  return (
    <div>
      <div className="divider" />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 12,
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div className="panelHeader">Landing A</div>
          <div className="hint mono">// TARGET: backend docs/notes.md</div>
          <EntryView entry={landings.A} />
        </div>

        <div style={{ minWidth: 0 }}>
          <div className="panelHeader">Landing B</div>
          <div className="hint mono">// TARGET: sims public/data/demo.json</div>
          <div className="hint mono">// TARGET: backend landing-b/public/data/demo.json</div>
          <EntryView entry={landings.B} />
        </div>
      </div>
    </div>
  );
}
