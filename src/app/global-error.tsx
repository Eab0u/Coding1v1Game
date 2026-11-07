"use client";

import { useId } from "react";

/* eslint-disable @next/next/no-html-link-for-pages -- Full document navigation recovers a failed root layout without relying on its client router. */
// This boundary replaces the root layout, so it owns its document and styles.
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const guidanceId = useId();

  return <html lang="en"><head><title>Page recovery | CodeDuel</title></head><body>
    <style>{`
      * { box-sizing: border-box; }
      body { margin: 0; background: #262421; color: #f5f3ef; font: 1rem/1.6 Arial, Helvetica, sans-serif; }
      a { color: #a4d275; text-underline-offset: 4px; }
      :focus-visible { outline: 3px solid #c6ee9f; outline-offset: 4px; }
      .recovery-skip { position: absolute; top: -100px; left: 16px; padding: 12px; background: #312e2b; }
      .recovery-skip:focus { top: 16px; }
      .recovery-shell { max-width: 800px; margin: auto; padding: 32px 20px; }
      .recovery-brand { display: inline-block; font-size: 1.75rem; font-weight: 900; margin-bottom: 32px; }
      .recovery-card { padding: clamp(20px, 5vw, 40px); border: 1px solid #575149; border-radius: 16px; background: #312e2b; overflow-wrap: anywhere; }
      .recovery-label { color: #a4d275; font-size: .75rem; font-weight: 800; letter-spacing: .14em; }
      h1 { font-size: clamp(2rem, 6vw, 3.5rem); line-height: 1.15; letter-spacing: -.04em; }
      .recovery-guidance { padding: 16px; border-left: 3px solid #81b64c; border-radius: 8px; background: #262421; }
      nav { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 24px; }
      nav a, button { display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 12px 20px; border: 1px solid #575149; border-radius: 8px; font: 800 1rem/1.5 Arial, Helvetica, sans-serif; text-align: center; }
      button { background: #81b64c; color: #18210f; cursor: pointer; }
      button:hover { background: #98ca65; }
      @media (max-width: 480px) { nav > * { width: 100%; } }
    `}</style>
    <a className="recovery-skip" href="#global-recovery">Skip to page recovery</a>
    <div className="recovery-shell">
      <a className="recovery-brand" href="/">CodeDuel.</a>
      <main id="global-recovery" tabIndex={-1} className="recovery-card">
        <p className="recovery-label">PAGE INTERRUPTED</p>
        <h1>Get back in the game.</h1>
        <p role="alert">We could not load the site view. Try loading it again.</p>
        <p id={guidanceId} className="recovery-guidance">Retrying this view does not submit code or start a new duel. If you were playing, the match clock may still be running.</p>
        <nav aria-label="Page recovery">
          <button type="button" aria-describedby={guidanceId} onClick={reset}>Try this page again</button>
          <a href="/">Back to arena</a>
          <a href="/leaderboard">Explore standings</a>
        </nav>
      </main>
    </div>
  </body></html>;
}
