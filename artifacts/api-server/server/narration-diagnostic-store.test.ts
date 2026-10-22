import assert from "node:assert/strict";
import { test } from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { appendDiagnostic, diagnosticOffset, readDiagnostics, diagnosticsForRun,
  summarizeDiagnosticChecks, type DiagnosticAttempt } from "./narration-diagnostic-store";
import { logNarrationFailure } from "./narration-diagnostics";

const attempt = (id: string, index: number, text: string): DiagnosticAttempt => ({
  narration_id: id, attempt: index, timestamp: `2026-10-22T10:00:0${index}.000Z`,
  animals: ["Lion", "Grizzly bear"],
  checks: [{ check: "text_consistency", text }],
});

test("server journal is immediately readable, offset-based and private, without raw model responses", t => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "animosity-diagnostics-"));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const file = path.join(directory, "attempts.jsonl");
  assert.equal(diagnosticOffset(file), 0);
  assert.deepEqual(readDiagnostics(0, file), []);
  appendDiagnostic(attempt("older", 1, "Old failure."), file);
  const offset = diagnosticOffset(file);
  appendDiagnostic(attempt("current", 1, "The Lion wins."), file);
  appendDiagnostic(attempt("current", 2, "The Grizzly bear wins."), file);
  const records = readDiagnostics(offset, file);
  assert.deepEqual(records.map(r => [r.narration_id, r.attempt]), [["current", 1], ["current", 2]]);
  assert.equal(fs.statSync(file).mode & 0o777, 0o600);
  assert.equal(fs.readFileSync(file, "utf8").includes("raw_model_text"), false);
  assert.deepEqual(readDiagnostics(diagnosticOffset(file), file), []);
  fs.truncateSync(file, 0);
  assert.throws(() => readDiagnostics(offset, file), /truncated/);
});

test("eval correlates embedded timestamps and invocation IDs, including failed first attempts before recovery", () => {
  const record = attempt("request-a", 1, "The Lion wins.");
  const unrelated = { ...attempt("other", 1, "Unrelated."), animals: ["Gorilla", "Lion"] };
  const old = { ...record, narration_id: "older", timestamp: "2026-10-21T10:00:01.000Z" };
  const run = {
    started: "2026-10-22T10:00:00.000Z", finished: "2026-10-22T10:00:04.000Z",
    animals: record.animals, attempts: 2, available: true,
  };
  assert.deepEqual(diagnosticsForRun([unrelated, old, record], run), [record]);
  assert.deepEqual(diagnosticsForRun([], { ...run, attempts: 1 }), []);
  assert.deepEqual(diagnosticsForRun([], { ...run, attempts: 0, available: false }), []);
  const second = attempt("request-a", 2, "The Grizzly bear wins.");
  assert.deepEqual(diagnosticsForRun([record, second], { ...run, available: false }), [record, second]);
  assert.throws(() => diagnosticsForRun([], run), /Missing or ambiguous/);
  assert.throws(() => diagnosticsForRun([record, { ...second, narration_id: "overlap" }],
    { ...run, available: false }), /Missing or ambiguous/);
  assert.throws(() => diagnosticsForRun([record, record], { ...run, available: false }), /Missing or ambiguous/);
});

test("eval counts every attempt by check name, deduplicates same-attempt checks and caps distinct examples at three", () => {
  const records = [
    { ...attempt("a", 1, "First bad sentence."), checks: [
      { check: "text_consistency", text: "First bad sentence." },
      { check: "text_consistency", text: "Another sentence in that attempt." },
      { check: "causal_grounding", text: "Because strength decides it." },
    ] },
    attempt("a", 2, "First bad sentence."),
    attempt("b", 1, "Third bad sentence."),
    attempt("b", 2, "Fourth bad sentence."),
    { ...attempt("c", 1, ""), checks: [{ check: "JSON_parse", text: '{"beats":' }] },
    { ...attempt("d", 1, ""), checks: [{ check: "Zod_schema" }] },
  ];
  const rows = summarizeDiagnosticChecks(records);
  assert.deepEqual(rows.find(r => r.check === "text_consistency"), {
    check: "text_consistency", failed_attempts: 4,
    examples: ["First bad sentence.", "Another sentence in that attempt.", "Third bad sentence."],
  });
  assert.deepEqual(rows.find(r => r.check === "causal_grounding"), {
    check: "causal_grounding", failed_attempts: 1, examples: ["Because strength decides it."],
  });
  assert.deepEqual(rows.find(r => r.check === "JSON_parse"), { check: "JSON_parse", failed_attempts: 1, examples: [] });
  assert.deepEqual(rows.find(r => r.check === "Zod_schema"), { check: "Zod_schema", failed_attempts: 1, examples: [] });
  assert.deepEqual(summarizeDiagnosticChecks([]), []);
});

test("diagnostic file failures cannot alter narration or its retry behavior", t => {
  t.mock.method(fs, "appendFileSync", () => { throw Error("Test-only disk error"); });
  assert.doesNotThrow(() => logNarrationFailure({
    narration_id: "test-only", animals: ["Lion", "Grizzly bear"], model: "test-only",
    attempt: 1, expectedOutcome: { kind: "even" },
  }, [{ check: "JSON_parse" }], "test-only malformed response"));
});
