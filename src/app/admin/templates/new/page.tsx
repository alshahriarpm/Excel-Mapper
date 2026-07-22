import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { listCompanies } from "@/lib/actions/companies";
import { TopBar } from "@/components/organisms/top-bar";
import { TemplateBuilder } from "@/components/organisms/template-builder/template-builder";
import { EmptyState } from "@/components/molecules/empty-state";
import { BackButton } from "@/components/molecules/back-button";
import { Button } from "@/components/atoms/ui/button";
import { Building2 } from "lucide-react";

export default async function NewTemplatePage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.profile?.role !== "super_admin") redirect("/");

  const companies = (await listCompanies()).map((c) => ({ id: c.id, name: c.name }));

  return (
    <>
      <TopBar role="Admin" email={session.email} homeHref="/admin" />
      <div className="mx-auto max-w-6xl px-6 pt-4 lg:px-10">
        <BackButton label="Back to templates" fallbackHref="/admin/templates" />
      </div>
      {companies.length === 0 ? (
        <main className="mx-auto max-w-2xl p-10">
          <EmptyState
            icon={<Building2 className="h-6 w-6" />}
            title="Create a company first"
            description="Templates belong to a company. Add your first company, then come back to build its template."
            action={
              <Button asChild>
                <Link href="/admin/companies">Go to companies</Link>
              </Button>
            }
          />
        </main>
      ) : (
        <TemplateBuilder companies={companies} />
      )}
    </>
  );
}
