"use client";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { RematchState } from '../lib/rematch';
export function Rematch({id}:{id:string}) {
  const [state,setState]=useState<RematchState|null>(null);
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const [refresh,setRefresh]=useState(0);
  useEffect(()=>{
    let stopped=false; let timer:ReturnType<typeof setTimeout>;
    const controller=new AbortController();
    async function poll() {
      try {
        const response=await fetch(`/api/matches/${id}/rematch`,{cache:'no-store',signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10000)])});
        const data=await response.json();
        if (!response.ok) throw new Error(data.error);
        if (!stopped) {setState(data);setError('');}
      } catch {if (!stopped) setError('Unable to refresh invitation. Retrying…');}
      if (!stopped) timer=setTimeout(poll,2000);
    }
    void poll();
    return ()=>{stopped=true;controller.abort();clearTimeout(timer);};
  },[id,refresh]);
  async function act(action:string) {
    setBusy(true);setError('');
    try {
      const response=await fetch(`/api/matches/${id}/rematch?action=${action}`,{method:'POST',signal:AbortSignal.timeout(10000)});
      const data=await response.json();
      if (!response.ok) throw new Error(data.error);
      // Restart polling so an older in-flight read cannot replace the action result.
      setRefresh(n=>n+1);setState(data);
    } catch(e) {setError(e instanceof Error?e.message:'Unable to send invitation.');}
    finally {setBusy(false);}
  }
  return <section className="card" aria-label="Rematch invitation"><h2>Another round?</h2>
    <p role="status">{!state?'Checking invitation…':state.status==='none'?'Invite your opponent to a fresh ranked duel. They have 60 seconds to accept.':state.status==='pending'?(state.outgoing?'Waiting for your opponent. Invitation expires after 60 seconds.':'Your opponent invited you to a fresh ranked duel. Accept within 60 seconds.'):`Invitation ${state.status}.`}</p>
    {state?.status==='none' && <button className="button button--secondary" disabled={busy} onClick={()=>void act('invite')}>Rematch</button>}
    {state?.status==='pending' && (state.outgoing?<button className="button button--secondary" disabled={busy} onClick={()=>void act('cancel')}>Cancel invitation</button>:<div className="result-actions"><button className="button button--primary" disabled={busy} onClick={()=>void act('accept')}>Accept rematch</button><button className="button button--secondary" disabled={busy} onClick={()=>void act('decline')}>Decline</button></div>)}
    {state?.matchId && <Link className="button button--primary" href={`/match/${state.matchId}`}>Open rematch arena</Link>}
    {error && <p role="alert">{error}</p>}
  </section>;
}
