"use server";

import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { getSessionProfile } from "@/lib/auth";
import { DEMO } from "@/lib/demo";
import { parseTheme, THEME_COOKIE, type Theme } from "@/lib/theme";

const ONE_YEAR = 60 * 60 * 24 * 365;

export async function setTheme(value: Theme): Promise<void> {
  const theme = parseTheme(value);

  const store = await cookies();
  store.set(THEME_COOKIE, theme, {
    path: "/",
    maxAge: ONE_YEAR,
    sameSite: "lax",
  });

  if (DEMO) return;

  const session = await getSessionProfile();
  if (!session) return;

  await prisma.profiles
    .update({ where: { id: session.userId }, data: { theme } })
    .catch(() => undefined);
}
