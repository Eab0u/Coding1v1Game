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
  const low = Math.min(...values) - 20;
  const high = Math.max(...values) + 20;
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
        <Card><h2>Your climb</h2>{values.length ? <>
          <p>Last {data.ratings.length} rated duels · {Math.round(values[0])} → {Math.round(values.at(-1)!) } MMR</p>
          <svg className="rating-chart" viewBox="0 0 600 180" role="img" aria-label={`Rating over the last ${data.ratings.length} rated duels, from ${Math.round(values[0])} to ${Math.round(values.at(-1)!)} MMR`}><polyline points={points} fill="none" stroke="currentColor" strokeWidth="3" /></svg>
          <details><summary>Rating history data</summary><ol>{data.ratings.map((row, i) => <li key={i}>{new Date(row.completed_at).toISOString().slice(0, 10)}: {Math.round(row.rating_before)} → {Math.round(row.rating_after)} MMR</li>)}</ol></details>
        </> : <p>Your rating journey starts at 800. Completed rated duels will draw your graph.</p>}</Card>
        <Card className="profile-history"><h2>Recent duels</h2><p>Most recent 20 completed matches. Dates are UTC.</p>{data.history.length ? <div className="ladder-scroll" role="region" aria-label="Recent duel history" tabIndex={0}><table className="ladder-table"><caption>Match history for {data.username}</caption><thead><tr>{['Result', 'Opponent', 'Problem', 'Rating change', 'Date'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{data.history.map(match => <tr key={match.id}><th scope="row">{match.result}</th><td><Link href={`/profile/${match.opponent}`}>{match.opponent}</Link></td><td>{match.title}</td><td>{match.delta === null ? 'Unrated' : `${match.delta > 0 ? '+' : ''}${Math.round(match.delta)}`}</td><td><time dateTime={new Date(match.completed_at).toISOString()}>{new Date(match.completed_at).toISOString().slice(0, 10)}</time></td></tr>)}</tbody></table></div> : <p>No completed duels yet. Your next rival is waiting.</p>}</Card>
        <Link className="button button--primary" href="/">Find a duel</Link>
      </>}
    </main>
  </div>;
}
