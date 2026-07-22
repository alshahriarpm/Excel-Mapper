"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionProfile } from "@/lib/auth";
import { rowToTemplate, type TemplatePayload, type TemplateRow } from "@/lib/templates";
import type { SavedConversionTemplate } from "@/lib/engine/types";
import type { TemplateStatus } from "@/lib/supabase/types";
import { DEMO, demoStore } from "@/lib/demo";

const asJson = (v: unknown) => v as Prisma.InputJsonValue;

function payloadColumns(p: TemplatePayload) {
  return {
    company_id: p.companyId,
    name: p.name,
    description: p.description ?? null,
    status: p.status,
    target_configuration: asJson(p.targetConfiguration),
    source_configuration: asJson(p.sourceConfiguration),
    rules: asJson(p.rules),
    default_rule: p.defaultRule == null ? Prisma.DbNull : asJson(p.defaultRule),
    unique_target_fields: asJson(p.uniqueTargetFields),
    output_configuration: asJson(p.outputConfiguration),
  };
}

// Prisma returns Date/JsonValue; map back to the string-timestamp row shape that
// rowToTemplate (and the rest of the app) expects.
type PrismaTemplate = Awaited<ReturnType<typeof prisma.templates.findUniqueOrThrow>>;
function toTemplateRow(t: PrismaTemplate): TemplateRow {
  return {
    id: t.id,
    company_id: t.company_id,
    name: t.name,
    description: t.description,
    status: t.status as TemplateStatus,
    version: t.version,
    target_configuration: t.target_configuration as unknown as TemplateRow["target_configuration"],
    source_configuration: t.source_configuration as unknown as TemplateRow["source_configuration"],
    rules: t.rules as unknown as TemplateRow["rules"],
    default_rule: (t.default_rule ?? null) as unknown as TemplateRow["default_rule"],
    unique_target_fields: t.unique_target_fields as unknown as TemplateRow["unique_target_fields"],
    output_configuration: t.output_configuration as unknown as TemplateRow["output_configuration"],
    created_at: t.created_at.toISOString(),
    updated_at: t.updated_at.toISOString(),
    created_by: t.created_by,
  };
}

async function requireSuperAdmin() {
  const session = await getSessionProfile();
  if (session?.profile?.role !== "super_admin") throw new Error("Not authorized.");
  return session;
}

export async function listTemplates(): Promise<SavedConversionTemplate[]> {
  if (DEMO) return demoStore.listTemplates();
  const rows = await prisma.templates.findMany({ orderBy: { updated_at: "desc" } });
  return rows.map((r) => rowToTemplate(toTemplateRow(r)));
}

export async function getTemplateById(id: string): Promise<SavedConversionTemplate | null> {
  if (DEMO) return demoStore.getTemplate(id);
  const row = await prisma.templates.findUnique({ where: { id } });
  return row ? rowToTemplate(toTemplateRow(row)) : null;
}

async function snapshotVersion(templateId: string, version: number, userId?: string) {
  const t = await prisma.templates.findUnique({ where: { id: templateId } });
  if (!t) return;
  await prisma.template_versions.create({
    data: {
      template_id: templateId,
      version,
      snapshot: asJson(toTemplateRow(t)),
      created_by: userId ?? null,
    },
  });
}

export async function createTemplate(payload: TemplatePayload): Promise<string> {
  if (DEMO) return demoStore.createTemplate(payload);
  const session = await requireSuperAdmin();
  const created = await prisma.templates.create({
    data: { ...payloadColumns(payload), version: 1, created_by: session.userId },
    select: { id: true },
  });
  await snapshotVersion(created.id, 1, session.userId);
  revalidatePath("/admin/templates");
  return created.id;
}

export async function updateTemplate(
  id: string,
  payload: TemplatePayload,
  options: { bumpVersion?: boolean } = {},
): Promise<void> {
  if (DEMO) {
    demoStore.updateTemplate(id, payload);
    return;
  }
  const session = await requireSuperAdmin();

  const existing = await prisma.templates.findUnique({ where: { id }, select: { version: true } });
  const nextVersion = (existing?.version ?? 1) + (options.bumpVersion ? 1 : 0);

  await prisma.templates.update({
    where: { id },
    data: { ...payloadColumns(payload), version: nextVersion },
  });

  if (options.bumpVersion) await snapshotVersion(id, nextVersion, session.userId);
  revalidatePath("/admin/templates");
  revalidatePath(`/admin/templates/${id}`);
}

export async function deleteTemplate(id: string): Promise<void> {
  if (DEMO) {
    demoStore.deleteTemplate(id);
    return;
  }
  await requireSuperAdmin();
  await prisma.templates.delete({ where: { id } });
  revalidatePath("/admin/templates");
}

export async function duplicateTemplate(id: string): Promise<string> {
  if (DEMO) return demoStore.duplicateTemplate(id);
  const session = await requireSuperAdmin();
  const src = await prisma.templates.findUnique({ where: { id } });
  if (!src) throw new Error("Template not found.");
  const created = await prisma.templates.create({
    data: {
      company_id: src.company_id,
      name: `${src.name} (copy)`,
      description: src.description,
      status: "draft",
      version: 1,
      target_configuration: asJson(src.target_configuration),
      source_configuration: asJson(src.source_configuration),
      rules: asJson(src.rules),
      default_rule: src.default_rule == null ? Prisma.DbNull : asJson(src.default_rule),
      unique_target_fields: asJson(src.unique_target_fields),
      output_configuration: asJson(src.output_configuration),
      created_by: session.userId,
    },
    select: { id: true },
  });
  revalidatePath("/admin/templates");
  return created.id;
}
