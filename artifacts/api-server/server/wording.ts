import type { Environment } from "./schemas";

/** User-facing wording only; never changes engine inputs or scoring. */
export function environmentPhrase(environment: Environment): string {
  return environment === "land" ? "on land" : `in ${environment.replaceAll("_", " ")}`;
}

export function humanWording(text: string): string {
  return text.replace(/\bin land\b/gi, "on land")
    .replace(/\bshallow_water\b/g, "shallow water")
    .replace(/\bdeep_water\b/g, "deep water")
    .replace(/\brealistic mode\b/gi, "In the wild")
    .replace(/\bforced_fight\b/g, "Arena");
}
