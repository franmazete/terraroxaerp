"use client";

import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { AlertBox } from "@/components/ui/AlertBox";
import { Field, FormRow, Input, Textarea, UploadZone } from "@/components/ui/Form";
import { NumberInput } from "@/components/ui/NumberInput";
import { ResultadoIAFatura } from "./ResultadoIAFatura";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { fmtBRL, fmtDate, fmtKg } from "@/lib/domain/format";

interface Props {
  ocId: string;
}

export function FaturamentoSection({ ocId }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const {
    faturamentos,
    pagamentos,
    ctes,
    dadosDescarga,
    ordens,
    iaAnalisesFatura,
    liberarFaturamento,
    anexarFatura,
    confirmarPagamento,
    conferirFaturaFiscal,
  } = useDataStore();

  const oc = ordens.find((o) => o.id === ocId);
  const fat = useMemo(() => faturamentos.find((f) => f.oc_id === ocId), [faturamentos, ocId]);
  const pag = useMemo(() => pagamentos.find((p) => p.oc_id === ocId), [pagamentos, ocId]);
  const descarga = useMemo(() => dadosDescarga.find((d) => d.oc_id === ocId), [dadosDescarga, ocId]);
  const ctesDaOc = ctes.filter((c) => c.oc_id === ocId);

  const ehFiscal = user?.perfil === "fiscal" || user?.perfil === "admin";
  const ehTransp = user?.perfil === "transportadora" && user?.transp_id === oc?.transp_id;
  const ehFinanceiro = user?.perfil === "financeiro" || user?.perfil === "admin";

  const [anexarOpen, setAnexarOpen] = useState(false);
  const [valorInf, setValorInf] = useState<number | "">("");
  const [justificativa, setJustificativa] = useState("");
  const [faturaUrl, setFaturaUrl] = useState("");
  const [numeroFatura, setNumeroFatura] = useState("");
  const [ctesIdsSel, setCtesIdsSel] = useState<string[]>([]);
  const [conferirOpen, setConferirOpen] = useState(false);
  const [obsConferir, setObsConferir] = useState("");

  const [pagarOpen, setPagarOpen] = useState(false);
  const [valorPagar, setValorPagar] = useState<number | "">("");
  const [comprovUrl, setComprovUrl] = useState("");
  const [obsPag, setObsPag] = useState("");

  if (!oc) return null;

  const descargaValidada = descarga?.validado_em;

  async function liberar() {
    if (!user) return;
    const ok = await confirmar({
      titulo: "Liberar faturamento?",
      mensagem: "O sistema vai calcular automaticamente o valor com base no peso descarregado × frete/t. A transportadora poderá anexar a fatura.",
      variante: "info",
      confirmarLabel: "Liberar",
    });
    if (!ok) return;
    const r = liberarFaturamento(ocId, user.usuario_id, user.nome);
    if (!r) {
      toast.error("Verifique se a descarga foi registrada E validada pelo fiscal.", "Não foi possível liberar");
    } else {
      toast.success("Faturamento liberado para a transportadora.");
    }
  }

  function anexar() {
    if (!user || !fat) return;
    if (valorInf === "" || valorInf <= 0) { toast.warn("Informe o valor da fatura."); return; }
    if (!faturaUrl.trim()) { toast.warn("Informe a URL/nome da fatura."); return; }
    if (ctesIdsSel.length === 0) {
      toast.warn("Selecione ao menos um CT-e — a IA precisa para conferir.");
      return;
    }
    const divergencia = Math.abs(valorInf - fat.valor_calculado) > 0.01;
    if (divergencia && !justificativa.trim()) {
      toast.warn("Há divergência com o valor calculado. Justifique abaixo.");
      return;
    }
    const r = anexarFatura(
      fat.id,
      {
        valor_informado: valorInf,
        justificativa: justificativa || undefined,
        fatura_url: faturaUrl,
        ctes_ids: ctesIdsSel,
        numero_fatura: numeroFatura || undefined,
      },
      user.nome,
    );
    if (r) {
      // Resultado já é exibido inline (ResultadoIAFatura) — toast curto e direto
      if (r.divergencias_count === 0) {
        toast.success("IA aprovou — fiscal vai revisar.", "Fatura anexada");
      } else {
        toast.warn(
          `IA detectou ${r.divergencias_count}/4 divergência(s) — veja o detalhe abaixo.`,
          "Fatura anexada com divergência",
        );
      }
    }
    setAnexarOpen(false);
    setValorInf("");
    setJustificativa("");
    setFaturaUrl("");
    setNumeroFatura("");
    setCtesIdsSel([]);
  }

  function conferir() {
    if (!user || !fat) return;
    conferirFaturaFiscal(
      fat.id,
      obsConferir || undefined,
      { id: user.usuario_id, nome: user.nome },
    );
    setConferirOpen(false);
    setObsConferir("");
    toast.success("Enviada ao financeiro.", "Fatura conferida");
  }

  function pagar() {
    if (!user || !fat) return;
    if (valorPagar === "" || valorPagar <= 0) { toast.warn("Informe o valor pago."); return; }
    confirmarPagamento(fat.id, { valor_pago: valorPagar, comprovante_url: comprovUrl || undefined, observacoes: obsPag || undefined }, user.usuario_id, user.nome);
    setPagarOpen(false);
    setValorPagar("");
    setComprovUrl("");
    setObsPag("");
    toast.success(`R$ ${(valorPagar as number).toFixed(2)} registrado.`, "Pagamento confirmado");
  }

  return (
    <Card className="section-gap">
      <CardHeader>
        <CardTitle>
          💰 Faturamento
          {fat && <Badge tone={fat.status === "aprovado" ? "green" : fat.status === "divergencia" ? "red" : fat.status === "calculado" ? "amber" : "blue"}>{fat.status}</Badge>}
          {pag && <Badge tone="green">✓ Pago</Badge>}
        </CardTitle>
      </CardHeader>

      {!fat ? (
        <>
          {!descargaValidada ? (
            <AlertBox tone="blue" icon="⏸" title="Aguardando descarga validada pelo fiscal">
              O faturamento só pode ser liberado após o fiscal validar a descarga.
            </AlertBox>
          ) : (
            <>
              <AlertBox tone="amber" icon="📊" title="Descarga validada — pronto para liberar faturamento">
                Ao liberar, o sistema vai calcular automaticamente: <strong>peso descarregado × frete por tonelada</strong>.
                A transportadora poderá então conferir e anexar a fatura.
              </AlertBox>
              {ehFiscal && (
                <Button variant="primary" onClick={liberar} style={{ marginTop: 10 }}>
                  ✅ Liberar Faturamento
                </Button>
              )}
            </>
          )}
        </>
      ) : (
        <>
          <div style={{ background: "var(--surf2)", borderRadius: "var(--radius)", padding: 12, marginBottom: 12 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
              Cálculo do sistema
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontSize: 13 }}>
              <span>{fmtKg(fat.peso_base_kg)} ÷ 1.000</span>
              <span>×</span>
              <span>R$ {fat.frete_ton}/t</span>
              <span>=</span>
              <strong style={{ color: "var(--g700)", fontSize: 16 }}>{fmtBRL(fat.valor_calculado)}</strong>
            </div>
            <div style={{ fontSize: 10, color: "var(--hint)", marginTop: 4 }}>
              Liberado em {fat.liberado_em ? fmtDate(fat.liberado_em) : "—"}
            </div>
          </div>

          {fat.valor_informado != null && (
            <div style={{ background: fat.divergencia ? "var(--r100)" : "var(--g100)", borderRadius: "var(--radius)", padding: 12, marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                Fatura da transportadora
              </div>
              <div style={{ fontSize: 13 }}>
                Valor informado: <strong>{fmtBRL(fat.valor_informado)}</strong>
              </div>
              {fat.divergencia ? (
                <>
                  <div style={{ fontSize: 12, color: "var(--r600)", marginTop: 4 }}>
                    ⚠️ Divergência de <strong>{fmtBRL(fat.divergencia)}</strong> vs. calculado
                  </div>
                  {fat.justificativa_divergencia && (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4 }}>
                      Justificativa: <em>"{fat.justificativa_divergencia}"</em>
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 11, color: "var(--g700)", marginTop: 2 }}>✓ Sem divergência</div>
              )}
              {fat.fatura_url && <div style={{ fontSize: 10, color: "var(--hint)", marginTop: 4 }}>📄 {fat.fatura_url}</div>}
              {fat.cte_id && <div style={{ fontSize: 10, color: "var(--hint)" }}>🧾 CTE: {fat.cte_id}</div>}
            </div>
          )}

          {pag && (
            <AlertBox tone="green" icon="✅" title={`Pagamento confirmado em ${fmtDate(pag.data_pagamento)}`}>
              Valor pago: <strong>{fmtBRL(pag.valor_pago)}</strong>
              {pag.observacoes && <><br />{pag.observacoes}</>}
            </AlertBox>
          )}

          {ehTransp && !fat.valor_informado && (
            <Button variant="primary" onClick={() => { setValorInf(fat.valor_calculado); setAnexarOpen(true); }} style={{ marginTop: 8 }}>
              📎 Conferir e anexar fatura (CT-es)
            </Button>
          )}

          {/* Resultado da IA — exibido quando fatura foi anexada */}
          {fat.ia_analise_id && (() => {
            const ia = iaAnalisesFatura.find((a) => a.id === fat.ia_analise_id);
            return ia ? <ResultadoIAFatura analise={ia} /> : null;
          })()}

          {/* Botão Conferir (fiscal) — só quando IA já rodou E ainda não conferido */}
          {ehFiscal && fat.ia_analise_id && !fat.fiscal_conferida_em && (
            <Button variant="primary" onClick={() => setConferirOpen(true)} style={{ marginTop: 4 }}>
              ✓ Conferir e enviar ao financeiro
            </Button>
          )}

          {/* Conferida pelo fiscal — mostra confirmação */}
          {fat.fiscal_conferida_em && (
            <AlertBox tone="green" icon="✓" title={`Fiscal conferiu em ${fmtDate(fat.fiscal_conferida_em)}`}>
              {fat.fiscal_observacao && <em>"{fat.fiscal_observacao}"</em>}
              <div style={{ marginTop: 4 }}>Aguardando processamento do financeiro.</div>
            </AlertBox>
          )}

          {ehFinanceiro && fat.valor_informado != null && fat.fiscal_conferida_em && !pag && (
            <Button variant="success" onClick={() => { setValorPagar(fat.valor_informado!); setPagarOpen(true); }} style={{ marginTop: 8 }}>
              💸 Registrar Pagamento
            </Button>
          )}
        </>
      )}

      {/* Modal: Anexar fatura (transp) — agora com multi-CT-e + IA */}
      <Modal
        open={anexarOpen}
        onClose={() => setAnexarOpen(false)}
        title="📎 Anexar fatura dos CT-es"
        subtitle="A IA vai conferir 4 campos: valor, transportadora, prestador, número do CT-e"
        wide
        footer={
          <>
            <Button onClick={() => setAnexarOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={anexar}>🤖 Anexar e rodar IA</Button>
          </>
        }
      >
        {fat && (
          <AlertBox tone="blue" icon="💰" title={`Valor calculado pelo sistema: ${fmtBRL(fat.valor_calculado)}`}>
            Confirme se o valor da sua fatura é exatamente este. Se divergir, justifique abaixo.
          </AlertBox>
        )}

        <FormRow>
          <Field label="Número da fatura">
            <Input value={numeroFatura} onChange={(e) => setNumeroFatura(e.target.value)} placeholder="Ex: NF-2026-0123" />
          </Field>
          <Field label="Valor da fatura *">
            <NumberInput value={valorInf} onChange={setValorInf} variant="currency" suffix="R$" />
          </Field>
        </FormRow>

        <Field label={`CT-es vinculados a esta fatura * (${ctesIdsSel.length} selecionados)`} hint="Selecione TODOS os CT-es agrupados nesta fatura — a IA vai conferir contra cada um">
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 6 }}>
            {ctesDaOc.length === 0 ? (
              <div style={{ fontSize: 11, color: "var(--hint)" }}>Nenhum CT-e anexado a esta OC. Anexe o CT-e primeiro.</div>
            ) : (
              ctesDaOc.map((c) => {
                const sel = ctesIdsSel.includes(c.id);
                return (
                  <label
                    key={c.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      padding: "6px 10px",
                      background: sel ? "var(--g100)" : "var(--surf2)",
                      border: `1px solid ${sel ? "var(--g400)" : "var(--border)"}`,
                      borderRadius: "var(--radius)",
                      cursor: "pointer",
                      fontSize: 12,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={sel}
                      onChange={() =>
                        setCtesIdsSel((arr) =>
                          arr.includes(c.id) ? arr.filter((x) => x !== c.id) : [...arr, c.id],
                        )
                      }
                    />
                    <span>CT-e {c.numero}</span>
                  </label>
                );
              })
            )}
          </div>
        </Field>

        <FormRow variant="single">
          <Field label="Fatura (PDF) *">
            <UploadZone label="Anexar fatura" icon="📄" required />
            <Input style={{ marginTop: 6 }} value={faturaUrl} onChange={(e) => setFaturaUrl(e.target.value)} placeholder="OU cole URL temporária / nome do arquivo" />
          </Field>
        </FormRow>
        {fat && typeof valorInf === "number" && Math.abs(valorInf - fat.valor_calculado) > 0.01 && (
          <FormRow variant="single">
            <Field label="Justificativa da divergência *" hint={`Diferença: ${fmtBRL(Math.abs(valorInf - fat.valor_calculado))}`}>
              <Textarea value={justificativa} onChange={(e) => setJustificativa(e.target.value)} placeholder="Ex: tara do veículo aferida diferente, taxa adicional, ajuste contratual..." />
            </Field>
          </FormRow>
        )}
      </Modal>

      {/* Modal: Conferir fiscal — após IA */}
      <Modal
        open={conferirOpen}
        onClose={() => setConferirOpen(false)}
        title="✓ Conferir fatura e enviar ao financeiro"
        footer={
          <>
            <Button onClick={() => setConferirOpen(false)}>Cancelar</Button>
            <Button variant="primary" onClick={conferir}>Confirmar e enviar</Button>
          </>
        }
      >
        <AlertBox tone="blue" icon="🤖" title="A IA já analisou — você está conferindo">
          Revise o resultado da IA antes de enviar ao financeiro. Sua confirmação destrava o pagamento.
        </AlertBox>
        <FormRow variant="single">
          <Field label="Observação (opcional)" hint="Anote algo relevante sobre a conferência">
            <Textarea
              value={obsConferir}
              onChange={(e) => setObsConferir(e.target.value)}
              placeholder="Ex: Tudo conforme. / Aceito divergência conforme negociação X..."
            />
          </Field>
        </FormRow>
      </Modal>

      {/* Modal: Confirmar pagamento (financeiro) */}
      <Modal
        open={pagarOpen}
        onClose={() => setPagarOpen(false)}
        title="💸 Registrar pagamento"
        footer={
          <>
            <Button onClick={() => setPagarOpen(false)}>Cancelar</Button>
            <Button variant="success" onClick={pagar}>Confirmar pagamento</Button>
          </>
        }
      >
        <FormRow variant="single">
          <Field label="Valor pago *">
            <NumberInput value={valorPagar} onChange={setValorPagar} variant="currency" suffix="R$" />
          </Field>
        </FormRow>
        <FormRow variant="single">
          <Field label="Comprovante de pagamento">
            <UploadZone label="Anexar comprovante (PDF/imagem)" icon="💳" optional />
            <Input style={{ marginTop: 6 }} value={comprovUrl} onChange={(e) => setComprovUrl(e.target.value)} placeholder="OU cole URL temporária" />
          </Field>
        </FormRow>
        <FormRow variant="single">
          <Field label="Observações">
            <Textarea value={obsPag} onChange={(e) => setObsPag(e.target.value)} />
          </Field>
        </FormRow>
      </Modal>
    </Card>
  );
}
