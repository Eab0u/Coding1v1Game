"use client";

import { useEffect, useState } from "react";

export function RecoveryConnectionStatus({ unavailablePage = false }: { unavailablePage?: boolean }) {
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
    const resume = () => {
      if (document.visibilityState === "visible") update();
    };
    update();
    window.addEventListener("offline", update);
    window.addEventListener("online", update);
    window.addEventListener("pageshow", update);
    document.addEventListener("visibilitychange", resume);
    return () => {
      window.removeEventListener("offline", update);
      window.removeEventListener("online", update);
      window.removeEventListener("pageshow", update);
      document.removeEventListener("visibilitychange", resume);
    };
  }, []);

  return <div role="status" aria-live="polite" aria-atomic="true" data-connection-state={connection}>
    {connection !== "unknown" && <p className="recovery-guidance">
      <strong>{connection === "offline" ? "Browser offline. " : "Browser back online. "}</strong>
      {unavailablePage ? (connection === "offline"
        ? "Reconnect before following a recovery link. A live duel server clock continues while you are offline."
        : "Server availability and access to this page are not yet confirmed. Follow a recovery link when you are ready; reconnecting does not navigate automatically.") : connection === "offline"
        ? "Reconnect before trying this page again. A live duel server clock continues while you are offline."
        : "Server availability is not yet confirmed. Try this page again when you are ready; reconnecting does not retry automatically."}
    </p>}
  </div>;
}
