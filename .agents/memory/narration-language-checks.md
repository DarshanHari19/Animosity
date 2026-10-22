---
name: Narration language-check false rejections
description: Evaluate legitimate model paraphrases when adding deterministic prose checks.
---

When validating prose, test meaning-preserving paraphrases as acceptance cases,
not only forbidden wording as rejection cases. Unless the user specifies an exact
template, do not treat one phrasing as the only valid expression of the rule.

**Why:** Live conclusive narration legitimately used “break apart” instead of
“break off” and compound action verbs; overly literal new checks rejected these
despite satisfying the intended choreography.

**How to apply:** Keep existing numeric, evidence, outcome and retry guarantees
intact. Distinguish actual model rule violations from false rejections before
changing prompts or validators, and preserve authentic paraphrases in regression
tests. Never imply that English pattern checks prove semantic correctness.
