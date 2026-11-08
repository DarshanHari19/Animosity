# Narration evals

- `2026-11-08-own-anthropic-key-local.json`: raw output of evaluation 8 (75 fights, claude-haiku-5-5 on the official Anthropic API, Jev via OpenRouter).
- `2026-11-08-own-anthropic-key-local.txt`: console output of the same run, with ANSI color codes removed.

Evaluation 8 ran locally at commit `e8de165`, on 2026-11-08.

- Unavailable: 1 of 75 (1.3%), case 17 run 3, INVALID_NARRATION.
- First-attempt pass: 68 of 75 (90.7%).
- Jev: 74 narrations scored, 0 calls failed or timed out, 82 provider calls, 0 rate-limit deferrals.

## Phase 3 thresholds

| Threshold | Target | Result | Status |
|---|---|---|---|
| Unavailable | 2 of 75 or fewer | 1 of 75 | Pass |
| First-attempt pass | 85% or higher | 90.7% | Pass |
| Jev coverage | Every narration scored, zero transport failures | 74 scored, 0 transport failures; the 1 unscored fight is the unavailable one | Pass |

## Comparison to the last Replit baseline

| Run | Unavailable | First-attempt pass | Jev |
|---|---|---|---|
| Replit baseline | 0 of 75 | 90.7% | 75 of 75 |
| Evaluation 8, own key, local | 1 of 75 | 90.7% | 74 of 74 scored (1 unavailable) |
