import { useEffect, useRef, useState } from "react";
import { useCreateFight, useGetAnimals, getGetAnimalsQueryKey } from "@workspace/api-client-react";
import type { FightInputEnvironment, FightInputMode, FightResponse } from "@workspace/api-client-react";
import { StickFigure } from "@/components/stick-figure";
import { MatchupResultCard } from "@/components/matchup-result";
import { ReadableFact } from "@/components/readable-fact";

const BEAT_MS = 1500;

function errorMessage(err: unknown): string {
  const e = err as { data?: { error?: string; code?: string }; message?: string; status?: number } | null;
  const msg = e?.data?.error ?? e?.message ?? "Unknown error";
  return e?.data?.code ? `${msg} (${e.data.code})` : msg;
}

type Playback = { a: string; b: string; env: FightInputEnvironment; mode: FightInputMode; response: FightResponse };

export default function Home() {
  const animals = useGetAnimals({ query: { queryKey: getGetAnimalsQueryKey() } });
  const fight = useCreateFight();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [env, setEnv] = useState<FightInputEnvironment>("land");
  const [mode, setMode] = useState<FightInputMode>("forced_fight");
  const [playback, setPlayback] = useState<Playback | null>(null);
  const [shown, setShown] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | null>(null);
  const requestId = useRef(0);

  const stop = () => {
    if (timer.current !== null) window.clearInterval(timer.current);
    timer.current = null;
  };
  useEffect(() => () => {
    stop();
    requestId.current += 1; // A response after unmount must not start a new timer.
  }, []);

  const list = animals.data ?? [];
  const canFight = a !== "" && b !== "" && !fight.isPending;

  async function onFight() {
    stop();
    setPlayback(null);
    setShown(0);
    setError(null);
    const id = ++requestId.current;
    const sel = { a, b, env, mode };
    try {
      const response = await fight.mutateAsync({ data: {
        animalA: sel.a, animalB: sel.b, environment: sel.env,
        mode: sel.mode, encounter: "face_off",
      } });
      if (id !== requestId.current) return;
      setPlayback({ ...sel, response });
      const total = response.beats.length;
      setShown(Math.min(1, total));
      if (total <= 1) return; // Explanation-only outcomes have no playback timer.
      let n = 1;
      timer.current = window.setInterval(() => {
        n += 1;
        setShown(n);
        if (n >= total) stop();
      }, BEAT_MS);
    } catch (err) {
      if (id === requestId.current) setError(errorMessage(err));
    }
  }

  const beats = playback?.response.beats ?? [];
  const current = shown > 0 ? beats[shown - 1] : undefined;
  // A non-winning finish should not put either figure in a defeated pose.
  const currentAction = current?.animal === null ? null : current?.action ?? null;
  const done = playback !== null && shown >= beats.length;
  const result = playback?.response.result;

  return (
    <main className="mx-auto max-w-2xl p-4 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Animosity</h1>
        <p className="text-sm text-muted-foreground">Fact-based animal matchups.</p>
      </header>

      <section className="border p-3 text-sm space-y-1" data-testid="text-limitations">
        <strong>Starter limitations</strong>
        <ul className="list-disc pl-5">
          <li>Seven adult-male trait profiles are loaded from user-provided data. Review field-level source notes and values before treating them as verified facts.</li>
          <li>v1 scores body mass, environment, and, where comparable, bite force. These hypothetical results are not scientific predictions.</li>
          <li>A valid verdict is shown even when narration is unavailable; non-narrated outcomes receive an explanation without an LLM call.</li>
        </ul>
      </section>

      <section className="space-y-3">
        {animals.isLoading && <p data-testid="status-animals-loading">Loading animals...</p>}
        {animals.isError && (
          <p className="text-destructive" data-testid="status-animals-error">
            Could not load animals: {errorMessage(animals.error)}{" "}
            <button className="underline" onClick={() => animals.refetch()} data-testid="button-retry-animals">Retry</button>
          </p>
        )}
        {animals.isSuccess && list.length === 0 && <p>No animals available.</p>}

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="flex flex-col text-sm">Animal A
            <select className="border p-1 bg-card" value={a} onChange={(e) => setA(e.target.value)} disabled={!list.length} data-testid="select-animal-a">
              <option value="">Select...</option>
              {list.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-sm">Animal B
            <select className="border p-1 bg-card" value={b} onChange={(e) => setB(e.target.value)} disabled={!list.length} data-testid="select-animal-b">
              <option value="">Select...</option>
              {list.map((x) => <option key={x.name} value={x.name}>{x.name}</option>)}
            </select>
          </label>
          <label className="flex flex-col text-sm">Environment
            <select className="border p-1 bg-card" value={env} onChange={(e) => setEnv(e.target.value as FightInputEnvironment)} data-testid="select-environment">
              <option value="land">Land</option>
              <option value="shallow_water">Shallow water</option>
              <option value="deep_water">Deep water</option>
            </select>
          </label>
        </div>
        <fieldset className="space-y-1">
          <legend className="text-sm">Mode</legend>
          <div className="flex gap-4 text-sm">
            <label><input type="radio" name="mode" value="realistic" checked={mode === "realistic"} onChange={() => setMode("realistic")} data-testid="mode-realistic" /> In the wild</label>
            <label><input type="radio" name="mode" value="forced_fight" checked={mode === "forced_fight"} onChange={() => setMode("forced_fight")} data-testid="mode-forced-fight" /> Arena</label>
          </div>
          <p className="text-sm" data-testid="text-mode-caption">{mode === "forced_fight"
            ? "No retreat. Environmental disadvantages still count."
            : "Animals may back off, the way most real encounters end."}</p>
        </fieldset>
        <button className="border px-4 py-1 bg-primary text-primary-foreground disabled:opacity-50" onClick={onFight} disabled={!canFight} data-testid="button-fight">
          {fight.isPending ? "Fighting..." : "Fight"}
        </button>
        {error && <p className="text-destructive" role="alert" data-testid="status-fight-error">Fight failed: {error}</p>}
      </section>

      {playback && (
        <section className="space-y-3" data-testid="section-playback">
          <h2 className="font-semibold">{playback.a} vs {playback.b} ({playback.env.replaceAll("_", " ")}, {playback.mode === "forced_fight" ? "Arena" : "In the wild"})</h2>
          {beats.length > 0 && <>
          <svg viewBox="0 0 320 190" className="w-full border bg-card" role="img" aria-label="Stick figure fight">
            <StickFigure side="left" label={playback.a} action={currentAction} isActor={current?.animal === playback.a} />
            <StickFigure side="right" label={playback.b} action={currentAction} isActor={current?.animal === playback.b} />
          </svg>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            {beats.slice(0, shown).map((beat, i) => (
              <li key={i} data-testid={`text-beat-${i}`}>
                <span className="font-semibold">{beat.animal ?? "No winner"}</span> [{beat.action}]: {beat.text}
                <div className="text-muted-foreground">Facts: {beat.facts_used.map((fact, index) => (
                  <span key={index}>{index > 0 && " | "}<ReadableFact fact={fact} /></span>
                ))}</div>
              </li>
            ))}
          </ol>
          </>}
          {done && result && (
            <MatchupResultCard result={result} explanation={playback.response.explanation}
              narrationStatus={playback.response.narration_status}
              narrationReason={playback.response.narration_reason} />
          )}
        </section>
      )}
    </main>
  );
}
