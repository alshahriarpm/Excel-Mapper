export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type UserRole = "super_admin" | "hr";
export type TemplateStatus = "draft" | "active" | "inactive";

type CompanyRow = { id: string; name: string; blocked: boolean; created_at: string; created_by: string | null };
type CompanyInsert = { id?: string; name: string; blocked?: boolean; created_at?: string; created_by?: string | null };
type CompanyUpdate = { id?: string; name?: string; blocked?: boolean; created_by?: string | null };

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  role: UserRole;
  company_id: string | null;
  blocked: boolean;
  created_at: string;
};
type ProfileInsert = {
  id: string;
  email?: string | null;
  full_name?: string | null;
  role?: UserRole;
  company_id?: string | null;
  blocked?: boolean;
  created_at?: string;
};
type ProfileUpdate = {
  email?: string | null;
  full_name?: string | null;
  role?: UserRole;
  company_id?: string | null;
  blocked?: boolean;
};

type TemplateRowT = {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  status: TemplateStatus;
  version: number;
  target_configuration: Json;
  source_configuration: Json;
  rules: Json;
  default_rule: Json | null;
  unique_target_fields: Json;
  output_configuration: Json;
  created_at: string;
  updated_at: string;
  created_by: string | null;
};
type TemplateInsert = {
  id?: string;
  company_id: string;
  name: string;
  description?: string | null;
  status?: TemplateStatus;
  version?: number;
  target_configuration?: Json;
  source_configuration?: Json;
  rules?: Json;
  default_rule?: Json | null;
  unique_target_fields?: Json;
  output_configuration?: Json;
  created_by?: string | null;
};
type TemplateUpdate = Partial<TemplateInsert>;

type TemplateVersionRow = {
  id: string;
  template_id: string;
  version: number;
  snapshot: Json;
  created_at: string;
  created_by: string | null;
};
type TemplateVersionInsert = {
  id?: string;
  template_id: string;
  version: number;
  snapshot: Json;
  created_by?: string | null;
};

type ConversionRowT = {
  id: string;
  template_id: string | null;
  company_id: string;
  source_file_name: string | null;
  template_version: number | null;
  total_rows: number;
  ready_rows: number;
  incomplete_rows: number;
  excluded_rows: number;
  summary: Json;
  created_at: string;
  created_by: string | null;
};
type ConversionInsert = {
  id?: string;
  template_id?: string | null;
  company_id: string;
  source_file_name?: string | null;
  template_version?: number | null;
  total_rows?: number;
  ready_rows?: number;
  incomplete_rows?: number;
  excluded_rows?: number;
  summary?: Json;
  created_by?: string | null;
};

export interface Database {
  public: {
    Tables: {
      companies: { Row: CompanyRow; Insert: CompanyInsert; Update: CompanyUpdate; Relationships: [] };
      profiles: { Row: ProfileRow; Insert: ProfileInsert; Update: ProfileUpdate; Relationships: [] };
      templates: { Row: TemplateRowT; Insert: TemplateInsert; Update: TemplateUpdate; Relationships: [] };
      template_versions: {
        Row: TemplateVersionRow;
        Insert: TemplateVersionInsert;
        Update: Partial<TemplateVersionInsert>;
        Relationships: [];
      };
      conversions: {
        Row: ConversionRowT;
        Insert: ConversionInsert;
        Update: Partial<ConversionInsert>;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      profile_role: { Args: Record<string, never>; Returns: string };
      current_company: { Args: Record<string, never>; Returns: string };
      is_super_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
