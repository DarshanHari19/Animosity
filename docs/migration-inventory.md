# Migration inventory (Phase 0)

Scope: report only, nothing changed. Repo `Animosity` at branch `migration/phase-0-1`, branched from `main` at `b32abb3` (merge of PR #1; tree identical to `c83917d`, "Add migration plan, agent rules, and vault seed"). No `v1-replit` tag exists yet (`git tag` printed nothing). Inventory date: 2026-11-05.

Method: `git grep` over all tracked files (excluding `pnpm-lock.yaml` and `attached_assets` where noted), plus a full read of every config, entry point, and Replit file. All citations are `path:line`.

Not verified, because the inventory was read-only and `node_modules` was not installed in the worktree:
- Tests and typechecks were not run.
- The source of the `@replit/vite-plugin-*` packages was not read, so their behavior outside Replit is unconfirmed (section 3).
- The shell had Node v20.19.5 and no `pnpm` on PATH.

---

## 1. Environment variables

Searched: `process.env`, `import.meta.env`, `Deno.env`, `Bun.env`, `process.argv` across `artifacts/`, `lib/`, `scripts/`, root configs, `.replit`, the artifact tomls, and `.github/workflows`.
- `Deno.env`, `Bun.env`: none found.
- `dotenv`, `--env-file`, `loadEnvFile`: none found. Nothing in the repo loads a `.env` file (see section 12).
- There is no `[env]` table in `.replit`. The only env sets are in the artifact tomls, `.replit` postBuild, and CI.

### 1a. Server-side and tooling variables

| Variable | Read at | What it does | Required? | Default | Replit-specific? |
|---|---|---|---|---|---|
| `PORT` | `artifacts/api-server/src/index.ts:4-16` | API listen port. Throws at startup if missing, NaN, or <= 0. | Required | none | Replit convention. Set by artifact.toml (`artifacts/api-server/.replit-artifact/artifact.toml:28`, prod `"8080"`). The dev value is not in the repo, so the Replit workflow runner presumably supplies it. |
| `NODE_ENV` | `artifacts/api-server/src/lib/logger.ts:3` | `production` means plain JSON pino. Anything else enables the `pino-pretty` transport (logger.ts:12-19). | Optional | unset (pretty logging) | No |
| `NODE_ENV` | `artifacts/api-server/server/routes.ts:66` | `=== "development"` is one half of the dev-only eval cache-bypass gate (section 6). | Optional | unset (bypass off) | No |
| `NODE_ENV` | `artifacts/fight-club/vite.config.ts:38`, `artifacts/mockup-sandbox/vite.config.ts:37` | Together with `REPL_ID`, gates the Replit dev plugins. | Optional | none | No |
| `LOG_LEVEL` | `artifacts/api-server/src/lib/logger.ts:6` | pino level. | Optional | `"info"` | No |
| `DATABASE_URL` | `lib/db/src/index.ts:7-13` | Creates `pg.Pool({ connectionString })`. Throws at import time if unset. | Required for the API process | none | Provisioned by Replit's built-in Postgres (`README.md:86,395`, `replit.md:16`). The name is generic. |
| `DATABASE_URL` | `lib/db/drizzle.config.ts:4-12` | drizzle-kit push credentials. Throws if unset. | Required for `push` | none | as above |
| `DATABASE_URL` | `artifacts/api-server/server/postgres-narration-cache.test.ts:10` | If unset, the persistence test is skipped (skip text: "Requires the development Replit database"). | Optional for tests | n/a | as above |
| `NARRATION_DAILY_CAP` | `artifacts/api-server/server/limits.ts:51` (parse at `:35-42`) | Max provider calls per UTC day, counting retries. Read lazily on every reservation. Non-integer gives `FightError NARRATION_CAP_CONFIGURATION` (503), which surfaces as `narration_status: "unavailable"`. | Optional | `"200"` (`limits.ts:36`) | No |
| `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` | `artifacts/api-server/server/narrator.ts:59,61,66` | Anthropic endpoint. Required whenever no injected `options.fetch` exists. Used as the SDK `baseURL`. | Required for narration | none (no official-API fallback) | **Replit-specific** (AI Integrations) |
| `AI_INTEGRATIONS_ANTHROPIC_API_KEY` | `artifacts/api-server/server/narrator.ts:60-61` | Anthropic key. | Required for narration | none | **Replit-specific** |
| `AI_INTEGRATIONS_OPENROUTER_BASE_URL` | `artifacts/api-server/server/jev-provider.ts:24,26` | Jev (TypeSafe SDK) base URL. | Optional (see section 9) | none | **Replit-specific** |
| `AI_INTEGRATIONS_OPENROUTER_API_KEY` | `artifacts/api-server/server/jev-provider.ts:25-26` | Jev key. | Optional | none | **Replit-specific** |
| `REPLIT_DEV_DOMAIN` | `artifacts/api-server/server/eval.ts:34` | Default eval target: `https://${REPLIT_DEV_DOMAIN}` when `--base-url` is absent. If neither is set, eval throws "Set --base-url..." (`eval.ts:35`). | Optional | none | **Replit-specific** |
| `PORT` | `artifacts/fight-club/vite.config.ts:9-21`, `artifacts/mockup-sandbox/vite.config.ts:8-20` | Vite dev/preview port. The config throws at load if missing or invalid. This applies to `vite build` too, because the check runs at config load. | Required | none | Replit convention. Values in the artifact tomls: 21528 (fight-club), 8081 (mockup). |
| `BASE_PATH` | `artifacts/fight-club/vite.config.ts:23-32`, `artifacts/mockup-sandbox/vite.config.ts:22-30` | Vite `base`. Throws if missing. | Required | none | Replit convention. Values: `/` (fight-club), `/__mockup` (mockup). |
| `REPL_ID` | `artifacts/fight-club/vite.config.ts:39`, `artifacts/mockup-sandbox/vite.config.ts:38` | If defined (and not production), dynamically imports `@replit/vite-plugin-cartographer` (and dev-banner in fight-club). | Optional | undefined | **Replit-specific** |
| `CI` | `.replit:9` (`[deployment.postBuild] env = { "CI" = "true" }`) | Set for `pnpm store prune` after the Replit build. Not read by app code. | n/a | n/a | **Replit-specific** (deploy hook) |
| `npm_config_user_agent` | `package.json:7` (`preinstall`) | Blocks non-pnpm installs. Not Replit. | n/a | n/a | No |

### 1b. Vite built-ins read by frontend code (derived from `BASE_PATH`)

| Variable | Read at | Notes |
|---|---|---|
| `import.meta.env.BASE_URL` | `artifacts/fight-club/src/App.tsx:41` (router base), `src/components/arena/verdict-stage.tsx:42` (share URL), `artifacts/mockup-sandbox/src/App.tsx:91` | Comes from Vite `base`, which comes from `BASE_PATH`. |
| `import.meta.env.DEV` | `artifacts/fight-club/src/components/error-boundary.tsx:50` | Vite built-in. |
| `%BASE_URL%` | `artifacts/fight-club/index.html:12,19,20` | HTML placeholder for og:image, twitter:image, favicon. |

### 1c. Build-time constant (not an env var)

`__ANIMOSITY_BUILD_ID__` is injected by esbuild `define` in `artifacts/api-server/build.mjs:15,23`. The value is `new Date().toISOString()` at build time. No environment variable or git SHA feeds it (see section 4).

### 1d. CI workflow env (`.github/workflows/test.yml`)

- `NODE_ENV: test` (`:30`)
- `DATABASE_URL: postgresql://animosity_ci:ci-only-not-a-secret@localhost:5432/animosity_test` (`:32`), pointing at the job's `postgres:16` service container (`:14-28`; `POSTGRES_USER=animosity_ci`, `POSTGRES_DB=animosity_test`, `5432:5432`).
- No `AI_INTEGRATIONS_*` or other secrets. All model calls are mocked in tests.
- Triggers: `push` and `pull_request` (`:3-5`). Permissions: `contents: read` (`:7-8`).

### 1e. Variables NOT read anywhere (checked, none found)

`ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `NARRATION_MODEL`, `OPENROUTER_API_KEY`, `PUBLIC_BASE_URL`, `EVAL_TOKEN`, `EVAL_BASE_URL`, `JEV_MODE`, any git-commit or build-ID variable, any `PG*`/`PGSSLMODE` variable. `README.md:80-82` states there is no `JEV_MODE` switch. `README.md:238` states legacy `LLM_API_KEY`/`LLM_API_URL`/`LLM_MODEL` are no longer read, and no reads of them were found.

---

## 2. Replit files

### `.replit` (43 lines)
- `modules = ["nodejs-24", "python-base-3.13"]` (`:1`). No Python files are tracked (`git ls-files '*.py'` returned nothing).
- No `postgresql` module and no `[env]` table. No `[[ports]]` table. No top-level `run` or `build`.
- `[deployment] router = "application"`, `deploymentTarget = "autoscale"` (`:3-5`). Autoscale means multiple instances can run, which matters for section 7.
- `[deployment.postBuild]` runs `pnpm store prune` with `CI=true` (`:7-9`).
- `[workflows] runButton = "Project"` (`:11-12`). Workflow "Project" runs "fight-club-regressions" in parallel mode (`:14-21`). That workflow runs `pnpm --filter @workspace/fight-club test` and is flagged `isValidation = true` (`:23-32`).
- `[agent] stack = "PNPM_WORKSPACE"`, `expertMode = true` (`:34-36`).
- `[postMerge] path = "scripts/post-merge.sh"`, `timeoutMs = 20000` (`:38-40`).
- `[nix] channel = "stable-25_05"` (`:42-43`). There is no `replit.nix` file.
- The API and web services are not defined here. They are defined in the artifact tomls below.

### Artifact tomls (Replit service and deploy definitions)
- `artifacts/api-server/.replit-artifact/artifact.toml`
  - `kind = "api"`, `localPort = 8080`, `paths = ["/api"]` (`:1,7-10`).
  - Dev: `pnpm --filter @workspace/api-server run dev` (`:13`).
  - Prod build: `pnpm --filter @workspace/api-server run build` with `NODE_ENV=production` (`:17-21`).
  - Prod run: `node --enable-source-maps artifacts/api-server/dist/index.mjs` with `PORT=8080`, `NODE_ENV=production` (`:23-29`).
  - Startup health check: `/api/healthz` (`:31-32`).
- `artifacts/fight-club/.replit-artifact/artifact.toml`
  - `kind = "web"`, `router = "path"`, `localPort = 21528`, `paths = ["/"]` (`:1-12`).
  - Dev: `pnpm --filter @workspace/fight-club run dev` (`:14-15`).
  - Prod: build with the package build script, `serve = "static"`, `publicDir = "artifacts/fight-club/dist/public"`, rewrite `/* -> /index.html` (`:17-24`).
  - Env: `PORT=21528`, `BASE_PATH=/` (`:26-28`).
- `artifacts/mockup-sandbox/.replit-artifact/artifact.toml`: `kind = "design"`, port 8081, `BASE_PATH=/__mockup`, dev only (`:1-17`). The sandbox is not part of the app (`CLAUDE.md`).

### `.replitignore` (6 lines)
`.local` and `/generated-artifacts/` excluded from deploy images. This is a deploy-image filter only.

### `replit.md` (79 lines)
Agent scope rules, run commands, and a narration description.
- Names Replit workflows `artifacts/api-server: API Server` and `artifacts/fight-club: web` (`:47-48`).
- Authorizes Replit PostgreSQL only for narration caching (`:16`).
- Says "Narration uses Replit-managed Anthropic AI Integrations and a Claude Haiku-class model; no personal LLM_API_KEY" (`:62-63`).
- Stale: says eval is "20 scenarios x 3" (`:51`), but there are 25 scenarios (`evaluation.ts:5` and the README).
- Requires comparing `/api/health` build_id with `artifacts/api-server/dist/build-id.json` before live tests (`:36-37`).
- States "The database template is unused" (`:79`).

### `.agents/`
- `.agents/agent_assets_metadata.toml`: one output record pointing at `docs/narration-test-changes.md`, with a `gcs://replit-rams-assets-reed/...` storage URI (`:14`).
- `.agents/memory/` has 5 agent-memory notes plus `MEMORY.md`:
  - `ai-shadow-isolation.md`
  - `dom-test-dependencies.md`
  - `git-inspection-protection.md`
  - `narration-evaluation-logs.md`
  - `narration-language-checks.md`
- These are documentation only. No code reads them.

### `scripts/post-merge.sh` (4 lines)
`pnpm install --frozen-lockfile` and `pnpm --filter db push` (`:3-4`). The package is named `@workspace/db` (`lib/db/package.json:2`). Verified in review: `pnpm --filter db exec pwd` resolves to `lib/db`, so pnpm's `--filter db` does match the scoped name `@workspace/db` and the hook works. It is Replit-only (`.replit:38-40`) and not used by CI.

### Replit mentions in code and doc text (non-functional)
- `artifacts/api-server/server/narrator.ts:62-63` (error message says "Enable Replit AI Integrations for Anthropic...") and `:76` ("managed Anthropic integration URL").
- `artifacts/api-server/server/postgres-narration-cache.test.ts:10` (skip text).
- `artifacts/fight-club/src/components/ui/badge.tsx:6-22` and `button.tsx:13-30` carry `// @replit` comments only. Harmless.
- `README.md:86,100-113,124,138-139,228-238,395,411-415,451`.
- `METHODOLOGY.md:125` references `REPLIT_BUILD_LOG.md`, which is not tracked.

---

## 3. Replit packages and Vite plugins

| Package | Declared at | Used at | Behavior |
|---|---|---|---|
| `@replit/vite-plugin-runtime-error-modal` ^0.0.6 (lock: 0.0.6) | `pnpm-workspace.yaml:12` (catalog); `artifacts/fight-club/package.json:44`; `artifacts/mockup-sandbox/package.json:42` | **Static import and unconditional call**: `artifacts/fight-club/vite.config.ts:6,37`, `artifacts/mockup-sandbox/vite.config.ts:5,7` (inside the plugins array) | Not gated by `REPL_ID`. Runs on every local dev and build. Its behavior outside Replit could not be inspected (no `node_modules`). Its only lockfile dependency is `@jridgewell/trace-mapping` (`pnpm-lock.yaml:4734-4736`). The package must be installed for the config to load. |
| `@replit/vite-plugin-cartographer` ^0.5.21 (lock: 0.5.21) | `pnpm-workspace.yaml:10`; fight-club `package.json:42`; mockup `package.json:41` | Dynamic `await import` only when `NODE_ENV !== 'production' && REPL_ID !== undefined`: `fight-club/vite.config.ts:38-45`, `mockup-sandbox/vite.config.ts:37-44` | Replit-only dev tooling. Inert locally (REPL_ID unset). |
| `@replit/vite-plugin-dev-banner` ^0.1.1 (lock: 0.1.2) | `pnpm-workspace.yaml:11`; fight-club `package.json:43` | Same gate, `fight-club/vite.config.ts:46-48` | Same. Not used in the mockup sandbox. |
| `@replit/connectors-sdk` ^0.4.3 (lock: 0.4.3) | Root `package.json:14` (a runtime `dependencies` entry in the root) | **No imports found** anywhere (`git grep connectors-sdk` hits only `package.json` and the lockfile) | Dead dependency. Safe to remove in cleanup (the plan's Phase 8 cleanup). |
| `stripe-replit-sync` | `pnpm-workspace.yaml:37` (only in `minimumReleaseAgeExclude`) | Not a dependency of any package | Orphan config line. |

Related:
- `pnpm-workspace.yaml:36` excludes `@replit/*` from `minimumReleaseAge`.
- `artifacts/fight-club/vitest.config.ts:5` comment: "Separate from the dev server config: no PORT, BASE_PATH, or Replit plugins." Tests do not load `vite.config.ts`.
- No other `replit` string in any workspace `package.json`.
- The `@assets` alias (`fight-club/vite.config.ts:55-60`) points to `attached_assets/`, which is gitignored (`.gitignore:21`). Imports of `@assets` would fail on a clean clone. A grep in `artifacts/fight-club/src` for `@assets` was not run, so this is untested.

---

## 4. How things start, build, and connect

### Root (`package.json`)
- `eval`: `pnpm --filter @workspace/api-server run eval` (`:6`)
- `preinstall`: refuses non-pnpm (`:7`)
- `build`: `pnpm run typecheck && pnpm -r --if-present run build` (`:8`)
- `typecheck:libs`: `tsc --build` (`:9`; `tsconfig.json:5-15` references `lib/db`, `lib/api-client-react`, `lib/api-zod`)
- `typecheck`: `pnpm run typecheck:libs && pnpm -r --filter "./artifacts/**" --filter "./scripts" --if-present run typecheck` (`:10`)
- **Missing at the root**: `dev`, `test`, `db:*`. The root has no `engines` and no `packageManager` field.
- `pnpm-workspace.yaml:1-5` workspaces: `artifacts/*`, `lib/*`, `lib/integrations/*` (directory does not exist), `scripts`.

### `@workspace/api-server` (`artifacts/api-server/package.json`)
- `eval`: `tsx server/eval.ts` (`:7`)
- `dev`: `export NODE_ENV=development && pnpm run build && pnpm run start` (`:8`). It rebuilds on every start and has no watch mode.
- `build`: `node ./build.mjs` (`:9`)
- `start`: `node --enable-source-maps ./dist/index.mjs` (`:10`)
- `typecheck`: `tsc -p tsconfig.json --noEmit` (`:11`; tsconfig includes `src` and `server`, references `lib/db` and `lib/api-zod`)
- `test`: `tsx --test server/*.test.ts` (`:12`)
- Build tool: esbuild 0.28.2 via `build.mjs`.
  - Bundles `src/index.ts` to `dist/index.mjs` (ESM, platform node) (`build.mjs:18-26`).
  - Uses `esbuild-plugin-pino` with `pino-pretty` transport (`:107-110`).
  - Large externals list (`:32-105`) and a CJS-interop banner (`:112-121`).
  - Writes `dist/build-id.json` (`:123`).
- Express app: `src/app.ts`. `trust proxy` = 1 (`:10`), `cors()` open to all origins (`:31`), router mounted at `/api` (`:33`), JSON/size error handler (`:35-44`). `json({limit:"16kb"})` is applied only on `POST /fight` (`server/routes.ts:37`).
- Routes: `GET /api/healthz` returns `{status:"ok"}` (`src/routes/health.ts:7-10`). `GET /api/health` returns `{status:"ok", build_id}` with `Cache-Control: no-store` (`:11-14`). `GET /api/animals` and `POST /api/fight` are in `server/routes.ts:30,37`. The default router wiring uses the Postgres cache (`src/routes/index.ts:9`).
- The API does **not** serve the frontend or any static files (no `express.static` found).
- Listens with `app.listen(port)` with no host argument, so it binds all interfaces (`src/index.ts:18`).

### `@workspace/fight-club` (`artifacts/fight-club/package.json`)
- `dev`: `vite --config vite.config.ts --host 0.0.0.0` (`:7`)
- `build`: `vite build --config vite.config.ts` (`:8`)
- `serve`: `vite preview ...` (`:9`)
- `test`: `vitest run --config vitest.config.ts` (`:10`)
- `typecheck`: `tsc -p tsconfig.json --noEmit` (`:11`)
- All dependencies are `devDependencies` (including React).
- Vite config (`vite.config.ts`): requires `PORT` and `BASE_PATH` (`:9-29`), `base: basePath` (`:32`), `server.port` with `strictPort: true`, `host: '0.0.0.0'`, `allowedHosts: true` (`:69-77`), `build.outDir = dist/public` (`:65-68`). **No `server.proxy`** (config read in full).
- Custom plugin `share-pages.ts`:
  - Emits one static HTML share page per (animal A, animal B, environment): 12 x 12 x 3 = 432 files `share/<a>-vs-<b>-<env>.html` (`share-pages.ts:34-39,55-59`; naming at `src/lib/site-metadata.ts:19-21`).
  - Serves the same pages in dev (`:45-54`).
  - Reads `../api-server/server/traits.json` at config load (`:32`).
  - Uses `config.base` for URLs (`:44,41`), so `og:image` is a **path** (for example `/og-image.png`), not an absolute URL (`share-pages.ts:21,25`; `index.html:12,19`).
  - There is no `og:url` or canonical tag anywhere (checked `index.html`, `share-pages.ts`, `use-page-metadata.ts`).

### How the frontend reaches the API
- Same origin, relative `/api/...` URLs. Generated client paths: `lib/api-client-react/src/generated/api.ts:63,140,228,306`. Orval `baseUrl: "/api"` (`lib/api-spec/orval.config.ts:29`), and OpenAPI `servers: - url: /api` (`lib/api-spec/openapi.yaml:7-9`).
- `setBaseUrl` exists (`lib/api-client-react/src/custom-fetch.ts:28`) but is never called in `artifacts/fight-club/src` (none found).
- On Replit, the path router sends `/api` to port 8080 and `/` to the Vite server or static host (artifact tomls). Locally there is no proxy. `README.md:105-113` says to run both servers and "Route `/api` ... with your local reverse proxy". Replit "provides that routing; no custom Vite proxy is needed there".
- Router base: `WouterRouter base={import.meta.env.BASE_URL...}` (`src/App.tsx:41`).

### Build ID: how it is set and used
- Set: `build.mjs:15` (`new Date().toISOString()`), baked into the bundle via `define` (`:23`), and written to `dist/build-id.json` (`:123`).
- Read: `src/build-id.ts:3-5` (`BUILD_ID`, falls back to `"unbuilt"` when running from source in tests).
- Exposed: `GET /api/health` (`src/routes/health.ts:13`).
- Cache key: `server/routes.ts:65,70` -> `narrationCacheKey(a, b, environment, mode, buildId)` (`server/narration-cache.ts:12-17`, sha256 of the JSON array). The `build_id` is also stored in the `build_id` column (`server/postgres-narration-cache.ts:14`).
- Eval: compares `dist/build-id.json` on disk to `/api/health` before every fight (`server/eval.ts:38-46,73`).
- Implications: every `pnpm dev` restart rebuilds with a new ID, so the dev cache misses after each restart. In production, each Replit build produces a new ID, which is how the cache invalidates per deploy. There is no env or git-SHA input today, and Phase 5 needs a `build.mjs` change.

---

## 5. Database

- Location: `lib/db` (`@workspace/db`). `lib/db/src/schema/index.ts:20` exports only `./narration-cache`. Driver: `drizzle-orm/node-postgres` with `pg` (`lib/db/src/index.ts:1-2,13-14`).
- Client: `new Pool({ connectionString: process.env.DATABASE_URL })` with no `ssl`, no pool size, and no timeouts configured (`lib/db/src/index.ts:13`). SSL is driven only by the connection string. No `pool.on('error')` handler found (searched `lib/` and `artifacts/api-server`); under standard `pg` behavior, an unhandled idle-client error on a Pool is an uncaught exception. That is a hosted-Postgres hazard to review in Phase 4.
- Drizzle config: `lib/db/drizzle.config.ts` (schema path `src/schema/index.ts`, dialect `postgresql`, `dbCredentials.url = DATABASE_URL`, `:8-14`).
- Schema creation: **`drizzle-kit push`** (`lib/db/package.json:11` `push`, `:12` `push-force`). No migrations folder, no SQL files, and no DDL at startup (`server/postgres-narration-cache.ts:5` comment: "Schema is applied in development by Drizzle, and in production by Publish. No startup DDL."). `README.md:411-415` says Publishing applies the dev schema to production. CI runs `pnpm --filter @workspace/db run push` before tests (`.github/workflows/test.yml:46-47`). There is no `db:migrate` script today.
- Tables (only one):

| Table | Column | Type | Constraints |
|---|---|---|---|
| `narration_cache` (`lib/db/src/schema/narration-cache.ts:5-10`) | `key` | text | PRIMARY KEY (sha256 hex of `[animalA, animalB, environment, mode, buildId]`) |
| | `build_id` | text | NOT NULL |
| | `beats` | jsonb | NOT NULL |
| | `created_at` | timestamptz | NOT NULL, default `now()` |

  No other indexes or foreign keys. Also exported: `insertNarrationCacheSchema` (drizzle-zod, omits `createdAt`) and types (`:11-13`).
- Cache semantics (`server/postgres-narration-cache.ts:6-15`): `get` selects `beats` by key. `put` does `INSERT ... ON CONFLICT DO NOTHING`, so the first validated narration wins.
- Failure handling in the route (`server/routes.ts:74-77,128-131`): a cache read error logs `console.warn` and the route generates narration normally. A write error logs a warning and still returns the narration. Only validated, available, model-sourced narrations are cached (`routes.ts:128`).
- **If `DATABASE_URL` is missing, the API process fails to boot.** `lib/db/src/index.ts:7-11` throws at module load. It is statically imported by `server/postgres-narration-cache.ts:1`, which is imported by `src/routes/index.ts:4`, `src/app.ts:4`, and `src/index.ts:1`. In the esbuild bundle that evaluation precedes the `PORT` check. There is no "disable cache" fallback. The graceful degradation above only covers runtime query failures once the pool exists.
- Tests: all route and cache tests inject an in-memory cache (`narration-cache.test.ts:18`). Only `postgres-narration-cache.test.ts` touches Postgres, via dynamic import, and it is skipped when `DATABASE_URL` is unset (`:9-11`). If `DATABASE_URL` is set, it needs the table to exist (run `push` first). It cleans up its own row (`:18-21`).

---

## 6. Eval script and the dev-only cache bypass

### Eval (`artifacts/api-server/server/eval.ts`)
- Invocation: root `pnpm eval` -> `tsx server/eval.ts` in the api-server package (`package.json:6`, `api-server/package.json:7`). CLI flags: `--scenarios`, `--runs` (1-3, default 3), `--base-url`, `--help` (`eval.ts:18-21,26-27`). Default load: 25 scenarios (`evaluation.ts:5-31`) x 3 runs = 75 fights.
- Server URL decision (`eval.ts:34-37`): `values["base-url"] ?? (process.env.REPLIT_DEV_DOMAIN ? "https://" + REPLIT_DEV_DOMAIN : "")`. If empty it throws "Set --base-url to your running development server's origin." The URL is validated to be http(s) without credentials. **There is no `EVAL_BASE_URL` and no localhost default.**
- Behavior that assumes the eval runs on the same machine and filesystem as the API:
  - It reads `artifacts/api-server/dist/build-id.json` from local disk (`eval.ts:14,38,40`) and compares it to `/api/health` before every fight (`:41-44`). A remote server built separately will mismatch and abort.
  - It reads `generated-artifacts/narration-diagnostics/attempts.jsonl` (`server/narration-diagnostic-store.ts:9-11`, `readDiagnostics` at `:36+`, called from `eval.ts:106`), which the API process appends to locally (`:24-28`). Against a remote host, failed-check diagnostics would be incomplete or fail. `eval.ts:112-114` marks the summary incomplete and rethrows.
  - It writes results to `<repo root>/generated-artifacts/narration-eval/<timestamp>.json` (`eval.ts:15,53-55`). The directory is gitignored (`.gitignore:4`) and excluded from Replit deploys (`.replitignore:6`).
- Pacing: at least 6.5 s between fights (`:72`). Fetch timeout 80 s (`:78`). Up to 2 deferrals on 429 honoring `Retry-After` (`:80-87`). Stops on any other non-200 (`:88`).
- Requires the eval telemetry fields: `jev_shadow` in the body (`:91-95`) and the `X-Narration-Attempts` header (`:98-101`). These exist only when the bypass header is honored (below).

### Dev-only cache bypass gate
- Header name: `X-Animosity-Eval-Bypass-Cache` (`server/narration-cache.ts:4`, `EVAL_BYPASS_HEADER`). The eval sends it with value `"1"` (`eval.ts:77`).
- The check (`server/routes.ts:66-67`):
  ```ts
  const bypass = (options.development ?? process.env.NODE_ENV === "development")
    && req.get(EVAL_BYPASS_HEADER) === "1";
  ```
  `options.development` is a test-injection override (`routes.ts:14`).
- Effects of `bypass`: the cache is skipped for both read and write (`routes.ts:69,128`), the Jev shadow result callback is attached (`:85-89`), and the response gains a `jev_shadow` field (`:135`). `X-Narration-Attempts` is set on **every** response, not only bypass ones (`:133`).
- The gate is purely `NODE_ENV === "development"`. There is no token. The `dev` script sets it (`api-server/package.json:8`), while prod sets `production` (`artifact.toml:21,29`).
- Tests: dev bypass `narration-cache.test.ts:107-135` (`development: true`), prod ignore `:137-148` (`development: false`).
- Plan note: Phase 5 replaces this gate with an `EVAL_TOKEN` check. The telemetry fields (`jev_shadow`) currently depend on the same gate.

---

## 7. Single-long-running-process assumptions

Searched `setInterval`, `setTimeout`, `new Map(`, `let` state, and `fs` writes in `artifacts/api-server/src` and `server/` (non-test).

1. **Rate limiter**: in-memory `Map<ip, {count, expires}>` (`server/limits.ts:7-33`). Fixed 1-minute window, 10 requests per IP (`:22`), keyed by `req.ip` (`:16`). It is only mounted on `POST /fight` (`routes.ts:37`). It is created in the default parameter of `createFightRouter` (`routes.ts:26`), so it is per process. Expired entries are swept only on incoming requests (`:11-15`); there is no timer. The state is lost on restart and not shared across instances (autoscale, `.replit:5`).
2. **Daily narration cap**: module-level singleton `reserveNarrationCall = createNarrationDailyCap()` (`limits.ts:63`) with closure state `day`/`calls` (`:48-49`). UTC day boundary (`:52`). Default 200 (`:36`). Counts every provider attempt, including the corrective retry (`narrator.ts:151-155`). It is reset on restart and per instance, so N instances means N x cap. Cache hits do not consume it (`narration-cache.test.ts:30-48`).
3. **`trust proxy` = 1** (`src/app.ts:8-10`, "Revisit this hop count if the deployment's proxy topology changes"). Rate limiting by IP is only correct if the new host adds exactly one proxy hop (not verified for any candidate host).
4. **Local file journal**: `appendFileSync` of narration failure diagnostics to `<repo root>/generated-artifacts/narration-diagnostics/attempts.jsonl` on every failed attempt, including in production (`narration-diagnostic-store.ts:24-28`, called from `narration-diagnostics.ts:56-69`). Write errors are caught and logged. On ephemeral or multi-instance hosts the journal is lost and unreadable by eval. It is unbounded and synchronous.
5. **In-memory response caches**: none in production. The only in-memory cache is a test helper (`narration-cache.test.ts:18`). The persistent cache is Postgres only.
6. **Timers**: none found in the server runtime. Narration and Jev use per-request timeouts (30 s `AbortSignal`/SDK timeout, 10 s for Jev). The browser has playback timers (`home.tsx`), which are client-side only.
7. **Jev shadow call is awaited inside the request**, for every fresh validated narration, whenever the narrator is not using an injected fetch (`narrator.ts:203-219`). It adds up to 10 s to the request and runs in production even when `onShadowResult` is unused. Cache hits skip it.
8. **Eval needs filesystem co-location** with the API (section 6).

---

## 8. Runtime and tooling versions

| Item | Value | Source |
|---|---|---|
| Node (Replit) | `nodejs-24` | `.replit:1` |
| Node (CI) | `"24"` (major only) | `.github/workflows/test.yml:42` |
| Node in package.json | no `engines` field in any package.json (`git grep '"engines"'` found none outside the lockfile) | n/a |
| `.nvmrc` | none | not present |
| Node patch noted by agent | Replit ran Node 24.13; jsdom 30 would need >= 24.15, so jsdom is pinned to 29.1.1 | `.agents/memory/dom-test-dependencies.md:8`, `artifacts/fight-club/package.json:63` |
| Engine floors in lockfile | vitest 5.0.5 needs `^22.12.0 \|\| ^24.0.0 \|\| >=26.0.0` (`pnpm-lock.yaml:3552`); vite 7.3.6 needs `^20.19.0 \|\| >=22.12.0` (`:3512`); jsdom 29.1.1 needs `^20.19.0 \|\| ^22.13.0 \|\| >=24.0.0` (`:2693`) | lockfile |
| pnpm (CI) | `10.26.1` | `.github/workflows/test.yml:37-39` |
| `packageManager` field | **absent** in root `package.json` | `package.json:1-20` |
| Lockfile | `lockfileVersion: '9.0'` | `pnpm-lock.yaml:1` |
| pnpm features in use | `minimumReleaseAge: 1440` (needs a recent pnpm 10.x), `onlyBuiltDependencies`, `overrides`, `catalog` | `pnpm-workspace.yaml:33,39-43,9-31,45+` |
| TypeScript | `~5.9.3` | `package.json:18` |
| `@types/node` | `^25.3.3` via catalog (a newer major than the Node 24 runtime) | `pnpm-workspace.yaml:15` |
| `.npmrc` | `auto-install-peers=false`, `strict-peer-dependencies=false` | `.npmrc:1-2` |

A Node v20.19.5 shell is below the vitest 5 floor, so frontend tests cannot run on it.

---

## 9. LLM configuration

### Narration (`artifacts/api-server/server/narrator.ts`, `anthropic-provider.ts`)
- Model id: **`claude-haiku-5-5`** (`narrator.ts:67`, overridable only via the test-only `options.model`; no env override; also `README.md:232`).
- SDK: `@anthropic-ai/sdk ^0.135.0` (`api-server/package.json:15`). Constructed with `apiKey`, `baseURL`, `timeout: 30_000`, `maxRetries: 0`, `fetchOptions: { redirect: "error" }` (`anthropic-provider.ts:26-33`).
- Request (`anthropic-provider.ts:37-46`): `max_tokens: 8192`, `thinking: { type: "disabled" }`, `tools: [narrationTool]`, `tool_choice: { type: "tool", name: "submit_narration", disable_parallel_tool_use: true }` (tool name at `narration-tool.ts:7`), a single joined system string, and user-role messages only.
- **No `temperature`, `top_p`, or `top_k`** is set (`git grep` found none in non-test code). Provider defaults apply.
- Only one forced tool call is accepted; free text is rejected (`anthropic-provider.ts:72-85`, doc comment `:20`).
- Retry policy: at most 2 attempts (`narrator.ts:151`). The second is a corrective retry after validation failures only (`:233-239`). Each attempt reserves a daily-cap slot first (`:154`). Provider/transport failures are not retried (`:229-232`).
- Base URL check: `https:` required for explicit endpoints; `http:` is allowed for the managed (env) URL (`narrator.ts:68-77`).
- **Config gap for Phase 2**: both `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` and the key are required (`narrator.ts:61`). There is no default to the official Anthropic API, so setting only a key will not work.

### Jev (`jev-provider.ts`, `jev-shadow.ts`)
- Model: `"jev-latest"` (`jev-provider.ts:8`, `jev-shadow.ts:51`).
- SDK: `@typesafe-ai/sdk ^0.7.0` (`api-server/package.json:17`), `new TypeSafeClient({ baseURL, apiKey, timeout: 10_000, retry: { maxRetries: 0 }, logLevel: "off", compression: false, fetch })` (`jev-provider.ts:28-37`), then `client.systemOne(request)` (`:38`).
- `compression: false` is at `jev-provider.ts:30`. No comment in code explains why; the plan (`MIGRATION_PLAN.md:64`) says zstd requests over 1 KB were rejected with HTTP 415.
- One call per fresh narration, with questions `unsupported_N` and `contradiction_N` of type `"noul"` for every beat (`jev-shadow.ts:38-48`). It is observation only and does not affect acceptance (`:26`, README lines 80-82).
- Missing Jev config: `requestJev` throws `JevRequestError("configuration_error")` (`jev-provider.ts:26`), the shadow review returns a `failed` report, and logs `jev_shadow_unavailable` (`jev-shadow.ts:76-85`). It never blocks narration (`narrator.ts:215-218`).

### Missing narration config behavior
- `narrateMatchup` throws `FightError("LLM_NOT_CONFIGURED", ..., 503)` when no key, or no base URL without an injected fetch (`narrator.ts:59-64`). This occurs **before** any cap reservation (`:154`).
- `routes.ts:96-104` catches it: `beats = []`, `narration_status = "unavailable"`, `narration_reason` = the code (allow-listed in `narrationErrors`, `routes.ts:16-19`), `narration_source = "model"`. The HTTP status stays 200 with the engine verdict intact, and nothing is cached.
- Related codes: `LLM_CONFIGURATION` (bad URL, `narrator.ts:76`), `LLM_PROVIDER_FAILURE`, `INVALID_NARRATION`, `NARRATION_DAILY_CAP_REACHED`, `NARRATION_CAP_CONFIGURATION`; anything else becomes `NARRATION_FAILED` (`routes.ts:101-103`).
- UI shows a "Narration unavailable" tag (`artifacts/fight-club/src/components/arena/bout-stage.tsx:46,86-87`).
- Tests for these paths inject keys and endpoints and do not set env (`narrator.test.ts:386-389`, `narration-cache.test.ts:54-64`, `routes.test.ts:118-119`). No test sets `AI_INTEGRATIONS_*`.
- Response status values: `available`, `unavailable`, `not_required`. Source values: `cache`, `model` (`schemas.ts:101-112`).

---

## 10. Tests and typechecks per package

| Package | test | typecheck | Runner |
|---|---|---|---|
| root | none | `pnpm typecheck` (libs `tsc --build`, then artifacts + scripts) | n/a |
| `@workspace/api-server` | `tsx --test server/*.test.ts` (`package.json:12`) | `tsc -p tsconfig.json --noEmit` (`:11`) | Node built-in `node:test` through tsx (e.g. `health.test.ts:1-2`). `expect` is a devDependency. |
| `@workspace/fight-club` | `vitest run --config vitest.config.ts` (`package.json:10`) | `tsc -p tsconfig.json --noEmit` (`:11`) | vitest 5.0.5, jsdom 29.1.1, testing-library; includes `src/**/*.test.tsx` only, setup `src/test/setup.ts` (`vitest.config.ts:12-18`) |
| `@workspace/mockup-sandbox` | none | `tsc -p tsconfig.json --noEmit` | none |
| `@workspace/scripts` | none | `tsc -p tsconfig.json --noEmit` (`scripts/package.json:8`) | none |
| `@workspace/db`, `api-zod`, `api-client-react` | none | covered by `tsc --build` (root `typecheck:libs`) | n/a |
| `@workspace/api-spec` | none | none | `codegen`: `orval --config ./orval.config.ts && pnpm -w run typecheck:libs` (`lib/api-spec/package.json:6`) |

- Backend tests make no model calls and need no env, except the optional Postgres test (section 5).
- Frontend tests need no `PORT` or `BASE_PATH` (README.md lines 128-129; `vitest.config.ts:5`).
- CI runs: install (`--frozen-lockfile`), `db push`, api-server tests, fight-club tests, `pnpm typecheck` (`test.yml:44-53`).

---

## 11. Hard-coded replit.app and host URLs

- In application code and READMEs: **none found**. Searched `replit.app`, `replit.dev`, `repl.co`, and `animosityarena` across all tracked files outside the lockfile.
- Only in docs: `docs/MIGRATION_PLAN.md:137` (the old link `https://animosityarena.replit.app/?a=Lion&b=Grizzly+bear&environment=land&mode=forced_fight`) and `docs/vault-seed/animosity.md:4` (`live: https://animosityarena.replit.app`).
- URL construction today:
  - Share link copied from the browser uses `window.location.origin` (`verdict-stage.tsx:42`; `site-metadata.ts:23-29`).
  - Share-page and OG HTML use path-only `base` (see section 4), so no absolute-origin variable exists yet. `og:image` and `twitter:image` are relative (`index.html:12,19`; `share-pages.ts:21,25`).
  - `public/robots.txt` has no sitemap URL (`robots.txt:1-2`).
  - Dynamic title and description updates are in `src/hooks/use-page-metadata.ts`.

---

## 12. Implications for Phase 1

### Exact versions and pins
- `.nvmrc` should contain **`24`**. That matches CI (`test.yml:42`) and `.replit` `nodejs-24`, and it satisfies the vitest 5 floor. The only patch recorded anywhere is Replit's 24.13 (`.agents/memory/dom-test-dependencies.md:8`); jsdom 29 is the version that fits it. Node 20 is too old, so the dev machine needs Node 24.
- Add `"packageManager": "pnpm@10.26.1"` to the root `package.json` (CI pin at `test.yml:39`). It is currently absent. Keep the CI `pnpm/action-setup` version identical to this, since the action can reject a mismatch.

### Blockers to running locally without Replit
1. **Native-binary overrides likely break `pnpm install` / build on this Mac (arm64).** `pnpm-workspace.yaml:45-127` removes (`'-'`) the darwin optional binaries for esbuild (`:72-73`), rollup (`:107-108`), tailwind oxide (`:58-59`), and lightningcss (`:94-95`). The lockfile contains only the linux-x64 variants (for example `@esbuild/linux-x64@0.28.2` at `pnpm-lock.yaml:851`; no darwin entries other than `fsevents`, `:2521-2524`). This machine is Darwin arm64. This is unverified because no install was run, but esbuild, Vite (rollup), and Tailwind would very likely fail to find native binaries. Fix: drop the darwin (and other needed platform) override lines and regenerate the lockfile, so Phase 1 cannot rely on `--frozen-lockfile` for that change. The overrides were presumably added to slim Replit's Linux install.
2. **`vite.config.ts` throws without `PORT` and `BASE_PATH`** (`fight-club/vite.config.ts:9-29`), for dev, build, and preview. `pnpm dev` must set `PORT` (for example 5173) and `BASE_PATH=/`. The vitest config is independent (`vitest.config.ts:5`).
3. **No `/api` proxy exists.** The frontend calls relative `/api/...` and `vite.config.ts` has no `server.proxy`. For `pnpm dev` to "serve the picker" with fights working, add a Vite proxy of `/api` to the API port, or use another same-origin mechanism (the README's two-terminal procedure assumes a reverse proxy).
4. **`@replit/vite-plugin-runtime-error-modal` is imported and applied unconditionally** (`vite.config.ts:6,37`). Whether it throws outside Replit is unverified; it is the first thing to test in Phase 1. Cartographer and dev-banner are gated on `REPL_ID` and inert locally. The packages must stay installed until the imports are removed in Phase 2 step 4 or cleanup.
5. **`DATABASE_URL` is mandatory to boot the API** (`lib/db/src/index.ts:7-11`), so the local Postgres container is required even for a no-model run. `drizzle.config.ts:4-6` also throws without it.
6. **No `.env` loading exists anywhere**, and `.gitignore:16-17` ignores `.env` and `.env.*`, which also matches `.env.example`. Phase 1 needs (a) a negation such as `!.env.example`, and (b) a loader, for example `node --env-file` / `tsx --env-file` or `dotenv`. Note `api-server`'s `dev` script runs `node ./dist/index.mjs`, and `vite` loads only `VITE_*` from `.env` into the client (not `PORT`/`BASE_PATH` into config reads of `process.env`, unless set in the shell).
7. **`pnpm eval` has no localhost default** (`eval.ts:34-35`) and no `EVAL_BASE_URL`. It also requires a prior `build` so `dist/build-id.json` exists (`eval.ts:14,38`); `pnpm dev` produces it as a side effect.
8. **Narration will be `unavailable` with `LLM_NOT_CONFIGURED`** until Phase 2 (`narrator.ts:59-64`). This matches the Phase 1 "done" criterion: verdicts return with "Narration unavailable". The Jev call fails fast and does not block.
9. `post-merge.sh` and the `Project` workflow are Replit-only and irrelevant locally.

### What `.env.example` must list (values blank)
Required by current code, local: `PORT` (API), `DATABASE_URL`, plus the frontend dev server's `PORT` and `BASE_PATH` (these collide by name if one loader feeds both processes, so the root `dev` script must set them per process, not from a single shared `.env`).

Optional by current code: `NODE_ENV`, `LOG_LEVEL`, `NARRATION_DAILY_CAP` (default 200).

Replit-named, to be replaced in Phase 2 and left blank or commented until then: `AI_INTEGRATIONS_ANTHROPIC_BASE_URL`, `AI_INTEGRATIONS_ANTHROPIC_API_KEY`, `AI_INTEGRATIONS_OPENROUTER_BASE_URL`, `AI_INTEGRATIONS_OPENROUTER_API_KEY`.

Eval: `EVAL_BASE_URL` (new, Phase 1). Replit-only and not to be listed: `REPL_ID`, `REPLIT_DEV_DOMAIN`.

Phase 2 to 5 names from the plan (not read by code yet): `ANTHROPIC_API_KEY`, `ANTHROPIC_BASE_URL`, `NARRATION_MODEL` (default `claude-haiku-5-5`), `OPENROUTER_API_KEY`, `EVAL_TOKEN`, `PUBLIC_BASE_URL`.

### Root scripts: exist vs need adding
- Exist: `eval` (no localhost default), `typecheck`, `typecheck:libs`, `build`.
- Need adding: `dev`, `test`.
  - `dev` must run both servers with the right env: the API script already builds and starts (`api-server/package.json:8`) and needs `PORT` and `DATABASE_URL`; the frontend needs `PORT`, `BASE_PATH` and the `/api` proxy. There is no process-runner dependency (no `concurrently` or `npm-run-all`) in the repo.
  - `test` should run `pnpm --filter @workspace/api-server test` and `pnpm --filter @workspace/fight-club test`.
- Add a DB script for convenience, for example root `db:push` -> `pnpm --filter @workspace/db run push` (`CLAUDE.md` already documents the long form).
- `pnpm eval` needs `EVAL_BASE_URL` support in `eval.ts:34` with default `http://localhost:<api PORT>`. This touches non-engine, non-validation code only.

### Local Postgres
- Match CI: `postgres:16` image, port 5432 (`test.yml:14-28`). A local URL of the form `postgresql://user:pass@localhost:5432/dbname` works with `pg` + `drizzle-orm/node-postgres` as is. No SSL option is set anywhere (`lib/db/src/index.ts:13`), and a plain local Postgres needs none.
- Schema: `pnpm --filter @workspace/db run push` (`drizzle-kit push`). It must run after the container is up and before the optional persistence test. No migration files exist.
- For Phase 4 (hosted Postgres): SSL comes from the URL only (`sslmode=require`), pool settings are defaults, and there is no idle-error handler (section 5).

### Guarantees for later phases (from this inventory)
- Replit-only code paths to remove in Phase 2: `narrator.ts:59-64,76` (env names plus Replit wording), `jev-provider.ts:24-25`, `eval.ts:34`, the two Vite configs (`fight-club/vite.config.ts:6,37-50`, `mockup-sandbox/vite.config.ts:5,7,37-44`), the three `@replit/*` packages plus the dead `@replit/connectors-sdk`, and the Replit text in `postgres-narration-cache.test.ts:10`.
- Phase 5 will also need: Express (or the host) to serve the built frontend (`dist/public` and the 432 `share/*.html` files), a `build.mjs` build-ID input from the host commit variable, and eval changes so it can target a remote server (it currently depends on local `dist/build-id.json` and the local diagnostics journal).
