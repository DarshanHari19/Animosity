import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { FightError } from "./errors";

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
      if (error instanceof SyntaxError) throw invalidResponse();
      const status = error instanceof Anthropic.APIError ? error.status : undefined;
      throw new FightError("LLM_PROVIDER_FAILURE", status
        ? `Narration provider returned HTTP ${status}.`
        : "Narration provider request failed or timed out.", 502);
    }
    const parsed = MessageSchema.safeParse(message);
    if (!parsed.success) throw invalidResponse();
    const content = parsed.data.content.filter((block) => block.type === "text")
      .map((block) => block.text ?? "").join("");
    if (!content) throw invalidResponse();
    return Response.json({ choices: [{ message: { content } }] });
  };
}
