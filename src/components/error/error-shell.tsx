"use client";

import { useEffect, useMemo, useRef } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { AnimatedBackground, type Tone } from "./animated-background";
import { makeMotionSet } from "./motion-presets";

export function ErrorShell({
  tone = "primary",
  eyebrow,
  title,
  description,
  illustration,
  status,
  actions,
  children,
  alert = false,
  className,
}: {
  tone?: Tone;
  eyebrow?: React.ReactNode;
  title: string;
  description?: React.ReactNode;
  illustration?: React.ReactNode;
  status?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  alert?: boolean;
  className?: string;
}) {
  const still = useReducedMotion();
  const { container, item } = useMemo(() => makeMotionSet(!!still), [still]);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="relative isolate flex min-h-screen items-center justify-center overflow-hidden px-6 py-16">
      <AnimatedBackground tone={tone} />
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className={cn("w-full max-w-2xl text-center", className)}
      >
        {illustration && <motion.div variants={item}>{illustration}</motion.div>}

        <div {...(alert ? { role: "alert", "aria-live": "assertive" } : {})}>
          {eyebrow && (
            <motion.div variants={item} className="mt-6">
              {eyebrow}
            </motion.div>
          )}
          <motion.h1
            ref={headingRef}
            tabIndex={-1}
            variants={item}
            className="mt-4 text-balance text-3xl font-semibold tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:text-4xl"
          >
            {title}
          </motion.h1>
          {description && (
            <motion.p
              variants={item}
              className="mx-auto mt-3 max-w-prose text-pretty text-base text-muted-foreground"
            >
              {description}
            </motion.p>
          )}
        </div>

        {status && (
          <motion.div variants={item} className="mt-5 flex justify-center">
            {status}
          </motion.div>
        )}
        {actions && (
          <motion.div variants={item} className="mt-7">
            {actions}
          </motion.div>
        )}
        {children && <motion.div variants={item}>{children}</motion.div>}
      </motion.div>
    </main>
  );
}
