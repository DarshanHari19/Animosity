import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Animal, FightResponse } from "@workspace/api-client-react";
import { ArcadeBand } from "./arcade-band";
import { TaleOfTheTape } from "./tale-of-the-tape";
import { MathDrawer } from "./math-drawer";
import {
  buildSources, splitFinish, ENCOUNTER_LABEL, EVIDENCE_LABEL, findFactor, NARRATION_REASON, outcomeTitle, TERRAINS, type Selection,
} from "@/lib/arena";

function verdictSentence(response: FightResponse, red: Animal, blue: Animal, sel: Selection): string | null {
  if (response.explanation) return response.explanation;
  const { outcome, deciding_factor } = response.result;
  if (outcome.kind === "even") return "Scored factors (body mass, comparable bite force, environment) don't separate these two.";
  if (outcome.kind !== "favored") return null;
  if (deciding_factor === "environmental_advantage") {
    const other = outcome.animal === red.name ? blue.name : red.name;
    return `${outcome.animal} is favored: ${other} can't fight ${TERRAINS[sel.environment].short.toLowerCase()}.`;
  }
  const size = findFactor(response.result, "Size");
  return `${outcome.animal} is favored on the scored factors.${size ? ` ${size.reason}` : ""}`;
}

export function VerdictStage({ sel, red, blue, response, onRematch, onNew }: {
  sel: Selection; red: Animal; blue: Animal; response: FightResponse; onRematch: () => void; onNew: () => void;
}) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  const timer = useRef<number | null>(null);
  useEffect(() => () => { if (timer.current !== null) window.clearTimeout(timer.current); }, []);
  const result = response.result;
  const finish = [...response.beats].reverse().find((b) => b.action === "finish")?.text ?? null;
  const split = finish ? splitFinish(finish, result.outcome) : { climax: null, verdict: null };
  const climax = split.climax;
  const sentence = split.verdict ?? verdictSentence(response, red, blue, sel);
  const sources = buildSources(response, red, blue);

  async function share() {
    if (timer.current !== null) window.clearTimeout(timer.current);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(window.location.href);
      setCopied("ok");
    } catch {
      setCopied("fail");
    }
    timer.current = window.setTimeout(() => setCopied("idle"), 2600);
  }

  const chips: ReactNode[] = [
    EVIDENCE_LABEL[result.evidence_quality], ENCOUNTER_LABEL[result.encounter_label], "Assumes adult males",
  ].map((c) => <span key={c} className="chip" data-testid="chip-verdict">{c}</span>);

  return (
    <div className="page" data-testid="stage-verdict">
      <ArcadeBand height={90} />
      <div className="wrap wrap-narrow" style={{ gap: 32, paddingTop: 40 }}>
        <section className="enter" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, textAlign: "center" }}>
          <div className="eyebrow" style={{ letterSpacing: ".22em" }}>The verdict</div>
          <h1 className="display slam" style={{ margin: 0, fontSize: "clamp(34px, 6vw, 52px)", fontWeight: 700, letterSpacing: ".04em", lineHeight: 1.1 }} data-testid="text-outcome">
            {outcomeTitle(result.outcome)}
          </h1>
          {climax && <p style={{ margin: 0, maxWidth: 680, fontSize: 20, lineHeight: 1.5, fontStyle: "italic", color: "var(--text-2)" }} data-testid="text-climax">{climax}</p>}
          {sentence && <p className="muted" style={{ margin: 0, maxWidth: 680, fontSize: 16, lineHeight: 1.5 }} data-testid="text-explanation">{sentence}</p>}
          {response.narration_status === "unavailable" && (
            <p style={{ margin: 0, fontSize: 14, color: "var(--hampered)" }} data-testid="text-narration-unavailable">
              Narration unavailable{response.narration_reason ? `: ${NARRATION_REASON[response.narration_reason] ?? "narration failed"}` : ""}. The verdict is unaffected.
            </p>
          )}
          <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 8, paddingTop: 4 }}>{chips}</div>
        </section>

        <div className="enter enter-2"><TaleOfTheTape sel={sel} red={red} blue={blue} result={result} /></div>

        <MathDrawer red={red} blue={blue} result={result} />

        <section aria-labelledby="sources" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <h2 id="sources" className="display" style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "var(--bronze)" }}>Sources</h2>
          <ul className="muted" style={{ margin: 0, padding: "0 0 0 18px", display: "flex", flexDirection: "column", gap: 8, fontSize: 14, lineHeight: 1.5 }} data-testid="list-sources">
            {sources.map((s) => (
              <li key={s.key}>
                {s.text}
                {s.links.map((l) => <span key={l.href}> · <a href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a></span>)}
                {s.note && <span> {s.links.length ? `(${s.note})` : `· ${s.note}`}</span>}
              </li>
            ))}
            <li>Scores and gates · Animosity engine; see How it works on the picker</li>
          </ul>
        </section>

        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 14, paddingTop: 20, borderTop: "1px solid var(--stone-band)" }}>
          <button type="button" className="btn btn-primary" onClick={onRematch} data-testid="button-rematch">Rematch</button>
          <button type="button" className="btn btn-ghost" onClick={onNew} data-testid="button-new">New matchup</button>
          <button type="button" className="btn btn-ghost" onClick={share} data-testid="button-share">Share this bout</button>
          <span role="status" aria-live="polite" className={copied === "ok" ? "pop" : undefined}
            style={{ fontSize: 15, color: copied === "fail" ? "var(--cannot)" : "var(--full)" }} data-testid="status-share">
            {copied === "ok" ? "Link copied." : copied === "fail" ? "Could not copy. Copy the address bar instead." : ""}
          </span>
        </div>
      </div>
    </div>
  );
}
