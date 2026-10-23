import type { Animal, Beat } from "@workspace/api-client-react";
import { AnimalFigure } from "./animal-figure";
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

function transformFor(p: Pose, side: Side): string {
  const dir = side === "red" ? 1 : -1;
  return `translate(${p.x * dir}px, ${p.y}px) rotate(${p.r * dir}deg)`;
}

export function ArenaStage({ red, blue, environment, mode, beat, reducedMotion }: {
  red: Animal; blue: Animal; environment: Env; mode: Mode; beat: Beat | null; reducedMotion: boolean;
}) {
  const floor = TERRAINS[environment].floor;
  const [rs, bs] = cubeRootScale(red.mass_kg, blue.mass_kg);
  const actorSide: Side | null = beat?.animal == null ? null
    : beat.animal === red.name ? "red" : beat.animal === blue.name ? "blue" : null;
  const bottom = floor === "ocean" ? "34%" : "28%";
  const fighters: [Side, Animal, number][] = [["red", red, rs], ["blue", blue, bs]];

  return (
    <div className={`stage${reducedMotion ? " reduced-motion" : ""}`} data-testid="arena-stage" data-floor={floor}
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
          style={{ position: "absolute", left: 0, bottom: "30%", width: "100%", height: 60, zIndex: 1 }}>
          <path d="M30 60 V18 M38 60 V26 M46 60 V12 M354 60 V20 M362 60 V10 M370 60 V28" stroke="#6E8A4A" strokeWidth="3" strokeLinecap="round" fill="none" />
        </svg>
        <div aria-hidden="true" className="stage-floor floor-shallows-water" data-testid="floor-shallows" />
      </>}
      {floor === "ocean" && <>
        <div aria-hidden="true" className="stage-floor floor-ocean" data-testid="floor-ocean" />
        <svg aria-hidden="true" viewBox="0 0 400 120" preserveAspectRatio="none"
          style={{ position: "absolute", left: 0, bottom: 20, width: "100%", height: 120 }}>
          <path d="M20 30 q20 -10 40 0 t40 0 M240 50 q20 -10 40 0 t40 0 M110 90 q20 -10 40 0 t40 0" stroke="#4E8597" strokeWidth="2" fill="none" strokeLinecap="round" />
        </svg>
      </>}

      {beat && <div key={actionLine(beat) + beat.text} className="banner pop" data-testid="text-action-banner">{actionLine(beat)}</div>}

      {fighters.map(([side, animal, scale]) => {
        const pose = poseFor(beat, side, actorSide, mode);
        return (
          <div key={side} className={`fighter fighter-${side}`} data-testid={`figure-${side}`}
            data-scale={scale.toFixed(3)} data-motion={reducedMotion ? "reduced" : "full"}
            style={{
              bottom, width: `${Math.round(36 * scale * 10) / 10}%`, minWidth: 64, maxWidth: 400,
              transform: reducedMotion ? undefined : transformFor(pose, side),
              opacity: reducedMotion ? undefined : pose.o,
            }}>
            <div className={floor === "ocean" && !reducedMotion ? "bob" : undefined}>
              <AnimalFigure animal={animal} facing={side === "red" ? "right" : "left"} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
