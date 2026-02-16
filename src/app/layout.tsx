import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";
import { Settings as SettingsIcon } from "lucide-react";
import Link from "next/link";
import { Toaster } from "sonner";
import { SignOutButton } from "@/components/auth/SignOutButton";
import { BottomNav } from "@/components/ui/BottomNav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Nexo Asesores | MVP",
  description: "Plataforma de gestión de prospectos para asesores",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <div className="min-h-screen flex flex-col">
          {/* Navigation */}
          <nav className="sticky top-0 z-50 backdrop-blur-md bg-white/5 border-b border-white/10 px-4 sm:px-6 py-3 sm:py-4">
            <div className="max-w-7xl mx-auto flex items-center justify-between">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-white font-bold text-sm">
                  N
                </div>
                <span className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400">
                  Nexo
                </span>
              </Link>

              <div className="flex items-center gap-2 sm:gap-4">
                <Link
                  href="/settings"
                  className="hidden sm:flex p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-white/5 transition-colors text-slate-600 dark:text-slate-400"
                  title="Configuración"
                >
                  <SettingsIcon className="w-5 h-5" />
                </Link>
                <SignOutButton />
              </div>
            </div>
          </nav>

          <main className="flex-1 max-w-7xl mx-auto w-full p-4 sm:p-6 pb-24 md:pb-6">
            {children}
          </main>
        </div>
        <BottomNav />
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
