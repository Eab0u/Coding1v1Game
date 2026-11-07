"use client";

import Link from "next/link";
import { Card } from "../components/ui";

export default function ErrorRecovery({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="shell">
    <a className="skip-link" href="#error-recovery">Skip to page recovery</a>
    <header className="site-header"><Link className="brand" href="/">CodeDuel<span className="accent">.</span></Link></header>
    <main id="error-recovery" tabIndex={-1} className="page-recovery">
      <Card>
        <p className="eyebrow">PAGE INTERRUPTED</p>
        <h1>Get back in the game.</h1>
        <p role="alert">We couldn’t display this page. Try loading it again.</p>
        <p>Retrying this view does not submit code or start a new duel. If you were playing, the match clock may still be running.</p>
        <nav aria-label="Page recovery" className="page-recovery-actions">
          <button className="button button--primary" type="button" onClick={reset}>Try this page again</button>
          <Link className="button button--secondary" href="/">Back to arena</Link>
          <Link className="button button--secondary" href="/leaderboard">Explore standings</Link>
        </nav>
      </Card>
    </main>
  </div>;
}
