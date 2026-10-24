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
