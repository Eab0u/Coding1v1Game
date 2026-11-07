import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge, Card } from "../../../components/ui";
import { database } from "../../../lib/auth-server";
import { loadProfile, ratingTier } from "../../../lib/profile";

export const dynamic = "force-dynamic";

export default async function Profile({ params }: { params: Promise<{ username: string }> }) {
  const { username } = await params;
  let data: Awaited<ReturnType<typeof loadProfile>> = null;
  let unavailable = false;
  if (!/^[A-Za-z0-9_]{3,24}$/.test(username)) notFound();
  try { data = await loadProfile(database(), username); } catch { unavailable = true; }
  if (!unavailable && !data) notFound();
  const values = data?.ratings.length ? [data.ratings[0].rating_before, ...data.ratings.map(row => row.rating_after)] : [];
  const change = values.length ? Math.round(values.at(-1)!) - Math.round(values[0]) : 0;
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
        <div className="profile-rating"><strong>{Math.round(data.rating)} <small>MMR</small></strong><Badge tone="accent">{ratingTier(data.rating)}</Badge></div>
        <div className="profile-record" aria-label="All-time match record">{([['Wins', data.record.wins], ['Losses', data.record.losses], ['Draws', data.record.draws]] as const).map(([label, count]) => <Card key={label}><strong>{count}</strong><span>{label}</span></Card>)}</div>
        <Card className="profile-climb"><h2>Rating journey</h2>{values.length ? <>
          <p>Last {data.ratings.length} rated {data.ratings.length === 1 ? "duel" : "duels"} · {Math.round(values[0])} → {Math.round(values.at(-1)!)} MMR</p>
          <p className="rating-change"><strong>{change > 0 ? "+" : ""}{change} MMR</strong><span>over this history window</span></p>
          <div className="rating-plot">
            <div className="rating-axis" aria-hidden="true"><span>{high} MMR</span><span>{low} MMR</span></div>
            <svg className="rating-chart" viewBox="0 0 600 180" preserveAspectRatio="none" role="img" aria-label={`Rating over the last ${data.ratings.length} rated duels, from ${Math.round(values[0])} to ${Math.round(values.at(-1)!)} MMR; vertical scale ${low} to ${high} MMR`}>
              {[20, 90, 160].map(y => <line key={y} className="rating-grid" x1="20" x2="580" y1={y} y2={y} />)}
              <polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" vectorEffect="non-scaling-stroke" />
            </svg>
          </div>
          <div className="rating-timeline"><span>Before first duel</span><span>Latest: <time dateTime={new Date(data.ratings.at(-1)!.completed_at).toISOString()}>{new Date(data.ratings.at(-1)!.completed_at).toISOString().slice(0, 10)}</time> UTC</span></div>
          <details className="rating-history"><summary>Rating history data</summary>
            <p>Oldest to newest within this history window. Dates are UTC. MMR values and changes are rounded for display.</p>
            <ol aria-label="Rated duel changes">{data.ratings.map((row, i) => {
              const delta = Math.round(row.rating_after) - Math.round(row.rating_before);
              const date = new Date(row.completed_at).toISOString();
              return <li key={i}>
                <time dateTime={date}>{date.slice(0, 10)} UTC</time>
                <span>{Math.round(row.rating_before)} <span aria-hidden="true">&rarr;</span><span className="sr-only">to</span> {Math.round(row.rating_after)} MMR</span>
                <strong className="rating-history-change">{delta > 0 ? "+" : ""}{delta || 0} MMR<span className="sr-only"> change</span></strong>
              </li>;
            })}</ol>
          </details>
        </> : <p>Players start at 800 MMR. This player has no completed rated duels to chart yet.</p>}</Card>
        <Card className="profile-history"><h2>Recent duels</h2><p>Most recent 20 completed matches. Dates are UTC.</p>{data.history.length > 0 && <p id="history-scroll-hint" className="history-scroll-hint">Scroll the table sideways to see every column. Keyboard users can focus the table region and use the arrow keys.</p>}{data.history.length ? <div className="ladder-scroll" role="region" aria-label="Recent duel history" aria-describedby="history-scroll-hint" tabIndex={0}><table className="ladder-table"><caption>Match history for {data.username}</caption><thead><tr>{['Result', 'Opponent', 'Problem', 'Rating change', 'Date'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{data.history.map(match => <tr key={match.id}><th scope="row"><span className={`history-result history-result--${match.result.toLowerCase()}`}>{match.result}</span></th><td><Link href={`/profile/${encodeURIComponent(match.opponent)}`}>{match.opponent}</Link></td><td>{match.title}</td><td>{match.delta === null ? 'Unrated' : `${Math.round(match.delta) > 0 ? '+' : ''}${Math.round(match.delta) === 0 ? 0 : Math.round(match.delta)} MMR`}</td><td><time dateTime={new Date(match.completed_at).toISOString()}>{new Date(match.completed_at).toISOString().slice(0, 10)}</time></td></tr>)}</tbody></table></div> : <section className="profile-empty" aria-labelledby="profile-empty-title"><h3 id="profile-empty-title">No completed duels yet</h3><p>This player’s completed duels will appear here. Waiting, active and cancelled matches do not count toward this history.</p><p>Ready to build your own record? Find a duel from the arena, or explore the public standings.</p><div className="ladder-empty-actions"><Link className="button button--primary" href="/">Find a duel</Link><Link className="button button--secondary" href="/leaderboard">Explore standings</Link></div></section>}</Card>
        {data.history.length > 0 && <Link className="button button--primary" href="/">Find a duel</Link>}
      </>}
    </main>
  </div>;
}
