import type { Animal } from "@workspace/api-client-react";

export type BodyType = "cat" | "bear" | "ape" | "heavy" | "reptile" | "shark";
type Palette = { body: string; dark: string; accent: string };
/** Explicit drawing variant layered on top of a base body type; null = original seven figures. */
export type FigureVariant = "tiger" | "polar_bear" | "elephant" | "orca" | "komodo" | null;

const PALETTES: Record<string, Palette> = {
  lion: { body: "#C9A066", dark: "#9E7A45", accent: "#6E4A26" },
  bear: { body: "#7A5233", dark: "#5C3B22", accent: "#B08A5E" },
  crocodile: { body: "#6F7A4A", dark: "#525C34", accent: "#A3A770" },
  gorilla: { body: "#4C4744", dark: "#36312E", accent: "#8C7F74" },
  hippo: { body: "#8A6E78", dark: "#6B5560", accent: "#C79AA0" },
  shark: { body: "#7E8E99", dark: "#5E6D78", accent: "#E3DCCD" },
  rhino: { body: "#8C8478", dark: "#6A6358", accent: "#D8CDB6" },
  tiger: { body: "#D9822B", dark: "#2A1E16", accent: "#F2E6D0" },
  polar_bear: { body: "#F1EEE6", dark: "#D3CEC2", accent: "#2A2522" },
  elephant: { body: "#8F8A84", dark: "#6E6963", accent: "#EFE6D2" },
  orca: { body: "#1E2226", dark: "#121518", accent: "#F2EFE8" },
  komodo: { body: "#4E4A3C", dark: "#38352A", accent: "#7D7560" },
};
const FALLBACK: Record<BodyType, Palette> = {
  cat: PALETTES.lion!, bear: PALETTES.bear!, ape: PALETTES.gorilla!,
  heavy: PALETTES.hippo!, reptile: PALETTES.crocodile!, shark: PALETTES.shark!,
};
const EYE = "#16110D";

type FigureSpec = { type: BodyType; horn: boolean; mane: boolean; palette: Palette; variant: FigureVariant };

export function bodyTypeFor(animal: Pick<Animal, "name" | "primary_weapon">): FigureSpec {
  const n = animal.name.toLowerCase();
  const pick = (type: BodyType, key?: string, horn = false, mane = false, variant: FigureVariant = null): FigureSpec =>
    ({ type, horn, mane, palette: (key && PALETTES[key]) || FALLBACK[type], variant });
  if (n.includes("rhino")) return pick("heavy", "rhino", true);
  if (n.includes("hippo")) return pick("heavy", "hippo");
  if (n.includes("elephant")) return pick("heavy", "elephant", false, false, "elephant");
  if (n.includes("lion")) return pick("cat", "lion", false, true);
  if (n.includes("tiger")) return pick("cat", "tiger", false, false, "tiger");
  if (/(leopard|jaguar|cat|cougar|cheetah)/.test(n)) return pick("cat");
  if (n.includes("polar bear")) return pick("bear", "polar_bear", false, false, "polar_bear");
  if (n.includes("bear")) return pick("bear", "bear");
  if (/(gorilla|ape|chimp|orangutan)/.test(n)) return pick("ape", "gorilla");
  if (n.includes("komodo")) return pick("reptile", "komodo", false, false, "komodo");
  if (/(crocodile|alligator|caiman|lizard|dragon)/.test(n)) return pick("reptile", "crocodile");
  if (n.includes("orca") || n.includes("killer whale")) return pick("shark", "orca", false, false, "orca");
  if (/(shark|whale|dolphin)/.test(n)) return pick("shark", "shark");
  if (animal.primary_weapon === "horns" || animal.primary_weapon === "tusks") return pick("heavy");
  return pick("cat");
}

/** Tiger: the base cat with dark stripes over body, legs and head. */
function TigerShapes({ p }: { p: Palette }) {
  return <>
    <Shapes type="cat" horn={false} mane={false} p={p} />
    <g data-part="stripes" fill="none" stroke={p.dark} strokeWidth="3.5" strokeLinecap="round">
      <path d="M70 58 q4 12 -2 22 M88 54 q5 14 -1 26 M106 53 q5 15 0 28 M124 53 q5 15 0 28 M142 55 q4 14 -1 25 M158 60 q3 10 -2 18" />
      <path d="M60 100 h12 M60 114 h12 M161 100 h13 M161 114 h13" />
      <path d="M186 50 q4 5 2 10 M196 48 q3 6 0 11" />
    </g>
    <ellipse cx="212" cy="77" rx="9" ry="5" fill={p.accent} />
  </>;
}

/** African bush elephant: heavy body, big ear, trunk and tusks. */
function ElephantShapes({ p }: { p: Palette }) {
  return <>
    <path d="M22 62 q-10 10 -8 26" fill="none" stroke={p.dark} strokeWidth="4" strokeLinecap="round" />
    <ellipse cx="104" cy="66" rx="84" ry="48" fill={p.body} />
    <rect x="40" y="90" width="26" height="48" rx="8" fill={p.body} />
    <rect x="72" y="96" width="22" height="42" rx="7" fill={p.dark} />
    <rect x="128" y="96" width="22" height="42" rx="7" fill={p.dark} />
    <rect x="156" y="90" width="26" height="48" rx="8" fill={p.body} />
    <circle cx="194" cy="52" r="28" fill={p.body} />
    <path d="M176 28 q-26 6 -22 40 q8 18 26 12 Z" fill={p.dark} data-part="ear" />
    <path d="M212 60 q18 20 10 52 q-2 14 8 18" fill="none" stroke={p.body} strokeWidth="12" strokeLinecap="round" data-part="trunk" />
    <path d="M206 72 q20 14 30 4" fill="none" stroke={p.accent} strokeWidth="5" strokeLinecap="round" data-part="tusk" />
    <circle cx="203" cy="46" r="3" fill={EYE} />
  </>;
}

/** Orca: marine body, tall dorsal fin, black with white eye patch and belly. */
function OrcaShapes({ p }: { p: Palette }) {
  return <>
    <path d="M30 76 L4 50 L12 78 L4 104 Z" fill={p.dark} />
    <path d="M104 52 L114 0 L140 54 Z" fill={p.body} data-part="dorsal-fin" />
    <path d="M22 74 Q100 34 196 54 Q238 66 238 80 Q204 104 112 102 Q60 100 22 82 Z" fill={p.body} />
    <path d="M70 92 Q140 106 222 84 Q180 106 70 96 Z" fill={p.accent} />
    <ellipse cx="196" cy="62" rx="12" ry="5" fill={p.accent} data-part="eye-patch" />
    <path d="M150 94 Q140 122 168 110 Z" fill={p.dark} />
    <path d="M90 66 q20 -8 34 2 q-16 6 -34 -2 Z" fill="#8E949A" opacity="0.6" />
  </>;
}

function VariantShapes({ variant, p }: { variant: Exclude<FigureVariant, null>; p: Palette }) {
  switch (variant) {
    case "tiger": return <TigerShapes p={p} />;
    case "polar_bear": return <Shapes type="bear" horn={false} mane={false} p={p} />;
    case "elephant": return <ElephantShapes p={p} />;
    case "orca": return <OrcaShapes p={p} />;
    // Komodo: base reptile (keeps animated croc-tail) scaled shorter about its ground line.
    case "komodo": return <g data-part="komodo-body" transform="translate(30 30) scale(0.82 0.78)"><Shapes type="reptile" horn={false} mane={false} p={p} /></g>;
  }
}

function Shapes({ type, horn, mane, p }: { type: BodyType; horn: boolean; mane: boolean; p: Palette }) {
  switch (type) {
    case "cat": return <>
      <path d="M44 70 q-30 -6 -27 -38" fill="none" stroke={p.body} strokeWidth="6" strokeLinecap="round" />
      <circle cx="17" cy="32" r="7" fill={p.accent} />
      <ellipse cx="110" cy="80" rx="66" ry="27" fill={p.body} />
      <rect x="58" y="88" width="15" height="50" rx="6" fill={p.body} />
      <rect x="78" y="92" width="14" height="46" rx="6" fill={p.dark} />
      <rect x="140" y="92" width="14" height="46" rx="6" fill={p.dark} />
      <rect x="160" y="88" width="15" height="50" rx="6" fill={p.body} />
      {mane && <circle cx="184" cy="60" r="34" fill={p.accent} />}
      <ellipse cx="194" cy="64" rx="21" ry="20" fill={p.body} />
      <ellipse cx="212" cy="74" rx="13" ry="9" fill={p.body} />
      <circle cx="186" cy="45" r="5" fill={p.body} />
      <circle cx="203" cy="59" r="2.8" fill={EYE} />
    </>;
    case "bear": return <>
      <circle cx="30" cy="68" r="7" fill={p.dark} />
      <ellipse cx="108" cy="80" rx="78" ry="36" fill={p.body} />
      <ellipse cx="138" cy="56" rx="42" ry="26" fill={p.body} />
      <rect x="42" y="92" width="26" height="46" rx="9" fill={p.body} />
      <rect x="74" y="98" width="22" height="40" rx="8" fill={p.dark} />
      <rect x="136" y="98" width="22" height="40" rx="8" fill={p.dark} />
      <rect x="162" y="92" width="26" height="46" rx="9" fill={p.body} />
      <circle cx="184" cy="44" r="8" fill={p.dark} />
      <circle cx="204" cy="44" r="8" fill={p.dark} />
      <circle cx="196" cy="68" r="26" fill={p.body} />
      <ellipse cx="220" cy="78" rx="15" ry="11" fill={p.accent} />
      <circle cx="233" cy="76" r="3.5" fill={EYE} />
      <circle cx="202" cy="61" r="3" fill={EYE} />
    </>;
    case "ape": return <>
      <rect x="62" y="88" width="22" height="50" rx="9" fill={p.body} />
      <rect x="86" y="96" width="18" height="42" rx="8" fill={p.dark} />
      <ellipse cx="118" cy="70" rx="58" ry="40" fill={p.body} transform="rotate(-14 118 70)" />
      <rect x="128" y="66" width="20" height="72" rx="9" fill={p.dark} />
      <rect x="152" y="60" width="25" height="78" rx="10" fill={p.body} />
      <ellipse cx="182" cy="20" rx="14" ry="8" fill={p.dark} />
      <circle cx="188" cy="40" r="24" fill={p.body} />
      <ellipse cx="198" cy="47" rx="13" ry="14" fill={p.accent} />
      <circle cx="200" cy="40" r="2.6" fill={EYE} />
    </>;
    case "heavy": return horn ? <>
      <path d="M16 70 q-12 4 -10 16" fill="none" stroke={p.dark} strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="106" cy="80" rx="88" ry="42" fill={p.body} />
      <rect x="38" y="104" width="24" height="34" rx="7" fill={p.body} />
      <rect x="70" y="108" width="20" height="30" rx="6" fill={p.dark} />
      <rect x="126" y="108" width="20" height="30" rx="6" fill={p.dark} />
      <rect x="154" y="104" width="24" height="34" rx="7" fill={p.body} />
      <path d="M176 52 l-6 -16 l14 10 Z" fill={p.body} />
      <ellipse cx="184" cy="74" rx="32" ry="24" fill={p.body} />
      <rect x="190" y="64" width="42" height="30" rx="12" fill={p.body} />
      <path d="M216 66 L230 24 L236 68 Z" fill={p.accent} data-part="horn" />
      <path d="M202 62 L208 44 L214 63 Z" fill={p.accent} />
      <circle cx="196" cy="68" r="3" fill={EYE} />
    </> : <>
      <path d="M14 66 q-12 4 -10 16" fill="none" stroke={p.dark} strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="108" cy="78" rx="90" ry="45" fill={p.body} />
      <rect x="38" y="104" width="24" height="34" rx="7" fill={p.body} />
      <rect x="70" y="108" width="20" height="30" rx="6" fill={p.dark} />
      <rect x="128" y="108" width="20" height="30" rx="6" fill={p.dark} />
      <rect x="156" y="104" width="24" height="34" rx="7" fill={p.body} />
      <ellipse cx="172" cy="62" rx="32" ry="27" fill={p.body} />
      <rect x="170" y="54" width="64" height="48" rx="22" fill={p.body} />
      <rect x="196" y="86" width="34" height="8" rx="4" fill={p.accent} />
      <circle cx="160" cy="36" r="7" fill={p.body} />
      <circle cx="176" cy="35" r="6" fill={p.body} />
      <circle cx="182" cy="52" r="3.5" fill={EYE} />
      <circle cx="224" cy="66" r="3" fill={p.dark} />
    </>;
    case "reptile": return <>
      <g className="croc-tail" data-part="tail">
        <path d="M6 108 Q50 92 80 94 L82 118 Q46 118 6 112 Z" fill={p.dark} />
      </g>
      <rect x="86" y="110" width="12" height="26" rx="5" fill={p.dark} transform="rotate(-12 92 122)" />
      <rect x="148" y="110" width="12" height="26" rx="5" fill={p.dark} transform="rotate(12 154 122)" />
      <ellipse cx="122" cy="104" rx="58" ry="17" fill={p.body} />
      <path d="M90 89 l6 -7 l6 7 M110 88 l6 -7 l6 7 M130 88 l6 -7 l6 7 M150 89 l6 -7 l6 7" fill="none" stroke={p.accent} strokeWidth="3" strokeLinejoin="round" />
      <path d="M170 94 L236 104 L236 111 L170 118 Z" fill={p.body} />
      <path d="M190 111 l4 4 l4 -4 l4 4 l4 -4 l4 4 l4 -4" fill="none" stroke={p.accent} strokeWidth="2" />
      <circle cx="178" cy="93" r="6.5" fill={p.body} />
      <circle cx="179" cy="92" r="2.4" fill={EYE} />
    </>;
    case "shark": return <>
      <path d="M30 76 L4 34 L16 76 L4 116 Z" fill={p.dark} />
      <path d="M108 46 L126 8 L150 50 Z" fill={p.body} />
      <path d="M22 74 Q100 30 202 58 Q238 70 238 76 Q204 98 112 100 Q60 98 22 82 Z" fill={p.body} />
      <path d="M60 88 Q132 104 214 82 Q166 102 60 93 Z" fill={p.accent} />
      <path d="M152 92 L132 126 L176 96 Z" fill={p.dark} />
      <path d="M178 68 v14 M184 67 v14 M190 66 v14" stroke={p.dark} strokeWidth="2" strokeLinecap="round" />
      <circle cx="208" cy="66" r="2.6" fill={EYE} />
    </>;
  }
}

/** Original six-body-type silhouettes, drawn facing right; mirrored for the blue corner. */
export function AnimalFigure({ animal, facing = "right", testId }: {
  animal: Pick<Animal, "name" | "primary_weapon">; facing?: "left" | "right"; testId?: string;
}) {
  const t = bodyTypeFor(animal);
  return (
    <svg role="img" aria-label={animal.name} viewBox="0 0 240 140" data-testid={testId} data-body={t.type} data-variant={t.variant ?? undefined}
      style={{ display: "block", width: "100%", height: "auto", overflow: "visible" }}>
      <g transform={facing === "left" ? "translate(240 0) scale(-1 1)" : undefined}>
        {t.variant
          ? <VariantShapes variant={t.variant} p={t.palette} />
          : <Shapes type={t.type} horn={t.horn} mane={t.mane} p={t.palette} />}
      </g>
    </svg>
  );
}
