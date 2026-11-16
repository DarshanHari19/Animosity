// Build ID precedence: explicit BUILD_ID, then "<commit SHA>.<deployment ID prefix>" from the
// host (Railway sets RAILWAY_GIT_COMMIT_SHA for GitHub-triggered deploys and
// RAILWAY_DEPLOYMENT_ID for every build), then the build timestamp (e.g. a `railway up` deploy
// has no commit). It keys the narration cache, so each new deploy gets a new cache key even
// when it rebuilds the same commit. `commit` is reported separately by /api/health.
const SAFE_ID = /^[A-Za-z0-9._:+-]{1,100}$/;
export function resolveBuildIdentity(env) {
  const clean = (name) => {
    const value = env[name]?.trim();
    if (value && !SAFE_ID.test(value)) {
      throw new Error(`${name} must be 1-100 characters from A-Z a-z 0-9 . _ : + -`);
    }
    return value || undefined;
  };
  const commit = clean("RAILWAY_GIT_COMMIT_SHA");
  const deployment = clean("RAILWAY_DEPLOYMENT_ID")?.slice(0, 8);
  const override = clean("BUILD_ID");
  const buildId = override ?? (commit ? (deployment ? `${commit}.${deployment}` : commit) : new Date().toISOString());
  return { buildId, commit };
}
