"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/atoms/ui/button";
import { BackButton } from "@/components/molecules/back-button";
import { accentTextClass, type PosterTone } from "./poster-shell";

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
  backFallbackHref = "/",
  accentLink,
  tone = "primary",
}: {
  primary?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
    disabled?: boolean;
    icon?: React.ReactNode;
  };
  backFallbackHref?: string;
  accentLink?: { href: string; label: string };
  tone?: PosterTone;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
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
        <BackButton label="Go back" fallbackHref={backFallbackHref} variant="outline" size="default" />
      </Lift>
      {accentLink && (
        <Link
          href={accentLink.href}
          className={cn(
            "ml-1 rounded-sm text-sm font-semibold underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            accentTextClass(tone),
          )}
        >
          {accentLink.label}
        </Link>
      )}
    </div>
  );
}
