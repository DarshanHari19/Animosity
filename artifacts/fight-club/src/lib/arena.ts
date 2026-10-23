import type {
  Animal, Beat, BeatAction, EnvironmentLevel, Factor, FightInputEnvironment, FightInputMode,
  FightResponse, MatchupResult,
} from "@workspace/api-client-react";

/** Presentation-only helpers. Nothing here recalculates or changes an engine verdict. */

export type Env = FightInputEnvironment;
export type Mode = FightInputMode;
export type Side = "red" | "blue";
export type Selection = { a: string; b: string; environment: Env; mode: Mode };
export type Stage = "picker" | "vs" | "bout" | "verdict";

export const ENVIRONMENTS: Env[] = ["land", "shallow_water", "deep_water"];
export const MODES: Mode[] = ["forced_fight", "realistic"];

export const TERRAINS: Record<Env, {
  name: string; short: string; upper: string; blurb: string; floor: "sand" | "shallows" | "ocean";
}> = {
  land: { name: "Open Savannah", short: "On land", upper: "ON LAND", blurb: "Dry sand floor. Land animals fight at full strength.", floor: "sand" },
  shallow_water: { name: "Riverbank Shallows", short: "In shallows", upper: "IN SHALLOWS", blurb: "Arena flooded knee-deep. Footing gets tricky.", floor: "shallows" },
  deep_water: { name: "Open Ocean", short: "In deep water", upper: "IN DEEP WATER", blurb: "Arena fully flooded. Only swimmers fight freely.", floor: "ocean" },
};

export const LEVELS: Record<EnvironmentLevel, { label: string; tone: "full" | "hampered" | "cannot" }> = {
  full: { label: "Full strength", tone: "full" },
  hampered: { label: "Hampered", tone: "hampered" },
  cannot: { label: "Can't fight", tone: "cannot" },
};

export const MODE_COPY: Record<Mode, { label: string; rules: string; tagline: string; caption: string }> = {
  forced_fight: {
    label: "Arena", rules: "Arena rules", tagline: "No retreat",
    caption: "No retreat. Environmental disadvantages still count.",
  },
  realistic: {
    label: "In the wild", rules: "In the wild", tagline: "Retreat allowed",
    caption: "Animals may back off, the way most real encounters end.",
  },
};

export const STYLE_LABEL: Record<Animal["fighting_style"], string> = {
  ambush: "Ambush", sustained: "Sustained", bluff: "Bluff", grapple: "Grapple", charge: "Charge",
};

export function formatNumber(n: number, digits = 0): string {
  return n.toLocaleString("en-US", { maximumFractionDigits: digits });
}

export function formatMass(kg: number): string {
  return kg > 0 ? `${formatNumber(kg)} kg` : "No sourced value";
}

export function formatBite(n: number | null): string {
  return n !== null && n > 0 ? `${formatNumber(n)} N` : "No sourced value";
}

/**
 * Figure height follows the cube root of body mass relative to the heavier animal,
 * so the heavier animal draws at 1 and a 1,500 kg vs 190 kg pair differ about 2x.
 */
export function cubeRootScale(massA: number, massB: number): [number, number] {
  if (!(massA > 0) || !(massB > 0) || !Number.isFinite(massA) || !Number.isFinite(massB)) return [1, 1];
  const max = Math.max(massA, massB);
  return [Math.cbrt(massA / max), Math.cbrt(massB / max)];
}

export function outcomeTitle(outcome: MatchupResult["outcome"]): string {
  switch (outcome.kind) {
    case "favored": return `${outcome.animal} favored`;
    case "even": return "Too close to call";
    case "indeterminate": return "Indeterminate";
    case "no_contest": return "No contest";
    case "no_engagement": return outcome.animals.length === 2
      ? "No fight: both animals back off"
      : `No fight: ${outcome.animals[0]} backs off`;
  }
}

/** Gated outcomes carry no fight to watch, so the bout stage is skipped. */
export function skipsBout(response: FightResponse): boolean {
  const k = response.result.outcome.kind;
  if (k === "no_contest" || k === "no_engagement" || k === "indeterminate") return true;
  return response.beats.length === 0 && response.narration_status !== "unavailable";
}

export const EVIDENCE_LABEL: Record<MatchupResult["evidence_quality"], string> = {
  mostly_higher_tier: "Evidence: mostly higher-tier sources",
  mixed: "Evidence: mixed sources",
  mostly_lower_tier_or_unknown: "Evidence: mostly lower-tier sources",
};

export const ENCOUNTER_LABEL: Record<MatchupResult["encounter_label"], string> = {
  hypothetical: "Hypothetical encounter",
  ranges_overlap: "Ranges overlap",
  documented: "Documented encounter",
};

export const NARRATION_REASON: Record<string, string> = {
  INVALID_NARRATION: "the narration failed its fact checks",
  LLM_PROVIDER_FAILURE: "the narrator could not be reached",
  NARRATION_DAILY_CAP_REACHED: "today's narration limit has been reached",
  LLM_NOT_CONFIGURED: "no narrator is configured",
  LLM_CONFIGURATION: "the narrator is misconfigured",
  NARRATION_CAP_CONFIGURATION: "the narration limit is misconfigured",
  NARRATION_FAILED: "narration failed",
};

export const ACTION_VERB: Record<BeatAction, string> = {
  approach: "CLOSES IN", charge: "CHARGES", bite: "BITES", dodge: "DODGES",
  grapple: "GRAPPLES", retreat: "RETREATS", finish: "FINISHES IT",
};

export function actionLine(beat: Beat): string {
  if (beat.animal === null) return "THE BOUT ENDS EVEN";
  return `${beat.animal.toUpperCase()} ${ACTION_VERB[beat.action]}`;
}

export function actionTag(action: BeatAction): string {
  return action[0]!.toUpperCase() + action.slice(1);
}

// ---------- Facts and sources ----------

const FIELD_LABEL: Record<string, [string, string]> = {
  mass_kg: ["weight", "kg"], length_m: ["length", "m"], top_speed_kmh: ["top speed", "km/h"],
  bite_force_n: ["bite force", "N"], primary_weapon: ["primary weapon", ""], armor: ["armor", ""],
  temperament: ["temperament", ""], fighting_style: ["fighting style", ""], profile: ["profile", ""],
};

export type SourceLink = { href: string; label: string };
export type ReadableFactParts = { text: string; links: SourceLink[]; note: string | null; key: string | null };

export function sourceLinks(ref: string): SourceLink[] {
  const found = ref.match(/https?:\/\/[^\s;,)]+/g) ?? [];
  const out: SourceLink[] = [];
  for (const raw of found) {
    const href = raw.replace(/[.]+$/, "");
    try {
      const url = new URL(href);
      if (url.protocol !== "https:" && url.protocol !== "http:") continue;
      const host = url.hostname.replace(/^www\./, "");
      const label = host.includes("wikipedia.org") ? "Wikipedia" : host;
      if (!out.some((l) => l.href === url.href)) out.push({ href: url.href, label });
    } catch { /* not a link */ }
  }
  return out;
}

/** Bibliographic text left after links are removed, so non-URL references still show. */
export function sourceNote(ref: string): string | null {
  const stripped = ref.replace(/https?:\/\/[^\s;,)]+/g, "").replace(/[:;,\s]+$/g, "").trim();
  return stripped.length > 0 && !/^[:;,.\s]*$/.test(stripped) ? stripped : null;
}

function fieldValue(key: string, raw: string): string {
  let value: unknown = raw;
  try { value = JSON.parse(raw); } catch { /* keep raw */ }
  const unit = FIELD_LABEL[key]?.[1] ?? "";
  if (typeof value === "number") return `${formatNumber(value, 2)}${unit ? ` ${unit}` : ""}`;
  return String(value).replaceAll("_", " ");
}

/** Parses "Lion.mass_kg = 190 [tier 3; ref]" into readable text plus real source links. */
export function readFact(fact: string): ReadableFactParts {
  const trait = /^(.*?) \[tier ([123]); (.*)\]$/.exec(fact);
  if (!trait) return { text: fact, links: [], note: null, key: null };
  const [, description, , ref] = trait;
  const field = /^(.+)\.([a-z_]+) = (.+)$/.exec(description!);
  const text = field
    ? `${field[1]} ${FIELD_LABEL[field[2]!]?.[0] ?? field[2]!.replaceAll("_", " ")}, ${fieldValue(field[2]!, field[3]!)}`
    : description!;
  return {
    text, links: sourceLinks(ref!),
    note: sourceLinks(ref!).length ? null : ref!,
    key: field ? `${field[1]}.${field[2]}` : description!,
  };
}

export type SourceEntry = { key: string; text: string; links: SourceLink[]; note: string | null };

/** Sources from the facts the narration cited, plus the trait metadata the tape displays. */
export function buildSources(response: FightResponse, red: Animal | undefined, blue: Animal | undefined): SourceEntry[] {
  const entries: SourceEntry[] = [];
  const seen = new Set<string>();
  const add = (e: SourceEntry) => { if (!seen.has(e.key)) { seen.add(e.key); entries.push(e); } };
  for (const beat of response.beats) {
    for (const fact of beat.facts_used) {
      const parts = readFact(fact);
      if (parts.key && (parts.links.length || parts.note)) add({ key: parts.key, text: parts.text, links: parts.links, note: parts.note });
    }
  }
  for (const animal of [red, blue]) {
    if (!animal) continue;
    const fields: [string, string][] = [
      ["mass_kg", `${animal.name} weight, ${formatMass(animal.mass_kg)}`],
      ["bite_force_n", `${animal.name} bite force, ${formatBite(animal.bite_force_n)}`],
      ["environments", `${animal.name} environment levels`],
    ];
    for (const [key, text] of fields) {
      const src = animal.field_sources[key];
      if (!src || !src.ref.trim() || /\bTODO\b/i.test(src.ref)) continue;
      if (key === "mass_kg" && !(animal.mass_kg > 0)) continue;
      if (key === "bite_force_n" && animal.bite_force_n === null) continue;
      const links = sourceLinks(src.ref);
      add({ key: `${animal.name}.${key}`, text, links, note: links.length ? sourceNote(src.ref) : src.ref });
    }
  }
  return entries;
}

// ---------- Tape ----------

export function findFactor(result: MatchupResult, name: string): Factor | undefined {
  return result.factors.find((f) => f.name === name);
}

export function isScored(factor: Factor | undefined): boolean {
  return !!factor && !factor.reason.startsWith("Not compared");
}

/** EDGE follows the sign of a scored factor relative to the red corner; never on even. */
export function edgeSide(factor: Factor | undefined, outcome: MatchupResult["outcome"]): Side | null {
  if (outcome.kind === "even" || !factor || !isScored(factor)) return null;
  if (factor.value > 0) return "red";
  if (factor.value < 0) return "blue";
  return null;
}

export function signed(v: number): string {
  const r = Math.round(v * 100) / 100;
  if (r === 0) return "0";
  return `${r > 0 ? "+" : "\u2212"}${Math.abs(r).toFixed(2)}`;
}

// ---------- URL ----------

export function readSelectionFromUrl(search: string): Partial<Selection> {
  const p = new URLSearchParams(search);
  const out: Partial<Selection> = {};
  const a = p.get("a"); const b = p.get("b");
  const env = p.get("environment"); const mode = p.get("mode");
  if (a) out.a = a;
  if (b) out.b = b;
  if (env && (ENVIRONMENTS as string[]).includes(env)) out.environment = env as Env;
  if (mode && (MODES as string[]).includes(mode)) out.mode = mode as Mode;
  return out;
}

export function selectionSearch(sel: Partial<Selection>): string {
  const p = new URLSearchParams();
  if (sel.a) p.set("a", sel.a);
  if (sel.b) p.set("b", sel.b);
  if (sel.environment) p.set("environment", sel.environment);
  if (sel.mode) p.set("mode", sel.mode);
  const s = p.toString();
  return s ? `?${s}` : "";
}

/**
 * The server appends a deterministic verdict suffix to the finish beat. Split it so the
 * narrated part is the climax and the exact server suffix is the verdict sentence.
 */
export function splitFinish(text: string, outcome: MatchupResult["outcome"]): { climax: string | null; verdict: string | null } {
  const marker = outcome.kind === "favored" ? `The ${outcome.animal} is favored:`
    : outcome.kind === "even" ? "Too close to call." : null;
  const at = marker ? text.lastIndexOf(marker) : -1;
  if (at < 0) return { climax: text, verdict: null };
  const climax = text.slice(0, at).trim();
  return { climax: climax || null, verdict: text.slice(at) };
}
