import Link from "next/link";
import { Card } from "../components/ui";
import { RecoveryConnectionStatus } from "../components/recovery-connection-status";

export default function NotFound() {
  return <div className="shell">
    <a className="skip-link" href="#main-content">Skip to page recovery</a>
    <header className="site-header"><Link className="brand" href="/">CodeDuel<span className="accent">.</span></Link></header>
    <main id="main-content" tabIndex={-1} className="page-recovery">
      <Card>
        <p className="eyebrow">404 · PAGE UNAVAILABLE</p>
        <h1>Get back to your duel.</h1>
        <p>This link is unavailable. Check the address, or head back to the arena to find your next match.</p>
        <RecoveryConnectionStatus unavailablePage />
        <p id="unavailable-match-guidance" className="recovery-guidance">An unavailable page does not pause a live match. If you were playing, use your original match link or return home and press Play to recover your existing match. The server confirms whether it is still available.</p>
        <nav aria-label="Page recovery" className="page-recovery-actions">
          <Link className="button button--primary" href="/" aria-describedby="unavailable-match-guidance">Back to arena</Link>
          <Link className="button button--secondary" href="/leaderboard">Explore standings</Link>
        </nav>
      </Card>
    </main>
  </div>;
}
