/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // ExcelJS is a heavy CommonJS lib used only in client components (browser-side
  // conversion). Marking it external stops Next from trying to emit a server
  // vendor chunk for it (which fails in dev with "Cannot find module
  // ./vendor-chunks/exceljs...").
  serverExternalPackages: ["exceljs"],
  // ExcelJS runs in the browser (client-side conversion so source data never
  // leaves the user's machine). It references some Node core modules that are
  // not needed in the browser build; stub them out so webpack does not choke.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        stream: false,
        crypto: false,
      };
    }
    return config;
  },
};

export default nextConfig;
