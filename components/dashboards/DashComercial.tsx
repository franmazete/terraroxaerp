"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { StatBox } from "@/components/ui/StatBox";
import { AlertBox } from "@/components/ui/AlertBox";
import { EmptyState } from "@/components/ui/EmptyState";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { PieChart } from "@/components/charts/PieChart";
import { CORES_CHART } from "@/components/charts/palette";
import { useDataStore } from "@/lib/data-store";
import { fmtKg, fmtBRL } from "@/lib/domain/format";

export function DashComercial() {
  const { contratos, cargas, transportadoras, produtores, produtos } = useDataStore();

  const stats = useMemo(() => {
    const ativos = contratos.filter((c) => c.status === "ativo");
    const disponiveis = ativos.filter((c) => c.disponivel && c.saldo_kg > 0);
    const totalKg = ativos.reduce((s, c) => s + c.qtd_kg_total, 0);
    const saldoTotal = ativos.reduce((s, c) => s + c.saldo_kg, 0);
    const totalValor = ativos.reduce((s, c) => s + (c.valor_total ?? 0), 0);
    const cargasPubl = cargas.length;
    const cargasComReserva = cargas.filter((c) => c.reservas.length > 0).length;
    const ticketMedio = cargas.length > 0 ? cargas.reduce((s, c) => s + c.total_kg, 0) / cargas.length : 0;

    // Volume contratado por mês (últimos 6 meses)
    const hoje = new Date();
    const ultimosMeses: { mes: string; ano: number; m: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1);
      ultimosMeses.push({
        mes: d.toLocaleString("pt-BR", { month: "short" }).replace(".", ""),
        ano: d.getFullYear(),
        m: d.getMonth(),
      });
    }
    const volumePorMes = ultimosMeses.map((m) => {
      const ctsDoMes = contratos.filter((c) => {
        if (!c.data_emissao) return false;
        const d = new Date(c.data_emissao);
        return d.getFullYear() === m.ano && d.getMonth() === m.m;
      });
      return {
        name: `${m.mes}/${String(m.ano).slice(2)}`,
        Volume: ctsDoMes.reduce((s, c) => s + c.qtd_kg_total, 0) / 1000, // em toneladas
      };
    });

    // Top 5 transps por volume reservado
    const volPorTransp = new Map<string, number>();
    cargas.forEach((c) =>
      c.reservas.forEach((r) => {
        volPorTransp.set(r.transp_id, (volPorTransp.get(r.transp_id) ?? 0) + r.qtd_kg);
      }),
    );
    const topTransps = Array.from(volPorTransp.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([tid, vol]) => ({
        name: transportadoras.find((t) => t.id === tid)?.nome_fantasia ?? "?",
        value: Math.round(vol / 1000), // toneladas
      }));

    // Top 5 produtores por contratos (qtd contratada)
    const volPorProdutor = new Map<string, number>();
    contratos.forEach((c) =>
      volPorProdutor.set(c.produtor_id, (volPorProdutor.get(c.produtor_id) ?? 0) + c.qtd_kg_total),
    );
    const topProdutores = Array.from(volPorProdutor.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([pid, vol]) => ({
        name: produtores.find((p) => p.id === pid)?.nome ?? "?",
        value: Math.round(vol / 1000),
      }));

    // Distribuição por produto (pie)
    const volPorProduto = new Map<string, number>();
    contratos.forEach((c) =>
      volPorProduto.set(c.produto_id, (volPorProduto.get(c.produto_id) ?? 0) + c.qtd_kg_total),
    );
    const distribProduto = Array.from(volPorProduto.entries()).map(([pid, vol]) => ({
      name: produtos.find((p) => p.id === pid)?.nome ?? "?",
      value: Math.round(vol / 1000),
    }));

    return {
      ativos: ativos.length,
      disponiveis: disponiveis.length,
      totalKg,
      saldoTotal,
      totalValor,
      cargasPubl,
      cargasComReserva,
      ticketMedio,
      volumePorMes,
      topTransps,
      topProdutores,
      distribProduto,
    };
  }, [contratos, cargas, transportadoras, produtores, produtos]);

  const semDados = contratos.length === 0;

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-title">📊 Dashboard Comercial</div>
          <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 2 }}>
            Contratos, cargas e analytics de parceiros
          </div>
        </div>
        <Link href="/contratos"><Button variant="primary">📑 Ver Contratos</Button></Link>
      </div>

      <div className="grid-4 section-gap">
        <StatBox tone="g" label="Contratos Disponíveis" value={stats.disponiveis} sub={`de ${stats.ativos} ativos`} />
        <StatBox tone="b" label="Volume Contratado" value={fmtKg(stats.totalKg)} sub="soma dos ativos" />
        <StatBox tone="t" label="Saldo a Publicar" value={fmtKg(stats.saldoTotal)} sub="ainda em contratos" />
        <StatBox tone="a" label="Valor Contratado" value={fmtBRL(stats.totalValor)} sub="soma dos valores totais" />
      </div>

      {semDados ? (
        <Card className="section-gap">
          <EmptyState icon="📊">
            Ainda não há contratos cadastrados. Os gráficos aparecerão aqui assim que houver dados.
            <div style={{ marginTop: 12 }}>
              <Link href="/contratos"><Button variant="primary">Lançar primeiro contrato</Button></Link>
            </div>
          </EmptyState>
        </Card>
      ) : (
        <>
          {/* Volume por mês */}
          <Card className="section-gap">
            <CardHeader>
              <CardTitle>📈 Volume contratado por mês (últimos 6 meses)</CardTitle>
            </CardHeader>
            <LineChart
              data={stats.volumePorMes}
              series={[{ key: "Volume", label: "Volume (t)", cor: CORES_CHART.green }]}
              altura={260}
              formatValor={(v) => v.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) + " t"}
            />
          </Card>

          <div className="grid-2 section-gap">
            <Card>
              <CardHeader>
                <CardTitle>🏆 Top 5 Transportadoras (volume reservado)</CardTitle>
              </CardHeader>
              {stats.topTransps.length === 0 ? (
                <EmptyState icon="🚛">Nenhuma reserva ainda.</EmptyState>
              ) : (
                <BarChart
                  data={stats.topTransps}
                  layout="horizontal"
                  altura={Math.max(220, stats.topTransps.length * 40 + 40)}
                  formatValor={(v) => v.toLocaleString("pt-BR") + " t"}
                />
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>🌾 Top 5 Produtores (volume contratado)</CardTitle>
              </CardHeader>
              {stats.topProdutores.length === 0 ? (
                <EmptyState icon="🌾">Sem dados.</EmptyState>
              ) : (
                <BarChart
                  data={stats.topProdutores}
                  layout="horizontal"
                  altura={Math.max(220, stats.topProdutores.length * 40 + 40)}
                  formatValor={(v) => v.toLocaleString("pt-BR") + " t"}
                  cor={CORES_CHART.amber}
                />
              )}
            </Card>
          </div>

          <div className="grid-2 section-gap">
            <Card>
              <CardHeader>
                <CardTitle>🥧 Distribuição por produto</CardTitle>
              </CardHeader>
              {stats.distribProduto.length === 0 ? (
                <EmptyState icon="📦">Sem dados.</EmptyState>
              ) : (
                <PieChart
                  data={stats.distribProduto}
                  altura={260}
                  formatValor={(v) => v.toLocaleString("pt-BR") + " t"}
                />
              )}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>📦 Cargas Publicadas</CardTitle>
              </CardHeader>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <StatBox compact tone="b" label="Total publicadas" value={stats.cargasPubl} />
                <StatBox compact tone="g" label="Com reserva" value={stats.cargasComReserva} />
                <StatBox compact tone="a" label="Sem reserva" value={stats.cargasPubl - stats.cargasComReserva} />
                <StatBox compact tone="t" label="Ticket médio (carga)" value={fmtKg(stats.ticketMedio)} />
              </div>
              {stats.cargasPubl - stats.cargasComReserva > 0 && (
                <div style={{ marginTop: 12 }}>
                  <AlertBox tone="amber" icon="⏸" title="Cargas sem reserva">
                    Considere revisar a allowlist ou comunicar transportadoras.
                  </AlertBox>
                </div>
              )}
            </Card>
          </div>
        </>
      )}
    </>
  );
}
