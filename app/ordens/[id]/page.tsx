"use client";

import Link from "next/link";
import { use, useMemo, useState } from "react";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatBox } from "@/components/ui/StatBox";
import { Field, FormRow, Input, Select, SectionLabel, Textarea, UploadZone } from "@/components/ui/Form";
import { Modal } from "@/components/ui/Modal";
import { NumberInput } from "@/components/ui/NumberInput";
import { Tabs } from "@/components/ui/Tabs";
import { ChecklistTab } from "@/components/checklist/ChecklistTab";
import { EnviarOCModal } from "@/components/checklist/EnviarOCModal";
import { MapaPlaceholder } from "@/components/maps/MapaPlaceholder";
import { buildOCSnapshot } from "@/lib/domain/oc-snapshot";
import { CentralDocumentosTab } from "@/components/ordens/CentralDocumentosTab";
import { Timeline } from "@/components/ui/Timeline";
import { TrocaNotaSection } from "@/components/fiscal/TrocaNotaSection";
import { DescargaSection } from "@/components/fiscal/DescargaSection";
import { FaturamentoSection } from "@/components/financeiro/FaturamentoSection";
import { AlertBox } from "@/components/ui/AlertBox";
import { useAuth } from "@/lib/auth/AuthContext";
import { useToast } from "@/components/ui/Toast";
import { useDataStore } from "@/lib/data-store";
import { fmtKg, fmtDate, fmtBRL } from "@/lib/domain/format";
import type { CTEStatusSefaz, OCStatus } from "@/lib/types";

const STATUS_LABEL: Record<OCStatus, string> = {
  emitida: "Emitida",
  aguardando_docs: "Aguardando Documentos",
  em_carregamento: "Em Carregamento",
  em_transito: "Em Trânsito",
  descarregada: "Descarregada",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

const SEFAZ_OPTIONS: { v: CTEStatusSefaz; label: string; tone: "gray" | "blue" | "green" | "red" }[] = [
  { v: "rascunho", label: "Rascunho", tone: "gray" },
  { v: "transmitido", label: "Transmitido", tone: "blue" },
  { v: "autorizado", label: "Autorizado", tone: "green" },
  { v: "rejeitado", label: "Rejeitado", tone: "red" },
  { v: "cancelado", label: "Cancelado", tone: "red" },
];

export default function OrdemDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const toast = useToast();
  const store = useDataStore();
  const {
    ordens,
    contratos,
    cargas,
    transportadoras,
    motoristas,
    veiculos,
    locais,
    terminais,
    produtos,
    produtores,
    notasFiscais,
    ctes,
    romaneios,
    historico,
    anexarNotaFiscal,
    anexarCTE,
    anexarRomaneio,
    atualizarStatusOrdem,
    cancelarOrdem,
    validarNotaFiscal,
    solicitacoesTrocaNota,
  } = store;

  const [tab, setTab] = useState<"resumo" | "checklist" | "documentos" | "pendencias" | "auditoria">("resumo");
  const [enviarOpen, setEnviarOpen] = useState(false);
  const [cancelarOpen, setCancelarOpen] = useState(false);
  const [motivoCancelar, setMotivoCancelar] = useState("");

  const oc = ordens.find((o) => o.id === id);
  if (!oc) notFound();

  // Restringe transportadora a ver só as próprias OCs
  if (user?.role === "transportadora" && oc.transp_id !== user.transp_id) notFound();

  const contrato = contratos.find((c) => c.id === oc.contrato_id);
  const carga = cargas.find((c) => c.id === oc.carga_id);
  const transp = transportadoras.find((t) => t.id === oc.transp_id);
  const motorista = motoristas.find((m) => m.id === oc.motorista_id);
  const veiculo = veiculos.find((v) => v.id === oc.veiculo_id);
  const origem = locais.find((l) => l.id === oc.local_carg_id);
  const destino = locais.find((l) => l.id === oc.destino_local_id);
  const terminal = oc.terminal_id ? terminais.find((t) => t.id === oc.terminal_id) : null;
  const produto = contrato ? produtos.find((p) => p.id === contrato.produto_id) : null;
  const produtor = contrato ? produtores.find((p) => p.id === contrato.produtor_id) : null;

  const nf = oc.nota_fiscal_id ? notasFiscais.find((x) => x.id === oc.nota_fiscal_id) : null;
  const cte = oc.cte_id ? ctes.find((x) => x.id === oc.cte_id) : null;
  const romaneio = oc.romaneio_id ? romaneios.find((x) => x.id === oc.romaneio_id) : null;

  const podeEditarFiscal = user?.perfil === "admin" || user?.perfil === "fiscal" || user?.perfil === "logistica";

  const [nfNumero, setNfNumero] = useState("");
  const [nfValor, setNfValor] = useState<number | "">("");
  const [nfChave, setNfChave] = useState("");

  const [cteNumero, setCteNumero] = useState("");
  const [cteChave, setCteChave] = useState("");
  const [cteStatus, setCteStatus] = useState<CTEStatusSefaz>("rascunho");

  const [roNumero, setRoNumero] = useState("");
  const [roBruto, setRoBruto] = useState<number | "">("");
  const [roTara, setRoTara] = useState<number | "">("");

  function salvarNF() {
    if (!nfNumero) { toast.warn("Informe o número da NF."); return; }
    if (nfValor === "" || nfValor <= 0) { toast.warn("Informe o valor."); return; }
    anexarNotaFiscal(oc!.id, {
      numero: nfNumero,
      valor: nfValor,
      chave_nfe: nfChave || undefined,
      emitida_em: new Date().toISOString().split("T")[0],
    });
    setNfNumero(""); setNfValor(""); setNfChave("");
    toast.success(`NF ${nfNumero} anexada.`);
  }

  function salvarCTE() {
    if (!cteNumero) { toast.warn("Informe o número do CTE."); return; }
    anexarCTE(oc!.id, {
      numero: cteNumero,
      chave_cte: cteChave || undefined,
      status_sefaz: cteStatus,
      emitido_em: new Date().toISOString().split("T")[0],
    });
    setCteNumero(""); setCteChave(""); setCteStatus("rascunho");
    toast.success(`CT-e ${cteNumero} anexado — status "em trânsito" ativado.`);
  }

  function salvarRomaneio() {
    if (!roNumero) { toast.warn("Informe o número/ticket do romaneio."); return; }
    const bruto = typeof roBruto === "number" ? roBruto : 0;
    const tara = typeof roTara === "number" ? roTara : 0;
    if (!bruto || bruto <= 0) { toast.warn("Informe o peso bruto em kg."); return; }
    if (tara < 0 || tara >= bruto) { toast.error("Tara inválida — deve ser < peso bruto."); return; }
    anexarRomaneio(oc!.id, {
      numero: roNumero,
      peso_bruto_kg: bruto,
      peso_tara_kg: tara,
      peso_liquido_kg: bruto - tara,
      emitido_em: new Date().toISOString().split("T")[0],
    });
    setRoNumero(""); setRoBruto(""); setRoTara("");
    toast.success(`Romaneio ${roNumero} anexado.`);
  }

  return (
    <>
      <div className="page-header">
        <div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginBottom: 4 }}>
            <Link href="/ordens">← Voltar para Ordens</Link>
          </div>
          <div className="page-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontFamily: "DM Mono, monospace", color: "var(--g700)" }}>{oc.numero}</span>
            <Badge tone={oc.status === "finalizada" ? "green" : oc.status === "cancelada" ? "red" : "blue"}>
              {STATUS_LABEL[oc.status]}
            </Badge>
            <Badge tone={oc.origem === "automatica_reserva" ? "teal" : "blue"}>
              {oc.origem === "automatica_reserva" ? "Auto (reserva)" : "Manual"}
            </Badge>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            {contrato?.numero} · {produto?.nome} · Emitida em {fmtDate(oc.emitida_em)} por {oc.emitida_por}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <Button
            size="sm"
            onClick={async () => {
              const snap = buildOCSnapshot(oc.id, store);
              if (!snap) { toast.error("Não foi possível gerar o PDF."); return; }
              // Carrega jsPDF + gerador apenas quando o botão é clicado (Bloco N.3)
              const { gerarPDFOC } = await import("@/lib/pdf/oc-pdf");
              gerarPDFOC({
                oc,
                snap,
                transp: transp ?? undefined,
                motorista: motorista ?? undefined,
                veiculo: veiculo ?? undefined,
                origem: origem ?? undefined,
                destino: destino ?? undefined,
                contrato: contrato ?? undefined,
                produtor: produtor ?? undefined,
                carga: carga ?? undefined,
                produtoNome: produto?.nome,
              });
            }}
          >
            📄 Gerar PDF
          </Button>
          <Button size="sm" onClick={() => setEnviarOpen(true)}>
            📨 Enviar OC
          </Button>
          {podeEditarFiscal && oc.status !== "cancelada" && oc.status !== "finalizada" && (
            <Button size="sm" variant="danger" onClick={() => setCancelarOpen(true)}>
              ✗ Cancelar OC
            </Button>
          )}
          {podeEditarFiscal && (
            <select
              value={oc.status}
              onChange={(e) => atualizarStatusOrdem(oc.id, e.target.value as OCStatus)}
              style={{ padding: "8px 10px", border: "1.5px solid var(--border2)", borderRadius: "var(--radius)", fontSize: 12 }}
            >
              {(Object.keys(STATUS_LABEL) as OCStatus[]).map((s) => (
                <option key={s} value={s}>Status: {STATUS_LABEL[s]}</option>
              ))}
            </select>
          )}
        </div>
      </div>

      {/* Bloco I.9 — 3 trilhas de status paralelas (operacional, fiscal, financeiro) */}
      <Card className="section-gap">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div>
            <div style={{ fontSize: 10, color: "var(--hint)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>
              🚛 Trilha Operacional
            </div>
            <Badge tone={oc.status_operacional === "operacional_concluido" ? "green" : oc.status_operacional === "em_transito" || oc.status_operacional === "carregando" ? "teal" : "amber"}>
              {oc.status_operacional ?? "—"}
            </Badge>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--hint)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>
              📋 Trilha Fiscal
            </div>
            <Badge tone={oc.status_fiscal === "nf_validada" || oc.status_fiscal === "liberado_faturamento" ? "green" : oc.status_fiscal === "troca_solicitada" ? "red" : "amber"}>
              {oc.status_fiscal ?? "aguardando_nf"}
            </Badge>
          </div>
          <div>
            <div style={{ fontSize: 10, color: "var(--hint)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 4 }}>
              💰 Trilha Financeira
            </div>
            <Badge tone={oc.status_financeiro === "pago" || oc.status_financeiro === "finalizado" ? "green" : oc.status_financeiro === "divergencia" ? "red" : "amber"}>
              {oc.status_financeiro ?? "aguardando_liberacao"}
            </Badge>
          </div>
        </div>
      </Card>

      <div className="grid-4 section-gap">
        <StatBox tone="b" label="Peso Previsto" value={fmtKg(oc.peso_previsto_kg)} />
        <StatBox tone="g" label="Transportadora" value={<span style={{ fontSize: 13 }}>{transp?.nome_fantasia ?? "—"}</span>} />
        <StatBox tone="a" label="Motorista" value={<span style={{ fontSize: 13 }}>{motorista?.nome ?? "—"}</span>} sub={motorista?.cpf} />
        <StatBox tone="t" label="Veículo" value={<span style={{ fontSize: 13, fontFamily: "DM Mono, monospace" }}>{veiculo?.placa_cavalo ?? "—"}{veiculo?.placa_carreta ? ` + ${veiculo.placa_carreta}` : ""}</span>} sub={veiculo?.tipo} />
      </div>

      <Tabs<"resumo" | "checklist" | "documentos" | "pendencias" | "auditoria">
        active={tab}
        onChange={setTab}
        tabs={[
          { id: "resumo", label: "Resumo" },
          { id: "checklist", label: <>✅ Checklist</> },
          { id: "documentos", label: <>📋 Central Documental</> },
          { id: "pendencias", label: <>⏳ Pendências</> },
          { id: "auditoria", label: <>🕐 Timeline / Auditoria</> },
        ]}
      />

      {tab === "checklist" && <ChecklistTab ocId={oc.id} />}

      {tab === "documentos" && (
        <>
          <TrocaNotaSection ocId={oc.id} />
          <CentralDocumentosTab ocId={oc.id} />
        </>
      )}

      {tab === "pendencias" && (
        <Card>
          <CardHeader><CardTitle>⏳ Pendências da Operação</CardTitle></CardHeader>
          <PendenciasDaOC ocId={oc.id} />
        </Card>
      )}

      {tab === "auditoria" && (
        <Card>
          <CardHeader><CardTitle>🕐 Timeline / Auditoria</CardTitle></CardHeader>
          <Timeline events={historico.filter((h) => h.o_que.includes(oc.numero) || h.o_que.includes(oc.id))} />
        </Card>
      )}

      {tab === "resumo" && <>
      <Card className="section-gap">
        <CardHeader><CardTitle>📍 Trajeto</CardTitle></CardHeader>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", background: "var(--surf2)", borderRadius: "var(--radius)", fontSize: 13, flexWrap: "wrap" }}>
          <strong>📍 {origem?.nome} ({origem?.cidade}/{origem?.uf})</strong>
          <span style={{ color: "var(--g400)", fontSize: 18 }}>→</span>
          <strong style={destino ? undefined : { color: "var(--a600)" }}>
            🏁 {destino ? `${destino.nome} (${destino.cidade}/${destino.uf})` : "Destino a definir"}
          </strong>
          {terminal && (
            <>
              <span style={{ color: "var(--hint)" }}>·</span>
              <Badge tone="blue">Terminal: {terminal.nome}</Badge>
            </>
          )}
        </div>
        <div style={{ marginTop: 12 }}>
          <MapaPlaceholder origem={origem} destino={destino} />
        </div>
        {oc.observacoes && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--muted)" }}>
            <strong>Observações:</strong> {oc.observacoes}
          </div>
        )}
      </Card>

      <DescargaSection ocId={oc.id} />

      <FaturamentoSection ocId={oc.id} />

      <div className="grid-3">
        {/* ─── Nota Fiscal ─── */}
        <Card>
          <CardHeader>
            <CardTitle>📋 Nota Fiscal {nf && <Badge tone="green">✓</Badge>}</CardTitle>
          </CardHeader>
          {nf ? (
            <>
              <table style={{ width: "100%", fontSize: 12 }}>
                <tbody>
                  <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Número</td><td><strong>{nf.numero}</strong></td></tr>
                  <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Valor</td><td><strong>{fmtBRL(nf.valor)}</strong></td></tr>
                  {nf.chave_nfe && <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Chave</td><td style={{ fontFamily: "DM Mono, monospace", fontSize: 10, wordBreak: "break-all" }}>{nf.chave_nfe}</td></tr>}
                  <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Emitida em</td><td>{fmtDate(nf.emitida_em)}</td></tr>
                  <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Status fiscal</td><td>
                    <Badge tone={oc.status_fiscal === "nf_validada" ? "green" : "amber"}>
                      {oc.status_fiscal ?? "—"}
                    </Badge>
                  </td></tr>
                </tbody>
              </table>
              {(user?.perfil === "fiscal" || user?.perfil === "admin") && oc.status_fiscal !== "nf_validada" && (
                <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                  <Button
                    size="sm"
                    variant="success"
                    onClick={() => {
                      validarNotaFiscal(oc.id, { id: user!.usuario_id, nome: user!.nome });
                      toast.success(`NF ${nf.numero} validada.`);
                    }}
                  >
                    ✓ Validar NF
                  </Button>
                  <Button
                    size="sm"
                    variant="warning"
                    onClick={() => {
                      toast.info("Use a aba 'Central Documental' → seção NF para solicitar troca com motivo.");
                      setTab("documentos");
                    }}
                  >
                    🔄 Solicitar Troca
                  </Button>
                </div>
              )}
              {oc.status_fiscal === "nf_validada" && (
                <div style={{ marginTop: 10, padding: "8px 10px", background: "var(--g100)", borderRadius: "var(--radius)", fontSize: 11, color: "var(--g700)" }}>
                  ✓ NF validada pelo fiscal — pronta para aguardar o CT-e.
                </div>
              )}
            </>
          ) : podeEditarFiscal ? (
            <>
              <SectionLabel>Anexar NF</SectionLabel>
              <FormRow variant="single">
                <Field label="Número *">
                  <Input value={nfNumero} onChange={(e) => setNfNumero(e.target.value)} placeholder="000123" />
                </Field>
              </FormRow>
              <FormRow variant="single">
                <Field label="Valor *">
                  <NumberInput value={nfValor} onChange={setNfValor} variant="currency" placeholder="0,00" suffix="R$" />
                </Field>
              </FormRow>
              <FormRow variant="single">
                <Field label="Chave NF-e">
                  <Input value={nfChave} onChange={(e) => setNfChave(e.target.value)} placeholder="44 dígitos" />
                </Field>
              </FormRow>
              <FormRow variant="single">
                <Field label="Upload XML">
                  <UploadZone label="Anexar XML" icon="📄" optional />
                </Field>
              </FormRow>
              <Button variant="success" onClick={salvarNF}>Anexar NF</Button>
            </>
          ) : (
            <AlertBox tone="amber" icon="⏳" title="Aguardando NF" />
          )}
        </Card>

        {/* ─── CTE ─── */}
        <Card>
          <CardHeader>
            <CardTitle>🧾 CTE {cte && <Badge tone="green">✓</Badge>}</CardTitle>
          </CardHeader>
          {cte ? (
            <table style={{ width: "100%", fontSize: 12 }}>
              <tbody>
                <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Número</td><td><strong>{cte.numero}</strong></td></tr>
                <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>SEFAZ</td><td><Badge tone={SEFAZ_OPTIONS.find((s) => s.v === cte.status_sefaz)?.tone ?? "gray"}>{SEFAZ_OPTIONS.find((s) => s.v === cte.status_sefaz)?.label}</Badge></td></tr>
                {cte.chave_cte && <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Chave</td><td style={{ fontFamily: "DM Mono, monospace", fontSize: 10, wordBreak: "break-all" }}>{cte.chave_cte}</td></tr>}
                <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Emitido em</td><td>{fmtDate(cte.emitido_em)}</td></tr>
              </tbody>
            </table>
          ) : podeEditarFiscal ? (
            <>
              <SectionLabel>Anexar CTE</SectionLabel>
              <FormRow variant="single">
                <Field label="Número *">
                  <Input value={cteNumero} onChange={(e) => setCteNumero(e.target.value)} placeholder="000456" />
                </Field>
              </FormRow>
              <FormRow variant="single">
                <Field label="Status SEFAZ">
                  <Select value={cteStatus} onChange={(e) => setCteStatus(e.target.value as CTEStatusSefaz)}>
                    {SEFAZ_OPTIONS.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
                  </Select>
                </Field>
              </FormRow>
              <FormRow variant="single">
                <Field label="Chave CT-e">
                  <Input value={cteChave} onChange={(e) => setCteChave(e.target.value)} placeholder="44 dígitos" />
                </Field>
              </FormRow>
              <FormRow variant="single">
                <Field label="Upload XML">
                  <UploadZone label="Anexar XML" icon="🧾" optional />
                </Field>
              </FormRow>
              <Button variant="success" onClick={salvarCTE}>Anexar CTE</Button>
            </>
          ) : (
            <AlertBox tone="amber" icon="⏳" title="Aguardando CTE" />
          )}
        </Card>

        {/* ─── Romaneio ─── */}
        <Card>
          <CardHeader>
            <CardTitle>⚖️ Romaneio/Ticket {romaneio && <Badge tone="green">✓</Badge>}</CardTitle>
          </CardHeader>
          {romaneio ? (
            <table style={{ width: "100%", fontSize: 12 }}>
              <tbody>
                <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Número</td><td><strong>{romaneio.numero}</strong></td></tr>
                <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Peso Bruto</td><td><strong>{fmtKg(romaneio.peso_bruto_kg)}</strong></td></tr>
                <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Tara</td><td>{fmtKg(romaneio.peso_tara_kg)}</td></tr>
                <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Peso Líquido</td><td><strong style={{ color: "var(--g700)" }}>{fmtKg(romaneio.peso_liquido_kg)}</strong></td></tr>
                <tr><td style={{ color: "var(--muted)", padding: "4px 0" }}>Emitido em</td><td>{fmtDate(romaneio.emitido_em)}</td></tr>
              </tbody>
            </table>
          ) : podeEditarFiscal ? (
            <>
              <SectionLabel>Anexar Romaneio</SectionLabel>
              <FormRow variant="single">
                <Field label="Número/Ticket *">
                  <Input value={roNumero} onChange={(e) => setRoNumero(e.target.value)} />
                </Field>
              </FormRow>
              <FormRow>
                <Field label="Peso Bruto *">
                  <NumberInput value={roBruto} onChange={setRoBruto} placeholder="Ex: 42.500" suffix="kg" />
                </Field>
                <Field label="Tara *">
                  <NumberInput value={roTara} onChange={setRoTara} placeholder="Ex: 12.000" suffix="kg" />
                </Field>
              </FormRow>
              <FormRow variant="single">
                <Field label="Upload Ticket">
                  <UploadZone label="Anexar ticket de pesagem" icon="⚖️" optional />
                </Field>
              </FormRow>
              <Button variant="success" onClick={salvarRomaneio}>Anexar Romaneio</Button>
            </>
          ) : (
            <AlertBox tone="amber" icon="⏳" title="Aguardando Romaneio" />
          )}
        </Card>
      </div>
      </>}

      <EnviarOCModal ocId={enviarOpen ? oc.id : null} onClose={() => setEnviarOpen(false)} />

      {/* Modal: Cancelar OC */}
      <Modal
        open={cancelarOpen}
        onClose={() => { setCancelarOpen(false); setMotivoCancelar(""); }}
        title="✗ Cancelar Ordem de Carregamento"
        footer={
          <>
            <Button onClick={() => { setCancelarOpen(false); setMotivoCancelar(""); }}>
              Voltar
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (motivoCancelar.trim().length < 10) {
                  toast.warn("Descreva o motivo do cancelamento (mín. 10 caracteres).");
                  return;
                }
                cancelarOrdem(oc.id, motivoCancelar, { id: user!.usuario_id, nome: user!.nome });
                toast.info(`OC ${oc.numero} cancelada — pendências da OC encerradas.`);
                setCancelarOpen(false);
                setMotivoCancelar("");
              }}
            >
              Confirmar cancelamento
            </Button>
          </>
        }
      >
        <AlertBox tone="red" icon="⚠️" title="Esta ação não pode ser desfeita">
          A OC <strong>{oc.numero}</strong> será marcada como cancelada e todas as pendências abertas dela serão encerradas. O histórico da operação fica preservado.
        </AlertBox>
        <FormRow variant="single">
          <Field label="Motivo do cancelamento *" hint="Será registrado no histórico (mín. 10 caracteres)">
            <Textarea
              value={motivoCancelar}
              onChange={(e) => setMotivoCancelar(e.target.value)}
              placeholder="Ex: Cliente cancelou o pedido. / Transportadora não pôde cumprir. / Erro operacional..."
            />
          </Field>
        </FormRow>
      </Modal>
    </>
  );
}

/** Componente inline — lista pendências da OC com status + ações */
function PendenciasDaOC({ ocId }: { ocId: string }) {
  const { pendencias, resolverPendencia } = useDataStore();
  const { user } = useAuth();
  const lista = pendencias.filter((p) => p.oc_id === ocId);
  if (lista.length === 0) {
    return <div style={{ padding: 20, textAlign: "center", color: "var(--hint)" }}>Nenhuma pendência registrada para esta OC.</div>;
  }
  return (
    <div>
      {lista.map((p) => {
        const ativa = p.status === "aberta";
        return (
          <div key={p.id} style={{ padding: 10, borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{p.descricao}</div>
              <div style={{ fontSize: 11, color: "var(--muted)" }}>
                Setor: <strong>{p.setor_responsavel}</strong> · SLA {p.sla_horas}h · Vence em {fmtDate(p.vence_em)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <Badge tone={ativa ? "amber" : "green"}>{ativa ? "Aberta" : "Resolvida"}</Badge>
              {ativa && user && (
                <Button size="sm" onClick={() => resolverPendencia(p.id, user.usuario_id, user.nome)}>
                  ✓ Resolver
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
