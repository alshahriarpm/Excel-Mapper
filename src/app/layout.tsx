import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Fira_Code } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeScript } from "@/components/molecules/theme-script";
import { parseTheme, THEME_COOKIE } from "@/lib/theme";
import "./globals.css";

const firaCode = Fira_Code({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Bulk Mapper — HRIS Import Normalizer",
  description:
    "Turn any attendance export into your exact upload format. Set it up once, reuse it forever.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const theme = parseTheme((await cookies()).get(THEME_COOKIE)?.value);

  return (
    <html lang="en" className={theme === "dark" ? "dark" : undefined} suppressHydrationWarning>
      <head>
        <ThemeScript theme={theme} />
      </head>
      <body className={`${firaCode.variable} font-mono antialiased`} suppressHydrationWarning>
        {children}
        <Toaster richColors closeButton position="top-center" theme={theme} />
      </body>
    </html>
  );
}
