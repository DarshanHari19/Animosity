import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FightInputEnvironment, FightInputMode } from "@workspace/api-client-react";
import Home from "./home";
import { animals, deferred, jsonResponse, responseFixture } from "../test/fixtures";

// Exercise the real generated hooks and JSON transport, but forbid live requests.
let fetchMock: ReturnType<typeof vi.fn<typeof fetch>>;
let animalReply: () => Promise<Response>;
let fightReply: () => Promise<Response>;
let clients: QueryClient[];

async function advance(ms = 0) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
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
  fireEvent.change(screen.getByLabelText("Animal A"), { target: { value: a } });
  fireEvent.change(screen.getByLabelText("Animal B"), { target: { value: b } });
}

async function startFight() {
  mountHome();
  await advance();
  selectAnimals();
  fireEvent.click(screen.getByRole("button", { name: "Fight" }));
  await advance();
}

function beatItems() {
  return within(screen.getByTestId("section-playback")).queryAllByTestId(/^text-beat-/);
}

function figureTransform(side: "left" | "right") {
  return screen.getByTestId(`figure-${side}`).firstElementChild?.getAttribute("transform");
}

beforeEach(() => {
  vi.useFakeTimers();
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

describe("Home request and status handling", () => {
  it("disables Fight until both selectors are set, including identical selections", async () => {
    mountHome();
    await advance();
    const fight = screen.getByTestId("button-fight");
    expect(fight).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Animal A"), { target: { value: "Lion" } });
    expect(fight).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Animal B"), { target: { value: "Lion" } });
    expect(fight).toBeEnabled();
    fireEvent.click(fight);
    await advance();
    const call = fetchMock.mock.calls.find(([url]) => url === "/api/fight");
    expect(JSON.parse(call![1]!.body as string)).toEqual({
      animalA: "Lion", animalB: "Lion", environment: "land",
      mode: "realistic", encounter: "face_off",
    });
    // Identical selections take the normal response path, not a forced even result.
    await advance(6000);
    expect(screen.getByTestId("text-outcome")).toHaveTextContent("Lion favored");
  });

  const contexts: [FightInputEnvironment, FightInputMode][] = [
    ["land", "realistic"], ["shallow_water", "forced_fight"], ["deep_water", "forced_fight"],
  ];
  it.each(contexts)("submits %s / %s / face_off and retains submitted context", async (environment, mode) => {
    const pending = deferred<Response>();
    fightReply = () => pending.promise;
    mountHome();
    await advance();
    selectAnimals();
    fireEvent.change(screen.getByLabelText("Environment"), { target: { value: environment } });
    fireEvent.click(screen.getByTestId(mode === "realistic" ? "mode-realistic" : "mode-forced-fight"));
    expect(screen.getByTestId("text-mode-caption").textContent).toBe(
      "Forced fight: no retreat; environmental disadvantages count.",
    );
    fireEvent.click(screen.getByTestId("button-fight"));
    await advance();
    const call = fetchMock.mock.calls.find(([url]) => url === "/api/fight");
    expect(JSON.parse(call![1]!.body as string)).toEqual({
      animalA: "Lion", animalB: "Grizzly bear", environment, mode, encounter: "face_off",
    });
    expect(screen.getByTestId("button-fight")).toBeDisabled();
    expect(screen.getByTestId("button-fight")).toHaveTextContent("Fighting...");
    expect(screen.queryByTestId("section-playback")).not.toBeInTheDocument();
    // Editing the controls while pending must not relabel the submitted matchup.
    selectAnimals("Grizzly bear", "Lion");
    fireEvent.change(screen.getByLabelText("Environment"), { target: { value: "deep_water" } });
    fireEvent.click(screen.getByTestId("mode-realistic"));
    pending.resolve(jsonResponse(responseFixture()));
    await advance();
    expect(screen.getByRole("heading", { level: 2 }).textContent).toBe(
      `Lion vs Grizzly bear (${environment.replaceAll("_", " ")}, ${mode.replaceAll("_", " ")})`,
    );
    expect(screen.getByTestId("button-fight")).toBeEnabled();
  });

  it("shows animal loading, readable failure, and a working Retry", async () => {
    const pending = deferred<Response>();
    animalReply = () => pending.promise;
    mountHome();
    expect(screen.getByTestId("status-animals-loading")).toHaveTextContent("Loading animals...");
    expect(screen.getByLabelText("Animal A")).toBeDisabled();
    expect(screen.getByLabelText("Animal B")).toBeDisabled();
    expect(screen.getByTestId("button-fight")).toBeDisabled();
    pending.resolve(jsonResponse({ error: "Fixture animals unavailable", code: "fixture-error" }, 503));
    await advance();
    expect(screen.getByTestId("status-animals-error")).toHaveTextContent(
      "Could not load animals: Fixture animals unavailable (fixture-error)",
    );
    animalReply = async () => jsonResponse(animals);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await advance();
    expect(screen.queryByTestId("status-animals-error")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Animal A")).toBeEnabled();
    expect(fetchMock.mock.calls.filter(([url]) => url === "/api/animals")).toHaveLength(2);
  });

  it("handles an empty animal list without enabling selectors or Fight", async () => {
    animalReply = async () => jsonResponse([]);
    mountHome();
    await advance();
    expect(screen.getByText("No animals available.")).toBeInTheDocument();
    expect(screen.getByLabelText("Animal A")).toBeDisabled();
    expect(screen.getByTestId("button-fight")).toBeDisabled();
  });

  it.each(["api", "network"] as const)("shows %s fight errors without inventing playback and clears them on retry", async (kind) => {
    fightReply = kind === "api"
      ? async () => jsonResponse({ error: "Scoring is not implemented", code: "scoring-not-implemented" }, 501)
      : async () => { throw new Error("Fixture network failure"); };
    const interval = vi.spyOn(window, "setInterval");
    await startFight();
    expect(screen.getByRole("alert")).toHaveTextContent(kind === "api"
      ? "Fight failed: Scoring is not implemented (scoring-not-implemented)"
      : "Fight failed: Fixture network failure");
    expect(screen.queryByTestId("section-playback")).not.toBeInTheDocument();
    expect(interval).not.toHaveBeenCalled();
    expect(screen.getByTestId("button-fight")).toBeEnabled();
    const pending = deferred<Response>();
    fightReply = () => pending.promise;
    fireEvent.click(screen.getByTestId("button-fight"));
    await advance();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    pending.resolve(jsonResponse(responseFixture()));
    await advance();
    expect(beatItems()).toHaveLength(1);
  });
});

describe("Home playback", () => {
  it("reveals one beat immediately, then exactly every 1.5 seconds, and only then shows the card", async () => {
    const response = responseFixture();
    const interval = vi.spyOn(window, "setInterval");
    await startFight();
    expect(interval).toHaveBeenCalledTimes(1);
    expect(interval).toHaveBeenCalledWith(expect.any(Function), 1500);
    expect(beatItems()).toHaveLength(1);
    expect(screen.queryByTestId("card-result")).not.toBeInTheDocument();
    for (let i = 1; i < response.beats.length; i++) {
      await advance(1499);
      expect(beatItems()).toHaveLength(i);
      expect(screen.queryByTestId("card-result")).not.toBeInTheDocument();
      await advance(1);
      expect(beatItems()).toHaveLength(i + 1);
      expect(screen.getByTestId(`text-beat-${i}`)).toHaveTextContent(response.beats[i].text);
      expect(screen.getByTestId(`text-beat-${i}`)).toHaveTextContent(`Facts: ${response.beats[i].facts_used.join(" | ")}`);
    }
    expect(screen.getByTestId("card-result")).toBeInTheDocument();
    expect(vi.getTimerCount()).toBe(0);
    await advance(15000);
    expect(beatItems()).toHaveLength(5);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["Lion", "Grizzly bear"])("shows only %s victorious at a favored finish", async (animal) => {
    fightReply = async () => jsonResponse(responseFixture({ kind: "favored", animal }));
    await startFight();
    await advance(6000);
    expect(screen.getByTestId("text-outcome")).toHaveTextContent(`${animal} favored`);
    expect(figureTransform("left")).toBe(animal === "Lion"
      ? "translate(130 100) scale(1 1) rotate(0)"
      : "translate(80 140) scale(1 1) rotate(-60)");
    expect(figureTransform("right")).toBe(animal === "Grizzly bear"
      ? "translate(190 100) scale(-1 1) rotate(0)"
      : "translate(240 140) scale(-1 1) rotate(-60)");
  });

  it("keeps both figures upright and neutral for an even finish", async () => {
    fightReply = async () => jsonResponse(responseFixture({ kind: "even" }));
    await startFight();
    await advance(6000);
    expect(screen.getByTestId("text-outcome")).toHaveTextContent("Even matchup");
    expect(screen.getByTestId("text-beat-4")).toHaveTextContent("No winner [finish]");
    expect(figureTransform("left")).toBe("translate(90 100) scale(1 1) rotate(0)");
    expect(figureTransform("right")).toBe("translate(230 100) scale(-1 1) rotate(0)");
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["indeterminate", "no_contest"] as const)("shows %s explanation immediately without starting a timer", async (kind) => {
    const response = responseFixture({ kind });
    fightReply = async () => jsonResponse(response);
    const interval = vi.spyOn(window, "setInterval");
    await startFight();
    expect(screen.getByTestId("card-result")).toBeInTheDocument();
    expect(screen.getByTestId("text-outcome")).toHaveTextContent(kind === "indeterminate" ? "Indeterminate" : "No contest");
    expect(screen.getByTestId("text-explanation").textContent).toBe(response.explanation);
    expect(screen.getByTestId("text-profile-assumption").textContent).toBe("Assumes adult males");
    expect(screen.queryByRole("img", { name: "Stick figure fight" })).not.toBeInTheDocument();
    expect(beatItems()).toHaveLength(0);
    expect(interval).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears the old interval and playback on restart, and starts the new clock at the new response", async () => {
    const clear = vi.spyOn(window, "clearInterval");
    const interval = vi.spyOn(window, "setInterval");
    await startFight();
    const oldTimer = interval.mock.results[0].value;
    await advance(1000);
    const pending = deferred<Response>();
    fightReply = () => pending.promise;
    fireEvent.click(screen.getByTestId("button-fight"));
    await advance();
    expect(clear).toHaveBeenCalledWith(oldTimer);
    expect(screen.queryByTestId("section-playback")).not.toBeInTheDocument();
    await advance(5000);
    expect(screen.queryByTestId("section-playback")).not.toBeInTheDocument();
    const next = responseFixture({ kind: "even" });
    next.beats[0].text = "New fictional first beat.";
    pending.resolve(jsonResponse(next));
    await advance();
    expect(beatItems()).toHaveLength(1);
    expect(screen.getByTestId("text-beat-0")).toHaveTextContent("New fictional first beat.");
    await advance(1499);
    expect(beatItems()).toHaveLength(1);
    await advance(1);
    expect(beatItems()).toHaveLength(2);
    await advance(4500);
    expect(screen.getByTestId("text-outcome")).toHaveTextContent("Even matchup");
    expect(interval).toHaveBeenCalledTimes(2);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("clears an active playback interval when unmounted", async () => {
    const clear = vi.spyOn(window, "clearInterval");
    const interval = vi.spyOn(window, "setInterval");
    const view = mountHome();
    await advance();
    selectAnimals();
    fireEvent.click(screen.getByTestId("button-fight"));
    await advance();
    const timer = interval.mock.results[0].value;
    view.unmount();
    expect(clear).toHaveBeenCalledWith(timer);
    expect(vi.getTimerCount()).toBe(0);
    await advance(15000);
    expect(vi.getTimerCount()).toBe(0);
  });

  it.each(["success", "failure"] as const)("ignores a late %s from an unmounted request without affecting a new matchup", async (settlement) => {
    const pending = deferred<Response>();
    fightReply = () => pending.promise;
    const interval = vi.spyOn(window, "setInterval");
    const old = mountHome();
    await advance();
    selectAnimals();
    fireEvent.click(screen.getByTestId("button-fight"));
    await advance();
    old.unmount();
    fightReply = async () => jsonResponse(responseFixture({ kind: "even" }));
    await startFight();
    expect(interval).toHaveBeenCalledTimes(1);
    if (settlement === "success") pending.resolve(jsonResponse(responseFixture()));
    else pending.reject(new Error("Late fictional failure"));
    await advance();
    expect(interval).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(beatItems()).toHaveLength(1);
    await advance(6000);
    expect(screen.getByTestId("text-outcome")).toHaveTextContent("Even matchup");
    expect(vi.getTimerCount()).toBe(0);
  });
});
