---
name: DOM test dependency compatibility
description: Why DOM test dependency upgrades need an explicit Node engine check.
---

Check Node engine requirements when upgrading DOM test dependencies; a successful install and passing test run do not guarantee a supported runtime.

**Why:** The workspace allowed jsdom 30 to install on Node 24.13 even though its dependency chain requires Node 24.15 or newer on that release line. The test suite therefore uses jsdom 29, which supports the workspace runtime.

**How to apply:** Compare the installed Node version with both the DOM package's engines and its transitive engine requirements before upgrading. Do not upgrade the application runtime just to use the newest test-only DOM release.
