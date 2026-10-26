export const SITE_TITLE = "Animosity: who's favored, and why";
export const SITE_DESCRIPTION = "Pick two animals and an arena. See who's favored, the evidence behind it, and a fight that cites its facts.";
export const ARENA_NAMES = {
  land: "Open Savannah",
  shallow_water: "Riverbank Shallows",
  deep_water: "Open Ocean",
} as const;

export type ShareSelection = {
  a: string; b: string; environment: keyof typeof ARENA_NAMES;
  mode: "forced_fight" | "realistic";
};

export function fightTitle(sel: Pick<ShareSelection, "a" | "b" | "environment">): string {
  return `${sel.a} vs ${sel.b} · ${ARENA_NAMES[sel.environment]} · Animosity`;
}

const slug = (name: string) => name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
export function sharePageName(a: string, b: string, environment: ShareSelection["environment"]): string {
  return `${slug(a)}-vs-${slug(b)}-${environment}.html`;
}

export function shareFightUrl(sel: ShareSelection, origin: string, base: string): string {
  const url = new URL(`${base}share/${sharePageName(sel.a, sel.b, sel.environment)}`, origin);
  url.search = new URLSearchParams({
    a: sel.a, b: sel.b, environment: sel.environment, mode: sel.mode,
  }).toString();
  return url.href;
}
