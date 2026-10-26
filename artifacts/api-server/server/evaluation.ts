import type { z } from "zod";
import type { fightResponseSchemaFor, EngineContext } from "./schemas";
import type { JevReport } from "./jev-telemetry";

// Original twenty baseline scenarios plus five approved additions.
export const evaluationCases = [
  ["Lion", "Lion", "land", "realistic"],
  ["Hippopotamus", "Lion", "land", "realistic"],
  ["Saltwater crocodile", "Lion", "land", "realistic"],
  ["Lion", "Grizzly bear", "land", "realistic"],
  ["Gorilla", "Grizzly bear", "land", "forced_fight"],
  ["Rhinoceros", "Lion", "land", "realistic"],
  ["Hippopotamus", "Rhinoceros", "land", "realistic"],
  ["Hippopotamus", "Saltwater crocodile", "shallow_water", "realistic"],
  ["Great white shark", "Saltwater crocodile", "deep_water", "forced_fight"],
  ["Great white shark", "Lion", "deep_water", "forced_fight"],
  ["Great white shark", "Lion", "land", "forced_fight"],
  ["Saltwater crocodile", "Lion", "shallow_water", "forced_fight"],
  ["Hippopotamus", "Lion", "shallow_water", "forced_fight"],
  ["Rhinoceros", "Grizzly bear", "land", "realistic"],
  ["Grizzly bear", "Saltwater crocodile", "land", "realistic"],
  ["Gorilla", "Lion", "land", "forced_fight"],
  ["Gorilla", "Rhinoceros", "land", "forced_fight"],
  ["Great white shark", "Great white shark", "deep_water", "realistic"],
  ["Saltwater crocodile", "Saltwater crocodile", "shallow_water", "realistic"],
  ["Hippopotamus", "Hippopotamus", "shallow_water", "realistic"],
  ["Tiger", "Lion", "land", "forced_fight"],
  ["Polar bear", "Grizzly bear", "land", "forced_fight"],
  ["African bush elephant", "Rhinoceros", "land", "forced_fight"],
  ["Orca", "Great white shark", "deep_water", "forced_fight"],
  ["Komodo dragon", "Gorilla", "land", "forced_fight"],
].map(([animalA, animalB, environment, mode], index) => ({
  case_id: index + 1,
  input: { animalA: animalA!, animalB: animalB!, environment, mode, encounter: "face_off" } as
    EngineContext & { animalA: string; animalB: string },
}));

export type EvaluationRun = {
  case_id: number; run: number; attempts: number; started: string; finished: string;
  body: z.infer<ReturnType<typeof fightResponseSchemaFor>>;
  jev_shadow?: JevReport;
};
export function summarizeEvaluation(runs: EvaluationRun[]) {
  const firstPass = runs.filter(r => r.body.narration_status === "available" && r.attempts === 1).length;
  const unavailable = runs.filter(r => r.body.narration_status === "unavailable").length;
  const reasons: Record<string, number> = {
    none: 0, INVALID_NARRATION: 0, LLM_PROVIDER_FAILURE: 0,
    NARRATION_DAILY_CAP_REACHED: 0, LLM_NOT_CONFIGURED: 0,
    LLM_CONFIGURATION: 0, NARRATION_CAP_CONFIGURATION: 0, NARRATION_FAILED: 0,
  };
  for (const r of runs) reasons[r.body.narration_reason ?? "none"]!++;
  return {
    requests: runs.length,
    first_attempt_passes: firstPass,
    first_attempt_pass_rate: runs.length ? firstPass / runs.length : 0,
    final_unavailable: unavailable,
    final_unavailable_rate: runs.length ? unavailable / runs.length : 0,
    narration_reason_counts: reasons,
    provider_attempts: runs.reduce((n, r) => n + r.attempts, 0),
    cases: evaluationCases.filter(c => runs.some(r => r.case_id === c.case_id)).map(c => {
      const records = runs.filter(r => r.case_id === c.case_id);
      return {
        case_id: c.case_id, ...c.input, runs: records.length,
        first_pass: records.filter(r => r.body.narration_status === "available" && r.attempts === 1).length,
        unavailable: records.filter(r => r.body.narration_status === "unavailable").length,
      };
    }),
  };
}
