import type { Metadata } from "next";
import { Fira_Code } from "next/font/google";
import { Toaster } from "sonner";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${firaCode.variable} font-mono antialiased`}>
        {children}
        <Toaster richColors closeButton position="top-center" />
      </body>
    </html>
  );
}
