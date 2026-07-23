import type {
  ConversionRule,
  OutputConfiguration,
  SavedConversionTemplate,
  SourceConfiguration,
  TargetWorkbookConfiguration,
} from "@/lib/engine/types";
import type { Database } from "@/lib/supabase/types";

export type TemplateRow = Database["public"]["Tables"]["templates"]["Row"];

export function rowToTemplate(row: TemplateRow): SavedConversionTemplate {
  return {
    id: row.id,
    companyId: row.company_id,
    name: row.name,
    description: row.description ?? undefined,
    targetConfiguration:
      row.target_configuration as unknown as TargetWorkbookConfiguration,
    sourceConfiguration:
      row.source_configuration as unknown as SourceConfiguration,
    rules: (row.rules as unknown as ConversionRule[]) ?? [],
    defaultRule: (row.default_rule as unknown as ConversionRule | null) ?? null,
    uniqueTargetFields: (row.unique_target_fields as unknown as string[]) ?? [],
    outputConfiguration:
      row.output_configuration as unknown as OutputConfiguration,
    status: row.status,
    version: row.version,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** The editable configuration payload (everything except server-managed fields). */
export type TemplatePayload = {
  companyId: string;
  name: string;
  description?: string;
  status: SavedConversionTemplate["status"];
  targetConfiguration: TargetWorkbookConfiguration;
  sourceConfiguration: SourceConfiguration;
  rules: ConversionRule[];
  defaultRule: ConversionRule | null;
  uniqueTargetFields: string[];
  outputConfiguration: OutputConfiguration;
};
