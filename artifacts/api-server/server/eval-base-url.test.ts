import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveEvalBaseUrl } from "./eval-base-url";

test("eval base URL: --base-url flag wins over every environment variable", () => {
  const env = { EVAL_BASE_URL: "https://env.example", REPLIT_DEV_DOMAIN: "dev.example", PORT: "9000" };
  assert.equal(resolveEvalBaseUrl({ flag: "https://flag.example", env }), "https://flag.example");
});
test("eval base URL: EVAL_BASE_URL wins over the local default", () => {
  const env = { EVAL_BASE_URL: "https://env.example", REPLIT_DEV_DOMAIN: "dev.example", PORT: "9000" };
  assert.equal(resolveEvalBaseUrl({ env }), "https://env.example");
});
test("eval base URL: falls back to localhost on PORT and ignores REPLIT_DEV_DOMAIN", () => {
  assert.equal(resolveEvalBaseUrl({ env: { REPLIT_DEV_DOMAIN: "dev.example", PORT: "9000" } }), "http://localhost:9000");
  assert.equal(resolveEvalBaseUrl({ env: { PORT: "9000" } }), "http://localhost:9000");
});
test("eval base URL: defaults to http://localhost:8080 and treats blank values as unset", () => {
  assert.equal(resolveEvalBaseUrl({ env: {} }), "http://localhost:8080");
  assert.equal(
    resolveEvalBaseUrl({ flag: "", env: { EVAL_BASE_URL: "", REPLIT_DEV_DOMAIN: "", PORT: "" } }),
    "http://localhost:8080",
  );
});
