import { Badge, Card } from "../components/ui";

import { cookies } from "next/headers";
import { auth, database } from "../lib/auth-server";
import { SESSION_COOKIE } from "../lib/auth";
import { loadHome } from "../lib/home";
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
        <a href="/account">{user ? `Account ? ${user.username}` : "Sign in / Create account"}</a>
      </header>
      <main id="main" tabIndex={-1}>
        <section className="hero" aria-labelledby="welcome">
          <div>
            <p className="eyebrow">ONE PROBLEM. TWO PLAYERS.</p>
            <h1 id="welcome">Your next rival<br />thinks in code.</h1>
            <p className="intro">Ranked Python duels. Solve the same algorithm problem, race the clock, and climb the ladder.</p>
            <Play signedIn={!!user && !unavailable} />
            <p className="availability">Arena preview ? Published problems and match activation are still in development.</p>
          </div>
          <Card>
            <div className="preview-header"><Badge tone="accent">Python arena</Badge><Badge>1 vs 1</Badge></div>
            <h2>Same challenge.<br />Your own approach.</h2>
            <div className="duel-mark" aria-hidden="true"><span className="player-mark">{">_"}</span><span>VS</span><span className="player-mark">{"</>"}</span></div>
            <p className="preview-caption">One function. Hidden tests. A place on the ladder.</p>
          </Card>
        </section>
        {unavailable && <p role="alert">Player dashboard unavailable. Please try again later.</p>}
        <section className="dashboard-grid" aria-label="Player dashboard">
          <Card><p className="eyebrow">YOUR LADDER</p><h2>{user ? Math.round(user.rating) : "800"} <small>MMR</small></h2><p>{user ? `${data.streak} consecutive wins` : "Your starting rating ? Sign in to track your climb"}</p></Card>
          <Card><p className="eyebrow">DAILY CHALLENGE ? UTC</p>{data.daily ? <><h2>{data.daily.title}</h2><Badge>{data.daily.difficulty}</Badge><p>{data.daily.statement}</p><code>{data.daily.function_signature}</code></> : <><h2>A fresh challenge is on its way.</h2><p>Daily problems appear here once the validated catalog is published.</p></>}</Card>
          <Card><h2>Recent duels</h2>{data.recent.length ? <ul className="recent-duels">{data.recent.map(match => <li key={match.id}><strong>{match.winner_id === user?.id ? "WIN" : match.winner_id ? "LOSS" : "DRAW"}</strong><span>{match.title}<br /><small>vs {match.opponent}</small></span></li>)}</ul> : <p>{user ? "Your first duel starts your story. Completed matches will appear here." : "Sign in to see your match history."}</p>}</Card>
        </section>
        <section className="principles" aria-labelledby="scoring">
          <h2 id="scoring">What wins a duel?</h2>
          <div className="principle-grid">
            <Card><span className="step">01 / CORRECTNESS</span><h3>Make it work.</h3><p>Pass the most hidden tests. A correct solution always comes first.</p></Card>
            <Card><span className="step">02 / EFFICIENCY</span><h3>Make it efficient.</h3><p>Tied on tests? Lower CPU time on the largest inputs takes the lead.</p></Card>
            <Card><span className="step">03 / SPEED</span><h3>Beat the clock.</h3><p>Still tied? The earlier submission wins. An exact tie is a draw.</p></Card>
          </div>
        </section>
      </main>
      <footer className="site-footer">Correctness first. Efficiency wins. Speed breaks the tie.</footer>
    </div>
  );
}

