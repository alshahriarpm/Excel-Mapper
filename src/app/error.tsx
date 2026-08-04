"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/atoms/ui/button";
import { MessageScreen } from "@/components/molecules/message-screen";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled error:", error);
  }, [error]);

  return (
    <MessageScreen
      tone="destructive"
      icon={<AlertTriangle className="h-6 w-6" />}
      iconMotion="pulse"
      title="Something went wrong"
      description="The page didn't finish loading. Your uploaded file never leaves your browser, so nothing has been sent anywhere — trying again is safe."
      actions={
        <>
          <Button onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Try again
          </Button>
          <Button variant="outline" asChild>
            <Link href="/">Go to my dashboard</Link>
          </Button>
        </>
      }
      detail={
        <p className="mt-6 text-xs text-muted-foreground">
          If it keeps happening, let your administrator know.
        </p>
      }
    />
  );
}
