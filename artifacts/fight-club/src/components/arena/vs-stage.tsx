import type { Animal } from "@workspace/api-client-react";
import { ArcadeBand } from "./arcade-band";
import { AnimalFigure } from "./animal-figure";
import { cubeRootScale, formatMass, LEVELS, MODE_COPY, STYLE_LABEL, TERRAINS, type Selection } from "@/lib/arena";

function Fighter({ animal, side, scale, sel }: { animal: Animal; side: "red" | "blue"; scale: number; sel: Selection }) {
  const level = LEVELS[animal.environments[sel.environment]];
  const Heading = side === "red" ? "h1" : "h2";
  return (
    <div className={`vs-fighter ${side === "red" ? "from-left" : "from-right"}`}>
      <div className="vs-figbox">
        <div className="vs-figure" data-testid={`vs-figure-${side}`} data-scale={scale.toFixed(3)}
          style={{ width: `${Math.round(100 * scale)}%`, maxWidth: Math.round(430 * scale) }}>
          <AnimalFigure animal={animal} facing={side === "red" ? "right" : "left"} />
        </div>
      </div>
      <div aria-hidden="true" className="vs-plank" />
      <div className={`${side} vs-corner`}>
        <span aria-hidden="true" className={`dot dot-${side}`} />{side === "red" ? "Red corner" : "Blue corner"}
      </div>
      <Heading className="display vs-name"
        data-testid={`text-vs-name-${side}`}>{animal.name}</Heading>
      <div className="muted vs-meta">
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
      <div className="vs-band"><ArcadeBand height={150} viewH={200} /></div>
      <div className="wrap vs-wrap">
        <div className="enter" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8, textAlign: "center" }}>
          <div className="eyebrow" style={{ letterSpacing: ".22em" }}>Sanctioned bout</div>
          <div className="muted" style={{ fontSize: 15 }} data-testid="text-vs-context">
            {TERRAINS[sel.environment].name} · {MODE_COPY[sel.mode].rules} · {MODE_COPY[sel.mode].tagline}
          </div>
        </div>
        <div className="vs-row">
          <Fighter animal={red} side="red" scale={rs} sel={sel} />
          <div aria-hidden="true" className="vs-divider">
            <div className="vs-rule" />
            <div className="display slam vs-text" style={{ animationDelay: ".35s" }}>VS</div>
            <div className="vs-rule" />
          </div>
          <Fighter animal={blue} side="blue" scale={bs} sel={sel} />
        </div>
        <div className="dim" style={{ fontSize: 14, textAlign: "center" }}>Silhouettes drawn to scale by body mass.</div>
        <div className="enter enter-4 vs-actions">
          <button type="button" className="btn btn-primary vs-ring" onClick={onRing} data-testid="button-ring">Ring the bell</button>
          <button type="button" className="btn btn-ghost vs-change" onClick={onChange} data-testid="button-change">Change fighters</button>
        </div>
      </div>
    </div>
  );
}
