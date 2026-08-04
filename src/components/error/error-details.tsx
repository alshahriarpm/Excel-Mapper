"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/atoms/ui/accordion";
import { Card, CardContent } from "@/components/atoms/ui/card";

type AppError = Error & { digest?: string };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 sm:grid-cols-[8rem_1fr] sm:gap-3">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="break-words font-mono text-xs">{value}</dd>
    </div>
  );
}

export function ErrorDetails({ error }: { error: AppError }) {
  if (process.env.NODE_ENV !== "development") return null;

  return (
    <Card className="mt-8 text-left">
      <CardContent className="py-0">
        <Accordion type="single" collapsible>
          <AccordionItem value="details" className="border-b-0">
            <AccordionTrigger className="hover:no-underline" aria-label="Technical details">
              <span className="flex items-center gap-2">
                Technical details
                <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
                  dev only
                </span>
              </span>
            </AccordionTrigger>
            <AccordionContent>
              <dl className="space-y-3">
                {error.digest && <Row label="Digest" value={error.digest} />}
                {error.name && <Row label="Name" value={error.name} />}
                {error.message && <Row label="Message" value={error.message} />}
              </dl>
              {error.stack && (
                <pre className="mt-4 max-h-64 overflow-auto rounded-lg bg-muted p-3 font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {error.stack}
                </pre>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  );
}
