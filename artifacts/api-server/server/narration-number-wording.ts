/** "Half open/submerged" describes posture, not a measured quantity. Keep other fractions checked. */
export function withoutPostureHalf(text: string): string {
  return text.replace(/\bhalf(?=[ -](?:open|closed|shut|submerged)\b)/gi, "");
}
