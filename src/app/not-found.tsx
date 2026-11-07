import Link from "next/link";
import { Card } from "../components/ui";

export default function NotFound() {
  return <div className="shell">
    <a className="skip-link" href="#main-content">Skip to page recovery</a>
    <header className="site-header"><Link className="brand" href="/">CodeDuel<span className="accent">.</span></Link></header>
    <main id="main-content" tabIndex={-1} className="page-recovery">
      <Card>
        <p className="eyebrow">404 · PAGE UNAVAILABLE</p>
        <h1>Find your next duel.</h1>
        <p>This link is unavailable. Check the address, or head back to the arena to find your next match.</p>
        <nav aria-label="Page recovery" className="page-recovery-actions">
          <Link className="button button--primary" href="/">Back to arena</Link>
          <Link className="button button--secondary" href="/leaderboard">Explore standings</Link>
        </nav>
      </Card>
    </main>
  </div>;
}
