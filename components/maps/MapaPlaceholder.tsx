"use client";

import type { Local } from "@/lib/types";
import {
  distanciaHaversineKm,
  fmtDuracao,
  tempoEstimadoHoras,
  urlBuscaTexto,
  urlPonto,
  urlRota,
} from "@/lib/domain/geo";

interface Props {
  origem?: Local | null;
  destino?: Local | null;
  /** Compacto: usa menos altura (útil em sidebars). */
  compact?: boolean;
}

/**
 * Placeholder visual do Google Maps (mock). Mostra:
 *  - "Mapa" estilizado em grid
 *  - Pin de origem e destino com nome/cidade
 *  - Distância em linha reta + tempo estimado (caminhão @60 km/h)
 *  - Botão "Abrir no Google Maps" para rota OU ponto
 *  - Fallback quando lat/lng não cadastrados
 */
export function MapaPlaceholder({ origem, destino, compact }: Props) {
  const temOrigem = !!origem;
  const temDestino = !!destino;
  const temOrigemCoord = origem?.latitude != null && origem?.longitude != null;
  const temDestinoCoord = destino?.latitude != null && destino?.longitude != null;
  const temRota = temOrigemCoord && temDestinoCoord;

  const distKm = temRota
    ? distanciaHaversineKm(
        origem!.latitude!,
        origem!.longitude!,
        destino!.latitude!,
        destino!.longitude!,
      )
    : 0;
  const tempoH = tempoEstimadoHoras(distKm);

  const linkExterno = temRota
    ? urlRota(origem!.latitude!, origem!.longitude!, destino!.latitude!, destino!.longitude!)
    : temOrigemCoord
    ? urlPonto(origem!.latitude!, origem!.longitude!)
    : temDestinoCoord
    ? urlPonto(destino!.latitude!, destino!.longitude!)
    : temOrigem || temDestino
    ? urlBuscaTexto(`${(origem ?? destino)!.nome} ${(origem ?? destino)!.cidade} ${(origem ?? destino)!.uf}`)
    : null;

  return (
    <div
      style={{
        position: "relative",
        background:
          "repeating-linear-gradient(45deg, var(--surf2) 0 14px, var(--surf3) 14px 28px)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius)",
        overflow: "hidden",
        minHeight: compact ? 110 : 180,
      }}
    >
      {/* Pseudo-mapa decorativo */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 20% 30%, rgba(34,102,51,0.10), transparent 40%), radial-gradient(circle at 80% 70%, rgba(34,102,51,0.10), transparent 40%)",
          pointerEvents: "none",
        }}
      />

      <div
        style={{
          position: "relative",
          padding: compact ? 12 : 16,
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minHeight: compact ? 110 : 180,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
          }}
        >
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              color: "var(--muted)",
              textTransform: "uppercase",
              letterSpacing: ".08em",
            }}
          >
            🗺️ Visualização (mock — Google Maps real na Etapa 3+)
          </span>
        </div>

        {/* Pin de origem */}
        {temOrigem && (
          <div
            style={{
              display: "flex",
              alignItems: "start",
              gap: 8,
              background: "rgba(255,255,255,0.85)",
              padding: "8px 10px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--g400)",
            }}
          >
            <span style={{ fontSize: 18 }}>📍</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "var(--g700)", fontWeight: 700 }}>
                ORIGEM
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{origem!.nome}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                {origem!.cidade}/{origem!.uf}
                {temOrigemCoord && (
                  <span style={{ marginLeft: 6, fontFamily: "DM Mono, monospace", color: "var(--hint)" }}>
                    · {origem!.latitude!.toFixed(4)}, {origem!.longitude!.toFixed(4)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {temRota && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "6px 10px",
              background: "var(--g100)",
              borderRadius: "var(--radius)",
              fontSize: 12,
              color: "var(--g700)",
              fontWeight: 600,
            }}
          >
            <span>↕</span>
            <span>
              ~ <strong>{distKm.toFixed(0)} km</strong> em linha reta
            </span>
            <span style={{ color: "var(--muted)", fontWeight: 400 }}>·</span>
            <span style={{ color: "var(--muted)", fontWeight: 400 }}>
              <strong style={{ color: "var(--g700)" }}>{fmtDuracao(tempoH)}</strong> estimadas @ 60 km/h
            </span>
          </div>
        )}

        {/* Pin de destino */}
        {temDestino && (
          <div
            style={{
              display: "flex",
              alignItems: "start",
              gap: 8,
              background: "rgba(255,255,255,0.85)",
              padding: "8px 10px",
              borderRadius: "var(--radius)",
              border: "1px solid var(--b400, var(--border))",
            }}
          >
            <span style={{ fontSize: 18 }}>🏁</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 11, color: "var(--b600, var(--muted))", fontWeight: 700 }}>
                DESTINO
              </div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{destino!.nome}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                {destino!.cidade}/{destino!.uf}
                {temDestinoCoord && (
                  <span style={{ marginLeft: 6, fontFamily: "DM Mono, monospace", color: "var(--hint)" }}>
                    · {destino!.latitude!.toFixed(4)}, {destino!.longitude!.toFixed(4)}
                  </span>
                )}
              </div>
            </div>
          </div>
        )}

        {!temOrigem && !temDestino && (
          <div style={{ fontSize: 12, color: "var(--hint)", textAlign: "center", padding: "20px 0" }}>
            Nenhum local cadastrado para esta operação.
          </div>
        )}

        {(temOrigem || temDestino) && !temRota && (
          <div
            style={{
              fontSize: 11,
              color: "var(--muted)",
              padding: "6px 8px",
              background: "var(--a100)",
              border: "1px dashed var(--a600)",
              borderRadius: "var(--radius)",
            }}
          >
            ⚠️ Lat/Lng não cadastrados em todos os locais — distância indisponível.
            Cadastre as coordenadas em <strong>Cadastros → Locais</strong> para ver a rota.
          </div>
        )}

        {linkExterno && (
          <a
            href={linkExterno}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              alignSelf: "flex-start",
              padding: "6px 10px",
              background: "var(--g600, #2266aa)",
              color: "white",
              borderRadius: "var(--radius)",
              fontSize: 12,
              fontWeight: 600,
              textDecoration: "none",
              marginTop: "auto",
            }}
          >
            🗺️ Abrir no Google Maps →
          </a>
        )}
      </div>
    </div>
  );
}
