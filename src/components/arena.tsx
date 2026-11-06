"use client";
import Link from "next/link";
import { ProblemExamples } from "./problem-examples";
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
  const [refreshPending,setRefreshPending]=useState(false);
  const retryRefresh=useRef<(()=>Promise<void>)|null>(null);
  const [sending,setSending]=useState(false);
  const [readyAcknowledged,setReadyAcknowledged]=useState(false);
  const playerReady=match.player.ready || readyAcknowledged;
  const [submission,setSubmission]=useState("");
  const [submittedSource,setSubmittedSource]=useState<string|null>(null);
  const actionRequest=useRef<AbortController|null>(null);
  useEffect(()=>()=>{actionRequest.current?.abort();actionRequest.current=null;},[]);
  async function act(action: "ready" | "submit") {
    if (actionRequest.current || closed || (action==="ready" && playerReady)) return;
    const controller=new AbortController();
    actionRequest.current=controller;
    feedback.unlock();
    setSending(true);
    try {
      const response=await fetch(`/api/matches/${initial.id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...(action==="submit" ? {source} : {})}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
      const result=await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(result.error || "Request failed.");
      if (action==="submit") setSubmittedSource(source);
      if (action==="ready" && (result.status==="pending" || result.status==="active")) setReadyAcknowledged(true);
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
      setRefreshPending(true);
      try {
        const response=await fetch(`/api/matches/${initial.id}`,{cache:"no-store",signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
        if (!response.ok) throw new Error();
        const next:ArenaSnapshot=await response.json();
        if (!stopped) { received.current=performance.now();setElapsed(0);setMatch(next);setError(""); }
      } catch { if (!stopped) setError("Live updates unavailable. Retrying; progress may be out of date."); }
      refreshing=false;
      if (!stopped) setRefreshPending(false);
      if (!stopped) timer=setTimeout(refresh,2000);
    }
    retryRefresh.current=refresh;
    let timer=setTimeout(refresh,0);
    function resume() {
      if (document.visibilityState==="visible") void refresh();
    }
    document.addEventListener("visibilitychange",resume);
    return ()=>{stopped=true;retryRefresh.current=null;controller.abort();clearTimeout(timer);clearInterval(clock);document.removeEventListener("visibilitychange",resume);};
  },[initial.id,closed]);
  const seconds=remainingSeconds(match.deadline,match.serverTime,elapsed);
  return <div className="shell arena"><header className="site-header"><Link className="brand" href="/">Code<span className="accent">Duel</span></Link><span>Python arena</span><DuelFeedback feedback={feedback}/></header>
    <main id="main-content"><div className="arena-scoreboard">
      <div><span className="eyebrow">YOU</span><h2>{match.player.username}</h2><p>{Math.round(match.player.rating)} MMR</p></div>
      <div className="arena-clock"><span className="eyebrow">{match.status}</span><p role="timer" aria-label="Time remaining">{match.status==="pending" ? "Waiting to start" : seconds===null ? "No timer" : `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`}</p></div>
      <div><span className="eyebrow">OPPONENT</span><h2>{match.opponent.username}</h2><p>{Math.round(match.opponent.rating)} MMR</p></div>
    </div>
    {match.status==="pending" && <section className="arena-readiness" aria-label="Duel readiness" role="status">
      <div><span className={`badge${playerReady ? " arena-ready" : ""}`}>You: {playerReady ? "Ready" : "Not ready"}</span><span className={`badge${match.opponent.ready ? " arena-ready" : ""}`}>Opponent: {match.opponent.ready ? "Ready" : "Not ready"}</span></div>
      <p>{playerReady ? "Waiting for the server to start the duel when both players are ready." : "Review the problem, then mark yourself ready to start."} Reservations expire 60 seconds after pairing.</p>
    </section>}
    {match.status==="completed" && <Link className="button button--primary" href={`/match/${match.id}/results`}>View results</Link>}
    {match.status==="active" && seconds===0 && <section className="arena-settlement" aria-labelledby="settlement-title">
      <div role="status"><span className="badge">Results pending</span><h2 id="settlement-title">Time is up. Waiting for results.</h2><p>Submissions are closed. The server will finish judging submitted solutions before confirming the result and rating changes.</p><p className="muted">Sandbox delays can take longer. This page keeps checking automatically; your code is still available to copy or download.</p></div>
    </section>}
    {match.status==="cancelled" && <section className="arena-cancelled" aria-labelledby="cancelled-title">
      <div role="status"><h2 id="cancelled-title">Duel cancelled</h2><p>The reservation ended before both players were ready. No ratings changed.</p><p className="muted">Return home to find a new opponent. You can still copy or download the code visible in this tab before leaving.</p></div>
      <Link className="button button--primary" href="/">Back to matchmaking</Link>
    </section>}
    {error && !closed && <section className="arena-connection" aria-label="Live connection">
      <div><p role="alert">{error}</p><p className="muted">Your code stays in the editor. The server controls the clock and final result.</p></div>
      <button type="button" className="button button--secondary" disabled={refreshPending} onClick={()=>void retryRefresh.current?.()}>Retry live updates</button>
      <span role="status">{refreshPending ? "Refreshing match state…" : "Automatic retries continue every two seconds."}</span>
    </section>}
    <section className="arena-progress" aria-label="Opponent progress"><label htmlFor="opponent-progress">Opponent tests passed: {match.progress ? `${match.progress.passed} / ${match.progress.total}` : "No judged submission yet"}</label><progress id="opponent-progress" value={match.progress?.passed ?? 0} max={match.progress?.total ?? 1}/></section>
    <div className="arena-columns"><section className="card arena-editor"><div className="arena-panel-heading"><h1>Your solution</h1><span className="badge">Python 3</span></div>
      <SolutionEditor value={source} onChange={setSource} readOnly={closed} starter={`${initial.problem.signature}\n    pass\n`}/>
      {!closed && <p role="status">{saved ? "Draft saved in this tab. Refreshing restores it. Recovery ends when the match ends." : "Draft recovery unavailable. Keep this tab open to retain your code."}</p>}
      {match.submission && <p role="status">{match.submission.status==="judged" ? `Latest solution: ${match.submission.passed} / ${match.submission.total} tests passed.` : match.submission.status==="error" ? "Sandbox temporarily unavailable. Your submission will retry; results are waiting." : "Your solution is being judged."}</p>}
      <p>{closed ? "This match has ended." : match.status==="pending" ? "Match reserved. The server has not started the clock." : seconds===0 ? "Time expired. Awaiting the server result." : "Clock and opponent progress are synchronized with the server."}</p>
      {match.status==="active" && <div className="arena-submission-state" role="status">
        <strong>{submittedSource===null ? "Check your latest edits" : submittedSource===source ? "Current code sent" : "Edits not submitted"}</strong>
        <p>{submittedSource===null ? "This tab cannot confirm whether the current code was submitted. Saving a draft does not submit it." : submittedSource===source ? "The server acknowledged this code. Judging and your best score are shown separately." : seconds===0 ? "These edits differ from the last code acknowledged in this tab. Submissions are now closed; you can still copy or download your work." : "Your code differs from the last submission acknowledged in this tab. Submit again to send these edits."}</p>
      </div>}
      {match.status==="pending" && <button className="button button--primary" disabled={sending || playerReady} onClick={()=>void act("ready")}>{playerReady ? "Ready confirmed" : "Ready to duel"}</button>}
      <button className="button button--primary" disabled={sending || match.status!=="active" || seconds===0} onClick={()=>void act("submit")} aria-describedby="submission-status">Submit solution</button><p id="submission-status" role="status">{submission || "Your best judged solution counts. Results settle after the clock expires."}</p>
    </section><section className="card arena-problem"><p className="eyebrow">{match.problem.difficulty}</p><h2>{match.problem.title}</h2><p className="arena-text">{match.problem.statement}</p><h3>Function</h3><pre tabIndex={0} role="region" aria-label="Function signature">{match.problem.signature}</pre><h3>Constraints</h3><p className="arena-text">{match.problem.constraints}</p><h3>Examples</h3><ProblemExamples examples={match.problem.examples}/></section></div>
    </main></div>;
}
