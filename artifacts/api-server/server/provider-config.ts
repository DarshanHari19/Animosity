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

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

/**
 * Parses a provider base URL. https is always allowed; http only for loopback
 * hosts (`allowLoopbackHttp`). Credentials, query strings and fragments are
 * rejected. `allowPath: false` also requires the path to be empty or "/".
 * Returns null when invalid; never throws and never echoes the value.
 */
export function parseBaseURL(
  value: string, { allowPath, allowLoopbackHttp }: { allowPath: boolean; allowLoopbackHttp: boolean },
): URL | null {
  let url: URL;
  try { url = new URL(value); } catch { return null; }
  if (url.username || url.password || url.search || url.hash || /[?#]/.test(value)) return null;
  const httpOk = allowLoopbackHttp && url.protocol === "http:" && LOOPBACK_HOSTS.has(url.hostname);
  if (url.protocol !== "https:" && !httpOk) return null;
  if (!allowPath && url.pathname !== "/" && url.pathname !== "") return null;
  return url;
}

const read = (env: Env, name: string): string | undefined => env[name]?.trim() || undefined;
/** A key with whitespace or "=" is treated as unset (guards loadEnvFile's `A= \nB=x` quirk). */
const invalidKey = (value: string | undefined) => value !== undefined && /[\s=]/.test(value);
const readKey = (env: Env, name: string): string | undefined => {
  const value = read(env, name);
  return invalidKey(value) ? undefined : value;
};

/** Conservative model-ID shape. Anything else (spaces, "=", newlines) falls back to the default. */
const MODEL_PATTERN = /^[A-Za-z0-9._:@/-]+$/;
const readModel = (env: Env): string => {
  const value = read(env, "NARRATION_MODEL");
  return value !== undefined && MODEL_PATTERN.test(value) ? value : DEFAULT_NARRATION_MODEL;
};

export function resolveNarrationConfig(env: Env) {
  return {
    apiKey: readKey(env, "ANTHROPIC_API_KEY"),
    /** Explicit override only; undefined means the official API. */
    baseURL: read(env, "ANTHROPIC_BASE_URL"),
    model: readModel(env),
  };
}

export function resolveJevConfig(env: Env) {
  return {
    apiKey: readKey(env, "OPENROUTER_API_KEY"),
    baseURL: read(env, "OPENROUTER_BASE_URL") ?? DEFAULT_OPENROUTER_BASE_URL,
  };
}

/** Validation for an env-provided ANTHROPIC_BASE_URL (origin only, loopback http allowed). */
export const parseAnthropicBaseURL = (value: string) => parseBaseURL(value, { allowPath: false, allowLoopbackHttp: true });
/** Validation for OPENROUTER_BASE_URL (a path prefix is allowed; the SDK appends /v1/systemone). */
export const parseOpenRouterBaseURL = (value: string) => parseBaseURL(value, { allowPath: true, allowLoopbackHttp: true });

/** One message per problem, naming variables only, never containing values. */
export function startupConfigWarnings(env: Env): string[] {
  const warnings: string[] = [];
  const check = (keyName: string, urlName: string, what: string, note: string, parse: (v: string) => URL | null) => {
    const raw = read(env, keyName);
    if (!raw) warnings.push(`${keyName} is not set; ${what} will be unavailable${note}.`);
    else if (invalidKey(raw)) warnings.push(`${keyName} contains whitespace or "="; treating it as unset, so ${what} will be unavailable${note}.`);
    const url = read(env, urlName);
    if (url && !parse(url)) warnings.push(`${urlName} is not a valid base URL (https, or http on loopback only); ${what} will be unavailable${note}.`);
  };
  check("ANTHROPIC_API_KEY", "ANTHROPIC_BASE_URL", "narration", " (fights return the verdict only)", parseAnthropicBaseURL);
  check("OPENROUTER_API_KEY", "OPENROUTER_BASE_URL", "Jev shadow scoring", " (narration is not affected)", parseOpenRouterBaseURL);
  const model = read(env, "NARRATION_MODEL");
  if (model !== undefined && !MODEL_PATTERN.test(model)) {
    warnings.push(`NARRATION_MODEL is not a valid model ID; using the default ${DEFAULT_NARRATION_MODEL}.`);
  }
  for (const name of ["ANTHROPIC_AUTH_TOKEN", "ANTHROPIC_CUSTOM_HEADERS"]) {
    if (read(env, name)) warnings.push(`${name} is set; the Anthropic SDK reads it and adds request headers. Unset it unless intended.`);
  }
  return warnings;
}

/** Host (origin only) and model that narration will use. Never includes a key. */
export function narrationStartupSummary(env: Env) {
  const config = resolveNarrationConfig(env);
  const url = config.baseURL ? parseAnthropicBaseURL(config.baseURL) : new URL(DEFAULT_ANTHROPIC_BASE_URL);
  return { narration_host: url ? url.origin : "invalid", narration_model: config.model };
}
