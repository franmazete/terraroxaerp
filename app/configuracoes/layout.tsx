import { SharedShell } from "@/components/layout/SharedShell";

export default function ConfigLayout({ children }: { children: React.ReactNode }) {
  return <SharedShell>{children}</SharedShell>;
}
