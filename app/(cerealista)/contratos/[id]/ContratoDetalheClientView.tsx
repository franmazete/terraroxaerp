"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatBox } from "@/components/ui/StatBox";
import { Table, tableStyles } from "@/components/ui/Table";
import { EmptyState } from "@/components/ui/EmptyState";
import { Tabs } from "@/components/ui/Tabs";
import { AlertBox } from "@/components/ui/AlertBox";
import { PublicarCargaModal } from "@/components/cargas/PublicarCargaModal";
import { EditarContratoModal } from "@/components/contratos/EditarContratoModal";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { disponibilizarContratoAction, excluirContratoAction } from "@/lib/api/actions";
import { fmtKg, fmtDate, fmtBRL } from "@/lib/domain/format";
import { percentualContratoUsado, saldoColor } from "@/lib/domain/saldo";
import type {
  Carga,
  Cliente,
  Contrato,
  ContratoStatus,
  Local,
  OrdemCarregamento,
  Produto,
  Produtor,
  Terminal,
  Transportadora,
} from "@/lib/types";

type Tab = "resumo" | "cargas" | "reservas" | "ordens";

const STATUS_OPTIONS: { v: ContratoStatus; label: string; tone: "green" | "teal" | "red" | "gray" }[] = [
  { v: "ativo", label: "Ativo", tone: "green" },
  { v: "concluido", label: "Concluído", tone: "teal" },
  { v: "cancelado", label: "Cancelado", tone: "red" },
  { v: "rascunho", label: "Rascunho", tone: "gray" },
];

interface Props {
  contrato: Contrato;
  produto: Produto | null;
  produtor: Produtor | null;
  cliente: Cliente | null;
  origem: Local | null;
  destino: Local | null;
  terminal: Terminal | null;
  cargasDoContrato: Carga[];
  ordensDoContrato: OrdemCarregamento[];
  /** Dados SSR pros modais editar/publicar — null quando estamos em modo mock. */
  produtosSSR?: Produto[] | null;
  clientesSSR?: Cliente[] | null;
  locaisSSR?: Local[] | null;
  terminaisSSR?: Terminal[] | null;
  transportadorasSSR?: Transportadora[] | null;
}

export function ContratoDetalheClientView({
  contrato,
  produto,
  produtor,
  cliente,
  origem,
  destino,
  terminal,
  cargasDoContrato,
  ordensDoContrato,
  produtosSSR = null,
  clientesSSR = null,
  locaisSSR = null,
  terminaisSSR = null,
  transportadorasSSR = null,
}: Props) {
  const { user, supabaseConfigured } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const router = useRouter();
  const { disponibilizarContrato } = useDataStore();
  const [tab, setTab] = useState<Tab>("resumo");
  const [publicarOpen, setPublicarOpen] = useState(false);
  const [editarOpen, setEditarOpen] = useState(false);

  const reservasDoContrato = useMemo(
    () => cargasDoContrato.flatMap((c) => c.reservas.map((r) => ({ ...r, carga: c }))),
    [cargasDoContrato],
  );

  const pct = percentualContratoUsado(contrato);
  const st = STATUS_OPTIONS.find((o) => o.v === contrato.status)!;

  async function excluir() {
    const ok = await confirmar({
      titulo: "Excluir contrato?",
      mensagem: (
        <>
          Tem certeza que quer excluir o contrato{" "}
          <strong>{contrato.numero_manual || contrato.numero}</strong>?
          <div style={{ marginTop: 8, fontSize: 12, color: "var(--muted)" }}>
            Esta ação é definitiva. Se houver cargas vinculadas, será bloqueada.
          </div>
        </>
      ),
      variante: "danger",
      confirmarLabel: "Excluir",
    });
    if (!ok) return;
    if (supabaseConfigured) {
      const r = await excluirContratoAction(contrato.id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Contrato excluído.");
      router.push("/contratos");
    } else {
      toast.warn("Exclusão em modo mock não persiste — reabra o app pra resetar.");
    }
  }

  async function disponibilizar() {
    const ok = await confirmar({
      titulo: "Disponibilizar contrato?",
      mensagem: "Após disponibilizar, a logística poderá publicar cargas a partir deste contrato.",
      variante: "info",
      confirmarLabel: "Disponibilizar",
    });
    if (!ok) return;

    if (supabaseConfigured) {
      const r = await disponibilizarContratoAction(contrato.id);
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success("Contrato disponível para publicação de cargas.");
      router.refresh();
    } else {
      disponibilizarContrato(contrato.id, user?.nome ?? "Admin");
      toast.success("Contrato disponível para publicação de cargas.");
    }
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <Link href="/contratos" style={{ fontSize: 12, color: "var(--muted)" }}>← Voltar para Contratos</Link>
          </div>
          <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "DM Mono, monospace", color: "var(--g700)" }}>{contrato.numero_manual || contrato.numero}</span>
            <Badge tone={st.tone}>{st.label}</Badge>
            {contrato.disponivel ? (
              <Badge tone="green">✓ Disponível para publicação</Badge>
            ) : (
              <Badge tone="amber">⏸ Não disponibilizado</Badge>
            )}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {contrato.numero_manual && <span style={{ marginRight: 8 }}>Sistema: {contrato.numero} ·</span>}
            {produto?.nome} · {produtor?.nome} {cliente ? `→ ${cliente.nome}` : "→ (cliente a definir)"}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {!contrato.disponivel && contrato.status === "ativo" && (
            <Button variant="success" onClick={disponibilizar}>
              ✓ Disponibilizar para publicação
            </Button>
          )}
          {contrato.disponivel && contrato.status === "ativo" && contrato.saldo_kg > 0 && (
            <Button variant="primary" onClick={() => setPublicarOpen(true)}>
              📦 Gerar Carga deste Contrato
            </Button>
          )}
          <Button onClick={() => setEditarOpen(true)}>✏️ Editar</Button>
          <Button variant="danger" onClick={excluir}>🗑️ Excluir</Button>
        </div>
      </div>

      {!contrato.disponivel && contrato.status === "ativo" && (
        <div className="section-gap">
          <AlertBox tone="amber" icon="⏸" title="Contrato salvo, mas ainda não disponível para publicação">
            Você precisa clicar em <strong>"Disponibilizar para publicação"</strong> acima para que este contrato apareça no modal de publicação de cargas.
          </AlertBox>
        </div>
      )}

      <div className="grid-4 section-gap">
        <StatBox tone="b" label="Quantidade Total" value={fmtKg(contrato.qtd_kg_total)} />
        <StatBox tone="g" label="Saldo Restante" value={fmtKg(contrato.saldo_kg)} sub={`${100 - pct}% disponível`} />
        <StatBox tone="a" label="Já em Cargas" value={fmtKg(contrato.qtd_kg_total - contrato.saldo_kg)} sub={`${pct}% utilizado`} />
        <StatBox tone="t" label="Vigência" value={`${fmtDate(contrato.data_emissao ?? "")} → ${fmtDate(contrato.data_vencto_financeiro ?? "")}`} />
      </div>

      <Card className="section-gap">
        <div style={{ marginBottom: 8, fontSize: 11, fontWeight: 600, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em" }}>
          Progresso do Contrato
        </div>
        <ProgressBar percent={pct} color={saldoColor(pct)} />
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 11, color: "var(--muted)" }}>
          <span>{fmtKg(contrato.qtd_kg_total - contrato.saldo_kg)} despachado</span>
          <span style={{ fontWeight: 600, color: contrato.saldo_kg === 0 ? "var(--r600)" : "var(--g600)" }}>
            {fmtKg(contrato.saldo_kg)} disponível
          </span>
        </div>
      </Card>

      <Tabs<Tab>
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "resumo", label: "Resumo" },
          { id: "cargas", label: <>Cargas <Badge tone="gray">{cargasDoContrato.length}</Badge></> },
          { id: "reservas", label: <>Reservas <Badge tone="gray">{reservasDoContrato.length}</Badge></> },
          { id: "ordens", label: <>Ordens <Badge tone="gray">{ordensDoContrato.length}</Badge></> },
        ]}
      />

      {tab === "resumo" && (
        <Card>
          <CardHeader><CardTitle>📋 Informações do Contrato</CardTitle></CardHeader>
          <table style={{ width: "100%", fontSize: 13 }}>
            <tbody>
              {contrato.numero_manual && (
                <tr><td style={{ color: "var(--muted)", padding: "8px 0", width: "30%" }}>Número Manual</td><td><strong style={{ fontFamily: "DM Mono, monospace" }}>{contrato.numero_manual}</strong></td></tr>
              )}
              <tr><td style={{ color: "var(--muted)", padding: "8px 0", width: "30%" }}>Número Sistema</td><td style={{ fontFamily: "DM Mono, monospace" }}>{contrato.numero}</td></tr>
              <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Produtor</td><td><strong>{produtor?.nome ?? "—"}</strong> · {produtor?.cpf_cnpj}</td></tr>
              <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Fazenda / Origem</td><td>{origem?.nome ?? "—"} ({origem?.cidade}/{origem?.uf})</td></tr>
              <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Produto</td><td><strong>{produto?.nome}</strong> {produto?.descricao && <span style={{ color: "var(--hint)" }}>· {produto.descricao}</span>}</td></tr>
              <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Cliente Comprador</td><td>{cliente ? <><strong>{cliente.nome}</strong> · {cliente.cpf_cnpj}</> : <span style={{ color: "var(--hint)" }}>— A definir —</span>}</td></tr>
              <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Destino</td><td>{destino ? <>{destino.nome} ({destino.cidade}/{destino.uf})</> : <span style={{ color: "var(--hint)" }}>— A definir —</span>}</td></tr>
              {terminal && (
                <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Terminal</td><td>{terminal.nome} <Badge tone="blue">{terminal.tipo}</Badge></td></tr>
              )}
              {contrato.safra && (
                <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Safra</td><td><Badge tone="teal">{contrato.safra}</Badge></td></tr>
              )}
              {contrato.empresa_origem_codigo && (
                <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Empresa de origem (ERP)</td><td><span style={{ fontFamily: "DM Mono, monospace" }}>{contrato.empresa_origem_codigo}</span></td></tr>
              )}
              {contrato.numero_origem && (
                <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Nº no ERP</td><td><span style={{ fontFamily: "DM Mono, monospace" }}>{contrato.numero_origem}</span></td></tr>
              )}
              {contrato.data_emissao && (
                <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Data de Emissão</td><td>{fmtDate(contrato.data_emissao)}</td></tr>
              )}
              {contrato.data_inicio && (
                <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Data Inicial</td><td>{fmtDate(contrato.data_inicio)}</td></tr>
              )}
              {contrato.data_fim && (
                <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Data Final</td><td>{fmtDate(contrato.data_fim)}</td></tr>
              )}
              {contrato.data_vencto_financeiro && (
                <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Vencimento Financeiro</td><td>{fmtDate(contrato.data_vencto_financeiro)}</td></tr>
              )}
              {contrato.origem_descricao && (
                <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Origem (texto livre do ERP)</td><td style={{ fontSize: 12 }}>{contrato.origem_descricao}</td></tr>
              )}
              {typeof contrato.valor_unitario === "number" && (
                <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Valor Unitário</td><td><strong>{fmtBRL(contrato.valor_unitario)} / kg</strong></td></tr>
              )}
              {typeof contrato.valor_total === "number" && (
                <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Valor Total</td><td><strong>{fmtBRL(contrato.valor_total)}</strong></td></tr>
              )}
              <tr><td style={{ color: "var(--muted)", padding: "8px 0" }}>Criado por</td><td>{contrato.criado_por} · {fmtDate(contrato.criado_em)}</td></tr>
              {contrato.observacoes && (
                <tr><td style={{ color: "var(--muted)", padding: "8px 0", verticalAlign: "top" }}>Observações</td><td>{contrato.observacoes}</td></tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      {tab === "cargas" && (
        <Card>
          {cargasDoContrato.length === 0 ? (
            <EmptyState icon="📦">
              Nenhuma carga gerada ainda.
              {contrato.status === "ativo" && contrato.saldo_kg > 0 && (
                <div style={{ marginTop: 12 }}>
                  <Button variant="primary" onClick={() => setPublicarOpen(true)}>📦 Gerar Primeira Carga</Button>
                </div>
              )}
            </EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Total (kg)</th>
                  <th>Reservado</th>
                  <th>Saldo</th>
                  <th>Carregamento</th>
                  <th>Status</th>
                  <th>Reservas</th>
                </tr>
              </thead>
              <tbody>
                {cargasDoContrato.map((c) => (
                  <tr key={c.id}>
                    <td><span className={tableStyles.mono}>{c.id}</span></td>
                    <td><strong>{fmtKg(c.total_kg)}</strong></td>
                    <td>{fmtKg(c.reservado_kg)}</td>
                    <td>{fmtKg(c.total_kg - c.reservado_kg)}</td>
                    <td>{fmtDate(c.data_carg)}</td>
                    <td>
                      <Badge tone={c.status === "fechada" ? "red" : c.status === "parcial" ? "amber" : "green"}>
                        {c.status}
                      </Badge>
                    </td>
                    <td>{c.reservas.length}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "reservas" && (
        <Card>
          {reservasDoContrato.length === 0 ? (
            <EmptyState icon="🚚">Nenhuma reserva ainda nas cargas deste contrato.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>ID Reserva</th>
                  <th>Carga</th>
                  <th>Transportadora</th>
                  <th>Qtd</th>
                  <th>Frete/t</th>
                  <th>Motorista</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {reservasDoContrato.map((r) => (
                  <tr key={r.id}>
                    <td><span className={tableStyles.mono}>{r.id}</span></td>
                    <td><span className={tableStyles.mono}>{r.carga.id}</span></td>
                    <td><strong>{r.transp_nome}</strong></td>
                    <td>{fmtKg(r.qtd_kg)}</td>
                    <td>R$ {r.frete_ton}</td>
                    <td>{r.motorista ?? "—"}</td>
                    <td>
                      <Badge tone={r.status === "aprovada" ? "green" : r.status === "pendente" ? "amber" : "red"}>
                        {r.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      {tab === "ordens" && (
        <Card>
          {ordensDoContrato.length === 0 ? (
            <EmptyState icon="📄">Nenhuma OC emitida ainda neste contrato.</EmptyState>
          ) : (
            <Table>
              <thead>
                <tr>
                  <th>Número</th>
                  <th>Carga</th>
                  <th>Reserva</th>
                  <th>Peso Previsto</th>
                  <th>Status</th>
                  <th>Emitida em</th>
                </tr>
              </thead>
              <tbody>
                {ordensDoContrato.map((o) => (
                  <tr key={o.id}>
                    <td><span className={tableStyles.mono}>{o.numero}</span></td>
                    <td><span className={tableStyles.mono}>{o.carga_id}</span></td>
                    <td><span className={tableStyles.mono}>{o.reserva_id ?? "manual"}</span></td>
                    <td>{fmtKg(o.peso_previsto_kg)}</td>
                    <td><Badge tone="blue">{o.status}</Badge></td>
                    <td>{fmtDate(o.emitida_em)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      )}

      <PublicarCargaModal
        open={publicarOpen}
        onClose={() => setPublicarOpen(false)}
        contratoIdInicial={contrato.id}
        contratosSSR={[contrato]}
        produtosSSR={produtosSSR}
        locaisSSR={locaisSSR}
        clientesSSR={clientesSSR}
        transportadorasSSR={transportadorasSSR}
      />
      <EditarContratoModal
        contrato={editarOpen ? contrato : null}
        onClose={() => setEditarOpen(false)}
        produtosSSR={produtosSSR}
        clientesSSR={clientesSSR}
        locaisSSR={locaisSSR}
        terminaisSSR={terminaisSSR}
      />
    </>
  );
}
