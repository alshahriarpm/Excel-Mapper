"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Pencil, Trash2, FileSpreadsheet } from "lucide-react";
import { Button } from "@/components/atoms/ui/button";
import { Card, CardContent } from "@/components/atoms/ui/card";
import { Badge } from "@/components/atoms/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/atoms/ui/dialog";
import { deleteTemplate, duplicateTemplate } from "@/lib/actions/templates";
import { TEMPLATE_STATUS_META } from "@/lib/status-copy";
import type { SavedConversionTemplate } from "@/lib/engine/types";

const TONE_TO_VARIANT = { success: "success", warning: "warning", secondary: "secondary", destructive: "destructive" } as const;

export function TemplateListClient({
  templates,
  companyNames,
}: {
  templates: SavedConversionTemplate[];
  companyNames: Record<string, string>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [toDelete, setToDelete] = useState<SavedConversionTemplate | null>(null);

  function onDuplicate(id: string) {
    startTransition(async () => {
      await duplicateTemplate(id);
      router.refresh();
    });
  }
  function onDelete() {
    if (!toDelete) return;
    const id = toDelete.id;
    startTransition(async () => {
      await deleteTemplate(id);
      setToDelete(null);
      router.refresh();
    });
  }

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2">
        {templates.map((t) => {
          const meta = TEMPLATE_STATUS_META[t.status] ?? TEMPLATE_STATUS_META.draft!;
          return (
            <Card key={t.id}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-semibold">{t.name}</h3>
                      <Badge variant={TONE_TO_VARIANT[meta.tone]}>{meta.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {companyNames[t.companyId] ?? "—"} · {t.targetConfiguration.originalFileName}
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      {t.rules.length} rule{t.rules.length === 1 ? "" : "s"} · v{t.version} · updated{" "}
                      {t.updatedAt ? new Date(t.updatedAt).toLocaleDateString() : "—"}
                    </p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <Button asChild size="sm" variant="outline">
                    <Link href={`/admin/templates/${t.id}/edit`}>
                      <Pencil className="h-3.5 w-3.5" /> Edit
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onDuplicate(t.id)} disabled={pending}>
                    <Copy className="h-3.5 w-3.5" /> Duplicate
                  </Button>
                  <Button size="sm" variant="ghost" className="ml-auto text-destructive" onClick={() => setToDelete(t)} disabled={pending}>
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete this template?</DialogTitle>
            <DialogDescription>
              &ldquo;{toDelete?.name}&rdquo; will be removed. HR users for this company will no longer be able to use
              it. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setToDelete(null)} disabled={pending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={pending}>
              Delete template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
