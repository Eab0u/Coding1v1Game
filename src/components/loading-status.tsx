"use client";

import { useEffect, useId, useState } from "react";

export function LoadingStatus() {
  const [delayed, setDelayed] = useState(false);
  const [offline, setOffline] = useState(false);
  const [reconnected, setReconnected] = useState(false);
  const [recoveryOffered, setRecoveryOffered] = useState(false);
  const guidanceId = useId();
  useEffect(() => {
    const deadline = Date.now() + 15_000;
    const checkDelay = () => {
      if (Date.now() >= deadline) setDelayed(true);
    };
    let wasOffline = false;
    const updateConnection = () => {
      const disconnected = navigator.onLine === false;
      if (disconnected) setReconnected(false);
      else if (wasOffline) setReconnected(true);
      wasOffline = disconnected;
      setOffline(disconnected);
      if (disconnected) setRecoveryOffered(true);
    };
    const resume = () => {
      if (document.visibilityState === "visible") restore();
    };
    const restore = () => {
      updateConnection();
      checkDelay();
    };
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    window.addEventListener("pageshow", restore);
    document.addEventListener("visibilitychange", resume);
    const timeout = window.setTimeout(() => setDelayed(true), 15_000);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
      window.removeEventListener("pageshow", restore);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);

  return <>
    <p role="status" aria-live="polite" aria-atomic="true" className="page-loading-status" data-loading-state={offline ? "offline" : delayed ? "delayed" : "loading"}>
      <span className="page-loading-mark" aria-hidden="true" />
      <span>
      {reconnected && <span className="page-loading-reconnected">Your browser is back online. Server availability is not yet confirmed. </span>}
      {offline ? "Your browser reports that you are offline. Reconnect to continue loading." : delayed ? "This page is taking longer than usual." : "Loading page content…"}
      </span>
    </p>
    {(delayed || recoveryOffered) && <>
      <p id={guidanceId} className="page-loading-delay">You can keep waiting, reload this page, or use Back to arena below. Unsaved changes may be lost. Reloading does not pause a live duel or resend a code submission.</p>
      <div className="page-recovery-actions">
        <button type="button" className="button button--secondary" aria-describedby={guidanceId} onClick={() => window.location.reload()}>Reload page</button>
      </div>
    </>}
  </>;
}
