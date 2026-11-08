"use client";
import Link from "next/link";
import { JudgingGuide } from "./judging-guide";
import { ProblemExamples } from "./problem-examples";
import { ArenaProgress } from "./arena-progress";
import { SubmissionStatus } from "./submission-status";
import { hasSubmissionScore } from "../lib/submission-score";
import { useEffect, useId, useRef, useState } from "react";
import type { ArenaSnapshot } from "../lib/arena";
import { DuelFeedback, useDuelFeedback } from "./duel-feedback";
import { useArenaDraft } from "./use-arena-draft";
import { SolutionEditor } from "./solution-editor";
import { MAX_SOLUTION_LENGTH, solutionError } from "../lib/solution-validation";
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
  // Valid existing verdicts are history; unavailable scores may recover on a later poll.
  const seenVerdicts=useRef(new Set(initial.submission?.status==="judged" && hasSubmissionScore(initial.submission) && initial.submission.id ? [initial.submission.id] : []));
  useEffect(()=> {
    const verdict=match.submission;
    if (!verdict?.id || verdict.status!=="judged" || !hasSubmissionScore(verdict) || seenVerdicts.current.has(verdict.id)) return;
    seenVerdicts.current.add(verdict.id);
    notify(verdict.passed===verdict.total ? "passed" : "failed");
  },[match.submission,notify]);
  const closed=match.status==="completed" || match.status==="cancelled";
  const {source,setSource,saved,readFailed,retrySaving,canRetryReading,retryReading}=useArenaDraft(initial.id,initial.player.username,initial.problem.signature,closed);
  const draftGuidanceId=useId();
  const draftGuidance=useRef<HTMLParagraphElement>(null);
  const sourceError=solutionError(source);
  const [elapsed,setElapsed]=useState(0);
  const [error,setError]=useState("");
  const [connectionRecovered,setConnectionRecovered]=useState(false);
  const [refreshPending,setRefreshPending]=useState(false);
  const retryRefresh=useRef<(()=>Promise<void>)|null>(null);
  const [sending,setSending]=useState<"ready"|"submit"|null>(null);
  const [readyAcknowledged,setReadyAcknowledged]=useState(false);
  const playerReady=match.player.ready || readyAcknowledged;
  const [submission,setSubmission]=useState<{phase:ArenaSnapshot["status"];message:string}|null>(null);
  const [submittedSource,setSubmittedSource]=useState<string|null>(null);
  const actionRequest=useRef<AbortController|null>(null);
  useEffect(()=>()=>{actionRequest.current?.abort();actionRequest.current=null;},[]);
  async function act(action: "ready" | "submit") {
    if (actionRequest.current || closed || (action==="submit" && (sourceError || match.status!=="active" || seconds===0)) || (action==="ready" && reservationExpired) || (action==="ready" && playerReady)) return;
    const controller=new AbortController();
    actionRequest.current=controller;
    feedback.unlock();
    setSending(action);
    try {
      const response=await fetch(`/api/matches/${initial.id}`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action,...(action==="submit" ? {source} : {})}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
      const result=await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(result.error || "Request failed.");
      if (action==="submit") setSubmittedSource(source);
      if (action==="ready" && (result.status==="pending" || result.status==="active")) setReadyAcknowledged(true);
      setSubmission({phase:match.status,message:action==="ready" ? "Ready. Waiting for both players; reservations expire after 60 seconds." : "Solution queued. The server will judge it in the sandbox."});
    } catch (error) { if (!controller.signal.aborted) setSubmission({phase:match.status,message:error instanceof Error ? error.message : "Request failed."}); }
    finally { if (actionRequest.current===controller) {actionRequest.current=null;setSending(null);} }
  }
  const received=useRef(0);
  useEffect(()=> {
    if (closed) return;
    received.current=performance.now();
    const clock=setInterval(()=>setElapsed(performance.now()-received.current),250);
    let stopped=false;
    let refreshing=false;
    let connectionFailed=false;
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
        if (!stopped) { received.current=performance.now();setElapsed(0);setMatch(next);setError("");if (connectionFailed) setConnectionRecovered(true);connectionFailed=false; }
      } catch { if (!stopped) {connectionFailed=true;setConnectionRecovered(false);setError("Live updates unavailable. Retrying; progress may be out of date.");} }
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
  const reservationSeconds=remainingSeconds(match.reservationExpiresAt ?? null,match.serverTime,elapsed);
  const reservationExpired=match.status==="pending" && reservationSeconds===0;
  const seconds=remainingSeconds(match.deadline,match.serverTime,elapsed);
  const submissionExpired=match.status==="active" && seconds===0;
  const actionPending=!!sending && !submissionExpired && !reservationExpired && match.status===(sending==="ready" ? "pending" : "active");
  const progressPhase=match.status==="active" ? seconds===0 ? "settling" : "active"
    : match.status==="completed" ? "completed" : match.status==="cancelled" ? "cancelled" : "pending";
  const finalMinute=match.status==="active" && seconds!==null && seconds>0 && seconds<=60;
  return <div className="shell arena"><a className="skip-link" href="#main-content">Skip to duel</a><header className="site-header"><Link className="brand" href="/">Code<span className="accent">Duel</span></Link><span>Python arena</span><DuelFeedback feedback={feedback}/></header>
    <main id="main-content" tabIndex={-1}><nav className="arena-navigation" aria-label="Arena sections"><a className="button button--secondary" href="#arena-problem-title">Read problem</a><a className="button button--secondary" href="#arena-solution-title">Your solution</a></nav><div className="arena-scoreboard">
      <div><span className="eyebrow">YOU</span><h2>{match.player.username}</h2><p>{Math.round(match.player.rating)} MMR</p></div>
      <div className={`arena-clock${match.status==="pending" && reservationSeconds!==null ? " arena-clock--reservation" : ""}${finalMinute ? " arena-clock--urgent" : ""}`}><span className="eyebrow">{match.status}</span><p role="timer" aria-label="Time remaining">{match.status==="pending" ? reservationSeconds===null ? "Waiting to start" : reservationSeconds===0 ? "Confirming status" : `Ready in ${reservationSeconds}s` : seconds===null ? "No timer" : `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,"0")}`}</p></div>
      <div><span className="eyebrow">OPPONENT</span><h2>{match.opponent.username}</h2><p>{Math.round(match.opponent.rating)} MMR</p></div>
    </div>
    <p role="status" aria-label="Duel start" aria-live="polite" aria-atomic="true" className={match.status==="active" && seconds!==null && seconds>0 ? "arena-started" : "sr-only"}>{match.status==="active" && seconds!==null && seconds>0 ? "Duel started. The clock is running. You can now submit your solution; submit your latest edits before time expires." : ""}</p>
    <div role="status" aria-atomic="true" className={finalMinute ? "arena-time-warning" : undefined}>{finalMinute ? "Final minute. Submit your latest edits before the clock expires." : ""}</div>
    <p role="status" aria-label="Readiness expiry" aria-live="polite" aria-atomic="true" className="sr-only">{reservationExpired ? "Time to mark ready has expired. Waiting for server confirmation of activation or cancellation. This page keeps checking automatically; no result or rating change is confirmed." : ""}</p>
    {match.status==="pending" && <section className="arena-readiness" aria-label="Duel readiness" role="status" aria-live={reservationExpired ? "off" : "polite"}>
      <div><span className={`badge${playerReady ? " arena-ready" : ""}`}>You: {playerReady ? "Ready" : "Not ready"}</span><span className={`badge${match.opponent.ready ? " arena-ready" : ""}`}>Opponent: {match.opponent.ready ? "Ready" : "Not ready"}</span></div>
      <p>{reservationExpired ? "The readiness window has ended. Checking with the server for activation or cancellation; no result is confirmed yet." : playerReady ? "Waiting for the server to start the duel when both players are ready." : "Review the problem, then mark yourself ready to start."} Reservations expire 60 seconds after pairing.</p>
    </section>}
    <div role="status" aria-label="Duel completion" aria-live="polite" aria-atomic="true" className="sr-only">{match.status==="completed" ? "Duel complete. Results are ready. View results for the outcome and recorded rating changes." : ""}</div>
    {match.status==="completed" && <section className="arena-completed" aria-labelledby="completed-title">
      <div><h2 id="completed-title">Duel complete. Results are ready.</h2><p>View the outcome, score comparison and recorded rating changes on your results page.</p><p className="muted">You can still copy or download the code visible in this tab before leaving.</p></div>
      <Link className="button button--primary" href={`/match/${match.id}/results`}>View results</Link>
    </section>}
    <div role="status" aria-label="Duel settlement" aria-live="polite" aria-atomic="true" className="sr-only">{match.status==="active" && seconds===0 ? "Time is up. Submissions are closed. Waiting for the server to finish judging before confirming results and rating changes. This page keeps checking automatically; you can still copy or download your code." : ""}</div>
    {match.status==="active" && seconds===0 && <section className="arena-settlement" aria-labelledby="settlement-title">
      <div><span className="badge">Results pending</span><h2 id="settlement-title">Time is up. Waiting for results.</h2><p>Submissions are closed. The server will finish judging submitted solutions before confirming the result and rating changes.</p><p className="muted">Sandbox delays can take longer. This page keeps checking automatically; your code is still available to copy or download.</p></div>
    </section>}
    <div role="status" aria-label="Duel cancellation" aria-live="polite" aria-atomic="true" className="sr-only">{match.status==="cancelled" ? "Duel cancelled. No ratings changed. Return home to find a new opponent. You can still copy or download your code before leaving." : ""}</div>
    {match.status==="cancelled" && <section className="arena-cancelled" aria-labelledby="cancelled-title">
      <div><h2 id="cancelled-title">Duel cancelled</h2><p>The reservation ended before both players were ready. No ratings changed.</p><p className="muted">Return home to find a new opponent. You can still copy or download the code visible in this tab before leaving.</p></div>
      <Link className="button button--primary" href="/">Back to matchmaking</Link>
    </section>}
    {error && !closed && <section className="arena-connection" aria-label="Live connection">
      <div><p role="alert">{error}</p><p className="muted">Your code stays in the editor. The server controls the clock and final result.</p></div>
      <button type="button" className="button button--secondary" disabled={refreshPending} onClick={()=>void retryRefresh.current?.()}>Retry live updates</button>
      <span role="status">{refreshPending ? "Refreshing match state…" : "Automatic retries continue every two seconds."}</span>
    </section>}
    <p role="status" aria-label="Live update recovery" aria-live="polite" aria-atomic="true" className={connectionRecovered ? "arena-connection-recovered" : "sr-only"}>{connectionRecovered ? "Live updates restored. Match status and progress refreshed from the server." : ""}</p>
    <ArenaProgress score={match.progress} phase={progressPhase}/>
    <div className="arena-columns"><section className="card arena-editor"><div className="arena-panel-heading"><h1 id="arena-solution-title" tabIndex={-1}>Your solution</h1><span className="badge">Python 3</span></div>
      <div onKeyDownCapture={event=>{
        if (event.key!=="Enter" || !(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey || event.repeat || event.nativeEvent.isComposing) return;
        const target=event.target;
        if (!(target instanceof HTMLElement) || !(target.tagName==="TEXTAREA" || target.isContentEditable)) return;
        event.preventDefault();
        event.stopPropagation();
        void act("submit");
      }}>
        <SolutionEditor value={source} onChange={setSource} readOnly={closed} starter={`${initial.problem.signature}\n    pass\n`}/>
      </div>
      <p className="muted" id="submit-shortcut">{closed ? "Submissions are closed. You can still copy or download your code." : match.status==="pending" ? "The submission shortcut becomes available when the duel starts." : seconds===0 ? "Submissions are closed while the server confirms results. You can still copy or download your code." : "From the editor, press Ctrl+Enter or Command+Enter to submit your solution."}</p>
      <ArenaProgress score={match.bestProgress} player phase={progressPhase}/>
      {!closed && <p id={draftGuidanceId} ref={draftGuidance} tabIndex={-1} className={saved ? undefined : "solution-editor-recovery"} role="status" aria-atomic="true">{saved ? "Draft saved in this tab. Refreshing restores it. Recovery ends when the match ends." : readFailed ? "Draft recovery unavailable. The saved draft could not be read. Automatic saving is paused to protect any earlier code. Your browser may ask for confirmation before leaving or refreshing while recovery is unavailable. Keep this tab open or download your solution. Before editing, Retry reading draft can recover earlier code without replacing it. After editing, reading is paused to protect your current code. Retry saving draft replaces any unread saved draft with the code currently in the editor. Saving a draft does not submit it." : "Draft recovery unavailable. Keep this tab open to retain your code. Retry saving your current draft after browser storage becomes available, or download your solution. Saving a draft does not submit it."}</p>}
      {canRetryReading && <button type="button" className="button button--secondary" aria-describedby={draftGuidanceId} onClick={event=>{
        const focused=document.activeElement===event.currentTarget;
        if (retryReading() && focused) draftGuidance.current?.focus();
      }}>Retry reading draft</button>}
      {!closed && !saved && <button type="button" className="button button--secondary" aria-describedby={draftGuidanceId} onClick={event=>{
        const focused=document.activeElement===event.currentTarget;
        if (retrySaving() && focused) draftGuidance.current?.focus();
      }}>Retry saving draft</button>}
      <SubmissionStatus submission={match.submission} phase={progressPhase}/>
      <p>{closed ? "This match has ended." : match.status==="pending" ? "Match reserved. The server has not started the clock." : seconds===0 ? "Time expired. Awaiting the server result." : "Clock and opponent progress are synchronized with the server."}</p>
      {match.status==="active" && <div className="arena-submission-state" role="status">
        <strong>{submittedSource===null ? "Check your latest edits" : submittedSource===source ? "Current code sent" : "Edits not submitted"}</strong>
        <p>{submittedSource===null ? "This tab cannot confirm whether the current code was submitted. Saving a draft does not submit it." : submittedSource===source ? "The server acknowledged this code. Judging and your best score are shown separately." : seconds===0 ? "These edits differ from the last code acknowledged in this tab. Submissions are now closed; you can still copy or download your work." : "Your code differs from the last submission acknowledged in this tab. Submit again to send these edits."}</p>
      </div>}
      {match.status==="pending" && <button className="button button--primary" aria-busy={actionPending && sending==="ready"} aria-describedby="submission-status" disabled={!!sending || playerReady || reservationExpired} onClick={()=>void act("ready")}>{playerReady ? "Ready confirmed" : "Ready to duel"}</button>}
      {!closed && <div className={`arena-source-limit${sourceError ? " arena-source-limit--invalid" : ""}`}>
        <p id="solution-size">{source.length.toLocaleString("en-US")} / {MAX_SOLUTION_LENGTH.toLocaleString("en-US")} character units <span className="muted">(Python source limit)</span></p>
        <p id="solution-validation" role="status">{sourceError || "Within the submission limit. Some symbols count as two character units."}</p>
      </div>}
      <button className="button button--primary" aria-busy={actionPending && sending==="submit"} disabled={!!sending || match.status!=="active" || seconds===0 || !!sourceError} onClick={()=>void act("submit")} aria-keyshortcuts="Control+Enter Meta+Enter" aria-describedby={closed ? "submission-status submit-shortcut" : "solution-size solution-validation submission-status submit-shortcut"}>Submit solution</button><p id="submission-status" role="status" aria-atomic="true" className={actionPending ? "arena-action-pending" : undefined}>{submissionExpired ? "Submissions are closed. Waiting for the server to finish judging and confirm results; this page keeps checking automatically. You can still copy or download your code." : reservationExpired ? "Readiness is closed. Waiting for server confirmation of activation or cancellation; this page keeps checking automatically." : actionPending && sending==="ready" ? "Confirming readiness with the server. Please wait for acknowledgement." : actionPending && sending==="submit" ? "Sending your solution. Waiting for server acknowledgement; edits made now are not included in this request." : (submission?.phase===match.status ? submission.message : "") || (match.status==="completed" ? "Results are ready. View results for the outcome and recorded rating changes." : match.status==="cancelled" ? "Duel cancelled. No ratings changed." : match.status==="pending" ? (playerReady ? "Readiness confirmed. Waiting for the server to start the duel." : "Mark yourself ready before the reservation expires.") : "Your best judged solution counts. Results settle after the clock expires.")}</p>
    </section><section className="card arena-problem"><p className="eyebrow">{match.problem.difficulty}</p><h2 id="arena-problem-title" tabIndex={-1}>{match.problem.title}</h2><p className="arena-text">{match.problem.statement}</p><h3>Function</h3><p id="arena-signature-hint" className="signature-hint">Keep this function name and parameters in your solution. Long signatures scroll sideways; focus the code and use the arrow keys, or swipe.</p><pre className="arena-signature" tabIndex={0} role="region" aria-label="Function signature" aria-describedby="arena-signature-hint"><code>{match.problem.signature}</code></pre><section className="problem-constraints" aria-labelledby="problem-constraints-title"><h3 id="problem-constraints-title">Constraints</h3><p className="arena-text">{match.problem.constraints}</p><details className="complexity-guide"><summary>Use input limits to plan your solution</summary><p>Check the largest allowed input, not just the examples. For 100,000 items, visiting every pair can require about 5 billion comparisons; a single pass visits 100,000 items.</p><p>Look for repeated work you can avoid. Depending on the problem, sorting, a hash map or keeping a running total may help. These are planning examples, not a required approach or a guarantee of passing the CPU limit.</p></details></section><JudgingGuide/><h3>Examples</h3><ProblemExamples examples={match.problem.examples}/><a className="button button--secondary arena-return" href="#arena-solution-title">Back to your solution</a></section></div>
    </main></div>;
}
