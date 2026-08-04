"use client";

import { useEffect, useState } from "react";

export type OnlineStatus = { online: boolean; restored: boolean };

export function useOnlineStatus(): OnlineStatus {
  const [online, setOnline] = useState(true);
  const [restored, setRestored] = useState(false);

  useEffect(() => {
    setOnline(navigator.onLine);

    const goOnline = () => {
      setOnline(true);
      setRestored(true);
    };
    const goOffline = () => {
      setOnline(false);
      setRestored(false);
    };

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return { online, restored };
}
