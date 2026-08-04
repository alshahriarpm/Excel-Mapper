import { notFound, redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { getTemplateById } from "@/lib/actions/templates";
import { listCompanies } from "@/lib/actions/companies";
import { TopBar } from "@/components/organisms/top-bar";
import { TemplateBuilder } from "@/components/organisms/template-builder/template-builder";
import { BackButton } from "@/components/molecules/back-button";

export const dynamic = "force-dynamic";

export default async function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.profile?.role !== "super_admin") redirect("/");

  const [template, companies] = await Promise.all([
    getTemplateById(id),
    listCompanies().then((cs) => cs.map((c) => ({ id: c.id, name: c.name }))),
  ]);
  if (!template) notFound();

  return (
    <>
      <TopBar role="Admin" email={session.email} homeHref="/admin" />
      <div className="mx-auto max-w-6xl px-6 pt-4 lg:px-10">
        <BackButton label="Back to templates" fallbackHref="/admin/templates" />
      </div>
      <TemplateBuilder companies={companies} initial={template} />
    </>
  );
}
