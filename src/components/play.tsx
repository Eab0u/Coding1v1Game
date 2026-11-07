"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Button } from "./ui";
import { DuelFeedback, useDuelFeedback } from "./duel-feedback";
import type { QueueEvent } from "../lib/matchmaking";
import Link from "next/link";

export function Play({ signedIn }: { signedIn: boolean }) {
  const feedback = useDuelFeedback();
  const guidanceId = useId();
  const panel = useRef<HTMLDivElement>(null);
  const arenaLink = useRef<HTMLAnchorElement>(null);
  const focusArena = useRef(false);
  const focusAfterSearch = useRef(false);
  const socket = useRef<WebSocket | null>(null);
  const leave = useRef<(() => void) | null>(null);
  const responseTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function clearResponseTimer() {
    if (responseTimer.current !== null) clearTimeout(responseTimer.current);
    responseTimer.current = null;
  }
  const [phase, setPhase] = useState("idle");
  const [queueStats, setQueueStats] = useState<{ waitedSeconds: number; ratingBand: number } | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);
  const [message, setMessage] = useState("Python only · Rating bands widen as you wait.");
  useEffect(() => () => { const ws = socket.current; socket.current = null; clearResponseTimer(); ws?.close(); }, []);
  useEffect(() => {
    if (!matchId || !focusArena.current) return;
    focusArena.current = false;
    // Preserve navigation that happened after the server frame, before commit.
    if (document.activeElement === document.body || panel.current?.querySelector(".play-button") === document.activeElement) {
      arenaLink.current?.focus();
    }
  }, [matchId]);
  useEffect(() => {
    if (phase === "matched" || phase === "matching") focusAfterSearch.current = false;
    if (phase !== "idle" || !focusAfterSearch.current) return;
    focusAfterSearch.current = false;
    const play = panel.current?.querySelector<HTMLButtonElement>(".play-button");
    if (document.activeElement === document.body || document.activeElement === play) play?.focus();
  }, [phase]);
  function restoreIdle() {
    if (panel.current?.querySelector("[data-search-cancel]")?.matches(":focus")) focusAfterSearch.current = true;
    setPhase("idle");
  }
  function join() {
    if (socket.current) return;
    focusArena.current = false;
    feedback.unlock();
    setPhase("connecting"); setMessage("Connecting to the arena…");
    const url = new URL("/matchmaking", window.location.href);
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    let ws: WebSocket;
    try { ws = new WebSocket(url); }
    catch {
      restoreIdle();
      setMessage("Could not open a matchmaking connection. Please try again.");
      return;
    }
    socket.current = ws;
    let cancelling = false;
    let reserving = false;
    function awaitResponse(message: string, timeout = 10000) {
      clearResponseTimer();
      responseTimer.current = setTimeout(() => {
        if (socket.current !== ws) return;
        socket.current = null;
        clearResponseTimer();
        ws.close();
        restoreIdle(); setMessage(message);
      }, timeout);
    }
    function send(type: "join" | "leave") {
      if (type === "leave") cancelling = true;
      awaitResponse(type === "join" ? "The server did not confirm your search. Please try again." : "Cancellation was not confirmed. Connection closed; retry to recover any reserved match.");
      try { ws.send(JSON.stringify({ type })); }
      catch { ws.onerror?.(new Event("error")); }
    }
    awaitResponse("Connection timed out. Please try again.");
    ws.onopen = () => { if (socket.current === ws) send("join"); };
    // Keep the leave command and its timeout scoped to this connection.
    leave.current = () => send("leave");
    ws.onmessage = event => {
      if (socket.current !== ws) return;
      try {
        const data: QueueEvent = JSON.parse(event.data);
        if (!data || typeof data !== "object" || Array.isArray(data)
          || !["queued", "matching", "matched", "left", "error"].includes(data.type)
          || (data.type === "error" && (typeof data.message !== "string" || !data.message.trim()))) {
          throw new Error("Invalid matchmaking response");
        }
        if (cancelling && (data.type === "queued" || data.type === "matching")) return;
        // Reservation frames must not renew the deadline or return us to the queue.
        if (reserving && (data.type === "queued" || data.type === "matching")) return;
        if (["queued", "matching", "matched", "left", "error"].includes(data.type)) clearResponseTimer();
        if (data.type === "queued") {
          if (!Number.isSafeInteger(data.waitedSeconds) || data.waitedSeconds < 0 || !Number.isSafeInteger(data.ratingBand) || data.ratingBand < 100 || data.ratingBand > 800 || data.ratingBand % 50 !== 0) throw new Error("Invalid queue status");
          setQueueStats({ waitedSeconds: data.waitedSeconds, ratingBand: data.ratingBand });
          setPhase("queued"); setMessage("Finding opponent. Rating bands widen as you wait. Wait estimate unavailable.");
          // The worker sends queue status every second. Bound stale searching
          // even when the browser never reports a broken connection.
          awaitResponse("Search updates stopped. Connection closed; retry to recover any reserved match.", 30000);
        }
        else if (data.type === "matching") {
          reserving = true;
          focusArena.current = !!panel.current?.querySelector("[data-search-cancel]")?.matches(":focus");
          setPhase("matching"); setMessage("Reserving your match… Waiting for server confirmation.");
          awaitResponse("Your reservation was not confirmed. Connection closed; retry to recover any reserved match.");
        }
        else if (data.type === "matched") {
          // A parsed frame is still untrusted runtime data. Validate before
          // notifying, moving focus or constructing a navigation destination.
          if (!data.match || typeof data.match.id !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(data.match.id)
            || !["easy", "medium", "hard"].includes(data.match.difficulty)
            || !data.opponent || typeof data.opponent.username !== "string" || !data.opponent.username.trim()
            || typeof data.opponent.rating !== "number" || !Number.isFinite(data.opponent.rating) || data.opponent.rating < 0) {
            throw new Error("Invalid match confirmation");
          }
          const active = document.activeElement;
          focusArena.current = (focusArena.current && active === document.body) || !!active && !!panel.current?.contains(active) && active.matches(".play-button, [data-search-cancel]");
          feedback.notify("matched"); setMatchId(data.match.id); setPhase("matched"); setMessage(`Matched with ${data.opponent.username} (${Math.round(data.opponent.rating)}) · ${data.match.difficulty}. Your match is reserved. Open the arena to prepare.`); socket.current = null; ws.close(); }
        else if (data.type === "left" || data.type === "error") { socket.current = null; ws.close(); restoreIdle(); setMessage(data.type === "error" ? data.message : "Search cancelled. Ready when you are."); }
      } catch { clearResponseTimer(); socket.current = null; ws.close(); restoreIdle(); setMessage("Unexpected server response. Please try again."); }
    };
    ws.onclose = ws.onerror = () => { if (socket.current === ws) { clearResponseTimer(); socket.current = null; ws.close(); restoreIdle(); setMessage("Connection lost. Sign in again or retry matchmaking."); } };
  }
  return <div ref={panel} className={`play-panel play-panel--${phase}`}>
    {!signedIn ? <a className="button button--primary play-button" href="/account">Sign in to play</a> : <>
      <Button className="play-button" aria-describedby={guidanceId} aria-busy={["connecting", "cancelling", "matching"].includes(phase)} onClick={join} disabled={phase !== "idle"}>{phase === "idle" ? "Play a duel" : phase === "matched" ? "Match reserved" : phase === "matching" ? "Reserving match…" : phase === "cancelling" ? "Cancelling search…" : phase === "connecting" ? "Connecting…" : "Finding opponent…"}</Button>
      {(phase === "queued" || phase === "connecting") && <Button data-search-cancel aria-describedby={guidanceId} variant="ghost" onClick={() => {
        focusAfterSearch.current = !!panel.current?.querySelector("[data-search-cancel]")?.matches(":focus");
        const ws = socket.current;
        if (ws?.readyState === WebSocket.OPEN) { setPhase("cancelling"); setMessage("Cancelling your search… Waiting for server confirmation."); leave.current?.(); }
        else { socket.current = null; clearResponseTimer(); ws?.close(); restoreIdle(); setMessage("Search cancelled. Ready when you are."); }
      }}>Cancel search</Button>}
    </>}
    {signedIn && <DuelFeedback feedback={feedback} />}
    {matchId && <Link ref={arenaLink} aria-describedby={guidanceId} className="button button--primary" href={`/match/${matchId}`}>Open arena</Link>}
    {phase === "queued" && queueStats && <dl className="queue-stats" aria-label="Current search details" aria-live="off">
      <div><dt>Time searching</dt><dd>{queueStats.waitedSeconds}s elapsed</dd></div>
      <div><dt>Rating range</dt><dd>±{queueStats.ratingBand} points</dd></div>
    </dl>}
    <p id={guidanceId} className="availability" role="status">{message}</p>
  </div>;
}
