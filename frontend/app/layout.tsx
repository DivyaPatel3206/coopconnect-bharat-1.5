import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth";
import AppShell from "@/components/AppShell";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = {
  title: "CoopConnect Bharat",
  description: "Learn. Certify. Connect. Grow. A digital ecosystem for cooperative training in India.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-body min-h-screen">
        <AuthProvider>
          <ToastProvider><AppShell>{children}</AppShell></ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
