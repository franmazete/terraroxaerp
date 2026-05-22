import { AppShell } from "@/components/layout/AppShell";

export default function TranspLayout({ children }: { children: React.ReactNode }) {
  return <AppShell role="transportadora">{children}</AppShell>;
}
