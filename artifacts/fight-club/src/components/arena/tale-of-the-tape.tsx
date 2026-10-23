import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import type { Animal, MatchupResult } from "@workspace/api-client-react";
import {
  edgeSide, findFactor, formatBite, formatMass, isScored, LEVELS, signed, sourceLinks, sourceNote, STYLE_LABEL, TERRAINS,
  type Selection, type Side,
} from "@/lib/arena";

export type RowLabel = "Scored" | "Context" | "Not compared" | "Not modeled yet";
const LABEL_CLASS: Record<RowLabel, string> = {
  Scored: "row-label-scored", Context: "row-label-context",
  "Not compared": "row-label-not-compared", "Not modeled yet": "row-label-not-modeled",
};

export const TIER_LABEL: Record<number, string> = { 1: "Measured", 2: "Modeled estimate", 3: "Reference summary" };

function Cell({ side, edge, children, tone }: { side: Side; edge: boolean; children: ReactNode; tone?: string }) {
  const value = <span style={{ fontSize: "clamp(18px, 3vw, 24px)", fontWeight: 600, color: tone }}>{children}</span>;
  const tag = edge ? <span className="edge" data-testid={`edge-${side}`}>EDGE</span> : null;
  return side === "red"
    ? <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 10, textAlign: "right", flexWrap: "wrap" }}>{tag}{value}</div>
    : <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>{value}{tag}</div>;
}

function SourceList({ id, field, red, blue, caveat }: { id: string; field: string; red: Animal; blue: Animal; caveat?: string }) {
  return (
    <div data-testid={`list-row-sources-${id}`}>
      <div className="eyebrow" style={{ fontSize: 11, marginBottom: 6 }}>Sources</div>
      <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 4 }}>
        {[red, blue].map((a, i) => {
          const src = a.field_sources[field];
          const usable = src && src.citation.trim() && !/\bTODO\b/i.test(src.citation);
          if (!usable) return <li key={i} data-testid={`text-source-${id}-${i}`}>{a.name}: source unknown</li>;
          const links = sourceLinks(src.citation);
          const note = links.length ? sourceNote(src.citation) : src.citation;
          const tier = TIER_LABEL[src.tier as number];
          return (
            <li key={i} data-testid={`text-source-${id}-${i}`}>
              {a.name}: <strong>{tier ? `Tier ${src.tier}, ${tier}` : "Tier unknown"}</strong>
              {links.map((l) => <span key={l.href}> · <a href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a></span>)}
              {note && <span> · {note}</span>}
            </li>
          );
        })}
      </ul>
      {caveat && <p className="muted" style={{ margin: "6px 0 0", fontSize: 13 }}>{caveat}</p>}
    </div>
  );
}

function Row({ id, label, rowLabel, red, blue, edge, note, redTone, blueTone, children }: {
  id: string; label: string; rowLabel: RowLabel; red: ReactNode; blue: ReactNode; edge: Side | null; note: string;
  redTone?: string; blueTone?: string; children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderTop: "1px solid var(--line-2)", padding: "18px 0", display: "flex", flexDirection: "column", gap: 8 }} data-testid={`row-tape-${id}`}>
      <div className="tape-row">
        <Cell side="red" edge={edge === "red"} tone={redTone}>{red}</Cell>
        <div className="tape-label">{label}</div>
        <Cell side="blue" edge={edge === "blue"} tone={blueTone}>{blue}</Cell>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", alignItems: "center", gap: 10 }}>
        <span className={`row-label ${LABEL_CLASS[rowLabel]}`} data-testid={`label-tape-${id}`}>{rowLabel}</span>
        <span className="muted" style={{ fontSize: 14 }} data-testid={`text-tape-note-${id}`}>{note}</span>
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <button type="button" className="row-toggle" aria-expanded={open} aria-controls={`detail-${id}`}
          onClick={() => setOpen(!open)} data-testid={`button-expand-${id}`}>
          {open ? "Hide breakdown" : "Breakdown"} <span className="sr-only-x">for {label.toLowerCase()}</span>
          <ChevronDown size={16} aria-hidden="true" style={{ transform: open ? "rotate(180deg)" : undefined, transition: "transform .2s ease" }} />
        </button>
      </div>
      {open && <div id={`detail-${id}`} className="row-detail pop" data-testid={`detail-tape-${id}`}>{children}</div>}
    </div>
  );
}

const TONE = { full: "var(--full)", hampered: "var(--hampered)", cannot: "var(--cannot)" };

function MathLink({ onShowMath }: { onShowMath: () => void }) {
  return <a href="#math-drawer" onClick={(e) => {
    e.preventDefault(); onShowMath();
    window.setTimeout(() => document.getElementById("math-drawer")?.scrollIntoView?.({ block: "nearest" }), 0);
  }} data-testid="link-full-math" style={{ fontWeight: 600, alignSelf: "flex-start" }}>See the full math</a>;
}

export function TaleOfTheTape({ sel, red, blue, result, onShowMath }: {
  sel: Selection; red: Animal; blue: Animal; result: MatchupResult; onShowMath: () => void;
}) {
  const { outcome } = result;
  const scored = result.advantage_score !== null;
  const size = findFactor(result, "Size");
  const bite = findFactor(result, "Bite force");
  const env = findFactor(result, "Environment");
  const sizeEdge = edgeSide(size, outcome);
  const winnerSide: Side | null = outcome.kind === "favored" ? (outcome.animal === red.name ? "red" : "blue") : null;
  const sizeDecides = !!size && result.deciding_factor === "fighting_ability" && Math.abs(size.value) >= 0.5 && sizeEdge === winnerSide;

  const weightNote = !size ? "Not scored: this bout was settled before size was weighed."
    : `${size.reason} Scored${sizeDecides ? ", and it decides this bout" : ""}.`;
  const unusable = [red, blue].filter((a) => a.bite_force_n === null || !(a.bite_force_n > 0));
  const biteMissing = unusable.length > 0;
  const tierNum = (a: Animal) => { const t = a.field_sources.bite_force_n?.tier as number | undefined; return t && TIER_LABEL[t] ? t : null; };
  const unknownTier = [red, blue].filter((a) => tierNum(a) === null);
  const biteNote = !bite ? "Not scored: this bout was settled before bite force was weighed."
    : isScored(bite) ? "Scored. Compares bites to bites, not bites against defenses."
      : biteMissing ? "Not compared: one value is missing."
        : unknownTier.length ? "Not compared: a source tier is unknown."
          : "Not compared: the values come from different source tiers.";
  const rl = red.environments[sel.environment];
  const bl = blue.environments[sel.environment];
  const cannotAnimal = rl === "cannot" ? red.name : bl === "cannot" ? blue.name : null;
  // Environment decides via a gate (no number) when an animal can't fight here, unless behavior gated first.
  const envGate = result.deciding_factor === "environmental_advantage"
    || (!scored && !!cannotAnimal && result.deciding_factor !== "behavior");
  const envNote = envGate
    ? "Scored as a gate: one animal can't fight on this floor, which decided the bout before numeric scoring."
    : env ? `Scored. ${env.reason}`
      : scored ? (rl === bl && rl === "hampered" ? "Scored. Both hampered, so the handicaps cancel." : "Scored. No handicap for either animal on this floor.")
        : "Shown for context. This bout was settled before the environment was weighed.";

  const weightLabel: RowLabel = size ? "Scored" : "Context";
  const biteLabel: RowLabel = !bite ? "Context" : isScored(bite) ? "Scored" : "Not compared";
  const envLabel: RowLabel = envGate || scored ? "Scored" : "Context";

  const heavy = Math.max(red.mass_kg, blue.mass_kg);
  const light = Math.min(red.mass_kg, blue.mass_kg);
  const ratio = light > 0 ? Math.round((heavy / light) * 10) / 10 : null;
  const heavier = red.mass_kg >= blue.mass_kg ? red.name : blue.name;
  const lighter = heavier === red.name ? blue.name : red.name;
  const tierOf = (a: Animal) => { const t = tierNum(a); return t ? `tier ${t} (${TIER_LABEL[t]})` : "an unknown tier"; };
  // Plain words from the displayed source metadata; the engine's own reason is shown alongside. No re-comparison.
  const biteWhy = biteMissing
    ? `${unusable.map((a) => a.name).join(" and ")} ${unusable.length > 1 ? "have" : "has"} no usable bite force value.`
    : unknownTier.length
      ? `${unknownTier.map((a) => a.name).join(" and ")} ${unknownTier.length > 1 ? "have" : "has"} no known source tier for bite force, so the tiers cannot be confirmed as matching.`
      : tierNum(red) !== tierNum(blue)
        ? `${red.name} is from ${tierOf(red)} and ${blue.name} is from ${tierOf(blue)}: different tiers, so the engine does not compare them.`
        : "The source metadata shown here does not explain it further.";
  const terrain = TERRAINS[sel.environment];

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

      <Row id="weight" label="WEIGHT" rowLabel={weightLabel} red={formatMass(red.mass_kg)} blue={formatMass(blue.mass_kg)} edge={sizeEdge} note={weightNote}>
        <p style={{ margin: 0 }}>In this model, body mass stands in for reach, power, and how hard an animal is to move. The engine compares the log of each mass, so doubling weight adds the same amount whatever the starting size.</p>
        {ratio !== null && red.mass_kg === blue.mass_kg && <p style={{ margin: 0 }} data-testid="text-detail-ratio">Both animals have the same listed mass.</p>}
        {ratio !== null && red.mass_kg !== blue.mass_kg && <p style={{ margin: 0 }} data-testid="text-detail-ratio">{heavier} outweighs {lighter} about {ratio} to 1. This ratio is shown for reading only; it is not a second score.</p>}
        {size
          ? <p style={{ margin: 0, fontFamily: "var(--mono)" }} data-testid="text-detail-factor-weight">Size factor from the engine: {signed(size.value)}. {size.reason}</p>
          : <p style={{ margin: 0 }}>Not counted: this bout was decided by a gate before size was weighed. Weight is shown for context only.</p>}
        <SourceList id="weight" field="mass_kg" red={red} blue={blue} />
        <MathLink onShowMath={onShowMath} />
      </Row>

      <Row id="bite" label="BITE FORCE" rowLabel={biteLabel} red={formatBite(red.bite_force_n)} blue={formatBite(blue.bite_force_n)} edge={edgeSide(bite, outcome)} note={biteNote}
        redTone={red.bite_force_n === null ? "var(--dim)" : undefined} blueTone={blue.bite_force_n === null ? "var(--dim)" : undefined}>
        <p style={{ margin: 0 }}>Bite force is compared only bite to bite, and only when both values exist at the same source tier, so a measured bite is never weighed against an estimate.</p>
        {!bite ? <p style={{ margin: 0 }}>Not counted: this bout was decided by a gate before bite force was weighed.</p>
          : isScored(bite) ? <p style={{ margin: 0, fontFamily: "var(--mono)" }} data-testid="text-detail-factor-bite">Bite force factor from the engine: {signed(bite.value)}. {bite.reason}</p>
            : <p style={{ margin: 0 }} data-testid="text-detail-bite-reason">
              Not compared, so it counts for nothing in this verdict.{" "}
              {biteWhy}
              {" "}Engine note: {bite.reason}
            </p>}
        <SourceList id="bite" field="bite_force_n" red={red} blue={blue} />
        <MathLink onShowMath={onShowMath} />
      </Row>

      <Row id="environment" label={terrain.upper} rowLabel={envLabel} red={LEVELS[rl].label} blue={LEVELS[bl].label}
        edge={edgeSide(env, outcome)} note={envNote} redTone={TONE[rl]} blueTone={TONE[bl]}>
        <p style={{ margin: 0 }}>{terrain.name} — {red.name}: {LEVELS[rl].label}; {blue.name}: {LEVELS[bl].label}.</p>
        <p style={{ margin: 0 }}>Hampered means worse footing, less speed, and weaker grappling on this floor. Can't fight means the animal cannot function here at all.</p>
        {envGate
          ? <p style={{ margin: 0 }} data-testid="text-detail-env">Environment gate: {cannotAnimal ?? "one animal"} can't fight {terrain.short.toLowerCase()}. The gate has no numeric factor and no score; it decided the bout before numeric scoring began.</p>
          : env && env.value !== 0
            ? <p style={{ margin: 0, fontFamily: "var(--mono)" }} data-testid="text-detail-env">The engine applied its 0.8 hampered handicap: environment factor {signed(env.value)}. {env.reason}</p>
            : scored
              ? <p style={{ margin: 0 }} data-testid="text-detail-env">{rl === "hampered" && bl === "hampered" ? "Both animals are hampered, so the handicaps cancel: net 0." : "No handicap applied: environment factor 0."}</p>
              : <p style={{ margin: 0 }} data-testid="text-detail-env">Not counted: this bout was decided by another gate before the environment was weighed.</p>}
        <SourceList id="environment" field="environments" red={red} blue={blue}
          caveat="Environment levels are model assumptions about each animal, not measured abilities." />
        <MathLink onShowMath={onShowMath} />
      </Row>

      <Row id="style" label="STYLE" rowLabel="Not modeled yet" red={STYLE_LABEL[red.fighting_style]} blue={STYLE_LABEL[blue.fighting_style]} edge={null}
        note="Shapes the narration only. Not scored yet.">
        <p style={{ margin: 0 }}>Fighting style shapes the narration. It receives no numerical advantage score; no fighting-style advantage is inferred.</p>
        <SourceList id="style" field="fighting_style" red={red} blue={blue} />
      </Row>
    </section>
  );
}
