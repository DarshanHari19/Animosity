import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import type { AddressInfo } from "node:net";
import express from "express";
import healthRouter from "../src/routes/health";
import { BUILD_ID } from "../src/build-id";

test("health exposes the immutable build identity without caching and preserves healthz", async (t) => {
  const app = express();
  app.use("/api", healthRouter);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await fetch(`${url}/api/health`);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), { status: "ok", build_id: BUILD_ID });
    assert.ok(BUILD_ID.length);
  }
  assert.deepEqual(await (await fetch(`${url}/api/healthz`)).json(), { status: "ok" });
});
