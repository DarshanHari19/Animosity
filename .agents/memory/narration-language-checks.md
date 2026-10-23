---
name: Narration language-check false rejections
description: Evaluate legitimate model paraphrases when adding deterministic prose checks.
---

When validating prose, test meaning-preserving paraphrases as acceptance cases,
not only forbidden wording as rejection cases. Unless the user specifies an exact
template, do not treat one phrasing as the only valid expression of the rule.

**Why:** Live conclusive narration legitimately used “break apart” instead of
“break off” and compound action verbs; overly literal new checks rejected these
despite satisfying the intended choreography. The user subsequently said the
climax checks were too strict and explicitly distinguished hard limits from
prompt guidance; stylistic instructions alone do not authorize extra hard gates.

**How to apply:** Keep existing numeric, evidence, outcome and retry guarantees
intact. Distinguish actual model rule violations from false rejections before
changing prompts or validators, and preserve authentic paraphrases in regression
tests. Never imply that English pattern checks prove semantic correctness.

Ambiguous words need their objects and grammatical role before they can act as
hard verdict or evidence signals: “beats its chest” is not beating an opponent,
“missing by a whisker” is not missing data, and “determined strides” does not
say what determined the result.

**Why:** Real narration was rejected on all three despite not making any of
those prohibited claims; changing only the prompt would not repair a validator
that mistakes ordinary action wording for a result.

**How to apply:** Add the accepted sentence alongside a nearby real-rule
rejection (beating an opponent, missing data, or a causal outcome explanation)
so tightening one pattern does not weaken the other.
