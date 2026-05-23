# Kits de referência para Lovable — Etapas 5 a 11

Documento de apoio para reconstruir o **terraroxa** no Lovable (Vite + React + TanStack Query + Supabase).

**Como usar este arquivo:**
1. Você está prestes a mandar a etapa N pro Lovable.
2. Abra a seção correspondente abaixo.
3. Copie os snippets indicados deste repo + o **prompt-wrapper** que segue depois.
4. Cole tudo num único prompt no Lovable. Ele vai usar como referência ao gerar.

**Regras de adaptação Next.js → Vite (aplicar mentalmente em todos os snippets):**
- Remover `"use client"` no topo
- Trocar `import { useRouter } from "next/navigation"` → `import { useNavigate } from "react-router-dom"`
- `router.refresh()` → `queryClient.invalidateQueries({ queryKey: ['nome-da-query'] })`
- `next/link` → `react-router-dom`'s `Link`
- Server Actions (`"use server"`) → funções comuns que chamam `supabase.from(...).insert/update(...)` direto no client (RLS protege)
- `lib/api/queries.server.ts` → vira hooks com `useQuery` do TanStack
- Componentes UI próprios (Button, Card etc.) → usar shadcn/ui equivalente (`@/components/ui/button`, `@/components/ui/card`)

---

## 📦 Etapa 5 — Cargas e Reservas

### Arquivos do repo a copiar/referenciar

| Arquivo | O que pegar | Adaptação |
|---|---|---|
| `lib/types.ts` linhas 300–372 | Interfaces `Carga`, `CargaStatus`, `Reserva`, `ReservaStatus`, `ReservaEtapa` | Copiar igual |
| `lib/domain/saldo.ts` | Arquivo inteiro (32 linhas) | Copiar igual |
| `lib/domain/format.ts` | `fmtKg`, `fmtBRL`, `fmtDate` | Copiar igual |
| `lib/domain/carga-status.ts` | Arquivo inteiro (21 linhas) | Copiar igual |
| `components/cargas/PublicarCargaModal.tsx` | Inteiro | Remover `"use client"`, trocar useDataStore por queries Supabase |
| `components/reservas/ReservarCargaModal.tsx` | Inteiro | Idem |
| `components/cargas/CargaCard.tsx` | Inteiro | Só remover `"use client"` |
| `components/reservas/DetalheReservaModal.tsx` | Inteiro | Idem |
| `app/(cerealista)/cargas/CargasClientView.tsx` | Inteiro | Trocar useRouter por useNavigate; trocar useDataStore por useQuery |
| `app/(transportadora)/disponiveis/page.tsx` | Inteiro | Idem |
| `app/(transportadora)/minhas-reservas/page.tsx` | Inteiro | Idem |

### Snippet pronto: lógica de domínio (cole no prompt)

```ts
// lib/domain/saldo.ts
import type { Carga, Contrato } from "@/types";

export function disponivelKg(carga: Carga): number {
  return carga.total_kg - carga.reservado_kg;
}
export function percentualReservado(carga: Carga): number {
  if (carga.total_kg === 0) return 0;
  return Math.round((carga.reservado_kg / carga.total_kg) * 100);
}
export function percentualContratoUsado(contrato: Contrato): number {
  if (contrato.qtd_kg_total === 0) return 0;
  return Math.round(((contrato.qtd_kg_total - contrato.saldo_kg) / contrato.qtd_kg_total) * 100);
}
export type SaldoColor = "green" | "amber" | "red";
export function saldoColor(pct: number): SaldoColor {
  if (pct >= 100) return "red";
  if (pct >= 50) return "amber";
  return "green";
}

// lib/domain/carga-status.ts
import type { Carga, CargaStatus } from "@/types";
export function recalcCargaStatus(carga: Carga): CargaStatus {
  if (carga.reservado_kg >= carga.total_kg) return "fechada";
  if (carga.reservado_kg > 0) return "parcial";
  return "disponivel";
}
export function statusLabel(s: CargaStatus): string {
  if (s === "fechada") return "Fechada";
  if (s === "parcial") return "Parcialmente Reservada";
  if (s === "cancelada") return "Cancelada";
  return "Disponível";
}

// lib/domain/format.ts
export function fmtKg(n: number): string { return `${n.toLocaleString("pt-BR")} kg`; }
export function fmtBRL(n: number): string {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}
export function fmtDate(iso: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("pt-BR");
}
```

### Snippet pronto: tipos

```ts
export type CargaStatus = "disponivel" | "parcial" | "fechada" | "cancelada";

export interface Carga {
  id: string;
  contrato_id: string;
  contrato_interno: string; // espelha contratos[id].numero
  produto_id: string;
  produto: string;
  origem_local_id: string;
  destino_local_id?: string;
  origem: string;
  destino?: string;
  total_kg: number;
  reservado_kg: number;
  data_carg: string;
  obs: string;
  status: CargaStatus;
  publicada_em: string;
  /** Allowlist de transp que podem reservar (vazio = todas). */
  transps_permitidas?: string[];
  reservas: Reserva[];
}

export type ReservaStatus = "pendente" | "aprovada" | "reprovada" | "cancelada";

export interface Reserva {
  id: string;
  carga_id: string;
  transp_id: string;
  transp_nome: string;
  motorista_id?: string;
  veiculo_id?: string;
  motorista?: string;
  placa?: string;
  qtd_kg: number;
  frete_ton: number; // R$ por tonelada (convenção do mercado)
  status: ReservaStatus;
  data: string;
  obs?: string;
}
```

### Prompt-wrapper Etapa 5

```markdown
Continue o terraroxa. Implemente Cargas e Reservas.

**REFERÊNCIA — código já maduro em outro projeto, use como base e adapte pra Vite+React+TanStack Query+Supabase:**

[cole os snippets acima — tipos + lógica de domínio]

[cole o conteúdo de components/cargas/PublicarCargaModal.tsx, removendo `"use client"`]

[cole o conteúdo de components/reservas/ReservarCargaModal.tsx, removendo `"use client"`]

### Implemente
1. Página `/cargas` (cerealista): listagem com cards mostrando carga + ProgressBar (% reservado) + tabela de reservas vinculadas + ações aprovar/reprovar
2. Modal PublicarCargaModal: dropdown de contratos ativos com saldo, autopreenche origem/produto, valida qtd ≤ saldo
3. Página `/disponiveis` (transp): cards de cargas disponíveis/parciais (RLS filtra)
4. Modal ReservarCargaModal: validação qtd ≤ saldo, frete R$/t, motorista/veículo das suas N:N
5. Página `/minhas-reservas` (transp): histórico + cancelar pendentes

### Trigger Supabase obrigatório
Ao aprovar uma reserva (status pendente → aprovada):
1. Criar autorização_carregamento
2. Gerar OC com numero via RPC `proximo_numero_oc()`
3. Decrementar saldo do contrato

Ao reprovar/cancelar: devolver qtd_kg ao saldo da carga e recalcular status.

### UX obrigatória
- Toast em todas as mudanças de estado
- ConfirmDialog antes de reprovar/cancelar
- Realtime: cerealista vê toast quando reserva nova entra; transp vê quando é aprovada
- Mostra `disponivelKg(carga)` em destaque colorido (verde/amber/vermelho via `saldoColor(pct)`)
```

---

## 📋 Etapa 6 — Ordens de Carregamento (gating)

### Arquivos do repo a copiar/referenciar

| Arquivo | O que pegar | Por quê |
|---|---|---|
| `lib/domain/status-oc.ts` | Inteiro (111 linhas) | 3 trilhas paralelas (operacional/fiscal/financeiro) + transições válidas |
| `lib/domain/checklist.ts` | Inteiro (428 linhas) — **principal** | `OCSnapshot`, `buildChecklist`, regras de gating |
| `lib/domain/oc-snapshot.ts` | Inteiro | Builder do snapshot |
| `lib/types.ts` linhas 374–510 | OrdemCarregamento, OCStatusOperacional/Fiscal/Financeiro, AutorizacaoCarregamento | Tipos |
| `lib/types.ts` linhas 765–910 | TicketCarregamento, Laudo, AnexoAgendamento, AvisoRefugo, CteRetorno, Estadia, Quebra | Tipos |
| `components/checklist/ChecklistOC.tsx` | Inteiro | UI principal do detalhe da OC |
| `components/checklist/ChecklistTab.tsx` | Inteiro | Abas |
| `components/checklist/Anexar*Modal.tsx` (8 modais) | Inteiros | Padrão de upload + form |
| `components/checklist/CalcularQuebraModal.tsx` | Inteiro | Cálculo de quebra via RPC |
| `components/checklist/EnviarOCModal.tsx` | Inteiro | WhatsApp/Email mock |
| `components/ordens/CentralDocumentosTab.tsx` | Inteiro | Central documental versionada |
| `app/ordens/[id]/page.tsx` | Inteiro | Composição das abas |

### Snippet pronto: 3 trilhas de status

```ts
// As trilhas rodam em PARALELO — uma OC pode estar em_transito (operacional)
// e nf_em_analise (fiscal) e aguardando_liberacao (financeiro) ao mesmo tempo.

export type OCStatusOperacional =
  | "aguardando_autorizacao" | "oc_emitida" | "carregando"
  | "em_transito" | "aguardando_descarga" | "descarregado"
  | "operacional_concluido";

export type OCStatusFiscal =
  | "aguardando_nf" | "nf_recebida" | "nf_em_analise"
  | "troca_solicitada" | "troca_aprovada" | "nf_substituida"
  | "nf_validada" | "aguardando_cte" | "cte_recebido"
  | "liberado_faturamento";

export type OCStatusFinanceiro =
  | "aguardando_liberacao" | "calculado" | "fatura_anexada"
  | "em_conferencia" | "divergencia" | "pago" | "finalizado";

// Transições válidas (use como guard nas mutations Supabase)
export const OPERACIONAL_NEXT: Record<OCStatusOperacional, OCStatusOperacional[]> = {
  aguardando_autorizacao: ["oc_emitida"],
  oc_emitida: ["carregando"],
  carregando: ["em_transito"],
  em_transito: ["aguardando_descarga"],
  aguardando_descarga: ["descarregado"],
  descarregado: ["operacional_concluido"],
  operacional_concluido: [],
};
// (similar para FISCAL_NEXT e FINANCEIRO_NEXT — ver lib/domain/status-oc.ts no repo)
```

### Prompt-wrapper Etapa 6

```markdown
Continue o terraroxa. Implemente o módulo de Ordens de Carregamento (OC) — esta é a tela mais importante do sistema.

**REFERÊNCIA — sistema de gating maduro:**

[cole lib/domain/status-oc.ts inteiro]

[cole lib/domain/checklist.ts inteiro — 428 linhas, é o cérebro do gating]

[cole lib/domain/oc-snapshot.ts inteiro]

[cole components/checklist/ChecklistOC.tsx inteiro como exemplo de UI]

### Implemente
1. `/ordens` — listagem com filtros (status, transp, período) + KPIs no topo
2. `/ordens/[id]` — tela master com:
   - Header: número + 3 badges (operacional + fiscal + financeiro) + botões "PDF" / "Enviar pro motorista" / "Cancelar"
   - 7 cards/abas em ordem fixa: Autorização → Carregamento → Documentação Fiscal → Agendamento → Descarga → Faturamento → Pagamento
   - Card lateral: Central Documental versionada (substitui_doc_id_anterior)
   - Cada card mostra o que falta e bloqueia o próximo se incompleto
3. Modais separados pra cada anexo: Ticket, Laudo, NF, CT-e, Agendamento, Quebra, Refugo, CT-e Retorno, Estadia, Fatura

### Gating obrigatório (regras de bloqueio)
- Não pode subir NF sem Ticket+Laudo
- Não pode marcar descarga sem NF+CT-e
- Não pode faturar sem descarga
- Não pode pagar sem fatura aprovada pelo fiscal

Mostre mensagens explícitas em cada bloqueio: "Aguarda fiscal validar NF antes de liberar trânsito".

### Fluxo de refugo (alternativo)
Quando transp refuga a carga no destino:
1. Cria `aviso_refugo` (status: aguardando_confirmacao)
2. Logística confirma → cria pendência pra transp anexar CT-e de retorno
3. Trilha operacional desvia: aguardando_descarga → retorno_em_transito → retornada
4. Faturamento NÃO segue fluxo normal — vai pra "estadia + retorno"

### Versionamento de documentos
Tabela documentos_operacao: ao substituir, marca antigo como `substituido_por_id`, cria nova entrada com `versao+1`. UI mostra a cadeia de substituições.

### Storage
Upload pro bucket `operacao/oc_<id>/<tipo>_<timestamp>.<ext>`. Preview PDF inline (react-pdf ou iframe).
```

---

## ⚠️ Etapa 7 — Pendências e Notificações

### Arquivos do repo a copiar/referenciar

| Arquivo | O que pegar | Por quê |
|---|---|---|
| `lib/domain/sla.ts` | Inteiro (91 linhas) | Tabela SLA_PADRAO + cálculo de severidade |
| `lib/types.ts` linhas 615–665 | Pendencia, PendenciaCategoria, PendenciaSeveridade | Tipos |
| `app/pendencias/PendenciasClientView.tsx` | Inteiro | UI já feita |
| `components/layout/NotificacoesBell.tsx` | Inteiro | Sino + dropdown |

### Snippet pronto: SLA + criação de pendência

```ts
import type { Pendencia, PendenciaCategoria, PendenciaSeveridade, PendenciaSetor } from "@/types";

// SLA em HORAS por categoria — base do sistema
export const SLA_PADRAO: Record<PendenciaCategoria, { horas: number; setor: PendenciaSetor; descricao: string }> = {
  aprovar_reserva: { horas: 24, setor: "logistica", descricao: "Aprovar/reprovar reserva da transportadora" },
  anexar_ticket_carreg: { horas: 24, setor: "transportadora", descricao: "Anexar ticket de carregamento + peso líquido" },
  registrar_descarga: { horas: 48, setor: "logistica", descricao: "Registrar dados de descarga" },
  validar_descarga: { horas: 24, setor: "fiscal", descricao: "Validar descarga registrada pela logística" },
  anexar_nf: { horas: 72, setor: "logistica", descricao: "Anexar NF da operação" },
  validar_nf: { horas: 48, setor: "fiscal", descricao: "Validar NF anexada" },
  aprovar_troca_nf: { horas: 48, setor: "fiscal", descricao: "Aprovar/rejeitar solicitação de troca de NF" },
  anexar_cte: { horas: 120, setor: "transportadora", descricao: "Anexar CT-e da operação" },
  liberar_faturamento: { horas: 24, setor: "fiscal", descricao: "Liberar faturamento (todos os docs ok)" },
  anexar_fatura: { horas: 120, setor: "transportadora", descricao: "Anexar fatura dos CT-es" },
  processar_pagamento: { horas: 720, setor: "financeiro", descricao: "Processar pagamento (até 30 dias)" },
  confirmar_refugo: { horas: 24, setor: "logistica", descricao: "Confirmar refugo informado pela transportadora" },
  anexar_cte_retorno: { horas: 72, setor: "transportadora", descricao: "Anexar CT-e do retorno (carga refugada)" },
  calc_quebra: { horas: 24, setor: "fiscal", descricao: "Calcular quebra (carregado vs descarregado)" },
  conferir_fatura_ia: { horas: 4, setor: "fiscal", descricao: "IA conferindo fatura × CT-es" },
  conferir_fatura_fiscal: { horas: 24, setor: "fiscal", descricao: "Conferir resultado da IA antes do financeiro" },
};

export function calcSeveridade(pendencia: Pendencia, agora: Date = new Date()): PendenciaSeveridade {
  if (pendencia.status !== "aberta") return "no_prazo";
  const criada = new Date(pendencia.criada_em);
  const vence = new Date(pendencia.vence_em);
  const decorrido = agora.getTime() - criada.getTime();
  const total = vence.getTime() - criada.getTime();
  const pct = total > 0 ? decorrido / total : 1;
  if (pct >= 2) return "critica";
  if (pct >= 1) return "atrasada";
  if (pct >= 0.8) return "vencendo";
  if (pct >= 0.5) return "proximo";
  return "no_prazo";
}

export const SEVERIDADE_TONE: Record<PendenciaSeveridade, "green" | "amber" | "red"> = {
  no_prazo: "green", proximo: "amber", vencendo: "amber", atrasada: "red", critica: "red",
};
```

### Prompt-wrapper Etapa 7

```markdown
Continue o terraroxa. Implemente Pendências (workflow cross-setor com SLA) e Notificações realtime.

**REFERÊNCIA:**

[cole o snippet de SLA + calcSeveridade acima]

[cole app/pendencias/PendenciasClientView.tsx inteiro como base de UI]

### Implemente
1. `/pendencias` — 5 abas (Comercial/Logística/Fiscal/Financeiro/Transportadora). Cada user vê só as suas (RLS); transp filtra por transp_id
2. Cada card de pendência: tipo + descrição + OC linkada + badge de severidade (verde→amber→vermelho conforme `calcSeveridade`) + botão "Resolver"
3. Sino no header (componente NotificacoesBell): contagem de pendências do setor do user + dropdown com top 5 + realtime via Supabase channel
4. Criação automática via triggers SQL:
   - Reserva pendente → cria pendência logística (SLA 24h)
   - Quebra > 0.5% → cria pendência fiscal (SLA 48h)
   - Divergência IA fatura × CT-e → cria pendência financeira (SLA 72h)
   - Solicitação troca NF → cria pendência fiscal
   - Carga refugada → cria pendência logística + comercial
5. Toast cross-portal: cerealista vê quando transp anexa doc; transp vê quando cerealista aprova/reprova

### Realtime (Supabase channels)
- Canal por setor para cerealistas: `pendencias_<setor>`
- Canal por transp para transp: `pendencias_transp_<transp_id>`
- Bell atualiza sem reload
- Toast aparece automaticamente em mudanças

### Resolução
Ao clicar "Resolver": muda status=resolvida, registra `resolvido_por_id` + `resolvido_em` no audit_log.
```

---

## 📊 Etapa 8 — Dashboards e Relatórios

### Arquivos do repo a copiar/referenciar

| Arquivo | O que pegar |
|---|---|
| `components/dashboards/DashComercial.tsx` | Inteiro |
| `components/dashboards/DashLogistica.tsx` | Inteiro |
| `components/dashboards/DashFiscal.tsx` | Inteiro |
| `components/dashboards/DashFinanceiro.tsx` | Inteiro |
| `components/charts/BarChart.tsx` | Wrapper Recharts |
| `components/charts/LineChart.tsx` | Wrapper Recharts |
| `components/charts/PieChart.tsx` | Wrapper Recharts |
| `components/charts/palette.ts` | Paleta cores agro |
| `app/(cerealista)/dashboard/page.tsx` | Composição por perfil |
| `app/(cerealista)/kanban/page.tsx` | Painel da Operação |
| `app/relatorios/page.tsx` | Inteiro |
| `lib/domain/csv.ts` | Export CSV (61 linhas) |

### Snippet pronto: paleta + CSV

```ts
// components/charts/palette.ts
export const PALETTE_AGRO = {
  primary: "#16a34a",
  secondary: "#15803d",
  amber: "#a16207",
  red: "#dc2626",
  blue: "#2563eb",
  teal: "#0d9488",
  gray: "#78716c",
} as const;

// Para gráficos com séries múltiplas
export const SERIES_COLORS = [
  PALETTE_AGRO.primary,
  PALETTE_AGRO.amber,
  PALETTE_AGRO.blue,
  PALETTE_AGRO.teal,
  PALETTE_AGRO.red,
];

// lib/domain/csv.ts — função genérica de export
export function downloadCSV(filename: string, rows: Array<Record<string, string | number>>) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map(r => headers.map(h => {
      const v = r[h];
      const s = typeof v === "string" ? v : String(v);
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(","))
  ].join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function fmtDataCSV(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR");
}
```

### Prompt-wrapper Etapa 8

```markdown
Continue o terraroxa. Implemente Dashboards por perfil + Relatórios.

**REFERÊNCIA:**

[cole o snippet de paleta + CSV acima]

[cole components/charts/BarChart.tsx, LineChart.tsx, PieChart.tsx — wrappers Recharts]

[cole components/dashboards/DashComercial.tsx inteiro como exemplo]

### Implemente em `/dashboard` (adapta ao perfil do user)
- **Admin**: KPIs gerais + operações/mês + distribuição por produto + top 5 transps
- **Comercial**: contratos ativos + valor contratado + % uso médio + top 10 contratos com maior saldo + contratos disponibilizados/semana
- **Logística**: cargas disponíveis + reservas pendentes + OCs em trânsito + descarregadas hoje + reservas ordenadas por SLA
- **Fiscal**: NFs aguardando + quebras acima do limite + trocas pendentes + % quebra média por transp (30d)
- **Financeiro**: faturas pendentes + valor a pagar + pago no mês + divergências + pagamentos/semana
- **Transportadora**: minhas reservas pendentes + minhas OCs em trânsito + valor a receber + cargas disponíveis em destaque

### `/painel` (Painel da Operação)
Kanban com colunas = status operacional da OC. Cards mostram número + transp + motorista + placa. Click no card vai pra `/ordens/[id]`.

### `/relatorios`
- Filtros combinados: DateRange + transp + contrato + produto
- 4 abas: Operações/período, Quebra por transp, Volume por produto, Tempo médio por etapa
- Export CSV em cada tabela
- Loading skeleton enquanto carrega

### Performance
- Queries agregadas no Postgres (Views materializadas se necessário)
- TanStack Query com staleTime 60s
- Lazy load das telas pesadas (`/relatorios`)
```

---

## 📄 Etapa 9 — PDF, WhatsApp/Email, Maps

### Arquivos do repo a copiar/referenciar

| Arquivo | O que pegar | Adaptação |
|---|---|---|
| `lib/domain/ia-fatura.ts` | Inteiro (106 linhas) | Copiar igual |
| `lib/domain/geo.ts` | Inteiro | Copiar igual |
| `components/maps/MapaPlaceholder.tsx` | Inteiro | Idem |
| `components/checklist/EnviarOCModal.tsx` | Inteiro | Idem |
| `components/financeiro/ResultadoIAFatura.tsx` | Inteiro | Idem |

### Snippet pronto: IA Fatura

```ts
// lib/domain/ia-fatura.ts — Validador Fatura × CT-e (mock determinístico)
import type { CTE, Faturamento, IAAnaliseFatura, IAItemAnalise, Transportadora } from "@/types";

const TOLERANCIA_VALOR = 0.01; // R$

export function analisarFaturaIA(input: {
  fatura: Faturamento;
  ctes: CTE[];
  transp?: Transportadora;
  prestadorEsperado: string;
}): Omit<IAAnaliseFatura, "id"> {
  const { fatura, ctes, transp, prestadorEsperado } = input;
  const itens: IAItemAnalise[] = [];

  // 1) Valor: calculado (peso × frete/ton) vs informado pela transp
  const valorMatch = fatura.valor_informado != null &&
    Math.abs(fatura.valor_informado - fatura.valor_calculado) <= TOLERANCIA_VALOR;
  itens.push({
    campo: "valor_frete",
    esperado: `R$ ${fatura.valor_calculado.toFixed(2)}`,
    encontrado: `R$ ${(fatura.valor_informado ?? 0).toFixed(2)}`,
    match: valorMatch,
    observacao: valorMatch ? "Valor bate." : `Divergência R$ ${Math.abs((fatura.valor_informado ?? 0) - fatura.valor_calculado).toFixed(2)}`,
  });

  // 2) Transportadora dos CT-es bate com a transp da OC
  const transpNome = transp?.nome_fantasia ?? "—";
  itens.push({
    campo: "transportadora",
    esperado: transpNome,
    encontrado: ctes.length > 0 ? transpNome : "Nenhum CT-e",
    match: ctes.length > 0 && !!transp,
    observacao: `${ctes.length} CT-e(s) de ${transpNome}.`,
  });

  // 3) Prestador (cerealista) confirmado
  itens.push({
    campo: "prestador",
    esperado: prestadorEsperado,
    encontrado: prestadorEsperado,
    match: true,
    observacao: "Prestador único confirmado.",
  });

  // 4) Vinculação dos CT-es bate
  const idsFatura = fatura.ctes_ids ?? [];
  const todosOsIdsBatem = idsFatura.every(id => ctes.some(c => c.id === id));
  itens.push({
    campo: "numero_cte",
    esperado: idsFatura.join(", "),
    encontrado: ctes.map(c => c.numero).join(", "),
    match: ctes.length > 0 && todosOsIdsBatem,
    observacao: `${ctes.length} CT-e(s) vinculado(s).`,
  });

  const divergencias = itens.filter(i => !i.match).length;
  return {
    fatura_id: fatura.id,
    oc_id: fatura.oc_id,
    status: divergencias === 0 ? "aprovada" : "divergencia",
    itens,
    divergencias_count: divergencias,
    resumo: divergencias === 0
      ? "✓ 4 campos batem. Fatura aprovada."
      : `⚠️ ${divergencias} de 4 com divergência — fiscal revisar.`,
    analisada_em: new Date().toISOString(),
  };
}
```

### Snippet pronto: PDF via jsPDF

```ts
// lib/pdf/oc-pdf.ts
import jsPDF from "jspdf";
import "jspdf-autotable";
import type { OCSnapshot } from "@/types";

export function gerarPDFdaOC(snap: OCSnapshot) {
  const doc = new jsPDF();
  // Capa
  doc.setFontSize(20);
  doc.text("terraroxa", 15, 20);
  doc.setFontSize(14);
  doc.text(`Ordem de Carregamento ${snap.oc.numero}`, 15, 32);
  doc.setFontSize(10);
  doc.text(`Emitida em: ${new Date(snap.oc.emitida_em).toLocaleString("pt-BR")}`, 15, 40);

  // Dados gerais
  doc.setFontSize(12);
  doc.text("Dados Gerais", 15, 55);
  doc.setFontSize(10);
  // @ts-expect-error autotable não tem types perfeitos
  doc.autoTable({
    startY: 60,
    head: [["Campo", "Valor"]],
    body: [
      ["Contrato", snap.oc.contrato_numero ?? "—"],
      ["Transportadora", snap.oc.transp_nome ?? "—"],
      ["Motorista", snap.oc.motorista_nome ?? "—"],
      ["Placa", snap.oc.placa ?? "—"],
      ["Origem", snap.oc.origem ?? "—"],
      ["Destino", snap.oc.destino ?? "—"],
      ["Produto", snap.oc.produto ?? "—"],
      ["Quantidade", `${snap.oc.qtd_kg.toLocaleString("pt-BR")} kg`],
      ["Frete", `R$ ${snap.oc.frete_ton}/t`],
    ],
  });

  // Documentos anexados
  const docs = [
    ["Autorização", snap.autorizacao ? "✓" : "—"],
    ["Ticket Carregamento", snap.ticketCarreg ? "✓" : "—"],
    ["Laudo", snap.laudo ? "✓" : "—"],
    ["Agendamento", snap.anexoAgendamento ? "✓" : "—"],
    ["NF", snap.notaFiscal ? snap.notaFiscal.numero : "—"],
    ["CT-e", snap.cte ? snap.cte.numero : "—"],
    ["Descarga", snap.descarga ? "✓" : "—"],
  ];
  // @ts-expect-error
  doc.autoTable({ startY: doc.lastAutoTable.finalY + 10, head: [["Documento", "Status"]], body: docs });

  doc.save(`OC_${snap.oc.numero}.pdf`);
}
```

### Prompt-wrapper Etapa 9

```markdown
Continue o terraroxa. Adicione integrações: PDF da OC (real), WhatsApp/Email (mock), Google Maps (mock+link), IA Fatura (mock determinístico).

**REFERÊNCIA:**

[cole lib/domain/ia-fatura.ts inteiro]

[cole o snippet de gerarPDFdaOC acima]

[cole components/maps/MapaPlaceholder.tsx]

[cole components/checklist/EnviarOCModal.tsx]

### Implemente
1. **PDF da OC (real, jsPDF)**: botão em `/ordens/[id]` gera PDF com capa (logo + número + data), tabela de dados gerais, tabela de docs anexados, QR code apontando pra URL da OC
2. **WhatsApp/Email mock**: modal de preview da mensagem + botão "Enviar" cria entrada em `comunicacao_log` e mostra toast. SEM request real
3. **Google Maps**: em `/cadastros/locais/[id]` mostra iframe Google Maps Embed (sem chave) se tem lat/lng + botão "Abrir externo" via `https://www.google.com/maps/search/?api=1&query=lat,lng`
4. **IA Fatura**: chama `analisarFaturaIA()` em `/ordens/[id]` aba Faturamento. Mostra os 4 campos lado-a-lado com badges OK/divergente, e cria pendência fiscal automaticamente se divergencias_count > 0
5. **UploadZone**: componente drag-drop pra PDF/JPG/PNG (max 10MB) que sobe pro bucket `operacao/oc_<id>/<tipo>_<timestamp>.<ext>` e mostra preview inline (react-pdf)

### Tabela nova
`comunicacao_log`: oc_id, tipo (whatsapp/email), destinatario, mensagem, enviado_em, status (mock_enviado)
```

---

## 🔐 Etapa 10 — Permissões e Configurações

### Arquivos do repo a copiar/referenciar

| Arquivo | O que pegar |
|---|---|
| `lib/domain/permissions.ts` | Inteiro (148 linhas) |
| `lib/types.ts` linhas 8–60 | Role, Perfil, Acao, Modulo, Permissao, Usuario |
| `components/cadastros/UsuariosView.tsx` | Inteiro |
| `components/cadastros/PermissoesView.tsx` | Inteiro |
| `components/cadastros/ConvidarUsuarioModal.tsx` | Inteiro |
| `app/configuracoes/[setting]/page.tsx` | Inteiro |

### Snippet pronto: matriz de permissões

```ts
// lib/domain/permissions.ts (resumido)
import type { Acao, Modulo, Perfil, Permissao } from "@/types";

const TODAS_ACOES: Acao[] = ["visualizar", "criar", "editar", "excluir", "aprovar", "cancelar", "anexar_doc", "baixar_doc"];

function grant(perfil: Perfil, modulos: Modulo[], acoes: Acao[]): Permissao[] {
  return modulos.flatMap(m => acoes.map(a => ({ perfil, modulo: m, acao: a, permitido: true })));
}

// Matriz padrão — tudo que NÃO estiver listado = negado por default
export const PERMISSOES_PADRAO: Permissao[] = [
  // Admin: tudo
  ...grant("admin", ["dashboard", "usuarios", "transportadoras", "motoristas", "veiculos", "terminais", "locais", "produtores", "clientes", "produtos", "contratos", "cargas", "reservas", "ordens_carregamento", "notas_fiscais", "ctes", "historico"], TODAS_ACOES),

  // Logística: operação sem mexer em users
  ...grant("logistica", ["dashboard", "transportadoras", "motoristas", "veiculos", "terminais", "locais", "produtores", "clientes", "produtos", "contratos", "cargas", "reservas", "ordens_carregamento", "historico"],
    ["visualizar", "criar", "editar", "aprovar", "cancelar", "anexar_doc", "baixar_doc"]),

  // Fiscal: NF + CTE + Romaneio + leitura geral
  ...grant("fiscal", ["notas_fiscais", "ctes", "romaneios"], TODAS_ACOES),
  ...grant("fiscal", ["contratos", "cargas", "reservas", "ordens_carregamento", "historico", "dashboard"], ["visualizar", "baixar_doc"]),

  // Financeiro: tudo readonly + faturas
  ...grant("financeiro", ["dashboard", "contratos", "cargas", "reservas", "ordens_carregamento", "notas_fiscais", "ctes", "historico"], ["visualizar", "baixar_doc"]),

  // Transportadora: limitada
  ...grant("transportadora", ["dashboard", "cargas"], ["visualizar"]),
  ...grant("transportadora", ["motoristas", "veiculos"], ["visualizar", "criar", "editar", "anexar_doc"]),
  ...grant("transportadora", ["reservas"], ["visualizar", "criar", "cancelar"]),
  ...grant("transportadora", ["ordens_carregamento"], ["visualizar", "baixar_doc"]),
];

export function podeExecutar(perfil: Perfil, modulo: Modulo, acao: Acao, overrides: Permissao[] = []): boolean {
  const override = overrides.find(p => p.perfil === perfil && p.modulo === modulo && p.acao === acao);
  if (override) return override.permitido;
  return PERMISSOES_PADRAO.some(p => p.perfil === perfil && p.modulo === modulo && p.acao === acao && p.permitido);
}
```

### Prompt-wrapper Etapa 10

```markdown
Continue o terraroxa. Implemente Configurações: usuários + permissões + perfil da empresa.

**REFERÊNCIA:**

[cole lib/domain/permissions.ts inteiro]

[cole components/cadastros/ConvidarUsuarioModal.tsx inteiro]

### Rotas
`/configuracoes/usuarios` — listagem + convidar
`/configuracoes/permissoes` — matriz interativa (linhas=perfis, colunas=módulos, células=checkbox por ação)
`/configuracoes/empresa` — nome/logo/CNPJ/endereço (singleton)
`/configuracoes/integracoes` — placeholders "em breve"

### Implemente
1. ConvidarUsuario (admin): chama `supabase.auth.admin.inviteUserByEmail({ email, data: { perfil, transp_id } })` em uma Edge Function (não pode chamar do client porque exige service_role). Cria row em `usuarios` com status pendente. Usuário recebe email de convite.
2. Matriz de permissões: 5 perfis × 18 módulos × 8 ações = ~720 checkboxes (use virtualização ou paginação). Salva em tabela `permissoes` no Supabase.
3. AuthContext lê permissões do user logado e expõe helper `can(modulo, acao): boolean`
4. Todos os botões críticos do app usam `{can("contratos", "criar") && <Button>...</Button>}`
5. `/historico` — audit_log com filtros (usuário, tabela, período) e visualização do payload jsonb antes/depois

### Edge Function pra convite
```typescript
// supabase/functions/invite-user/index.ts
import { createClient } from '@supabase/supabase-js';

Deno.serve(async (req) => {
  const { email, perfil, transp_id } = await req.json();
  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { perfil, transp_id }
  });
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  // Cria row em public.usuarios
  await supabaseAdmin.from('usuarios').insert({
    auth_user_id: data.user.id, email, perfil, transp_id, ativo: true
  });
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
});
```
```

---

## 🎨 Etapa 11 — Polimento, seed, a11y, mobile

### Arquivos do repo a copiar/referenciar

| Arquivo | O que pegar |
|---|---|
| `lib/mock-data.ts` se existir | Estrutura do seed |
| `docs/ROTEIRO_TESTE_BLOCO_J.md` | Roteiro E2E |
| `docs/ARQUITETURA.md` | Padrões |

### Snippet pronto: seed SQL

```sql
-- Função seed_demo() — chamar via SELECT seed_demo();
create or replace function public.seed_demo() returns void
language plpgsql as $$
declare
  v_admin_id uuid;
  v_transp_mt_id uuid;
  v_transp_go_id uuid;
  v_produtor_id uuid;
  v_cliente_id uuid;
  v_produto_soja_id uuid;
  v_local_fazenda_id uuid;
  v_local_porto_id uuid;
  v_contrato_id uuid;
  v_carga_id uuid;
begin
  -- Transportadoras
  insert into transportadoras (razao_social, nome_fantasia, cnpj_cpf, telefone, email, responsavel, status)
  values
    ('TranspMT LTDA', 'TranspMT', '11.222.333/0001-44', '(65) 99000-0001', 'contato@transpmt.com.br', 'João Silva', 'ativa'),
    ('TranspGO Cargas', 'TranspGO', '22.333.444/0001-55', '(62) 99000-0002', 'contato@transpgo.com.br', 'Maria Santos', 'ativa'),
    ('TranspSP Express', 'TranspSP', '33.444.555/0001-66', '(11) 99000-0003', 'contato@transpsp.com.br', 'Pedro Costa', 'pendente')
  returning id into v_transp_mt_id; -- pega a primeira

  -- Produtos
  insert into produtos (nome, descricao) values
    ('Soja', 'Soja em grão a granel'),
    ('Milho', 'Milho em grão a granel'),
    ('Sorgo', 'Sorgo a granel'),
    ('Trigo', 'Trigo a granel'),
    ('Algodão', 'Algodão pluma')
  returning id into v_produto_soja_id;

  -- Locais com coords reais
  insert into locais (nome, tipo, cidade, uf, latitude, longitude) values
    ('Fazenda Boa Esperança', 'fazenda', 'Sorriso', 'MT', -12.5453, -55.7211),
    ('Fazenda Cerrado', 'fazenda', 'Rio Verde', 'GO', -17.7975, -50.9211),
    ('Porto de Santos', 'porto', 'Santos', 'SP', -23.9608, -46.3331),
    ('Armazém Rondonópolis', 'armazem_origem', 'Rondonópolis', 'MT', -16.4706, -54.6356),
    ('Terminal Paranaguá', 'terminal', 'Paranaguá', 'PR', -25.5161, -48.5089)
  returning id into v_local_fazenda_id;

  -- Produtor + Cliente
  insert into produtores (nome, razao_social, cpf_cnpj, cidade, uf, contato, tipo, ativo)
  values ('Fazenda Boa Esperança', 'João Silva ME', '12.345.678/0001-99', 'Sorriso', 'MT', '(65) 99000-1234', 'vendedor', true)
  returning id into v_produtor_id;

  insert into clientes (nome, cpf_cnpj, cidade, uf, contato, ativo)
  values ('Exportadora Santos', '98.765.432/0001-10', 'Santos', 'SP', '(13) 99000-5678', true)
  returning id into v_cliente_id;

  -- Contrato ativo
  insert into contratos (produto_id, produtor_id, cliente_id, local_origem_id, qtd_kg_total, saldo_kg, preco_kg, status, disponivel, numero)
  values (v_produto_soja_id, v_produtor_id, v_cliente_id, v_local_fazenda_id, 5000000, 4000000, 2.15, 'ativo', true, public.proximo_numero_contrato())
  returning id into v_contrato_id;

  -- Carga publicada
  insert into cargas (contrato_id, contrato_interno, produto, origem, destino, data_carg, total_kg, reservado_kg, status)
  values (v_contrato_id, 'CTR-2026-001', 'Soja', 'Sorriso/MT', 'Santos/SP', current_date + 7, 1000000, 0, 'disponivel')
  returning id into v_carga_id;

  raise notice 'Seed concluído. Carga: %, Contrato: %', v_carga_id, v_contrato_id;
end $$;
```

### Prompt-wrapper Etapa 11

````markdown
Continue o terraroxa. Etapa final: polimento + seed + a11y + mobile + testes.

**REFERÊNCIA:**

[cole o snippet seed_demo() acima]

### Implemente

#### 1. Seed
Aplique a função SQL acima. Em `/configuracoes/integracoes` (modo dev) adicione botão "Resetar dados de demo" que trunca tudo e re-roda seed_demo().

#### 2. A11y
- aria-label em todos botões icon-only
- ESC fecha modais; focus trap em modais (use Radix Dialog que já tem)
- Tab navega corretamente
- Contraste mínimo AA (testar com axe DevTools — não deve ter warning)
- Tabelas com `<th scope="col">`

#### 3. Mobile (375px / 768px / 1024px)
- Sidebar vira Sheet drawer no mobile (já é shadcn)
- Tabelas viram cards empilhados em <768px
- Modais ocupam tela cheia em <640px
- Botões mínimos 44px de altura

#### 4. Loading + Error
- Skeleton em listagens com TanStack Query `isLoading`
- ErrorBoundary global (componente shadcn ou react-error-boundary)
- Páginas 404 e 500 customizadas
- Mensagens úteis: "Sem conexão" / "Sem permissão" / "Sessão expirada"

#### 5. Performance
- TanStack Query staleTime 30s pra listagens, 60s pra dashboards
- Lazy load com React.lazy + Suspense em `/ordens/[id]` e `/relatorios`
- Imagens com `loading="lazy"` + placeholder

#### 6. Testes E2E (criar como checklist no README)

```markdown
## Roteiro de teste E2E (manual)

1. [ ] Admin loga e convida um usuário comercial
2. [ ] Comercial recebe email, define senha, loga
3. [ ] Comercial cria contrato → disponibiliza
4. [ ] Logística (login separado) publica carga
5. [ ] Transp (login separado) acessa /disponiveis, reserva
6. [ ] Logística vê reserva pendente, aprova
7. [ ] OC nasce automaticamente
8. [ ] Transp sobe ticket + laudo em /ordens/[id]
9. [ ] Logística sobe NF
10. [ ] Fiscal valida NF
11. [ ] Transp sobe CT-e
12. [ ] Transp marca chegada no destino
13. [ ] Fiscal registra peso descarregado + clica "Calcular quebra"
14. [ ] Transp anexa fatura
15. [ ] Sistema chama IA, mostra resultado
16. [ ] Fiscal confere e libera
17. [ ] Financeiro confirma pagamento
18. [ ] OC fica `paga` ✓
```

#### 7. Docs
- README com setup local (variáveis .env, comandos)
- CHANGELOG v0.1.0
- ARQUITETURA.md com decisões (kg canônico, dual portals, 3 trilhas)

### Critérios de aceitação final
- Build sem warnings
- Lighthouse mobile >= 90
- Roteiro E2E roda do início ao fim
- Seed cria sistema utilizável imediatamente após apply
- Mobile testado em 3 breakpoints
````

---

## 📌 Notas finais

### Ordem sugerida de envio ao Lovable
1. **Etapa 5 primeiro** (você tá aqui) — depois testa o fluxo Carga→Reserva→Aprovar
2. **Etapa 6** (OC) — é a mais densa. Considere fatiar em duas: Cards 1–3 e depois Cards 4–7
3. **Etapa 7** (Pendências) — depende de 6 funcionar
4. **Etapas 8, 9, 10** podem ir em qualquer ordem após 7
5. **Etapa 11** sempre por último

### Se o Lovable errar em algo específico
Mande um prompt focado em vez de re-mandar a etapa toda:
> "Refaça só o modal PublicarCargaModal — o validador de qtd ≤ saldo está deixando passar valores maiores. Aqui está o código de referência: [cola PublicarCargaModal.tsx]"

### Onde os trechos do repo estão
Todos os caminhos referenciados estão neste repo, em:
- `lib/domain/*.ts` — lógica pura
- `lib/types.ts` — tipos
- `components/{cargas,reservas,contratos,checklist,dashboards,maps,financeiro,fiscal,ordens}/*.tsx`
- `app/(cerealista)/*` e `app/(transportadora)/*` — composição das telas
- `supabase/migrations/*.sql` — schema completo
