import type {
  Carga,
  Cliente,
  Contrato,
  CTE,
  HistoricoEvento,
  Local,
  Motorista,
  NotaFiscal,
  OrdemCarregamento,
  Produto,
  Produtor,
  Romaneio,
  Terminal,
  Transportadora,
  Usuario,
  Veiculo,
} from "./types";

/* ════════════════════════════════════════════════════════════════════
 * Seeds da Etapa 1.5 — todos os números em KG.
 * Cadastros base populados; arrays operacionais ZERADOS para testes
 * limpos do Bloco I (2026-05-20).
 * ════════════════════════════════════════════════════════════════════ */

/* ─────────── USUÁRIOS ─────────── */

export const usuariosMock: Usuario[] = [
  { id: "USR-001", email: "carlos@terraroxa.com.br", nome: "Carlos Admin", perfil: "admin", ativo: true, criado_em: "2026-01-10" },
  { id: "USR-002", email: "ana@terraroxa.com.br", nome: "Ana Logística", perfil: "logistica", ativo: true, criado_em: "2026-01-15" },
  { id: "USR-003", email: "marina@terraroxa.com.br", nome: "Marina Fiscal", perfil: "fiscal", ativo: true, criado_em: "2026-02-01" },
  { id: "USR-004", email: "rodrigo@terraroxa.com.br", nome: "Rodrigo Financeiro", perfil: "financeiro", ativo: true, criado_em: "2026-02-01" },
  { id: "USR-005", email: "joao@cerrado.com.br", nome: "João Cerrado", perfil: "transportadora", transp_id: "TR-001", ativo: true, criado_em: "2026-02-10" },
  { id: "USR-006", email: "paulo@ranchofundo.com.br", nome: "Paulo Rancho", perfil: "transportadora", transp_id: "TR-002", ativo: true, criado_em: "2026-02-12" },
];

/* ─────────── PRODUTOS ─────────── */

export const produtosMock: Produto[] = [
  { id: "PRD-001", nome: "Soja", descricao: "Soja em grão — exportação" },
  { id: "PRD-002", nome: "Milho", descricao: "Milho em grão" },
  { id: "PRD-003", nome: "Sorgo" },
  { id: "PRD-004", nome: "Soja Semente", descricao: "Carga especial — semente certificada" },
];

/* ─────────── PRODUTORES ─────────── */

export const produtoresMock: Produtor[] = [
  { id: "PROD-001", nome: "Fazenda Boa Esperança", cpf_cnpj: "11.222.333/0001-44", cidade: "Primavera do Leste", uf: "MT", contato: "(65) 99100-1111", ativo: true },
  { id: "PROD-002", nome: "Agro Sorriso S/A", cpf_cnpj: "22.333.444/0001-55", cidade: "Sorriso", uf: "MT", contato: "(65) 99200-2222", ativo: true },
  { id: "PROD-003", nome: "Fazenda Três Irmãos", cpf_cnpj: "33.444.555/0001-66", cidade: "Lucas do Rio Verde", uf: "MT", contato: "(65) 99300-3333", ativo: true },
];

/* ─────────── CLIENTES ─────────── */

export const clientesMock: Cliente[] = [
  { id: "CLI-001", nome: "Exportadora Brasilminha", cpf_cnpj: "44.555.666/0001-77", cidade: "Santos", uf: "SP", contato: "(13) 3333-4444", ativo: true },
  { id: "CLI-002", nome: "Granol Agroindustrial", cpf_cnpj: "55.666.777/0001-88", cidade: "Paranaguá", uf: "PR", contato: "(41) 3333-5555", ativo: true },
  { id: "CLI-003", nome: "Sementes Selecta", cpf_cnpj: "66.777.888/0001-99", cidade: "Goiânia", uf: "GO", contato: "(62) 3333-6666", ativo: true },
];

/* ─────────── TERMINAIS ─────────── */

export const terminaisMock: Terminal[] = [
  { id: "TRM-001", nome: "Porto de Santos — Terminal Brasilminha", cnpj: "44.555.666/0002-58", cidade: "Santos", uf: "SP", contato: "(13) 3333-4444", tipo: "porto", ativo: true },
  { id: "TRM-002", nome: "Armazém Granol Paranaguá", cnpj: "55.666.777/0002-69", cidade: "Paranaguá", uf: "PR", contato: "(41) 3333-5555", tipo: "armazem", ativo: true },
  { id: "TRM-003", nome: "Selecta — Recebimento Sementes", cnpj: "66.777.888/0002-70", cidade: "Goiânia", uf: "GO", contato: "(62) 3333-6666", tipo: "cliente", ativo: true },
  { id: "TRM-004", nome: "Porto Paranaguá — Terminal 2", cnpj: "77.888.999/0001-11", cidade: "Paranaguá", uf: "PR", contato: "(41) 3333-7777", tipo: "porto", ativo: true },
];

/* ─────────── LOCAIS ─────────── */

export const locaisMock: Local[] = [
  { id: "LOC-001", nome: "Fazenda Boa Esperança", tipo: "fazenda", cidade: "Primavera do Leste", uf: "MT", vinculado_a: { entidade: "produtor", id: "PROD-001" }, latitude: -15.5586, longitude: -54.2978, contato_nome: "Carlos (gerente fazenda)", contato_whatsapp: "(65) 99100-1111" },
  { id: "LOC-002", nome: "Agro Sorriso — Silo Central", tipo: "armazem_origem", cidade: "Sorriso", uf: "MT", vinculado_a: { entidade: "produtor", id: "PROD-002" }, latitude: -12.5453, longitude: -55.7211 },
  { id: "LOC-003", nome: "Fazenda Três Irmãos", tipo: "fazenda", cidade: "Lucas do Rio Verde", uf: "MT", vinculado_a: { entidade: "produtor", id: "PROD-003" }, latitude: -13.0494, longitude: -55.9128 },
  { id: "LOC-004", nome: "Fazenda Rondonópolis Norte", tipo: "fazenda", cidade: "Rondonópolis", uf: "MT", latitude: -16.4706, longitude: -54.6358 },
  { id: "LOC-005", nome: "Porto de Santos", tipo: "porto", cidade: "Santos", uf: "SP", vinculado_a: { entidade: "terminal", id: "TRM-001" }, latitude: -23.9608, longitude: -46.3331, contato_nome: "Recebimento Terminal Brasilminha", contato_whatsapp: "(13) 3333-4444", contato_email: "recebimento@brasilminha.com.br" },
  { id: "LOC-006", nome: "Armazém Granol", tipo: "destino", cidade: "Paranaguá", uf: "PR", vinculado_a: { entidade: "terminal", id: "TRM-002" }, latitude: -25.5163, longitude: -48.5092, contato_nome: "Granol Paranaguá", contato_email: "operacoes@granol.com.br" },
  { id: "LOC-007", nome: "Sementes Selecta", tipo: "destino", cidade: "Goiânia", uf: "GO", vinculado_a: { entidade: "terminal", id: "TRM-003" }, latitude: -16.6864, longitude: -49.2643 },
  { id: "LOC-008", nome: "Porto Paranaguá", tipo: "porto", cidade: "Paranaguá", uf: "PR", vinculado_a: { entidade: "terminal", id: "TRM-004" }, latitude: -25.5085, longitude: -48.5189 },
];

/* ─────────── TRANSPORTADORAS ─────────── */

export const transportadorasMock: Transportadora[] = [
  {
    id: "TR-001",
    razao_social: "Transportes Cerrado Ltda",
    nome_fantasia: "Transportes Cerrado",
    cnpj_cpf: "12.345.678/0001-90",
    inscricao_estadual: "123456789",
    telefone: "(65) 99801-2345",
    email: "contato@cerrado.com.br",
    responsavel: "João Cerrado",
    endereco: { logradouro: "Av. Cerrado", numero: "100", cidade: "Cuiabá", uf: "MT" },
    status: "ativa",
    criada_em: "2025-08-10",
    nome: "Transportes Cerrado Ltda",
    contato: "(65) 99801-2345",
    cnpj: "12.345.678/0001-90",
  },
  {
    id: "TR-002",
    razao_social: "Rancho Fundo Transportes Ltda",
    nome_fantasia: "Rancho Fundo Trans.",
    cnpj_cpf: "23.456.789/0001-01",
    inscricao_estadual: "234567890",
    telefone: "(65) 99802-3456",
    email: "contato@ranchofundo.com.br",
    responsavel: "Paulo Rancho",
    status: "ativa",
    criada_em: "2025-09-15",
    nome: "Rancho Fundo Trans.",
    contato: "(65) 99802-3456",
    cnpj: "23.456.789/0001-01",
  },
  {
    id: "TR-003",
    razao_social: "LogGrão Express Ltda",
    nome_fantasia: "LogGrão Express",
    cnpj_cpf: "34.567.890/0001-12",
    telefone: "(65) 99803-4567",
    email: "contato@loggrao.com.br",
    responsavel: "Maria LogGrão",
    status: "ativa",
    criada_em: "2025-10-01",
    nome: "LogGrão Express",
    contato: "(65) 99803-4567",
    cnpj: "34.567.890/0001-12",
  },
  {
    id: "TR-004",
    razao_social: "Transportes Agro Norte Ltda",
    nome_fantasia: "Trans. Agro Norte",
    cnpj_cpf: "45.678.901/0001-23",
    telefone: "(65) 99804-5678",
    email: "contato@agronorte.com.br",
    responsavel: "Roberto Norte",
    status: "ativa",
    criada_em: "2025-11-20",
    nome: "Trans. Agro Norte",
    contato: "(65) 99804-5678",
    cnpj: "45.678.901/0001-23",
  },
  {
    id: "TR-005",
    razao_social: "Cerrado Logística Ltda",
    nome_fantasia: "Cerrado Log.",
    cnpj_cpf: "56.789.012/0001-34",
    telefone: "(65) 99805-6789",
    email: "contato@cerradolog.com.br",
    responsavel: "Ana Cerrado",
    status: "pendente",
    criada_em: "2026-03-01",
    nome: "Cerrado Log.",
    contato: "(65) 99805-6789",
    cnpj: "56.789.012/0001-34",
  },
];

/** Dicionário para lookup rápido (compat com Etapa 1). */
export const transportadorasDb: Record<string, Transportadora> = Object.fromEntries(
  transportadorasMock.map((t) => [t.id, t]),
);

/* ─────────── MOTORISTAS ─────────── */

export const motoristasMock: Motorista[] = [
  { id: "MOT-001", nome: "Marcos Pereira", cpf: "111.222.333-44", cnh: "12345678901", celular: "(65) 99100-1001", transp_ids: ["TR-001"], ativo: true, criado_em: "2025-09-01" },
  { id: "MOT-002", nome: "Carlos Nunes", cpf: "222.333.444-55", cnh: "23456789012", celular: "(65) 99100-1002", transp_ids: ["TR-001"], ativo: true, criado_em: "2025-10-15" },
  // José Andrade roda para 2 transportadoras (autônomo) — exemplo do caso N:N
  { id: "MOT-003", nome: "José Andrade", cpf: "333.444.555-66", cnh: "34567890123", celular: "(65) 99200-2001", transp_ids: ["TR-002", "TR-005"], ativo: true, criado_em: "2025-11-01" },
  { id: "MOT-004", nome: "Roberto Lima", cpf: "444.555.666-77", cnh: "45678901234", celular: "(65) 99300-3001", transp_ids: ["TR-003"], ativo: true, criado_em: "2025-12-10" },
  { id: "MOT-005", nome: "Antônio Ferreira", cpf: "555.666.777-88", cnh: "56789012345", celular: "(65) 99400-4001", transp_ids: ["TR-004"], ativo: true, criado_em: "2026-01-05" },
];

/* ─────────── VEÍCULOS ─────────── */

export const veiculosMock: Veiculo[] = [
  { id: "VEI-001", placa_cavalo: "ABX-1234", placa_carreta: "ZBC-5678", tipo: "Bitrem", capacidade_kg: 40000, transp_ids: ["TR-001"], ativo: true, criado_em: "2025-09-01" },
  { id: "VEI-002", placa_cavalo: "NOP-6789", placa_carreta: "YPQ-0123", tipo: "Rodotrem", capacidade_kg: 55000, transp_ids: ["TR-001"], ativo: true, criado_em: "2025-10-15" },
  { id: "VEI-003", placa_cavalo: "CDY-4567", tipo: "Truck", capacidade_kg: 23000, transp_ids: ["TR-002", "TR-005"], ativo: true, criado_em: "2025-11-01" },
  { id: "VEI-004", placa_cavalo: "EFG-7890", placa_carreta: "WHI-2345", tipo: "Bitrem", capacidade_kg: 40000, transp_ids: ["TR-003"], ativo: true, criado_em: "2025-12-10" },
  { id: "VEI-005", placa_cavalo: "HIJ-2345", placa_carreta: "VKL-6789", tipo: "Bitrem", capacidade_kg: 40000, transp_ids: ["TR-004"], ativo: true, criado_em: "2026-01-05" },
];

/* ────────────────────────────────────────────────────────────
 * 🧹 OPERAÇÃO ZERADA
 * Arrays operacionais vazios para testes em estado limpo.
 * Quando precisar de seeds operacionais, popule manualmente
 * cada array abaixo. Histórico antigo está no git.
 * ──────────────────────────────────────────────────────────── */

export const contratosMock: Contrato[] = [];
export const cargasMock: Carga[] = [];
export const ordensMock: OrdemCarregamento[] = [];
export const notasFiscaisMock: NotaFiscal[] = [];
export const ctesMock: CTE[] = [];
export const romaneiosMock: Romaneio[] = [];
export const historicoMock: HistoricoEvento[] = [];

/* ─────────── KANBAN COLS ─────────── */

export const kanbanCols: { id: import("./types").ReservaEtapa; label: string }[] = [
  { id: "reserva_pendente", label: "Reserva Pendente" },
  { id: "reserva_aprovada", label: "Reserva Aprovada" },
  { id: "aguard_docs", label: "Aguard. Autorização" },
  { id: "docs_ok", label: "Docs OK" },
  { id: "aguard_ordem", label: "Aguard. Ordem Carg." },
  { id: "ordem_emitida", label: "Ordem Emitida" },
  { id: "carregando", label: "Carregando" },
  { id: "em_transito", label: "Em Trânsito" },
  { id: "descarregado", label: "Descarregado" },
  { id: "finalizado", label: "Finalizado" },
];
