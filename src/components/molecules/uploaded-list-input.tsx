"use client";

import { useState } from "react";
import { ListChecks, Loader2, X } from "lucide-react";
import { Button } from "@/components/atoms/ui/button";
import { Textarea } from "@/components/atoms/ui/textarea";
import { FileDropzone } from "@/components/molecules/file-dropzone";
import { parseWorkbook } from "@/lib/engine/fileParser";
import { cellToString } from "@/lib/engine/normalize";

function splitPasted(text: string): string[] {
  return text
    .split(/[\n\r,;\t]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Collects the ID list a template's "is in the list HR uploads" condition needs
 * — by spreadsheet upload or by pasting. Every non-empty cell of the chosen file
 * is taken as an ID, so a single-column list works with or without a header.
 */
export function UploadedListInput({
  values,
  onChange,
  label = "Overnight shift employee IDs",
  description = "Upload a file with one employee ID per row, or paste the IDs below.",
}: {
  values: string[];
  onChange: (values: string[]) => void;
  label?: string;
  description?: string;
}) {
  const [mode, setMode] = useState<"upload" | "paste">("upload");
  const [fileName, setFileName] = useState<string | null>(null);
  const [pasted, setPasted] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onFile(file: File) {
    setBusy(true);
    setError("");
    try {
      const parsed = await parseWorkbook(await file.arrayBuffer(), file.name);
      const sheet = parsed.sheets[parsed.suggestedWorksheet];
      if (!sheet) throw new Error("That file has no readable worksheet.");
      const ids: string[] = [];
      const seen = new Set<string>();
      for (const row of sheet.rows) {
        for (const cell of row) {
          const s = cellToString(cell).trim();
          if (!s || seen.has(s)) continue;
          seen.add(s);
          ids.push(s);
        }
      }
      if (ids.length === 0) throw new Error("No IDs found in that file.");
      setFileName(parsed.fileName);
      onChange(ids);
    } catch (e) {
      setError(e instanceof Error ? e.message : "We couldn't read that file.");
    } finally {
      setBusy(false);
    }
  }

  function applyPasted(text: string) {
    setPasted(text);
    onChange(Array.from(new Set(splitPasted(text))));
  }

  function clearAll() {
    setFileName(null);
    setPasted("");
    setError("");
    onChange([]);
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium">
          <ListChecks className="h-4 w-4" /> {label}
          {values.length > 0 && (
            <span className="rounded-full bg-success/15 px-2 py-0.5 text-xs font-medium text-success">
              {values.length} ID{values.length === 1 ? "" : "s"}
            </span>
          )}
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant={mode === "upload" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("upload")}
          >
            Upload file
          </Button>
          <Button
            variant={mode === "paste" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setMode("paste")}
          >
            Paste IDs
          </Button>
          {values.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          )}
        </div>
      </div>

      <p className="text-sm text-muted-foreground">{description}</p>

      {mode === "upload" ? (
        busy ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Reading the list…
          </p>
        ) : (
          <FileDropzone onFile={onFile} fileName={fileName} hint="Excel (.xlsx, .xls) or CSV" />
        )
      ) : (
        <Textarea
          rows={4}
          placeholder="SS200, SS201, RES004 — or one per line"
          value={pasted}
          onChange={(e) => applyPasted(e.target.value)}
        />
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      {values.length > 0 && (
        <p className="text-xs text-muted-foreground">
          Using: {values.slice(0, 12).join(", ")}
          {values.length > 12 ? ` +${values.length - 12} more` : ""}
        </p>
      )}
    </div>
  );
}
