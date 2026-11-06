"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { ArenaSnapshot } from "../lib/arena";
import { DuelFeedback, useDuelFeedback } from "./duel-feedback";
import { useArenaDraft } from "./use-arena-draft";
import { SolutionEditor } from "./solution-editor";
export function remainingSeconds(deadline:string|null, serverTime:string, elapsed:number) {
  return deadline ? Math.max(0,Math.ceil((Date.parse(deadline)-Date.parse(serverTime)-elapsed)/1000)) : null;
}
export function Arena({initial}:{initial:ArenaSnapshot}) {
  return <ArenaSession key={`${initial.id}:${initial.player.username}`} initial={initial}/>;
}
function ArenaSession({initial}:{initial:ArenaSnapshot}) {
  const [match,setMatch]=useState(initial);
  const feedback=useDuelFeedback();
  const {notify}=feedback;
  // Existing verdicts are history, not new events when reopening the arena.
  const seenVerdicts=useRef(new Set(initial.submission?.status==="judged" && initial.submission.id ? [initial.submission.id] : []));
  useEffect(()=> {
    const verdict=match.submission;
    if (!verdict?.id || verdict.status!=="judged" || verdict.passed===null || verdict.total===null || verdict.total<=0 || seenVerdicts.current.has(verdict.id)) return;
    seenVerdicts.current.add(verdict.id);
    notify(verdict.passed===verdict.total ? "passed" : "failed");
  },[match.submission,notify]);
  const closed=match.status==="completed" || match.status==="cancelled";
  const {source,setSource,saved}=useArenaDraft(initial.id,initial.player.username,initial.problem.signature,closed);
  const [elapsed,setElapsed]=useState(0);
  const [error,setError]=useState("");
  const [sending,setSending]=useState(false);
  const [submission,setSubmission]=useState("");
  const actionRequest=useRef<AbortController|null>(null);
  useEffect(()=>()=>{actionRequest.current?.abort();actionRequest.current=null;},[]);
  async function act(action: "ready" | "submit") {
    if (actionRequest.current || closed) return;
    const controller=new AbortController();
    actionRequest.current=controller;
    feedback.unlock();
    setSending(true);
    try {
      const response=await fetch(`/api/matches/${initial.id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...(action==="submit" ? {source} : {})}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
      const result=await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(result.error || "Request failed.");
      setSubmission(action==="ready" ? "Ready. Waiting for both players; reservations expire after 60 seconds." : "Solution queued. The server will judge it in the sandbox.");
    } catch (error) { if (!controller.signal.aborted) setSubmission(error instanceof Error ? error.message : "Request failed."); }
    finally { if (actionRequest.current===controller) {actionRequest.current=null;setSending(false);} }
  }
  const received=useRef(0);
  useEffect(()=> {
    if (closed) return;
    received.current=performance.now();
    const clock=setInterval(()=>setElapsed(performance.now()-received.current),250);
    let stopped=false;
    let refreshing=false;
    const controller=new AbortController();
    async function refresh() {
      if (stopped || refreshing) return;
      clearTimeout(timer);
      refreshing=true;
      try {
        const response=await fetch(`/api/matches/${initial.id}`,{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
        if (!response.ok) throw new Error();
        const next:ArenaSnapshot=await response.json();
        if (!stopped) { received.current=performance.now();setElapsed(0);setMatch(next);setError(""); }
      } catch { if (!stopped) setError("Live updates unavailable. Retrying; progress may be out of date."); }
      refreshing=false;
      if (!stopped) timer=setTimeout(refresh,2000);
    }
    let timer=setTimeout(refresh,0);
    function resume() {
      if (document.visibilityState==="visible") void refresh();
    }
    document.addEventListener("visibilitychange",resume);
    return ()=>{stopped=true;controller.abort();clearTimeout(timer);clearInterval(clock);document.removeEventListener("visibilitychange",resume);};
  },[initial.id,closed]);
  const seconds=remainingSeconds(match.deadline,match.serverTime,elapsed);
  return <div className="shell arena"><header className="site-header"><Link className="brand" href="/">Code<span className="accent">Duel</span></Link><span>Python arena</span><DuelFeedback feedback={feedback}/></header>
    <main id="main-content"><div className="arena-scoreboard">
      <div><span className="eyebrow">YOU</span><h2>{match.player.username}</h2><p>{Math.round(match.player.rating)} MMR</p></div>
      <div className="arena-clock"><span className="eyebrow">{match.status}</span><p role="timer" aria-label="Time remaining">{match.status==="pending" ? "Waiting to start" : seconds===null ? "No timer" : `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`}</p></div>
      <div><span className="eyebrow">OPPONENT</span><h2>{match.opponent.username}</h2><p>{Math.round(match.opponent.rating)} MMR</p></div>
    </div>
    {match.status==="completed" && <Link className="button button--primary" href={`/match/${match.id}/results`}>View results</Link>}
    {error && <p role="alert">{error}</p>}
    <section className="arena-progress" aria-label="Opponent progress"><label htmlFor="opponent-progress">Opponent tests passed: {match.progress ? `${match.progress.passed} / ${match.progress.total}` : "No judged submission yet"}</label><progress id="opponent-progress" value={match.progress?.passed ?? 0} max={match.progress?.total ?? 1}/></section>
    <div className="arena-columns"><section className="card arena-editor"><div className="arena-panel-heading"><h1>Your solution</h1><span className="badge">Python 3</span></div>
      <SolutionEditor value={source} onChange={setSource} readOnly={closed} starter={`${initial.problem.signature}\n    pass\n`}/>
      {!closed && <p role="status">{saved ? "Draft saved in this tab. Refreshing restores it. Recovery ends when the match ends." : "Draft recovery unavailable. Keep this tab open to retain your code."}</p>}
      {match.submission && <p role="status">{match.submission.status==="judged" ? `Latest solution: ${match.submission.passed} / ${match.submission.total} tests passed.` : match.submission.status==="error" ? "Sandbox temporarily unavailable. Your submission will retry; results are waiting." : "Your solution is being judged."}</p>}
      <p>{closed ? "This match has ended." : match.status==="pending" ? "Match reserved. The server has not started the clock." : seconds===0 ? "Time expired. Awaiting the server result." : "Clock and opponent progress are synchronized with the server."}</p>
      {match.status==="pending" && <button className="button button--primary" disabled={sending} onClick={()=>void act("ready")}>Ready to duel</button>}
      <button className="button button--primary" disabled={sending || match.status!=="active" || seconds===0} onClick={()=>void act("submit")} aria-describedby="submission-status">Submit solution</button><p id="submission-status" role="status">{submission || "Your best judged solution counts. Results settle after the clock expires."}</p>
    </section><section className="card arena-problem"><p className="eyebrow">{match.problem.difficulty}</p><h2>{match.problem.title}</h2><p className="arena-text">{match.problem.statement}</p><h3>Function</h3><pre tabIndex={0} role="region" aria-label="Function signature">{match.problem.signature}</pre><h3>Constraints</h3><p className="arena-text">{match.problem.constraints}</p><h3>Examples</h3><pre tabIndex={0} role="region" aria-label="Problem examples">{JSON.stringify(match.problem.examples,null,2)}</pre></section></div>
    </main></div>;
}
