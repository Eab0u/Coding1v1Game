"use client";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ArenaSnapshot } from "../lib/arena";
const PythonEditor = dynamic(()=>import("./python-editor"),{ssr:false,loading:()=> <p>Loading editor…</p>});
export function remainingSeconds(deadline:string|null, serverTime:string, elapsed:number) {
  return deadline ? Math.max(0,Math.ceil((Date.parse(deadline)-Date.parse(serverTime)-elapsed)/1000)) : null;
}
export function Arena({initial}:{initial:ArenaSnapshot}) {
  const [match,setMatch]=useState(initial);
  const [source,setSource]=useState(`${initial.problem.signature}\n    pass\n`);
  const [elapsed,setElapsed]=useState(0);
  const [error,setError]=useState("");
  const received=useRef(0);
  useEffect(()=> {
    received.current=performance.now();
    const clock=setInterval(()=>setElapsed(performance.now()-received.current),250);
    let stopped=false;
    const controller=new AbortController();
    async function refresh() {
      try {
        const response=await fetch(`/api/matches/${initial.id}`,{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
        if (!response.ok) throw new Error();
        const next:ArenaSnapshot=await response.json();
        if (!stopped) { received.current=performance.now();setElapsed(0);setMatch(next);setError(""); }
      } catch { if (!stopped) setError("Live updates unavailable. Retrying; progress may be out of date."); }
      if (!stopped) timer=setTimeout(refresh,2000);
    }
    let timer=setTimeout(refresh,0);
    return ()=>{stopped=true;controller.abort();clearTimeout(timer);clearInterval(clock);};
  },[initial.id]);
  const seconds=remainingSeconds(match.deadline,match.serverTime,elapsed);
  const closed=match.status==="completed" || match.status==="cancelled";
  return <div className="shell arena"><header className="site-header"><Link className="brand" href="/">Code<span className="accent">Duel</span></Link><span>Python arena</span></header>
    <main id="main-content"><div className="arena-scoreboard">
      <div><span className="eyebrow">YOU</span><h2>{match.player.username}</h2><p>{Math.round(match.player.rating)} MMR</p></div>
      <div className="arena-clock"><span className="eyebrow">{match.status}</span><p role="timer" aria-label="Time remaining">{match.status==="pending" ? "Waiting to start" : seconds===null ? "No timer" : `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`}</p></div>
      <div><span className="eyebrow">OPPONENT</span><h2>{match.opponent.username}</h2><p>{Math.round(match.opponent.rating)} MMR</p></div>
    </div>
    {match.status==="completed" && <Link className="button button--primary" href={`/match/${match.id}/results`}>View results</Link>}
    {error && <p role="alert">{error}</p>}
    <section className="arena-progress" aria-label="Opponent progress"><label htmlFor="opponent-progress">Opponent tests passed: {match.progress ? `${match.progress.passed} / ${match.progress.total}` : "No judged submission yet"}</label><progress id="opponent-progress" value={match.progress?.passed ?? 0} max={match.progress?.total ?? 1}/></section>
    <div className="arena-columns"><section className="card arena-editor"><div className="arena-panel-heading"><h1>Your solution</h1><span className="badge">Python 3</span></div>
      <PythonEditor value={source} onChange={setSource} readOnly={closed}/>
      <p>{closed ? "This match has ended." : match.status==="pending" ? "Match reserved. The server has not started the clock." : seconds===0 ? "Time expired. Awaiting the server result." : "Clock and opponent progress are synchronized with the server."}</p>
      <button className="button button--primary" disabled aria-describedby="submission-status">Submit solution</button><p id="submission-status">Submission processing is not available yet. Keep this tab open to retain your draft.</p>
    </section><section className="card arena-problem"><p className="eyebrow">{match.problem.difficulty}</p><h2>{match.problem.title}</h2><p className="arena-text">{match.problem.statement}</p><h3>Function</h3><pre>{match.problem.signature}</pre><h3>Constraints</h3><p className="arena-text">{match.problem.constraints}</p><h3>Examples</h3><pre>{JSON.stringify(match.problem.examples,null,2)}</pre></section></div>
    </main></div>;
}
