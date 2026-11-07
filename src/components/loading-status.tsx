"use client";

import { useEffect, useId, useState } from "react";

export function LoadingStatus() {
  const [delayed, setDelayed] = useState(false);
  const [offline, setOffline] = useState(false);
  const [recoveryOffered, setRecoveryOffered] = useState(false);
  const guidanceId = useId();
  useEffect(() => {
    const updateConnection = () => {
      const disconnected = navigator.onLine === false;
      setOffline(disconnected);
      if (disconnected) setRecoveryOffered(true);
    };
    updateConnection();
    window.addEventListener("online", updateConnection);
    window.addEventListener("offline", updateConnection);
    const timeout = window.setTimeout(() => setDelayed(true), 15_000);
    return () => {
      window.clearTimeout(timeout);
      window.removeEventListener("online", updateConnection);
      window.removeEventListener("offline", updateConnection);
    };
  }, []);

  return <>
    <p role="status" aria-live="polite" aria-atomic="true" className="page-loading-status">
      <span className="page-loading-mark" aria-hidden="true" />
      {offline ? "Your browser reports that you are offline. Reconnect to continue loading." : delayed ? "This page is taking longer than usual." : "Loading page content…"}
    </p>
    {(delayed || recoveryOffered) && <>
      <p id={guidanceId} className="page-loading-delay">You can keep waiting, reload this page, or use Back to arena below. Unsaved changes may be lost. Reloading does not pause a live duel or resend a code submission.</p>
      <div className="page-recovery-actions">
        <button type="button" className="button button--secondary" aria-describedby={guidanceId} onClick={() => window.location.reload()}>Reload page</button>
      </div>
    </>}
  </>;
}
