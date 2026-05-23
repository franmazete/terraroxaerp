"use client";

import { useState } from "react";

type Empresa = "terra-roxa" | "tr-trading";

interface Props {
  /** Qual empresa exibir. Default: terra-roxa. */
  empresa?: Empresa;
  /** Altura em px. Largura é proporcional. */
  height?: number;
  /** Se true e a imagem falhar, mostra um fallback minimalista de texto. */
  showFallback?: boolean;
}

const META: Record<Empresa, { src: string; alt: string; corFallback: string; texto: string }> = {
  "terra-roxa": {
    src: "/logos/terra-roxa.png",
    alt: "Terra Roxa Comércio de Cereais",
    corFallback: "var(--r600)",
    texto: "TERRA ROXA",
  },
  "tr-trading": {
    src: "/logos/tr-trading.png",
    alt: "TR Trading Exportação LTDA",
    corFallback: "var(--r600)",
    texto: "TR TRADING",
  },
};

export function Logo({ empresa = "terra-roxa", height = 40, showFallback = true }: Props) {
  const [erro, setErro] = useState(false);
  const meta = META[empresa];

  if (erro || !showFallback) {
    // Fallback estilizado (texto) enquanto o PNG não for adicionado
    return (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          fontWeight: 800,
          fontSize: Math.round(height * 0.42),
          color: meta.corFallback,
          letterSpacing: ".02em",
          lineHeight: 1,
          padding: `${Math.round(height * 0.1)}px 0`,
        }}
        aria-label={meta.alt}
        title={meta.alt}
      >
        {meta.texto}
      </span>
    );
  }

  // Usamos <img> simples (não next/image) pra suportar fallback dinâmico
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={meta.src}
      alt={meta.alt}
      title={meta.alt}
      onError={() => setErro(true)}
      style={{
        height,
        width: "auto",
        objectFit: "contain",
        display: "block",
      }}
    />
  );
}
