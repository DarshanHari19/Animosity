// Model-provider configuration, read from the environment in one place.
// Blank values count as unset. Nothing here logs or returns a key except
// through the resolved config objects handed to the provider clients.

type Env = Readonly<Record<string, string | undefined>>;

/** Same default the @anthropic-ai/sdk applies when no base URL is given. */
export const DEFAULT_ANTHROPIC_BASE_URL = "https://api.anthropic.com";
export const DEFAULT_NARRATION_MODEL = "claude-haiku-5-5";
/**
 * OpenRouter's TypeSafe System One root. The SDK appends /v1/systemone, giving
 * https://openrouter.ai/api/v1/systemone. The SDK's own default
 * (https://api.typesafe.ai) is TypeSafe's service and does not accept an OpenRouter key.
 */
export const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api";

const read = (env: Env, name: string): string | undefined => env[name] || undefined;

export function resolveNarrationConfig(env: Env) {
  return {
    apiKey: read(env, "ANTHROPIC_API_KEY"),
    /** Explicit override only; undefined means the official API. */
    baseURL: read(env, "ANTHROPIC_BASE_URL"),
    model: read(env, "NARRATION_MODEL") ?? DEFAULT_NARRATION_MODEL,
  };
}

export function resolveJevConfig(env: Env) {
  return {
    apiKey: read(env, "OPENROUTER_API_KEY"),
    baseURL: read(env, "OPENROUTER_BASE_URL") ?? DEFAULT_OPENROUTER_BASE_URL,
  };
}

/** One message per missing key, never containing values. */
export function startupConfigWarnings(env: Env): string[] {
  const warnings: string[] = [];
  if (!resolveNarrationConfig(env).apiKey) {
    warnings.push("ANTHROPIC_API_KEY is not set; narration will be unavailable (fights return the verdict only).");
  }
  if (!resolveJevConfig(env).apiKey) {
    warnings.push("OPENROUTER_API_KEY is not set; Jev shadow scoring will be unavailable (narration is not affected).");
  }
  return warnings;
}
