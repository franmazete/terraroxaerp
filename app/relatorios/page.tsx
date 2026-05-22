"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatBox } from "@/components/ui/StatBox";
import { EmptyState } from "@/components/ui/EmptyState";
import { Table, tableStyles } from "@/components/ui/Table";
import { Badge } from "@/components/ui/Badge";
import { CadastroHeader } from "@/components/cadastros/CadastroHeader";
import { Field, FormRow, Input, Select } from "@/components/ui/Form";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { CORES_CHART } from "@/components/charts/palette";
import { Tabs } from "@/components/ui/Tabs";
import { useDataStore } from "@/lib/data-store";
import { fmtKg, fmtBRL, fmtDate } from "@/lib/domain/format";
import { downloadCSV, fmtDataCSV } from "@/lib/domain/csv";

type Aba = "operacoes" | "quebra";

export default function RelatoriosPage() {
  const { ordens, transportadoras, contratos, produtos, dadosDescarga, faturamentos, quebras } = useDataStore();
  const [aba, setAba] = useState<Aba>("operacoes");

  // Filtros — default: últimos 30 dias
  const hoje = new Date();
  const trintaDiasAtras = new Date(hoje.getTime() - 30 * 24 * 3600 * 1000);
  const [de, setDe] = useState(trintaDiasAtras.toISOString().split("T")[0]);
  const [ate, setAte] = useState(hoje.toISOString().split("T")[0]);
  const [transpId, setTranspId] = useState<string>("");
  const [produtoId, setProdutoId] = useState<string>("");

  const lista = useMemo(() => {
    const deDate = new Date(de);
    const ateDate = new Date(ate);
    ateDate.setHours(23, 59, 59, 999);
    return ordens.filter((o) => {
      const emitida = new Date(o.emitida_em);
      if (emitida < deDate || emitida > ateDate) return false;
      if (transpId && o.transp_id !== transpId) return false;
      if (produtoId) {
        const ct = contratos.find((c) => c.id === o.contrato_id);
        if (ct?.produto_id !== produtoId) return false;
      }
      return true;
    });
  }, [ordens, de, ate, transpId, produtoId, contratos]);

  const stats = useMemo(() => {
    const total = lista.length;
    const pesoPrevisto = lista.reduce((s, o) => s + o.peso_previsto_kg, 0);
    const pesoDescarregado = lista.reduce((s, o) => {
      const d = dadosDescarga.find((d) => d.oc_id === o.id);
      return s + (d?.peso_descarregado_kg ?? 0);
    }, 0);
    const valorPago = lista.reduce((s, o) => {
      const f = faturamentos.find((f) => f.oc_id === o.id);
      return s + (f?.valor_informado ?? f?.valor_calculado ?? 0);
    }, 0);

    // Agrupa por transp
    const porTransp = new Map<string, { ocs: number; peso: number }>();
    lista.forEach((o) => {
      const t = transportadoras.find((t) => t.id === o.transp_id);
      const key = t?.nome_fantasia ?? "?";
      const cur = porTransp.get(key) ?? { ocs: 0, peso: 0 };
      const d = dadosDescarga.find((d) => d.oc_id === o.id);
      porTransp.set(key, {
        ocs: cur.ocs + 1,
        peso: cur.peso + (d?.peso_descarregado_kg ?? o.peso_previsto_kg),
      });
    });
    const transpChart = Array.from(porTransp.entries())
      .map(([nome, v]) => ({ name: nome, value: Math.round(v.peso / 1000) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);

    // Agrupa por dia (timeline)
    const porDia = new Map<string, number>();
    lista.forEach((o) => {
      const key = o.emitida_em;
      porDia.set(key, (porDia.get(key) ?? 0) + 1);
    });
    const diasOrd = Array.from(porDia.entries()).sort();
    const timeline = diasOrd.map(([dia, ocs]) => ({
      name: new Date(dia).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
      OCs: ocs,
    }));

    return { total, pesoPrevisto, pesoDescarregado, valorPago, transpChart, timeline };
  }, [lista, transportadoras, dadosDescarga, faturamentos]);

  function exportar() {
    downloadCSV(
      lista,
      [
        { header: "Número OC", value: (o) => o.numero },
        { header: "Emitida em", value: (o) => fmtDataCSV(o.emitida_em) },
        { header: "Transportadora", value: (o) => transportadoras.find((t) => t.id === o.transp_id)?.nome_fantasia ?? "" },
        { header: "Produto", value: (o) => {
            const ct = contratos.find((c) => c.id === o.contrato_id);
            return produtos.find((p) => p.id === ct?.produto_id)?.nome ?? "";
          } },
        { header: "Peso Previsto (kg)", value: (o) => o.peso_previsto_kg },
        { header: "Peso Descarregado (kg)", value: (o) => dadosDescarga.find((d) => d.oc_id === o.id)?.peso_descarregado_kg ?? "" },
        { header: "Valor Faturado (R$)", value: (o) => {
            const f = faturamentos.find((f) => f.oc_id === o.id);
            return f?.valor_informado ?? f?.valor_calculado ?? "";
          } },
        { header: "Status", value: (o) => o.status },
        { header: "Status Operacional", value: (o) => o.status_operacional ?? "" },
        { header: "Status Financeiro", value: (o) => o.status_financeiro ?? "" },
        { header: "Refugada", value: (o) => (o.refugada ? "Sim" : "Não") },
      ],
      `relatorio_operacoes_${de}_${ate}`,
    );
  }

  // Análise de quebra por transp
  const quebraPorTransp = useMemo(() => {
    const porT = new Map<string, { transp: string; qtdQuebras: number; mediaPct: number; maxPct: number; alertas: number; totalKg: number }>();
    quebras.forEach((q) => {
      const oc = ordens.find((o) => o.id === q.oc_id);
      const t = oc ? transportadoras.find((t) => t.id === oc.transp_id) : null;
      const key = t?.nome_fantasia ?? "?";
      const cur = porT.get(key) ?? { transp: key, qtdQuebras: 0, mediaPct: 0, maxPct: 0, alertas: 0, totalKg: 0 };
      cur.qtdQuebras += 1;
      cur.mediaPct = (cur.mediaPct * (cur.qtdQuebras - 1) + q.quebra_pct) / cur.qtdQuebras;
      cur.maxPct = Math.max(cur.maxPct, q.quebra_pct);
      cur.alertas += q.alerta ? 1 : 0;
      cur.totalKg += q.quebra_kg;
      porT.set(key, cur);
    });
    return Array.from(porT.values()).sort((a, b) => b.mediaPct - a.mediaPct);
  }, [quebras, ordens, transportadoras]);

  const chartQuebra = quebraPorTransp.map((q) => ({
    name: q.transp,
    value: +q.mediaPct.toFixed(2),
    cor: q.mediaPct > 0.5 ? CORES_CHART.red : CORES_CHART.green,
  }));

  return (
    <>
      <CadastroHeader
        title="Relatórios"
        description="Operações por período · quebra por transportadora"
        icon="📊"
        count={aba === "operacoes" ? lista.length : quebras.length}
        extras={
          aba === "operacoes" ? (
            <Button size="sm" variant="primary" onClick={exportar} disabled={lista.length === 0}>
              📥 Exportar CSV
            </Button>
          ) : (
            <Button
              size="sm"
              variant="primary"
              disabled={quebras.length === 0}
              onClick={() =>
                downloadCSV(
                  quebras,
                  [
                    { header: "OC", value: (q) => ordens.find((o) => o.id === q.oc_id)?.numero ?? "" },
                    { header: "Transportadora", value: (q) => {
                        const o = ordens.find((o) => o.id === q.oc_id);
                        return transportadoras.find((t) => t.id === o?.transp_id)?.nome_fantasia ?? "";
                      } },
                    { header: "Peso Carregado (kg)", value: (q) => q.peso_carregado_kg },
                    { header: "Peso Descarregado (kg)", value: (q) => q.peso_descarregado_kg },
                    { header: "Quebra (kg)", value: (q) => q.quebra_kg },
                    { header: "Quebra (%)", value: (q) => q.quebra_pct },
                    { header: "Alerta (>0,5%)", value: (q) => (q.alerta ? "Sim" : "Não") },
                    { header: "Calculado em", value: (q) => fmtDataCSV(q.calculado_em) },
                  ],
                  `quebra_por_transp_${new Date().toISOString().split("T")[0]}`,
                )
              }
            >
              📥 Exportar CSV
            </Button>
          )
        }
      />

      <Tabs<Aba>
        active={aba}
        onChange={setAba}
        tabs={[
          { id: "operacoes", label: "📈 Operações por período" },
          { id: "quebra", label: "⚖️ Quebra por transp." },
        ]}
      />

      {aba === "quebra" && (
        <>
          {quebras.length === 0 ? (
            <Card className="section-gap">
              <EmptyState icon="⚖️">
                Ainda não há quebras calculadas. O relatório aparecerá quando o fiscal calcular a primeira.
              </EmptyState>
            </Card>
          ) : (
            <>
              <div className="grid-4 section-gap">
                <StatBox tone="b" label="Total Quebras" value={quebras.length} />
                <StatBox
                  tone="r"
                  label="Acima do limite"
                  value={quebras.filter((q) => q.alerta).length}
                  sub="> 0,5%"
                />
                <StatBox
                  tone="a"
                  label="Quebra média geral"
                  value={`${(quebras.reduce((s, q) => s + q.quebra_pct, 0) / quebras.length).toFixed(2)}%`}
                />
                <StatBox
                  tone="g"
                  label="Quebra acumulada"
                  value={fmtKg(quebras.reduce((s, q) => s + q.quebra_kg, 0))}
                />
              </div>

              <Card className="section-gap">
                <CardHeader><CardTitle>📊 Quebra média por transportadora (%)</CardTitle></CardHeader>
                <BarChart
                  data={chartQuebra}
                  layout="horizontal"
                  altura={Math.max(220, chartQuebra.length * 36 + 40)}
                  formatValor={(v) => v.toFixed(2) + " %"}
                />
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                  Vermelho = média acima do limite operacional (0,5%). Verde = dentro do limite.
                </div>
              </Card>

              <Card className="section-gap">
                <CardHeader><CardTitle>📋 Ranking detalhado</CardTitle></CardHeader>
                <Table>
                  <thead>
                    <tr>
                      <th>Transportadora</th>
                      <th>Operações</th>
                      <th>Quebra média</th>
                      <th>Quebra máxima</th>
                      <th>Acima do limite</th>
                      <th>Quebra acumulada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {quebraPorTransp.map((q) => (
                      <tr key={q.transp}>
                        <td><strong>{q.transp}</strong></td>
                        <td>{q.qtdQuebras}</td>
                        <td>
                          <Badge tone={q.mediaPct > 0.5 ? "red" : "green"}>{q.mediaPct.toFixed(2)}%</Badge>
                        </td>
                        <td>
                          <Badge tone={q.maxPct > 0.5 ? "red" : "green"}>{q.maxPct.toFixed(2)}%</Badge>
                        </td>
                        <td>
                          {q.alertas > 0 ? (
                            <Badge tone="red">{q.alertas} de {q.qtdQuebras}</Badge>
                          ) : (
                            <Badge tone="green">0</Badge>
                          )}
                        </td>
                        <td>{fmtKg(q.totalKg)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </Card>
            </>
          )}
        </>
      )}

      {aba === "operacoes" && (
        <>
      <Card className="section-gap">
        <FormRow>
          <Field label="De">
            <Input type="date" value={de} onChange={(e) => setDe(e.target.value)} />
          </Field>
          <Field label="Até">
            <Input type="date" value={ate} onChange={(e) => setAte(e.target.value)} />
          </Field>
        </FormRow>
        <FormRow>
          <Field label="Transportadora">
            <Select value={transpId} onChange={(e) => setTranspId(e.target.value)}>
              <option value="">Todas</option>
              {transportadoras.map((t) => (
                <option key={t.id} value={t.id}>{t.nome_fantasia}</option>
              ))}
            </Select>
          </Field>
          <Field label="Produto">
            <Select value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
              <option value="">Todos</option>
              {produtos.map((p) => (
                <option key={p.id} value={p.id}>{p.nome}</option>
              ))}
            </Select>
          </Field>
        </FormRow>
      </Card>

      <div className="grid-4 section-gap">
        <StatBox tone="b" label="Total OCs" value={stats.total} sub={`${de} → ${ate}`} />
        <StatBox tone="g" label="Peso Descarregado" value={fmtKg(stats.pesoDescarregado)} sub={`de ${fmtKg(stats.pesoPrevisto)} previsto`} />
        <StatBox tone="a" label="Valor Faturado" value={fmtBRL(stats.valorPago)} sub="soma do período" />
        <StatBox tone="t" label="Período" value={`${Math.round((new Date(ate).getTime() - new Date(de).getTime()) / (24 * 3600 * 1000)) + 1} dias`} />
      </div>

      {lista.length === 0 ? (
        <Card><EmptyState icon="📊">Nenhuma OC no período. Ajuste os filtros.</EmptyState></Card>
      ) : (
        <>
          <div className="grid-2 section-gap">
            <Card>
              <CardHeader><CardTitle>📈 OCs emitidas por dia</CardTitle></CardHeader>
              <LineChart
                data={stats.timeline}
                series={[{ key: "OCs", label: "OCs/dia", cor: CORES_CHART.green }]}
                altura={240}
              />
            </Card>
            <Card>
              <CardHeader><CardTitle>🚛 Volume por transportadora (t)</CardTitle></CardHeader>
              {stats.transpChart.length === 0 ? (
                <EmptyState icon="🚛">Sem dados.</EmptyState>
              ) : (
                <BarChart
                  data={stats.transpChart}
                  layout="horizontal"
                  altura={Math.max(220, stats.transpChart.length * 32 + 40)}
                  formatValor={(v) => v.toLocaleString("pt-BR") + " t"}
                />
              )}
            </Card>
          </div>

          <Card className="section-gap">
            <CardHeader><CardTitle>📋 Detalhamento ({lista.length} OCs)</CardTitle></CardHeader>
            <Table>
              <thead>
                <tr>
                  <th>OC</th>
                  <th>Emitida</th>
                  <th>Transp.</th>
                  <th>Produto</th>
                  <th>Previsto</th>
                  <th>Descarregado</th>
                  <th>Valor</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {lista.map((o) => {
                  const transp = transportadoras.find((t) => t.id === o.transp_id);
                  const ct = contratos.find((c) => c.id === o.contrato_id);
                  const produto = produtos.find((p) => p.id === ct?.produto_id);
                  const d = dadosDescarga.find((d) => d.oc_id === o.id);
                  const f = faturamentos.find((f) => f.oc_id === o.id);
                  const valor = f?.valor_informado ?? f?.valor_calculado;
                  return (
                    <tr key={o.id}>
                      <td><Link href={`/ordens/${o.id}`} className={tableStyles.mono} style={{ color: "var(--g700)", fontWeight: 600 }}>{o.numero}</Link></td>
                      <td>{fmtDate(o.emitida_em)}</td>
                      <td>{transp?.nome_fantasia ?? "—"}</td>
                      <td>{produto?.nome ?? "—"}</td>
                      <td>{fmtKg(o.peso_previsto_kg)}</td>
                      <td>{d ? fmtKg(d.peso_descarregado_kg) : "—"}</td>
                      <td>{typeof valor === "number" ? fmtBRL(valor) : "—"}</td>
                      <td>
                        <Badge tone={o.status === "finalizada" ? "green" : o.status === "cancelada" ? "red" : "blue"}>
                          {o.status}
                        </Badge>
                        {o.refugada && <Badge tone="red">⚠</Badge>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </Table>
          </Card>
        </>
      )}
        </>
      )}
    </>
  );
}
