"use client";

import { useEffect, useState } from "react";

export function LoadingStatus() {
  const [delayed, setDelayed] = useState(false);
  useEffect(() => {
    const timeout = window.setTimeout(() => setDelayed(true), 15_000);
    return () => window.clearTimeout(timeout);
  }, []);

  return <>
    <p role="status" aria-live="polite" aria-atomic="true" className="page-loading-status">
      <span className="page-loading-mark" aria-hidden="true" />
      {delayed ? "This page is taking longer than usual." : "Loading page content…"}
    </p>
    {delayed && <p className="page-loading-delay">You can keep waiting, reload this page with your browser, or use Back to arena below. Reloading does not pause a live duel or resend a code submission.</p>}
  </>;
}
