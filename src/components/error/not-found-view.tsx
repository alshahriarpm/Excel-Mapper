"use client";

import { usePathname } from "next/navigation";
import { ErrorActions } from "@/components/error/error-actions";
import { LinkRows, type LinkRow } from "@/components/error/link-rows";
import { PosterShell, type PosterLink } from "@/components/error/poster-shell";

export function NotFoundView({
  homeHref,
  navLinks,
  destinations,
}: {
  homeHref: string;
  navLinks: PosterLink[];
  destinations: LinkRow[];
}) {
  const pathname = usePathname();

  return (
    <PosterShell
      tone="primary"
      code="404"
      kindLabel="Not found"
      footNote={pathname}
      title="Page not found"
      description="We couldn't find the page you're looking for. It may have been moved, or the template it pointed to no longer exists."
      navLinks={navLinks}
      actions={
        <ErrorActions
          tone="primary"
          backFallbackHref={homeHref}
          accentLink={{ href: homeHref, label: "Go home" }}
        />
      }
    >
      <LinkRows rows={destinations} heading="Where you can go" tone="primary" />
    </PosterShell>
  );
}
