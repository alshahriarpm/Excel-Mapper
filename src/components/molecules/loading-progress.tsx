"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";

export function LoadingProgress({
  messages,
  intervalMs = 900,
}: {
  messages: string[];
  intervalMs?: number;
}) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (messages.length <= 1) return;
    const id = setInterval(() => setI((n) => Math.min(n + 1, messages.length - 1)), intervalMs);
    return () => clearInterval(id);
  }, [messages.length, intervalMs]);

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <motion.p key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm text-muted-foreground">
        {messages[i] ?? messages[messages.length - 1]}
      </motion.p>
    </div>
  );
}
