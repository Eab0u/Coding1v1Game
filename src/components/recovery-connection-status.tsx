"use client";

import { useEffect, useState } from "react";

export function RecoveryConnectionStatus() {
  const [connection, setConnection] = useState<"unknown" | "offline" | "reconnected">("unknown");
  useEffect(() => {
    let wasOffline = false;
    const update = () => {
      if (navigator.onLine === false) {
        wasOffline = true;
        setConnection("offline");
      } else if (wasOffline) {
        setConnection("reconnected");
      }
    };
    update();
    window.addEventListener("offline", update);
    window.addEventListener("online", update);
    return () => {
      window.removeEventListener("offline", update);
      window.removeEventListener("online", update);
    };
  }, []);

  return <div role="status" aria-live="polite" aria-atomic="true">
    {connection !== "unknown" && <p className="recovery-guidance">
      <strong>{connection === "offline" ? "Browser offline. " : "Browser back online. "}</strong>
      {connection === "offline"
        ? "Reconnect before trying this page again. A live duel server clock continues while you are offline."
        : "Server availability is not yet confirmed. Try this page again when you are ready; reconnecting does not retry automatically."}
    </p>}
  </div>;
}
