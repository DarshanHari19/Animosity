---
name: Git inspection protection
description: Handling workspace Git metadata protection during read-only inspections.
---

A read-only Git inspection can print its result and still report protected `.git/index.lock` access. Treat this as an inspection-tool failure, not evidence that application tests failed.

**Why:** This workspace reported protected index-lock access after a Git diff inspection, while independent tests, type checks, and the running application all passed.

**How to apply:** Prefer filesystem inspections when Git metadata access is blocked. Do not escalate Git write permissions merely to inspect changes, and disclose verification limits if necessary.
