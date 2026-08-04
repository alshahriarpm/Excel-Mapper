import Link from "next/link";
import { redirect } from "next/navigation";
import { FileSpreadsheet, ArrowRight, Inbox } from "lucide-react";
import { getSessionProfile } from "@/lib/auth";
import { listTemplates } from "@/lib/actions/templates";
import { TopBar } from "@/components/organisms/top-bar";
import { EmptyState } from "@/components/molecules/empty-state";
import { Card, CardContent } from "@/components/atoms/ui/card";

export const dynamic = "force-dynamic";

export default async function HrHome() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");
  if (session.profile?.role !== "hr") redirect("/");

  const templates = (await listTemplates()).filter((t) => t.status === "active");

  return (
    <>
      <TopBar role="HR" email={session.email} homeHref="/hr" />
      <main className="mx-auto max-w-5xl p-6 lg:p-10">
        <header className="mb-8">
          <p className="text-sm font-medium text-primary">Convert a file</p>
          <h1 className="text-2xl font-semibold tracking-tight">Pick a template to begin</h1>
          <p className="mt-1 text-muted-foreground">
            Choose the setup your administrator prepared, then upload your attendance file.
          </p>
        </header>

        {templates.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="No templates yet"
            description="Your administrator hasn't published a conversion template for your company yet. Please check back soon."
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {templates.map((t) => (
              <Link key={t.id} href={`/hr/convert/${t.id}`} className="group">
                <Card className="h-full transition-all hover:shadow-soft-lg dark:hover:border-primary/40">
                  <CardContent className="flex items-start gap-4 p-6">
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h2 className="font-semibold">{t.name}</h2>
                      {t.description && (
                        <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{t.description}</p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        Produces {t.targetConfiguration.originalFileName}
                      </p>
                    </div>
                    <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </main>
    </>
  );
}
