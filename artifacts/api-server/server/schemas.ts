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
export const EnvironmentSchema = z.enum(["land", "water"]);
export type Environment = z.infer<typeof EnvironmentSchema>;
export const FightInputSchema = CreateFightBody.strict().refine(
  (input) => input.animalA !== input.animalB,
  { message: "Choose two different animals.", path: ["animalB"] },
);
export const ResultSchema = CreateFightResponse.shape.result.strict();
export type MatchupResult = z.infer<typeof ResultSchema>;
export const BeatSchema = CreateFightResponse.shape.beats.element.strict();
export type Beat = z.infer<typeof BeatSchema>;
export const NonWinningOutcomeSchema = z.enum(["no_contest", "no_decisive_winner"]);

export function resultSchemaFor(a: Animal, b: Animal) {
  return ResultSchema.refine(
    (result) => result.winner === a.name || result.winner === b.name ||
      NonWinningOutcomeSchema.safeParse(result.winner).success,
    { message: "Engine winner must be a selected animal name, no_contest, or no_decisive_winner.", path: ["winner"] },
  );
}

export function beatsSchemaFor(a: Animal, b: Animal) {
  return z.array(BeatSchema.extend({
    animal: z.enum([a.name, b.name, ...NonWinningOutcomeSchema.options]),
  })).min(5).max(8).refine(
    (beats) => beats.at(-1)?.action === "finish",
    { message: "The last beat must have action finish." },
  ).refine(
    (beats) => beats.every((beat, index) =>
      !NonWinningOutcomeSchema.safeParse(beat.animal).success ||
      (index === beats.length - 1 && beat.action === "finish")),
    { message: "Non-winning outcome identifiers are allowed only on the final finish beat." },
  );
}
