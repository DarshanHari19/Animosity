import type { ReactNode } from "react";
import type { Animal, MatchupResult } from "@workspace/api-client-react";
import {
  edgeSide, findFactor, formatBite, formatMass, isScored, LEVELS, STYLE_LABEL, TERRAINS, type Selection, type Side,
} from "@/lib/arena";

function Cell({ side, edge, children, tone }: { side: Side; edge: boolean; children: ReactNode; tone?: string }) {
  const value = <span style={{ fontSize: "clamp(18px, 3vw, 24px)", fontWeight: 600, color: tone }}>{children}</span>;
  const tag = edge ? <span className="edge" data-testid={`edge-${side}`}>EDGE</span> : null;
  return side === "red"
    ? <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, textAlign: "right", flexWrap: "wrap" }}>{tag}{value}</div>
    : <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>{value}{tag}</div>;
}

function Row({ id, label, red, blue, edge, note, redTone, blueTone }: {
  id: string; label: string; red: ReactNode; blue: ReactNode; edge: Side | null; note: string;
  redTone?: string; blueTone?: string;
}) {
  return (
    <div style={{ borderTop: "1px solid var(--line-2)", padding: "18px 0", display: "flex", flexDirection: "column", gap: 8 }} data-testid={`row-tape-${id}`}>
      <div className="tape-row">
        <Cell side="red" edge={edge === "red"} tone={redTone}>{red}</Cell>
        <div className="tape-label">{label}</div>
        <Cell side="blue" edge={edge === "blue"} tone={blueTone}>{blue}</Cell>
      </div>
      <div className="muted" style={{ textAlign: "center", fontSize: 14 }} data-testid={`text-tape-note-${id}`}>{note}</div>
    </div>
  );
}

const TONE = { full: "var(--full)", hampered: "var(--hampered)", cannot: "var(--cannot)" };

export function TaleOfTheTape({ sel, red, blue, result }: { sel: Selection; red: Animal; blue: Animal; result: MatchupResult }) {
  const { outcome } = result;
  const size = findFactor(result, "Size");
  const bite = findFactor(result, "Bite force");
  const env = findFactor(result, "Environment");
  const sizeEdge = edgeSide(size, outcome);
  const winnerSide: Side | null = outcome.kind === "favored" ? (outcome.animal === red.name ? "red" : "blue") : null;
  const sizeDecides = !!size && result.deciding_factor === "fighting_ability" && Math.abs(size.value) >= 0.5 && sizeEdge === winnerSide;

  const weightNote = !size ? "Not scored: this bout was settled before size was weighed."
    : `${size.reason} Scored${sizeDecides ? ", and it decides this bout" : ""}.`;
  const biteNote = !bite ? "Not scored: this bout was settled before bite force was weighed."
    : isScored(bite) ? "Scored. Compares bites to bites, not bites against defenses."
      : red.bite_force_n === null || blue.bite_force_n === null ? "Not compared: one value is missing."
        : "Not compared: the values come from different source tiers.";
  const rl = red.environments[sel.environment];
  const bl = blue.environments[sel.environment];
  const envNote = env ? `Scored. ${env.reason}`
    : rl === "cannot" || bl === "cannot" ? "Can't fight on this floor: that settles the bout before anything is scored."
      : rl === "full" && bl === "full" ? "No handicap for either animal on this floor."
        : "Hampered on this floor, but not scored for this outcome.";

  return (
    <section aria-labelledby="tape" style={{ display: "flex", flexDirection: "column", padding: "clamp(18px, 4vw, 28px)", borderRadius: 16, background: "var(--panel-2)", border: "2px solid #6B5638" }} data-testid="section-tape">
      <h2 id="tape" className="display" style={{ margin: "0 0 20px", textAlign: "center", fontSize: 22, fontWeight: 700, letterSpacing: ".18em", color: "var(--bronze)" }}>TALE OF THE TAPE</h2>
      <div className="tape-row" style={{ alignItems: "end", paddingBottom: 16 }}>
        <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <span className="red" style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".16em", textTransform: "uppercase" }}>Red corner</span>
          <span className="display" style={{ fontSize: 22, fontWeight: 700 }}>{red.name}</span>
        </div>
        <div aria-hidden="true" />
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 4 }}>
          <span className="blue" style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".16em", textTransform: "uppercase" }}>Blue corner</span>
          <span className="display" style={{ fontSize: 22, fontWeight: 700 }}>{blue.name}</span>
        </div>
      </div>
      <Row id="weight" label="WEIGHT" red={formatMass(red.mass_kg)} blue={formatMass(blue.mass_kg)} edge={sizeEdge} note={weightNote} />
      <Row id="bite" label="BITE FORCE" red={formatBite(red.bite_force_n)} blue={formatBite(blue.bite_force_n)} edge={edgeSide(bite, outcome)} note={biteNote}
        redTone={red.bite_force_n === null ? "var(--dim)" : undefined} blueTone={blue.bite_force_n === null ? "var(--dim)" : undefined} />
      <Row id="environment" label={TERRAINS[sel.environment].upper} red={LEVELS[rl].label} blue={LEVELS[bl].label}
        edge={edgeSide(env, outcome)} note={envNote} redTone={TONE[rl]} blueTone={TONE[bl]} />
      <Row id="style" label="STYLE" red={STYLE_LABEL[red.fighting_style]} blue={STYLE_LABEL[blue.fighting_style]} edge={null}
        note="Shapes the narration only. Not scored yet." />
    </section>
  );
}
