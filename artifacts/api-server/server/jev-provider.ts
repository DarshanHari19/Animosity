import {
  TypeSafeClient, APIError, APITimeoutError, APIConnectionError,
  type TypeSafeClientConfig,
} from "@typesafe-ai/sdk";
import type { JevFailureCategory } from "./jev-telemetry";

export type JevRequest = {
  model: "jev-latest";
  state: string;
  questions: Record<string, { type: "noul"; instructions: string }>;
};
export class JevRequestError extends Error {
  constructor(readonly category: JevFailureCategory, readonly http_status: number | null) {
    super("Jev request unavailable."); // Never retain SDK messages, bodies, headers, or credentials.
  }
}

/** Shared live/test transport. One attempt, uncompressed, with a 10-second timeout. */
export async function requestJev(
  request: JevRequest,
  onHttpStatus: (status: number) => void,
  options: Pick<TypeSafeClientConfig, "baseURL" | "apiKey" | "fetch"> = {},
): Promise<unknown> {
  const baseURL = options.baseURL ?? process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL;
  const apiKey = options.apiKey ?? process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY;
  if (!baseURL || !apiKey) throw new JevRequestError("configuration_error", null);
  let status: number | null = null;
  const client = new TypeSafeClient({
    baseURL, apiKey, timeout: 10_000, retry: { maxRetries: 0 }, logLevel: "off",
    compression: false,
    fetch: async (url, init) => {
      const response = await (options.fetch ?? fetch)(url, init);
      status = response.status;
      onHttpStatus(status);
      return response;
    },
  });
  try { return await client.systemOne(request); }
  catch (error) {
    const category: JevFailureCategory = error instanceof APITimeoutError ? "timeout"
      : error instanceof APIError ? "http_error"
      : error instanceof APIConnectionError ? "transport_error"
      : status !== null && status >= 200 && status < 300 ? "parse_error"
      : "transport_error";
    throw new JevRequestError(category, error instanceof APIError ? error.status : status);
  }
}
