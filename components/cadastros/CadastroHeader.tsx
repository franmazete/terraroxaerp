import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";

interface Props {
  title: string;
  description?: string;
  icon?: string;
  count?: number;
  onNovo?: () => void;
  novoLabel?: string;
  extras?: ReactNode;
}

export function CadastroHeader({ title, description, icon, count, onNovo, novoLabel = "Novo cadastro", extras }: Props) {
  return (
    <div className="page-header">
      <div>
        <div className="page-title">
          {icon && <span style={{ marginRight: 8 }}>{icon}</span>}
          {title}
          {typeof count === "number" && (
            <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 500, color: "var(--hint)" }}>
              ({count.toLocaleString("pt-BR")})
            </span>
          )}
        </div>
        {description && (
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{description}</div>
        )}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        {extras}
        {onNovo && (
          <Button variant="primary" onClick={onNovo}>
            ＋ {novoLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
