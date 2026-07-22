"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/server";
import { prisma } from "@/lib/db";
import { getSessionProfile } from "@/lib/auth";
import type { Database, UserRole } from "@/lib/supabase/types";
import { DEMO, demoStore } from "@/lib/demo";
import { validatePassword } from "@/lib/password";

export type Company = Database["public"]["Tables"]["companies"]["Row"];

async function requireSuperAdmin() {
  const session = await getSessionProfile();
  if (session?.profile?.role !== "super_admin") throw new Error("Not authorized.");
  return session;
}

export async function listCompanies(): Promise<Company[]> {
  if (DEMO) return demoStore.listCompanies();
  const rows = await prisma.companies.findMany({ orderBy: { name: "asc" } });
  return rows.map((c) => ({
    id: c.id,
    name: c.name,
    blocked: c.blocked,
    created_at: c.created_at.toISOString(),
    created_by: c.created_by,
  }));
}

export async function createCompany(name: string): Promise<string> {
  if (DEMO) return demoStore.createCompany(name.trim());
  const session = await requireSuperAdmin();
  const company = await prisma.companies.create({
    data: { name: name.trim(), created_by: session.userId },
    select: { id: true },
  });
  revalidatePath("/admin/companies");
  return company.id;
}

/**
 * Create an HR user for a company. Uses the Supabase Auth admin API so the
 * account is provisioned server-side; the DB trigger creates their profile
 * (role=hr) from the user metadata.
 */
export async function createHrUser(input: {
  email: string;
  password: string;
  fullName?: string;
  companyId: string;
}): Promise<void> {
  const weak = validatePassword(input.password);
  if (weak) throw new Error(weak);

  if (DEMO) {
    demoStore.createUser(input.email.trim(), input.fullName ?? "", input.companyId);
    return;
  }
  await requireSuperAdmin();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: input.email.trim(),
    password: input.password,
    email_confirm: true,
    user_metadata: {
      full_name: input.fullName ?? "",
      role: "hr",
      company_id: input.companyId,
    },
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/companies");
}

export async function listCompanyUsers(companyId: string) {
  if (DEMO) return demoStore.listUsers(companyId);
  await requireSuperAdmin();
  const rows = await prisma.profiles.findMany({
    where: { company_id: companyId },
    select: { id: true, email: true, full_name: true, role: true, company_id: true, blocked: true },
  });
  return rows.map((u) => ({ ...u, role: u.role as UserRole }));
}

/** Block or unblock a whole company (locks out all its HR users). */
export async function setCompanyBlocked(companyId: string, blocked: boolean): Promise<void> {
  await requireSuperAdmin();
  if (DEMO) {
    demoStore.setCompanyBlocked(companyId, blocked);
    revalidatePath("/admin/companies");
    return;
  }
  await prisma.companies.update({ where: { id: companyId }, data: { blocked } });
  revalidatePath("/admin/companies");
}

/**
 * Delete a company.
 *  - Default (guarded): refuses while it still has users or templates, so
 *    nothing is silently orphaned. Remove those first.
 *  - force = true: deletes the company AND everything under it — its HR users
 *    (auth accounts), templates, versions, and conversion history.
 */
export async function deleteCompany(companyId: string, force = false): Promise<void> {
  await requireSuperAdmin();

  if (DEMO) {
    if (!force) {
      const blocker = demoStore.companyDeletionBlocker(companyId);
      if (blocker) throw new Error(blocker);
    }
    demoStore.deleteCompany(companyId, force);
    revalidatePath("/admin/companies");
    return;
  }

  if (!force) {
    const [userCount, templateCount] = await Promise.all([
      prisma.profiles.count({ where: { company_id: companyId } }),
      prisma.templates.count({ where: { company_id: companyId } }),
    ]);
    if (userCount > 0 || templateCount > 0) {
      throw new Error(
        `This company still has ${userCount} user(s) and ${templateCount} template(s). Remove them first, or use Force delete.`,
      );
    }
  } else {
    // Force: delete the company's HR auth accounts. Templates, versions and
    // conversions are removed automatically by ON DELETE CASCADE.
    const hrUsers = await prisma.profiles.findMany({
      where: { company_id: companyId, role: "hr" },
      select: { id: true },
    });
    if (hrUsers.length > 0) {
      const admin = createAdminClient();
      await Promise.all(hrUsers.map((u) => admin.auth.admin.deleteUser(u.id)));
    }
  }

  await prisma.companies.delete({ where: { id: companyId } });
  revalidatePath("/admin/companies");
}

/** Block or unblock a user: bans them in Supabase Auth and mirrors the flag. */
export async function setUserBlocked(userId: string, blocked: boolean): Promise<void> {
  const session = await requireSuperAdmin();
  if (userId === session.userId) throw new Error("You can't block your own account.");

  if (DEMO) {
    demoStore.setUserBlocked(userId, blocked);
    revalidatePath("/admin/companies");
    return;
  }

  const admin = createAdminClient();
  const { error: banErr } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: blocked ? "876000h" : "none", // ~100 years, or lift the ban
  });
  if (banErr) throw new Error(banErr.message);
  await prisma.profiles.update({ where: { id: userId }, data: { blocked } });
  revalidatePath("/admin/companies");
}

/** Permanently delete a user account (profile cascades from auth.users). */
export async function deleteUser(userId: string): Promise<void> {
  const session = await requireSuperAdmin();
  if (userId === session.userId) throw new Error("You can't delete your own account.");

  if (DEMO) {
    demoStore.deleteUser(userId);
    revalidatePath("/admin/companies");
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/companies");
}
