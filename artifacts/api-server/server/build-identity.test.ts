import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveBuildIdentity } from "../build-identity.mjs";

const SHA = "0123456789abcdef0123456789abcdef01234567";

test("build identity: commit plus deployment prefix, with the commit reported separately", () => {
  const out = resolveBuildIdentity({ RAILWAY_GIT_COMMIT_SHA: SHA, RAILWAY_DEPLOYMENT_ID: "abcdef12-3456-7890-abcd-ef1234567890" });
  assert.deepEqual(out, { buildId: `${SHA}.abcdef12`, commit: SHA });
});

test("build identity: two deployments of one commit get different IDs", () => {
  const id = (deployment: string) => resolveBuildIdentity({ RAILWAY_GIT_COMMIT_SHA: SHA, RAILWAY_DEPLOYMENT_ID: deployment }).buildId;
  assert.notEqual(id("aaaaaaaa-1"), id("bbbbbbbb-2"));
});

test("build identity: commit alone, BUILD_ID override, and the timestamp fallback", () => {
  assert.deepEqual(resolveBuildIdentity({ RAILWAY_GIT_COMMIT_SHA: SHA }), { buildId: SHA, commit: SHA });
  assert.deepEqual(resolveBuildIdentity({ BUILD_ID: "pinned", RAILWAY_GIT_COMMIT_SHA: SHA }), { buildId: "pinned", commit: SHA });
  const fallback = resolveBuildIdentity({ RAILWAY_DEPLOYMENT_ID: "abcdef12" }); // `railway up`: no commit
  assert.equal(fallback.commit, undefined);
  assert.ok(!Number.isNaN(Date.parse(fallback.buildId)));
  assert.equal(resolveBuildIdentity({ BUILD_ID: "  ", RAILWAY_GIT_COMMIT_SHA: "" }).commit, undefined);
});

test("build identity: unsafe values are rejected", () => {
  assert.throws(() => resolveBuildIdentity({ BUILD_ID: "bad value" }), /BUILD_ID/);
  assert.throws(() => resolveBuildIdentity({ RAILWAY_GIT_COMMIT_SHA: "x/y" }), /RAILWAY_GIT_COMMIT_SHA/);
});
