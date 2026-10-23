import type { MouseEvent, ReactElement } from "react";
import type { Animal } from "@workspace/api-client-react";
import { ArcadeBand } from "./arcade-band";
import {
  ENVIRONMENTS, formatMass, sourceLinks, sourceNote, LEVELS, MODE_COPY, MODES, STYLE_LABEL, TERRAINS, type Env, type Mode, type Selection,
} from "@/lib/arena";

const TERRAIN_ICON: Record<Env, ReactElement> = {
  land: <><circle cx="20" cy="13" r="6" /><path d="M4 32 H36" /><path d="M10 32 l2 -6 M14 32 l-1 -5 M26 32 l2 -6 M30 32 l-1 -5" /></>,
  shallow_water: <><path d="M11 29 V11 M15 29 V15 M27 29 V13" /><path d="M4 30 q4 -3 8 0 t8 0 t8 0 t8 0" /></>,
  deep_water: <><path d="M4 13 q4 -4 8 0 t8 0 t8 0 t8 0" /><path d="M4 21 q4 -4 8 0 t8 0 t8 0 t8 0" /><path d="M4 29 q4 -4 8 0 t8 0 t8 0 t8 0" /></>,
};

function scrollTo(id: string) {
  return (e: MouseEvent) => {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView?.({ behavior: "smooth", block: "start" });
  };
}

const SOURCE_FIELDS: [string, string][] = [
  ["mass_kg", "weight"], ["bite_force_n", "bite force"], ["environments", "environment levels"],
  ["fighting_style", "fighting style"], ["temperament", "temperament"],
];

/** Real per-animal trait references from the loaded profiles. */
function TraitSources({ list }: { list: Animal[] }) {
  return (
    <section id="trait-sources" aria-labelledby="traitSourcesTitle" style={{ display: "flex", flexDirection: "column", gap: 12, scrollMarginTop: 24 }}>
      <h2 id="traitSourcesTitle" className="display" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--bronze)" }}>Sources</h2>
      {list.length === 0 ? <p className="muted" style={{ margin: 0, fontSize: 14 }}>Sources appear once the animals load.</p> :
      <ul className="muted" style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 8, fontSize: 14, lineHeight: 1.5 }} data-testid="list-trait-sources">
        {list.flatMap((animal) => SOURCE_FIELDS.flatMap(([key, label]) => {
          const src = animal.field_sources[key];
          if (!src || !src.citation.trim() || /\bTODO\b/i.test(src.citation)) return [];
          const links = sourceLinks(src.citation);
          const note = links.length ? sourceNote(src.citation) : src.citation;
          return [<li key={`${animal.name}.${key}`}>
            {animal.name} {label}{src.tier !== null ? ` (tier ${src.tier})` : ""}
            {links.map((l) => <span key={l.href}> · <a href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a></span>)}
            {note && <span> {links.length ? `(${note})` : `· ${note}`}</span>}
          </li>];
        }))}
      </ul>}
    </section>
  );
}

function Corner({ side, label, value, animal, list, disabled, environment, onPick }: {
  side: "a" | "b"; label: string; value: string; animal: Animal | undefined; list: Animal[];
  disabled: boolean; environment: Env; onPick: (v: string) => void;
}) {
  const color = side === "a" ? "red" : "blue";
  const level = animal ? LEVELS[animal.environments[environment]] : null;
  return (
    <div className={`panel enter ${side === "a" ? "enter-1" : "enter-2"}`}
      style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 16, padding: 24 }}>
      <label htmlFor={`corner-${side}`} className={color}
        style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, letterSpacing: ".16em", textTransform: "uppercase" }}>
        <span aria-hidden="true" className={`dot dot-${color}`} />{label}
      </label>
      <select id={`corner-${side}`} className="corner-select" value={value} disabled={disabled}
        onChange={(e) => onPick(e.target.value)} data-testid={`select-animal-${side}`}>
        <option value="">Choose a fighter</option>
        {list.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
      </select>
      <dl style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12, margin: 0 }}>
        <div className="stat"><dt>Weight</dt><dd data-testid={`text-weight-${side}`}>{animal ? formatMass(animal.mass_kg) : "—"}</dd></div>
        <div className="stat"><dt>Style</dt><dd data-testid={`text-style-${side}`}>{animal ? STYLE_LABEL[animal.fighting_style] : "—"}</dd></div>
        <div className="stat"><dt>{TERRAINS[environment].short}</dt>
          <dd className={level ? `tone-${level.tone}` : undefined} data-testid={`text-level-${side}`}>{level ? level.label : "—"}</dd></div>
      </dl>
    </div>
  );
}

export function PickerStage({ list, loading, error, onRetry, sel, setSel, onStart }: {
  list: Animal[]; loading: boolean; error: string | null; onRetry: () => void;
  sel: Selection; setSel: (patch: Partial<Selection>) => void; onStart: () => void;
}) {
  const byName = (n: string) => list.find((x) => x.name === n);
  const ready = sel.a !== "" && sel.b !== "";
  const summary = ready
    ? `${sel.a} vs ${sel.b} · ${TERRAINS[sel.environment].name} · ${MODE_COPY[sel.mode].rules}`
    : `Pick both corners · ${TERRAINS[sel.environment].name} · ${MODE_COPY[sel.mode].rules}`;
  const disabled = list.length === 0;

  return (
    <div className="page">
      <ArcadeBand />
      <div className="wrap">
        <header className="enter" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div className="display" style={{ fontWeight: 700, fontSize: "clamp(34px, 6vw, 44px)", letterSpacing: ".12em", lineHeight: 1 }} data-testid="text-brand">ANIMOSITY</div>
            <div className="muted" style={{ fontSize: 16 }}>Who's favored, and why. Every number shows its source.</div>
          </div>
          <nav aria-label="Main" style={{ display: "flex", gap: 24, fontSize: 15, fontWeight: 500 }}>
            <a href="#how" onClick={scrollTo("how")} data-testid="link-how">How it works</a>
            <a href="#trait-sources" onClick={scrollTo("trait-sources")} data-testid="link-sources">Sources</a>
          </nav>
        </header>

        <section aria-labelledby="fighters" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div className="eyebrow">Tonight's bout</div>
            <h1 id="fighters" className="display" style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>Choose your fighters</h1>
          </div>
          {loading && <div data-testid="status-animals-loading" aria-busy="true" style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
            <span className="sr-only-x">Loading animals...</span>
            <div className="skeleton" style={{ flex: "1 1 320px", height: 190 }} />
            <div className="skeleton" style={{ flex: "1 1 320px", height: 190 }} />
          </div>}
          {error && <div role="alert" className="panel" data-testid="status-animals-error"
            style={{ padding: 18, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, borderColor: "var(--cannot)" }}>
            <span>Could not load animals: {error}</span>
            <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={onRetry} data-testid="button-retry-animals">Retry</button>
          </div>}
          {!loading && !error && list.length === 0 && <div className="panel muted" style={{ padding: 18 }} data-testid="status-animals-empty">No animals available.</div>}
          {!loading && <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20 }}>
            <Corner side="a" label="Red corner" value={sel.a} animal={byName(sel.a)} list={list} disabled={disabled}
              environment={sel.environment} onPick={(a) => setSel({ a })} />
            <div aria-hidden="true" className="display" style={{ flex: "0 0 auto", margin: "0 auto", width: 88, height: 88, borderRadius: "50%", border: "2px solid var(--bronze)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, fontWeight: 700, color: "var(--bronze)" }}>VS</div>
            <Corner side="b" label="Blue corner" value={sel.b} animal={byName(sel.b)} list={list} disabled={disabled}
              environment={sel.environment} onPick={(b) => setSel({ b })} />
          </div>}
        </section>

        <section aria-labelledby="floor" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <h2 id="floor" className="display" style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Set the arena floor</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {ENVIRONMENTS.map((env) => (
              <button key={env} type="button" className="terrain-card" aria-pressed={sel.environment === env}
                onClick={() => setSel({ environment: env })} data-testid={`button-terrain-${env}`}>
                <svg aria-hidden="true" width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#C99A4E" strokeWidth="2" strokeLinecap="round">{TERRAIN_ICON[env]}</svg>
                <span className="display" style={{ fontSize: 20, fontWeight: 700 }}>{TERRAINS[env].name}</span>
                <span className="muted" style={{ fontSize: 14 }}>{TERRAINS[env].blurb}</span>
              </button>
            ))}
          </div>
        </section>

        <section aria-labelledby="rules" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 id="rules" className="display" style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Rules of the bout</h2>
          <div role="group" aria-label="Rules of the bout" style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {MODES.map((m: Mode) => (
              <button key={m} type="button" className="pill" aria-pressed={sel.mode === m}
                onClick={() => setSel({ mode: m })} data-testid={`mode-${m === "realistic" ? "realistic" : "forced-fight"}`}>
                {MODE_COPY[m].label}
              </button>
            ))}
          </div>
          <p className="muted" style={{ margin: 0, fontSize: 15 }} data-testid="text-mode-caption">{MODE_COPY[sel.mode].caption}</p>
        </section>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 20, borderTop: "1px solid var(--stone-band)", paddingTop: 24 }}>
          <button type="button" className="btn btn-primary" style={{ minHeight: 58, padding: "0 40px", fontSize: 20 }}
            disabled={!ready} onClick={onStart} data-testid="button-start">Start the bout</button>
          <span className="muted" style={{ fontSize: 15 }} data-testid="text-summary">{summary}</span>
        </div>

        <section id="how" aria-labelledby="howTitle" style={{ display: "flex", flexDirection: "column", gap: 16, scrollMarginTop: 24 }}>
          <h2 id="howTitle" className="display" style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--bronze)" }}>How it works</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {[
              ["1. Code decides", "The engine scores body mass, the arena floor, and bite force when the numbers are comparable."],
              ["2. Honest verdicts", "It names who's favored, or says it's too close to call. No made-up percentages."],
              ["3. The bout, with receipts", "AI narrates the fight, and every line cites the facts it's based on."],
            ].map(([t, d]) => (
              <div key={t} style={{ flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontWeight: 600, fontSize: 15 }}>{t}</div>
                <div className="muted" style={{ fontSize: 14, lineHeight: 1.5 }}>{d}</div>
              </div>
            ))}
          </div>
          <div className="dim" style={{ fontSize: 13 }}>Assumes adult males. All matchups are hypothetical. Trait values carry field-level citations; each verdict lists the ones it used.</div>
        </section>

        <TraitSources list={list} />
      </div>
    </div>
  );
}
