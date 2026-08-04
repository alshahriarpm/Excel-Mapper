"use client";

import Link from "next/link";
import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Card, CardContent } from "@/components/atoms/ui/card";
import { makeMotionSet } from "./motion-presets";

export type Destination = {
  href: string;
  label: string;
  description: string;
  icon: React.ReactNode;
};

export function DestinationGrid({ items, heading }: { items: Destination[]; heading: string }) {
  const still = useReducedMotion();
  const { container, item } = useMemo(() => makeMotionSet(!!still), [still]);

  if (items.length === 0) return null;

  return (
    <section className="mt-12 text-left" aria-labelledby="destinations-heading">
      <h2
        id="destinations-heading"
        className="mb-3 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground"
      >
        {heading}
      </h2>
      <motion.ul
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-3 sm:grid-cols-2"
      >
        {items.map((d) => (
          <motion.li key={d.href} variants={item}>
            <Link
              href={d.href}
              className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card className="h-full transition-shadow hover:shadow-soft-lg">
                <CardContent className="flex items-start gap-3 p-4">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground [&_svg]:h-5 [&_svg]:w-5">
                    {d.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{d.label}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">{d.description}</span>
                  </span>
                  <ArrowRight
                    aria-hidden
                    className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </CardContent>
              </Card>
            </Link>
          </motion.li>
        ))}
      </motion.ul>
    </section>
  );
}
