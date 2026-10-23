import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw } from "lucide-react";
import type { Animal, FightResponse } from "@workspace/api-client-react";
import { ArcadeBand } from "./arcade-band";
import { ArenaStage, PHASES, type Phase } from "./arena-stage";
import { FactLine } from "./fact-line";
import { actionTag, MODE_COPY, NARRATION_REASON, TERRAINS, type Selection } from "@/lib/arena";

export const BEAT_MS = 3000;
export const PHASE_MS = BEAT_MS / 4;
export const HOLD_MS = 1500;

export function BoutStage({ sel, red, blue, response, error, onRetry, reducedMotion, onVerdict }: {
  sel: Selection; red: Animal; blue: Animal; response: FightResponse | null; error: string | null;
  onRetry: () => void; reducedMotion: boolean; onVerdict: () => void;
}) {
  const beats = response?.beats ?? [];
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [showFacts, setShowFacts] = useState(false);
  const onVerdictRef = useRef(onVerdict);
  onVerdictRef.current = onVerdict;
  const last = beats.length - 1;

  const [phase, setPhase] = useState<Phase>("approach");

  // One timer at a time: four phases per beat, then a hold before the verdict.
  useEffect(() => {
    if (!playing || beats.length === 0) return;
    if (phase === "hold") {
      const t = window.setTimeout(() => onVerdictRef.current(), HOLD_MS);
      return () => window.clearTimeout(t);
    }
    const t = window.setTimeout(() => {
      const k = PHASES.indexOf(phase);
      if (k < PHASES.length - 1) setPhase(PHASES[k + 1]!);
      else if (index < last) { setIndex(index + 1); setPhase("approach"); }
      else setPhase("hold");
    }, PHASE_MS);
    return () => window.clearTimeout(t);
  }, [playing, index, phase, last, beats.length]);

  const goTo = (i: number) => { setIndex(i); setPhase(playing ? "approach" : "contact"); };

  const beat = beats[index] ?? null;
  const unavailable = response?.narration_status === "unavailable";
  const actorClass = beat?.animal === red.name ? "red" : beat?.animal === blue.name ? "blue" : "muted";

  return (
    <div className="page" data-testid="stage-bout">
      <ArcadeBand height={90} />
      <div className="wrap" style={{ gap: 24, paddingTop: 28 }}>
        <header style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h1 className="display" style={{ margin: 0, fontSize: 24, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }} data-testid="text-bout-title">
              <span className="red">{red.name}</span><span className="dim" style={{ fontSize: 18, textTransform: "none" }}> vs </span><span className="blue">{blue.name}</span>
            </h1>
            <div className="muted" style={{ fontSize: 14 }}>{TERRAINS[sel.environment].name} · {MODE_COPY[sel.mode].rules}</div>
          </div>
          {beats.length > 0 && <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div aria-hidden="true" style={{ display: "flex", gap: 8 }}>
              {beats.map((_, k) => (
                <div key={k} style={{
                  width: 12, height: 12, borderRadius: "50%",
                  background: k === index ? "var(--bronze)" : k < index ? "#8A7357" : "var(--line)",
                  boxShadow: k === index ? "0 0 0 3px #4A3B30" : undefined,
                }} />
              ))}
            </div>
            <div className="muted" style={{ fontSize: 14, fontWeight: 600 }} data-testid="text-progress">Beat {index + 1} of {beats.length}</div>
          </div>}
        </header>

        <ArenaStage red={red} blue={blue} environment={sel.environment} mode={sel.mode} beat={beat} reducedMotion={reducedMotion}
          phase={phase} paused={!playing} holding={phase === "hold"} />

        <section aria-live="polite" className="panel" data-testid="panel-beat"
          style={{ display: "flex", flexDirection: "column", gap: 14, padding: 24, borderColor: "var(--line)" }}>
          {error ? <div role="alert" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14 }} data-testid="status-fight-error">
            <span>Fight failed: {error}</span>
            <button type="button" className="btn btn-ghost" style={{ minHeight: 44 }} onClick={onRetry} data-testid="button-retry-fight">Try again</button>
          </div> : !response ? <div data-testid="status-fight-pending" aria-busy="true" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span className="muted">The officials are scoring the bout...</span>
            <div className="skeleton" style={{ height: 22, width: "80%" }} />
            <div className="skeleton" style={{ height: 22, width: "55%" }} />
          </div> : unavailable || !beat ? <div data-testid="text-narration-unavailable" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <span className="tag" style={{ alignSelf: "flex-start" }}>Narration unavailable</span>
            <p style={{ margin: 0, fontSize: 20, lineHeight: 1.45 }}>
              No play-by-play for this bout{response.narration_reason ? `: ${NARRATION_REASON[response.narration_reason] ?? "narration failed"}` : ""}.
            </p>
            <p className="muted" style={{ margin: 0, fontSize: 15 }}>The verdict still comes straight from the engine's scored factors.</p>
          </div> : <>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 10 }}>
              <span className="tag" data-testid="text-beat-action">{actionTag(beat.action)}</span>
              <span className={actorClass} style={{ fontSize: 14, fontWeight: 600 }} data-testid="text-beat-actor">{beat.animal ?? "No winner"}</span>
            </div>
            <p key={index} className="pop" style={{ margin: 0, fontSize: "clamp(18px, 2.4vw, 22px)", lineHeight: 1.45 }} data-testid="text-beat">{beat.text}</p>
            <div>
              <button type="button" className="btn-link" aria-expanded={showFacts} onClick={() => setShowFacts(!showFacts)} data-testid="button-toggle-facts">
                {showFacts ? "Hide facts" : "Show facts"}
              </button>
            </div>
            {showFacts && <ul style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }} className="muted" data-testid="list-facts">
              {beat.facts_used.map((f, i) => <li key={i}><FactLine fact={f} /></li>)}
            </ul>}
          </>}
        </section>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {beats.length > 0 && <>
              <button type="button" className="icon-btn" aria-label="Previous moment" disabled={index === 0}
                onClick={() => goTo(Math.max(0, index - 1))} data-testid="button-prev"><ChevronLeft size={22} aria-hidden="true" /></button>
              <button type="button" className="icon-btn icon-btn-main" aria-label={playing ? "Pause" : "Play"}
                onClick={() => setPlaying(!playing)} data-testid="button-play-pause">
                {playing ? <Pause size={22} aria-hidden="true" /> : <Play size={22} aria-hidden="true" />}
              </button>
              <button type="button" className="icon-btn" aria-label="Next moment" disabled={index >= last}
                onClick={() => goTo(Math.min(last, index + 1))} data-testid="button-next"><ChevronRight size={22} aria-hidden="true" /></button>
              <button type="button" className="icon-btn" aria-label="Replay"
                onClick={() => { setIndex(0); setPhase("approach"); setPlaying(true); }} data-testid="button-replay"><RotateCcw size={20} aria-hidden="true" /></button>
            </>}
            {response && ((beats.length > 0 && !playing && index === last) || beats.length === 0) && (
              <button type="button" className="btn btn-primary pop" style={{ minHeight: 50, fontSize: 17 }} onClick={onVerdict} data-testid="button-see-verdict">See the verdict</button>
            )}
          </div>
          {response && beats.length > 0 && (
            <button type="button" className="btn-link" onClick={onVerdict} data-testid="button-skip">Skip to the verdict</button>
          )}
        </div>
      </div>
    </div>
  );
}
