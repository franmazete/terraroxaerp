/* ════════════════════════════════════════════════════════════════════
 * BLOCO J.11 — IA conferindo Fatura × CT-e (regra simples mock)
 * Analisa 4 campos: valor_frete, transportadora, prestador, numero_cte.
 * Substituição por LLM/regra real virá na Etapa 3+.
 * ════════════════════════════════════════════════════════════════════ */

import type { CTE, Faturamento, IAAnaliseFatura, IAItemAnalise, Transportadora } from "../types";

export interface InputAnaliseIA {
  fatura: Faturamento;
  /** CT-es selecionados pela transp para esta fatura. */
  ctes: CTE[];
  transp?: Transportadora;
  /** Nome do prestador esperado (cerealista). */
  prestadorEsperado: string;
}

/** Tolerância de divergência de valor (R$). */
const TOLERANCIA_VALOR = 0.01;

/**
 * Analisa fatura vs CT-es e retorna IAAnaliseFatura.
 * NÃO grava no store — apenas calcula.
 */
export function analisarFaturaIA(input: InputAnaliseIA): Omit<IAAnaliseFatura, "id"> {
  const { fatura, ctes, transp, prestadorEsperado } = input;
  const itens: IAItemAnalise[] = [];

  // 1) Valor do frete: calculado vs informado
  const valorCalc = fatura.valor_calculado.toFixed(2);
  const valorInf = (fatura.valor_informado ?? 0).toFixed(2);
  const valorMatch =
    fatura.valor_informado != null &&
    Math.abs(fatura.valor_informado - fatura.valor_calculado) <= TOLERANCIA_VALOR;
  itens.push({
    campo: "valor_frete",
    esperado: `R$ ${valorCalc} (peso descarregado × frete/ton)`,
    encontrado: `R$ ${valorInf}`,
    match: valorMatch,
    observacao: valorMatch
      ? "Valor bate com o cálculo do sistema."
      : `Divergência de R$ ${(Math.abs((fatura.valor_informado ?? 0) - fatura.valor_calculado)).toFixed(2)}.`,
  });

  // 2) Transportadora: nome do CT-e (representado pela transp da OC)
  const transpNome = transp?.nome_fantasia ?? transp?.razao_social ?? "—";
  const transpMatch = ctes.length > 0 && !!transp;
  itens.push({
    campo: "transportadora",
    esperado: transpNome,
    encontrado: ctes.length > 0 ? transpNome : "Nenhum CT-e selecionado",
    match: transpMatch,
    observacao: transpMatch
      ? `${ctes.length} CT-e(s) emitido(s) por ${transpNome}.`
      : "Selecione ao menos um CT-e desta operação.",
  });

  // 3) Prestador (cerealista): no mock, presume-se que sempre seja o prestador esperado
  itens.push({
    campo: "prestador",
    esperado: prestadorEsperado,
    encontrado: prestadorEsperado,
    match: true,
    observacao: "Prestador único (cerealista) confirmado.",
  });

  // 4) Número CTE: compara o ctes_ids da fatura com os CT-es selecionados
  const numerosCte = ctes.map((c) => c.numero).join(", ") || "—";
  const numerosFaturaIds = fatura.ctes_ids ?? (fatura.cte_id ? [fatura.cte_id] : []);
  const todosOsIdsBatem = numerosFaturaIds.every((id) => ctes.some((c) => c.id === id));
  const numeroMatch = ctes.length > 0 && todosOsIdsBatem;
  itens.push({
    campo: "numero_cte",
    esperado: numerosFaturaIds.length > 0 ? numerosFaturaIds.join(", ") : "—",
    encontrado: numerosCte,
    match: numeroMatch,
    observacao: numeroMatch
      ? `${ctes.length} CT-e(s) vinculado(s).`
      : "Verifique a vinculação dos CT-es.",
  });

  const divergencias_count = itens.filter((i) => !i.match).length;
  const status: IAAnaliseFatura["status"] = divergencias_count === 0 ? "aprovada" : "divergencia";
  const resumo =
    divergencias_count === 0
      ? "✓ Todos os 4 campos batem. Fatura aprovada para conferência fiscal."
      : `⚠️ ${divergencias_count} de 4 campos com divergência — fiscal precisa revisar.`;

  return {
    fatura_id: fatura.id,
    oc_id: fatura.oc_id,
    status,
    itens,
    divergencias_count,
    resumo,
    analisada_em: new Date().toISOString(),
  };
}

/** Labels PT-BR dos campos analisados. */
export const CAMPO_LABEL: Record<IAItemAnalise["campo"], string> = {
  valor_frete: "Valor do frete",
  transportadora: "Transportadora",
  prestador: "Prestador",
  numero_cte: "Número do CT-e",
};
