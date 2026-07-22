"use client";

import { create } from "zustand";
import { persist, createJSONStorage, type StateStorage } from "zustand/middleware";
import type {
  ConversionRule,
  SavedConversionTemplate,
  SourceRow,
  TargetColumnConfiguration,
} from "@/lib/engine/types";

export type Draft = {
  companyId: string;
  name: string;
  description: string;
  status: SavedConversionTemplate["status"];
  targetFileName: string;
  targetFileType: "xlsx" | "xls" | "csv";
  targetSnapshot?: string;
  targetWorksheetNames: string[];
  targetWorksheet: string;
  targetHeaderRow: number;
  targetColumns: TargetColumnConfiguration[];
  targetStaticRows: unknown[][];
  sourceFileName: string;
  sourceWorksheet: string;
  sourceHeaderRow: number;
  sourceColumns: string[];
  sourceSampleRows: SourceRow[];
  employeeColumn: string;
  dateColumn: string;
  conditionColumn: string;
  sourceDateFormat: string;
  rules: ConversionRule[];
  defaultRule: ConversionRule | null;
  uniqueTargetFields: string[];
};

export function emptyDraft(companyId: string): Draft {
  return {
    companyId,
    name: "",
    description: "",
    status: "draft",
    targetFileName: "",
    targetFileType: "xlsx",
    targetWorksheetNames: [],
    targetWorksheet: "",
    targetHeaderRow: 1,
    targetColumns: [],
    targetStaticRows: [],
    sourceFileName: "",
    sourceWorksheet: "",
    sourceHeaderRow: 1,
    sourceColumns: [],
    sourceSampleRows: [],
    employeeColumn: "",
    dateColumn: "",
    conditionColumn: "",
    sourceDateFormat: "DD/MM/YYYY",
    rules: [],
    defaultRule: null,
    uniqueTargetFields: [],
  };
}

export function draftFromTemplate(t: SavedConversionTemplate): Draft {
  const tc = t.targetConfiguration;
  const sc = t.sourceConfiguration;
  return {
    companyId: t.companyId,
    name: t.name,
    description: t.description ?? "",
    status: t.status,
    targetFileName: tc.originalFileName,
    targetFileType: tc.originalFileType,
    targetSnapshot: tc.workbookSnapshot,
    targetWorksheetNames: tc.worksheetNames,
    targetWorksheet: tc.outputWorksheetName,
    targetHeaderRow: tc.headerRowNumber,
    targetColumns: tc.columns,
    targetStaticRows: tc.staticRowsAboveHeader,
    sourceFileName: "",
    sourceWorksheet: sc.expectedWorksheetName ?? "",
    sourceHeaderRow: sc.expectedHeaderRow,
    sourceColumns: sc.expectedColumns,
    sourceSampleRows: [],
    employeeColumn: sc.employeeColumn,
    dateColumn: sc.dateColumn,
    conditionColumn: sc.conditionColumn ?? "",
    sourceDateFormat: sc.sourceDateFormat ?? "DD/MM/YYYY",
    rules: t.rules,
    defaultRule: t.defaultRule ?? null,
    uniqueTargetFields: t.uniqueTargetFields,
  };
}

// localStorage that never throws — a quota error (e.g. a very large source
// sample) degrades to "not persisted" instead of crashing the builder.
const safeStorage: StateStorage = {
  getItem: (name) => {
    try {
      return typeof localStorage === "undefined" ? null : localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name, value) => {
    try {
      localStorage.setItem(name, value);
    } catch {
      /* quota / privacy mode — skip */
    }
  },
  removeItem: (name) => {
    try {
      localStorage.removeItem(name);
    } catch {
      /* ignore */
    }
  },
};

type BuilderStore = {
  /** Which template this draft belongs to — `"new"` or an existing template id. */
  contextId: string;
  draft: Draft;
  current: number;
  /** True once we've read persisted state this page-load (in-memory only). */
  hasHydrated: boolean;
  patch: (p: Partial<Draft>) => void;
  setCurrent: (n: number) => void;
  reset: (contextId: string, draft: Draft, current?: number) => void;
  setHasHydrated: (v: boolean) => void;
};

export const useBuilderStore = create<BuilderStore>()(
  persist(
    (set) => ({
      contextId: "",
      draft: emptyDraft(""),
      current: 0,
      hasHydrated: false,
      patch: (p) => set((s) => ({ draft: { ...s.draft, ...p } })),
      setCurrent: (n) => set({ current: n }),
      reset: (contextId, draft, current = 0) => set({ contextId, draft, current }),
      setHasHydrated: (v) => set({ hasHydrated: v }),
    }),
    {
      name: "bulk-mapper:template-builder",
      version: 1,
      storage: createJSONStorage(() => safeStorage),
      // We rehydrate manually (once per page-load) to keep SSR markup stable and
      // to avoid clobbering in-session state on client-side navigations.
      skipHydration: true,
      // Persist the configuration + step, but NOT the parsed source sample:
      // it can be large, and its Date values don't round-trip through JSON. The
      // user re-drops the source file to re-run the test after a reload.
      partialize: (s) => ({
        contextId: s.contextId,
        current: s.current,
        draft: { ...s.draft, sourceSampleRows: [] },
      }),
    },
  ),
);
