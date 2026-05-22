/* ════════════════════════════════════════════════════════════════════
 * BLOCO J.8 — Geração de PDF da Ordem de Carregamento (browser-side)
 * Usa jsPDF puro (sem autoTable) para não exigir polyfill server-side.
 * ════════════════════════════════════════════════════════════════════ */

import { jsPDF } from "jspdf";
import type {
  Carga,
  Contrato,
  Local,
  Motorista,
  OrdemCarregamento,
  Produtor,
  Transportadora,
  Veiculo,
} from "../types";
import type { OCSnapshot } from "../domain/checklist";
import { calcChecklist } from "../domain/checklist";

export interface PDFOCInputs {
  oc: OrdemCarregamento;
  snap: OCSnapshot;
  transp?: Transportadora;
  motorista?: Motorista;
  veiculo?: Veiculo;
  origem?: Local;
  destino?: Local;
  contrato?: Contrato;
  produtor?: Produtor;
  carga?: Carga;
  produtoNome?: string;
}

const MARGIN = 14;
const WIDTH = 210; // A4 portrait
const CONTENT_W = WIDTH - MARGIN * 2;

function setH1(doc: jsPDF, txt: string, y: number): number {
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(txt, MARGIN, y);
  doc.setFont("helvetica", "normal");
  return y + 8;
}

function setH2(doc: jsPDF, txt: string, y: number): number {
  doc.setFillColor(34, 102, 51);
  doc.rect(MARGIN, y - 4, CONTENT_W, 7, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(txt, MARGIN + 2, y + 1);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "normal");
  return y + 9;
}

function row(doc: jsPDF, label: string, value: string, y: number, col2x?: number): number {
  doc.setFontSize(8);
  doc.setTextColor(120, 120, 120);
  doc.text(label.toUpperCase(), col2x ?? MARGIN, y);
  doc.setFontSize(10);
  doc.setTextColor(0, 0, 0);
  doc.text(value || "—", col2x ?? MARGIN, y + 4);
  return y + 9;
}

function twoColRow(doc: jsPDF, l1: string, v1: string, l2: string, v2: string, y: number): number {
  const halfX = MARGIN + CONTENT_W / 2 + 2;
  row(doc, l1, v1, y);
  row(doc, l2, v2, y, halfX);
  return y + 9;
}

function divider(doc: jsPDF, y: number): number {
  doc.setDrawColor(220, 220, 220);
  doc.line(MARGIN, y, WIDTH - MARGIN, y);
  return y + 3;
}

function pageBreakIfNeeded(doc: jsPDF, y: number, minBottom: number = 285): number {
  if (y > minBottom) {
    doc.addPage();
    return 18;
  }
  return y;
}

function fmtKg(n?: number): string {
  if (typeof n !== "number") return "—";
  return n.toLocaleString("pt-BR") + " kg";
}

function fmtBR(d?: string): string {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("pt-BR");
  } catch {
    return d;
  }
}

/**
 * Gera o PDF e dispara o download. Retorna o nome do arquivo gerado.
 */
export function gerarPDFOC(inputs: PDFOCInputs): string {
  const { oc, snap, transp, motorista, veiculo, origem, destino, contrato, produtor, carga, produtoNome } = inputs;
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = 18;

  // Cabeçalho
  doc.setFillColor(34, 102, 51);
  doc.rect(0, 0, WIDTH, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("terraroxa", MARGIN, 8);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Ordem de Carregamento", WIDTH - MARGIN, 8, { align: "right" });
  doc.setTextColor(0, 0, 0);
  y = 20;

  y = setH1(doc, `OC ${oc.numero}`, y);
  doc.setFontSize(9);
  doc.setTextColor(120, 120, 120);
  doc.text(`Emitida em ${fmtBR(oc.emitida_em)} · por ${oc.emitida_por}`, MARGIN, y);
  doc.setTextColor(0, 0, 0);
  y += 6;
  if (oc.refugada) {
    doc.setFillColor(220, 53, 69);
    doc.rect(MARGIN, y - 4, 40, 6, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.text("⚠ CARGA REFUGADA", MARGIN + 2, y);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "normal");
    y += 6;
  }
  y = divider(doc, y + 2);

  // Operação
  y = setH2(doc, "Operação", y);
  y = twoColRow(doc, "Produto", produtoNome ?? "—", "Peso Previsto", fmtKg(oc.peso_previsto_kg), y);
  y = twoColRow(doc, "Origem", origem ? `${origem.nome} — ${origem.cidade}/${origem.uf}` : "—", "Destino", destino ? `${destino.nome} — ${destino.cidade}/${destino.uf}` : "A definir", y);
  y = twoColRow(doc, "Contrato Interno", contrato?.numero_manual || contrato?.numero || "—", "Carga", carga?.id || oc.carga_id, y);

  if (produtor) {
    y = row(doc, "Produtor", `${produtor.nome} — ${produtor.cidade}/${produtor.uf}`, y);
  }

  y = divider(doc, y + 2);

  // Transportadora e Veículo
  y = setH2(doc, "Transportadora e Veículo", y);
  y = twoColRow(
    doc,
    "Transportadora",
    transp ? `${transp.nome_fantasia} (${transp.cnpj_cpf})` : "—",
    "RNTRC",
    transp?.rntrc || "—",
    y,
  );
  if (motorista) {
    y = twoColRow(doc, "Motorista", motorista.nome, "CPF", motorista.cpf, y);
    y = twoColRow(doc, "CNH", motorista.cnh, "Celular", motorista.celular, y);
  }
  if (veiculo) {
    y = twoColRow(
      doc,
      "Placa Cavalo",
      veiculo.placa_cavalo,
      "Placa Carreta",
      veiculo.placa_carreta || "—",
      y,
    );
    y = twoColRow(doc, "Tipo", veiculo.tipo, "Capacidade", fmtKg(veiculo.capacidade_kg), y);
  }

  y = divider(doc, y + 2);
  y = pageBreakIfNeeded(doc, y);

  // Pesos e Quebra
  y = setH2(doc, "Pesos e Quebra", y);
  y = twoColRow(
    doc,
    "Peso Carregado (origem)",
    fmtKg(snap.ticketCarreg?.peso_liquido_kg),
    "Peso Descarregado (destino)",
    fmtKg(snap.descarga?.peso_descarregado_kg),
    y,
  );
  if (snap.quebra) {
    const q = snap.quebra;
    y = twoColRow(
      doc,
      "Quebra",
      `${q.quebra_kg.toLocaleString("pt-BR")} kg (${q.quebra_pct.toFixed(2)}%)`,
      "Status",
      q.alerta ? "⚠ ACIMA DO LIMITE (0,5%)" : "OK — dentro do limite",
      y,
    );
    if (q.justificativa_transp) {
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("JUSTIFICATIVA TRANSPORTADORA", MARGIN, y);
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      const lines = doc.splitTextToSize(q.justificativa_transp, CONTENT_W);
      doc.text(lines, MARGIN, y + 4);
      y += 4 + lines.length * 4 + 4;
    }
    if (q.observacao_fiscal) {
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      doc.text("OBSERVAÇÃO FISCAL", MARGIN, y);
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
      const lines = doc.splitTextToSize(q.observacao_fiscal, CONTENT_W);
      doc.text(lines, MARGIN, y + 4);
      y += 4 + lines.length * 4 + 4;
    }
  }
  y = divider(doc, y + 2);
  y = pageBreakIfNeeded(doc, y);

  // Checklist Sequencial
  y = setH2(doc, "Checklist Sequencial", y);
  const passos = calcChecklist(snap);
  doc.setFontSize(9);
  for (const p of passos) {
    y = pageBreakIfNeeded(doc, y, 280);
    const icon = p.status === "concluido" ? "[X]" : p.status === "pendente" ? "[ ]" : p.status === "bloqueado" ? "[-]" : p.status === "rejeitado" ? "[!]" : "[~]";
    doc.setFont("helvetica", "bold");
    doc.text(`${icon} ${p.label}`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 120, 120);
    if (p.concluido_em) {
      doc.text(new Date(p.concluido_em).toLocaleString("pt-BR") + (p.concluido_por ? ` · ${p.concluido_por}` : ""), WIDTH - MARGIN, y, { align: "right" });
    }
    doc.setTextColor(0, 0, 0);
    y += 5;
    if (p.hint) {
      doc.setFontSize(8);
      doc.setTextColor(120, 120, 120);
      const lines = doc.splitTextToSize(p.hint, CONTENT_W - 6);
      doc.text(lines, MARGIN + 6, y);
      y += lines.length * 3.5 + 2;
      doc.setFontSize(9);
      doc.setTextColor(0, 0, 0);
    }
  }

  // Observações
  if (oc.observacoes) {
    y = pageBreakIfNeeded(doc, y + 4);
    y = setH2(doc, "Observações", y);
    doc.setFontSize(9);
    const lines = doc.splitTextToSize(oc.observacoes, CONTENT_W);
    doc.text(lines, MARGIN, y);
    y += lines.length * 4 + 4;
  }

  // Rodapé
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150, 150, 150);
    doc.text(
      `Gerado em ${new Date().toLocaleString("pt-BR")} · terraroxa · OC ${oc.numero}`,
      MARGIN,
      295,
    );
    doc.text(`Página ${i} / ${totalPages}`, WIDTH - MARGIN, 295, { align: "right" });
  }

  const filename = `OC_${oc.numero}.pdf`;
  doc.save(filename);
  return filename;
}
