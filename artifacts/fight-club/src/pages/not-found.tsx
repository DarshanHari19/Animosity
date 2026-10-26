import { Link } from 'wouter';
import { ArcadeBand } from '@/components/arena/arcade-band';
import { usePageMetadata } from '@/hooks/use-page-metadata';

export default function NotFound() {
  usePageMetadata('Page not found · Animosity', "This page isn't in the arena. Head back to Animosity and pick your next animal matchup.");

  return (
    <main className="page" style={{ display: 'flex', flexDirection: 'column' }}>
      <ArcadeBand height={120} />
      <div className="wrap wrap-narrow" style={{ alignItems: 'center', textAlign: 'center', flex: 1, justifyContent: 'center' }}>
        <p className="eyebrow enter">Lost in the stands</p>
        <h1 className="display slam" style={{ margin: 0, fontSize: 'clamp(64px, 16vw, 140px)', color: 'var(--bronze)', lineHeight: 1 }}>404</h1>
        <h2 className="display enter enter-1" style={{ margin: 0, fontSize: 'clamp(24px, 5vw, 34px)' }}>This gate leads nowhere</h2>
        <p className="muted enter enter-2" style={{ margin: 0, maxWidth: 520, fontSize: 17, lineHeight: 1.6 }}>
          The page you were looking for isn't here. It may have moved, or the link may be mistyped.
          Head back to the arena and pick your next matchup.
        </p>
        <div className="enter enter-3">
          <Link href="/" className="btn btn-primary">Back to the arena</Link>
        </div>
      </div>
    </main>
  );
}
