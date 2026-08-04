import { Building2, FileSpreadsheet, LayoutDashboard, LogIn, Plus } from "lucide-react";
import { getSessionProfile } from "@/lib/auth";
import { NotFoundView } from "@/components/error/not-found-view";
import type { Destination } from "@/components/error/destination-grid";

const ADMIN_DESTINATIONS: Destination[] = [
  {
    href: "/admin",
    label: "Admin Studio",
    description: "Recent conversions and everything you manage",
    icon: <LayoutDashboard />,
  },
  {
    href: "/admin/templates",
    label: "Conversion templates",
    description: "Build and manage the setup for each company",
    icon: <FileSpreadsheet />,
  },
  {
    href: "/admin/companies",
    label: "Companies",
    description: "Create companies and invite their HR users",
    icon: <Building2 />,
  },
  {
    href: "/admin/templates/new",
    label: "New template",
    description: "Upload a target file and configure the rules",
    icon: <Plus />,
  },
];

const HR_DESTINATIONS: Destination[] = [
  {
    href: "/hr",
    label: "Convert a file",
    description: "Pick a template and upload your attendance file",
    icon: <FileSpreadsheet />,
  },
];

const GUEST_DESTINATIONS: Destination[] = [
  {
    href: "/login",
    label: "Sign in",
    description: "Accounts are created by your administrator",
    icon: <LogIn />,
  },
];

export default async function NotFound() {
  const session = await getSessionProfile().catch(() => null);
  const role = session?.profile?.role;

  const destinations =
    role === "super_admin"
      ? ADMIN_DESTINATIONS
      : role === "hr"
        ? HR_DESTINATIONS
        : GUEST_DESTINATIONS;

  return <NotFoundView homeHref={session ? "/" : "/login"} destinations={destinations} />;
}
