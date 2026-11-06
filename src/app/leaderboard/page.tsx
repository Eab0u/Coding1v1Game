import Link from "next/link";
import { cookies } from "next/headers";
import { SESSION_COOKIE } from "../../lib/auth";
import { Card } from "../../components/ui";
import { auth, database } from "../../lib/auth-server";
import { loadLeaderboard, type LeaderboardEntry } from "../../lib/leaderboard";

export const dynamic = "force-dynamic";

export default async function Leaderboard({ searchParams }: { searchParams: Promise<{ period?: string; scope?: string }> }) {
  const scope = (await searchParams).scope === "friends";
  let needsLogin = false;
  const period = (await searchParams).period === "weekly" ? "weekly" : "global";
  let entries: LeaderboardEntry[] = [];
  let unavailable = false;
  try {
    if (scope) {
      const user = await auth.current((await cookies()).get(SESSION_COOKIE)?.value);
      if (user) entries = await loadLeaderboard(database(), period, user.id);
      else needsLogin = true;
    } else entries = await loadLeaderboard(database(), period);
  } catch { unavailable = true; }
  return <div className="shell">
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header"><Link className="brand" href="/">CodeDuel<span className="accent">.</span></Link><a href="/account">Your account</a></header>
    <main id="main" tabIndex={-1} className="ladder">
      <p className="eyebrow">THE CLIMB STARTS AT 800</p>
      <h1>The ladder.</h1>
      <p className="intro">Every duel is a chance to climb. Meet the top 100.</p>
      <nav className="ladder-filters" aria-label="Leaderboard period">
        <a href={scope ? "/leaderboard?scope=friends" : "/leaderboard"} aria-current={period === "global" ? "page" : undefined}>Global rating</a>
        <a href={scope ? "/leaderboard?period=weekly&scope=friends" : "/leaderboard?period=weekly"} aria-current={period === "weekly" ? "page" : undefined}>Weekly climb</a>
      </nav>
      <nav className="ladder-filters" aria-label="Leaderboard players"><Link href={`/leaderboard?period=${period}`} aria-current={!scope ? "page" : undefined}>Everyone</Link><Link href={`/leaderboard?period=${period}&scope=friends`} aria-current={scope ? "page" : undefined}>Friends</Link><Link href="/friends">Manage friends</Link></nav>
      {scope && <p>You and your accepted friends, ranked within your circle.</p>}
      <p id="ranking-rules" className="availability">{period === "weekly" ? "Ranked by net rating gained in completed duels since Monday 00:00 UTC. Players with no completed rated duels this week are excluded." : "Ranked by current rating, including new players. Equal ratings share a rank."} Rankings use full precision; displayed values are rounded. Ties share a rank.</p>
      <Card className="ladder-card">
        {needsLogin ? <p><Link href="/account">Sign in to see friends standings</Link></p> : unavailable ? <p role="alert">Standings unavailable. Please try again later.</p> : entries.length ?
          <div className="ladder-scroll" role="region" aria-label="Leaderboard standings" tabIndex={0}><table className="ladder-table" aria-describedby="ranking-rules">
            <caption>{period === "weekly" ? "Weekly climb" : "Global rating"} standings</caption>
            <thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Rating</th>{period === "weekly" && <th scope="col">Weekly gain</th>}</tr></thead>
            <tbody>{entries.map(entry => <tr key={entry.username} className={entry.rank <= 3 ? "ladder-podium" : undefined}>
              <td><span className="ladder-rank">#{entry.rank}</span></td><th scope="row"><Link href={`/profile/${entry.username}`}>{entry.username}</Link></th><td>{Math.round(entry.rating)}</td>
              {period === "weekly" && <td>{entry.score > 0 ? "+" : ""}{Math.round(entry.score)}</td>}
            </tr>)}</tbody>
          </table></div> : <div className="ladder-empty"><h2>{period === "weekly" ? "A new week. An open ladder." : "The first rivals are on their way."}</h2><p>{period === "weekly" ? "Completed rated duels will put this week’s climbers here." : "Create an account to join the standings."}</p><Link className="button button--primary" href="/">Back to arena</Link></div>}
      </Card>
    </main>
  </div>;
}

