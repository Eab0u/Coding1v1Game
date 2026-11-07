import { Badge, Card } from "../components/ui";
import Link from "next/link";

import { cookies } from "next/headers";
import { auth, database } from "../lib/auth-server";
import { SESSION_COOKIE } from "../lib/auth";
import { ratingTier } from "../lib/profile";
import { loadHome } from "../lib/home";
import { DuelDate } from "../components/duel-date";
import { ProblemExamples } from "../components/problem-examples";
import { Play } from "../components/play";

export default async function Home() {
  let user = null;
  let data: Awaited<ReturnType<typeof loadHome>> = { daily: null, recent: [], streak: 0 };
  let unavailable = false;
  try {
    user = await auth.current((await cookies()).get(SESSION_COOKIE)?.value);
    data = await loadHome(database(), user?.id);
  } catch { unavailable = true; }
  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <span className="brand">CodeDuel<span className="accent">.</span></span>
        <a href="/leaderboard">Leaderboard</a>
        {user && <a href={`/profile/${user.username}`}>Your profile</a>}
        {user && <Link href="/friends">Friends</Link>}
        <a href="/account">{user ? `Account: ${user.username}` : "Sign in / Create account"}</a>
      </header>
      <main id="main" tabIndex={-1}>
        {!unavailable && <aside className="dashboard-refresh" aria-labelledby="dashboard-refresh-title">
          <div><h2 id="dashboard-refresh-title">Your dashboard at a glance</h2><p id="dashboard-refresh-note">Ratings, streaks, recent duels and the daily preview reflect when this page loaded. Refresh after a completed duel or a new UTC day to see the latest available data.</p></div>
          {/* A document request reloads both the session and dashboard data. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="button button--secondary" href="/" aria-describedby="dashboard-refresh-note">Refresh dashboard</a>
        </aside>}
        <section className="hero" aria-labelledby="welcome">
          <div>
            <p className="eyebrow">ONE PROBLEM. TWO PLAYERS.</p>
            <h1 id="welcome">Your next rival<br />thinks in code.</h1>
            <p className="intro">Ranked Python duels. Solve the same algorithm problem, race the clock, and climb the ladder.</p>
            {!unavailable && <Play signedIn={!!user} />}
            <aside className="arena-guide" aria-labelledby="arena-guide-title">
              <h2 id="arena-guide-title">Before your first duel</h2>
              <p>Pairing requires a published, validated problem in your rating band. If none is available, try again later.</p>
              <p>Once paired, both players have 60 seconds to click Ready. The duel clock starts when both are ready; an expired reservation does not change ratings.</p>
              <h3>Plan your duel</h3>
              <p id="duel-length-note">Difficulty follows the two players&apos; average rating. Allow time for the full duel after both players are ready.</p>
              <dl className="duel-lengths" aria-label="Duel lengths by difficulty" aria-describedby="duel-length-note">
                <div><dt>Easy</dt><dd><strong>5 minutes</strong><span>Below 1200 MMR</span></dd></div>
                <div><dt>Medium</dt><dd><strong>15 minutes</strong><span>1200 to below 1600 MMR</span></dd></div>
                <div><dt>Hard</dt><dd><strong>30 minutes</strong><span>1600+ MMR</span></dd></div>
              </dl>
            </aside>
          </div>
          <Card>
            <div className="preview-header"><Badge tone="accent">Python arena</Badge><Badge>1 vs 1</Badge></div>
            <h2>Same challenge.<br />Your own approach.</h2>
            <div className="duel-mark" aria-hidden="true"><span className="player-mark">{">_"}</span><span>VS</span><span className="player-mark">{"</>"}</span></div>
            <p className="preview-caption">One function. Hidden tests. A place on the ladder.</p>
          </Card>
        </section>
        {unavailable ? <Card className="ladder-recovery">
          <div role="alert"><h2>Player dashboard unavailable</h2><p>We could not load your dashboard. Try again to refresh your rating, recent duels and daily challenge.</p></div>
          {/* A full document request rechecks the session and dashboard instead of reusing the client router cache. */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a className="button button--primary" href="/">Retry dashboard</a>
          <a className="button button--secondary" href="/leaderboard">View leaderboard</a>
        </Card> : <section className="dashboard-grid" aria-label="Player dashboard">
          <Card className="home-ladder"><p className="eyebrow">YOUR LADDER</p><h2>{user ? Math.round(user.rating) : "800"} <small>MMR</small></h2>{user && <><Badge tone="accent">{ratingTier(user.rating)}</Badge><p className="home-tier-note">Your tier follows your current MMR at full precision. Displayed ratings are rounded.</p></>}{user ? <div className="home-streak"><dl aria-describedby="home-streak-note"><dt>Current win streak</dt><dd>{data.streak} consecutive {data.streak === 1 ? "win" : "wins"}</dd></dl><p id="home-streak-note">Consecutive wins across your completed duels. A loss or draw resets the count; cancelled reservations do not count.</p>{data.streak === 0 && <p className="home-streak-empty">Your next win starts a new streak.</p>}</div> : <p>Your starting rating. Sign in to track your climb.</p>}</Card>
          <Card className="daily-challenge"><p className="eyebrow">DAILY CHALLENGE (UTC)</p>{data.daily ? <><h2>{data.daily.title}</h2><Badge>{data.daily.difficulty}</Badge>{Array.isArray(data.daily.topics) && data.daily.topics.length > 0 && <div className="daily-topics"><p>Practice topics</p><ul aria-label="Daily challenge topics">{data.daily.topics.map((topic: string, index: number) => <li key={index}>{topic}</li>)}</ul></div>}<p className="daily-preview-note">A daily problem preview. Practice submissions are not available yet.</p><p id="daily-signature-hint" className="daily-signature-hint">Function signature. Scroll sideways to read long lines. Keyboard: focus the code and use the arrow keys.</p><pre className="daily-signature" role="region" aria-label="Daily challenge function signature" aria-describedby="daily-signature-hint" tabIndex={0}><code>{data.daily.function_signature}</code></pre><details className="daily-statement"><summary>Read challenge statement</summary><div>{data.daily.statement}</div>{data.daily.constraints?.trim() && <section className="daily-constraints" aria-labelledby="daily-constraints-title"><h3 id="daily-constraints-title">Input constraints</h3><p className="daily-constraints-note">Use the largest allowed inputs to plan your solution.</p><p className="daily-constraints-text">{data.daily.constraints}</p></section>}{Array.isArray(data.daily.examples) && data.daily.examples.length > 0 && <section className="daily-examples" aria-labelledby="daily-examples-title"><h3 id="daily-examples-title">Public examples</h3><p>These examples illustrate the function contract. Duel submissions are scored against separate hidden tests.</p><ProblemExamples examples={data.daily.examples} /></section>}</details></> : <><h2>A fresh challenge is on its way.</h2><p>Daily problems appear here once the validated catalog is published.</p></>}</Card>
          <Card className="home-history"><h2>Recent duels</h2>{user && <p className="home-history-note">Your latest five completed duels. MMR changes are rounded; a displayed zero can include a small gain or loss. Your profile shows up to 20, plus your record and rating journey.</p>}{data.recent.length ? <ul className="recent-duels">{data.recent.map(match => { const outcome = match.winner_id === user?.id ? "WIN" : match.winner_id ? "LOSS" : "DRAW"; return <li key={match.id}><strong className={`history-result history-result--${outcome.toLowerCase()}`}>{outcome}</strong><span><Link className="recent-duel-result" href={`/match/${encodeURIComponent(match.id)}/results`} aria-label={`View results for ${match.title} against ${match.opponent}`}>{match.title}</Link><small>vs <Link className="recent-duel-opponent" href={`/profile/${encodeURIComponent(match.opponent)}`}>{match.opponent}</Link></small><span className="home-rating-change">{match.delta == null ? "Rating change unavailable" : `${Math.round(match.delta) > 0 ? "+" : ""}${Math.round(match.delta) || 0} MMR change`}</span><DuelDate value={match.completed_at} /></span></li>; })}</ul> : <p>{user ? "Your first duel starts your story. Completed matches will appear here." : "Sign in to see your match history."}</p>}{user && <Link className="button button--secondary home-history-link" href={`/profile/${encodeURIComponent(user.username)}`}>View your duel history</Link>}</Card>
        </section>}
        <section className="principles" aria-labelledby="scoring">
          <h2 id="scoring">What wins a duel?</h2>
          <p id="scoring-note" className="scoring-note">Your best judged attempt counts. A weaker later attempt does not replace it. Compare these rules in order:</p>
          <ol className="principle-grid" role="list" aria-label="Duel scoring priority" aria-describedby="scoring-note">
            <li className="card"><span className="step">01 / CORRECTNESS</span><h3>Make it work.</h3><p>Pass the most hidden tests. A correct solution always comes first.</p></li>
            <li className="card"><span className="step">02 / EFFICIENCY</span><h3>Make it efficient.</h3><p>Tied on tests? Lower CPU time on the largest inputs takes the lead. We use the median of three runs: the middle CPU time, rather than the fastest run.</p></li>
            <li className="card"><span className="step">03 / SPEED</span><h3>Beat the clock.</h3><p>Still tied? The earlier submission of the selected attempt wins. An exact tie is a draw.</p></li>
          </ol>
        </section>
      </main>
      <footer className="site-footer">Correctness first. Efficiency wins. Speed breaks the tie.</footer>
    </div>
  );
}

