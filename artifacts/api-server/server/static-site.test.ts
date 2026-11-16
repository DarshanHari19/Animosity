import assert from "node:assert/strict";
import { test } from "node:test";
import { once } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { AddressInfo } from "node:net";
import express from "express";
import { mountFrontend } from "../src/static-site";
import { trustProxyHops } from "../src/trust-proxy";

function site(t: { after: (fn: () => void) => void }, withDist: boolean) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "animosity-static-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  if (withDist) {
    fs.mkdirSync(path.join(dir, "assets"));
    fs.mkdirSync(path.join(dir, "share"));
    fs.writeFileSync(path.join(dir, "index.html"), "<html>shell</html>");
    fs.writeFileSync(path.join(dir, "assets", "app-abc123.js"), "console.log(1)");
    fs.writeFileSync(path.join(dir, "og-image.png"), "png");
    fs.writeFileSync(path.join(dir, "share", "a-vs-b-land.html"), "<html>share</html>");
  }
  const app = express();
  app.get("/api/ok", (_req, res) => { res.json({ ok: true }); });
  app.use("/api", (_req, res) => { res.status(404).json({ code: "NOT_FOUND" }); });
  const enabled = mountFrontend(app, dir);
  return { app, enabled };
}

async function listen(t: { after: (fn: () => void) => void }, app: express.Express) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(() => { server.closeAllConnections(); server.close(); });
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

test("frontend: serves files with the right cache policy and the SPA fallback", async t => {
  const { app, enabled } = site(t, true);
  assert.equal(enabled, true);
  const url = await listen(t, app);
  const index = await fetch(`${url}/`);
  assert.equal(await index.text(), "<html>shell</html>");
  assert.equal(index.headers.get("cache-control"), "no-cache");
  const fallback = await fetch(`${url}/how-it-works`);
  assert.equal(await fallback.text(), "<html>shell</html>");
  assert.equal(fallback.headers.get("cache-control"), "no-cache");
  const asset = await fetch(`${url}/assets/app-abc123.js`);
  assert.match(asset.headers.get("content-type") ?? "", /javascript/);
  assert.equal(asset.headers.get("cache-control"), "public, max-age=31536000, immutable");
  assert.equal((await fetch(`${url}/og-image.png`)).headers.get("cache-control"), "public, max-age=3600");
  const share = await fetch(`${url}/share/a-vs-b-land.html`);
  assert.equal(await share.text(), "<html>share</html>");
  assert.equal(share.headers.get("cache-control"), "no-cache");
});

test("frontend: /api stays JSON, missing files 404, non-GET does not fall back", async t => {
  const { app } = site(t, true);
  const url = await listen(t, app);
  const missingApi = await fetch(`${url}/api/nope`);
  assert.equal(missingApi.status, 404);
  assert.deepEqual(await missingApi.json(), { code: "NOT_FOUND" });
  assert.equal((await fetch(`${url}/missing.png`)).status, 404);
  assert.equal((await fetch(`${url}/how-it-works`, { method: "POST" })).status, 404);
});

test("frontend: disabled when the build output is absent", async t => {
  const { app, enabled } = site(t, false);
  assert.equal(enabled, false);
  assert.equal((await fetch(`${await listen(t, app)}/`)).status, 404);
});

test("trust proxy hops: default 1, integer override, invalid rejected", () => {
  assert.equal(trustProxyHops(undefined), 1);
  assert.equal(trustProxyHops("  "), 1);
  assert.equal(trustProxyHops("2"), 2);
  assert.equal(trustProxyHops("0"), 0);
  for (const bad of ["x", "-1", "1.5", "99"]) assert.throws(() => trustProxyHops(bad), /TRUST_PROXY_HOPS/);
});
