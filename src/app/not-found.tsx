import { getSessionProfile } from "@/lib/auth";
import { NotFoundView } from "@/components/error/not-found-view";
import type { LinkRow } from "@/components/error/link-rows";
import type { PosterLink } from "@/components/error/poster-shell";

const ADMIN_DESTINATIONS: LinkRow[] = [
  { href: "/admin", label: "Admin Studio", description: "Recent conversions and everything you manage" },
  {
    href: "/admin/templates",
    label: "Conversion templates",
    description: "Build and manage the setup for each company",
  },
  { href: "/admin/companies", label: "Companies", description: "Create companies and invite their HR users" },
  {
    href: "/admin/templates/new",
    label: "New template",
    description: "Upload a target file and configure the rules",
  },
];

const HR_DESTINATIONS: LinkRow[] = [
  { href: "/hr", label: "Convert a file", description: "Pick a template and upload your attendance file" },
];

const GUEST_DESTINATIONS: LinkRow[] = [
  { href: "/login", label: "Sign in", description: "Accounts are created by your administrator" },
];

export default async function NotFound() {
  const session = await getSessionProfile().catch(() => null);
  const role = session?.profile?.role;

  const destinations =
    role === "super_admin" ? ADMIN_DESTINATIONS : role === "hr" ? HR_DESTINATIONS : GUEST_DESTINATIONS;

  const homeHref = session ? "/" : "/login";
  const navLinks: PosterLink[] = session
    ? [{ href: "/", label: "Home" }, { href: destinations[0]!.href, label: "Dashboard" }]
    : [{ href: "/login", label: "Sign in" }];

  return <NotFoundView homeHref={homeHref} navLinks={navLinks} destinations={destinations} />;
}
