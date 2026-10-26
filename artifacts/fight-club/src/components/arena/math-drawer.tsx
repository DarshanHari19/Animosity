import type { Animal, MatchupResult } from "@workspace/api-client-react";
import { findFactor, formatNumber, isScored, signed, signedFactor } from "@/lib/arena";

const GATE_NOTE: Record<string, string> = {
  environmental_advantage: "one animal can't fight on this floor, so the environment gate settles it",
  behavior: "in the wild, the behavior gate ends the encounter before a fight",
};

/** Full factor math, with signs explained relative to the corners. */
export function MathDrawer({ red, blue, result, open, setOpen }: {
  red: Animal; blue: Animal; result: MatchupResult; open: boolean; setOpen: (open: boolean) => void;
}) {
  const size = findFactor(result, "Size");
  const bite = findFactor(result, "Bite force");
  const env = findFactor(result, "Environment");
  const scored = result.advantage_score !== null;
  const known = new Set(["Size", "Bite force", "Environment"]);
  const others = result.factors.filter((f) => !known.has(f.name));

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div>
        <button type="button" className="btn btn-ghost" style={{ minHeight: 46, padding: "0 20px", fontSize: 15 }}
          aria-expanded={open} aria-controls="math-drawer" onClick={() => setOpen(!open)} data-testid="button-toggle-math">
          {open ? "Hide the math" : "Why? Show the math"}
        </button>
      </div>
      {open && <div id="math-drawer" className="pop" data-testid="drawer-math"
        style={{ padding: "20px 22px", borderRadius: 12, background: "var(--panel)", border: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 8, fontFamily: "var(--mono)", fontSize: 14, lineHeight: 1.6, color: "var(--text-2)", overflowWrap: "anywhere" }}>
        {scored ? <>
          {size && <div data-testid="text-math-size">
            Size: 0.8 × (log2 {formatNumber(red.mass_kg)} − log2 {formatNumber(blue.mass_kg)}) = {signedFactor(size.value)}
            <div className="muted" style={{ fontFamily: "var(--body)", fontSize: 13 }}>{size.reason}</div>
          </div>}
          {bite && (isScored(bite)
            ? <div data-testid="text-math-bite">Bite force: 0.5 × (log2 {formatNumber(red.bite_force_n ?? 0)} − log2 {formatNumber(blue.bite_force_n ?? 0)}) = {signedFactor(bite.value)}
                <div className="muted" style={{ fontFamily: "var(--body)", fontSize: 13 }}>{bite.reason}</div></div>
            : <div data-testid="text-math-bite">Bite force: not compared = 0
                <div className="muted" style={{ fontFamily: "var(--body)", fontSize: 13 }}>{bite.reason}</div></div>)}
          {env ? <div data-testid="text-math-environment">Environment: hampered handicap = {signedFactor(env.value)}
            <div className="muted" style={{ fontFamily: "var(--body)", fontSize: 13 }}>{env.reason}</div></div>
            : <div data-testid="text-math-environment">Environment: no handicap = 0</div>}
          {others.map((f) => <div key={f.name}>{f.name}: {signedFactor(f.value)}
            <div className="muted" style={{ fontFamily: "var(--body)", fontSize: 13 }}>{f.reason}</div></div>)}
          <div style={{ paddingTop: 6, borderTop: "1px solid var(--line)", color: "var(--text)" }} data-testid="text-math-total">
            Total {signed(result.advantage_score!)}. A score of +0.5 or more favors the red corner; −0.5 or less favors the blue corner; anything between is too close to call.
          </div>
        </> : <>
          {result.factors.map((f) => <div key={f.name}>{f.name}: {signedFactor(f.value)}
            <div className="muted" style={{ fontFamily: "var(--body)", fontSize: 13 }}>{f.reason}</div></div>)}
          <div data-testid="text-math-total">
            No score was computed{result.deciding_factor && GATE_NOTE[result.deciding_factor] ? `: ${GATE_NOTE[result.deciding_factor]}` : ""}. The ±0.5 rule applies only to scored bouts.
          </div>
        </>}
      </div>}
    </section>
  );
}
