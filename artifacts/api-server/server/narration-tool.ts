import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { BeatSchema, type Animal } from "./schemas";

export type EvidenceItem = { id: string; text: string };
export const NARRATION_TOOL_NAME = "submit_narration";
const WireEnvelopeSchema = z.object({
  beats: z.array(BeatSchema.omit({ fact_used: true }).extend({
    fact_id: z.string().min(1),
  }).strict()).min(5).max(8),
}).strict();

export function narrationTool(a: Animal, b: Animal, evidence: EvidenceItem[]): Anthropic.Tool {
  return {
    name: NARRATION_TOOL_NAME,
    description: "Submit 5–8 beats. Only the last beat may finish or have a null animal. " +
      "An even finish has a null animal; a favored finish names the favored animal. " +
      "Cite each beat using one supplied evidence ID, never paraphrased evidence.",
    input_schema: {
      type: "object", additionalProperties: false, required: ["beats"],
      properties: {
        beats: {
          type: "array", minItems: 5, maxItems: 8,
          items: {
            type: "object", additionalProperties: false,
            required: ["text", "action", "animal", "fact_id"],
            properties: {
              text: { type: "string", minLength: 1 },
              action: { type: "string", enum: BeatSchema.shape.action.options },
              animal: { anyOf: [
                { type: "string", enum: [...new Set([a.name, b.name])] }, { type: "null" },
              ] },
              fact_id: { type: "string", enum: evidence.map(({ id }) => id) },
            },
          },
        },
      },
    },
  };
}

/** IDs are resolved without fuzzy matching, replacement facts, or model text. */
export function resolveEvidence(input: unknown, evidence: EvidenceItem[]) {
  const wire = WireEnvelopeSchema.parse(input);
  const byId = new Map(evidence.map(({ id, text }) => [id, text]));
  return { beats: wire.beats.map(({ fact_id, ...beat }, index) => {
    const fact_used = byId.get(fact_id);
    if (fact_used === undefined) {
      throw new z.ZodError([{
        code: z.ZodIssueCode.custom, path: ["beats", index, "fact_id"],
        message: `Unknown fact_id: ${fact_id}`,
      }]);
    }
    return { ...beat, fact_used };
  }) };
}
