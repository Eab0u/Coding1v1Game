"use client";
import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import type { RematchState } from '../lib/rematch';
export function Rematch({id}:{id:string}) {
  return <RematchSession key={id} id={id}/>;
}
function RematchSession({id}:{id:string}) {
  const [state,setState]=useState<RematchState|null>(null);
  const [error,setError]=useState('');
  const [pollError,setPollError]=useState('');
  const [busy,setBusy]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const revision=useRef(0);
  const actionController=useRef<AbortController|null>(null);
  useEffect(()=>()=>{revision.current++;actionController.current?.abort();},[]);
  useEffect(()=>{
    if (busy) return;
    const version=revision.current;
    let stopped=false; let timer:ReturnType<typeof setTimeout>;
    const controller=new AbortController();
    async function poll() {
      try {
        const response=await fetch(`/api/matches/${id}/rematch`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
        const data=await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!stopped && revision.current===version) {setState(data);setPollError('');}
      } catch {if (!stopped && revision.current===version) setPollError('Unable to refresh invitation. Retrying…');}
      if (!stopped && revision.current===version) timer=setTimeout(poll,2000);
    }
    void poll();
    return ()=>{stopped=true;controller.abort();clearTimeout(timer);};
  },[id,refresh,busy]);
  async function act(action:string) {
    if (actionController.current) return;
    const controller=new AbortController();
    actionController.current=controller;
    revision.current++;
    setBusy(true);setError('');
    try {
      const response=await fetch(`/api/matches/${id}/rematch?action=${action}`,{method:'POST',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
      const data=await response.json();
      if (controller.signal.aborted) return;
      if (!response.ok) throw new Error(data.error);
      // Restart polling so an older in-flight read cannot replace the action result.
      setRefresh(n=>n+1);setState(data);
    } catch(e) {if (!controller.signal.aborted) setError(e instanceof Error?e.message:'Unable to send invitation.');}
    finally {if (!controller.signal.aborted) {actionController.current=null;setBusy(false);}}
  }
  return <section className="card" aria-label="Rematch invitation"><h2>Another round?</h2>
    <p role="status">{!state?'Checking invitation…':state.status==='none'?'Invite your opponent to a fresh ranked duel. They have 60 seconds to accept.':state.status==='pending'?(state.outgoing?'Waiting for your opponent. Invitation expires after 60 seconds.':'Your opponent invited you to a fresh ranked duel. Accept within 60 seconds.'):`Invitation ${state.status}.`}</p>
    {state?.status==='none' && <button className="button button--secondary" disabled={busy} onClick={()=>void act('invite')}>Rematch</button>}
    {state?.status==='pending' && (state.outgoing?<button className="button button--secondary" disabled={busy} onClick={()=>void act('cancel')}>Cancel invitation</button>:<div className="result-actions"><button className="button button--primary" disabled={busy} onClick={()=>void act('accept')}>Accept rematch</button><button className="button button--secondary" disabled={busy} onClick={()=>void act('decline')}>Decline</button></div>)}
    {state?.matchId && <Link className="button button--primary" href={`/match/${state.matchId}`}>Open rematch arena</Link>}
    {(error || pollError) && <p role="alert">{error || pollError}</p>}
  </section>;
}
