"use client";

import { useState } from "react";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/atoms/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/atoms/ui/card";
import { FileDropzone } from "@/components/molecules/file-dropzone";
import { LoadingProgress } from "@/components/molecules/loading-progress";
import { ConversionReview } from "@/components/organisms/conversion-review";
import { parseWorkbook, sheetToSourceRows, ParseError } from "@/lib/engine/fileParser";
import { normalizeHeader } from "@/lib/engine/normalize";
import { logConversion } from "@/lib/actions/conversions";
import type { SavedConversionTemplate, SourceRow } from "@/lib/engine/types";

type Phase = "upload" | "parsing" | "review" | "error";

export function HrConvertClient({
  template,
  companyId,
  sampleRows,
}: {
  template: SavedConversionTemplate;
  companyId: string;
  sampleRows?: SourceRow[];
}) {
  const [phase, setPhase] = useState<Phase>("upload");
  const [rows, setRows] = useState<SourceRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState("");
  const [missingColumns, setMissingColumns] = useState<string[]>([]);

  async function handleFile(file: File) {
    setPhase("parsing");
    setError("");
    try {
      const buffer = await file.arrayBuffer();
      const parsed = await parseWorkbook(buffer, file.name);
      const expectedSheet = template.sourceConfiguration.expectedWorksheetName;
      const sheetName =
        expectedSheet && parsed.sheets[expectedSheet] ? expectedSheet : parsed.suggestedWorksheet;
      const sheet = parsed.sheets[sheetName];
      if (!sheet) throw new ParseError("We couldn't find any data in that file.");

      const present = new Set(sheet.columns.map((c) => normalizeHeader(c.header)));
      const expected = template.sourceConfiguration.expectedColumns ?? [];
      setMissingColumns(expected.filter((c) => !present.has(normalizeHeader(c))));

      setRows(sheetToSourceRows(sheet));
      setFileName(file.name);
      setPhase("review");
    } catch (e) {
      setError(
        e instanceof ParseError
          ? e.message
          : "Sorry, we couldn't read that file. Please make sure it's a valid Excel or CSV file.",
      );
      setPhase("error");
    }
  }

  function reset() {
    setPhase("upload");
    setRows([]);
    setFileName("");
    setError("");
    setMissingColumns([]);
  }

  return (
    <div className="mx-auto max-w-5xl p-6 lg:p-10">
      <div className="mb-6">
        <Link href="/hr" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back to templates
        </Link>
        <h1 className="mt-3 text-2xl font-semibold tracking-tight">{template.name}</h1>
        <p className="text-muted-foreground">
          Upload your attendance file and we&apos;ll convert it into{" "}
          <span className="font-medium text-foreground">{template.targetConfiguration.originalFileName}</span>.
        </p>
      </div>

      {phase === "upload" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Upload the file that contains your data</CardTitle>
          </CardHeader>
          <CardContent>
            <FileDropzone onFile={handleFile} />
            <p className="mt-3 text-xs text-muted-foreground">
              Your file is processed entirely in your browser — it never leaves your computer.
            </p>
            {sampleRows && sampleRows.length > 0 && (
              <div className="mt-4 flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setRows(sampleRows);
                    setFileName("sample-attendance.xlsx");
                    setMissingColumns([]);
                    setPhase("review");
                  }}
                >
                  Try with sample data
                </Button>
                <span className="text-xs text-muted-foreground">No file handy? Preview with a built-in sample.</span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {phase === "parsing" && (
        <Card>
          <CardContent>
            <LoadingProgress
              messages={[
                "Reading your file…",
                "Finding worksheets…",
                "Checking columns…",
                "Applying your saved rules…",
                "Preparing your preview…",
              ]}
            />
          </CardContent>
        </Card>
      )}

      {phase === "error" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <p className="max-w-md text-sm">{error}</p>
            <Button onClick={reset}>Try another file</Button>
          </CardContent>
        </Card>
      )}

      {phase === "review" && (
        <div className="space-y-6">
          {missingColumns.length > 0 && (
            <div className="flex items-start gap-3 rounded-xl border border-warning/40 bg-warning/10 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-warning-foreground" />
              <div className="text-sm">
                <p className="font-medium">This file looks different from the saved setup.</p>
                <p className="text-muted-foreground">
                  We expected these columns but didn&apos;t find them:{" "}
                  <span className="font-medium text-foreground">{missingColumns.join(", ")}</span>. Records
                  that rely on them may show as needing review. Ask your administrator if the format changed.
                </p>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Converted <span className="font-medium text-foreground">{rows.length}</span> rows from{" "}
              <span className="font-medium text-foreground">{fileName}</span>.
            </p>
            <Button variant="ghost" size="sm" onClick={reset}>
              Start over
            </Button>
          </div>
          <ConversionReview
            template={template}
            sourceRows={rows}
            onDownloaded={(_mode, summary) =>
              void logConversion({
                templateId: template.id,
                companyId,
                templateVersion: template.version,
                sourceFileName: fileName,
                summary,
              }).catch(() => {})
            }
          />
        </div>
      )}
    </div>
  );
}
