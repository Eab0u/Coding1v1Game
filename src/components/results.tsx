"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { DuelFeedback, useDuelFeedback } from "./duel-feedback";
import { Rematch } from "./rematch";
import type { DuelResult } from "../lib/results";
import { explainResult } from "../lib/result-explanation";
import { ratingTier } from "../lib/profile";
import { Badge } from "./ui";
import { DuelDate } from "./duel-date";
import { hasSubmissionScore } from "../lib/submission-score";

function validTime(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function validRating(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function delta(before:number,after:number) {
  const change=Math.round(after)-Math.round(before);
  return `${change>=0?"+":""}${change}`;
}
function RatingChange({before,after}:{before:number;after:number}) {
  const change=Math.round(after)-Math.round(before);
  const direction=change>0?"gain":change<0?"loss":"unchanged";
  return <span className={`rating-change rating-change--${direction}`} aria-label={`Rating change ${delta(before,after)}`}>
    {delta(before,after)}<small>{direction==="gain"?"MMR gained":direction==="loss"?"MMR lost":"MMR unchanged"}</small>
  </span>;
}
export function Results({result,matchId}:{result:DuelResult;matchId?:string}) {
  const feedback=useDuelFeedback();
  const {notify}=feedback;
  const cue=result.outcome==="WIN" ? "win" : result.outcome==="LOSS" ? "loss" : "draw";
  const seen=useRef<string|null>(null);
  useEffect(()=> {
    const key=`${matchId ?? "result"}:${cue}`;
    if (seen.current===key) return;
    seen.current=key;
    notify(cue);
  },[matchId,cue,notify]);
  return <div className="shell results"><a className="skip-link" href="#main-content">Skip to results</a><header className="site-header"><Link className="brand" href="/">Code<span className="accent">Duel</span></Link><span>Duel results</span><DuelFeedback feedback={feedback}/></header>
    <main id="main-content" tabIndex={-1}><section className={`card result-banner result-banner--${result.outcome.toLowerCase()}`} aria-label="Match outcome"><p className="eyebrow">{result.title}</p><h1>{result.outcome}</h1><p>{result.outcome==="WIN"?"Well played. Keep the momentum going.":result.outcome==="LOSS"?"Every duel is a chance to improve.":"An evenly matched duel."}</p><DuelDate value={result.completedAt}/>{result.players.length>0 && <a className="button button--secondary result-comparison-shortcut" href="#player-comparison">Compare players</a>}</section>
    <section className="card result-explanation" aria-labelledby="scoring-explanation"><h2 id="scoring-explanation">How this duel was decided</h2><p>{explainResult(result)}</p></section>
    <section className="card result-metrics-guide" aria-labelledby="metrics-guide-title"><details className="result-metrics-details"><summary id="metrics-guide-title">Reading the comparison</summary><p>Each player’s best judged submission counts, even if a later attempt was weaker.</p><dl><div><dt>Benchmark CPU</dt><dd>Milliseconds of CPU time on the largest tests, using the median of three runs. Lower is better when hidden test counts tie.</dd></div><div><dt>Submission time</dt><dd>Seconds from the start of the duel to that best submission. Earlier wins only when correctness and CPU time tie.</dd></div></dl><p>Displayed times are rounded; scoring uses saved precision. Missing historical metrics are shown as not recorded. Invalid saved times are shown as unavailable; the recorded match outcome still applies.</p></details></section>
    {result.players.length>0 && <h2 id="player-comparison" tabIndex={-1}>Player comparison</h2>}<div className="result-players">{result.players.map((p,i)=><section className="card result-player" key={p.username} aria-label={i===0?"Your result":"Opponent result"}><p className="eyebrow">{i===0?"YOU":"OPPONENT"}</p><h2><Link href={`/profile/${encodeURIComponent(p.username)}`}>{p.username}</Link></h2>
      {validRating(p.before) && validRating(p.after) ? <div className="result-rating"><strong>{Math.round(p.after)} MMR</strong><RatingChange before={p.before} after={p.after}/><p>Previously {Math.round(p.before)}</p><small>Change compares rounded MMR totals.</small></div>:p.before===null && p.after===null?<p>Rating not recorded</p>:<div className="result-rating"><strong>Rating unavailable</strong><p>The saved rating change could not be verified. The recorded match outcome still applies.</p></div>}
      {validRating(p.before) && validRating(p.after) && <div className="result-tier"><Badge tone="accent">{ratingTier(p.after)}</Badge><p>{ratingTier(p.before)===ratingTier(p.after)?"Tier unchanged":`Tier changed from ${ratingTier(p.before)} to ${ratingTier(p.after)}`}</p><small>Tier after this duel, based on full-precision MMR before display rounding.</small></div>}
      {hasSubmissionScore(p) && p.passed===0 && p.submitted===null && <div className="result-no-submission"><strong>No judged submission</strong><p>No judged attempt was available at settlement. The saved score uses zero passed tests and the full CPU limit for each benchmark test, rather than measured execution time.</p></div>}
      {hasSubmissionScore(p) && validTime(p.submitted) && <div className={`result-correctness result-correctness--${p.passed===p.total?"full":p.passed===0?"zero":"partial"}`}><label htmlFor={`result-tests-${i}`}>Hidden-test progress <span>{p.passed} / {p.total} passed</span></label><progress id={`result-tests-${i}`} value={p.passed} max={p.total} aria-valuetext={`${p.passed} of ${p.total} hidden tests passed`}/><Badge className="result-correctness-badge">{p.passed===p.total?"All hidden tests passed":p.passed===0?"No hidden tests passed":"Some hidden tests passed"}</Badge></div>}
      {hasSubmissionScore(p) && p.passed>0 && p.submitted===null && <div className="result-no-submission"><strong>Submission history unavailable</strong><p>The saved score includes passed tests but has no submission time. The recorded match outcome still applies.</p></div>}
      {p.submitted!==null && !validTime(p.submitted) && <div className="result-no-submission"><strong>Submission history unavailable</strong><p>The saved submission time could not be verified. The recorded match outcome still applies.</p></div>}
      {(p.passed!==null || p.total!==null) && !hasSubmissionScore(p) && <div className="result-correctness"><strong>Test score unavailable</strong><p>The saved test counts could not be verified. The recorded match outcome above still applies.</p></div>}
      {p.cpu!==null && !validTime(p.cpu) && <div className="result-no-submission"><strong>Benchmark CPU unavailable</strong><p>The saved CPU time could not be verified. It cannot be used to compare execution speed. The recorded match outcome still applies.</p></div>}
      <dl><dt>Hidden tests passed</dt><dd>{p.passed===null && p.total===null?"Not recorded":hasSubmissionScore(p)?`${p.passed} / ${p.total}`:"Unavailable"}</dd><dt>{hasSubmissionScore(p) && p.passed===0 && p.submitted===null?"Fallback benchmark CPU":"Median benchmark CPU"}</dt><dd>{p.cpu===null?"Not recorded":validTime(p.cpu)?`${p.cpu.toFixed(2)} ms`:"Unavailable"}</dd><dt>Submitted after start</dt><dd>{p.submitted===null?(p.passed===null && p.total===null?"Not recorded":hasSubmissionScore(p) && p.passed===0?"No submission":"Unavailable"):validTime(p.submitted)?`${(p.submitted/1000).toFixed(2)} s`:"Unavailable"}</dd></dl>
    </section>)}</div><p>Correctness first, then median CPU time across three benchmark runs, then earlier submission.</p>
    {matchId && <section className="card result-review" aria-labelledby="review-duel-title"><div><h2 id="review-duel-title">Learn from this duel</h2><p>Revisit the problem statement and examples in the completed arena. Submissions are closed; reopening does not restore your submitted code.</p></div><Link className="button button--secondary" href={`/match/${encodeURIComponent(matchId)}`}>Review problem</Link></section>}
    <div className="result-actions"><Link href="/" className="button button--primary">New match</Link><button className="button button--secondary" onClick={()=>{feedback.unlock();notify(cue);}}>Replay result</button></div><p>Replay animates your result. Turn sound on to hear it.</p>{matchId && <Rematch id={matchId}/>}
    </main></div>;
}
