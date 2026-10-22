import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { FailureCheck } from "./narration-diagnostics";

// Server/Shell only. Not a public directory or HTTP endpoint; generated output
// is excluded from Git and publishing. Raw model responses stay in server logs.
export const diagnosticFile = fileURLToPath(new URL(
  "../../../generated-artifacts/narration-diagnostics/attempts.jsonl", import.meta.url,
));
export type DiagnosticAttempt = {
  timestamp: string; narration_id: string; animals: string[]; attempt: number;
  checks: FailureCheck[];
};
const recordSchema = z.object({
  timestamp: z.string().datetime(), narration_id: z.string().min(1),
  animals: z.array(z.string()).length(2), attempt: z.number().int().min(1).max(2),
  checks: z.array(z.object({
    check: z.string().min(1), text: z.string().optional(),
  })),
});

export function appendDiagnostic(record: DiagnosticAttempt, file = diagnosticFile): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  // Synchronous append precedes the HTTP response: no pino transport buffering.
  fs.appendFileSync(file, `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
}

export function diagnosticOffset(file = diagnosticFile): number {
  try { return fs.statSync(file).size; }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0;
    throw error;
  }
}

export function readDiagnostics(offset: number, file = diagnosticFile) {
  const end = diagnosticOffset(file);
  if (end < offset) throw Error("Diagnostic journal was truncated during evaluation.");
  if (end === offset) return [];
  const buffer = Buffer.alloc(end - offset);
  const fd = fs.openSync(file, "r");
  try {
    let read = 0;
    while (read < buffer.length) {
      const count = fs.readSync(fd, buffer, read, buffer.length - read, offset + read);
      if (!count) throw Error("Diagnostic journal changed during evaluation.");
      read += count;
    }
  } finally { fs.closeSync(fd); }
  return buffer.toString("utf8").trim().split(/\r?\n/).map(line => recordSchema.parse(JSON.parse(line)));
}

export type EvaluationDiagnostic = ReturnType<typeof readDiagnostics>[number];

/** Correlate server timestamps and names, never buffered log arrival. */
export function diagnosticsForRun(records: EvaluationDiagnostic[], run: {
  started: string; finished: string; animals: string[]; attempts: number; available: boolean;
}): EvaluationDiagnostic[] {
  const start = Date.parse(run.started), end = Date.parse(run.finished);
  const matched = records.filter(record => {
    const time = Date.parse(record.timestamp);
    return time >= start && time <= end &&
      record.animals.every((name, index) => name === run.animals[index]);
  });
  const expected = run.attempts - Number(run.available);
  if (new Set(matched.map(record => record.narration_id)).size > 1 ||
    matched.length !== expected || new Set(matched.map(record => record.attempt)).size !== matched.length) {
    throw Error("Missing or ambiguous server diagnostics. Run eval beside the current API in the same workspace; do not run overlapping identical matchups.");
  }
  return matched;
}

/** Count a check once per failed provider attempt, not once per affected beat. */
export function summarizeDiagnosticChecks(records: EvaluationDiagnostic[]) {
  const rows = new Map<string, { check: string; failed_attempts: number; examples: string[] }>();
  for (const record of records) {
    const seen = new Set<string>();
    for (const failure of record.checks) {
      const row = rows.get(failure.check) ?? { check: failure.check, failed_attempts: 0, examples: [] };
      if (!seen.has(failure.check)) row.failed_attempts++;
      seen.add(failure.check);
      const text = failure.text?.trim();
      // Structural failures may have no sentence. Never print a raw tool JSON
      // blob as an example or manufacture a sentence for a parse failure.
      if (text && !/^[{[]/.test(text) && !row.examples.includes(text) && row.examples.length < 3) row.examples.push(text);
      rows.set(failure.check, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.check.localeCompare(b.check));
}
