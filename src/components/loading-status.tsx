"use client";

import { useEffect, useId, useState } from "react";

export function LoadingStatus() {
  const [delayed, setDelayed] = useState(false);
  const guidanceId = useId();
  useEffect(() => {
    const timeout = window.setTimeout(() => setDelayed(true), 15_000);
    return () => window.clearTimeout(timeout);
  }, []);

  return <>
    <p role="status" aria-live="polite" aria-atomic="true" className="page-loading-status">
      <span className="page-loading-mark" aria-hidden="true" />
      {delayed ? "This page is taking longer than usual." : "Loading page content…"}
    </p>
    {delayed && <>
      <p id={guidanceId} className="page-loading-delay">You can keep waiting, reload this page, or use Back to arena below. Unsaved changes may be lost. Reloading does not pause a live duel or resend a code submission.</p>
      <div className="page-recovery-actions">
        <button type="button" className="button button--secondary" aria-describedby={guidanceId} onClick={() => window.location.reload()}>Reload page</button>
      </div>
    </>}
  </>;
}
