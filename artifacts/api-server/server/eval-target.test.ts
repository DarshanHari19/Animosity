import assert from "node:assert/strict";
import { test } from "node:test";
import { assertSafeEvalTarget, isLocalTarget } from "./eval-base-url";

const check = (value: string) => assertSafeEvalTarget(new URL(value));

test("eval target: https remote and any local http/https are allowed", () => {
  for (const ok of ["https://staging.example.com", "http://localhost:8080", "http://127.0.0.1:8080", "http://[::1]:8080", "https://localhost"]) {
    assert.doesNotThrow(() => check(ok), ok);
  }
});

test("eval target: remote http is refused so the token is never sent in cleartext", () => {
  for (const bad of ["http://staging.example.com", "http://10.0.0.5:8080", "http://localhost.example.com"]) {
    assert.throws(() => check(bad), /https/, bad);
  }
});

test("eval target: credentials and non-http schemes are refused", () => {
  for (const bad of ["https://user:pw@staging.example.com", "ftp://staging.example.com"]) {
    assert.throws(() => check(bad), /Invalid base URL/, bad);
  }
  assert.equal(isLocalTarget(new URL("http://localhost:1")), true);
  assert.equal(isLocalTarget(new URL("https://example.com")), false);
});
