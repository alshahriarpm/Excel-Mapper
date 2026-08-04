"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { Button } from "@/components/atoms/ui/button";
import { BackButton } from "@/components/molecules/back-button";

function Lift({ children }: { children: React.ReactNode }) {
  const still = useReducedMotion();
  return (
    <motion.span
      className="inline-flex"
      whileHover={still ? undefined : { y: -2 }}
      whileTap={still ? undefined : { y: 0, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 400, damping: 24 }}
    >
      {children}
    </motion.span>
  );
}

export function ErrorActions({
  primary,
  homeHref,
  homeLabel = "Go home",
  backFallbackHref = "/",
}: {
  primary?: { label: string; onClick: () => void; loading?: boolean; disabled?: boolean; icon?: React.ReactNode };
  homeHref: string;
  homeLabel?: string;
  backFallbackHref?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
      {primary && (
        <Lift>
          <Button
            onClick={primary.onClick}
            loading={primary.loading}
            disabled={primary.disabled}
            aria-label={primary.label}
          >
            {primary.icon}
            {primary.label}
          </Button>
        </Lift>
      )}
      <Lift>
        <Button variant="outline" asChild>
          <Link href={homeHref}>{homeLabel}</Link>
        </Button>
      </Lift>
      <Lift>
        <BackButton label="Go back" fallbackHref={backFallbackHref} />
      </Lift>
    </div>
  );
}
