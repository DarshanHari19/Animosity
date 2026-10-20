import type { BeatAction } from "@workspace/api-client-react";

type Pose = { x: number; lean: number; arms: string; legs: string; mouth?: boolean; down?: boolean };

// Poses drawn for a figure facing right; the right-side figure is mirrored.
function poseFor(action: BeatAction | null, isActor: boolean): Pose {
  const idle: Pose = { x: 0, lean: 0, arms: "M-14 0 L0 -8 L14 0", legs: "M-10 40 L0 15 L10 40" };
  if (!action) return idle;
  if (!isActor) {
    if (action === "finish") return { ...idle, x: -10, lean: -60, down: true };
    if (action === "grapple") return { ...idle, x: 25, arms: "M0 -8 L18 -12 L26 -4" };
    if (action === "bite" || action === "charge") return { ...idle, x: -10, lean: -15 };
    return idle;
  }
  switch (action) {
    case "approach":
      return { ...idle, x: 20, legs: "M-12 40 L0 15 L14 38" };
    case "charge":
      return { x: 45, lean: 25, arms: "M0 -8 L20 -4 L30 -6", legs: "M-18 36 L0 15 L16 40" };
    case "bite":
      return { x: 55, lean: 15, arms: "M-12 4 L0 -8 L12 4", legs: idle.legs, mouth: true };
    case "dodge":
      return { x: -20, lean: -25, arms: "M-18 -14 L0 -8 L10 4", legs: "M-14 40 L0 15 L4 40" };
    case "grapple":
      return { x: 40, lean: 10, arms: "M0 -8 L22 -14 L30 -6", legs: "M-14 40 L0 15 L12 40" };
    case "retreat":
      return { x: -30, lean: -10, arms: "M-16 6 L0 -8 L-4 8", legs: "M-16 38 L0 15 L6 40" };
    case "finish":
      return { x: 40, lean: 0, arms: "M-12 -20 L0 -8 L12 -20", legs: idle.legs };
  }
}

export function StickFigure({ side, label, action, isActor }: {
  side: "left" | "right"; label: string; action: BeatAction | null; isActor: boolean;
}) {
  const p = poseFor(action, isActor);
  const baseX = side === "left" ? 90 : 230;
  const flip = side === "right" ? -1 : 1;
  return (
    <g data-testid={`figure-${side}`}>
      <g transform={`translate(${baseX + flip * p.x} ${p.down ? 140 : 100}) scale(${flip} 1) rotate(${p.lean})`}>
        <circle cx={0} cy={-25} r={10} fill="none" stroke="currentColor" strokeWidth={2} />
        {p.mouth && <path d="M6 -24 L14 -22 L6 -20" fill="none" stroke="currentColor" strokeWidth={2} />}
        <line x1={0} y1={-15} x2={0} y2={15} stroke="currentColor" strokeWidth={2} />
        <path d={p.arms} fill="none" stroke="currentColor" strokeWidth={2} />
        <path d={p.legs} fill="none" stroke="currentColor" strokeWidth={2} />
      </g>
      <text x={baseX} y={175} textAnchor="middle" fontSize={12} fontWeight={isActor ? 700 : 400} fill="currentColor">{label}</text>
    </g>
  );
}
