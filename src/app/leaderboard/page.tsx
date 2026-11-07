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
  const retryHref = `/leaderboard?period=${period}${scope ? "&scope=friends" : ""}`;
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
        {needsLogin ? <section className="ladder-empty" aria-labelledby="friends-login-title">
          <p className="eyebrow">YOUR CIRCLE</p><h2 id="friends-login-title">Climb with familiar rivals.</h2>
          <p>Sign in to compare your rating with accepted friends. Pending invitations stay out of the standings.</p>
          <div className="ladder-empty-actions"><Link className="button button--primary" href="/account">Sign in to see friends standings</Link><Link className="button button--secondary" href={`/leaderboard?period=${period}`}>See everyone</Link></div>
        </section> : unavailable ? <div className="ladder-recovery">
          <div role="alert"><h2>Standings unavailable</h2><p>We couldn’t load this ladder. Try again to refresh your selected standings.</p></div>
          <a className="button button--primary" href={retryHref}>Retry standings</a>
          <Link className="button button--secondary" href="/">Back to arena</Link>
        </div> : entries.length ?
          <><p id="standings-scroll-hint" className="standings-scroll-hint">On smaller screens, scroll sideways to see all standings. Keyboard: focus the standings and use the left and right arrow keys.</p>
          <div className="ladder-scroll" role="region" aria-label="Leaderboard standings" aria-describedby="standings-scroll-hint" tabIndex={0}><table className="ladder-table" aria-describedby="ranking-rules">
            <caption>{period === "weekly" ? "Weekly climb" : "Global rating"} standings</caption>
            <thead><tr><th scope="col">Rank</th><th scope="col">Player</th><th scope="col">Rating</th>{period === "weekly" && <th scope="col">Weekly gain</th>}</tr></thead>
            <tbody>{entries.map(entry => <tr key={entry.username} className={entry.rank <= 3 ? "ladder-podium" : undefined}>
              <td><span className="ladder-rank">#{entry.rank}</span></td><th scope="row"><Link className="standings-player" href={`/profile/${encodeURIComponent(entry.username)}`}>{entry.username}</Link></th><td>{Math.round(entry.rating)} MMR</td>
              {period === "weekly" && <td className="standings-change">{Math.round(entry.score) > 0 ? "+" : ""}{Math.round(entry.score) || 0} MMR</td>}
            </tr>)}</tbody>
          </table></div></> : scope ? <section className="ladder-empty" aria-labelledby="friends-empty-title">
            <p className="eyebrow">YOUR CIRCLE</p><h2 id="friends-empty-title">{period === "weekly" ? "Your circle’s next climb starts here." : "Bring your rivals to the ladder."}</h2>
            <p>{period === "weekly" ? "Neither you nor your accepted friends have completed a rated duel this week. Finish a rated duel to join the weekly climb; wins, losses and draws all count." : "No standings are available for your circle yet. Invite a rival or return to the arena to start a duel."}</p>
            <div className="ladder-empty-actions"><Link className="button button--primary" href="/">Find a duel</Link><Link className="button button--secondary" href="/friends">Invite friends</Link></div>
          </section> : <div className="ladder-empty"><h2>{period === "weekly" ? "A new week. An open ladder." : "The first rivals are on their way."}</h2><p>{period === "weekly" ? "Completed rated duels will put this week’s climbers here." : "Create an account to join the standings."}</p><Link className="button button--primary" href="/">Back to arena</Link></div>}
      </Card>
    </main>
  </div>;
}

