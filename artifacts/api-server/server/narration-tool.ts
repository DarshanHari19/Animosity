import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { BeatSchema, type Animal, type MatchupResult } from "./schemas";
import type { EvidenceItem } from "./narration-evidence";
export type { EvidenceItem } from "./narration-evidence";

export const NARRATION_TOOL_NAME = "submit_narration";
const actionSchema = BeatSchema.shape.action.exclude(["finish"]);
const actions = actionSchema.options;
const idsSchema = z.array(z.string().min(1)).min(1).max(3)
  .refine((ids) => new Set(ids).size === ids.length, "Citations must use distinct IDs.");

export function narrationTool(a: Animal, b: Animal, evidence: EvidenceItem[], _result: MatchupResult): Anthropic.Tool {
  const properties = {
    text: { type: "string", minLength: 1 },
    fact_ids: { type: "array", minItems: 1, maxItems: 3, uniqueItems: true,
      items: { type: "string", enum: evidence.map(({ id }) => id) } },
  };
  const required = ["text", "action", "animal", "fact_ids"];
  return {
    name: NARRATION_TOOL_NAME,
    description: "Submit only 4–7 neutral non-finish beats. Never state or imply who is winning. Cite 1–3 evidence IDs per beat.",
    input_schema: {
      type: "object", additionalProperties: false, required: ["beats"],
      properties: {
        beats: { type: "array", minItems: 4, maxItems: 7, items: {
          type: "object", additionalProperties: false, required,
          properties: { ...properties, action: { type: "string", enum: actions },
            animal: { type: "string", enum: [...new Set([a.name, b.name])] } },
        } },
      },
    },
  };
}

/** No fuzzy matching, replacement facts, or legacy-wire fallback. */
export function resolveEvidence(input: unknown, evidence: EvidenceItem[], a: Animal, b: Animal) {
  const base = BeatSchema.omit({ facts_used: true }).extend({ fact_ids: idsSchema });
  const actor = z.enum([a.name, b.name]);
  const wire = z.object({
    beats: z.array(base.extend({ action: actionSchema, animal: actor }).strict()).min(4).max(7),
  }).strict().parse(input);
  const byId = new Map(evidence.map(({ id, text }) => [id, text]));
  return { beats: wire.beats.map(({ fact_ids, ...beat }, index) => ({
    ...beat,
    facts_used: fact_ids.map((id, citation) => {
      const text = byId.get(id);
      if (text === undefined) throw new z.ZodError([{
        code: "custom", path: ["beats", index, "fact_ids", citation], message: `Unknown fact_id: ${id}`,
      }]);
      return text;
    }),
  })) };
}
