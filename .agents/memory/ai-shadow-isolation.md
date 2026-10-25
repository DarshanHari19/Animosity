---
name: AI shadow isolation
description: Boundaries for observational classifiers and provider-free route tests.
---

Shadow classification observes freshly validated narration only and must never
approve rejected text, change beats, or enter narration's retry path. Cache hits
remain provider-free.

**Why:** The user requested observation without changing acceptance, and separately
required cached narration to make zero model calls.

**How to apply:** Keep shadow failures isolated from authoritative validation and
cache reads. Do not move observation into a common response path that also handles
cache hits or unavailable narration.

Route tests that examine result presentation must explicitly inject narration,
even when they do not assert any narration fields.

**Why:** A wording-only route test inherited the real narrator and unexpectedly
contacted providers once managed credentials were available.

**How to apply:** Never assume ignoring narration in assertions prevents calls;
inject a deterministic test transport or an explicit unavailable-provider stub.

The managed OpenRouter transport rejects zstd-compressed TypeSafe SDK requests.

**Why:** A manual real-bout probe returned HTTP 415 with
`protocol.http.UnsupportedEncoding` for zstd. The SDK automatically compresses
bodies at least 1 KiB on supported Node versions, so a tiny availability probe
can succeed while real narration evaluations fail. Historical shadow failures
did not retain exception classifications or Jev-only timings; do not invent them.

**How to apply:** When authorized to fix transport configuration, use the SDK's
documented `compression: false` option, preserving typed System One requests.
Keep safe error categories and durations if adding diagnostics; never expose
credentials or attribute historical statuses/latencies without recorded evidence.
