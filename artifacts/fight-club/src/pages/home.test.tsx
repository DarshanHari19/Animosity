import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Animal, FightInputEnvironment, FightInputMode, FightResponse } from "@workspace/api-client-react";
import Home from "./home";
import { animals, deferred, jsonResponse, responseFixture } from "../test/fixtures";

// Exercise the real generated hooks and JSON transport, but forbid live requests.
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let animalReply: () => Promise<Response>;
let fightReply: () => Promise<Response>;
let clients: QueryClient[];

async function advance(ms = 0) {
  // Step so each beat's effect can schedule the next timer between ticks.
  let left = ms;
  do {
    const step = Math.min(left, 250); // divides the 750 ms phase and 1500 ms hold
    await act(async () => { await vi.advanceTimersByTimeAsync(step); });
    left -= step;
  } while (left > 0);
}

/** jsdom queues history traversal as two nested zero-delay timers. */
async function goBack() {
  window.history.back();
  await advance(1);
  await advance(1);
}

function mountHome() {
  const client = new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: Infinity },
      mutations: { retry: false, gcTime: Infinity },
    },
  });
  clients.push(client);
  return render(<QueryClientProvider client={client}><Home /></QueryClientProvider>);
}

function selectAnimals(a = "Lion", b = "Grizzly bear") {
  fireEvent.change(screen.getByLabelText("Red corner"), { target: { value: a } });
  fireEvent.change(screen.getByLabelText("Blue corner"), { target: { value: b } });
}

const startButton = () => screen.getByRole("button", { name: "Start the bout" });

async function toVs() {
  mountHome();
  await advance();
  selectAnimals();
  fireEvent.click(startButton());
  await advance();
}

async function toBout() {
  await toVs();
  fireEvent.click(screen.getByRole("button", { name: "Ring the bell" }));
  await advance();
}

function fightBodies() {
  return fetchMock.mock.calls.filter(([url]) => url === "/api/fight").map(([, init]) => JSON.parse(init!.body as string));
}

const beatText = () => screen.getByTestId("text-beat").textContent;
const figure = (side: "red" | "blue") => screen.getByTestId(`figure-${side}`);

function heavyAnimals(): Animal[] {
  return [
    { ...animals[0]!, name: "Hippopotamus", mass_kg: 1500, fighting_style: "charge",
      field_sources: { mass_kg: { tier: 3, citation: "https://en.wikipedia.org/wiki/Hippopotamus" } } },
    { ...animals[1]!, name: "Lion", mass_kg: 190, bite_force_n: 5500, fighting_style: "ambush",
      field_sources: { mass_kg: { tier: 3, citation: "https://en.wikipedia.org/wiki/Lion" } } },
  ];
}

beforeEach(() => {
  vi.useFakeTimers();
  window.history.replaceState(null, "", "/");
  clients = [];
  animalReply = async () => jsonResponse(animals);
  fightReply = async () => jsonResponse(responseFixture());
  fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    if (input === "/api/animals" && init?.method === "GET") return animalReply();
    if (input === "/api/fight" && init?.method === "POST") return fightReply();
    throw new Error(`Unexpected test request: ${String(input)} ${init?.method}`);
  });
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  for (const client of clients) client.clear();
});

describe("Picker", () => {
  it("defaults to Arena and shows both rule labels with their captions", async () => {
    mountHome();
    await advance();
    expect(screen.getByText("ANIMOSITY")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sources" })).toHaveAttribute("href", "#trait-sources");
    expect(screen.getByText("Who's favored, and why. Every number shows its source.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Arena" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("text-mode-caption").textContent).toBe("No retreat. Environmental disadvantages still count.");
    fireEvent.click(screen.getByRole("button", { name: "In the wild" }));
    expect(screen.getByRole("button", { name: "In the wild" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByTestId("text-mode-caption").textContent).toBe("Animals may back off, the way most real encounters end.");
  });

  it("shows corner stats and the environment level for the chosen terrain", async () => {
    animalReply = async () => jsonResponse(heavyAnimals());
    mountHome();
    await advance();
    selectAnimals("Hippopotamus", "Lion");
    expect(screen.getByTestId("text-weight-a")).toHaveTextContent("1,500 kg");
    expect(screen.getByTestId("text-style-a")).toHaveTextContent("Charge");
    expect(screen.getByTestId("text-level-a")).toHaveTextContent("Full strength");
    fireEvent.click(screen.getByTestId("button-terrain-deep_water"));
    expect(screen.getByTestId("text-level-b")).toHaveTextContent("Can't fight");
    expect(screen.getByTestId("text-summary")).toHaveTextContent("Hippopotamus vs Lion · Open Ocean · Arena rules");
  });

  it("disables Start the bout until both corners are set, including identical selections", async () => {
    mountHome();
    await advance();
    expect(startButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Red corner"), { target: { value: "Lion" } });
    expect(startButton()).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Blue corner"), { target: { value: "Lion" } });
    expect(startButton()).toBeEnabled();
    fireEvent.click(startButton());
    await advance();
    expect(fightBodies()).toEqual([{ animalA: "Lion", animalB: "Lion", environment: "land", mode: "forced_fight", encounter: "face_off" }]);
    fireEvent.click(screen.getByRole("button", { name: "Ring the bell" }));
    await advance(16500);
    expect(screen.getByTestId("text-outcome")).toHaveTextContent("Lion favored");
  });

  const contexts: [FightInputEnvironment, FightInputMode, string][] = [
    ["land", "realistic", "Open Savannah · In the wild · Retreat allowed"],
    ["shallow_water", "forced_fight", "Riverbank Shallows · Arena rules · No retreat"],
    ["deep_water", "forced_fight", "Open Ocean · Arena rules · No retreat"],
  ];
  it.each(contexts)("submits %s / %s / face_off and labels the VS reveal from the snapshot", async (environment, mode, line) => {
    const pending = deferred<Response>();
    fightReply = () => pending.promise;
    mountHome();
    await advance();
    selectAnimals();
    fireEvent.click(screen.getByTestId(`button-terrain-${environment}`));
    fireEvent.click(screen.getByTestId(mode === "realistic" ? "mode-realistic" : "mode-forced-fight"));
    fireEvent.click(startButton());
    await advance();
    expect(fightBodies()).toEqual([{ animalA: "Lion", animalB: "Grizzly bear", environment, mode, encounter: "face_off" }]);
    expect(screen.getByText("Sanctioned bout")).toBeInTheDocument();
    expect(screen.getByTestId("text-vs-context").textContent).toBe(line);
    expect(screen.getByTestId("text-vs-name-red")).toHaveTextContent("Lion");
    expect(screen.getByTestId("text-vs-name-blue")).toHaveTextContent("Grizzly bear");
    expect(screen.getByText("Silhouettes drawn to scale by body mass.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ring the bell" }));
    await advance();
    expect(screen.getByTestId("status-fight-pending")).toBeInTheDocument();
    pending.resolve(jsonResponse(responseFixture()));
    await advance();
    expect(beatText()).toBe("Fictional beat 1.");
  });

  it("shows animal loading, readable failure, and a working Retry", async () => {
    const pending = deferred<Response>();
    animalReply = () => pending.promise;
    mountHome();
    expect(screen.getByTestId("status-animals-loading")).toHaveTextContent("Loading animals...");
    pending.resolve(jsonResponse({ error: "Fixture animals unavailable", code: "fixture-error" }, 503));
    await advance();
    expect(screen.getByTestId("status-animals-error")).toHaveTextContent("Could not load animals: Fixture animals unavailable (fixture-error)");
    expect(screen.getByLabelText("Red corner")).toBeDisabled();
    expect(startButton()).toBeDisabled();
    animalReply = async () => jsonResponse(animals);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await advance();
    expect(screen.queryByTestId("status-animals-error")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Red corner")).toBeEnabled();
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/animals")).toHaveLength(2);
  });

  it("handles an empty animal list without enabling corners or Start", async () => {
    animalReply = async () => jsonResponse([]);
    mountHome();
    await advance();
    expect(screen.getByText("No animals available.")).toBeInTheDocument();
    expect(screen.getByLabelText("Red corner")).toBeDisabled();
    expect(startButton()).toBeDisabled();
  });
});

describe("Fight requests", () => {
  it.each(["api", "network"] as const)("shows %s fight errors without inventing playback and recovers on Try again", async (kind) => {
    fightReply = kind === "api"
      ? async () => jsonResponse({ error: "Scoring is not implemented", code: "scoring-not-implemented" }, 501)
      : async () => { throw new Error("Fixture network failure"); };
    await toBout();
    expect(screen.getByRole("alert")).toHaveTextContent(kind === "api"
      ? "Fight failed: Scoring is not implemented (scoring-not-implemented)"
      : "Fight failed: Fixture network failure");
    expect(screen.queryByTestId("text-beat")).not.toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
    const pending = deferred<Response>();
    fightReply = () => pending.promise;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await advance();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    pending.resolve(jsonResponse(responseFixture()));
    await advance();
    expect(beatText()).toBe("Fictional beat 1.");
  });

  it("ignores a stale response after Change fighters and a new matchup", async () => {
    const pending = deferred<Response>();
    fightReply = () => pending.promise;
    await toVs();
    fireEvent.click(screen.getByRole("button", { name: "Change fighters" }));
    await advance(1);
    await advance(1);
    expect(screen.getByLabelText("Red corner")).toHaveValue("Lion");
    fightReply = async () => jsonResponse(responseFixture({ kind: "even" }));
    selectAnimals("Grizzly bear", "Lion");
    fireEvent.click(startButton());
    await advance();
    pending.resolve(jsonResponse(responseFixture()));
    await advance();
    fireEvent.click(screen.getByRole("button", { name: "Ring the bell" }));
    await advance(16500);
    expect(screen.getByTestId("text-outcome")).toHaveTextContent("Too close to call");
  });

  it.each(["success", "failure"] as const)("ignores a late %s from an unmounted request", async (settlement) => {
    const pending = deferred<Response>();
    fightReply = () => pending.promise;
    const old = mountHome();
    await advance();
    selectAnimals();
    fireEvent.click(startButton());
    await advance();
    old.unmount();
    window.history.replaceState(null, "", "/");
    fightReply = async () => jsonResponse(responseFixture({ kind: "even" }));
    await toBout();
    if (settlement === "success") pending.resolve(jsonResponse(responseFixture()));
    else pending.reject(new Error("Late fictional failure"));
    await advance();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await advance(16500);
    expect(screen.getByTestId("text-outcome")).toHaveTextContent("Too close to call");
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Bout playback", () => {
  it("autoplays every 3 seconds, then moves to the verdict after the last beat", async () => {
    const response = responseFixture();
    await toBout();
    expect(beatText()).toBe(response.beats[0]!.text);
    expect(screen.getByTestId("text-progress")).toHaveTextContent("Beat 1 of 5");
    for (let i = 1; i < response.beats.length; i++) {
      await advance(2999);
      expect(beatText()).toBe(response.beats[i - 1]!.text);
      await advance(1);
      expect(beatText()).toBe(response.beats[i]!.text);
    }
    expect(screen.queryByTestId("stage-verdict")).not.toBeInTheDocument();
    await advance(3000);
    expect(screen.getByTestId("text-verdict-hold")).toHaveTextContent("The verdict is in");
    expect(screen.queryByTestId("stage-verdict")).not.toBeInTheDocument();
    await advance(1499);
    expect(screen.queryByTestId("stage-verdict")).not.toBeInTheDocument();
    await advance(1);
    expect(screen.getByTestId("stage-verdict")).toBeInTheDocument();
    expect(screen.getByTestId("text-climax")).toHaveTextContent("Fictional beat 5.");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("pauses, steps with labeled icon buttons, replays, and offers See the verdict when paused at the end", async () => {
    await toBout();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await advance(20000);
    expect(beatText()).toBe("Fictional beat 1.");
    expect(screen.getByRole("button", { name: "Previous moment" })).toBeDisabled();
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    expect(beatText()).toBe("Fictional beat 5.");
    expect(screen.getByRole("button", { name: "Next moment" })).toBeDisabled();
    await advance(10000);
    expect(screen.queryByTestId("stage-verdict")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Previous moment" }));
    expect(beatText()).toBe("Fictional beat 4.");
    fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    fireEvent.click(screen.getByRole("button", { name: "See the verdict" }));
    expect(screen.getByTestId("stage-verdict")).toBeInTheDocument();
    await goBack();
    expect(screen.getByTestId("stage-bout")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    expect(beatText()).toBe("Fictional beat 1.");
    expect(screen.getByRole("button", { name: "Pause" })).toBeInTheDocument();
  });

  it("shows facts behind a toggle and skips straight to the verdict", async () => {
    await toBout();
    expect(screen.queryByTestId("list-facts")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Show facts" }));
    expect(screen.getByTestId("list-facts")).toHaveTextContent("Fixture factor: Fictional fixture reason only.");
    fireEvent.click(screen.getByRole("button", { name: "Skip to the verdict" }));
    expect(screen.getByTestId("stage-verdict")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["Lion", "Grizzly bear"])("advances only %s at a favored Arena finish while the loser tips over", async (animal) => {
    fightReply = async () => jsonResponse(responseFixture({ kind: "favored", animal }));
    await toBout();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    const [win, lose] = animal === "Lion" ? ["red", "blue"] as const : ["blue", "red"] as const;
    expect(figure(win).style.transform).toBe(win === "red" ? "translate(110px, 0px) rotate(-3deg)" : "translate(-110px, 0px) rotate(3deg)");
    expect(figure(lose).style.transform).toBe(lose === "red" ? "translate(-10px, 18px) rotate(-78deg)" : "translate(10px, 18px) rotate(78deg)");
    expect(screen.getByTestId("text-action-banner")).toHaveTextContent(`${animal.toUpperCase()} FINISHES IT`);
  });

  it("keeps both figures at rest for an even finish", async () => {
    fightReply = async () => jsonResponse(responseFixture({ kind: "even" }));
    await toBout();
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    for (let i = 0; i < 4; i++) fireEvent.click(screen.getByRole("button", { name: "Next moment" }));
    expect(screen.getByTestId("text-beat-actor")).toHaveTextContent("No winner");
    expect(figure("red").style.transform).toBe("translate(0px, 0px) rotate(0deg)");
    expect(figure("blue").style.transform).toBe("translate(0px, 0px) rotate(0deg)");
  });

  it("turns off movement under prefers-reduced-motion while text still advances", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"), media: query,
      addEventListener: () => {}, removeEventListener: () => {},
    }));
    await toBout();
    await advance(3000); // charge beat
    expect(beatText()).toBe("Fictional beat 2.");
    for (const side of ["red", "blue"] as const) {
      expect(figure(side).style.transform).toBe("");
      expect(figure(side).dataset.motion).toBe("reduced");
    }
    expect(screen.getByTestId("arena-stage")).toHaveClass("reduced-motion");
  });

  it("moves the charging animal without reduced motion", async () => {
    await toBout();
    await advance(3750); // charge beat, contact phase
    expect(screen.getByTestId("arena-stage").dataset.phase).toBe("contact");
    expect(figure("blue").style.transform).toBe("translate(-130px, 0px) rotate(4deg)");
    expect(figure("blue").dataset.motion).toBe("full");
  });

  it.each([
    ["land", "sand"], ["shallow_water", "shallows"], ["deep_water", "ocean"],
  ] as const)("terrain %s sets the %s stage floor", async (env, floor) => {
    mountHome();
    await advance();
    selectAnimals();
    fireEvent.click(screen.getByTestId(`button-terrain-${env}`));
    fireEvent.click(startButton());
    await advance();
    fireEvent.click(screen.getByRole("button", { name: "Ring the bell" }));
    await advance();
    expect(screen.getByTestId("arena-stage")).toHaveAttribute("data-floor", floor);
    expect(screen.getByTestId(`floor-${floor}`)).toBeInTheDocument();
    for (const other of ["sand", "shallows", "ocean"].filter((x) => x !== floor)) {
      expect(screen.queryByTestId(`floor-${other}`)).not.toBeInTheDocument();
    }
  });

  it("clears the playback timer when unmounted", async () => {
    const view = mountHome();
    await advance();
    selectAnimals();
    fireEvent.click(startButton());
    await advance();
    fireEvent.click(screen.getByRole("button", { name: "Ring the bell" }));
    await advance();
    expect(vi.getTimerCount()).toBe(1);
    view.unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});

describe("Phases, hold, and water", () => {
  it("plays four distinct phases per beat and freezes them when paused", async () => {
    await toBout();
    await advance(3000);
    const seen: string[] = [];
    for (let i = 0; i < 4; i++) {
      seen.push(`${screen.getByTestId("arena-stage").dataset.phase}|${figure("blue").style.transform}`);
      await advance(750);
    }
    expect(seen.map((s) => s.split("|")[0])).toEqual(["approach", "contact", "recoil", "settle"]);
    expect(new Set(seen.map((s) => s.split("|")[1])).size).toBe(4);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    const phase = screen.getByTestId("arena-stage").dataset.phase;
    expect(screen.getByTestId("arena-stage")).toHaveClass("paused");
    await advance(9000);
    expect(screen.getByTestId("arena-stage").dataset.phase).toBe(phase);
    expect(beatText()).toBe("Fictional beat 3.");
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    expect(screen.getByTestId("arena-stage").dataset.phase).toBe("approach");
    expect(beatText()).toBe("Fictional beat 1.");
  });

  it("holds on The verdict is in, and Skip still works during the hold", async () => {
    await toBout();
    await advance(15000);
    expect(screen.getByTestId("text-verdict-hold")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(1);
    fireEvent.click(screen.getByRole("button", { name: "Skip to the verdict" }));
    expect(screen.getByTestId("stage-verdict")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("Replay during the hold cancels the automatic verdict", async () => {
    await toBout();
    await advance(15500);
    fireEvent.click(screen.getByRole("button", { name: "Replay" }));
    await advance(1500);
    expect(screen.queryByTestId("stage-verdict")).not.toBeInTheDocument();
    expect(beatText()).toBe("Fictional beat 1.");
    expect(screen.queryByTestId("text-verdict-hold")).not.toBeInTheDocument();
  });

  it("pausing during the hold stops the verdict and offers See the verdict", async () => {
    await toBout();
    await advance(15500);
    fireEvent.click(screen.getByRole("button", { name: "Pause" }));
    await advance(5000);
    expect(screen.queryByTestId("stage-verdict")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "See the verdict" }));
    expect(screen.getByTestId("stage-verdict")).toBeInTheDocument();
  });

  it("keeps figures still under reduced motion across phases", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    await toBout();
    for (let i = 0; i < 4; i++) { await advance(750); expect(figure("red").style.transform).toBe(""); }
    expect(beatText()).toBe("Fictional beat 2.");
  });

  it("puts semi-transparent shallow water above the figures, covering their legs", async () => {
    mountHome();
    await advance();
    selectAnimals();
    fireEvent.click(screen.getByTestId("button-terrain-shallow_water"));
    fireEvent.click(startButton());
    await advance();
    fireEvent.click(screen.getByRole("button", { name: "Ring the bell" }));
    await advance();
    const water = screen.getByTestId("floor-shallows");
    const surface = parseFloat(water.style.height);
    for (const side of ["red", "blue"] as const) {
      expect(Number(water.style.zIndex)).toBeGreaterThan(Number(figure(side).style.zIndex));
      expect(surface - parseFloat(figure(side).style.bottom)).toBeGreaterThanOrEqual(15);
    }
  });

  it.each([
    ["shallow_water", "40%", 1], ["shallow_water", "40%", 20], ["deep_water", "86%", 1], ["deep_water", "86%", 20],
  ] as const)("anchors a crocodile to the %s surface with a size-independent offset (mass x%s)", async (env, surface, factor) => {
    const croc: Animal[] = [{ ...animals[0]!, name: "Nile crocodile", mass_kg: 500 }, { ...animals[1]!, mass_kg: 500 * factor }];
    animalReply = async () => jsonResponse(croc);
    mountHome();
    await advance();
    selectAnimals("Nile crocodile", "Grizzly bear");
    fireEvent.click(screen.getByTestId(`button-terrain-${env}`));
    fireEvent.click(startButton());
    await advance();
    fireEvent.click(screen.getByRole("button", { name: "Ring the bell" }));
    await advance();
    expect(figure("red").dataset.submerged).toBe("true");
    expect(figure("red").style.bottom).toBe(surface);
    expect(screen.getByTestId("croc-offset-red").style.transform).toBe("translateY(34%)");
    expect(figure("red").dataset.scale).toBe(Math.cbrt(1 / factor).toFixed(3));
    expect(figure("blue").dataset.submerged).toBe("false");
    expect(screen.queryByTestId("croc-offset-blue")).not.toBeInTheDocument();
  });

  it("keeps the croc offset static under reduced motion and leaves a land croc low with its tail group", async () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduce"), media: query, addEventListener: () => {}, removeEventListener: () => {},
    }));
    animalReply = async () => jsonResponse([{ ...animals[0]!, name: "Nile crocodile" }, animals[1]!]);
    mountHome();
    await advance();
    selectAnimals("Nile crocodile", "Grizzly bear");
    fireEvent.click(screen.getByTestId("button-terrain-shallow_water"));
    fireEvent.click(startButton());
    await advance();
    fireEvent.click(screen.getByRole("button", { name: "Ring the bell" }));
    await advance();
    expect(figure("red").style.transform).toBe("");
    expect(screen.getByTestId("croc-offset-red").style.transform).toBe("translateY(34%)");
  });
});

describe("Unavailable and gated outcomes", () => {
  it.each(["INVALID_NARRATION", "LLM_PROVIDER_FAILURE", "NARRATION_DAILY_CAP_REACHED"] as const)(
    "keeps the stage and full tape when narration is unavailable: %s", async (reason) => {
      fightReply = async () => jsonResponse({ ...responseFixture(), beats: [], narration_status: "unavailable", narration_reason: reason });
      await toBout();
      expect(screen.getByTestId("arena-stage")).toBeInTheDocument();
      expect(screen.getByTestId("text-narration-unavailable")).toHaveTextContent("Narration unavailable");
      expect(vi.getTimerCount()).toBe(0);
      fireEvent.click(screen.getByRole("button", { name: "See the verdict" }));
      expect(screen.getByTestId("text-outcome")).toHaveTextContent("Lion favored");
      expect(screen.getByTestId("text-narration-unavailable")).toHaveTextContent("Narration unavailable");
      for (const row of ["weight", "bite", "environment", "style"]) expect(screen.getByTestId(`row-tape-${row}`)).toBeInTheDocument();
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    },
  );

  const gated: [FightResponse["result"]["outcome"], string][] = [
    [{ kind: "indeterminate" }, "Indeterminate"],
    [{ kind: "no_contest" }, "No contest"],
    [{ kind: "no_engagement", animals: ["Grizzly bear"] }, "No fight: Grizzly bear backs off"],
    [{ kind: "no_engagement", animals: ["Lion", "Grizzly bear"] }, "No fight: both animals back off"],
  ];
  it.each(gated)("skips the bout for %j and shows the engine explanation", async (outcome, title) => {
    const response = responseFixture(outcome);
    fightReply = async () => jsonResponse(response);
    await toBout();
    expect(screen.queryByTestId("stage-bout")).not.toBeInTheDocument();
    expect(screen.getByTestId("text-outcome")).toHaveTextContent(title);
    expect(screen.getByTestId("text-explanation").textContent).toBe(response.explanation);
    expect(screen.getByText("Assumes adult males")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("replaces a pending bout with the verdict when a gated result arrives late", async () => {
    const pending = deferred<Response>();
    fightReply = () => pending.promise;
    await toBout();
    expect(screen.getByTestId("stage-bout")).toBeInTheDocument();
    pending.resolve(jsonResponse(responseFixture({ kind: "no_contest" })));
    await advance();
    expect(screen.getByTestId("text-outcome")).toHaveTextContent("No contest");
    await goBack();
    expect(screen.getByTestId("stage-vs")).toBeInTheDocument();
  });
});

describe("Verdict", () => {
  function scoredResponse(kind: "favored" | "even" = "favored"): FightResponse {
    const base = responseFixture(kind === "favored" ? { kind: "favored", animal: "Hippopotamus" } : { kind: "even" });
    return {
      ...base,
      result: {
        ...base.result, deciding_factor: kind === "favored" ? "fighting_ability" : null,
        advantage_score: kind === "favored" ? 2.3847129416418364 : 0.1234,
        factors: [
          { name: "Size", value: kind === "favored" ? 2.3847129416418364 : 0.1234, reason: "Hippopotamus outweighs Lion about 7.9 to 1." },
          { name: "Bite force", value: 0, reason: "Not compared: bite-force values are missing or have different source tiers." },
        ],
      },
      beats: base.beats.map((b) => ({ ...b, animal: b.animal === "Lion" ? "Lion" : b.animal === null ? null : "Hippopotamus",
        facts_used: ["Lion.mass_kg = 190 [tier 3; https://en.wikipedia.org/wiki/Lion]"] })),
    };
  }
  async function toVerdict(response: FightResponse) {
    animalReply = async () => jsonResponse(heavyAnimals());
    fightReply = async () => jsonResponse(response);
    mountHome();
    await advance();
    selectAnimals("Hippopotamus", "Lion");
    fireEvent.click(startButton());
    await advance();
    fireEvent.click(screen.getByRole("button", { name: "Ring the bell" }));
    await advance();
    fireEvent.click(screen.getByRole("button", { name: "Skip to the verdict" }));
  }

  it("marks EDGE by scored factor sign, keeps raw scores in the drawer, and lists linked sources", async () => {
    await toVerdict(scoredResponse());
    expect(screen.getByTestId("text-outcome")).toHaveTextContent("Hippopotamus favored");
    expect(within(screen.getByTestId("row-tape-weight")).getByTestId("edge-red")).toBeInTheDocument();
    expect(screen.getAllByText("EDGE")).toHaveLength(1);
    expect(screen.getByTestId("text-tape-note-bite")).toHaveTextContent("Not compared: one value is missing.");
    expect(screen.getByTestId("text-tape-note-style")).toHaveTextContent("Shapes the narration only. Not scored yet.");
    expect(document.body.textContent).not.toContain("2.38");
    expect(document.body.textContent).not.toContain("Deciding factor");
    fireEvent.click(screen.getByRole("button", { name: "Why? Show the math" }));
    expect(screen.getByTestId("text-math-size")).toHaveTextContent("Size: 0.8 × (log2 1,500 − log2 190) = +2.38");
    expect(screen.getByTestId("text-math-total")).toHaveTextContent("Total +2.38. A score of +0.5 or more favors the red corner");
    expect(document.body.textContent).not.toContain("2.3847");
    const lion = within(screen.getByTestId("list-sources")).getAllByRole("link", { name: "Wikipedia" });
    expect(lion.map((a) => a.getAttribute("href"))).toEqual(expect.arrayContaining([
      "https://en.wikipedia.org/wiki/Lion", "https://en.wikipedia.org/wiki/Hippopotamus",
    ]));
  });

  it("labels rows Scored, Not compared, and Not modeled yet, and expands sources", async () => {
    await toVerdict(scoredResponse());
    expect(screen.getByTestId("label-tape-weight")).toHaveTextContent("Scored");
    expect(screen.getByTestId("label-tape-bite")).toHaveTextContent("Not compared");
    expect(screen.getByTestId("label-tape-environment")).toHaveTextContent("Scored");
    expect(screen.getByTestId("label-tape-style")).toHaveTextContent("Not modeled yet");
    const toggle = screen.getByTestId("button-expand-weight");
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("text-source-weight-0")).toHaveTextContent("Hippopotamus: Tier 3, Reference summary");
    expect(screen.getByTestId("text-detail-factor-weight")).toHaveTextContent("+2.38");
    fireEvent.click(screen.getByTestId("button-expand-bite"));
    expect(screen.getByTestId("text-detail-bite-reason")).toHaveTextContent("Hippopotamus has no usable bite force value");
    expect(screen.getByTestId("text-source-bite-0")).toHaveTextContent("source unknown");
    fireEvent.click(screen.getByTestId("button-expand-environment"));
    expect(screen.getByTestId("text-detail-env")).toHaveTextContent("No handicap applied: environment factor 0.");
    fireEvent.click(screen.getAllByRole("link", { name: "See the full math" })[0]!);
    expect(screen.getByTestId("drawer-math")).toBeInTheDocument();
  });

  it("labels an environment-gated bout Scored with a gate explanation, and unscored rows Context", async () => {
    await toBout();
    fireEvent.click(screen.getByRole("button", { name: "Skip to the verdict" }));
    expect(screen.getByTestId("label-tape-environment")).toHaveTextContent("Scored");
    fireEvent.click(screen.getByTestId("button-expand-environment"));
    expect(screen.getByTestId("text-detail-env")).toHaveTextContent("Environment gate");
    expect(screen.getByTestId("text-detail-env")).toHaveTextContent("no numeric factor and no score; it decided the bout before numeric scoring");
    expect(screen.getByTestId("label-tape-weight")).toHaveTextContent("Context");
    expect(screen.queryByText("EDGE")).not.toBeInTheDocument();
  });

  it.each([
    ["both tiers unknown", { bite_force_n: 4000 }, { bite_force_n: 4500 }, "no known source tier"],
    ["zero placeholder", { bite_force_n: 0 }, { bite_force_n: 4500 }, "Hippopotamus has no usable bite force value"],
    ["unequal tiers", { bite_force_n: 4000, field_sources: { bite_force_n: { tier: 1, citation: "Field study" } } },
      { bite_force_n: 4500, field_sources: { bite_force_n: { tier: 3, citation: "Summary" } } }, "tier 1 (Measured)"],
  ] as const)("explains an un-compared bite: %s", async (_n, a, b, text) => {
    const [h, l] = heavyAnimals();
    const pair = [{ ...h!, ...a, field_sources: { ...h!.field_sources, ...("field_sources" in a ? a.field_sources : {}) } },
      { ...l!, ...b, field_sources: { ...l!.field_sources, ...("field_sources" in b ? b.field_sources : {}) } }] as Animal[];
    const response = scoredResponse();
    animalReply = async () => jsonResponse(pair);
    fightReply = async () => jsonResponse(response);
    mountHome();
    await advance();
    selectAnimals("Hippopotamus", "Lion");
    fireEvent.click(startButton());
    await advance();
    fireEvent.click(screen.getByRole("button", { name: "Ring the bell" }));
    await advance();
    fireEvent.click(screen.getByRole("button", { name: "Skip to the verdict" }));
    expect(screen.getByTestId("label-tape-bite")).toHaveTextContent("Not compared");
    fireEvent.click(screen.getByTestId("button-expand-bite"));
    const reason = screen.getByTestId("text-detail-bite-reason");
    expect(reason).toHaveTextContent(text);
    expect(reason).toHaveTextContent("Engine note: Not compared");
    if (_n !== "unequal tiers") expect(reason).not.toHaveTextContent("different tiers");
  });

  it("never shows EDGE on a too-close-to-call verdict", async () => {
    await toVerdict(scoredResponse("even"));
    expect(screen.getByTestId("text-outcome")).toHaveTextContent("Too close to call");
    expect(screen.queryByText("EDGE")).not.toBeInTheDocument();
  });

  it("copies the share link with feedback, rematches, and starts a new matchup", async () => {
    const writeText = vi.fn(async () => {});
    vi.stubGlobal("navigator", { ...navigator, clipboard: { writeText } });
    await toVerdict(scoredResponse());
    fireEvent.click(screen.getByRole("button", { name: "Share this bout" }));
    await advance();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("a=Hippopotamus&b=Lion&environment=land&mode=forced_fight"));
    expect(screen.getByTestId("status-share")).toHaveTextContent("Link copied.");
    fireEvent.click(screen.getByRole("button", { name: "Rematch" }));
    await advance();
    expect(fightBodies()).toHaveLength(2);
    expect(screen.getByTestId("stage-bout")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Skip to the verdict" }));
    fireEvent.click(screen.getByRole("button", { name: "New matchup" }));
    expect(screen.getByRole("button", { name: "Start the bout" })).toBeInTheDocument();
    expect(screen.getByLabelText("Red corner")).toHaveValue("Hippopotamus");
  });
});

describe("Verdict finish split", () => {
  it("renders the narrated climax in italics and the exact server verdict suffix once", async () => {
    const suffix = "The Hippopotamus is favored: it outweighs the Lion about 7.9 to 1 (1,500 kg vs 190 kg); bite force not compared; the Lion is hampered in shallow water.";
    const climax = "The Hippopotamus drives forward and pins the Lion in the shallows.";
    const base = responseFixture({ kind: "favored", animal: "Hippopotamus" });
    const response: FightResponse = { ...base, beats: base.beats.map((b, i) => i === base.beats.length - 1
      ? { ...b, animal: "Hippopotamus", text: `${climax} ${suffix}` } : { ...b, animal: i % 2 ? "Lion" : "Hippopotamus" }) };
    animalReply = async () => jsonResponse(heavyAnimals());
    fightReply = async () => jsonResponse(response);
    mountHome();
    await advance();
    selectAnimals("Hippopotamus", "Lion");
    fireEvent.click(startButton());
    await advance();
    fireEvent.click(screen.getByRole("button", { name: "Ring the bell" }));
    await advance();
    fireEvent.click(screen.getByRole("button", { name: "Skip to the verdict" }));
    expect(screen.getByTestId("text-climax").textContent).toBe(climax);
    expect(screen.getByTestId("text-explanation").textContent).toBe(suffix);
    expect(document.body.textContent!.split(suffix)).toHaveLength(2);
  });
});

describe("URL and history", () => {
  it("round-trips selections through the URL and a shared link auto-starts the bout", async () => {
    const first = mountHome();
    await advance();
    selectAnimals("Grizzly bear", "Lion");
    fireEvent.click(screen.getByTestId("button-terrain-shallow_water"));
    fireEvent.click(screen.getByTestId("mode-realistic"));
    const params = new URLSearchParams(window.location.search);
    expect(Object.fromEntries(params)).toEqual({ a: "Grizzly bear", b: "Lion", environment: "shallow_water", mode: "realistic" });
    const shared = window.location.search;
    first.unmount();

    window.history.replaceState(null, "", `/${shared}`);
    mountHome();
    await advance();
    expect(fightBodies()).toEqual([{ animalA: "Grizzly bear", animalB: "Lion", environment: "shallow_water", mode: "realistic", encounter: "face_off" }]);
    expect(screen.getByTestId("stage-bout")).toBeInTheDocument();
    await goBack();
    expect(screen.getByLabelText("Red corner")).toHaveValue("Grizzly bear");
    expect(screen.getByLabelText("Blue corner")).toHaveValue("Lion");
    expect(screen.getByTestId("button-terrain-shallow_water")).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "In the wild" })).toHaveAttribute("aria-pressed", "true");
  });

  it("prefills but does not start for an incomplete or invalid shared link", async () => {
    window.history.replaceState(null, "", "/?a=Lion&b=Unicorn&environment=land&mode=forced_fight");
    mountHome();
    await advance();
    expect(fightBodies()).toHaveLength(0);
    expect(screen.getByLabelText("Red corner")).toHaveValue("Lion");
    expect(screen.getByLabelText("Blue corner")).toHaveValue("");
  });

  it("browser Back returns from the VS reveal to the picker", async () => {
    await toVs();
    expect(screen.getByTestId("stage-vs")).toBeInTheDocument();
    await goBack();
    expect(screen.getByRole("button", { name: "Start the bout" })).toBeInTheDocument();
  });
});

describe("Figure scale", () => {
  it("scales by the cube root of relative body mass on the VS reveal and the stage", async () => {
    animalReply = async () => jsonResponse(heavyAnimals());
    mountHome();
    await advance();
    selectAnimals("Hippopotamus", "Lion");
    fireEvent.click(startButton());
    await advance();
    const expected = Math.cbrt(190 / 1500).toFixed(3);
    expect(screen.getByTestId("vs-figure-red").dataset.scale).toBe("1.000");
    expect(screen.getByTestId("vs-figure-blue").dataset.scale).toBe(expected);
    fireEvent.click(screen.getByRole("button", { name: "Ring the bell" }));
    await advance();
    expect(figure("red").dataset.scale).toBe("1.000");
    expect(figure("blue").dataset.scale).toBe(expected);
    expect(1 / Number(expected)).toBeCloseTo(1.99, 1);
  });
});
