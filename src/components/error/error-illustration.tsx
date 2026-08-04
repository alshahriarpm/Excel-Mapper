"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring } from "framer-motion";
import { cn } from "@/lib/utils";
import type { Tone } from "./animated-background";

const PARALLAX_RANGE = 6;

export function ErrorIllustration({
  icon,
  tone = "primary",
  idle = "float",
  parallax = false,
  className,
}: {
  icon: React.ReactNode;
  tone?: Tone;
  idle?: "float" | "pulse" | "none";
  parallax?: boolean;
  className?: string;
}) {
  const still = useReducedMotion();
  const px = useMotionValue(0);
  const py = useMotionValue(0);
  const x = useSpring(px, { stiffness: 120, damping: 18 });
  const y = useSpring(py, { stiffness: 120, damping: 18 });

  useEffect(() => {
    if (!parallax || still) return;
    if (!window.matchMedia("(pointer: fine)").matches) return;

    const onMove = (e: PointerEvent) => {
      const dx = e.clientX / window.innerWidth - 0.5;
      const dy = e.clientY / window.innerHeight - 0.5;
      px.set(dx * PARALLAX_RANGE * 2);
      py.set(dy * PARALLAX_RANGE * 2);
    };
    window.addEventListener("pointermove", onMove);
    return () => window.removeEventListener("pointermove", onMove);
  }, [parallax, still, px, py]);

  const idleAnimation =
    still || idle === "none"
      ? undefined
      : idle === "float"
        ? { y: [0, -6, 0], transition: { duration: 4.5, repeat: Infinity, ease: "easeInOut" as const } }
        : { scale: [1, 1.05, 1], transition: { duration: 2.6, repeat: Infinity, ease: "easeInOut" as const } };

  return (
    <motion.div style={parallax && !still ? { x, y } : undefined} className={cn("mx-auto", className)}>
      <motion.div
        className={cn(
          "relative mx-auto flex h-20 w-20 items-center justify-center rounded-2xl shadow-soft",
          tone === "destructive"
            ? "bg-destructive/10 text-destructive"
            : "bg-accent text-accent-foreground",
        )}
        initial={{ opacity: 0, scale: still ? 1 : 0.65 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
      >
        <span
          className={cn(
            "absolute inset-0 rounded-2xl",
            tone === "destructive" ? "ring-1 ring-destructive/20" : "ring-1 ring-primary/15",
          )}
        />
        <motion.span animate={idleAnimation} className="flex [&_svg]:h-9 [&_svg]:w-9">
          {icon}
        </motion.span>
      </motion.div>
    </motion.div>
  );
}
