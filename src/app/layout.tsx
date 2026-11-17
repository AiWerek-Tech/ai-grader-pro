import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { Toaster } from 'sonner';
import ErrorBoundaryWrapper from '@/components/error/ErrorBoundaryWrapper';
import { PwaOfflineBridge } from '@/components/PwaOfflineBridge';
import { withBasePath } from '@/lib/base-path';

export const metadata: Metadata = {
  title: "WMVAA AI Grader Pro",
  description: "Asisten penilaian digital edge-cloud dengan Gemini AI",
  manifest: withBasePath("/manifest.webmanifest"),
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "WMVAA Grader",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: "#09051f",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body className="antialiased transition-colors duration-300">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <PwaOfflineBridge />
          <ErrorBoundaryWrapper>
            <main className="app-wrapper">
              {children}
            </main>
          </ErrorBoundaryWrapper>
          <Toaster position="top-center" richColors theme="system" closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
