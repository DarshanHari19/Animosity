# Narration evals

- `2026-11-08-own-anthropic-key-local.json`: raw output of evaluation 8 (75 fights, claude-haiku-5-5 on the official Anthropic API, Jev via OpenRouter).
- `2026-11-08-own-anthropic-key-local.txt`: console output of the same run, with ANSI color codes removed.
- `2026-11-18-railway-staging.json`: raw output of evaluation 9 (75 fights, claude-haiku-5-5 on the official Anthropic API, Jev via OpenRouter, run against Railway staging).
- `2026-11-18-railway-staging.txt`: console output of the same run, with ANSI color codes removed and the pnpm echo lines and exit status dropped.

Evaluation 8 ran locally at commit `e8de165`, on 2026-11-08.

- Unavailable: 1 of 75 (1.3%), case 17 run 3, INVALID_NARRATION.
- First-attempt pass: 68 of 75 (90.7%).
- Jev: 74 narrations scored, 0 calls failed or timed out, 82 provider calls, 0 rate-limit deferrals.

## Phase 3 thresholds (evaluation 8)

| Threshold | Target | Result | Status |
|---|---|---|---|
| Unavailable | 2 of 75 or fewer | 1 of 75 | Pass |
| First-attempt pass | 85% or higher | 90.7% | Pass |
| Jev coverage | Every narration scored, zero transport failures | 74 scored, 0 transport failures; the 1 unscored fight is the unavailable one | Pass |

## Evaluation 9 (Railway staging)

Evaluation 9 ran against Railway staging at commit `1e545a9ae239613b4081e0236a52ac8a57ee4efa` (the deployed build ID is that commit SHA), on 2026-11-18.

- Unavailable: 2 of 75 (2.7%), case 23 run 2 and case 25 run 3, both INVALID_NARRATION.
- First-attempt pass: 67 of 75 (89.3%).
- Jev: 73 narrations scored, 0 calls failed or timed out, 2 not scored (the unavailable fights), 83 provider calls, 0 rate-limit deferrals.
- Failed checks across all provider attempts: non_finish_verdict (6 failed attempts) was the most common; the rest were causal_grounding.
- Remote diagnostics were complete.

| Threshold | Target | Result | Status |
|---|---|---|---|
| Unavailable | 2 of 75 or fewer | 2 of 75 (2.7%) | Pass, at the limit |
| First-attempt pass | 85% or higher | 89.3% | Pass |
| Jev coverage | Every narration scored, zero transport failures | 73 scored, 0 calls failed or timed out; the 2 unscored fights are the unavailable ones | Pass |

## Comparison to the last Replit baseline

| Run | Unavailable | First-attempt pass | Jev |
|---|---|---|---|
| Replit baseline | 0 of 75 | 90.7% | 75 of 75 |
| Evaluation 8, own key, local | 1 of 75 | 90.7% | 74 of 74 scored (1 unavailable) |
| Evaluation 9, own key, Railway staging | 2 of 75 | 89.3% | 73 of 73 scored (2 unavailable) |
