export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { seedAdminFromEnv } = await import("@/lib/seed");
    await seedAdminFromEnv();
  }
}
