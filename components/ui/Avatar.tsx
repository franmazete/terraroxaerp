"use client";

interface Props {
  /** URL da foto. Se ausente, mostra iniciais. */
  src?: string;
  /** Nome usado para gerar iniciais e cor consistente. */
  nome: string;
  /** Tamanho em px. Default 36. */
  size?: number;
  /** Quando true, exibe um indicador de "✓ foto anexada" no canto. */
  ativo?: boolean;
}

function getInitials(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** Cor consistente baseada no hash do nome (HSL com saturação baixa). */
function getColorFromName(nome: string): string {
  let hash = 0;
  for (let i = 0; i < nome.length; i++) {
    hash = (hash << 5) - hash + nome.charCodeAt(i);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 35%, 45%)`;
}

export function Avatar({ src, nome, size = 36, ativo }: Props) {
  const initials = getInitials(nome);
  const bg = getColorFromName(nome);

  return (
    <div style={{ position: "relative", display: "inline-block", flexShrink: 0 }}>
      <div
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          background: src ? "transparent" : bg,
          color: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: Math.floor(size * 0.4),
          fontWeight: 700,
          overflow: "hidden",
          border: "2px solid var(--surface)",
          boxShadow: "0 0 0 1px var(--border)",
        }}
        title={nome}
      >
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={nome} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          initials
        )}
      </div>
      {ativo && (
        <span
          style={{
            position: "absolute",
            bottom: -2,
            right: -2,
            width: Math.floor(size * 0.35),
            height: Math.floor(size * 0.35),
            borderRadius: "50%",
            background: "var(--g400)",
            border: "2px solid var(--surface)",
          }}
        />
      )}
    </div>
  );
}
