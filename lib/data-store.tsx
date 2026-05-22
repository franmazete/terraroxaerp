"use client";

/**
 * Store em memória — Etapa 1.5 (sem backend ainda).
 * Centraliza TODAS as entidades para todas as páginas reagirem juntas.
 * Será substituído por queries ao Supabase na Etapa 4.
 */
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import {
  cargasMock,
  clientesMock,
  contratosMock,
  ctesMock,
  historicoMock,
  locaisMock,
  motoristasMock,
  notasFiscaisMock,
  ordensMock,
  produtoresMock,
  produtosMock,
  romaneiosMock,
  terminaisMock,
  transportadorasMock,
  usuariosMock,
  veiculosMock,
} from "./mock-data";
import { recalcCargaStatus } from "./domain/carga-status";
import { criarPendencia as builderPendencia } from "./domain/sla";
import { analisarFaturaIA } from "./domain/ia-fatura";
import type {
  AnexoAgendamento,
  AutorizacaoCarregamento,
  AvisoRefugo,
  Carga,
  Cliente,
  Contrato,
  CTE,
  CteRetorno,
  DadosDescarga,
  DocumentoOperacao,
  Estadia,
  Faturamento,
  HistoricoEvento,
  IAAnaliseFatura,
  LaudoClassificacao,
  Pagamento,
  Pendencia,
  Quebra,
  SolicitacaoTrocaNota,
  Local,
  Motorista,
  NotaFiscal,
  OrdemCarregamento,
  Produto,
  Produtor,
  Reserva,
  ReservaEtapa,
  Romaneio,
  Terminal,
  TicketCarregamento,
  Transportadora,
  Usuario,
  Veiculo,
} from "./types";

interface DataStoreValue {
  // Operação
  cargas: Carga[];
  contratos: Contrato[];
  ordens: OrdemCarregamento[];
  historico: HistoricoEvento[];
  notasFiscais: NotaFiscal[];
  ctes: CTE[];
  romaneios: Romaneio[];

  // Cadastros
  usuarios: Usuario[];
  transportadoras: Transportadora[];
  motoristas: Motorista[];
  veiculos: Veiculo[];
  produtores: Produtor[];
  clientes: Cliente[];
  terminais: Terminal[];
  locais: Local[];
  produtos: Produto[];

  // Mutations — Cargas / Reservas
  publicarCarga: (input: Omit<Carga, "id" | "reservado_kg" | "status" | "publicada_em" | "reservas">) => Carga;
  criarReserva: (cargaId: string, reserva: Omit<Reserva, "id" | "status" | "data" | "etapa">) => Reserva | null;
  aprovarReserva: (cargaId: string, reservaId: string, aprovador: string) => void;
  reprovarReserva: (cargaId: string, reservaId: string, aprovador: string) => void;
  moverEtapa: (cargaId: string, reservaId: string, etapa: ReservaEtapa) => void;

  // Mutations — Contratos
  publicarContrato: (input: Omit<Contrato, "id" | "saldo_kg" | "criado_em" | "disponivel" | "numero">) => Contrato;
  disponibilizarContrato: (id: string, ator: string) => void;
  atualizarContrato: (id: string, patch: Partial<Contrato>) => void;

  // Mutations — Ordens de Carregamento
  emitirOrdem: (input: Omit<OrdemCarregamento, "id" | "numero" | "emitida_em" | "status">) => OrdemCarregamento;
  atualizarStatusOrdem: (id: string, status: OrdemCarregamento["status"]) => void;
  /** Cancela uma OC com motivo obrigatório — registra no histórico + resolve pendências da OC. */
  cancelarOrdem: (id: string, motivo: string, user: { id: string; nome: string }) => void;
  /** Bloco L — Fiscal valida a NF anexada. Atualiza status_fiscal → nf_validada. */
  validarNotaFiscal: (ocId: string, user: { id: string; nome: string }, observacao?: string) => void;
  anexarNotaFiscal: (ocId: string, nf: Omit<NotaFiscal, "id" | "oc_id">) => NotaFiscal;
  anexarCTE: (ocId: string, cte: Omit<CTE, "id" | "oc_id">) => CTE;
  anexarRomaneio: (ocId: string, ro: Omit<Romaneio, "id" | "oc_id">) => Romaneio;

  // Bloco I — Autorização de Carregamento (gate antes da OC)
  autorizacoesCarregamento: AutorizacaoCarregamento[];
  anexarAutorizacaoCarregamento: (
    input: Omit<AutorizacaoCarregamento, "id" | "anexada_em">,
  ) => { autorizacao: AutorizacaoCarregamento; oc: OrdemCarregamento } | null;

  // Bloco I — Dados de Descarga (porto/destino) + validação fiscal
  dadosDescarga: DadosDescarga[];
  registrarDescarga: (
    input: Omit<DadosDescarga, "id" | "descarregado_em" | "validado_em" | "validado_por_user_id" | "rejeitado_em" | "rejeitado_por_user_id" | "motivo_rejeicao">,
  ) => DadosDescarga;
  validarDescarga: (descargaId: string, userId: string, userNome: string) => void;
  rejeitarDescarga: (descargaId: string, userId: string, userNome: string, motivo: string) => void;

  // Bloco I — Faturamento (cálculo automático + cruzamento + pagamento)
  faturamentos: Faturamento[];
  pagamentos: Pagamento[];
  /** Fiscal libera faturamento — sistema gera registro com valor_calculado. */
  liberarFaturamento: (ocId: string, userId: string, userNome: string) => Faturamento | null;
  /** Transportadora confere valor e anexa fatura (+ CTE opcional). */
  anexarFatura: (
    faturamentoId: string,
    input: {
      valor_informado: number;
      justificativa?: string;
      fatura_url: string;
      cte_id?: string;
      /** Bloco J — múltiplos CT-es agrupados na fatura. */
      ctes_ids?: string[];
      numero_fatura?: string;
    },
    userNome: string,
  ) => IAAnaliseFatura | null;
  /** Bloco J — Fiscal confere o resultado da IA e libera para o financeiro. */
  conferirFaturaFiscal: (
    faturamentoId: string,
    observacao: string | undefined,
    user: { id: string; nome: string },
  ) => void;
  /** Financeiro registra pagamento e finaliza OC. */
  confirmarPagamento: (
    faturamentoId: string,
    input: { valor_pago: number; comprovante_url?: string; observacoes?: string },
    userId: string,
    userNome: string,
  ) => Pagamento | null;

  // Bloco I — Pendências com SLA
  pendencias: Pendencia[];
  criarPendencia: (input: Omit<Pendencia, "id">) => Pendencia;
  resolverPendencia: (id: string, userId: string, userNome: string) => void;

  // Bloco I — Troca de NF (workflow auditável)
  solicitacoesTrocaNota: SolicitacaoTrocaNota[];
  solicitarTrocaNota: (
    input: Omit<SolicitacaoTrocaNota, "id" | "solicitada_em" | "status" | "decidida_em" | "decidida_por_user_id" | "nova_nf_id" | "observacao_fiscal">,
  ) => SolicitacaoTrocaNota;
  decidirTrocaNota: (
    solicitacaoId: string,
    decisao: "aprovada" | "rejeitada",
    decididoPorUserId: string,
    decididoPorNome: string,
    observacao?: string,
  ) => void;
  /** Aprovada a troca: anexa nova NF e marca antiga como substituida. */
  anexarNovaNFSubstituta: (
    solicitacaoId: string,
    novaNF: Omit<NotaFiscal, "id" | "oc_id" | "status" | "substitui_nf_id">,
    userId: string,
  ) => NotaFiscal | null;

  // Bloco J — Gating sequencial (anexos por passo)
  ticketsCarregamento: TicketCarregamento[];
  laudosClassificacao: LaudoClassificacao[];
  anexosAgendamento: AnexoAgendamento[];
  avisosRefugo: AvisoRefugo[];
  ctesRetorno: CteRetorno[];
  estadias: Estadia[];
  quebras: Quebra[];
  iaAnalisesFatura: IAAnaliseFatura[];
  /** Passo 2 — transp anexa ticket de carregamento + peso líquido. */
  anexarTicketCarregamento: (
    input: Omit<TicketCarregamento, "id" | "carregado_em" | "peso_liquido_kg">,
  ) => TicketCarregamento;
  /** Passo 3 (opcional) — transp anexa laudo de classificação. */
  anexarLaudoClassificacao: (
    input: Omit<LaudoClassificacao, "id" | "anexado_em">,
  ) => LaudoClassificacao;
  /** Passo 5 — cerealista anexa comprovante de agendamento no destino. */
  anexarAnexoAgendamento: (
    input: Omit<AnexoAgendamento, "id" | "anexado_em">,
  ) => AnexoAgendamento;
  /** Bloco J — Refugo: transp avisa que a carga foi refugada (passo 7a). */
  criarAvisoRefugo: (
    input: Omit<AvisoRefugo, "id" | "avisado_em" | "status" | "decidido_em" | "decidido_por_user_id" | "decidido_por_nome" | "observacao_cerealista">,
  ) => AvisoRefugo;
  /** Bloco J — Refugo: cerealista confirma ou rejeita o aviso (passo 7b). */
  decidirAvisoRefugo: (
    avisoId: string,
    decisao: "confirmado" | "rejeitado",
    user: { id: string; nome: string },
    observacao?: string,
  ) => void;
  /** Bloco J — Refugo: transp anexa CT-e de retorno (passo 8). */
  anexarCteRetorno: (
    input: Omit<CteRetorno, "id" | "anexado_em">,
  ) => CteRetorno;
  /** Bloco J — Refugo: transp anexa estadia (passo 9 opcional). */
  anexarEstadia: (
    input: Omit<Estadia, "id" | "anexada_em">,
  ) => Estadia;
  /** Bloco J — Fiscal calcula quebra (passo 10). Limite default 0,5%. */
  calcularQuebraOC: (
    input: {
      oc_id: string;
      peso_carregado_kg: number;
      peso_descarregado_kg: number;
      justificativa_transp?: string;
      observacao_fiscal?: string;
      user: { id: string; nome: string };
    },
  ) => Quebra | null;

  // Bloco I — Central Documental unificada da OC
  documentosOperacao: DocumentoOperacao[];
  anexarDocumento: (
    input: Omit<DocumentoOperacao, "id" | "versao" | "status" | "enviado_em" | "ativo"> & { versao_anterior_id?: string },
  ) => DocumentoOperacao;
  aprovarDocumento: (id: string, decididoPorUserId: string, observacao?: string) => void;
  rejeitarDocumento: (id: string, decididoPorUserId: string, observacao: string) => void;
  substituirDocumento: (
    docAnteriorId: string,
    novoArquivo: { arquivo_url: string; nome_original: string; enviado_por_user_id: string; enviado_por_nome: string; mime_type?: string; tamanho_bytes?: number },
  ) => DocumentoOperacao | null;

  // Mutations — Cadastros (CRUD genéricos)
  addTransportadora: (t: Omit<Transportadora, "id" | "criada_em">) => Transportadora;
  updateTransportadora: (id: string, patch: Partial<Transportadora>) => void;
  addMotorista: (m: Omit<Motorista, "id" | "criado_em">) => Motorista;
  updateMotorista: (id: string, patch: Partial<Motorista>) => void;
  /** Vincula uma transportadora a um motorista existente (caso já cadastrado por outra). */
  vincularTranspAoMotorista: (motoristaId: string, transpId: string) => void;
  /** Vincula uma transportadora a um veículo existente. */
  vincularTranspAoVeiculo: (veiculoId: string, transpId: string) => void;
  addVeiculo: (v: Omit<Veiculo, "id" | "criado_em">) => Veiculo;
  updateVeiculo: (id: string, patch: Partial<Veiculo>) => void;
  addProdutor: (p: Omit<Produtor, "id">) => Produtor;
  updateProdutor: (id: string, patch: Partial<Produtor>) => void;
  addCliente: (c: Omit<Cliente, "id">) => Cliente;
  updateCliente: (id: string, patch: Partial<Cliente>) => void;
  addTerminal: (t: Omit<Terminal, "id">) => Terminal;
  updateTerminal: (id: string, patch: Partial<Terminal>) => void;
  addLocal: (l: Omit<Local, "id">) => Local;
  updateLocal: (id: string, patch: Partial<Local>) => void;
  addUsuario: (u: Omit<Usuario, "id" | "criado_em">) => Usuario;
  updateUsuario: (id: string, patch: Partial<Usuario>) => void;
}

const DataStore = createContext<DataStoreValue | null>(null);

function nextId(prefix: string, existing: { id: string }[]): string {
  const nums = existing
    .map((x) => x.id.replace(prefix, ""))
    .map((n) => parseInt(n, 10))
    .filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return prefix + String(max + 1).padStart(3, "0");
}

export function DataStoreProvider({ children }: { children: ReactNode }) {
  const [cargas, setCargas] = useState<Carga[]>(cargasMock);
  const [contratos, setContratos] = useState<Contrato[]>(contratosMock);
  const [ordens, setOrdens] = useState<OrdemCarregamento[]>(ordensMock);
  const [historico, setHistorico] = useState<HistoricoEvento[]>(historicoMock);
  const [notasFiscais, setNotasFiscais] = useState<NotaFiscal[]>(notasFiscaisMock);
  const [ctes, setCtes] = useState<CTE[]>(ctesMock);
  const [romaneios, setRomaneios] = useState<Romaneio[]>(romaneiosMock);
  const [autorizacoesCarregamento, setAutorizacoesCarregamento] = useState<AutorizacaoCarregamento[]>([]);
  // Bloco J — Gating sequencial
  const [ticketsCarregamento, setTicketsCarregamento] = useState<TicketCarregamento[]>([]);
  const [laudosClassificacao, setLaudosClassificacao] = useState<LaudoClassificacao[]>([]);
  const [anexosAgendamento, setAnexosAgendamento] = useState<AnexoAgendamento[]>([]);
  const [avisosRefugo, setAvisosRefugo] = useState<AvisoRefugo[]>([]);
  const [ctesRetorno, setCtesRetorno] = useState<CteRetorno[]>([]);
  const [estadias, setEstadias] = useState<Estadia[]>([]);
  const [quebras, setQuebras] = useState<Quebra[]>([]);
  const [iaAnalisesFatura, setIaAnalisesFatura] = useState<IAAnaliseFatura[]>([]);
  const [documentosOperacao, setDocumentosOperacao] = useState<DocumentoOperacao[]>([]);
  const [solicitacoesTrocaNota, setSolicitacoesTrocaNota] = useState<SolicitacaoTrocaNota[]>([]);
  const [dadosDescarga, setDadosDescarga] = useState<DadosDescarga[]>([]);
  const [faturamentos, setFaturamentos] = useState<Faturamento[]>([]);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [pendencias, setPendencias] = useState<Pendencia[]>([]);

  const [usuarios, setUsuarios] = useState<Usuario[]>(usuariosMock);
  const [transportadoras, setTransportadoras] = useState<Transportadora[]>(transportadorasMock);
  const [motoristas, setMotoristas] = useState<Motorista[]>(motoristasMock);
  const [veiculos, setVeiculos] = useState<Veiculo[]>(veiculosMock);
  const [produtores, setProdutores] = useState<Produtor[]>(produtoresMock);
  const [clientes, setClientes] = useState<Cliente[]>(clientesMock);
  const [terminais, setTerminais] = useState<Terminal[]>(terminaisMock);
  const [locais, setLocais] = useState<Local[]>(locaisMock);
  const [produtos] = useState<Produto[]>(produtosMock);

  function addHist(quem: string, oQue: string, tipo: HistoricoEvento["tipo"] = "g") {
    setHistorico((h) => [{ quando: new Date().toLocaleString("pt-BR"), quem, o_que: oQue, tipo }, ...h]);
  }

  const value = useMemo<DataStoreValue>(
    () => ({
      cargas,
      contratos,
      ordens,
      historico,
      notasFiscais,
      ctes,
      romaneios,
      autorizacoesCarregamento,
      ticketsCarregamento,
      laudosClassificacao,
      anexosAgendamento,
      avisosRefugo,
      ctesRetorno,
      estadias,
      quebras,
      iaAnalisesFatura,
      documentosOperacao,
      solicitacoesTrocaNota,
      dadosDescarga,
      faturamentos,
      pagamentos,
      pendencias,
      usuarios,
      transportadoras,
      motoristas,
      veiculos,
      produtores,
      clientes,
      terminais,
      locais,
      produtos,

      /* ─────────── Cargas / Reservas ─────────── */

      publicarCarga: (input) => {
        const id = nextId("CRG-", cargas);
        const nova: Carga = {
          ...input,
          id,
          reservado_kg: 0,
          status: "disponivel",
          publicada_em: new Date().toISOString().split("T")[0],
          reservas: [],
        };
        setCargas((cs) => [nova, ...cs]);
        // Desconta a quantidade do saldo do contrato
        setContratos((cts) =>
          cts.map((c) => (c.id === input.contrato_id ? { ...c, saldo_kg: Math.max(0, c.saldo_kg - input.total_kg) } : c)),
        );
        addHist("Logística Interna", `${id} publicada — ${input.total_kg.toLocaleString("pt-BR")} kg de ${input.produto} (contrato ${input.contrato_interno})`, "g");
        return nova;
      },

      criarReserva: (cargaId, reserva) => {
        let criada: Reserva | null = null;
        setCargas((cs) =>
          cs.map((c) => {
            if (c.id !== cargaId) return c;
            const allReservas = cs.flatMap((x) => x.reservas);
            const id = nextId("RES-", allReservas);
            const nova: Reserva = {
              ...reserva,
              id,
              status: "pendente",
              data: new Date().toISOString().split("T")[0],
              etapa: "reserva_pendente",
            };
            criada = nova;
            const novo: Carga = {
              ...c,
              reservas: [...c.reservas, nova],
              reservado_kg: c.reservado_kg + reserva.qtd_kg,
            };
            novo.status = recalcCargaStatus(novo);
            return novo;
          }),
        );
        if (criada) {
          const r = criada as Reserva;
          addHist(reserva.transp_nome, `${r.id} enviada — ${reserva.qtd_kg.toLocaleString("pt-BR")} kg · R$ ${reserva.frete_ton}/t — aguardando aprovação`, "b");
          // Cria pendência automática "aprovar reserva" para a logística
          const pendId = nextId("PEND-", pendencias);
          setPendencias((arr) => [{ id: pendId, ...builderPendencia({ reserva_id: r.id, categoria: "aprovar_reserva" }) }, ...arr]);
        }
        return criada;
      },

      aprovarReserva: (cargaId, reservaId, aprovador) => {
        // Bloco I: aprovação NÃO gera mais OC automaticamente.
        // A OC só é criada quando a transportadora anexa a Autorização de Carregamento.
        const c = cargas.find((x) => x.id === cargaId);
        const r = c?.reservas.find((x) => x.id === reservaId);
        setCargas((cs) =>
          cs.map((cc) =>
            cc.id !== cargaId
              ? cc
              : { ...cc, reservas: cc.reservas.map((x) => (x.id === reservaId ? { ...x, status: "aprovada", etapa: "aguard_docs" } : x)) },
          ),
        );
        if (r && c) {
          addHist(aprovador, `${reservaId} aprovada — ${r.transp_nome} aguardando anexar autorização de carregamento`, "g");
          // Resolve a pendência de "aprovar reserva" + cria nova "anexar autorização" para transp
          setPendencias((arr) => {
            const proxId = nextId("PEND-", arr);
            return arr
              .map((p) =>
                p.reserva_id === r.id && p.categoria === "aprovar_reserva" && p.status === "aberta"
                  ? { ...p, status: "resolvida" as const, resolvida_em: new Date().toISOString() }
                  : p,
              )
              .concat([
                {
                  id: proxId,
                  ...builderPendencia({
                    reserva_id: r.id,
                    transp_id: r.transp_id,
                    categoria: "anexar_autorizacao_carreg",
                  }),
                },
              ]);
          });
        }
      },

      reprovarReserva: (cargaId, reservaId, aprovador) => {
        const c = cargas.find((x) => x.id === cargaId);
        const r = c?.reservas.find((x) => x.id === reservaId);
        if (!c || !r) return;
        setCargas((cs) =>
          cs.map((cc) => {
            if (cc.id !== cargaId) return cc;
            const novo: Carga = {
              ...cc,
              reservas: cc.reservas.filter((x) => x.id !== reservaId),
              reservado_kg: cc.reservado_kg - r.qtd_kg,
            };
            novo.status = recalcCargaStatus(novo);
            return novo;
          }),
        );
        addHist(aprovador, `${reservaId} REPROVADA — ${r.transp_nome} · ${r.qtd_kg.toLocaleString("pt-BR")} kg devolvidas ao saldo`, "r");
      },

      moverEtapa: (cargaId, reservaId, etapa) => {
        setCargas((cs) =>
          cs.map((c) =>
            c.id !== cargaId
              ? c
              : { ...c, reservas: c.reservas.map((r) => (r.id === reservaId ? { ...r, etapa } : r)) },
          ),
        );
      },

      /* ─────────── Contratos ─────────── */

      publicarContrato: (input) => {
        const id = nextId("CT-", contratos);
        const numero = `CT-${new Date().getFullYear()}-${id.replace("CT-", "")}`;
        const novo: Contrato = {
          ...input,
          id,
          numero,
          saldo_kg: input.qtd_kg_total,
          disponivel: false, // nasce indisponível até o usuário liberar
          criado_em: new Date().toISOString().split("T")[0],
        };
        setContratos((cs) => [novo, ...cs]);
        const numeroExibido = input.numero_manual || numero;
        addHist(
          input.criado_por,
          `${numeroExibido} criado — ${input.qtd_kg_total.toLocaleString("pt-BR")} kg (aguardando disponibilização)`,
          "g",
        );
        return novo;
      },

      disponibilizarContrato: (id, ator) => {
        setContratos((cs) => cs.map((c) => (c.id === id ? { ...c, disponivel: true } : c)));
        const c = contratos.find((x) => x.id === id);
        if (c) {
          const numero = c.numero_manual || c.numero;
          addHist(ator, `${numero} disponibilizado para publicação de cargas`, "g");
        }
      },

      atualizarContrato: (id, patch) => {
        setContratos((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
      },

      /* ─────────── Ordens de Carregamento ─────────── */

      emitirOrdem: (input) => {
        const id = nextId("OC-", ordens);
        const numero = `OC-${new Date().getFullYear()}-${id.replace("OC-", "")}`;
        const nova: OrdemCarregamento = {
          ...input,
          id,
          numero,
          status: "emitida",
          emitida_em: new Date().toISOString().split("T")[0],
        };
        setOrdens((os) => [nova, ...os]);
        addHist(input.emitida_por, `${numero} emitida — ${input.peso_previsto_kg.toLocaleString("pt-BR")} kg`, "t");
        return nova;
      },

      atualizarStatusOrdem: (id, status) => {
        setOrdens((os) => os.map((o) => (o.id === id ? { ...o, status } : o)));
      },

      validarNotaFiscal: (ocId, userObj, observacao) => {
        const oc = ordens.find((o) => o.id === ocId);
        if (!oc || !oc.nota_fiscal_id) return;
        setOrdens((os) =>
          os.map((o) =>
            o.id === ocId
              ? { ...o, status_fiscal: "nf_validada" }
              : o,
          ),
        );
        addHist(
          userObj.nome,
          `NF da OC ${oc.numero} VALIDADA pelo fiscal${observacao ? ` — ${observacao}` : ""}`,
          "g",
        );
        // Resolve a pendência "validar_nf" se existir
        setPendencias((arr) =>
          arr.map((p) =>
            p.oc_id === ocId && p.categoria === "validar_nf" && p.status === "aberta"
              ? { ...p, status: "resolvida" as const, resolvida_em: new Date().toISOString() }
              : p,
          ),
        );
      },

      cancelarOrdem: (id, motivo, userObj) => {
        const oc = ordens.find((o) => o.id === id);
        if (!oc) return;
        setOrdens((os) =>
          os.map((o) =>
            o.id === id
              ? {
                  ...o,
                  status: "cancelada" as const,
                  observacoes: o.observacoes
                    ? `${o.observacoes}\n[CANCELADA] ${motivo}`
                    : `[CANCELADA] ${motivo}`,
                }
              : o,
          ),
        );
        // Resolve todas as pendências abertas dessa OC
        setPendencias((arr) =>
          arr.map((p) =>
            p.oc_id === id && p.status === "aberta"
              ? { ...p, status: "cancelada" as const, resolvida_em: new Date().toISOString() }
              : p,
          ),
        );
        addHist(
          userObj.nome,
          `OC ${oc.numero} CANCELADA — motivo: ${motivo}`,
          "r",
        );
      },

      anexarNotaFiscal: (ocId, nf) => {
        const id = nextId("NF-", notasFiscais);
        const nova: NotaFiscal = { ...nf, id, oc_id: ocId };
        setNotasFiscais((arr) => [nova, ...arr]);
        setOrdens((os) => os.map((o) => (o.id === ocId ? { ...o, nota_fiscal_id: id, status_fiscal: "nf_recebida" } : o)));
        addHist("Cerealista Logística", `NF ${nf.numero} anexada à ordem ${ocId}`, "t");
        // Bloco J: resolve "anexar_nf" + cria "anexar_agendamento" (logística)
        setPendencias((arr) => {
          const proxId = nextId("PEND-", arr);
          return arr
            .map((p) =>
              p.oc_id === ocId && p.categoria === "anexar_nf" && p.status === "aberta"
                ? { ...p, status: "resolvida" as const, resolvida_em: new Date().toISOString() }
                : p,
            )
            .concat([{ id: proxId, ...builderPendencia({ oc_id: ocId, categoria: "anexar_agendamento" }) }]);
        });
        return nova;
      },

      anexarCTE: (ocId, cte) => {
        const id = nextId("CTE-", ctes);
        const novo: CTE = { ...cte, id, oc_id: ocId };
        setCtes((arr) => [novo, ...arr]);
        // Bloco J: ao anexar CT-e, OC muda automaticamente para "em_transito"
        const ocAtual = ordens.find((o) => o.id === ocId);
        const transpId = ocAtual?.transp_id;
        setOrdens((os) =>
          os.map((o) =>
            o.id === ocId
              ? {
                  ...o,
                  cte_id: id,
                  status_operacional: "em_transito",
                  status_fiscal: "cte_recebido",
                }
              : o,
          ),
        );
        addHist("Transportadora", `CTE ${cte.numero} anexado à OC ${ocId} — status alterado para "em trânsito"`, "t");
        // Bloco J: resolve "anexar_cte" + cria "anexar_ticket_descarga" (transp)
        setPendencias((arr) => {
          const proxId = nextId("PEND-", arr);
          return arr
            .map((p) =>
              p.oc_id === ocId && p.categoria === "anexar_cte" && p.status === "aberta"
                ? { ...p, status: "resolvida" as const, resolvida_em: new Date().toISOString() }
                : p,
            )
            .concat([
              {
                id: proxId,
                ...builderPendencia({
                  oc_id: ocId,
                  transp_id: transpId,
                  categoria: "anexar_ticket_descarga",
                }),
              },
            ]);
        });
        return novo;
      },

      anexarRomaneio: (ocId, ro) => {
        const id = nextId("RO-", romaneios);
        const novo: Romaneio = { ...ro, id, oc_id: ocId };
        setRomaneios((arr) => [novo, ...arr]);
        setOrdens((os) => os.map((o) => (o.id === ocId ? { ...o, romaneio_id: id } : o)));
        addHist("Operação", `Romaneio ${ro.numero} anexado à ordem ${ocId} — peso líquido ${ro.peso_liquido_kg.toLocaleString("pt-BR")} kg`, "g");
        return novo;
      },

      /* ─────────── Bloco J — Passos sequenciais do fluxo TMS ─────────── */

      anexarTicketCarregamento: (input) => {
        const id = nextId("TKT-", ticketsCarregamento);
        const peso_liquido_kg = Math.max(0, input.peso_bruto_kg - input.peso_tara_kg);
        const novo: TicketCarregamento = {
          ...input,
          id,
          peso_liquido_kg,
          carregado_em: new Date().toISOString(),
        };
        setTicketsCarregamento((arr) => [novo, ...arr]);
        setOrdens((os) =>
          os.map((o) =>
            o.id === input.oc_id
              ? { ...o, ticket_carregamento_id: id, status_operacional: "carregando" }
              : o,
          ),
        );
        addHist(
          input.carregado_por_nome,
          `Ticket de carregamento anexado à OC ${input.oc_id} — peso líquido ${peso_liquido_kg.toLocaleString("pt-BR")} kg`,
          "t",
        );
        // Resolve "anexar_ticket_carreg" + cria "anexar_nf" (cerealista logística)
        setPendencias((arr) => {
          const proxId = nextId("PEND-", arr);
          return arr
            .map((p) =>
              p.oc_id === input.oc_id && p.categoria === "anexar_ticket_carreg" && p.status === "aberta"
                ? { ...p, status: "resolvida" as const, resolvida_em: new Date().toISOString() }
                : p,
            )
            .concat([{ id: proxId, ...builderPendencia({ oc_id: input.oc_id, categoria: "anexar_nf" }) }]);
        });
        return novo;
      },

      anexarLaudoClassificacao: (input) => {
        const id = nextId("LAU-", laudosClassificacao);
        const novo: LaudoClassificacao = {
          ...input,
          id,
          anexado_em: new Date().toISOString(),
        };
        setLaudosClassificacao((arr) => [novo, ...arr]);
        setOrdens((os) =>
          os.map((o) => (o.id === input.oc_id ? { ...o, laudo_classificacao_id: id } : o)),
        );
        addHist(
          input.anexado_por_nome,
          `Laudo de classificação anexado à OC ${input.oc_id} (opcional)`,
          "t",
        );
        // Laudo é opcional — não cria pendência nova, apenas vincula
        return novo;
      },

      anexarAnexoAgendamento: (input) => {
        const id = nextId("AGD-", anexosAgendamento);
        const novo: AnexoAgendamento = {
          ...input,
          id,
          anexado_em: new Date().toISOString(),
        };
        setAnexosAgendamento((arr) => [novo, ...arr]);
        const ocAtual = ordens.find((o) => o.id === input.oc_id);
        const transpId = ocAtual?.transp_id;
        setOrdens((os) =>
          os.map((o) => (o.id === input.oc_id ? { ...o, anexo_agendamento_id: id } : o)),
        );
        addHist(
          input.anexado_por_nome,
          `Comprovante de agendamento anexado à OC ${input.oc_id} — ${input.data_agendamento}`,
          "g",
        );
        // Resolve "anexar_agendamento" + cria "anexar_cte" (transp)
        setPendencias((arr) => {
          const proxId = nextId("PEND-", arr);
          return arr
            .map((p) =>
              p.oc_id === input.oc_id && p.categoria === "anexar_agendamento" && p.status === "aberta"
                ? { ...p, status: "resolvida" as const, resolvida_em: new Date().toISOString() }
                : p,
            )
            .concat([
              {
                id: proxId,
                ...builderPendencia({
                  oc_id: input.oc_id,
                  transp_id: transpId,
                  categoria: "anexar_cte",
                }),
              },
            ]);
        });
        return novo;
      },

      /* ─────────── Bloco J — Carga Refugada (fluxo alternativo) ─────────── */

      criarAvisoRefugo: (input) => {
        const id = nextId("REF-", avisosRefugo);
        const novo: AvisoRefugo = {
          ...input,
          id,
          status: "aguardando_confirmacao",
          avisado_em: new Date().toISOString(),
        };
        setAvisosRefugo((arr) => [novo, ...arr]);
        // Marca OC como refugada (visual) + vincula aviso
        setOrdens((os) =>
          os.map((o) => (o.id === input.oc_id ? { ...o, refugada: true, aviso_refugo_id: id } : o)),
        );
        addHist(
          input.avisado_por_nome,
          `⚠️ REFUGO informado pela transp na OC ${input.oc_id} — motivo: ${input.motivo} (aguardando confirmação da cerealista)`,
          "r",
        );
        // Cria pendência "confirmar_refugo" (logística)
        setPendencias((arr) => {
          const proxId = nextId("PEND-", arr);
          return [
            { id: proxId, ...builderPendencia({ oc_id: input.oc_id, categoria: "confirmar_refugo" }) },
            ...arr,
          ];
        });
        return novo;
      },

      decidirAvisoRefugo: (avisoId, decisao, userObj, observacao) => {
        const aviso = avisosRefugo.find((a) => a.id === avisoId);
        if (!aviso) return;
        setAvisosRefugo((arr) =>
          arr.map((a) =>
            a.id === avisoId
              ? {
                  ...a,
                  status: decisao,
                  decidido_em: new Date().toISOString(),
                  decidido_por_user_id: userObj.id,
                  decidido_por_nome: userObj.nome,
                  observacao_cerealista: observacao,
                }
              : a,
          ),
        );
        // Se rejeitado, desmarca refugada (volta ao fluxo normal)
        if (decisao === "rejeitado") {
          setOrdens((os) => os.map((o) => (o.id === aviso.oc_id ? { ...o, refugada: false } : o)));
          addHist(
            userObj.nome,
            `Refugo REJEITADO na OC ${aviso.oc_id}${observacao ? ` — ${observacao}` : ""}`,
            "g",
          );
          // Resolve a pendência confirmar_refugo (sem criar próxima — fluxo normal continua)
          setPendencias((arr) =>
            arr.map((p) =>
              p.oc_id === aviso.oc_id && p.categoria === "confirmar_refugo" && p.status === "aberta"
                ? { ...p, status: "resolvida" as const, resolvida_em: new Date().toISOString() }
                : p,
            ),
          );
        } else {
          // Confirmado → cria pendência "anexar_cte_retorno" (transp)
          addHist(
            userObj.nome,
            `Refugo CONFIRMADO na OC ${aviso.oc_id} — transp deve anexar CT-e de retorno${observacao ? ` (${observacao})` : ""}`,
            "r",
          );
          const ocAtual = ordens.find((o) => o.id === aviso.oc_id);
          const transpId = ocAtual?.transp_id;
          setPendencias((arr) => {
            const proxId = nextId("PEND-", arr);
            return arr
              .map((p) =>
                p.oc_id === aviso.oc_id && p.categoria === "confirmar_refugo" && p.status === "aberta"
                  ? { ...p, status: "resolvida" as const, resolvida_em: new Date().toISOString() }
                  : p,
              )
              .concat([
                {
                  id: proxId,
                  ...builderPendencia({
                    oc_id: aviso.oc_id,
                    transp_id: transpId,
                    categoria: "anexar_cte_retorno",
                  }),
                },
              ]);
          });
        }
      },

      anexarCteRetorno: (input) => {
        const id = nextId("CTR-", ctesRetorno);
        const novo: CteRetorno = {
          ...input,
          id,
          anexado_em: new Date().toISOString(),
        };
        setCtesRetorno((arr) => [novo, ...arr]);
        setOrdens((os) =>
          os.map((o) => (o.id === input.oc_id ? { ...o, cte_retorno_id: id } : o)),
        );
        addHist(
          input.anexado_por_nome,
          `CT-e de RETORNO ${input.numero} anexado à OC ${input.oc_id} (fluxo refugado)`,
          "t",
        );
        // Resolve "anexar_cte_retorno"
        setPendencias((arr) =>
          arr.map((p) =>
            p.oc_id === input.oc_id && p.categoria === "anexar_cte_retorno" && p.status === "aberta"
              ? { ...p, status: "resolvida" as const, resolvida_em: new Date().toISOString() }
              : p,
          ),
        );
        return novo;
      },

      anexarEstadia: (input) => {
        const id = nextId("EST-", estadias);
        const novo: Estadia = {
          ...input,
          id,
          anexada_em: new Date().toISOString(),
        };
        setEstadias((arr) => [novo, ...arr]);
        setOrdens((os) =>
          os.map((o) => (o.id === input.oc_id ? { ...o, estadia_id: id } : o)),
        );
        addHist(
          input.anexada_por_nome,
          `Estadia anexada à OC ${input.oc_id} — ${input.horas_estadia}h, R$ ${input.valor.toFixed(2)}`,
          "a",
        );
        // Estadia é opcional — não cria pendência
        return novo;
      },

      /* ─────────── Bloco J — Quebra (fiscal calcula) ─────────── */

      calcularQuebraOC: (input) => {
        const { oc_id, peso_carregado_kg, peso_descarregado_kg } = input;
        if (peso_carregado_kg <= 0) return null;
        const quebra_kg = peso_carregado_kg - peso_descarregado_kg;
        const quebra_pct = +((quebra_kg / peso_carregado_kg) * 100).toFixed(2);
        const alerta = quebra_pct > 0.5;

        // Se alerta, exige justificativa_transp E observacao_fiscal
        if (alerta) {
          if (!input.justificativa_transp || input.justificativa_transp.trim().length < 10) return null;
          if (!input.observacao_fiscal || input.observacao_fiscal.trim().length < 10) return null;
        }

        const id = nextId("QBR-", quebras);
        const novo: Quebra = {
          id,
          oc_id,
          peso_carregado_kg,
          peso_descarregado_kg,
          quebra_kg,
          quebra_pct,
          alerta,
          justificativa_transp: input.justificativa_transp,
          observacao_fiscal: input.observacao_fiscal,
          validado_em: new Date().toISOString(),
          validado_por_user_id: input.user.id,
          validado_por_nome: input.user.nome,
          calculado_em: new Date().toISOString(),
          calculado_por_user_id: input.user.id,
        };
        setQuebras((arr) => [novo, ...arr]);
        setOrdens((os) =>
          os.map((o) =>
            o.id === oc_id
              ? { ...o, quebra_id: id, status_operacional: "operacional_concluido" }
              : o,
          ),
        );
        addHist(
          input.user.nome,
          `Quebra calculada na OC ${oc_id}: ${quebra_kg.toLocaleString("pt-BR")} kg (${quebra_pct.toFixed(2)}%) — ${alerta ? "⚠️ ACIMA do limite (justificada)" : "OK ✓"}`,
          alerta ? "a" : "g",
        );

        // Marca descarga como validada (se ainda não estava) — quebra ok = descarga ok
        const descarga = dadosDescarga.find((d) => d.oc_id === oc_id);
        if (descarga && !descarga.validado_em) {
          setDadosDescarga((arr) =>
            arr.map((d) =>
              d.id === descarga.id
                ? {
                    ...d,
                    validado_em: new Date().toISOString(),
                    validado_por_user_id: input.user.id,
                  }
                : d,
            ),
          );
        }

        // Resolve "calc_quebra" e "validar_descarga" (Bloco I legacy) + libera para faturamento
        setPendencias((arr) =>
          arr.map((p) =>
            p.oc_id === oc_id &&
            (p.categoria === "calc_quebra" || p.categoria === "validar_descarga") &&
            p.status === "aberta"
              ? { ...p, status: "resolvida" as const, resolvida_em: new Date().toISOString() }
              : p,
          ),
        );

        return novo;
      },

      /* ─────────── Bloco I — Autorização de Carregamento → gera OC ─────────── */

      anexarAutorizacaoCarregamento: (input) => {
        // Procura a reserva (precisa estar APROVADA para anexar autorização)
        const carga = cargas.find((c) => c.id === input.carga_id);
        const reserva = carga?.reservas.find((r) => r.id === input.reserva_id);
        if (!carga || !reserva) return null;
        if (reserva.status !== "aprovada") return null;
        if (!reserva.motorista_id || !reserva.veiculo_id) return null;

        // Verifica se já tem autorização para essa reserva
        if (autorizacoesCarregamento.some((a) => a.reserva_id === reserva.id)) {
          return null;
        }

        // 1) Cria a autorização
        const autorizId = nextId("AUT-", autorizacoesCarregamento);
        const novaAut: AutorizacaoCarregamento = {
          ...input,
          id: autorizId,
          anexada_em: new Date().toISOString(),
        };
        setAutorizacoesCarregamento((arr) => [novaAut, ...arr]);

        // 2) Move a reserva para etapa "ordem_emitida"
        setCargas((cs) =>
          cs.map((c) =>
            c.id !== input.carga_id
              ? c
              : { ...c, reservas: c.reservas.map((r) => (r.id === input.reserva_id ? { ...r, etapa: "ordem_emitida" } : r)) },
          ),
        );

        // 3) Gera a OC automaticamente
        const ocId = nextId("OC-", ordens);
        const numero = `OC-${new Date().getFullYear()}-${ocId.replace("OC-", "")}`;
        const novaOC: OrdemCarregamento = {
          id: ocId,
          numero,
          contrato_id: carga.contrato_id,
          carga_id: carga.id,
          reserva_id: reserva.id,
          transp_id: reserva.transp_id,
          motorista_id: reserva.motorista_id,
          veiculo_id: reserva.veiculo_id,
          local_carg_id: carga.origem_local_id,
          destino_local_id: carga.destino_local_id || undefined,
          peso_previsto_kg: reserva.qtd_kg,
          status: "emitida",
          origem: "automatica_reserva",
          emitida_em: new Date().toISOString().split("T")[0],
          emitida_por: "Sistema",
          status_operacional: "oc_emitida",
          status_fiscal: "aguardando_nf",
          status_financeiro: "aguardando_liberacao",
          autorizacao_id: autorizId,
        };
        setOrdens((os) => [novaOC, ...os]);

        addHist(
          input.anexada_por_nome,
          `Autorização de carregamento anexada por ${reserva.transp_nome} — OC ${numero} gerada automaticamente`,
          "t",
        );

        // Bloco J — Resolve pendência anterior + cria nova "anexar ticket carregamento" para transp
        setPendencias((arr) => {
          const proxId = nextId("PEND-", arr);
          return arr
            .map((p) =>
              p.reserva_id === reserva.id && p.categoria === "anexar_autorizacao_carreg" && p.status === "aberta"
                ? { ...p, status: "resolvida" as const, resolvida_em: new Date().toISOString() }
                : p,
            )
            .concat([
              {
                id: proxId,
                ...builderPendencia({
                  oc_id: ocId,
                  transp_id: reserva.transp_id,
                  categoria: "anexar_ticket_carreg",
                }),
              },
            ]);
        });

        return { autorizacao: novaAut, oc: novaOC };
      },

      /* ─────────── Bloco I — Central Documental unificada ─────────── */

      anexarDocumento: (input) => {
        const id = nextId("DOC-", documentosOperacao);
        const novo: DocumentoOperacao = {
          ...input,
          id,
          versao: 1,
          status: "enviado",
          enviado_em: new Date().toISOString(),
          ativo: true,
        };
        setDocumentosOperacao((arr) => [novo, ...arr]);
        addHist(input.enviado_por_nome, `Documento anexado à OC ${input.oc_id}: ${input.categoria} — ${input.nome_original}`, "g");
        return novo;
      },

      aprovarDocumento: (id, decididoPorUserId, observacao) => {
        setDocumentosOperacao((arr) =>
          arr.map((d) => (d.id === id ? { ...d, status: "aprovado", decidido_em: new Date().toISOString(), decidido_por_user_id: decididoPorUserId, observacao } : d)),
        );
        const d = documentosOperacao.find((x) => x.id === id);
        if (d) addHist("Fiscal/Logística", `Documento ${d.categoria} aprovado (${d.nome_original})`, "g");
      },

      rejeitarDocumento: (id, decididoPorUserId, observacao) => {
        setDocumentosOperacao((arr) =>
          arr.map((d) => (d.id === id ? { ...d, status: "rejeitado", decidido_em: new Date().toISOString(), decidido_por_user_id: decididoPorUserId, observacao } : d)),
        );
        const d = documentosOperacao.find((x) => x.id === id);
        if (d) addHist("Fiscal/Logística", `Documento ${d.categoria} REJEITADO (${d.nome_original}) — motivo: ${observacao}`, "r");
      },

      substituirDocumento: (docAnteriorId, novoArquivo) => {
        const anterior = documentosOperacao.find((d) => d.id === docAnteriorId);
        if (!anterior) return null;

        // Marca o anterior como substituído (mantém histórico)
        setDocumentosOperacao((arr) =>
          arr.map((d) => (d.id === docAnteriorId ? { ...d, status: "substituido", ativo: false } : d)),
        );

        // Cria nova versão
        const id = nextId("DOC-", documentosOperacao);
        const novo: DocumentoOperacao = {
          id,
          oc_id: anterior.oc_id,
          categoria: anterior.categoria,
          arquivo_url: novoArquivo.arquivo_url,
          nome_original: novoArquivo.nome_original,
          mime_type: novoArquivo.mime_type,
          tamanho_bytes: novoArquivo.tamanho_bytes,
          versao: anterior.versao + 1,
          versao_anterior_id: anterior.id,
          status: "enviado",
          enviado_em: new Date().toISOString(),
          enviado_por_user_id: novoArquivo.enviado_por_user_id,
          enviado_por_nome: novoArquivo.enviado_por_nome,
          ativo: true,
        };
        setDocumentosOperacao((arr) => [novo, ...arr]);
        addHist(novoArquivo.enviado_por_nome, `Documento ${anterior.categoria} substituído (v${anterior.versao} → v${novo.versao})`, "t");
        return novo;
      },

      /* ─────────── Bloco I — Troca de NF ─────────── */

      solicitarTrocaNota: (input) => {
        const id = nextId("STN-", solicitacoesTrocaNota);
        const nova: SolicitacaoTrocaNota = {
          ...input,
          id,
          solicitada_em: new Date().toISOString(),
          status: "pendente",
        };
        setSolicitacoesTrocaNota((arr) => [nova, ...arr]);
        addHist(input.solicitada_por_nome, `Solicitou troca de NF (${input.nf_original_id}) — motivo: ${input.motivo}`, "a");
        return nova;
      },

      decidirTrocaNota: (solicitacaoId, decisao, decididoPorUserId, decididoPorNome, observacao) => {
        setSolicitacoesTrocaNota((arr) =>
          arr.map((s) =>
            s.id === solicitacaoId
              ? {
                  ...s,
                  status: decisao,
                  decidida_em: new Date().toISOString(),
                  decidida_por_user_id: decididoPorUserId,
                  observacao_fiscal: observacao,
                }
              : s,
          ),
        );
        const s = solicitacoesTrocaNota.find((x) => x.id === solicitacaoId);
        addHist(
          decididoPorNome,
          `Solicitação de troca ${solicitacaoId} ${decisao === "aprovada" ? "APROVADA" : "REJEITADA"}${observacao ? ` — ${observacao}` : ""}`,
          decisao === "aprovada" ? "g" : "r",
        );
      },

      anexarNovaNFSubstituta: (solicitacaoId, novaNFInput, userId) => {
        const solicitacao = solicitacoesTrocaNota.find((s) => s.id === solicitacaoId);
        if (!solicitacao || solicitacao.status !== "aprovada") return null;
        const nfAntiga = notasFiscais.find((n) => n.id === solicitacao.nf_original_id);
        if (!nfAntiga) return null;

        // 1) Cria a nova NF
        const novaId = nextId("NF-", notasFiscais);
        const nova: NotaFiscal = {
          ...novaNFInput,
          id: novaId,
          oc_id: solicitacao.oc_id,
          status: "ativa",
          substitui_nf_id: nfAntiga.id,
        };
        setNotasFiscais((arr) => [nova, ...arr]);

        // 2) Marca a NF antiga como substituida
        setNotasFiscais((arr) =>
          arr.map((n) =>
            n.id === nfAntiga.id
              ? {
                  ...n,
                  status: "substituida",
                  substituida_por_nf_id: novaId,
                  motivo_substituicao: solicitacao.motivo,
                  trocada_em: new Date().toISOString(),
                  trocada_por_user_id: userId,
                }
              : n,
          ),
        );

        // 3) Marca a solicitação como concluída (vincula nova NF)
        setSolicitacoesTrocaNota((arr) =>
          arr.map((s) => (s.id === solicitacaoId ? { ...s, nova_nf_id: novaId } : s)),
        );

        addHist(
          "Sistema",
          `NF ${nfAntiga.numero} substituída por nova NF ${nova.numero} (solicitação ${solicitacaoId})`,
          "t",
        );

        return nova;
      },

      /* ─────────── Bloco I — Descarga (com validação fiscal) ─────────── */

      registrarDescarga: (input) => {
        const id = nextId("DESC-", dadosDescarga);
        const novo: DadosDescarga = {
          ...input,
          id,
          descarregado_em: new Date().toISOString(),
        };
        setDadosDescarga((arr) => [novo, ...arr]);
        // Atualiza OC: status_operacional → descarregado + descarga_id
        setOrdens((os) =>
          os.map((o) =>
            o.id === input.oc_id
              ? { ...o, descarga_id: id, status_operacional: "descarregado" }
              : o,
          ),
        );
        addHist(
          "Logística",
          `Descarga registrada na OC ${input.oc_id} — ${input.peso_descarregado_kg.toLocaleString("pt-BR")} kg (aguardando validação fiscal)`,
          "b",
        );
        // Bloco J: resolve "anexar_ticket_descarga" (transp) E "registrar_descarga" (legacy) + cria "calc_quebra" (fiscal)
        setPendencias((arr) => {
          const proxId = nextId("PEND-", arr);
          return arr
            .map((p) =>
              p.oc_id === input.oc_id &&
              (p.categoria === "anexar_ticket_descarga" || p.categoria === "registrar_descarga") &&
              p.status === "aberta"
                ? { ...p, status: "resolvida" as const, resolvida_em: new Date().toISOString() }
                : p,
            )
            .concat([{ id: proxId, ...builderPendencia({ oc_id: input.oc_id, categoria: "calc_quebra" }) }]);
        });
        return novo;
      },

      validarDescarga: (descargaId, userId, userNome) => {
        const desc = dadosDescarga.find((d) => d.id === descargaId);
        if (!desc) return;
        setDadosDescarga((arr) =>
          arr.map((d) =>
            d.id === descargaId
              ? {
                  ...d,
                  validado_em: new Date().toISOString(),
                  validado_por_user_id: userId,
                  // limpa eventual rejeição anterior
                  rejeitado_em: undefined,
                  rejeitado_por_user_id: undefined,
                  motivo_rejeicao: undefined,
                }
              : d,
          ),
        );
        // Atualiza OC: status_operacional → operacional_concluido
        setOrdens((os) =>
          os.map((o) => (o.id === desc.oc_id ? { ...o, status_operacional: "operacional_concluido" } : o)),
        );
        addHist(userNome, `Descarga ${descargaId} VALIDADA pelo fiscal — operação operacional concluída`, "g");
      },

      rejeitarDescarga: (descargaId, userId, userNome, motivo) => {
        setDadosDescarga((arr) =>
          arr.map((d) =>
            d.id === descargaId
              ? {
                  ...d,
                  rejeitado_em: new Date().toISOString(),
                  rejeitado_por_user_id: userId,
                  motivo_rejeicao: motivo,
                  validado_em: undefined,
                  validado_por_user_id: undefined,
                }
              : d,
          ),
        );
        addHist(userNome, `Descarga ${descargaId} REJEITADA pelo fiscal — motivo: ${motivo}`, "r");
      },

      /* ─────────── Bloco I — Faturamento ─────────── */

      liberarFaturamento: (ocId, userId, userNome) => {
        const oc = ordens.find((o) => o.id === ocId);
        const descarga = dadosDescarga.find((d) => d.oc_id === ocId);
        if (!oc || !descarga) {
          return null;
        }
        if (!descarga.validado_em) {
          return null; // fiscal precisa ter validado descarga primeiro
        }
        // Pega frete da reserva original
        const carga = cargas.find((c) => c.id === oc.carga_id);
        const reserva = carga?.reservas.find((r) => r.id === oc.reserva_id);
        const fretePorTon = reserva?.frete_ton ?? 0;
        const pesoBase = descarga.peso_descarregado_kg;
        const valorCalculado = +(((pesoBase / 1000) * fretePorTon).toFixed(2));

        const id = nextId("FAT-", faturamentos);
        const novo: Faturamento = {
          id,
          oc_id: ocId,
          peso_base_kg: pesoBase,
          frete_ton: fretePorTon,
          valor_calculado: valorCalculado,
          status: "calculado",
          liberado_em: new Date().toISOString(),
          liberado_por_user_id: userId,
          criado_em: new Date().toISOString(),
        };
        setFaturamentos((arr) => [novo, ...arr]);
        setOrdens((os) =>
          os.map((o) =>
            o.id === ocId
              ? { ...o, faturamento_id: id, status_fiscal: "liberado_faturamento", status_financeiro: "calculado" }
              : o,
          ),
        );
        addHist(
          userNome,
          `Faturamento liberado para OC ${ocId} — valor calculado R$ ${valorCalculado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} (${pesoBase.toLocaleString("pt-BR")} kg × R$ ${fretePorTon}/t)`,
          "g",
        );
        return novo;
      },

      anexarFatura: (faturamentoId, input, userNome) => {
        const fat = faturamentos.find((f) => f.id === faturamentoId);
        if (!fat) return null;

        const divergencia = Math.abs(input.valor_informado - fat.valor_calculado);
        const temDivergencia = divergencia > 0.01;

        // 1) Atualiza Faturamento com dados da fatura
        const faturamentoAtualizado: Faturamento = {
          ...fat,
          valor_informado: input.valor_informado,
          divergencia: temDivergencia ? divergencia : undefined,
          justificativa_divergencia: input.justificativa,
          fatura_url: input.fatura_url,
          cte_id: input.cte_id,
          ctes_ids: input.ctes_ids,
          numero_fatura: input.numero_fatura,
          status: temDivergencia ? "em_conferencia" : "fatura_anexada",
        };

        // 2) Roda IA imediatamente (regra simples mock)
        const ctesVinculados = (input.ctes_ids ?? (input.cte_id ? [input.cte_id] : []))
          .map((id) => ctes.find((c) => c.id === id))
          .filter((c): c is CTE => !!c);
        const transp = transportadoras.find((t) => t.id === ordens.find((o) => o.id === fat.oc_id)?.transp_id);
        const iaAnalise = analisarFaturaIA({
          fatura: faturamentoAtualizado,
          ctes: ctesVinculados,
          transp,
          prestadorEsperado: "terraroxa (cerealista)",
        });
        const iaId = nextId("IA-", iaAnalisesFatura);
        const iaCompleta: IAAnaliseFatura = { ...iaAnalise, id: iaId };
        setIaAnalisesFatura((arr) => [iaCompleta, ...arr]);

        // 3) Salva Faturamento com FK pra IA
        setFaturamentos((arr) =>
          arr.map((f) =>
            f.id === faturamentoId ? { ...faturamentoAtualizado, ia_analise_id: iaId } : f,
          ),
        );

        // 4) Atualiza OC: status_financeiro + ia_analise_id
        setOrdens((os) =>
          os.map((o) =>
            o.id === fat.oc_id
              ? {
                  ...o,
                  ia_analise_id: iaId,
                  status_financeiro: temDivergencia ? "divergencia" : "fatura_anexada",
                }
              : o,
          ),
        );

        // 5) Histórico
        addHist(
          userNome,
          temDivergencia
            ? `Fatura anexada com DIVERGÊNCIA (informado R$ ${input.valor_informado.toFixed(2)} vs. calculado R$ ${fat.valor_calculado.toFixed(2)}) — IA: ${iaAnalise.divergencias_count}/4 divergências`
            : `Fatura anexada — R$ ${input.valor_informado.toFixed(2)} (sem divergência) — IA: aprovada`,
          temDivergencia ? "a" : "g",
        );

        // 6) Cria pendência "conferir_fatura_fiscal" pro fiscal
        setPendencias((arr) => {
          const proxId = nextId("PEND-", arr);
          return arr
            .map((p) =>
              p.oc_id === fat.oc_id && p.categoria === "anexar_fatura" && p.status === "aberta"
                ? { ...p, status: "resolvida" as const, resolvida_em: new Date().toISOString() }
                : p,
            )
            .concat([{ id: proxId, ...builderPendencia({ oc_id: fat.oc_id, categoria: "conferir_fatura_fiscal" }) }]);
        });

        return iaCompleta;
      },

      conferirFaturaFiscal: (faturamentoId, observacao, userObj) => {
        const fat = faturamentos.find((f) => f.id === faturamentoId);
        if (!fat) return;
        setFaturamentos((arr) =>
          arr.map((f) =>
            f.id === faturamentoId
              ? {
                  ...f,
                  fiscal_conferida_em: new Date().toISOString(),
                  fiscal_conferida_por_user_id: userObj.id,
                  fiscal_observacao: observacao,
                  status: "fatura_anexada",
                }
              : f,
          ),
        );
        addHist(
          userObj.nome,
          `Fatura conferida pelo fiscal na OC ${fat.oc_id}${observacao ? ` — ${observacao}` : ""} — enviada ao financeiro`,
          "g",
        );
        // Resolve "conferir_fatura_fiscal" + cria "processar_pagamento" (financeiro)
        setPendencias((arr) => {
          const proxId = nextId("PEND-", arr);
          return arr
            .map((p) =>
              p.oc_id === fat.oc_id && p.categoria === "conferir_fatura_fiscal" && p.status === "aberta"
                ? { ...p, status: "resolvida" as const, resolvida_em: new Date().toISOString() }
                : p,
            )
            .concat([{ id: proxId, ...builderPendencia({ oc_id: fat.oc_id, categoria: "processar_pagamento" }) }]);
        });
      },

      confirmarPagamento: (faturamentoId, input, userId, userNome) => {
        const fat = faturamentos.find((f) => f.id === faturamentoId);
        if (!fat) return null;

        const id = nextId("PAG-", pagamentos);
        const novo: Pagamento = {
          id,
          faturamento_id: faturamentoId,
          oc_id: fat.oc_id,
          valor_pago: input.valor_pago,
          data_pagamento: new Date().toISOString().split("T")[0],
          comprovante_url: input.comprovante_url,
          pago_por_user_id: userId,
          observacoes: input.observacoes,
        };
        setPagamentos((arr) => [novo, ...arr]);
        setFaturamentos((arr) => arr.map((f) => (f.id === faturamentoId ? { ...f, status: "aprovado" } : f)));
        setOrdens((os) =>
          os.map((o) =>
            o.id === fat.oc_id ? { ...o, status_financeiro: "pago" } : o,
          ),
        );
        addHist(
          userNome,
          `Pagamento confirmado — R$ ${input.valor_pago.toFixed(2)} pago para faturamento ${faturamentoId}`,
          "g",
        );
        return novo;
      },

      /* ─────────── Bloco I — Pendências ─────────── */

      criarPendencia: (input) => {
        const id = nextId("PEND-", pendencias);
        const nova: Pendencia = { ...input, id };
        setPendencias((arr) => [nova, ...arr]);
        return nova;
      },

      resolverPendencia: (id, userId, userNome) => {
        setPendencias((arr) =>
          arr.map((p) =>
            p.id === id
              ? { ...p, status: "resolvida", resolvida_em: new Date().toISOString(), resolvida_por_user_id: userId }
              : p,
          ),
        );
        const p = pendencias.find((x) => x.id === id);
        if (p) addHist(userNome, `Pendência resolvida: ${p.descricao}`, "g");
      },

      /* ─────────── Cadastros (CRUD genéricos) ─────────── */

      addTransportadora: (t) => {
        const id = nextId("TR-", transportadoras);
        const nova: Transportadora = { ...t, id, criada_em: new Date().toISOString().split("T")[0] };
        setTransportadoras((arr) => [nova, ...arr]);
        return nova;
      },
      updateTransportadora: (id, patch) =>
        setTransportadoras((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x))),

      addMotorista: (m) => {
        const id = nextId("MOT-", motoristas);
        const novo: Motorista = { ...m, id, criado_em: new Date().toISOString().split("T")[0] };
        setMotoristas((arr) => [novo, ...arr]);
        return novo;
      },
      updateMotorista: (id, patch) => setMotoristas((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x))),
      vincularTranspAoMotorista: (motoristaId, transpId) => {
        setMotoristas((arr) =>
          arr.map((m) =>
            m.id === motoristaId && !m.transp_ids.includes(transpId)
              ? { ...m, transp_ids: [...m.transp_ids, transpId] }
              : m,
          ),
        );
      },

      addVeiculo: (v) => {
        const id = nextId("VEI-", veiculos);
        const novo: Veiculo = { ...v, id, criado_em: new Date().toISOString().split("T")[0] };
        setVeiculos((arr) => [novo, ...arr]);
        return novo;
      },
      updateVeiculo: (id, patch) => setVeiculos((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x))),
      vincularTranspAoVeiculo: (veiculoId, transpId) => {
        setVeiculos((arr) =>
          arr.map((v) =>
            v.id === veiculoId && !v.transp_ids.includes(transpId)
              ? { ...v, transp_ids: [...v.transp_ids, transpId] }
              : v,
          ),
        );
      },

      addProdutor: (p) => {
        const id = nextId("PROD-", produtores);
        const novo: Produtor = { ...p, id };
        setProdutores((arr) => [novo, ...arr]);
        return novo;
      },
      updateProdutor: (id, patch) => setProdutores((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x))),

      addCliente: (c) => {
        const id = nextId("CLI-", clientes);
        const novo: Cliente = { ...c, id };
        setClientes((arr) => [novo, ...arr]);
        return novo;
      },
      updateCliente: (id, patch) => setClientes((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x))),

      addTerminal: (t) => {
        const id = nextId("TRM-", terminais);
        const novo: Terminal = { ...t, id };
        setTerminais((arr) => [novo, ...arr]);
        return novo;
      },
      updateTerminal: (id, patch) => setTerminais((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x))),

      addLocal: (l) => {
        const id = nextId("LOC-", locais);
        const novo: Local = { ...l, id };
        setLocais((arr) => [novo, ...arr]);
        return novo;
      },
      updateLocal: (id, patch) => setLocais((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x))),

      addUsuario: (u) => {
        const id = nextId("USR-", usuarios);
        const novo: Usuario = { ...u, id, criado_em: new Date().toISOString().split("T")[0] };
        setUsuarios((arr) => [novo, ...arr]);
        return novo;
      },
      updateUsuario: (id, patch) => setUsuarios((arr) => arr.map((x) => (x.id === id ? { ...x, ...patch } : x))),
    }),
    [cargas, contratos, ordens, historico, notasFiscais, ctes, romaneios, autorizacoesCarregamento, ticketsCarregamento, laudosClassificacao, anexosAgendamento, avisosRefugo, ctesRetorno, estadias, quebras, iaAnalisesFatura, documentosOperacao, solicitacoesTrocaNota, dadosDescarga, faturamentos, pagamentos, pendencias, usuarios, transportadoras, motoristas, veiculos, produtores, clientes, terminais, locais, produtos],
  );

  return <DataStore.Provider value={value}>{children}</DataStore.Provider>;
}

export function useDataStore() {
  const ctx = useContext(DataStore);
  if (!ctx) throw new Error("useDataStore deve estar dentro de <DataStoreProvider>");
  return ctx;
}
