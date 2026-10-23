import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { animals } from "./animals";
import { fightResponseSchemaFor } from "./schemas";
import { fixtureBeats, fixtureResult, startFightServer } from "./test-helpers";
import { narrationCacheKey } from "./narration-cache";

test("PostgreSQL narration survives router restarts and stores only the first validated set", {
  skip: !process.env.DATABASE_URL && "Requires the development Replit database",
}, async t => {
  const { postgresNarrationCache: cache } = await import("./postgres-narration-cache");
  const { db, pool, narrationCacheTable } = await import("@workspace/db");
  const { eq } = await import("drizzle-orm");
  const a = animals[0]!, b = animals[1]!;
  const buildId = `cache-integration-test-${randomUUID()}`;
  const key = narrationCacheKey(a.name, b.name, "land", "forced_fight", buildId);
  t.after(async () => {
    await db.delete(narrationCacheTable).where(eq(narrationCacheTable.key, key));
    await pool.end();
  });
  let calls = 0;
  const narrate = async () => { calls++; return fixtureBeats(a, a.name); };
  const score = () => fixtureResult({ kind: "favored", animal: a.name });
  const input = { animalA: a.name, animalB: b.name, environment: "land", mode: "forced_fight" };
  const first = await startFightServer(t, score, narrate, undefined, undefined, { cache, buildId });
  const original = await (await first.post(input)).json().then(body => fightResponseSchemaFor(animals[0]!, animals[1]!).parse(body));
  assert.equal(original.narration_status, "available");
  assert.equal(original.narration_source, "model");
  // Read with a separate SQL query: this is persisted JSONB, not an in-memory route cache.
  const saved = await pool.query("SELECT beats, build_id FROM narration_cache WHERE key = $1", [key]);
  assert.deepEqual(saved.rows[0]?.beats, original.beats);
  assert.equal(saved.rows[0]?.build_id, buildId);
  const different = fixtureBeats(a, a.name);
  different[0]!.text = "The Lion circles.";
  await cache.put(key, buildId, different);
  const restarted = await startFightServer(t, score, narrate, undefined, undefined, { cache, buildId });
  const hit = await restarted.post(input);
  const cached = await hit.json().then(body => fightResponseSchemaFor(animals[0]!, animals[1]!).parse(body));
  assert.equal(cached.narration_source, "cache");
  assert.deepEqual(cached.beats, original.beats);
  assert.equal(hit.headers.get("X-Narration-Attempts"), "0");
  assert.equal(calls, 1);
});
