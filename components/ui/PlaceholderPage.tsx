import { Card } from "./Card";

interface Props {
  title: string;
  description?: string;
  bloco: string;
  icon?: string;
}

export function PlaceholderPage({ title, description, bloco, icon = "🚧" }: Props) {
  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">{title}</div>
          {description && (
            <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>{description}</div>
          )}
        </div>
      </div>
      <Card>
        <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--muted)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{icon}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>Em construção</div>
          <div style={{ fontSize: 12 }}>
            Esta tela será implementada no <strong style={{ color: "var(--g700)" }}>{bloco}</strong> da Etapa 1.5.
          </div>
        </div>
      </Card>
    </>
  );
}
