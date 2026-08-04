"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export type Tone = "primary" | "destructive";

const BLOBS = [
  { className: "-top-40 -left-24 h-[26rem] w-[26rem]", drift: 22, duration: 11 },
  { className: "-bottom-48 -right-20 h-[30rem] w-[30rem]", drift: -18, duration: 14 },
  { className: "top-1/3 left-1/2 h-[18rem] w-[18rem] -translate-x-1/2", drift: 14, duration: 9 },
];

export function AnimatedBackground({ tone = "primary" }: { tone?: Tone }) {
  const still = useReducedMotion();
  const wash = tone === "destructive" ? "bg-destructive/10" : "bg-primary/10";
  const glow = tone === "destructive" ? "bg-warning/10" : "bg-accent";

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-secondary/70" />
      {BLOBS.map((blob, i) => (
        <motion.div
          key={i}
          className={cn(
            "absolute rounded-full blur-3xl",
            blob.className,
            i === 1 ? glow : wash,
            i === 2 && "opacity-70",
          )}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={
            still
              ? { opacity: 1, scale: 1 }
              : { opacity: 1, scale: 1, y: [0, blob.drift, 0] }
          }
          transition={{
            opacity: { duration: 0.9 },
            scale: { duration: 0.9 },
            y: { duration: blob.duration, repeat: Infinity, ease: "easeInOut" },
          }}
        />
      ))}
    </div>
  );
}
