import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { DataStoreProvider } from "@/lib/data-store";
import { ToastProvider } from "@/components/ui/Toast";
import { ConfirmDialogProvider } from "@/components/ui/ConfirmDialog";

export const metadata: Metadata = {
  title: "Portal de Cargas — terraroxa",
  description: "Marketplace logístico para cerealistas e transportadoras parceiras.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <a href="#conteudo-principal" className="skip-link">Pular para o conteúdo</a>
        <ToastProvider>
          <ConfirmDialogProvider>
            <AuthProvider>
              <DataStoreProvider>{children}</DataStoreProvider>
            </AuthProvider>
          </ConfirmDialogProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
