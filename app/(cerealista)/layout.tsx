import { AppShell } from "@/components/layout/AppShell";

export default function CerealistaLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="cerealista">{children}</AppShell>;
}
