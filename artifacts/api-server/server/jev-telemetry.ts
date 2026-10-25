import { z } from "zod";

export const JevBeatScoreSchema = z.object({
  beat_index: z.number().int().nonnegative(),
  text: z.string(),
  unsupported_reason_probability: z.number().min(0).max(1),
  contradictory_winner_probability: z.number().min(0).max(1),
});
export const JevReportSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("scored"), beats: z.array(JevBeatScoreSchema).min(1).max(8) }),
  z.object({ status: z.literal("failed"), reason: z.literal("failed_or_timed_out") }),
  z.object({ status: z.literal("not_scored") }),
]);
export type JevReport = z.infer<typeof JevReportSchema>;

type Record = { case_id: number; run: number; jev_shadow?: JevReport };
export function summarizeJev(records: Record[]) {
  const questions = [
    "unsupported_reason_probability", "contradictory_winner_probability",
  ] as const;
  return {
    narrations_scored: records.filter(r => r.jev_shadow?.status === "scored").length,
    calls_failed_or_timed_out: records.filter(r => r.jev_shadow?.status === "failed").length,
    not_scored: records.filter(r => r.jev_shadow?.status === "not_scored").length,
    missing_telemetry: records.filter(r => !r.jev_shadow).length,
    questions: questions.map(question => {
      const scores = records.flatMap(record => record.jev_shadow?.status === "scored"
        ? record.jev_shadow.beats.map(beat => ({
          case_id: record.case_id, run: record.run, beat_index: beat.beat_index,
          text: beat.text, probability: beat[question],
        })) : []);
      return {
        question, beats_scored: scores.length,
        above_0_5: scores.filter(s => s.probability > 0.5).length,
        above_0_7: scores.filter(s => s.probability > 0.7).length,
        above_0_9: scores.filter(s => s.probability > 0.9).length,
        examples: scores.filter(s => s.probability > 0.5)
          .sort((a, b) => b.probability - a.probability).slice(0, 5),
      };
    }),
  };
}
