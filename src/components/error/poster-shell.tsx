"use client";

import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { makeMotionSet } from "./motion-presets";

export type PosterTone = "destructive" | "primary";

export type PosterLink = { href: string; label: string };

const FIELD_TONE: Record<PosterTone, string> = {
  destructive: "bg-destructive text-destructive-foreground",
  primary: "bg-primary text-primary-foreground",
};

const ACCENT_TEXT: Record<PosterTone, string> = {
  destructive: "text-destructive",
  primary: "text-primary",
};

export function PosterShell({
  tone,
  code,
  kindLabel,
  footNote,
  title,
  description,
  navLinks = [],
  children,
  actions,
  alert = false,
}: {
  tone: PosterTone;
  code: string;
  kindLabel: string;
  footNote?: React.ReactNode;
  title: string;
  description: React.ReactNode;
  navLinks?: PosterLink[];
  children?: React.ReactNode;
  actions?: React.ReactNode;
  alert?: boolean;
}) {
  const still = useReducedMotion();
  const { container, item } = useMemo(() => makeMotionSet(!!still), [still]);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,37%)_1fr]">
      <aside
        aria-hidden
        className={cn(
          "relative flex flex-col justify-between overflow-hidden px-8 py-10 lg:px-12 lg:py-14",
          FIELD_TONE[tone],
        )}
      >
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-90">
          {kindLabel}
        </p>
        <motion.p
          initial={still ? false : { opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 180, damping: 22 }}
          className="select-none py-10 text-[6.5rem] font-bold leading-[0.82] tracking-tighter sm:text-[9rem] lg:py-0 lg:text-[13.5rem]"
        >
          {code}
        </motion.p>
        <p className="font-mono text-xs opacity-70">{footNote}</p>
      </aside>

      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="flex flex-col bg-background px-8 py-10 lg:px-14 lg:py-12"
      >
        <motion.div variants={item} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
              BM
            </span>
            <span className="text-sm font-semibold uppercase tracking-[0.14em]">Bulk Mapper</span>
          </span>
          {navLinks.length > 0 && (
            <nav className="flex items-center gap-5">
              {navLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="rounded-sm text-sm text-muted-foreground underline-offset-4 outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {l.label}
                </Link>
              ))}
            </nav>
          )}
        </motion.div>

        <motion.div
          variants={item}
          className="mt-4 h-px origin-left bg-foreground/15"
          style={{ transformOrigin: "left" }}
        />

        <div {...(alert ? { role: "alert", "aria-live": "assertive" } : {})} className="mt-10">
          <motion.h1
            ref={headingRef}
            tabIndex={-1}
            variants={item}
            className="max-w-2xl text-balance text-4xl font-bold leading-[1.05] tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background sm:text-5xl lg:text-6xl"
          >
            {title}
          </motion.h1>
          <motion.p variants={item} className="mt-5 max-w-md text-pretty text-muted-foreground">
            {description}
          </motion.p>
        </div>

        {children && (
          <motion.div variants={item} className="mt-10">
            {children}
          </motion.div>
        )}

        {actions && (
          <motion.div variants={item} className="mt-12 lg:mt-auto lg:pt-12">
            {actions}
          </motion.div>
        )}
      </motion.div>
    </main>
  );
}

export function accentTextClass(tone: PosterTone): string {
  return ACCENT_TEXT[tone];
}
