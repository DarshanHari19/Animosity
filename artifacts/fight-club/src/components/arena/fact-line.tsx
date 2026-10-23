import { readFact } from "@/lib/arena";

/** A cited fact with its real source links; engine-derived facts are labeled as such. */
export function FactLine({ fact }: { fact: string }) {
  const f = readFact(fact);
  return (
    <span>
      {f.text}
      {f.links.length > 0
        ? f.links.map((l) => <span key={l.href}> · <a href={l.href} target="_blank" rel="noopener noreferrer">{l.label}</a></span>)
        : f.note ? <span> · {f.note}</span> : f.key === null ? <span> · Engine score</span> : null}
    </span>
  );
}
