/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ExcelJS is a heavy CommonJS lib used only in client components (browser-side
  // conversion). Marking it external stops Next from trying to emit a server
  // vendor chunk for it (which fails in dev with "Cannot find module
  // ./vendor-chunks/exceljs...").
  serverExternalPackages: ["exceljs", "@prisma/client"],
  // ExcelJS runs in the browser (client-side conversion so source data never
  // leaves the user's machine). It references some Node core modules that are
  // not needed in the browser build; alias them to an empty module so the
  // client bundle does not choke. Next 16 builds with Turbopack by default,
  // so these belong under `turbopack.resolveAlias` (the old `webpack` fallback
  // config is ignored by Turbopack and makes `next build` error out).
  turbopack: {
    resolveAlias: {
      fs: { browser: "./src/lib/empty-module.ts" },
      stream: { browser: "./src/lib/empty-module.ts" },
      crypto: { browser: "./src/lib/empty-module.ts" },
    },
  },
};

export default nextConfig;
