import { redirect } from "next/navigation";
import { getSessionProfile } from "@/lib/auth";

/** Home dispatcher: route users to the right experience for their role. */
export default async function HomePage() {
  const session = await getSessionProfile();
  if (!session) redirect("/login");

  const role = session.profile?.role;
  if (role === "super_admin") redirect("/admin");
  if (role === "hr") redirect("/hr");

  // Signed in but not yet assigned a role/company.
  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">You&apos;re signed in</h1>
      <p className="text-muted-foreground">
        Your account isn&apos;t linked to a company yet. Please ask your administrator to finish
        setting up your access.
      </p>
      <form action="/auth/signout" method="post">
        <button className="text-sm text-primary underline underline-offset-4">Sign out</button>
      </form>
    </main>
  );
}
