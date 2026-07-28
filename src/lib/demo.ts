import { DEFAULT_NORMALIZATION } from "@/lib/engine/types";
import type { ConversionRule, SavedConversionTemplate, SourceRow, TargetColumnConfiguration } from "@/lib/engine/types";
import type { UserRole } from "@/lib/supabase/types";

export const DEMO =
  process.env.NEXT_PUBLIC_DEMO_MODE === "true" && process.env.NODE_ENV !== "production";

const NOW = "2026-07-20T09:00:00.000Z";

export const demoSession = {
  userId: "demo-admin",
  email: "demo.admin@bulkmapper.app",
  profile: {
    id: "demo-admin",
    email: "demo.admin@bulkmapper.app",
    full_name: "Demo Admin",
    role: "super_admin" as UserRole,
    company_id: "demo-co",
    blocked: false,
    created_at: NOW,
  },
};

export const demoHrSession = {
  userId: "demo-hr",
  email: "hr@democompany.com",
  profile: {
    id: "demo-hr",
    email: "hr@democompany.com",
    full_name: "Demo HR",
    role: "hr" as UserRole,
    company_id: "demo-co",
    blocked: false,
    created_at: NOW,
  },
};

export const DEMO_ROLE_COOKIE = "demo_role";
export const DEMO_EMAIL_COOKIE = "demo_email";

export function demoSessionForRole(role: string | undefined, email?: string) {
  const base = role === "hr" ? demoHrSession : role === "super_admin" ? demoSession : null;
  if (!base) return null;
  if (!email) return base;
  return { ...base, email, profile: { ...base.profile, email } };
}

type DemoCompany = { id: string; name: string; blocked: boolean; created_at: string; created_by: string | null };
type DemoUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  company_id: string | null;
  blocked: boolean;
};
type DemoConversion = {
  id: string;
  template_id: string | null;
  company_id: string;
  source_file_name: string | null;
  template_version: number | null;
  total_rows: number;
  ready_rows: number;
  incomplete_rows: number;
  excluded_rows: number;
  created_at: string;
};

function demoTargetColumns(): TargetColumnConfiguration[] {
  return [
    { key: "c0", header: "Employee ID*", displayName: "Employee ID", order: 0, required: true, detectedType: "text", role: "employee_id", mapping: { kind: "direct", sourceColumn: "UserID" }, format: { preserveLeadingZeros: true } },
    { key: "c1", header: "Date*", displayName: "Date", order: 1, required: true, detectedType: "date", role: "date", mapping: { kind: "direct", sourceColumn: "Date" }, format: { dateFormat: "DD/MM/YYYY" } },
    { key: "c2", header: "In Time*", displayName: "In Time", order: 2, required: true, detectedType: "time", role: "in_time", mapping: { kind: "in_time" }, format: { timeFormat: "h:mm AM/PM" } },
    { key: "c3", header: "Out Time*", displayName: "Out Time", order: 3, required: true, detectedType: "time", role: "out_time", mapping: { kind: "out_time" }, format: { timeFormat: "h:mm AM/PM" } },
  ];
}

function demoRules(): ConversionRule[] {
  return [
    {
      id: "overnight",
      name: "Overnight Attendance",
      conditions: [{ sourceColumn: "On Desc", operator: "equals", values: ["Not Swipe"] }],
      conditionJoin: "and",
      inTimeSource: { type: "current_row_column", column: "P M OffDuty" },
      outTimeSource: { type: "next_calendar_day_column", employeeColumn: "UserID", dateColumn: "Date", returnColumn: "A M OnDuty" },
      missingInTimeBehavior: "blank_both_review",
      missingOutTimeBehavior: "keep_in_blank_out_review",
      stopAfterMatch: true,
      order: 0,
      active: true,
    },
    {
      id: "regular",
      name: "Regular Attendance",
      conditions: [{ sourceColumn: "On Desc", operator: "in", values: ["Absent", "Arrive Late", ""] }],
      conditionJoin: "and",
      inTimeSource: { type: "current_row_column", column: "A M OnDuty" },
      outTimeSource: { type: "current_row_column", column: "P M OffDuty" },
      missingInTimeBehavior: "blank_both_review",
      missingOutTimeBehavior: "keep_in_blank_out_review",
      stopAfterMatch: true,
      order: 1,
      active: true,
    },
  ];
}

function seededTemplate(): SavedConversionTemplate {
  return {
    id: "demo-template",
    companyId: "demo-co",
    name: "Monthly Attendance Import",
    description: "Converts the device export into the HRIS attendance upload sheet.",
    targetConfiguration: {
      originalFileName: "Attendance Bulk Upload.xlsx",
      originalFileType: "xlsx",
      worksheetNames: ["Attendance"],
      outputWorksheetName: "Attendance",
      outputWorksheetIndex: 0,
      headerRowNumber: 1,
      staticRowsAboveHeader: [],
      columns: demoTargetColumns(),
    },
    sourceConfiguration: {
      expectedHeaderRow: 1,
      expectedColumns: ["UserID", "Date", "On Desc", "A M OnDuty", "P M OffDuty"],
      employeeColumn: "UserID",
      dateColumn: "Date",
      conditionColumn: "On Desc",
      sourceDateFormat: "DD/MM/YYYY",
      normalization: { ...DEFAULT_NORMALIZATION },
    },
    rules: demoRules(),
    defaultRule: null,
    uniqueTargetFields: ["c0", "c1"],
    outputConfiguration: { defaultExportMode: "valid_only" },
    status: "active",
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

export function demoSampleRows(): SourceRow[] {
  return [
    { UserID: "00101", Date: "14/07/2026", "On Desc": "Not Swipe", "A M OnDuty": "", "P M OffDuty": "9:00 PM" },
    { UserID: "00101", Date: "15/07/2026", "On Desc": "Absent", "A M OnDuty": "7:00 AM", "P M OffDuty": "6:00 PM" },
    { UserID: "00102", Date: "15/07/2026", "On Desc": "Arrive Late", "A M OnDuty": "9:15 AM", "P M OffDuty": "6:05 PM" },
    { UserID: "00103", Date: "15/07/2026", "On Desc": "Absent", "A M OnDuty": "", "P M OffDuty": "6:00 PM" },
    { UserID: "00104", Date: "15/07/2026", "On Desc": "Not Swipe", "A M OnDuty": "", "P M OffDuty": "8:30 PM" },
  ];
}


type DemoState = {
  companies: DemoCompany[];
  templates: SavedConversionTemplate[];
  users: DemoUser[];
  conversions: DemoConversion[];
  seq: number;
};

const globalRef = globalThis as unknown as { __bulkMapperDemoState?: DemoState };
const state: DemoState =
  globalRef.__bulkMapperDemoState ??
  (globalRef.__bulkMapperDemoState = {
    companies: [{ id: "demo-co", name: "Demo Company", blocked: false, created_at: NOW, created_by: "demo-admin" }],
    templates: [seededTemplate()],
    users: [{ id: "demo-hr", email: "hr@democompany.com", full_name: "Demo HR", role: "hr", company_id: "demo-co", blocked: false }],
    conversions: [],
    seq: 1,
  });

const nextId = (prefix: string) => `${prefix}-${++state.seq}`;

export const demoStore = {
  listCompanies: () => [...state.companies],
  createCompany: (name: string) => {
    const id = nextId("co");
    state.companies.push({ id, name, blocked: false, created_at: NOW, created_by: "demo-admin" });
    return id;
  },
  setCompanyBlocked: (companyId: string, blocked: boolean) => {
    const c = state.companies.find((x) => x.id === companyId);
    if (c) c.blocked = blocked;
  },
  companyDeletionBlocker: (companyId: string): string | null => {
    const userCount = state.users.filter((u) => u.company_id === companyId).length;
    const templateCount = state.templates.filter((t) => t.companyId === companyId).length;
    if (userCount > 0 || templateCount > 0) {
      return `This company still has ${userCount} user(s) and ${templateCount} template(s). Remove them first.`;
    }
    return null;
  },
  deleteCompany: (companyId: string, force = false) => {
    if (force) {
      for (let i = state.users.length - 1; i >= 0; i--) {
        if (state.users[i]!.company_id === companyId) state.users.splice(i, 1);
      }
      for (let i = state.templates.length - 1; i >= 0; i--) {
        if (state.templates[i]!.companyId === companyId) state.templates.splice(i, 1);
      }
    }
    const idx = state.companies.findIndex((x) => x.id === companyId);
    if (idx >= 0) state.companies.splice(idx, 1);
  },
  listUsers: (companyId: string) => state.users.filter((u) => u.company_id === companyId),
  createUser: (email: string, fullName: string, companyId: string) => {
    state.users.push({ id: nextId("user"), email, full_name: fullName, role: "hr", company_id: companyId, blocked: false });
  },
  setUserBlocked: (userId: string, blocked: boolean) => {
    const u = state.users.find((x) => x.id === userId);
    if (u) u.blocked = blocked;
  },
  deleteUser: (userId: string) => {
    const i = state.users.findIndex((x) => x.id === userId);
    if (i >= 0) state.users.splice(i, 1);
  },
  listTemplates: () => [...state.templates],
  getTemplate: (id: string) => state.templates.find((t) => t.id === id) ?? null,
  createTemplate: (t: Omit<SavedConversionTemplate, "id" | "createdAt" | "updatedAt" | "version">) => {
    const id = nextId("tpl");
    state.templates.push({ ...t, id, version: 1, createdAt: NOW, updatedAt: NOW });
    return id;
  },
  updateTemplate: (id: string, patch: Partial<SavedConversionTemplate>) => {
    const i = state.templates.findIndex((t) => t.id === id);
    if (i >= 0) state.templates[i] = { ...state.templates[i]!, ...patch, id, updatedAt: NOW };
  },
  deleteTemplate: (id: string) => {
    const i = state.templates.findIndex((t) => t.id === id);
    if (i >= 0) state.templates.splice(i, 1);
  },
  duplicateTemplate: (id: string) => {
    const src = state.templates.find((t) => t.id === id);
    if (!src) return id;
    const newId = nextId("tpl");
    state.templates.push({ ...src, id: newId, name: `${src.name} (copy)`, status: "draft", version: 1, createdAt: NOW, updatedAt: NOW });
    return newId;
  },
  listConversions: (limit: number) => state.conversions.slice(0, limit),
  logConversion: (row: Omit<DemoConversion, "id" | "created_at">) => {
    state.conversions.unshift({ ...row, id: nextId("conv"), created_at: NOW });
  },
};
