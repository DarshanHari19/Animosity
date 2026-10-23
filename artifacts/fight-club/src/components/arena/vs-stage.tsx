import type { Animal } from "@workspace/api-client-react";
import { ArcadeBand } from "./arcade-band";
import { AnimalFigure } from "./animal-figure";
import { cubeRootScale, formatMass, LEVELS, MODE_COPY, STYLE_LABEL, TERRAINS, type Selection } from "@/lib/arena";

function Fighter({ animal, side, scale, sel }: { animal: Animal; side: "red" | "blue"; scale: number; sel: Selection }) {
  const level = LEVELS[animal.environments[sel.environment]];
  const Heading = side === "red" ? "h1" : "h2";
  return (
    <div className={side === "red" ? "from-left" : "from-right"}
      style={{ flex: "1 1 360px", display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
      <div style={{ width: "100%", height: "clamp(170px, 30vw, 270px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
        <div data-testid={`vs-figure-${side}`} data-scale={scale.toFixed(3)}
          style={{ width: `${Math.round(100 * scale)}%`, maxWidth: Math.round(430 * scale), minWidth: 70 }}>
          <AnimalFigure animal={animal} facing={side === "red" ? "right" : "left"} />
        </div>
      </div>
      <div aria-hidden="true" style={{ width: "86%", height: 18, borderRadius: 4, background: "#BFA06E" }} />
      <div className={side} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, letterSpacing: ".16em", textTransform: "uppercase" }}>
        <span aria-hidden="true" className={`dot dot-${side}`} />{side === "red" ? "Red corner" : "Blue corner"}
      </div>
      <Heading className="display" style={{ margin: 0, fontSize: "clamp(28px, 5vw, 42px)", fontWeight: 700, letterSpacing: ".06em", textAlign: "center", textTransform: "uppercase", overflowWrap: "anywhere" }}
        data-testid={`text-vs-name-${side}`}>{animal.name}</Heading>
      <div className="muted" style={{ fontSize: 16, textAlign: "center" }}>
        {formatMass(animal.mass_kg)} · {STYLE_LABEL[animal.fighting_style]} · <span className={`tone-${level.tone}`}>{level.label}</span> {TERRAINS[sel.environment].short.toLowerCase()}
      </div>
    </div>
  );
}

export function VsStage({ sel, red, blue, onRing, onChange }: {
  sel: Selection; red: Animal; blue: Animal; onRing: () => void; onChange: () => void;
}) {
  const [rs, bs] = cubeRootScale(red.mass_kg, blue.mass_kg);
  return (
    <div className="page" data-testid="stage-vs">
      <ArcadeBand height={150} viewH={200} />
      <div className="wrap" style={{ alignItems: "center", gap: 36, paddingTop: 32 }}>
        <div className="enter" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
          <div className="eyebrow" style={{ letterSpacing: ".22em" }}>Sanctioned bout</div>
          <div className="muted" style={{ fontSize: 15 }} data-testid="text-vs-context">
            {TERRAINS[sel.environment].name} · {MODE_COPY[sel.mode].rules} · {MODE_COPY[sel.mode].tagline}
          </div>
        </div>
        <div style={{ width: "100%", display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "center", gap: 24 }}>
          <Fighter animal={red} side="red" scale={rs} sel={sel} />
          <div aria-hidden="true" style={{ flex: "0 0 auto", alignSelf: "center", display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "0 8px" }}>
            <div style={{ width: 2, height: 56, background: "#6B5638" }} />
            <div className="display slam" style={{ fontSize: 76, fontWeight: 700, color: "var(--bronze)", lineHeight: 1, animationDelay: ".35s" }}>VS</div>
            <div style={{ width: 2, height: 56, background: "#6B5638" }} />
          </div>
          <Fighter animal={blue} side="blue" scale={bs} sel={sel} />
        </div>
        <div className="dim" style={{ fontSize: 14, textAlign: "center" }}>Silhouettes drawn to scale by body mass.</div>
        <div className="enter enter-4" style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 16 }}>
          <button type="button" className="btn btn-primary" style={{ minHeight: 58, padding: "0 40px", fontSize: 20 }} onClick={onRing} data-testid="button-ring">Ring the bell</button>
          <button type="button" className="btn btn-ghost" style={{ minHeight: 58 }} onClick={onChange} data-testid="button-change">Change fighters</button>
        </div>
      </div>
    </div>
  );
}
