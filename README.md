# terraroxa — Portal de Cargas

> SaaS de portal logístico para cerealistas do agronegócio. TMS + gestão documental + fiscal + financeiro. Conecta cerealista (logística/comercial/fiscal/financeiro) com transportadoras parceiras.

## Stack

- **Next.js 15** (App Router) + **React 19** + **TypeScript** (strict)
- **CSS Modules** + variáveis CSS (paleta verde/âmbar do agro)
- **Supabase** (Postgres + Auth + Storage) — modo dual: o app funciona em mock sem Supabase configurado
- **Recharts** — gráficos do Bloco M
- **jsPDF** — geração de PDF da OC
- **@dnd-kit** — drag-and-drop do Kanban

## Como rodar

```bash
npm install
npm run dev
```

Abra http://localhost:3000.

### Modo mock (default — sem Supabase)

A aplicação detecta automaticamente se o `.env.local` está configurado. Sem ele, roda em memória com seeds. Credenciais demo:

- **Cerealista:** `cerealista` / `logistica` (ou e-mail: `ana@terraroxa.com.br`, `marina@terraroxa.com.br`, `rodrigo@terraroxa.com.br`)
- **Transportadora:** `transportadora` / `carregar` (depois selecione a transp)
- **Admin:** `carlos@terraroxa.com.br` / `admin`

### Modo Supabase real

Veja `docs/SETUP_ETAPA_2_SUPABASE.md` para o guia completo. Resumo:

1. Copie `.env.local.example` → `.env.local` e preencha
2. `npx supabase link --project-ref SEU_PROJETO`
3. `npx supabase db push` (aplica as 3 migrations em `supabase/migrations/`)
4. Crie o primeiro admin no Studio (manual), depois convide outros via `/auth/invite`

## Estrutura

```
app/                        Next.js App Router
  (auth)/                   login, esqueci-senha, definir-senha
  (cerealista)/             dashboard + 5 telas internas
  (transportadora)/         painel + 3 telas
  ordens/[id]/              detalhe da OC (4 abas)
  cadastros/                CRUD de 8 entidades base
  configuracoes/            usuários, permissões
  pendencias/               Central de pendências (SLA)
  relatorios/               Operações por período + quebra por transp
  auth/callback             OAuth/magic link handler
  auth/invite               Admin envia convite

components/
  ui/                       Botão, Card, Modal, Toast, ConfirmDialog, …
  layout/                   AppShell, Topbar, NavMenu, NotificacoesBell
  cadastros/                8 views de cadastro
  contratos/                Lançar + Editar
  cargas/                   PublicarCarga + CargaCard
  reservas/                 Reservar + Anexar Autorização + Detalhe
  ordens/                   LancarOrdemModal + CentralDocumentosTab
  fiscal/                   TrocaNotaSection + DescargaSection
  financeiro/               FaturamentoSection + ResultadoIAFatura
  checklist/                ChecklistOC + 8 modais do fluxo Bloco J
  charts/                   BarChart + LineChart + PieChart (recharts)
  maps/                     MapaPlaceholder

lib/
  types.ts                  Entidades do domínio (~30)
  data-store.tsx            Mock store + ~40 mutations (substituirá por Supabase)
  mock-data.ts              Seeds
  auth/AuthContext.tsx      Mock OU Supabase (modo dual)
  supabase/                 Client/server/middleware/admin
  domain/                   Regras puras: saldo, status-oc, sla, checklist, ia-fatura, geo, csv, format
  pdf/oc-pdf.ts             Gerador jsPDF

supabase/
  migrations/               3 SQL files (schema + RLS + storage)
  config.toml               Config do CLI

docs/
  PRODUTO.md                Visão de produto (20 seções)
  ARQUITETURA.md            Arquitetura técnica + glossário
  SETUP_ETAPA_2_SUPABASE.md Guia de aplicação das migrations
  ROTEIRO_TESTE_BLOCO_J.md  Teste manual do gating sequencial
  PLANO_PROXIMOS_BLOCOS.md  Roadmap K/L/M/N + Supabase
  CHANGELOG.md              Histórico das versões
```

## Comandos

```bash
npm run dev          # Dev server
npm run build        # Build de produção
npm run start        # Servidor de produção
npx tsc --noEmit     # Type-check sem emitir
```

## Plano de etapas

1. ✅ **Bloco A–J** — Mock completo (TMS + fiscal + financeiro + dashboards + checklist sequencial + refugo + quebra + PDF + Maps + IA + notificações)
2. ✅ **Bloco K** — UX (Toast, ConfirmDialog, LoadingButton — 0 alerts em produção)
3. ✅ **Bloco L** — Features que faltavam (convidar usuário, esqueci senha, editar contrato, cancelar OC, validar NF, detalhe Local)
4. ✅ **Bloco M** — Relatórios e gráficos (Recharts + relatório por período + quebra por transp + export CSV)
5. ✅ **Bloco N** — Polimento (mobile, a11y, code-split, README, CI, CHANGELOG)
6. ⏳ **Etapa 2 (Supabase)** — Aplicar migrations + B1-B4 (queries reais + Realtime + upload)

## Documentação

Comece por **`docs/ARQUITETURA.md`** para entender as decisões. Para visão de produto, **`docs/PRODUTO.md`**.
