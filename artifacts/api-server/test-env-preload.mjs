// Preloaded into every backend test process (see the package.json "test" script).
// Removes provider settings that a developer's shell may export, so tests can never
// use a billable key or a custom endpoint. Needs no .env and no network.
for (const name of [
  "ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_CUSTOM_HEADERS",
  "NARRATION_MODEL", "OPENROUTER_API_KEY", "OPENROUTER_BASE_URL",
]) delete process.env[name];
