export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  try {
    const { seedAdminFromEnv } = await import("@/lib/seed");
    await seedAdminFromEnv();
  } catch (e) {
    console.error("[startup] admin seeding skipped:", e instanceof Error ? e.message : e);
  }
}
