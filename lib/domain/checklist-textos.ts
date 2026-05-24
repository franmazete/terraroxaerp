/* ════════════════════════════════════════════════════════════════════
 * B19.9 — Textos contextuais e estado UX do checklist por portal.
 *
 * O ChecklistOC é a mesma estrutura nos dois portais, mas o texto e
 * a cor mudam dependendo de "de quem é a vez". Este helper centraliza
 * essa lógica pra UI ficar consistente.
 *
 * Regras:
 *   - passo concluído → "Concluído"
 *   - passo pendente + setor é do meu portal → "Sua vez: ..."
 *   - passo pendente + setor é do outro portal → "Aguardando ..."
 *   - passo bloqueado → "Bloqueado (aguardando fase X)"
 *   - passo opcional + status pendente → "Opcional"
 * ════════════════════════════════════════════════════════════════════ */

import type { PassoStatus } from "./checklist";

export type EstadoUX = "minha_vez" | "aguardando_outro" | "concluido" | "bloqueado" | "opcional";

export interface ChecklistTexto {
  estado: EstadoUX;
  /** Mensagem principal exibida no card (ex: "Sua vez: anexar autorização"). */
  titulo: string;
  /** Cor sugerida pra UI: 'verde' concluído, 'azul' minha_vez, 'amarelo' aguardando, 'cinza' bloqueado/opcional. */
  cor: "verde" | "azul" | "amarelo" | "cinza";
  /** Ícone curto pra exibir antes do título. */
  icone: string;
}

/** Nome amigável de cada setor — usado em "Aguardando <X>". */
const SETOR_NOME: Record<PassoStatus["setor"], string> = {
  transportadora: "transportadora",
  logistica: "cerealista (logística)",
  fiscal: "cerealista (fiscal)",
  financeiro: "cerealista (financeiro)",
  sistema: "sistema",
};

/**
 * Verbo curto da ação esperada de cada passo. Usado em "Sua vez: <verbo>"
 * e em "Aguardando <setor> <verbo>".
 */
const PASSO_VERBO: Record<string, string> = {
  autorizacao_carregamento: "anexar autorização de carregamento",
  ticket_carregamento: "informar peso e anexar ticket",
  laudo_classificacao: "anexar laudo de classificação",
  nf_venda: "anexar nota fiscal",
  anexo_agendamento: "anexar agendamento",
  cte_emissao: "anexar CT-e",
  comprovante_descarga: "anexar comprovante de descarga",
  aviso_refugo: "anexar aviso de refugo",
  confirmacao_refugo: "confirmar refugo",
  cte_retorno: "anexar CT-e de retorno",
  estadia: "registrar estadia",
  calc_quebra: "calcular quebra",
  validacao_fiscal: "validar documentos fiscais",
  fatura_ctes: "anexar fatura",
  conferencia_fiscal: "conferir fatura",
  envio_financeiro: "enviar para financeiro",
  pagamento: "registrar pagamento",
};

/** True se o setor responsável é do portal do usuário logado. */
function ehMeuSetor(passo: PassoStatus, ehTransp: boolean): boolean {
  if (passo.setor === "sistema") return false;
  if (ehTransp) return passo.setor === "transportadora";
  // Cerealista: qualquer setor não-transp é "meu" do ponto de vista do portal
  return passo.setor !== "transportadora";
}

/**
 * Calcula estado UX + texto contextual de um passo, do ponto de vista
 * do usuário logado.
 *
 * @param ehTransp true = portal transportadora, false = portal cerealista
 */
export function textoChecklist(passo: PassoStatus, ehTransp: boolean): ChecklistTexto {
  const verbo = PASSO_VERBO[passo.passo] ?? passo.label.toLowerCase();
  const meuSetor = ehMeuSetor(passo, ehTransp);

  // Concluído tem prioridade sobre tudo
  if (passo.status === "concluido") {
    const quando = passo.concluido_em
      ? ` — ${new Date(passo.concluido_em).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`
      : "";
    const quem = passo.concluido_por ? ` por ${passo.concluido_por}` : "";
    return {
      estado: "concluido",
      titulo: `${passo.label} concluído${quem}${quando}`,
      cor: "verde",
      icone: "✓",
    };
  }

  if (passo.status === "rejeitado") {
    return {
      estado: "bloqueado",
      titulo: `${passo.label} rejeitado — refazer`,
      cor: "cinza",
      icone: "✗",
    };
  }

  if (passo.status === "bloqueado") {
    return {
      estado: "bloqueado",
      titulo: `Bloqueado — aguardando fase anterior · ${passo.label}`,
      cor: "cinza",
      icone: "🔒",
    };
  }

  // pendente
  if (passo.opcional) {
    return {
      estado: "opcional",
      titulo: meuSetor
        ? `Opcional: ${verbo} (se houver)`
        : `${passo.label} (opcional, aguardando ${SETOR_NOME[passo.setor]})`,
      cor: "cinza",
      icone: "○",
    };
  }

  if (meuSetor) {
    return {
      estado: "minha_vez",
      titulo: `Sua vez: ${verbo}`,
      cor: "azul",
      icone: "▶",
    };
  }

  return {
    estado: "aguardando_outro",
    titulo: `Aguardando ${SETOR_NOME[passo.setor]} ${verbo}`,
    cor: "amarelo",
    icone: "⏳",
  };
}

/** Conta passos por estado pra usar nos cards do dashboard. */
export function contarPorEstado(passos: PassoStatus[], ehTransp: boolean) {
  let minhaVez = 0;
  let aguardandoOutro = 0;
  let bloqueado = 0;
  let opcional = 0;
  let concluido = 0;
  for (const p of passos) {
    const t = textoChecklist(p, ehTransp);
    if (t.estado === "minha_vez") minhaVez++;
    else if (t.estado === "aguardando_outro") aguardandoOutro++;
    else if (t.estado === "bloqueado") bloqueado++;
    else if (t.estado === "opcional") opcional++;
    else if (t.estado === "concluido") concluido++;
  }
  return { minhaVez, aguardandoOutro, bloqueado, opcional, concluido };
}

/**
 * Devolve o próximo passo "minha vez" (não bloqueado, não concluído) — ou
 * undefined se não tem nenhum.
 */
export function proximoMeuPasso(passos: PassoStatus[], ehTransp: boolean): PassoStatus | undefined {
  return passos.find((p) => {
    if (p.status !== "pendente") return false;
    if (p.opcional) return false;
    return ehMeuSetor(p, ehTransp);
  });
}
