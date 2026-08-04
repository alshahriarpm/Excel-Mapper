"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { makeMotionSet } from "./motion-presets";
import { accentTextClass, type PosterLink, type PosterTone } from "./poster-shell";

export type LinkRow = PosterLink & { description: string };

export function LinkRows({
  rows,
  heading,
  tone = "primary",
}: {
  rows: LinkRow[];
  heading: string;
  tone?: PosterTone;
}) {
  const still = useReducedMotion();
  const { container, item } = useMemo(() => makeMotionSet(!!still), [still]);

  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="poster-links-heading">
      <h2
        id="poster-links-heading"
        className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground"
      >
        {heading}
      </h2>
      <motion.ul
        variants={container}
        initial="hidden"
        animate="show"
        className="mt-3 border-t border-foreground/15"
      >
        {rows.map((row) => (
          <motion.li key={row.href} variants={item} className="border-b border-foreground/15">
            <Link
              href={row.href}
              className="group grid grid-cols-[1fr_auto] items-center gap-4 py-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:grid-cols-[11rem_1fr_auto]"
            >
              <span className="text-sm font-semibold">{row.label}</span>
              <span className="hidden text-sm text-muted-foreground sm:block">
                {row.description}
              </span>
              <ArrowRight
                aria-hidden
                className={cn(
                  "h-4 w-4 transition-transform group-hover:translate-x-1",
                  accentTextClass(tone),
                )}
              />
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}
