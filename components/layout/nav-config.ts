import type { Acao, Modulo, Perfil } from "@/lib/types";

export interface NavItem {
  href: string;
  label: string;
  /** Permissão mínima exigida — se nula, qualquer usuário logado vê. */
  requires?: { modulo: Modulo; acao: Acao };
  /** Restringir a perfis específicos (sobrepõe `requires`). */
  perfis?: Perfil[];
}

export interface NavSection {
  id: string;
  label: string;
  /** "inline" mostra os items lado-a-lado na topbar; "dropdown" agrupa num menu. */
  variant: "inline" | "dropdown";
  items: NavItem[];
}

/* ────────── Navegação Cerealista ────────── */
export const NAV_CEREALISTA: NavSection[] = [
  {
    id: "operacao",
    label: "Operação",
    variant: "inline",
    items: [
      { href: "/dashboard", label: "Dashboard", requires: { modulo: "dashboard", acao: "visualizar" } },
      { href: "/contratos", label: "Contratos", requires: { modulo: "contratos", acao: "visualizar" } },
      { href: "/cargas", label: "Cargas", requires: { modulo: "cargas", acao: "visualizar" } },
      { href: "/kanban", label: "Kanban", requires: { modulo: "reservas", acao: "visualizar" } },
      { href: "/reservas", label: "Reservas", requires: { modulo: "reservas", acao: "visualizar" } },
      { href: "/ordens", label: "Ordens", requires: { modulo: "ordens_carregamento", acao: "visualizar" } },
      { href: "/pendencias", label: "Pendências" },
      { href: "/relatorios", label: "Relatórios" },
      { href: "/historico", label: "Histórico", requires: { modulo: "historico", acao: "visualizar" } },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    variant: "dropdown",
    items: [
      { href: "/cadastros/transportadoras", label: "Transportadoras", requires: { modulo: "transportadoras", acao: "visualizar" } },
      { href: "/cadastros/motoristas", label: "Motoristas", requires: { modulo: "motoristas", acao: "visualizar" } },
      { href: "/cadastros/veiculos", label: "Veículos", requires: { modulo: "veiculos", acao: "visualizar" } },
      { href: "/cadastros/produtores", label: "Produtores", requires: { modulo: "produtores", acao: "visualizar" } },
      { href: "/cadastros/clientes", label: "Clientes", requires: { modulo: "clientes", acao: "visualizar" } },
      { href: "/cadastros/terminais", label: "Terminais", requires: { modulo: "terminais", acao: "visualizar" } },
      { href: "/cadastros/locais", label: "Locais", requires: { modulo: "locais", acao: "visualizar" } },
      { href: "/cadastros/produtos", label: "Produtos", requires: { modulo: "produtos", acao: "visualizar" } },
    ],
  },
  {
    id: "config",
    label: "Configurações",
    variant: "dropdown",
    items: [
      { href: "/configuracoes/usuarios", label: "Usuários", perfis: ["admin"] },
      { href: "/configuracoes/permissoes", label: "Permissões", perfis: ["admin"] },
    ],
  },
];

/* ────────── Navegação Transportadora ────────── */
export const NAV_TRANSPORTADORA: NavSection[] = [
  {
    id: "operacao",
    label: "Operação",
    variant: "inline",
    items: [
      { href: "/painel", label: "Painel" },
      { href: "/disponiveis", label: "Cargas Disponíveis" },
      { href: "/minhas-reservas", label: "Minhas Reservas" },
      { href: "/ordens", label: "Ordens de Carregamento", requires: { modulo: "ordens_carregamento", acao: "visualizar" } },
      { href: "/pendencias", label: "Pendências" },
    ],
  },
  {
    id: "cadastros",
    label: "Cadastros",
    variant: "dropdown",
    items: [
      { href: "/cadastros/motoristas", label: "Meus Motoristas", requires: { modulo: "motoristas", acao: "visualizar" } },
      { href: "/cadastros/veiculos", label: "Meus Veículos", requires: { modulo: "veiculos", acao: "visualizar" } },
    ],
  },
];
