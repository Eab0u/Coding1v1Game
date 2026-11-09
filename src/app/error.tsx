"use client";

import { useId } from "react";
import { RecoveryConnectionStatus } from "../components/recovery-connection-status";

import Link from "next/link";
import { Card } from "../components/ui";

export default function ErrorRecovery({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const guidanceId = useId();
  const reloadGuidanceId = useId();
  const matchGuidanceId = useId();

  return <div className="shell">
    <a className="skip-link" href="#error-recovery">Skip to page recovery</a>
    <header className="site-header"><Link className="brand" href="/">CodeDuel<span className="accent">.</span></Link></header>
    <main id="error-recovery" tabIndex={-1} className="page-recovery">
      <Card>
        <p className="eyebrow">PAGE INTERRUPTED</p>
        <h1>Get back in the game.</h1>
        <p role="alert">We couldn’t display this page. Try loading it again.</p>
        <RecoveryConnectionStatus />
        <p id={guidanceId} className="recovery-guidance">Retrying this view does not submit code or start a new duel. If you were playing, the match clock may still be running.</p>
        <p id={reloadGuidanceId} className="recovery-guidance">If retrying keeps failing, reload the full page. Unsaved changes may be lost; a live match clock continues.</p>
        <p id={matchGuidanceId} className="recovery-guidance">The live duel server clock continues while this page is unavailable. Return home and press Play to recover your existing match; availability depends on what the server confirms.</p>
        <nav aria-label="Page recovery" className="page-recovery-actions">
          <button className="button button--primary" type="button" aria-describedby={guidanceId} onClick={reset}>Try this page again</button>
          <button className="button button--secondary" type="button" onClick={() => window.location.reload()} aria-describedby={reloadGuidanceId}>Reload full page</button>
          <Link className="button button--secondary" href="/" aria-describedby={matchGuidanceId}>Back to arena</Link>
          <Link className="button button--secondary" href="/leaderboard">Explore standings</Link>
        </nav>
      </Card>
    </main>
  </div>;
}
