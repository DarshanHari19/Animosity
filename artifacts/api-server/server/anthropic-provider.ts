import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { FightError } from "./errors";
import type { FailureCheck } from "./narration-diagnostics";

export type NarrationMessage = { role: "system" | "user"; content: string };

const MessageSchema = z.object({
  content: z.array(z.object({ type: z.string(), text: z.string().optional() })),
});
const invalidResponse = () => new FightError(
  "INVALID_NARRATION",
  "Narration provider returned invalid JSON, an invalid beat schema, or unsupported evidence.",
  502,
);

/** Normalize Anthropic responses to the narrator's existing transport envelope. */
export function createAnthropicProvider(config: {
  apiKey: string; baseURL: string; model: string; fetch?: typeof fetch;
  onInvalidResponse?: (checks: FailureCheck[], rawModelText: string | null) => void;
}) {
  const client = new Anthropic({
    apiKey: config.apiKey, baseURL: config.baseURL,
    timeout: 30_000,
    // Only the narrator's single corrective retry is allowed.
    maxRetries: 0,
    fetchOptions: { redirect: "error" },
    ...(config.fetch ? { fetch: config.fetch } : {}),
  });
  return async (messages: readonly NarrationMessage[]): Promise<Response> => {
    let message: unknown;
    try {
      message = await client.messages.create({
        model: config.model,
        max_tokens: 8192,
        thinking: { type: "disabled" },
        system: messages.filter(({ role }) => role === "system").map(({ content }) => content).join("\n"),
        messages: messages.filter(({ role }) => role === "user")
          .map(({ content }) => ({ role: "user" as const, content })),
      });
    } catch (error) {
      if (error instanceof SyntaxError) {
        config.onInvalidResponse?.([{ check: "JSON_parse" }], null);
        throw invalidResponse();
      }
      const status = error instanceof Anthropic.APIError ? error.status : undefined;
      throw new FightError("LLM_PROVIDER_FAILURE", status
        ? `Narration provider returned HTTP ${status}.`
        : "Narration provider request failed or timed out.", 502);
    }
    const parsed = MessageSchema.safeParse(message);
    if (!parsed.success) {
      // A malformed provider envelope may still contain usable raw text for
      // diagnostics. Do not log headers, credentials, or SDK error objects.
      const blocks: unknown[] = typeof message === "object" && message !== null &&
        "content" in message && Array.isArray(message.content) ? message.content : [];
      const text = blocks.flatMap((block) =>
        typeof block === "object" && block !== null && "text" in block &&
        typeof block.text === "string" ? [block.text] : []).join("");
      config.onInvalidResponse?.([{
        check: "Zod_schema",
        issues: parsed.error.issues.map(({ path, message }) => ({ path, message })),
      }], text || null);
      throw invalidResponse();
    }
    const content = parsed.data.content.filter((block) => block.type === "text")
      .map((block) => block.text ?? "").join("");
    if (!content) {
      config.onInvalidResponse?.([{
        check: "Zod_schema",
        issues: [{ path: ["content"], message: "No model text was returned." }],
      }], content);
      throw invalidResponse();
    }
    return Response.json({ choices: [{ message: { content } }] });
  };
}
