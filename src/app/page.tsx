import { Badge, Button, Card } from "../components/ui";

export default function Home() {
  return (
    <div className="shell">
      <a className="skip-link" href="#main">Skip to content</a>
      <header className="site-header">
        <span className="brand">CodeDuel<span className="accent">.</span></span>
        <a href="/account">Sign in / Create account</a>
      </header>
      <main id="main" tabIndex={-1}>
        <section className="hero" aria-labelledby="welcome">
          <div>
            <p className="eyebrow">ONE PROBLEM. TWO PLAYERS.</p>
            <h1 id="welcome">Your next rival<br />thinks in code.</h1>
            <p className="intro">Ranked Python duels. Solve the same algorithm problem, race the clock, and climb the ladder.</p>
            <Button disabled aria-describedby="availability">Play a duel</Button>
            <p id="availability" className="availability">The arena is taking shape. Matchmaking will open in a future update.</p>
          </div>
          <Card>
            <div className="preview-header"><Badge tone="accent">Python arena</Badge><Badge>1 vs 1</Badge></div>
            <h2>Same challenge.<br />Your own approach.</h2>
            <div className="duel-mark" aria-hidden="true"><span className="player-mark">{">_"}</span><span>VS</span><span className="player-mark">{"</>"}</span></div>
            <p className="preview-caption">One function. Hidden tests. A place on the ladder.</p>
          </Card>
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

