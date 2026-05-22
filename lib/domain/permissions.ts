import type { Acao, Modulo, Perfil, Permissao, Role } from "../types";

/* ════════════════════════════════════════════════════════════════════
 * Matriz padrão de permissões (perfil × módulo × ação).
 * Esta é a base mockada da Etapa 1.5 — na Etapa 2 vira tabela no banco
 * com possibilidade de override por usuário.
 * ════════════════════════════════════════════════════════════════════ */

const TODAS_ACOES: Acao[] = [
  "visualizar",
  "criar",
  "editar",
  "excluir",
  "aprovar",
  "cancelar",
  "anexar_doc",
  "baixar_doc",
];

const TODOS_MODULOS: Modulo[] = [
  "dashboard",
  "usuarios",
  "transportadoras",
  "motoristas",
  "veiculos",
  "terminais",
  "locais",
  "produtores",
  "clientes",
  "produtos",
  "contratos",
  "cargas",
  "reservas",
  "ordens_carregamento",
  "notas_fiscais",
  "ctes",
  "romaneios",
  "historico",
];

/** Helper para gerar um conjunto de permissões. */
function grant(perfil: Perfil, modulos: Modulo[], acoes: Acao[]): Permissao[] {
  return modulos.flatMap((modulo) =>
    acoes.map((acao) => ({ perfil, modulo, acao, permitido: true })),
  );
}

/** Matriz padrão. Tudo que não estiver listado = negado. */
export const PERMISSOES_PADRAO: Permissao[] = [
  // Admin — tudo liberado
  ...grant("admin", TODOS_MODULOS, TODAS_ACOES),

  // Logística interna — operação completa, sem mexer em usuários
  ...grant(
    "logistica",
    [
      "dashboard",
      "transportadoras",
      "motoristas",
      "veiculos",
      "terminais",
      "locais",
      "produtores",
      "clientes",
      "produtos",
      "contratos",
      "cargas",
      "reservas",
      "ordens_carregamento",
      "historico",
    ],
    ["visualizar", "criar", "editar", "aprovar", "cancelar", "anexar_doc", "baixar_doc"],
  ),

  // Fiscal — NF, CTE, Romaneio + visualização de contratos/OCs
  ...grant("fiscal", ["notas_fiscais", "ctes", "romaneios"], TODAS_ACOES),
  ...grant("fiscal", ["contratos", "cargas", "reservas", "ordens_carregamento", "historico", "dashboard"], [
    "visualizar",
    "baixar_doc",
  ]),

  // Financeiro — visualiza tudo do operacional, sem editar
  ...grant(
    "financeiro",
    ["dashboard", "contratos", "cargas", "reservas", "ordens_carregamento", "notas_fiscais", "ctes", "historico"],
    ["visualizar", "baixar_doc"],
  ),

  // Transportadora — vê cargas disponíveis, gerencia próprios motoristas/veículos, reserva
  ...grant("transportadora", ["dashboard", "cargas"], ["visualizar"]),
  ...grant("transportadora", ["motoristas", "veiculos"], ["visualizar", "criar", "editar", "anexar_doc"]),
  ...grant("transportadora", ["reservas"], ["visualizar", "criar", "cancelar"]),
  ...grant("transportadora", ["ordens_carregamento"], ["visualizar", "baixar_doc"]),

  // Motorista — vê só sua própria OC ativa
  ...grant("motorista", ["ordens_carregamento"], ["visualizar"]),

  // Cliente/Terminal — vê OCs que chegam a ele
  ...grant("cliente", ["ordens_carregamento", "romaneios"], ["visualizar", "baixar_doc"]),
];

/** Resolve se um perfil pode executar uma ação em um módulo. */
export function podeExecutar(perfil: Perfil, modulo: Modulo, acao: Acao, overrides: Permissao[] = []): boolean {
  // Override específico de usuário tem prioridade
  const override = overrides.find((p) => p.perfil === perfil && p.modulo === modulo && p.acao === acao);
  if (override) return override.permitido;
  // Senão consulta matriz padrão
  return PERMISSOES_PADRAO.some(
    (p) => p.perfil === perfil && p.modulo === modulo && p.acao === acao && p.permitido,
  );
}

/** Mapa Role legacy → Perfil para login mockado. */
export function perfilFromRole(role: Role): Perfil {
  return role === "cerealista" ? "logistica" : "transportadora";
}

/** Mapa Perfil → Role legacy (para roteamento). */
export function roleFromPerfil(perfil: Perfil): Role {
  return perfil === "transportadora" || perfil === "motorista" ? "transportadora" : "cerealista";
}

/* ─────────── Sigilo comercial ─────────── */

/** Campos sigilosos da Carga que NUNCA devem aparecer para transportadora/motorista. */
const CAMPOS_SIGILOSOS: (keyof import("../types").Carga)[] = ["contrato_interno", "contrato_id"];

export function viewCarga<C extends import("../types").Carga>(carga: C, perfil: Perfil): C {
  if (perfil === "transportadora" || perfil === "motorista" || perfil === "cliente") {
    const sanitized: Partial<C> = { ...carga };
    for (const f of CAMPOS_SIGILOSOS) delete (sanitized as Record<string, unknown>)[f as string];
    return sanitized as C;
  }
  return carga;
}

/* ─────────── Atalhos legacy (Etapa 1) ─────────── */

export function podePublicarCarga(role: Role): boolean {
  return role === "cerealista";
}
export function podeAprovarReserva(role: Role): boolean {
  return role === "cerealista";
}
export function podeCriarReserva(role: Role): boolean {
  return role === "transportadora";
}
