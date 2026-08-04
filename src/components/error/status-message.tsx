"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { OnlineStatus } from "./use-online-status";

export function StatusMessage({ online, restored }: OnlineStatus) {
  const still = useReducedMotion();
  const state = !online ? "offline" : restored ? "restored" : "idle";

  return (
    <div role="status" aria-live="polite" className="grid min-h-[2rem] place-items-center">
      <AnimatePresence initial={false}>
        {state !== "idle" && (
          <motion.div
            key={state}
            layout={false}
            style={{ gridArea: "1 / 1" }}
            initial={still ? false : { opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={still ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.25 }}
            className={cn(
              "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium",
              state === "offline"
                ? "border-warning/40 bg-warning/10 text-warning-foreground"
                : "border-success/40 bg-success/10 text-success",
            )}
          >
            {state === "offline" ? (
              <>
                <WifiOff aria-hidden className="h-3.5 w-3.5" /> No internet connection
              </>
            ) : (
              <>
                <Wifi aria-hidden className="h-3.5 w-3.5" /> Connection restored
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
