import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, FileSpreadsheet, Plus, Clock } from "lucide-react";
import { getSessionProfile } from "@/lib/auth";
import { listRecentConversions } from "@/lib/actions/conversions";
import { TopBar } from "@/components/organisms/top-bar";
import { Card, CardContent } from "@/components/atoms/ui/card";

export default async function AdminHome() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.profile?.role !== "super_admin") redirect("/");

  const recent = await listRecentConversions(8).catch(() => []);

  const actions = [
    { href: "/admin/companies", icon: Building2, title: "Companies", desc: "Create companies and invite their HR users." },
    { href: "/admin/templates", icon: FileSpreadsheet, title: "Conversion templates", desc: "Build and manage the setup for each company." },
    { href: "/admin/templates/new", icon: Plus, title: "Create a new template", desc: "Upload a target file and configure the rules." },
  ];

  return (
    <>
      <TopBar role="Admin" email={session.email} homeHref="/admin" />
      <main className="mx-auto max-w-5xl p-6 lg:p-10">
        <header className="mb-8">
          <p className="text-sm font-medium text-primary">Admin Studio</p>
          <h1 className="text-2xl font-semibold tracking-tight">What would you like to do?</h1>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          {actions.map((a) => (
            <Link key={a.href} href={a.href} className="group">
              <Card className="h-full transition-shadow hover:shadow-soft-lg">
                <CardContent className="p-6">
                  <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                    <a.icon className="h-5 w-5" />
                  </div>
                  <h2 className="font-semibold">{a.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{a.desc}</p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>

        <section className="mt-10">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <Clock className="h-4 w-4" /> Recent conversions
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No conversions have been run yet.</p>
          ) : (
            <Card>
              <CardContent className="divide-y divide-border p-0">
                {recent.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span className="truncate">{c.source_file_name ?? "—"}</span>
                    <span className="text-muted-foreground">
                      {c.ready_rows}/{c.total_rows} ready · {new Date(c.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </section>
      </main>
    </>
  );
}
