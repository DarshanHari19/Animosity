/** Parses TRUST_PROXY_HOPS (a non-negative integer). Blank or unset means 1. Invalid fails startup. */
export function trustProxyHops(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === "") return 1;
  const value = Number(raw.trim());
  if (!Number.isInteger(value) || value < 0 || value > 10) {
    throw new Error("TRUST_PROXY_HOPS must be an integer from 0 to 10.");
  }
  return value;
}
