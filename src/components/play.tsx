"use client";
import { useEffect, useRef, useState } from "react";
import { Button } from "./ui";
import { DuelFeedback, useDuelFeedback } from "./duel-feedback";
import type { QueueEvent } from "../lib/matchmaking";

export function Play({ signedIn }: { signedIn: boolean }) {
  const feedback = useDuelFeedback();
  const socket = useRef<WebSocket | null>(null);
  const [phase, setPhase] = useState("idle");
  const [message, setMessage] = useState("Python only · Rating bands widen as you wait.");
  useEffect(() => () => { const ws = socket.current; socket.current = null; ws?.close(); }, []);
  function join() {
    if (socket.current) return;
    feedback.unlock();
    setPhase("connecting"); setMessage("Connecting to the arena…");
    const url = new URL("/matchmaking", window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const ws = new WebSocket(url);
    socket.current = ws;
    const timer = window.setTimeout(() => { if (socket.current === ws) { socket.current = null; ws.close(); setPhase("idle"); setMessage("Connection timed out. Please try again."); } }, 10000);
    ws.onopen = () => { if (socket.current === ws) { clearTimeout(timer); ws.send(JSON.stringify({ type: "join" })); } };
    ws.onmessage = event => {
      if (socket.current !== ws) return;
      try {
        const data: QueueEvent = JSON.parse(event.data);
        if (data.type === "queued") { setPhase("queued"); setMessage(`Finding opponent… ${data.waitedSeconds}s elapsed · Rating range ±${data.ratingBand}. Wait estimate unavailable.`); }
        else if (data.type === "matching") { setPhase("matching"); setMessage("Reserving your match…"); }
        else if (data.type === "matched") { feedback.notify("matched"); setPhase("matched"); setMessage(`Matched with ${data.opponent.username} (${Math.round(data.opponent.rating)}) · ${data.match.difficulty}. Your match is reserved; the arena screen is coming soon.`); socket.current = null; ws.close(); }
        else if (data.type === "left" || data.type === "error") { socket.current = null; ws.close(); setPhase("idle"); setMessage(data.type === "error" ? data.message : "Search cancelled. Ready when you are."); }
      } catch { socket.current = null; ws.close(); setPhase("idle"); setMessage("Unexpected server response. Please try again."); }
    };
    ws.onclose = ws.onerror = () => { clearTimeout(timer); if (socket.current === ws) { socket.current = null; ws.close(); setPhase("idle"); setMessage("Connection lost. Sign in again or retry matchmaking."); } };
  }
  return <div className={`play-panel play-panel--${phase}`}>
    {!signedIn ? <a className="button button--primary play-button" href="/account">Sign in to play</a> : <>
      <Button className="play-button" onClick={join} disabled={phase !== "idle"}>{phase === "idle" ? "Play a duel" : phase === "matched" ? "Match reserved" : "Finding opponent…"}</Button>
      {(phase === "queued" || phase === "connecting") && <Button variant="ghost" onClick={() => {
        const ws = socket.current;
        if (ws?.readyState === WebSocket.OPEN) { setPhase("cancelling"); ws.send(JSON.stringify({ type: "leave" })); }
        else { socket.current = null; ws?.close(); setPhase("idle"); setMessage("Search cancelled. Ready when you are."); }
      }}>Cancel search</Button>}
    </>}
    {signedIn && <DuelFeedback feedback={feedback} />}
    <p className="availability" role="status">{message}</p>
  </div>;
}
