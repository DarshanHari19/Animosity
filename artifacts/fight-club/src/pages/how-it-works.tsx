import { useEffect } from "react";
import { Link } from "wouter";
import { ArcadeBand } from "@/components/arena/arcade-band";

export const HOW_TITLE = "How it works · Animosity";
export const HOW_DESCRIPTION =
  "How Animosity decides who is favored: body mass, arena floor and comparable bite force, with every number traced to a cited source.";

function setMeta(attr: "name" | "property", key: string, value: string): () => void {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  const created = !el;
  const prev = el?.getAttribute("content") ?? null;
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", value);
  const node = el;
  return () => {
    if (created) node.remove();
    else if (prev !== null) node.setAttribute("content", prev);
  };
}

function usePageMeta() {
  useEffect(() => {
    const prevTitle = document.title;
    document.title = HOW_TITLE;
    const undo = [
      setMeta("name", "description", HOW_DESCRIPTION),
      setMeta("property", "og:title", HOW_TITLE),
      setMeta("property", "og:description", HOW_DESCRIPTION),
      setMeta("property", "og:type", "article"),
    ];
    return () => {
      document.title = prevTitle;
      undo.reverse().forEach((f) => f());
    };
  }, []);
}

const RUNS: [number, string][] = [
  [1, "23.3%"], [2, "18.3%"], [3, "11.7%"], [4, "10.0%"], [5, "0.0%"], [6, "1.7%"], [7, "0.0%"],
];

export default function HowItWorks() {
  usePageMeta();
  return (
    <div className="page">
      <ArcadeBand />
      <div className="wrap wrap-narrow">
        <header className="enter" style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 16 }}>
          <Link href="/" className="display" style={{ fontWeight: 700, fontSize: "clamp(28px, 6vw, 38px)", letterSpacing: ".12em", lineHeight: 1, color: "var(--text)", textDecoration: "none" }} data-testid="link-brand-home">ANIMOSITY</Link>
          <nav aria-label="Main" style={{ fontSize: 15, fontWeight: 500 }}>
            <Link href="/" data-testid="link-back-picker">Back to the arena</Link>
          </nav>
        </header>

        <section className="hiw-section enter enter-1">
          <div className="eyebrow">The method</div>
          <h1 className="display" style={{ margin: 0, fontSize: "clamp(32px, 7vw, 48px)", fontWeight: 700, lineHeight: 1.1 }} data-testid="text-how-title">How it works</h1>
          <p>Code picks the favorite. Words come after. Here is exactly what gets counted, what does not, and where every number comes from.</p>
        </section>

        <section className="hiw-section" aria-labelledby="h-verdict" data-testid="section-verdict">
          <h2 id="h-verdict">How the verdict is decided</h2>
          <p>Three things are scored:</p>
          <ul>
            <li><strong>Body mass.</strong> Heavier usually matters most.</li>
            <li><strong>Environment.</strong> How well each animal can operate on the chosen floor: land, shallow water or deep water.</li>
            <li><strong>Bite force</strong>, but only when both numbers come from the same source tier (and neither is missing) and were measured at the same kind of tooth. Otherwise it is shown but not scored.</li>
          </ul>
          <p>Mass is compared with this formula:</p>
          <div className="formula" data-testid="text-formula">0.8 × log2(mass A / mass B)</div>
          <p>In plain terms: every time A is twice as heavy as B, A gains 0.8 points. Four times as heavy is two doublings, so 1.6 points. Equal weights give zero. Being half as heavy costs the same 0.8.</p>
          <p>All the scored parts are added into one combined score. If it is +0.5 or higher, A is favored. If it is -0.5 or lower, B is favored. Anything strictly in between is called too close to call. The score is not a win probability.</p>
          <p>Two rules can override the score entirely. An environmental "cannot" means one animal simply cannot fight on that floor (a land animal in deep water, for example), so the outcome is decided by that, not by mass. In the "In the wild" mode, the engine can also decide that one or both animals would back off instead of fighting, and then no fight is staged.</p>
        </section>

        <section className="hiw-section" aria-labelledby="h-example" data-testid="section-example">
          <h2 id="h-example">Worked example: Hippo vs Lion on land</h2>
          <div className="panel table-scroll" style={{ padding: 4 }}>
            <table className="hiw-table">
              <thead><tr><th>Trait</th><th className="red">Hippo</th><th className="blue">Lion</th></tr></thead>
              <tbody>
                <tr><td>Mass</td><td data-testid="text-example-hippo-mass">1354 kg</td><td data-testid="text-example-lion-mass">188 kg</td></tr>
                <tr><td>Land</td><td className="tone-full">Full</td><td className="tone-full">Full</td></tr>
                <tr><td>Bite force</td><td>No reliable source</td><td>Cited</td></tr>
              </tbody>
            </table>
          </div>
          <div className="formula" data-testid="text-example-formula">0.8 × log2(1354 / 188)</div>
          <p>The hippo is a little under three doublings heavier than the lion, which puts the mass score well past +0.5. Both are fully at home on land, so the floor adds nothing either way. The hippo's bite has no reliable source, so bite is not compared at all. Result: <strong data-testid="text-example-result">Hippo favored</strong>.</p>
        </section>

        <section className="hiw-section" aria-labelledby="h-not" data-testid="section-not-scored">
          <h2 id="h-not">What is not scored</h2>
          <p>Claws, horns, hide, speed, fighting style and venom do not add points. They are real, but there is no fair, sourced way to put them on one scale yet. Fighting style does shape how the fight is narrated, and it can influence whether an animal backs off in the "In the wild" mode, but it is never a scored strength.</p>
        </section>

        <section className="hiw-section" aria-labelledby="h-tiers" data-testid="section-tiers">
          <h2 id="h-tiers">Where the numbers come from</h2>
          <p>Each trait has one of four source tiers:</p>
          <div className="tier-grid">
            <div className="panel"><span className="tag" style={{ alignSelf: "flex-start" }}>Tier 1</span><strong>Measured</strong><span className="muted">Real animals, measured, in peer-reviewed work. Example: hippo mass, Meireles 2025, Table 2.</span></div>
            <div className="panel"><span className="tag" style={{ alignSelf: "flex-start" }}>Tier 2</span><strong>Modeled</strong><span className="muted">Estimated by a model in peer-reviewed work. Example: lion bite force, Christiansen &amp; Wroe 2007, Table 1.</span></div>
            <div className="panel"><span className="tag" style={{ alignSelf: "flex-start" }}>Tier 3</span><strong>Reference</strong><span className="muted">A reference summary not traced to a primary study. Example: lion length, Wikipedia.</span></div>
            <div className="panel"><span className="tag" style={{ alignSelf: "flex-start" }}>No tier</span><strong>No reliable source</strong><span className="muted">Left empty rather than guessed. Example: hippo bite force.</span></div>
          </div>
          <p>Two numbers in the same tier are not proof they were made the same way. Matching tiers is a minimum bar, not a guarantee.</p>
        </section>

        <section className="hiw-section" aria-labelledby="h-myths" data-testid="section-myths">
          <h2 id="h-myths">Popular numbers we do not use</h2>
          <ul>
            <li><strong>The 5,500 N lion bite.</strong> A viral press figure from one skull at a back tooth. It is not a representative canine measurement. The current lion canine figure used here is 1,315 N, and the two are never mixed.</li>
            <li><strong>The 1,800 psi hippo bite.</strong> It came from a TV segment and was later repeated in papers without a new measurement. That is why the hippo's bite has no reliable source.</li>
          </ul>
        </section>

        <section className="hiw-section" aria-labelledby="h-story" data-testid="section-story">
          <h2 id="h-story">How the fight story is written</h2>
          <ol>
            <li>The engine picks the favorite and writes the verdict first.</li>
            <li>AI writes only the physical action and the climax.</li>
            <li>Every line the model writes must cite the facts it uses. Code rejects lines with made-up numbers, the wrong winner, or reasons that were not scored.</li>
            <li>If the story fails, the verdict is still shown. A failed story never hides it.</li>
            <li>A separate AI judge reviews story quality as a monitor only. It never decides who wins.</li>
          </ol>
        </section>

        <section className="hiw-section" aria-labelledby="h-reliability" data-testid="section-reliability">
          <h2 id="h-reliability">Reliability record</h2>
          <p>Share of fights where the story could not be shown, across seven sequential test runs of 75 fights each.</p>
          <div className="panel table-scroll" style={{ padding: 4 }}>
            <table className="hiw-table" data-testid="table-reliability">
              <thead><tr><th>Run</th><th>Story unavailable</th></tr></thead>
              <tbody>
                {RUNS.map(([run, rate]) => (
                  <tr key={run} data-testid={`row-run-${run}`}><td>{run}</td><td>{rate}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="muted">These rates measure story unavailability, not verdict accuracy.</p>
        </section>

        <section className="hiw-section" aria-labelledby="h-assume" data-testid="section-assumptions">
          <h2 id="h-assume">Assumptions</h2>
          <ul>
            <li>The model assumes adult males.</li>
            <li>Every matchup is a hypothetical encounter.</li>
            <li>Environment levels are model assumptions, not measurements.</li>
            <li>Numeric traits come from different sources and populations. A profile does not necessarily describe one single individual.</li>
          </ul>
        </section>

        <div style={{ borderTop: "1px solid var(--stone-band)", paddingTop: 24 }}>
          <Link href="/" className="btn btn-primary" data-testid="link-start-bout">Pick your fighters</Link>
        </div>
      </div>
    </div>
  );
}
