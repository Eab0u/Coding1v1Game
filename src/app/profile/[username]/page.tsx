import Link from "next/link";
import { DuelDate } from "../../../components/duel-date";
import { notFound } from "next/navigation";
import { Badge, Card } from "../../../components/ui";
import { database } from "../../../lib/auth-server";
import { loadProfile, ratingTier, RATING_TIERS } from "../../../lib/profile";

export const dynamic = "force-dynamic";

export default async function Profile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  let data: Awaited<ReturnType<typeof loadProfile>> = null;
  let unavailable = false;
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) notFound();
  try { data = await loadProfile(database(), username); } catch { unavailable = true; }
  if (!unavailable && !data) notFound();
  const completed = data ? data.record.wins + data.record.losses + data.record.draws : 0;
  const winRate = completed && data ? `${(100 * data.record.wins / completed).toFixed(1)}%` : null;
  const values = data?.ratings.length ? [data.ratings[0].rating_before, ...data.ratings.map(row => row.rating_after)] : [];
  const change = values.length ? Math.round(values.at(-1)! - values[0]) : 0;
  const low = Math.max(0, Math.floor((Math.min(...values) - 20) / 20) * 20);
  const high = Math.ceil((Math.max(...values) + 20) / 20) * 20;
  const points = values.map((value, index) => `${20 + index / (values.length - 1) * 560},${160 - (value - low) / (high - low) * 140}`).join(" ");
  return <div className="shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><Link className="brand" href="/">CodeDuel<span className="accent">.</span></Link><Link href="/leaderboard">Leaderboard</Link><Link href="/account">Your account</Link></header>
    <main id="main" tabIndex={-1} className="ladder">
      {unavailable ? <Card className="ladder-recovery">
        <div role="alert"><h1>Profile unavailable</h1><p>We could not load this player. Try again to refresh their rating and duel history.</p></div>
        <a className="button button--primary" href={`/profile/${username}`}>Retry profile</a>
        <Link className="button button--secondary" href="/">Back to arena</Link>
      </Card> : data && <>
        <p className="eyebrow">PLAYER PROFILE</p><h1>{data.username}</h1>
        {data.history.length > 0 && <p><a className="button button--secondary" href="#recent-duels-title">Jump to recent duels</a></p>}
        <section className="profile-refresh" aria-labelledby="profile-refresh-title">
          <div><h2 id="profile-refresh-title">Check the latest player stats</h2><p id="profile-refresh-note">Rating, tier, record and duel history reflect when this page loaded. Refresh after a completed duel to load the latest stats for this player.</p></div>
          <a className="button button--secondary" href={`/profile/${encodeURIComponent(data.username)}`} aria-describedby="profile-refresh-note">Refresh profile</a>
        </section>
        <div className="profile-rating"><strong>{Math.round(data.rating)} <small>MMR</small></strong><Badge tone="accent">{ratingTier(data.rating)}</Badge></div>
        <details className="tier-guide">
          <summary>Explore rating tiers</summary>
          <p>Tier badges follow current MMR. Ratings are rounded for display; tier boundaries use the full rating.</p>
          <ul aria-label="Rating tier thresholds">{RATING_TIERS.map(tier => <li key={tier.name} className={ratingTier(data.rating) === tier.name ? "tier-guide-current" : undefined}>
            <strong>{tier.name}</strong><span>{tier.minimum}+ MMR</span>{ratingTier(data.rating) === tier.name && <span className="tier-guide-marker">Current tier</span>}
          </li>)}</ul>
          <p>New players enter Bronze at 800 MMR. A tier can rise or fall as ratings change after completed duels.</p>
        </details>
        <section className="profile-record-section" aria-labelledby="record-title" aria-describedby="record-rules">
          <h2 id="record-title">All-time match record</h2>
          <p className="profile-record-summary"><strong>{completed} completed {completed === 1 ? "duel" : "duels"}</strong><span>{winRate ? `${winRate} win rate` : "Win rate appears after the first completed duel."}</span></p>
          <dl className="profile-record">{([['Wins', data.record.wins], ['Losses', data.record.losses], ['Draws', data.record.draws]] as const).map(([label, count]) => <div className="card" key={label}><dt>{label}</dt><dd><strong>{count}</strong></dd></div>)}</dl>
          <p id="record-rules" className="availability">Win rate is wins divided by all completed duels, including draws. Waiting, active and cancelled matches are excluded.</p>
        </section>
        <Card className="profile-climb"><h2>Rating journey</h2>{values.length ? <>
          <p>Last {data.ratings.length} rated {data.ratings.length === 1 ? "duel" : "duels"} · {Math.round(values[0])} → {Math.round(values.at(-1)!)} MMR</p>
          <p id="rating-window-note" className="rating-window-note">Showing {data.ratings.length} of up to 50 recent rated duels. Older rated duels may fall outside this window. The all-time record above includes every completed duel, including unrated duels.</p>
          <p className="rating-change"><strong>{change > 0 ? "+" : ""}{change} MMR</strong><span>over this history window</span></p>
          <div className="rating-plot">
            <div className="rating-axis" aria-hidden="true"><span>{high} MMR</span><span>{low} MMR</span></div>
            <svg className="rating-chart" viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-describedby="rating-window-note" aria-label={`Rating over the last ${data.ratings.length} rated duels, from ${Math.round(values[0])} to ${Math.round(values.at(-1)!)} MMR; vertical scale ${low} to ${high} MMR`}>
              {[20, 90, 160].map(y => <line key={y} className="rating-grid" x1="20" x2="580" y1={y} y2={y} />)}
              <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <div className="rating-timeline"><span>Before first duel in this window</span><span>Latest: <time dateTime={new Date(data.ratings.at(-1)!.completed_at).toISOString()}>{new Date(data.ratings.at(-1)!.completed_at).toISOString().slice(0, 10)}</time> UTC</span></div>
          <details className="rating-history"><summary>Rating history data</summary>
            <p>Oldest to newest within this history window. Dates are UTC. MMR values and changes are rounded independently from full precision. A displayed zero change can include a small gain or loss; subtracting the displayed ratings may differ from the displayed change.</p>
            <ol aria-label="Rated duel changes">{data.ratings.map((row, i) => {
              const delta = Math.round(row.rating_after - row.rating_before);
              const date = new Date(row.completed_at).toISOString();
              return <li key={i}>
                <time dateTime={date}>{date.slice(0, 10)} UTC</time>
                <span>{Math.round(row.rating_before)} <span aria-hidden="true">&rarr;</span><span className="sr-only">to</span> {Math.round(row.rating_after)} MMR</span>
                <strong className="rating-history-change">{delta > 0 ? "+" : ""}{delta || 0} MMR<span className="sr-only"> change</span></strong>
              </li>;
            })}</ol>
          </details>
        </> : <p>Players start at 800 MMR. This player has no completed rated duels to chart yet.</p>}</Card>
        <Card className="profile-history"><h2 id="recent-duels-title" tabIndex={-1}>Recent duels</h2><p>Most recent 20 completed matches. Completion dates and times are UTC.</p>{data.history.length > 0 && <p id="history-scroll-hint" className="history-scroll-hint">Scroll the table sideways to see every column. Keyboard users can focus the table region and use the arrow keys.</p>}{data.history.length ? <div className="ladder-scroll" role="region" aria-label="Recent duel history" aria-describedby="history-scroll-hint" tabIndex={0}><table className="ladder-table"><caption>Match history for {data.username}</caption><thead><tr>{['Result', 'Opponent', 'Problem', 'Rating change', 'Completed (UTC)'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{data.history.map(match => <tr key={match.id}><th scope="row"><span className={`history-result history-result--${match.result.toLowerCase()}`}>{match.result}</span></th><td><Link href={`/profile/${encodeURIComponent(match.opponent)}`}>{match.opponent}</Link></td><td>{match.title}</td><td>{match.delta === null ? 'Unrated' : `${Math.round(match.delta) > 0 ? '+' : ''}${Math.round(match.delta) === 0 ? 0 : Math.round(match.delta)} MMR`}</td><td><DuelDate value={match.completed_at} /></td></tr>)}</tbody></table></div> : <section className="profile-empty" aria-labelledby="profile-empty-title"><h3 id="profile-empty-title">No completed duels yet</h3><p>This player’s completed duels will appear here. Waiting, active and cancelled matches do not count toward this history.</p><p>Ready to build your own record? Find a duel from the arena, or explore the public standings.</p><div className="ladder-empty-actions"><Link className="button button--primary" href="/">Find a duel</Link><Link className="button button--secondary" href="/leaderboard">Explore standings</Link></div></section>}</Card>
        {data.history.length > 0 && <Link className="button button--primary" href="/">Find a duel</Link>}
      </>}
    </main>
  </div>;
}
