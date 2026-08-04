import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, FileSpreadsheet } from "lucide-react";
import { getSessionProfile } from "@/lib/auth";
import { listTemplates } from "@/lib/actions/templates";
import { listCompanies } from "@/lib/actions/companies";
import { TopBar } from "@/components/organisms/top-bar";
import { TemplateListClient } from "@/components/organisms/template-list-client";
import { EmptyState } from "@/components/molecules/empty-state";
import { BackButton } from "@/components/molecules/back-button";
import { Button } from "@/components/atoms/ui/button";

export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.profile?.role !== "super_admin") redirect("/");

  const [templates, companies] = await Promise.all([listTemplates(), listCompanies()]);
  const companyNames = Object.fromEntries(companies.map((c) => [c.id, c.name]));

  return (
    <>
      <TopBar role="Admin" email={session.email} homeHref="/admin" />
      <main className="mx-auto max-w-5xl p-6 lg:p-10">
        <div className="mb-4">
          <BackButton fallbackHref="/admin" />
        </div>
        <header className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Conversion templates</h1>
            <p className="text-muted-foreground">Build and manage the setup for each company.</p>
          </div>
          <Button asChild>
            <Link href="/admin/templates/new">
              <Plus className="h-4 w-4" /> New template
            </Link>
          </Button>
        </header>

        {templates.length === 0 ? (
          <EmptyState
            icon={<FileSpreadsheet className="h-6 w-6" />}
            title="No templates yet"
            description="Create your first conversion template: upload a target file, match the columns, and set the rules."
            action={
              <Button asChild>
                <Link href="/admin/templates/new">Create a template</Link>
              </Button>
            }
          />
        ) : (
          <TemplateListClient templates={templates} companyNames={companyNames} />
        )}
      </main>
    </>
  );
}
