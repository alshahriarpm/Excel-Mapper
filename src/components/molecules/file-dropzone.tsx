"use client";

import { useRef, useState } from "react";
import { motion } from "framer-motion";
import { FileSpreadsheet, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";

export function FileDropzone({
  onFile,
  accept = ".xlsx,.xls,.csv",
  hint = "Excel (.xlsx, .xls) or CSV",
  fileName,
}: {
  onFile: (file: File) => void;
  accept?: string;
  hint?: string;
  fileName?: string | null;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) onFile(file);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        handleFiles(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed px-6 py-12 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        dragOver ? "border-primary bg-accent" : "border-border hover:border-primary/50 hover:bg-accent/40",
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      {fileName ? (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/12 text-success">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <div>
            <p className="font-medium">{fileName}</p>
            <p className="text-xs text-muted-foreground">Click to choose a different file</p>
          </div>
        </>
      ) : (
        <>
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent text-accent-foreground">
            <UploadCloud className="h-6 w-6" />
          </div>
          <div>
            <p className="font-medium">Drop your file here, or click to browse</p>
            <p className="text-xs text-muted-foreground">{hint}</p>
          </div>
        </>
      )}
    </motion.div>
  );
}
