"use client";

import { useState } from "react";
import { Bell } from "lucide-react";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((char) => char.charCodeAt(0)));
}

export function PushEnable() {
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  async function enable() {
    try {
      setState("busy");
      if (!("serviceWorker" in navigator) || !("PushManager" in window)) throw new Error("Push nije podržan");

      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Push dozvola nije odobrena");

      const configResponse = await fetch("/api/push/vapid-key", { cache: "no-store" });
      if (!configResponse.ok) throw new Error("VAPID konfiguracija nije dostupna");
      const { publicKey } = (await configResponse.json()) as { publicKey?: string };
      if (!publicKey) throw new Error("VAPID ključ nije konfiguriran");

      const registration = await navigator.serviceWorker.register("/sw.js");
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey),
      });

      const response = await fetch("/api/admin/push/subscribe", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(subscription),
      });
      if (!response.ok) throw new Error("Pretplata na push nije spremljena");

      setState("done");
    } catch {
      setState("error");
    }
  }

  return (
    <button className="btn" onClick={enable} disabled={state === "busy" || state === "done"}>
      <Bell size={16} />
      {state === "done"
        ? "Obavijesti uključene"
        : state === "busy"
          ? "Uključujem…"
          : state === "error"
            ? "Pokušaj ponovno"
            : "Uključi obavijesti"}
    </button>
  );
}
