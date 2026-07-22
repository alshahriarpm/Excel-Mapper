import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";
import { listCompanies, listCompanyUsers } from "@/lib/actions/companies";
import { TopBar } from "@/components/organisms/top-bar";
import { CompaniesClient } from "@/components/organisms/companies-client";
import { BackButton } from "@/components/molecules/back-button";

export default async function CompaniesPage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.profile?.role !== "super_admin") redirect("/");

  const companies = await listCompanies();
  const usersByCompany: Record<string, Awaited<ReturnType<typeof listCompanyUsers>>> = {};
  await Promise.all(
    companies.map(async (c) => {
      usersByCompany[c.id] = await listCompanyUsers(c.id);
    }),
  );

  return (
    <>
      <TopBar role="Admin" email={session.email} homeHref="/admin" />
      <main className="mx-auto max-w-4xl p-6 lg:p-10">
        <div className="mb-4">
          <BackButton fallbackHref="/admin" />
        </div>
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">Companies</h1>
          <p className="text-muted-foreground">Create companies and invite their HR users.</p>
        </header>
        <CompaniesClient
          companies={companies.map((c) => ({ id: c.id, name: c.name, blocked: c.blocked }))}
          usersByCompany={usersByCompany}
        />
      </main>
    </>
  );
}
