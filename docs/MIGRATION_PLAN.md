# Animosity: Migration Off Replit

Goal: run Animosity as my own product. Local development in VS Code with Claude Code, my own model keys, hosted Postgres, my own host and domain, and the old replit.app link redirected. Narration quality must hold, proven by the eval.

## How to use this plan with Claude Code

- Work one phase at a time. Paste or point Claude Code at a single phase, review the result, then move on.
- Steps marked **YOU** need my accounts, payment, or a decision. Claude Code stops and asks at those.
- The Replit deployment stays live until Phase 7. It is the rollback.

## Rules for every phase (copy these into CLAUDE.md in Phase 1)

1. Do not change engine scoring, traits.json values, tiers, verdict text, or narration validation rules. This migration changes infrastructure only.
2. Run all backend and frontend tests and type checks after every change. Stop and report on any failure; do not edit tests to make them pass.
3. Never commit secrets. Keys live in `.env` (gitignored) locally and in the host's secret settings in production. Keep `.env.example` current with every variable, values blank.
4. Stop and ask before creating accounts, spending money, changing DNS, or deleting anything on Replit.
5. End each phase with a short report: what changed, test counts, anything done that wasn't asked for.

---

## Phase 0: Inventory and freeze

**Goal:** know every place the app depends on Replit before changing anything.

1. **YOU:** clone the repo: `git clone https://github.com/DarshanHari19/Animosity.git`, open it in VS Code, start Claude Code in the repo root.
2. Tag the current state: `git tag v1-replit && git push origin v1-replit`.
3. Claude Code, report only, change nothing. List every Replit-specific dependency:
   - Environment variables the code reads (AI Integrations base URLs and keys, `DATABASE_URL`, `PORT`, `REPL_ID`, `REPLIT_*`, build ID, anything else).
   - Replit files: `.replit`, `.replitignore`, `replit.md`, `.agents/`.
   - Replit packages or Vite plugins (for example `@replit/vite-plugin-*`).
   - How the API server and frontend are started and built, and how the build ID is set.
   - How the database schema is created (migration tool, raw SQL, or on startup) and what tables exist.
   - Where the eval script decides the server URL and how the dev-only cache bypass header is gated.
   - Anything that assumes a single long-running process (in-memory rate limit and daily cap).

**Done when:** a written inventory exists at `docs/migration-inventory.md`.

---

## Phase 1: Run it locally

**Goal:** the app and all tests run on my machine with no Replit services.

1. Add `.nvmrc` with the Node version the project uses, and confirm `pnpm` version in `package.json` (`packageManager` field).
2. Add `docker-compose.yml` with a local Postgres for development, and a `.env.example` listing every variable from the Phase 0 inventory.
3. Add npm scripts so these work from the repo root:
   - `pnpm dev` starts the API server and frontend together.
   - `pnpm test` runs all tests. `pnpm typecheck` runs all type checks.
   - `pnpm eval` runs the narration eval against a URL given by `EVAL_BASE_URL` (default `http://localhost:<api port>`).
4. (Done: CLAUDE.md and AGENTS.md added in the setup commit; update them as commands change.) Write `CLAUDE.md` with the rules above plus: how to run dev, tests, type checks, and eval; the project layout (`artifacts/api-server`, `artifacts/fight-club`, `lib/*`); and that METHODOLOGY.md and SOURCES.md are the source of truth for scoring and data.

**Done when:** `docker compose up -d`, `pnpm install`, `pnpm test`, `pnpm typecheck` all pass locally, and `pnpm dev` serves the picker. Fights return verdicts with "Narration unavailable" (no model key yet). That proves verdicts never depend on the model.

---

## Phase 2: Swap the model provider

**Goal:** narration and Jev run on my own keys, same model, same behavior.

1. **YOU:** create an Anthropic API key at console.anthropic.com and set a monthly spend limit there. Create an OpenRouter key for Jev and set its credit limit.
2. Claude Code: replace the Replit AI Integrations configuration with:
   - `ANTHROPIC_API_KEY` (required for narration), `ANTHROPIC_BASE_URL` (optional, defaults to the official API), `NARRATION_MODEL` (default: the exact model ID used on Replit, so only one variable changes).
   - `OPENROUTER_API_KEY` for Jev. Keep `compression: false` on the TypeSafe client (zstd requests over 1 KB were rejected with HTTP 415 before).
   - Keep the same model parameters as before (temperature, max tokens, forced tool use).
3. A missing key keeps today's behavior: verdict returned, `narration_status: "unavailable"`, `LLM_NOT_CONFIGURED`. Log one clear startup warning.
4. Remove Replit-only code paths and packages found in Phase 0. Update tests that referenced Replit configuration; every guarantee they checked must still be checked.

**Done when:** tests pass, and one live fight locally (Hippopotamus vs Lion, land, Arena) returns full narration with `narration_source: "model"`, and a second identical fight returns `"cache"`.

---

## Phase 3: Eval gate on the new provider

**Goal:** prove narration quality held after the switch.

1. **YOU:** run `pnpm eval` locally against the dev server (75 fights, about 10 minutes, a few cents).
2. Compare with the last Replit baseline: 0 of 75 unavailable, 90.7% first-attempt pass, Jev scoring 75 of 75.
3. Acceptance thresholds:
   - Narration unavailable: 2 of 75 or fewer (at most 3%).
   - First-attempt pass: at least 85%.
   - Jev: every narration scored, zero transport failures.
4. If it misses: Claude Code compares request parameters and model ID with the Replit version and reports differences before changing anything. Don't loosen any check.

**Done when:** a run meets the thresholds. Save the output to `docs/evals/` and add a row to the README reliability table ("Own Anthropic key, local").

---

## Phase 4: Hosted Postgres

**Goal:** production database off Replit.

1. **YOU:** create a Neon project (recommended: free tier, standard Postgres, branching for staging). Supabase also works.
2. Claude Code: make the app read `DATABASE_URL` with `sslmode=require`, use connection pooling settings suitable for the host, and run schema creation the same way the inventory found (add a `pnpm db:migrate` script if there isn't one).
3. No data migration needed: the narration cache is disposable and keyed by build ID, so it refills on first use.
4. Use a separate Neon branch for staging so eval runs never touch production.

**Done when:** local dev runs against the Neon staging branch, the cache tests pass against it, and a repeated fight is served from the cache.

---

## Phase 5: Deploy to a staging host

**Goal:** the app runs on my host, verified before any users see it.

1. **YOU:** pick the host. Recommendation: **Railway or Render**, one service where Express serves the built frontend. Both run a normal long-running Node server, which fits the in-memory rate limit and cache logic. Avoid Vercel for now: its serverless model would split the in-memory limits across instances and add cold starts. Avoid any free tier that sleeps; a 30-second cold start ruins a demo. Check current pricing; expect a small monthly cost.
2. Claude Code:
   - Add the host's config (build command, start command, Node version, health check at `/api/health`).
   - Set the build ID from the host's git commit variable so the cache invalidates on each deploy.
   - Make share-page and Open Graph URLs use a `PUBLIC_BASE_URL` variable instead of any hard-coded replit.app address.
   - Replace the "development only" gate on the eval cache bypass with a secret: the bypass header must carry `EVAL_TOKEN`, and production ignores it unless the token matches. This lets me run the eval against staging safely.
3. **YOU:** set env vars in the host dashboard: `ANTHROPIC_API_KEY`, `OPENROUTER_API_KEY`, `DATABASE_URL` (staging branch), `NARRATION_DAILY_CAP`, `EVAL_TOKEN`, `PUBLIC_BASE_URL`.
4. Run `EVAL_BASE_URL=<staging url> pnpm eval` with the token.

**Done when:** staging passes the Phase 3 thresholds, the smoke test passes (fight twice, share link preview, How it works on a phone), and `/api/health` returns the deployed commit.

---

## Phase 6: Domain and production

**Goal:** production on my own domain.

1. **YOU:** buy a domain without "replit" in it (Cloudflare Registrar or Porkbun price at cost). Check renewal price, not just the first year.
2. **YOU:** create the production service (or promote staging) with `DATABASE_URL` pointing at the Neon main branch and `PUBLIC_BASE_URL` set to the new domain.
3. Claude Code: add the custom domain config for the host, confirm HTTPS, and update canonical URLs, Open Graph tags, the README, and the GitHub About website field (that last one is **YOU**).
4. Uptime: **YOU** add a free uptime check on `/api/health` (UptimeRobot or Better Stack) with email alerts.

**Done when:** the new domain serves the app over HTTPS, a share link shows the right preview card, and the uptime check is green.

---

## Phase 7: Redirect the old link and retire Replit

**Goal:** old links land on the new site; Replit stops billing.

1. A replit.app address can't be pointed elsewhere with DNS, so the old deployment must redirect.
2. Claude Code: on a branch named `replit-redirect`, replace the app with a minimal server that answers every request with a 301 to the same path and query on the new domain (so shared fight links still open the right matchup).
3. **YOU:** in the Replit workspace, pull that branch and republish it on the smallest deployment option. Confirm `https://animosityarena.replit.app/?a=Lion&b=Grizzly+bear&environment=land&mode=forced_fight` lands on the same matchup on the new domain.
4. **YOU:** keep the redirect for about two months, then unpublish and delete the Replit deployment. Turn off anything still drawing Replit credits.

**Done when:** old links redirect correctly, and Replit shows no ongoing charges for the main app.

---

## Phase 8: Clean up

1. Move `replit.md` and `.agents/` into `docs/history/replit/` (they document how v1 was built) or delete them. Remove `.replit` and `.replitignore`.
2. README: add a short "History" note: v1 was built on Replit with Replit Agent; it now runs on my own infrastructure.
3. Confirm GitHub Actions still passes, and tag `v2-self-hosted`.

## Rollback

Until Phase 7, the Replit deployment is untouched and live. If staging or production fails, keep sharing the replit.app link and fix forward. Never delete the Replit deployment before the redirect is verified.
