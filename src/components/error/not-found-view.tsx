"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Compass } from "lucide-react";
import { DestinationGrid, type Destination } from "@/components/error/destination-grid";
import { ErrorActions } from "@/components/error/error-actions";
import { ErrorIllustration } from "@/components/error/error-illustration";
import { ErrorShell } from "@/components/error/error-shell";

export function NotFoundView({
  homeHref,
  destinations,
}: {
  homeHref: string;
  destinations: Destination[];
}) {
  const still = useReducedMotion();
  const digits = useMemo(() => ["4", "0", "4"], []);

  return (
    <ErrorShell
      title="We couldn't find that page"
      description="The link may be out of date, or the template it pointed to no longer exists."
      illustration={<ErrorIllustration parallax icon={<Compass aria-hidden />} />}
      eyebrow={
        <p
          className="flex items-center justify-center gap-1 font-semibold tracking-tight"
          aria-label="Error 404"
        >
          {digits.map((d, i) => (
            <motion.span
              key={i}
              aria-hidden
              initial={still ? false : { opacity: 0, y: 14, rotate: i === 1 ? -6 : 0 }}
              animate={{ opacity: 1, y: 0, rotate: 0 }}
              transition={{
                type: "spring",
                stiffness: 260,
                damping: 18,
                delay: still ? 0 : 0.06 * i,
              }}
              className="bg-gradient-to-b from-primary to-accent-foreground bg-clip-text text-6xl leading-none text-transparent sm:text-7xl"
            >
              {d}
            </motion.span>
          ))}
        </p>
      }
      actions={<ErrorActions homeHref={homeHref} homeLabel="Go home" backFallbackHref={homeHref} />}
    >
      <DestinationGrid items={destinations} heading="Where would you like to go?" />
    </ErrorShell>
  );
}
