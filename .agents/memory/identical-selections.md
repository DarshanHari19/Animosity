---
name: Identical animal selections
description: Product rule for same-animal matchups and their route tests.
---

Allow identical animal selections in both the API and UI. Lion vs Lion goes
through the normal route and returns whatever the engine returns, without
automatically substituting an even result. Its future scoring test must exercise
the route like the other matchup cases.

**Why:** The user explicitly approved the methodology with this change, replacing
the earlier rule that rejected identical selections.

**How to apply:** Keep request validation, selector behavior, route handling and
matchup tests consistent with this rule. An expected even result in a future
test is not permission to hardcode that result in routing.
