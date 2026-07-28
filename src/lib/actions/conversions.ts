"use server";

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getSessionProfile } from "@/lib/auth";
import type { Json } from "@/lib/supabase/types";
import type { ConversionResult } from "@/lib/engine/types";
import { DEMO, demoStore } from "@/lib/demo";

export async function logConversion(input: {
  templateId: string;
  companyId: string;
  templateVersion: number;
  sourceFileName: string;
  summary: ConversionResult["summary"];
}): Promise<void> {
  if (DEMO) {
    const s = input.summary;
    demoStore.logConversion({
      template_id: input.templateId,
      company_id: input.companyId,
      template_version: input.templateVersion,
      source_file_name: input.sourceFileName,
      total_rows: s.total,
      ready_rows: s.ready,
      incomplete_rows: s.missingInTime + s.missingOutTime + s.nextDayRecordMissing,
      excluded_rows: s.excluded,
    });
    return;
  }
  const session = await getSessionProfile();
  if (!session) throw new Error("Not authenticated.");
  const s = input.summary;
  await prisma.conversions.create({
    data: {
      template_id: input.templateId,
      company_id: input.companyId,
      template_version: input.templateVersion,
      source_file_name: input.sourceFileName,
      total_rows: s.total,
      ready_rows: s.ready,
      incomplete_rows: s.missingInTime + s.missingOutTime + s.nextDayRecordMissing,
      excluded_rows: s.excluded,
      summary: s as unknown as Prisma.InputJsonValue,
      created_by: session.userId,
    },
  });
}

export async function listRecentConversions(limit = 20) {
  if (DEMO) return demoStore.listConversions(limit);
  const rows = await prisma.conversions.findMany({
    orderBy: { created_at: "desc" },
    take: limit,
  });
  return rows.map((c) => ({
    id: c.id,
    template_id: c.template_id,
    company_id: c.company_id,
    source_file_name: c.source_file_name,
    template_version: c.template_version,
    total_rows: c.total_rows,
    ready_rows: c.ready_rows,
    incomplete_rows: c.incomplete_rows,
    excluded_rows: c.excluded_rows,
    summary: c.summary as unknown as Json,
    created_at: c.created_at.toISOString(),
    created_by: c.created_by,
  }));
}
