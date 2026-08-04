"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

export function MessageScreen({
  icon,
  eyebrow,
  title,
  description,
  actions,
  detail,
  tone = "default",
  iconMotion,
}: {
  icon?: React.ReactNode;
  eyebrow?: string;
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  detail?: React.ReactNode;
  tone?: "default" | "destructive";
  iconMotion?: "spin" | "pulse";
}) {
  const still = useReducedMotion();

  const container = {
    hidden: {},
    show: { transition: { staggerChildren: still ? 0 : 0.07, delayChildren: still ? 0 : 0.05 } },
  };
  const item = {
    hidden: { opacity: 0, y: still ? 0 : 10 },
    show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] as const } },
  };

  const idle =
    still || !iconMotion
      ? undefined
      : iconMotion === "spin"
        ? { rotate: [0, 8, -8, 0], transition: { duration: 6, repeat: Infinity, ease: "easeInOut" as const } }
        : { scale: [1, 1.06, 1], transition: { duration: 2.4, repeat: Infinity, ease: "easeInOut" as const } };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-6">
      {!still && (
        <motion.div
          aria-hidden
          className={cn(
            "pointer-events-none absolute -top-32 h-[28rem] w-[28rem] rounded-full blur-3xl",
            tone === "destructive" ? "bg-destructive/10" : "bg-primary/10",
          )}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1, y: [0, 18, 0] }}
          transition={{
            opacity: { duration: 0.8 },
            scale: { duration: 0.8 },
            y: { duration: 9, repeat: Infinity, ease: "easeInOut" },
          }}
        />
      )}

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="relative w-full max-w-lg text-center"
      >
        <motion.div
          className={cn(
            "mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl",
            tone === "destructive"
              ? "bg-destructive/10 text-destructive"
              : "bg-accent text-accent-foreground",
          )}
          initial={{ opacity: 0, scale: still ? 1 : 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 320, damping: 18 }}
        >
          <motion.span animate={idle} className="flex">
            {icon}
          </motion.span>
        </motion.div>

        {eyebrow && (
          <motion.p variants={item} className="text-sm font-medium text-primary">
            {eyebrow}
          </motion.p>
        )}
        <motion.h1 variants={item} className="text-2xl font-semibold tracking-tight">
          {title}
        </motion.h1>
        {description && (
          <motion.p variants={item} className="mt-2 text-muted-foreground">
            {description}
          </motion.p>
        )}
        {actions && (
          <motion.div
            variants={item}
            className="mt-6 flex flex-wrap items-center justify-center gap-3 [&_a]:transition-transform [&_button]:transition-transform hover:[&_a:hover]:-translate-y-0.5 hover:[&_button:hover]:-translate-y-0.5"
          >
            {actions}
          </motion.div>
        )}
        {detail && <motion.div variants={item}>{detail}</motion.div>}
      </motion.div>
    </main>
  );
}
