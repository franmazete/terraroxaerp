"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatBox } from "@/components/ui/StatBox";
import { AlertBox } from "@/components/ui/AlertBox";
import { MapaPlaceholder } from "@/components/maps/MapaPlaceholder";
import { useDataStore } from "@/lib/data-store";
import { urlPonto, urlBuscaTexto } from "@/lib/domain/geo";
import type { TipoLocal } from "@/lib/types";

const TIPO_LABEL: Record<TipoLocal, { label: string; tone: "green" | "teal" | "amber" | "blue" | "red" }> = {
  fazenda: { label: "Fazenda", tone: "green" },
  armazem_origem: { label: "Armazém Origem", tone: "teal" },
  destino: { label: "Destino", tone: "blue" },
  porto: { label: "Porto", tone: "amber" },
  terminal: { label: "Terminal", tone: "red" },
};

export default function DetalheLocalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { locais, produtores, clientes, terminais, contratos, cargas, ordens } = useDataStore();

  const local = locais.find((l) => l.id === id);
  if (!local) notFound();

  const tp = TIPO_LABEL[local.tipo];

  // Origem/destino vinculado a este local
  const contratosOrigem = contratos.filter((c) => c.local_origem_id === id);
  const contratosDestino = contratos.filter((c) => c.destino_local_id === id);
  const cargasOrigem = cargas.filter((c) => c.origem_local_id === id);
  const cargasDestino = cargas.filter((c) => c.destino_local_id === id);
  const ocsOrigem = ordens.filter((o) => o.local_carg_id === id);
  const ocsDestino = ordens.filter((o) => o.destino_local_id === id);

  // Dono vinculado
  const dono = local.vinculado_a
    ? local.vinculado_a.entidade === "produtor"
      ? produtores.find((p) => p.id === local.vinculado_a!.id)
      : local.vinculado_a.entidade === "cliente"
      ? clientes.find((c) => c.id === local.vinculado_a!.id)
      : terminais.find((t) => t.id === local.vinculado_a!.id)
    : null;

  const temCoord = local.latitude != null && local.longitude != null;
  const linkMaps = temCoord
    ? urlPonto(local.latitude!, local.longitude!)
    : urlBuscaTexto(`${local.nome} ${local.cidade} ${local.uf}`);

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
            <Link href="/cadastros/locais">← Voltar para Locais</Link>
          </div>
          <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span>📍 {local.nome}</span>
            <Badge tone={tp.tone}>{tp.label}</Badge>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {local.cidade} / {local.uf}
            {dono && <> · Vinculado a <strong>{dono.nome}</strong></>}
          </div>
        </div>
        <a href={linkMaps} target="_blank" rel="noopener noreferrer">
          <Button variant="primary">🗺️ Abrir no Google Maps</Button>
        </a>
      </div>

      <div className="grid-2 section-gap" style={{ gridTemplateColumns: "2fr 1fr" }}>
        {/* Mapa grande */}
        <Card style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ minHeight: 420 }}>
            <MapaPlaceholder origem={local} />
          </div>
        </Card>

        {/* Dados */}
        <Card>
          <CardHeader>
            <CardTitle>📋 Dados do Local</CardTitle>
          </CardHeader>
          <table style={{ width: "100%", fontSize: 12 }}>
            <tbody>
              <tr><td style={{ color: "var(--muted)", padding: "4px 0", width: "40%" }}>ID</td><td style={{ fontFamily: "DM Mono, monospace", fontSize: 11 }}>{local.id}</td></tr>
              <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Tipo</td><td><Badge tone={tp.tone}>{tp.label}</Badge></td></tr>
              <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Cidade/UF</td><td>{local.cidade} / {local.uf}</td></tr>
              {local.endereco && (
                <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Endereço</td><td>
                  {local.endereco.logradouro}{local.endereco.numero ? `, ${local.endereco.numero}` : ""}
                  {local.endereco.bairro && <> — {local.endereco.bairro}</>}
                  {local.endereco.cep && <><br />CEP: {local.endereco.cep}</>}
                </td></tr>
              )}
              {local.latitude != null && local.longitude != null && (
                <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Coordenadas</td><td style={{ fontFamily: "DM Mono, monospace", fontSize: 11 }}>{local.latitude!.toFixed(4)}, {local.longitude!.toFixed(4)}</td></tr>
              )}
            </tbody>
          </table>

          {(local.contato_nome || local.contato_whatsapp || local.contato_email) && (
            <>
              <hr className="divider" />
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
                📨 Contato
              </div>
              <table style={{ width: "100%", fontSize: 12 }}>
                <tbody>
                  {local.contato_nome && <tr><td style={{ color: "var(--muted)", padding: "4px 0", width: "40%" }}>Nome</td><td><strong>{local.contato_nome}</strong></td></tr>}
                  {local.contato_whatsapp && <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>WhatsApp</td><td>📱 {local.contato_whatsapp}</td></tr>}
                  {local.contato_email && <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>E-mail</td><td>✉️ {local.contato_email}</td></tr>}
                </tbody>
              </table>
            </>
          )}

          {!temCoord && (
            <div style={{ marginTop: 12 }}>
              <AlertBox tone="amber" icon="⚠️" title="Coordenadas não cadastradas">
                Para mostrar o mapa com distância em outras operações, cadastre latitude/longitude editando este Local.
              </AlertBox>
            </div>
          )}
        </Card>
      </div>

      <div className="grid-4 section-gap">
        <StatBox tone="b" label="Contratos como origem" value={contratosOrigem.length} />
        <StatBox tone="g" label="Contratos como destino" value={contratosDestino.length} />
        <StatBox tone="t" label="Cargas (origem/destino)" value={cargasOrigem.length + cargasDestino.length} />
        <StatBox tone="a" label="OCs (origem/destino)" value={ocsOrigem.length + ocsDestino.length} />
      </div>

      {ocsOrigem.length + ocsDestino.length > 0 && (
        <Card className="section-gap">
          <CardHeader>
            <CardTitle>🚛 Últimas OCs vinculadas</CardTitle>
          </CardHeader>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 8 }}>
            {[...ocsOrigem, ...ocsDestino].slice(0, 12).map((oc) => (
              <Link
                key={oc.id}
                href={`/ordens/${oc.id}`}
                style={{
                  padding: "10px 12px",
                  background: "var(--surf2)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <div style={{ fontFamily: "DM Mono, monospace", fontSize: 12, fontWeight: 700, color: "var(--g700)" }}>
                  {oc.numero}
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                  {ocsOrigem.includes(oc) ? "📍 Origem" : "🏁 Destino"} · {oc.status}
                </div>
              </Link>
            ))}
          </div>
        </Card>
      )}
    </>
  );
}
