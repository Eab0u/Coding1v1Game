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

function delta(before:number,after:number) {
  const change=Math.round(after)-Math.round(before);
  return `${change>=0?"+":""}${change}`;
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
    <main id="main-content" tabIndex={-1}><section className={`card result-banner result-banner--${result.outcome.toLowerCase()}`} aria-label="Match outcome"><p className="eyebrow">{result.title}</p><h1>{result.outcome}</h1><p>{result.outcome==="WIN"?"Well played. Keep the momentum going.":result.outcome==="LOSS"?"Every duel is a chance to improve.":"An evenly matched duel."}</p><DuelDate value={result.completedAt}/></section>
    <section className="card result-explanation" aria-labelledby="scoring-explanation"><h2 id="scoring-explanation">How this duel was decided</h2><p>{explainResult(result)}</p></section>
    <div className="result-players">{result.players.map((p,i)=><section className="card result-player" key={p.username} aria-label={i===0?"Your result":"Opponent result"}><p className="eyebrow">{i===0?"YOU":"OPPONENT"}</p><h2><Link href={`/profile/${encodeURIComponent(p.username)}`}>{p.username}</Link></h2>
      {p.before!==null && p.after!==null ? <div className="result-rating"><strong>{Math.round(p.after)} MMR</strong><span className="rating-change" aria-label={`Rating change ${delta(p.before,p.after)}`}>{delta(p.before,p.after)}</span><p>Previously {Math.round(p.before)}</p></div>:<p>Rating not recorded</p>}
      {p.before!==null && p.after!==null && <div className="result-tier"><Badge tone="accent">{ratingTier(p.after)}</Badge><p>{ratingTier(p.before)===ratingTier(p.after)?"Tier unchanged":`Tier changed from ${ratingTier(p.before)} to ${ratingTier(p.after)}`}</p><small>Tier after this duel, based on full-precision MMR before display rounding.</small></div>}
      <dl><dt>Hidden tests passed</dt><dd>{p.passed===null?"Not recorded":`${p.passed} / ${p.total}`}</dd><dt>Median benchmark CPU</dt><dd>{p.cpu===null?"Not recorded":`${p.cpu.toFixed(2)} ms`}</dd><dt>Submitted after start</dt><dd>{p.passed===null?"Not recorded":p.submitted===null?"No submission":`${(p.submitted/1000).toFixed(2)} s`}</dd></dl>
    </section>)}</div><p>Correctness first, then median CPU time across three benchmark runs, then earlier submission.</p>
    <div className="result-actions"><Link href="/" className="button button--primary">New match</Link><button className="button button--secondary" onClick={()=>{feedback.unlock();notify(cue);}}>Replay result</button></div><p>Replay animates your result. Turn sound on to hear it.</p>{matchId && <Rematch id={matchId}/>}
    </main></div>;
}
