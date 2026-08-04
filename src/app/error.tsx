"use client";

import { useCallback, useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { ErrorActions } from "@/components/error/error-actions";
import { ErrorDetails } from "@/components/error/error-details";
import { MetaRows, type MetaRow } from "@/components/error/meta-rows";
import { PosterShell } from "@/components/error/poster-shell";
import { StatusMessage } from "@/components/error/status-message";
import { useOnlineStatus } from "@/components/error/use-online-status";

function formatUtc(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())} ${pad(
    date.getUTCHours(),
  )}:${pad(date.getUTCMinutes())} UTC`;
}

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { online, restored } = useOnlineStatus();
  const [retrying, setRetrying] = useState(false);
  const [occurredAt, setOccurredAt] = useState("");

  useEffect(() => {
    console.error("Unhandled error:", error);
    setOccurredAt(formatUtc(new Date()));
  }, [error]);

  useEffect(() => {
    if (!retrying) return;
    const timer = setTimeout(() => setRetrying(false), 1500);
    return () => clearTimeout(timer);
  }, [retrying]);

  const retry = useCallback(() => {
    if (retrying || !online) return;
    setRetrying(true);
    reset();
  }, [retrying, online, reset]);

  const rows: MetaRow[] = [{ label: "Code", value: "500 · SERVER_ERROR" }];
  if (occurredAt) rows.push({ label: "Time", value: occurredAt });

  return (
    <PosterShell
      alert
      tone="destructive"
      code="500"
      kindLabel="Server error"
      footNote={process.env.NODE_ENV === "development" ? error.digest : undefined}
      title="Something went wrong"
      description="We couldn't complete your request. Don't worry—your data is safe."
      navLinks={[{ href: "/", label: "Home" }]}
      actions={
        <div className="space-y-5">
          <StatusMessage online={online} restored={restored} />
          <ErrorActions
            tone="destructive"
            primary={{
              label: retrying ? "Retrying…" : "Retry",
              onClick: retry,
              loading: retrying,
              disabled: !online || retrying,
              icon: retrying ? undefined : <RotateCcw aria-hidden className="h-4 w-4" />,
            }}
            accentLink={{ href: "/", label: "Dashboard" }}
          />
          <p className="text-xs text-muted-foreground">
            {online
              ? "If it keeps happening, let your administrator know."
              : "Reconnect to the internet and Retry will become available again."}
          </p>
        </div>
      }
    >
      <MetaRows rows={rows} />
      <ErrorDetails error={error} />
    </PosterShell>
  );
}
