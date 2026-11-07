/* Native links allow a fresh document request if the current navigation stalls. */
/* eslint-disable @next/next/no-html-link-for-pages */
import { Card } from "../components/ui";

export default function Loading() {
  return <div className="shell">
    <a className="skip-link" href="#main-content">Skip to loading status</a>
    <header className="site-header"><a className="brand" href="/">CodeDuel<span className="accent">.</span></a></header>
    <main id="main-content" tabIndex={-1} className="page-recovery">
      <Card>
        <p className="eyebrow">CODEDUEL</p>
        <h1>Opening your page.</h1>
        <p role="status" aria-live="polite" aria-atomic="true" className="page-loading-status"><span className="page-loading-mark" aria-hidden="true" />Loading page content…</p>
        <p>This page will appear automatically when it is ready. If you are returning to a live duel, its server clock continues while this page loads.</p>
        <nav aria-label="Loading navigation" className="page-recovery-actions">
          <a className="button button--secondary" href="/">Back to arena</a>
        </nav>
      </Card>
    </main>
  </div>;
}
