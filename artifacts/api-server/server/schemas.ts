import { z } from "zod";
import {
  CreateFightBody,
  GetAnimalsResponseItem,
  CreateFightResponse,
} from "@workspace/api-zod";

// The OpenAPI contract defines the enums and generated field types. Add strict
// nested validation too, so source entries match exactly { tier, ref }.
export const FieldSourceSchema = z.object({
  tier: z.union([z.literal(1), z.literal(2), z.literal(3), z.null()]),
  ref: z.string(),
}).strict();
export type FieldSource = z.infer<typeof FieldSourceSchema>;
export const AnimalSchema = GetAnimalsResponseItem.extend({
  field_sources: z.record(z.string(), FieldSourceSchema),
}).strict();
export type Animal = z.infer<typeof AnimalSchema>;
export const EnvironmentSchema = AnimalSchema.shape.functions_in.element;
export type Environment = z.infer<typeof EnvironmentSchema>;
export const FightInputSchema = CreateFightBody.strict();
export const EngineContextSchema = CreateFightBody.pick({
  environment: true, mode: true, encounter: true,
}).strict();
export type EngineContext = z.infer<typeof EngineContextSchema>;

const rawResult = CreateFightResponse.shape.result;
export const OutcomeSchema = z.discriminatedUnion("kind", [
  rawResult.shape.outcome.options[0].strict(),
  rawResult.shape.outcome.options[1].strict(),
  rawResult.shape.outcome.options[2].strict(),
  rawResult.shape.outcome.options[3].strict(),
  rawResult.shape.outcome.options[4].strict(),
]);
export const ResultSchema = rawResult.extend({
  outcome: OutcomeSchema,
  advantage_score: z.number().finite().nullable(),
  factors: z.array(rawResult.shape.factors.element.extend({
    value: z.number().finite(),
  }).strict()),
}).strict();
export type MatchupResult = z.infer<typeof ResultSchema>;
export const BeatSchema = CreateFightResponse.shape.beats.element.strict();
export type Beat = z.infer<typeof BeatSchema>;

export function resultSchemaFor(a: Animal, b: Animal) {
  return ResultSchema.refine(
    ({ outcome }) => {
      if (outcome.kind === "favored") return outcome.animal === a.name || outcome.animal === b.name;
      if (outcome.kind !== "no_engagement") return true;
      const remaining = [a.name, b.name];
      return outcome.animals.every((name) => {
        const index = remaining.indexOf(name);
        if (index === -1) return false;
        remaining.splice(index, 1);
        return true;
      });
    },
    { message: "Outcome animal identifiers must match the selected animals.", path: ["outcome"] },
  );
}

export function beatsSchemaFor(a: Animal, b: Animal) {
  return z.array(BeatSchema.extend({
    animal: z.enum([a.name, b.name]).nullable(),
  })).min(5).max(8).superRefine((beats, ctx) => {
    beats.forEach((beat, index) => {
      const final = index === beats.length - 1;
      if ((beat.action === "finish") !== final || (!final && beat.animal === null)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom, path: [index],
          message: "Only the final beat must finish; only that beat may have a null animal.",
        });
      }
    });
  });
}

// Structural validation permits either final identifier so a valid but wrong
// outcome can receive a corrective retry instead of being a schema failure.
export function narrationMatchesOutcome(result: MatchupResult, beats: Beat[]): boolean {
  const final = beats.at(-1);
  if (!final || final.action !== "finish") return false;
  return result.outcome.kind === "favored"
    ? final.animal === result.outcome.animal
    : result.outcome.kind === "even" && final.animal === null;
}

export function fightResponseSchemaFor(a: Animal, b: Animal) {
  return CreateFightResponse.extend({
    result: resultSchemaFor(a, b),
    beats: z.array(BeatSchema).max(8),
  }).strict().superRefine(({ result, beats, explanation }, ctx) => {
    const narrated = result.outcome.kind === "favored" || result.outcome.kind === "even";
    const hasExplanation = typeof explanation === "string" &&
      explanation.trim().length > 0 && !/[\r\n]/.test(explanation);
    const valid = narrated
      ? (result.deciding_factor === "environmental_advantage" ? hasExplanation : explanation === null) &&
        beatsSchemaFor(a, b).safeParse(beats).success &&
        narrationMatchesOutcome(result, beats)
      : beats.length === 0 && hasExplanation;
    if (!valid) ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Response must contain matching narration or a one-line explanation, according to its outcome.",
    });
  });
}
