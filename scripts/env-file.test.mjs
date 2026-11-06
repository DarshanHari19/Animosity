import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { loadDotEnv } from "./env-file.mjs";

function load(content, env = {}) {
  const dir = mkdtempSync(join(tmpdir(), "env-file-test-"));
  try {
    writeFileSync(join(dir, ".env"), content);
    const warnings = [];
    loadDotEnv(join(dir, ".env"), env, (message) => warnings.push(message));
    return { env, warnings };
  } finally { rmSync(dir, { recursive: true, force: true }); }
}

test("loads plain values and lets the shell win", () => {
  const { env, warnings } = load("A=1\nB=two\n", { B: "shell" });
  assert.deepEqual(env, { A: "1", B: "shell" });
  assert.deepEqual(warnings, []);
});

test("a missing file is fine", () => {
  const env = {};
  loadDotEnv("/nonexistent-dir/.env", env, () => assert.fail("no warning expected"));
  assert.deepEqual(env, {});
});

test("a trailing-space line that absorbs the next line is dropped with a warning naming only the variable", () => {
  const { env, warnings } = load("NARRATION_MODEL= \nOPENROUTER_API_KEY=dummy-secret-value\nOTHER=ok\n");
  assert.equal("NARRATION_MODEL" in env, false);
  assert.equal(env.OTHER, "ok");
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /NARRATION_MODEL/);
  assert.equal(warnings[0].includes("dummy-secret-value"), false);
  assert.equal(warnings[0].includes("OPENROUTER_API_KEY"), false);
});
