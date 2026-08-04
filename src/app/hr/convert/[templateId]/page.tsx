import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { DEMO, demoSampleRows } from "@/lib/demo";
import { getTemplateById } from "@/lib/actions/templates";
import { TopBar } from "@/components/organisms/top-bar";
import { HrConvertClient } from "@/components/organisms/hr-convert-client";

export const dynamic = "force-dynamic";

export default async function HrConvertPage({
  params,
}: {
  params: Promise<{ templateId: string }>;
}) {
  const { templateId } = await params;
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.profile?.role !== "hr") redirect("/");

  const template = await getTemplateById(templateId);
  if (
    !template ||
    template.companyId !== session.profile?.company_id ||
    template.status !== "active"
  ) {
    redirect("/hr");
  }

  return (
    <>
      <TopBar role="HR" email={session.email} homeHref="/hr" />
      <HrConvertClient
        template={template}
        companyId={session.profile?.company_id ?? template.companyId}
        sampleRows={DEMO ? demoSampleRows() : undefined}
      />
    </>
  );
}
