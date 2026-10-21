---
name: Narration evaluation log correlation
description: Buffered workflow logging can misattribute model failures in serial live evaluations.
---

Correlate narration failures using the logger's embedded timestamp, selected
animals, and each HTTP request's start/end interval. Do not attribute warnings
using bytes appended between requests.

**Why:** The workflow logging pipeline can flush a previous request's warning
during the next request, even after a short post-response delay. Arrival-based
correlation misclassified the next request's first-attempt result.

**How to apply:** Analyze the complete log after a batch finishes, normalize
CRLF line endings, and match embedded times to saved request intervals. Check
for duplicate attempt identifiers and confirm the expected number of completed
fight POSTs. Keep one verified build identity throughout the evaluation.
