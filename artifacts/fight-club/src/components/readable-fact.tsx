/** Only turn http(s) source references into links; never render arbitrary HTML. */
export function ReadableFact({ fact }: { fact: string }) {
  const trait = /^(.*?) \[tier ([123]); (.*)\]$/.exec(fact);
  if (!trait) return <span>{fact}</span>;
  const [, description, tier, reference] = trait;
  let url: URL | null = null;
  try {
    const parsed = new URL(reference!);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") url = parsed;
  } catch { /* A bibliographic reference need not be a URL. */ }
  return <span>{description} — {url
    ? <a className="underline" href={url.href} target="_blank" rel="noopener noreferrer" title={`Source tier ${tier}`}>
        Source ({url.hostname})
      </a>
    : <span title={`Source tier ${tier}`}>Source: {reference}</span>}
  </span>;
}
