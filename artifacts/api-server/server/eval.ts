import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { setTimeout as sleep } from "node:timers/promises";
import { z } from "zod";
import { AnimalSchema, fightResponseSchemaFor } from "./schemas";
import { evaluationCases, summarizeEvaluation, type EvaluationRun } from "./evaluation";

const healthSchema = z.object({ status: z.literal("ok"), build_id: z.string().min(1) });
const manifest = fileURLToPath(new URL("../dist/build-id.json", import.meta.url));
const root = fileURLToPath(new URL("../../../", import.meta.url));

async function main() {
  const { values } = parseArgs({ options: {
    scenarios: { type: "string" }, runs: { type: "string", default: "3" },
    "base-url": { type: "string" }, help: { type: "boolean" },
  } });
  if (values.help) {
    console.log("pnpm eval [--scenarios 1,2] [--runs 1] [--base-url https://your-dev-host]\nDefault: all 20 scenarios × 3 runs. Real provider calls; existing limits apply.");
    return;
  }
  const repeats = Number(values.runs);
  if (!Number.isInteger(repeats) || repeats < 1 || repeats > 3) throw Error("--runs must be 1, 2 or 3.");
  const selected = values.scenarios?.split(",").map(Number) ?? evaluationCases.map(c => c.case_id);
  if (!selected.length || new Set(selected).size !== selected.length ||
    selected.some(id => !Number.isInteger(id) || id < 1 || id > 20)) {
    throw Error("--scenarios must contain distinct IDs from 1 through 20.");
  }
  const cases = selected.map(id => evaluationCases[id - 1]!);
  const base = values["base-url"] ?? (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : "");
  if (!base) throw Error("Set --base-url to your running development server's origin.");
  const url = new URL(base);
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) throw Error("Invalid base URL.");
  const build = healthSchema.shape.build_id.parse(JSON.parse(fs.readFileSync(manifest, "utf8")).build_id);
  const checkBuild = async () => {
    const disk = JSON.parse(fs.readFileSync(manifest, "utf8")).build_id;
    const response = await fetch(new URL("/api/health", url), { cache: "no-store", signal: AbortSignal.timeout(15_000) });
    if (!response.ok) throw Error(`Health check failed: HTTP ${response.status}.`);
    const health = healthSchema.parse(await response.json());
    if (disk !== build || health.build_id !== build) throw Error("Build ID mismatch. STOPPED before the next fight; restart the API and rerun.");
  };
  await checkBuild();
  const animalResponse = await fetch(new URL("/api/animals", url), { signal: AbortSignal.timeout(15_000) });
  if (!animalResponse.ok) throw Error(`Animal catalog failed: HTTP ${animalResponse.status}.`);
  const animals = z.array(AnimalSchema).parse(await animalResponse.json());
  for (const c of cases) for (const name of [c.input.animalA, c.input.animalB]) {
    if (!animals.some(a => a.name === name)) throw Error(`Unknown scenario animal: ${name}`);
  }
  const directory = path.join(root, "generated-artifacts/narration-eval");
  fs.mkdirSync(directory, { recursive: true });
  const output = path.join(directory, `${new Date().toISOString().replaceAll(":", "-")}.json`);
  const runs: EvaluationRun[] = [];
  let previousStart = 0;
  let rateDeferrals = 0;
  console.log(`Build ${build}: ${cases.length} scenarios × ${repeats} runs. Requests paced at least 6.5 seconds apart.`);
  try {
    for (let repeat = 1; repeat <= repeats; repeat++) for (const c of cases) {
      for (let deferral = 0; ; deferral++) {
        await sleep(Math.max(0, 6500 - (Date.now() - previousStart)));
        await checkBuild(); // Before EVERY live fight, including transport retries.
        previousStart = Date.now();
        const started = new Date().toISOString();
        const response = await fetch(new URL("/api/fight", url), {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(c.input), signal: AbortSignal.timeout(80_000),
        });
        if (response.status === 429 && deferral < 2) {
          const retry = Number(response.headers.get("Retry-After") ?? "60");
          if (!Number.isFinite(retry) || retry < 0) throw Error("Invalid Retry-After header.");
          await response.body?.cancel();
          rateDeferrals++;
          await sleep(Math.max(1000, retry * 1000));
          continue;
        }
        if (response.status !== 200) throw Error(`Case ${c.case_id}: HTTP ${response.status}; evaluation stopped.`);
        const a = animals.find(a => a.name === c.input.animalA)!;
        const b = animals.find(a => a.name === c.input.animalB)!;
        const body = fightResponseSchemaFor(a, b).parse(await response.json());
        if (body.narration_status === "not_required") throw Error(`Case ${c.case_id} is no longer narrated; stopped rather than inflate pass rates.`);
        const count = response.headers.get("X-Narration-Attempts");
        if (count === null || !/^[012]$/.test(count) || (body.narration_status === "available" && count === "0")) {
          throw Error("Missing/invalid attempt telemetry; restart the current API. Pass rate was not guessed from logs.");
        }
        runs.push({ case_id: c.case_id, run: repeat, attempts: Number(count), started,
          finished: new Date().toISOString(), body });
        console.log(`Case ${c.case_id}, run ${repeat}: ${body.narration_status}; calls=${count}; reason=${body.narration_reason ?? "null"}`);
        fs.writeFileSync(output, JSON.stringify({ build_id: build, rate_deferrals: rateDeferrals,
          summary: summarizeEvaluation(runs), runs }, null, 2));
        break;
      }
    }
  } finally {
    const summary = summarizeEvaluation(runs);
    console.table([
      { metric: "First-attempt pass", count: `${summary.first_attempt_passes}/${summary.requests}`, rate: `${(summary.first_attempt_pass_rate * 100).toFixed(1)}%` },
      { metric: "Final unavailable", count: `${summary.final_unavailable}/${summary.requests}`, rate: `${(summary.final_unavailable_rate * 100).toFixed(1)}%` },
    ]);
    console.table(Object.entries(summary.narration_reason_counts).map(([reason, count]) => ({ narration_reason: reason === "none" ? "null" : reason, count })));
    console.table(summary.cases.map(c => ({
      id: c.case_id, matchup: `${c.animalA} vs ${c.animalB}`, environment: c.environment, mode: c.mode,
      "First-pass": `${c.first_pass}/${c.runs}`, Unavailable: `${c.unavailable}/${c.runs}`,
    })));
    console.log(`${summary.provider_attempts} provider calls; ${rateDeferrals} rate-limit deferrals. Saved ${output}`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error instanceof Error ? error.message : "Evaluation failed."); process.exitCode = 1; });
}
