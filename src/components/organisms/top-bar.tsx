import Link from "next/link";
import { cookies } from "next/headers";
import { ThemeToggle } from "@/components/molecules/theme-toggle";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";

export async function TopBar({
  role,
  email,
  homeHref,
  right,
}: {
  role: string;
  email?: string | null;
  homeHref: string;
  right?: React.ReactNode;
}) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3">
        <Link href={homeHref} className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
            BM
          </span>
          <span className="text-sm font-semibold">Bulk Mapper</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground">{role}</span>
        </Link>
        <div className="flex items-center gap-3">
          {right}
          {email && <span className="hidden text-sm text-muted-foreground sm:inline">{email}</span>}
          <ThemeToggle initial={theme} />
          <form action="/auth/signout" method="post">
            <button className="text-sm text-muted-foreground hover:text-foreground">Sign out</button>
          </form>
        </div>
      </div>
    </header>
  );
}
