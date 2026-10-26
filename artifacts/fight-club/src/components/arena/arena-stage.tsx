import type { Animal, Beat } from "@workspace/api-client-react";
import { AnimalFigure, bodyTypeFor } from "./animal-figure";
import { actionLine, cubeRootScale, TERRAINS, type Env, type Mode, type Side } from "@/lib/arena";

type Pose = { x: number; y: number; r: number; o: number };
const REST: Pose = { x: 0, y: 0, r: 0, o: 1 };

/** Offsets are toward the opponent (positive x) for whichever side is posed. */
export function poseFor(beat: Beat | null, side: Side, actorSide: Side | null, mode: Mode): Pose {
  if (!beat || actorSide === null) return REST;
  const actor = side === actorSide;
  switch (beat.action) {
    case "approach": return actor ? { ...REST, x: 50 } : REST;
    case "charge": return actor ? { ...REST, x: 130, r: -4 } : { ...REST, x: -10 };
    case "dodge": return actor ? { ...REST, x: -40, y: -40, r: -8 } : REST;
    case "bite": return actor ? { ...REST, x: 100, y: -10, r: -5 } : { ...REST, x: -12, r: 4 };
    case "grapple": return { ...REST, x: 95, r: actor ? -6 : 3 };
    case "retreat": return actor ? { ...REST, x: -90 } : { ...REST, x: 20 };
    case "finish":
      if (actor) return { ...REST, x: 110, r: -3 };
      return mode === "forced_fight" ? { x: -10, y: 18, r: -78, o: 0.85 } : { ...REST, x: -140, o: 0.7 };
  }
}

export type Phase = "approach" | "contact" | "recoil" | "settle" | "hold";
export const PHASES: Phase[] = ["approach", "contact", "recoil", "settle"];

/** Each beat plays as four distinct moments built from its contact pose. */
export function phasePose(beat: Beat | null, side: Side, actorSide: Side | null, mode: Mode, phase: Phase): Pose {
  const p = poseFor(beat, side, actorSide, mode);
  if (!beat || actorSide === null) return p;
  const actor = side === actorSide;
  const ends = beat.action === "retreat" || beat.action === "finish";
  switch (phase) {
    case "approach": return actor || beat.action === "grapple" ? { ...REST, x: Math.round(p.x * 0.55) } : REST;
    case "contact": return p;
    case "recoil":
      if (beat.action === "finish" && !actor) return p;
      return { ...p, x: Math.round(p.x * 0.75) - (actor ? 0 : 14), r: Math.round(p.r * 0.5) };
    case "settle":
    case "hold":
      return ends ? p : { ...REST, x: Math.round(p.x * 0.35) };
  }
}

function transformFor(p: Pose, side: Side): string {
  const dir = side === "red" ? 1 : -1;
  return `translate(${p.x * dir}px, ${p.y}px) rotate(${p.r * dir}deg)`;
}

/** Shallow water surface and figure footing, as % of stage height. Water sits above the figures. */
export const SHALLOW_SURFACE = 40;
export const SHALLOW_FOOT = 22;
// Reference staging floods 190px of a 280px arena, leaving the upper arches visible.
export const OCEAN_SURFACE = 68;
/** Share of the croc's own SVG height (back and eyes at y 88-94 of 140) dropped below the surface. */
export const CROC_SINK = 34;

function footFor(floor: string, submergedCroc: boolean): string {
  // A submerged croc's box bottom sits on the surface; the nested offset sinks it by a share of its own height.
  if (floor === "shallows") return submergedCroc ? `${SHALLOW_SURFACE}%` : `${SHALLOW_FOOT}%`;
  if (floor === "ocean") return submergedCroc ? `${OCEAN_SURFACE}%` : "34%";
  return "28%";
}

export function ArenaStage({ red, blue, environment, mode, beat, reducedMotion, phase = "contact", paused = false, holding = false }: {
  red: Animal; blue: Animal; environment: Env; mode: Mode; beat: Beat | null; reducedMotion: boolean;
  phase?: Phase; paused?: boolean; holding?: boolean;
}) {
  const floor = TERRAINS[environment].floor;
  const [rs, bs] = cubeRootScale(red.mass_kg, blue.mass_kg);
  const actorSide: Side | null = beat?.animal == null ? null
    : beat.animal === red.name ? "red" : beat.animal === blue.name ? "blue" : null;
  const fighters: [Side, Animal, number][] = [["red", red, rs], ["blue", blue, bs]];

  return (
    <div className={`stage${reducedMotion ? " reduced-motion" : ""}${paused ? " paused" : ""}`} data-testid="arena-stage" data-floor={floor}
      data-phase={phase}
      role="img" aria-label={`${red.name} and ${blue.name} on the ${TERRAINS[environment].name} floor`}>
      <svg aria-hidden="true" viewBox="0 0 1200 230" preserveAspectRatio="xMidYMax slice"
        style={{ position: "absolute", left: 0, top: 0, width: "100%", height: "54%" }}>
        <rect x="0" y="0" width="1200" height="230" fill="#2B221B" />
        <rect x="0" y="0" width="1200" height="14" fill="#3A2E25" />
        <rect x="0" y="48" width="1200" height="6" fill="#3A2E25" />
        {Array.from({ length: 10 }, (_, i) => (
          <path key={i} d={`M${20 + i * 120} 230 V140 a40 40 0 0 1 80 0 V230 Z`} fill="#1A1410" />
        ))}
      </svg>

      {floor === "sand" && <div aria-hidden="true" className="stage-floor floor-sand" data-testid="floor-sand" />}
      {floor === "shallows" && <>
        <div aria-hidden="true" className="stage-floor floor-shallows-bed" />
        <svg aria-hidden="true" viewBox="0 0 400 60" preserveAspectRatio="none"
          style={{ position: "absolute", left: 0, bottom: `${SHALLOW_SURFACE - 6}%`, width: "100%", height: 60, zIndex: 1 }}>
          <path d="M30 60 V18 M38 60 V26 M46 60 V12 M354 60 V20 M362 60 V10 M370 60 V28" stroke="#6E8A4A" strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
        <div aria-hidden="true" className="stage-floor floor-shallows-water" data-testid="floor-shallows"
          style={{ height: `${SHALLOW_SURFACE}%`, zIndex: 3 }} />
      </>}
      {floor === "ocean" && <>
        <div aria-hidden="true" className="stage-floor floor-ocean" data-testid="floor-ocean" style={{ height: `${OCEAN_SURFACE}%` }} />
        <div aria-hidden="true" className="stage-floor floor-ocean-veil" data-testid="floor-ocean-veil" style={{ height: `${OCEAN_SURFACE}%`, zIndex: 3 }} />
        <svg aria-hidden="true" viewBox="0 0 400 120" preserveAspectRatio="none"
          style={{ position: "absolute", left: 0, bottom: 20, width: "100%", height: 120 }}>
          <path d="M20 30 q20 -10 40 0 t40 0 M240 50 q20 -10 40 0 t40 0 M110 90 q20 -10 40 0 t40 0" stroke="#4E8597" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </>}

      {holding
        ? <div className="banner banner-hold pop" data-testid="text-verdict-hold" role="status">The verdict is in</div>
        : beat && <div key={actionLine(beat) + beat.text} className="banner pop" data-testid="text-action-banner">{actionLine(beat)}</div>}

      {fighters.map(([side, animal, scale]) => {
        const pose = phasePose(beat, side, actorSide, mode, phase);
        const croc = bodyTypeFor(animal).type === "reptile";
        const submerged = croc && floor !== "sand";
        return (
          <div key={side} className={`fighter fighter-${side}${submerged ? " submerged" : ""}`} data-testid={`figure-${side}`}
            data-scale={scale.toFixed(3)} data-motion={reducedMotion ? "reduced" : "full"} data-submerged={submerged ? "true" : "false"}
            style={{
              bottom: footFor(floor, submerged), zIndex: 2, width: `${Math.round(36 * scale * 10) / 10}%`, minWidth: 64, maxWidth: 400,
              transform: reducedMotion ? undefined : transformFor(pose, side),
              opacity: reducedMotion ? undefined : pose.o,
            }}>
            <div className={floor === "ocean" && !reducedMotion ? "bob" : undefined} data-testid={`bob-${side}`}>
              {submerged
                ? <div className="croc-offset" data-testid={`croc-offset-${side}`} style={{ transform: `translateY(${CROC_SINK}%)` }}>
                    <AnimalFigure animal={animal} facing={side === "red" ? "right" : "left"} />
                  </div>
                : <AnimalFigure animal={animal} facing={side === "red" ? "right" : "left"} />}
            </div>
          </div>
        );
      })}
    </div>
  );
}
