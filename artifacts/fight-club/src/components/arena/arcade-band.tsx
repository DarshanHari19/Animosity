/** Stone arcade band of Colosseum arches, purely decorative. */
export function ArcadeBand({ height = 110, archFill = "#110D0A", viewH = 140 }: { height?: number; archFill?: string; viewH?: number }) {
  const top = viewH - 54;
  return (
    <svg aria-hidden="true" viewBox={`0 0 1200 ${viewH}`} preserveAspectRatio="xMidYMax slice"
      style={{ display: "block", width: "100%", height }}>
      <rect x="0" y="0" width="1200" height={viewH} fill="#2B221B" />
      <rect x="0" y="0" width="1200" height="16" fill="#3A2E25" />
      <rect x="0" y={Math.round(viewH * 0.29)} width="1200" height="6" fill="#3A2E25" />
      {Array.from({ length: 10 }, (_, i) => (
        <path key={i} d={`M${20 + i * 120} ${viewH} V${top} a40 40 0 0 1 80 0 V${viewH} Z`} fill={archFill} />
      ))}
    </svg>
  );
}
