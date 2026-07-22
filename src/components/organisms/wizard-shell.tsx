"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type WizardStep = {
  id: string;
  title: string;
  description?: string;
  optional?: boolean;
};

/**
 * Guided multi-step form: a contained card with a left vertical stepper
 * (numbered circles, connecting lines, check/active/upcoming states, optional
 * badges), a spacious content area with heading + subtitle, and a Back/Continue
 * footer. Completed steps in the rail are clickable. One clear job per screen.
 */
export function WizardShell({
  steps,
  current,
  title,
  subtitle,
  onNavigate,
  children,
  footer,
}: {
  steps: WizardStep[];
  current: number;
  title: string;
  subtitle?: string;
  onNavigate?: (index: number) => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const reduceMotion = useReducedMotion();
  const pct = Math.round(((current + 1) / steps.length) * 100);

  return (
    <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">
      <div className="flex max-h-[calc(100dvh-8rem)] min-h-[540px] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-soft lg:flex-row">
        {/* Left stepper (desktop) */}
        <aside className="hidden shrink-0 flex-col overflow-y-auto border-r border-border bg-secondary/30 p-6 lg:flex lg:w-[300px]">
          <div className="mb-8">
            <p className="text-sm font-semibold">New conversion template</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Set it up once, reuse it forever.</p>
          </div>

          <ol className="flex-1">
            {steps.map((step, i) => {
              const done = i < current;
              const active = i === current;
              const clickable = done && !!onNavigate;
              const isLast = i === steps.length - 1;
              const go = () => clickable && onNavigate?.(i);
              return (
                <li key={step.id} className="relative flex gap-3.5 pb-7 last:pb-0">
                  {!isLast && (
                    <span
                      aria-hidden
                      className={cn(
                        "absolute left-[15px] top-8 bottom-1 w-px",
                        done ? "bg-primary/40" : "bg-border",
                      )}
                    />
                  )}
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={go}
                    aria-current={active ? "step" : undefined}
                    className={cn(
                      "relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-xs font-semibold transition-colors",
                      done && "border-primary bg-primary text-primary-foreground",
                      active && "border-primary bg-background text-primary ring-4 ring-primary/15",
                      !done && !active && "border-border bg-background text-muted-foreground",
                      clickable && "cursor-pointer",
                    )}
                  >
                    {done ? <Check className="h-4 w-4" /> : i + 1}
                  </button>
                  <button
                    type="button"
                    disabled={!clickable}
                    onClick={go}
                    className={cn("-mt-0.5 min-w-0 text-left", clickable && "cursor-pointer")}
                  >
                    <span
                      className={cn(
                        "flex flex-wrap items-center gap-x-2 text-sm leading-8",
                        active ? "font-semibold text-foreground" : done ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      {step.title}
                      {step.optional && (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-normal leading-none text-muted-foreground">
                          Optional
                        </span>
                      )}
                    </span>
                    {step.description && (
                      <span className="mt-0.5 block text-xs text-muted-foreground">{step.description}</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ol>

          <div className="mt-6 border-t border-border pt-4 text-xs font-medium text-muted-foreground">
            Step {current + 1} of {steps.length}
          </div>
        </aside>

        {/* Content */}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          {/* Mobile progress */}
          <div className="border-b border-border p-4 lg:hidden">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{title}</span>
              <span>
                Step {current + 1} of {steps.length}
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8 lg:p-10">
            <header className="mb-6">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              {subtitle && <p className="mt-1.5 text-muted-foreground">{subtitle}</p>}
            </header>

            <AnimatePresence mode="wait">
              <motion.div
                key={current}
                initial={reduceMotion ? false : { opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0, x: -12 }}
                transition={{ duration: 0.2 }}
              >
                {children}
              </motion.div>
            </AnimatePresence>
          </div>

          {footer && (
            <div className="flex items-center justify-between gap-3 border-t border-border p-4 sm:px-8">
              {footer}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
