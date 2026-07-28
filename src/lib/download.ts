"use client";

import type { GeneratedFile } from "@/lib/engine/targetFileGenerator";

export function triggerDownload(file: GeneratedFile) {
  const blob = new Blob([file.data as BlobPart], { type: file.mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
