import { useCallback, useEffect, useRef, useState, type ReactElement } from "react";
import { useCreateFight, useGetAnimals, getGetAnimalsQueryKey } from "@workspace/api-client-react";
import type { Animal, FightResponse } from "@workspace/api-client-react";
import { PickerStage } from "@/components/arena/picker-stage";
import { VsStage } from "@/components/arena/vs-stage";
import { BoutStage } from "@/components/arena/bout-stage";
import { VerdictStage } from "@/components/arena/verdict-stage";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { readSelectionFromUrl, selectionSearch, skipsBout, type Selection, type Stage } from "@/lib/arena";

function errorMessage(err: unknown): string {
  const e = err as { data?: { error?: string; code?: string }; message?: string } | null;
  const msg = e?.data?.error ?? e?.message ?? "Unknown error";
  return e?.data?.code ? `${msg} (${e.data.code})` : msg;
}

/** A stage-independent snapshot: later picker edits never relabel a submitted bout. */
type FightState = {
  id: number; sel: Selection; status: "pending" | "done" | "error";
  response: FightResponse | null; error: string | null;
};
type HistoryState = { animosityStage: Stage; prev?: Stage };

const DEFAULT_SEL: Selection = { a: "", b: "", environment: "land", mode: "forced_fight" };
const urlFor = (sel: Partial<Selection>) => `${window.location.pathname}${selectionSearch(sel)}`;

function validSelection(list: Animal[], search: string): { sel: Selection; complete: boolean } {
  const p = readSelectionFromUrl(search);
  const names = new Set(list.map((x) => x.name));
  const sel: Selection = {
    a: p.a && names.has(p.a) ? p.a : "",
    b: p.b && names.has(p.b) ? p.b : "",
    environment: p.environment ?? DEFAULT_SEL.environment,
    mode: p.mode ?? DEFAULT_SEL.mode,
  };
  return { sel, complete: sel.a !== "" && sel.b !== "" && !!p.environment && !!p.mode };
}

export default function Home() {
  const animals = useGetAnimals({ query: { queryKey: getGetAnimalsQueryKey() } });
  const createFight = useCreateFight();
  const reducedMotion = useReducedMotion();
  const [sel, setSelState] = useState<Selection>(() => ({ ...DEFAULT_SEL, ...readSelectionFromUrl(window.location.search) }));
  const [stage, setStage] = useState<Stage>("picker");
  const [fight, setFight] = useState<FightState | null>(null);
  const requestId = useRef(0);
  const fightRef = useRef(fight);
  fightRef.current = fight;
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const mutateRef = useRef(createFight.mutateAsync);
  mutateRef.current = createFight.mutateAsync;
  const list = animals.data ?? [];

  const go = useCallback((next: Stage, url: string, replace = false) => {
    const state: HistoryState = { animosityStage: next, prev: replace ? (window.history.state as HistoryState | null)?.prev : stageRef.current };
    if (replace) window.history.replaceState(state, "", url);
    else window.history.pushState(state, "", url);
    stageRef.current = next;
    setStage(next);
  }, []);

  const start = useCallback((snapshot: Selection) => {
    const id = ++requestId.current;
    setFight({ id, sel: snapshot, status: "pending", response: null, error: null });
    mutateRef.current({ data: {
      animalA: snapshot.a, animalB: snapshot.b, environment: snapshot.environment,
      mode: snapshot.mode, encounter: "face_off",
    } }).then(
      (response) => {
        if (id !== requestId.current) return;
        setFight((f) => (f && f.id === id ? { ...f, status: "done", response } : f));
      },
      (err: unknown) => {
        if (id !== requestId.current) return;
        setFight((f) => (f && f.id === id ? { ...f, status: "error", error: errorMessage(err) } : f));
      },
    );
  }, []);

  const resetToPicker = useCallback(() => {
    requestId.current += 1; // Any in-flight response is now stale.
    setFight(null);
  }, []);

  // Late responses after unmount are ignored.
  useEffect(() => () => { requestId.current += 1; }, []);

  // Validate URL selections once animals load; a complete shared link starts the bout.
  const autoChecked = useRef(false);
  useEffect(() => {
    if (autoChecked.current || !animals.isSuccess || !animals.data) return;
    autoChecked.current = true;
    const { sel: valid, complete } = validSelection(animals.data, window.location.search);
    setSelState(valid);
    window.history.replaceState({ animosityStage: "picker" } satisfies HistoryState, "", urlFor(valid));
    if (complete && stageRef.current === "picker") {
      start(valid);
      go("bout", urlFor(valid));
    }
  }, [animals.isSuccess, animals.data, start, go]);

  // Browser Back/Forward moves between stages.
  useEffect(() => {
    const onPop = (e: PopStateEvent) => {
      const next = (e.state as HistoryState | null)?.animosityStage ?? "picker";
      if (next === "picker" || !fightRef.current) {
        resetToPicker();
        const data = animals.data;
        if (data) setSelState(validSelection(data, window.location.search).sel);
        if (next !== "picker") window.history.replaceState({ animosityStage: "picker" } satisfies HistoryState, "", window.location.href);
        stageRef.current = "picker";
        setStage("picker");
        return;
      }
      stageRef.current = next;
      setStage(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [animals.data, resetToPicker]);

  // Gated outcomes have no bout to watch.
  useEffect(() => {
    if (stage === "bout" && fight?.status === "done" && fight.response && skipsBout(fight.response)) {
      go("verdict", urlFor(fight.sel), true);
    }
  }, [stage, fight, go]);

  useEffect(() => { document.documentElement.scrollTop = 0; }, [stage]);

  const setSel = (patch: Partial<Selection>) => {
    const next = { ...sel, ...patch };
    setSelState(next);
    window.history.replaceState({ animosityStage: "picker" } satisfies HistoryState, "", urlFor(next));
  };

  const onStart = () => {
    const snapshot = { ...sel };
    start(snapshot);
    go("vs", urlFor(snapshot));
  };
  const toPicker = () => {
    const f = fightRef.current;
    if (f) setSelState(f.sel);
    resetToPicker();
    go("picker", urlFor(f?.sel ?? sel));
  };
  const onChangeFighters = () => {
    if ((window.history.state as HistoryState | null)?.prev === "picker") window.history.back();
    else toPicker();
  };

  const byName = (n: string) => list.find((x) => x.name === n);
  const red = fight ? byName(fight.sel.a) : undefined;
  const blue = fight ? byName(fight.sel.b) : undefined;

  if (stage !== "picker" && fight && red && blue) {
    const wrap = (node: ReactElement) => <main className={reducedMotion ? "reduced-motion" : undefined}>{node}</main>;
    if (stage === "vs") {
      return wrap(<VsStage sel={fight.sel} red={red} blue={blue} onChange={onChangeFighters} onRing={() => {
        const f = fightRef.current;
        if (f?.status === "done" && f.response && skipsBout(f.response)) go("verdict", urlFor(f.sel));
        else go("bout", urlFor(fight.sel));
      }} />);
    }
    if (stage === "verdict" && fight.response) {
      return wrap(<VerdictStage key={fight.id} sel={fight.sel} red={red} blue={blue} response={fight.response}
        onRematch={() => { start(fight.sel); go("bout", urlFor(fight.sel)); }} onNew={toPicker} />);
    }
    return wrap(<BoutStage key={fight.id} sel={fight.sel} red={red} blue={blue} response={fight.response}
      error={fight.error} onRetry={() => start(fight.sel)} reducedMotion={reducedMotion}
      onVerdict={() => go("verdict", urlFor(fight.sel))} />);
  }

  return (
    <main className={reducedMotion ? "reduced-motion" : undefined}>
      <PickerStage list={list} loading={animals.isLoading}
        error={animals.isError ? errorMessage(animals.error) : null} onRetry={() => animals.refetch()}
        sel={sel} setSel={setSel} onStart={onStart} />
    </main>
  );
}
