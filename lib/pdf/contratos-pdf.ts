/* ════════════════════════════════════════════════════════════════════
 * Gerador de PDF do Relatório de Contratos.
 * Usa jsPDF + jspdf-autotable.
 *
 * Recebe a LISTA JÁ FILTRADA + metadados dos filtros aplicados,
 * pra mostrar no cabeçalho do PDF.
 * ════════════════════════════════════════════════════════════════════ */

import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { fmtKg, fmtBRL, fmtDate } from "@/lib/domain/format";
import type { Cliente, Contrato, Produto, Produtor } from "@/lib/types";

interface InputContratosPDF {
  contratos: Contrato[];
  produtos: Produto[];
  produtores: Produtor[];
  clientes: Cliente[];
  filtros: {
    status?: string;
    operacao?: string;
    safra?: string;
    search?: string;
  };
}

const VERDE = [22, 163, 74] as const;
const STONE_700 = [68, 64, 60] as const;
const STONE_500 = [120, 113, 108] as const;

export function gerarPDFContratos(input: InputContratosPDF): void {
  const { contratos, produtos, produtores, clientes, filtros } = input;

  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const M = 12; // margin

  // ─── Cabeçalho ─────────────────────────────────────────────────────
  doc.setFillColor(VERDE[0], VERDE[1], VERDE[2]);
  doc.rect(0, 0, W, 22, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.text("terraroxa", M, 11);

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Relatório de Contratos", M, 17);

  // Data à direita
  const dataHora = new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  doc.setFontSize(9);
  doc.text(`Gerado em: ${dataHora}`, W - M, 11, { align: "right" });
  doc.text(`${contratos.length} contratos`, W - M, 17, { align: "right" });

  // ─── Filtros aplicados (caixa amarela) ─────────────────────────────
  doc.setTextColor(STONE_700[0], STONE_700[1], STONE_700[2]);
  let y = 28;
  const filtrosLabels: string[] = [];
  if (filtros.status) filtrosLabels.push(`Status: ${filtros.status}`);
  if (filtros.operacao) filtrosLabels.push(`Operação: ${filtros.operacao}`);
  if (filtros.safra) filtrosLabels.push(`Safra: ${filtros.safra}`);
  if (filtros.search) filtrosLabels.push(`Busca: "${filtros.search}"`);
  if (filtrosLabels.length > 0) {
    doc.setFillColor(254, 243, 199); // amber-100
    doc.setDrawColor(217, 119, 6);   // amber-600
    doc.roundedRect(M, y, W - 2 * M, 8, 1, 1, "FD");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("Filtros aplicados:", M + 3, y + 5);
    doc.setFont("helvetica", "normal");
    doc.text(filtrosLabels.join("  ·  "), M + 35, y + 5);
    y += 12;
  }

  // ─── Totalizadores ─────────────────────────────────────────────────
  const totalKg = contratos.reduce((s, c) => s + c.qtd_kg_total, 0);
  const saldoKg = contratos.reduce((s, c) => s + c.saldo_kg, 0);
  const totalRS = contratos.reduce((s, c) => s + (c.valor_total ?? 0), 0);

  const stats = [
    { label: "Contratos", valor: contratos.length.toString() },
    { label: "Qtd Total", valor: fmtKg(totalKg) },
    { label: "Saldo Total", valor: fmtKg(saldoKg) },
    { label: "Valor Total", valor: fmtBRL(totalRS) },
  ];
  const cardW = (W - 2 * M - 9) / 4;
  stats.forEach((s, i) => {
    const x = M + i * (cardW + 3);
    doc.setFillColor(245, 245, 244); // stone-100
    doc.setDrawColor(231, 229, 228);
    doc.roundedRect(x, y, cardW, 14, 1, 1, "FD");
    doc.setTextColor(STONE_500[0], STONE_500[1], STONE_500[2]);
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.text(s.label.toUpperCase(), x + 3, y + 4.5);
    doc.setTextColor(STONE_700[0], STONE_700[1], STONE_700[2]);
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.text(s.valor, x + 3, y + 11);
  });
  y += 18;

  // ─── Tabela principal ──────────────────────────────────────────────
  const rows = contratos.map((c) => {
    const prod = produtos.find((p) => p.id === c.produto_id);
    const produtor = produtores.find((p) => p.id === c.produtor_id);
    const cliente = clientes.find((cl) => cl.id === c.cliente_id);
    return [
      c.numero_manual || c.numero,
      c.operacao ?? "",
      c.safra ?? "",
      produtor?.nome ?? "—",
      prod?.nome ?? "—",
      fmtKg(c.qtd_kg_total),
      fmtKg(c.saldo_kg),
      c.valor_total ? fmtBRL(c.valor_total) : "—",
      cliente?.nome ?? "—",
      c.data_vencto_financeiro ? fmtDate(c.data_vencto_financeiro) : "—",
      c.status,
    ];
  });

  autoTable(doc, {
    startY: y,
    head: [["Nº", "Operação", "Safra", "Produtor", "Produto", "Qtd Total", "Saldo", "Valor Total", "Cliente", "Vencto", "Status"]],
    body: rows,
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [VERDE[0], VERDE[1], VERDE[2]] as [number, number, number],
      textColor: 255,
      fontSize: 8,
      fontStyle: "bold",
    },
    alternateRowStyles: { fillColor: [250, 250, 249] as [number, number, number] },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: 18 },
      1: { cellWidth: 38 },
      2: { cellWidth: 15 },
      3: { cellWidth: 45 },
      4: { cellWidth: 25 },
      5: { halign: "right", cellWidth: 22 },
      6: { halign: "right", cellWidth: 22 },
      7: { halign: "right", cellWidth: 24 },
      8: { cellWidth: 32 },
      9: { cellWidth: 16 },
      10: { cellWidth: 18 },
    },
    margin: { left: M, right: M },
    didDrawPage: (data) => {
      // Footer com paginação
      const pageCount = doc.getNumberOfPages();
      const pageNumber = data.pageNumber;
      const pageH = doc.internal.pageSize.getHeight();
      doc.setTextColor(STONE_500[0], STONE_500[1], STONE_500[2]);
      doc.setFontSize(8);
      doc.setFont("helvetica", "normal");
      doc.text(
        `Página ${pageNumber} de ${pageCount}  ·  terraroxa  ·  ${dataHora}`,
        W / 2,
        pageH - 5,
        { align: "center" },
      );
    },
  });

  const filename = `contratos_${new Date().toISOString().split("T")[0]}.pdf`;
  doc.save(filename);
}
