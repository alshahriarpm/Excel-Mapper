"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { ErrorActions } from "@/components/error/error-actions";
import { ErrorDetails } from "@/components/error/error-details";
import { ErrorIllustration } from "@/components/error/error-illustration";
import { ErrorShell } from "@/components/error/error-shell";
import { StatusMessage } from "@/components/error/status-message";
import { useOnlineStatus } from "@/components/error/use-online-status";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { online, restored } = useOnlineStatus();
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    console.error("Unhandled error:", error);
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

  return (
    <ErrorShell
      alert
      tone="destructive"
      title="Something went wrong"
      description="We couldn't complete your request. Don't worry—your data is safe."
      illustration={
        <ErrorIllustration tone="destructive" idle="pulse" icon={<AlertTriangle aria-hidden />} />
      }
      status={<StatusMessage online={online} restored={restored} />}
      actions={
        <ErrorActions
          primary={{
            label: retrying ? "Retrying…" : "Retry",
            onClick: retry,
            loading: retrying,
            disabled: !online || retrying,
            icon: retrying ? undefined : <RotateCcw aria-hidden className="h-4 w-4" />,
          }}
          homeHref="/"
        />
      }
    >
      <p className="mt-6 text-xs text-muted-foreground">
        {online
          ? "If it keeps happening, let your administrator know."
          : "Reconnect to the internet and Retry will become available again."}
      </p>
      <ErrorDetails error={error} />
    </ErrorShell>
  );
}
