import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeDatabaseUrl, pickMigrationUrl } from "./connection-url";

const base = "postgresql://user:dummy-pass@ep-dummy-pooler.example.test/db";

test("require, prefer and verify-ca are rewritten to verify-full", () => {
  for (const mode of ["require", "prefer", "verify-ca"]) {
    assert.equal(
      normalizeDatabaseUrl(`${base}?sslmode=${mode}`),
      `${base}?sslmode=verify-full`,
    );
  }
});

test("verify-full, disable, no-verify and a missing sslmode are unchanged", () => {
  for (const q of ["?sslmode=verify-full", "?sslmode=disable", "?sslmode=no-verify", ""]) {
    assert.equal(normalizeDatabaseUrl(base + q), base + q);
  }
});

test("uselibpqcompat=true is unchanged", () => {
  const u = `${base}?sslmode=require&uselibpqcompat=true`;
  assert.equal(normalizeDatabaseUrl(u), u);
});

test("an encoded password round-trips", () => {
  const u = "postgresql://user:p%40%23%2F%3Fw@ep-dummy.example.test/db?sslmode=require";
  const out = new URL(normalizeDatabaseUrl(u));
  assert.equal(out.password, "p%40%23%2F%3Fw");
  assert.equal(decodeURIComponent(out.password), "p@#/?w");
  assert.equal(out.searchParams.get("sslmode"), "verify-full");
});

test("channel_binding round-trips", () => {
  const out = new URL(normalizeDatabaseUrl(`${base}?channel_binding=require&sslmode=require`));
  assert.equal(out.searchParams.get("channel_binding"), "require");
  assert.equal(out.searchParams.get("sslmode"), "verify-full");
});

test("a non-URL key=value string is unchanged", () => {
  const s = "host=localhost dbname=app sslmode=require";
  assert.equal(normalizeDatabaseUrl(s), s);
});

test("a repeated sslmode is read the way pg reads it (last value wins)", () => {
  const off = `${base}?sslmode=require&sslmode=disable`;
  assert.equal(normalizeDatabaseUrl(off), off);
  const on = normalizeDatabaseUrl(`${base}?sslmode=disable&sslmode=require`);
  assert.equal(new URL(on).searchParams.get("sslmode"), "verify-full");
});

test("pickMigrationUrl uses the unpooled URL only for the direct twin of DATABASE_URL", () => {
  const pooled = "postgresql://u:p@ep-abc-pooler.r.example.test/db";
  const direct = "postgresql://u:p@ep-abc.r.example.test/db";
  const twin = pickMigrationUrl({ DATABASE_URL: pooled, DATABASE_URL_UNPOOLED: direct });
  assert.deepEqual(
    [twin?.url, twin?.hostname, twin?.usedUnpooled],
    [direct, "ep-abc.r.example.test", true],
  );
});

test("pickMigrationUrl ignores an unpooled URL for a different database", () => {
  const other = "postgresql://u:p@localhost:5432/other";
  const r = pickMigrationUrl({
    DATABASE_URL: other,
    DATABASE_URL_UNPOOLED: "postgresql://u:p@ep-abc.r.example.test/db",
  });
  assert.deepEqual([r?.url, r?.hostname, r?.usedUnpooled], [other, "localhost", false]);
});

test("pickMigrationUrl falls back to DATABASE_URL and returns null without it", () => {
  assert.equal(pickMigrationUrl({ DATABASE_URL_UNPOOLED: base })?.url, undefined);
  assert.equal(pickMigrationUrl({ DATABASE_URL: base })?.url, base);
});
