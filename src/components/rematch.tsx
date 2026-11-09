"use client";
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import type { RematchState } from '../lib/rematch';
const pendingMessages: Record<string,string> = {
  invite: 'Sending invitation. Waiting for server confirmation.',
  accept: 'Accepting rematch. Waiting for the server to open your arena.',
  decline: 'Declining invitation. Waiting for server confirmation.',
  cancel: 'Cancelling invitation. Waiting for server confirmation.',
};
const terminalStatuses = new Set(['accepted','declined','cancelled','expired']);
const terminalMessages: Record<string,string> = {
  accepted: 'Rematch accepted. Your next arena is ready.',
  declined: 'The rematch was declined. Find a new rival when you are ready.',
  cancelled: 'The invitation was cancelled. Find a new rival when you are ready.',
  expired: 'The invitation expired without acceptance. Find a new rival when you are ready.',
};
// Server clock refreshes do not change which invitation an action concerned.
function invitationKey(state: RematchState | null) {
  return JSON.stringify([state?.status,state?.outgoing,state?.expiresAt,state?.matchId]);
}
export function Rematch({id}:{id:string}) {
  return <RematchSession key={id} id={id}/>;
}
function RematchSession({id}:{id:string}) {
  const summaryId=useId();
  const summary=useRef<HTMLParagraphElement|null>(null);
  const retryButton=useRef<HTMLButtonElement|null>(null);
  const focusRefreshedSummary=useRef(false);
  const inviteButton=useRef<HTMLButtonElement|null>(null);
  const focusSentSummary=useRef(false);
  const [state,setState]=useState<RematchState|null>(null);
  const [error,setError]=useState('');
  const [errorInvitation,setErrorInvitation]=useState('');
  const [pollError,setPollError]=useState('');
  const [updatesRestored,setUpdatesRestored]=useState(false);
  const hadPollError=useRef(false);
  const [refreshing,setRefreshing]=useState(false);
  const readPending=useRef(false);
  const [busy,setBusy]=useState(false);
  const [pendingAction,setPendingAction]=useState('');
  const [refresh,setRefresh]=useState(0);
  const revision=useRef(0);
  const actionController=useRef<AbortController|null>(null);
  const acceptButton=useRef<HTMLButtonElement|null>(null);
  const arenaLink=useRef<HTMLAnchorElement|null>(null);
  const focusAcceptedArena=useRef(false);
  const recoveryLink=useRef<HTMLAnchorElement|null>(null);
  const recoveryActionButton=useRef<HTMLButtonElement|null>(null);
  const focusRecovery=useRef(false);
  const terminal=state!==null && terminalStatuses.has(state.status);
  useEffect(()=>{
    if (!terminal || !focusAcceptedArena.current) return;
    focusAcceptedArena.current=false;
    if (state?.status==='accepted' && (document.activeElement===document.body || document.activeElement===acceptButton.current)) {
      arenaLink.current?.focus();
    }
  },[terminal,state]);
  useEffect(()=>{
    if (!terminal || !focusRecovery.current) return;
    focusRecovery.current=false;
    if ((state?.status==='declined' || state?.status==='cancelled') && (document.activeElement===document.body || document.activeElement===recoveryActionButton.current)) recoveryLink.current?.focus();
  },[terminal,state]);
  const [countdown,setCountdown]=useState<{source:RematchState;seconds:number}|null>(null);
  const expires=Date.parse(state?.expiresAt??'');
  const server=Date.parse(state?.serverNow??'');
  const remaining=state?.status==='pending' && Number.isFinite(expires) && Number.isFinite(server)
    ? countdown?.source===state?countdown.seconds:Math.max(0,Math.ceil((expires-server)/1000)) : null;
  useEffect(()=>{
    const expires=Date.parse(state?.expiresAt??'');
    const server=Date.parse(state?.serverNow??'');
    if (state?.status!=='pending' || !Number.isFinite(expires) || !Number.isFinite(server)) {
      return;
    }
    const started=performance.now();
    const tick=()=>setCountdown({source:state,seconds:Math.max(0,Math.ceil((expires-server-(performance.now()-started))/1000))});
    const timer=setInterval(tick,250);
    return ()=>clearInterval(timer);
  },[state]);
  const deadlinePassed=state?.status==='pending' && remaining===0;
  const deadlineSoon=remaining!==null && remaining>0 && remaining<=10 && !busy;
  useEffect(()=>()=>{revision.current++;actionController.current?.abort();},[]);
  useEffect(()=>{
    if (busy || terminal) return;
    const version=revision.current;
    let stopped=false; let timer:ReturnType<typeof setTimeout>;
    const controller=new AbortController();
    async function poll() {
      if (stopped || readPending.current) return;
      clearTimeout(timer);
      readPending.current=true;setRefreshing(true);
      try {
        const response=await fetch(`/api/matches/${id}/rematch`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
        const data=await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!stopped && revision.current===version) {
          if (hadPollError.current) setUpdatesRestored(true);
          hadPollError.current=false;
          setState(data);setPollError('');
          if (terminalStatuses.has(data.status)) return;
        }
      } catch {if (!stopped && revision.current===version) {focusRefreshedSummary.current=false;hadPollError.current=true;setUpdatesRestored(false);setPollError('Unable to refresh invitation. Automatic retries continue.');}}
      finally {if (!stopped && revision.current===version) {readPending.current=false;setRefreshing(false);}}
      if (!stopped && revision.current===version) timer=setTimeout(poll,2000);
    }
    function resume() {
      if (document.visibilityState==='visible') void poll();
    }
    document.addEventListener('visibilitychange',resume);
    void poll();
    return ()=>{stopped=true;controller.abort();clearTimeout(timer);readPending.current=false;document.removeEventListener('visibilitychange',resume);};
  },[id,refresh,busy,terminal]);
  useEffect(()=>{
    if (pollError || !state || !focusRefreshedSummary.current) return;
    focusRefreshedSummary.current=false;
    if (document.activeElement===document.body || document.activeElement===retryButton.current) summary.current?.focus();
  },[pollError,state]);
  useEffect(()=>{
    if (!state || state.status==='none' || !focusSentSummary.current) return;
    focusSentSummary.current=false;
    if (document.activeElement===document.body || document.activeElement===inviteButton.current) summary.current?.focus();
  },[state]);
  function retry() {
    if (readPending.current || actionController.current || terminal) return;
    focusRefreshedSummary.current=document.activeElement===retryButton.current;
    readPending.current=true;setRefreshing(true);setRefresh(n=>n+1);
  }
  async function act(action:string) {
    if (actionController.current || deadlinePassed) return;
    const controller=new AbortController();
    actionController.current=controller;
    focusSentSummary.current=action==='invite' && document.activeElement===inviteButton.current;
    focusAcceptedArena.current=action==='accept' && document.activeElement===acceptButton.current;
    focusRecovery.current=(action==='decline' || action==='cancel') && document.activeElement===recoveryActionButton.current;
    revision.current++;
    setBusy(true);setPendingAction(action);setError('');setErrorInvitation(invitationKey(state));
    try {
      const response=await fetch(`/api/matches/${id}/rematch?action=${action}`,{method:'POST',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
      const data=await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(data.error);
      // Restart polling so an older in-flight read cannot replace the action result.
      setUpdatesRestored(hadPollError.current);hadPollError.current=false;
      setRefresh(n=>n+1);setState(data);setPollError('');
    } catch(e) {if (!controller.signal.aborted) {focusSentSummary.current=false;focusAcceptedArena.current=false;focusRecovery.current=false;setError(e instanceof Error?e.message:'Unable to send invitation.');}}
    finally {if (!controller.signal.aborted) {actionController.current=null;setBusy(false);setPendingAction('');}}
  }
  const actionBusy=(action:string)=>busy && !deadlinePassed && pendingAction===action;
  return <section className={`card rematch-panel${terminal?' rematch-panel--settled':''}`} aria-label="Rematch invitation"><div className="rematch-heading"><h2>Another round?</h2>
    {state?.status==='pending' && !busy && !deadlinePassed && <span className={`rematch-cue${state.outgoing?'':' rematch-cue--incoming'}`}>{state.outgoing?'Invitation sent':'Your move'}</span>}
    </div>
    <p ref={summary} tabIndex={-1} id={summaryId} role="status" aria-live="polite" aria-atomic="true" className={terminal?'rematch-summary':busy && !deadlinePassed?'rematch-pending':undefined}>{terminal?terminalMessages[state.status]:deadlinePassed?'The invitation window has ended. Acceptance and invitation changes are closed. Waiting for server confirmation; no rematch is confirmed yet.':busy?pendingMessages[pendingAction]:!state && pollError?'Invitation status is unavailable. Automatic retries continue; no rematch is confirmed yet.':!state?'Checking invitation…':state.status==='none'?'Invite your opponent to a fresh ranked duel. They have 60 seconds to accept.':state.status==='pending'?(state.outgoing?'Waiting for your opponent. Invitation expires after 60 seconds.':'Your opponent invited you to a fresh ranked duel. Accept within 60 seconds.'):`Invitation ${state.status}.`}{deadlineSoon && <span className="sr-only"> Invitation closing soon: ten seconds or less remain.</span>}</p>
    {state?.status==='none' && <button ref={inviteButton} aria-describedby={summaryId} className="button button--secondary" disabled={busy} aria-busy={actionBusy('invite')} onClick={()=>void act('invite')}>{actionBusy('invite')?'Sending invitation?':'Rematch'}</button>}
    {state?.status==='pending' && remaining!==null && <div className={`rematch-deadline${deadlinePassed?' rematch-deadline--elapsed':deadlineSoon?' rematch-deadline--soon':''}`}>
      <p role="timer" aria-live="off" aria-label="Invitation time remaining">{remaining}s remaining</p>
      {deadlineSoon && <p className="rematch-deadline-warning">Invitation closing soon</p>}
      {deadlinePassed && <p role="status">Invitation deadline reached. Waiting for server confirmation.</p>}
    </div>}
    {state?.status==='pending' && (state.outgoing?<button ref={recoveryActionButton} aria-describedby={summaryId} className="button button--secondary" disabled={busy || deadlinePassed} aria-busy={actionBusy('cancel')} onClick={()=>void act('cancel')}>{actionBusy('cancel')?'Cancelling invitation?':'Cancel invitation'}</button>:<div className="result-actions"><button aria-describedby={summaryId} ref={acceptButton} className="button button--primary" disabled={busy || deadlinePassed} aria-busy={actionBusy('accept')} onClick={()=>void act('accept')}>{actionBusy('accept')?'Accepting rematch?':'Accept rematch'}</button><button ref={recoveryActionButton} aria-describedby={summaryId} className="button button--secondary" disabled={busy || deadlinePassed} aria-busy={actionBusy('decline')} onClick={()=>void act('decline')}>{actionBusy('decline')?'Declining invitation?':'Decline'}</button></div>)}
    {state?.matchId && <Link aria-describedby={summaryId} ref={arenaLink} className="button button--primary" href={`/match/${state.matchId}`}>Open rematch arena</Link>}
    {terminal && state.status!=='accepted' && <Link ref={recoveryLink} aria-describedby={summaryId} className="button button--primary" href="/">Find a new opponent</Link>}
    {error && errorInvitation===invitationKey(state) && !terminal && !deadlinePassed && <p role="alert">{error}</p>}
    <div aria-live="polite" aria-atomic="true">{updatesRestored && !terminal && <p className="rematch-restored">Invitation updates restored. Showing the latest server snapshot; automatic updates continue.</p>}</div>
    {pollError && !terminal && <div className="rematch-recovery">
      <p role="alert">{pollError}</p>
      <button ref={retryButton} aria-describedby={summaryId} className="button button--secondary" disabled={busy || refreshing} aria-busy={refreshing && !busy} onClick={retry}>{refreshing && !busy?'Refreshing invitation...':'Retry invitation update'}</button>
      {refreshing && !busy && <p role="status">Refreshing invitation...</p>}
    </div>}
  </section>;
}
