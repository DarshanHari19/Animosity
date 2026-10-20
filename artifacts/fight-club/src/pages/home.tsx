import { useEffect, useRef, useState } from "react";
import { useCreateFight, useGetAnimals, getGetAnimalsQueryKey } from "@workspace/api-client-react";
import type { FightInputEnvironment, FightResponse } from "@workspace/api-client-react";
import { StickFigure } from "@/components/stick-figure";

const BEAT_MS = 1500;

function errorMessage(err: unknown): string {
  const e = err as { data?: { error?: string; code?: string }; message?: string; status?: number } | null;
  const msg = e?.data?.error ?? e?.message ?? "Unknown error";
  return e?.data?.code ? `${msg} (${e.data.code})` : msg;
}

type Playback = { a: string; b: string; env: FightInputEnvironment; response: FightResponse };

export default function Home() {
  const animals = useGetAnimals({ query: { queryKey: getGetAnimalsQueryKey() } });
  const fight = useCreateFight();
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [env, setEnv] = useState<FightInputEnvironment>("land");
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
  const canFight = a !== "" && b !== "" && a !== b && !fight.isPending;

  async function onFight() {
    stop();
    setPlayback(null);
    setShown(0);
    setError(null);
    const id = ++requestId.current;
    const sel = { a, b, env };
    try {
      const response = await fight.mutateAsync({ data: { animalA: sel.a, animalB: sel.b, environment: sel.env } });
      if (id !== requestId.current) return;
      setPlayback({ ...sel, response });
      setShown(1);
      const total = response.beats.length;
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
  const done = playback !== null && beats.length > 0 && shown >= beats.length;
  const result = playback?.response.result;

  return (
    <main className="mx-auto max-w-2xl p-4 space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Fight Club</h1>
        <p className="text-sm text-muted-foreground">Fact-based animal matchups.</p>
      </header>

      <section className="border p-3 text-sm space-y-1" data-testid="text-limitations">
        <strong>Starter limitations</strong>
        <ul className="list-disc pl-5">
          <li>All numeric traits are unknown placeholders (zero); sources are empty and categorical traits are unverified.</li>
          <li>The scoring engine is not implemented; Fight returns a 501 "scoring-not-implemented" error until it is written.</li>
          <li>No results are simulated. Narration appears only from a real engine response.</li>
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
              <option value="water">Water</option>
            </select>
          </label>
        </div>
        {a !== "" && a === b && <p className="text-sm">Pick two different animals.</p>}
        <button className="border px-4 py-1 bg-primary text-primary-foreground disabled:opacity-50" onClick={onFight} disabled={!canFight} data-testid="button-fight">
          {fight.isPending ? "Fighting..." : "Fight"}
        </button>
        {error && <p className="text-destructive" role="alert" data-testid="status-fight-error">Fight failed: {error}</p>}
      </section>

      {playback && (
        <section className="space-y-3" data-testid="section-playback">
          <h2 className="font-semibold">{playback.a} vs {playback.b} ({playback.env})</h2>
          <svg viewBox="0 0 320 190" className="w-full border bg-card" role="img" aria-label="Stick figure fight">
            <StickFigure side="left" label={playback.a} action={current?.action ?? null} isActor={current?.animal === playback.a} />
            <StickFigure side="right" label={playback.b} action={current?.action ?? null} isActor={current?.animal === playback.b} />
          </svg>
          <ol className="list-decimal pl-5 space-y-2 text-sm">
            {beats.slice(0, shown).map((beat, i) => (
              <li key={i} data-testid={`text-beat-${i}`}>
                <span className="font-semibold">{beat.animal}</span> [{beat.action}]: {beat.text}
                <div className="text-muted-foreground">Fact: {beat.fact_used}</div>
              </li>
            ))}
          </ol>
          {done && result && (
            <div className="border p-3 space-y-1" data-testid="card-result">
              <p>Winner: <strong data-testid="text-winner">{result.winner}</strong></p>
              <p data-testid="text-confidence">Confidence: {(result.confidence * 100).toFixed(1)}%</p>
              <p>Factors:</p>
              <ul className="list-disc pl-5 text-sm">
                {result.factors.map((f, i) => <li key={i} data-testid={`text-factor-${i}`}>{f}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
