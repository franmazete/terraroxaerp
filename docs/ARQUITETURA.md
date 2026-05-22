# Arquitetura — terraroxa

> Documento técnico. Para visão de produto, ver `PRODUTO.md`. Para setup, ver `README.md` + `SETUP_ETAPA_2_SUPABASE.md`.

## Decisões fundamentais

### Domínio
- **KG canônico** em todo lugar (banco + UI). Convenções de mercado (sacas de 60kg) viram conversões na borda — nunca no armazenamento.
- **Fluxo central**: `Contrato → Carga → Reserva → OC` (Ordem de Carregamento). Uma OC é o ponto de coordenação fiscal/operacional/financeiro.
- **3 trilhas paralelas de status** na OC (Bloco I): operacional, fiscal, financeiro. Evoluem **independentemente** — a descarga pode estar OK enquanto o fiscal ainda processa troca de NF.
- **Single-tenant**: o sistema é da cerealista. Transportadoras são parceiros que entram via convite.

### Stack
- **Next.js 15 App Router** — rotas em `app/`, layouts aninhados, RSC quando possível
- **CSS Modules** + variáveis CSS no `globals.css` — sem framework CSS (sem Tailwind/MUI)
- **TypeScript strict** — `noEmit` em CI; tipos em `lib/types.ts`
- **Supabase** com modo dual — o app **funciona em mock sem ele**, e detecta automaticamente quando `.env.local` está completo

### Estado
- **Etapa 1 (atual)**: `lib/data-store.tsx` mantém TUDO em React state via Context. Mutations encadeadas; pendências disparadas por gancho (`anexarAutorizacaoCarregamento` resolve "anexar_autorização" e cria "anexar_ticket_carreg").
- **Etapa 2 (B1-B4)**: substitui pelo Supabase. Queries via `lib/supabase/{client,server}.ts`. Realtime channels para o sino do J.12.

## Glossário PT-BR

| Termo | Definição |
|---|---|
| **NF** | Nota Fiscal (eletrônica). Documento fiscal de venda da cerealista para o comprador. |
| **CT-e** | Conhecimento de Transporte Eletrônico. Documento da transp comprovando o frete. |
| **Romaneio** | Documento de pesagem (bruto / tara / líquido). |
| **Quebra** | Diferença entre peso carregado (origem) e descarregado (destino). Limite operacional: **0,5%**. Acima exige justificativa. |
| **Refugo** | Cliente recusa a carga no destino. Pausa o fluxo até cerealista confirmar; depois transp anexa CT-e de retorno. |
| **Carga** | Quantidade publicada a partir de um contrato. Transps reservam parcelas. |
| **Reserva** | Compromisso de uma transp de transportar uma quantidade de uma carga. |
| **OC** | Ordem de Carregamento. Gerada quando a transp anexa a "autorização de carregamento" da reserva aprovada. |
| **Autorização de carregamento** | Documento da transp dando OK pro motorista carregar na fazenda. |
| **RNTRC** | Registro Nacional dos Transportadores Rodoviários de Cargas. Obrigatório pra emitir CT-e. |
| **Saca** | Unidade de mercado: 60kg. Usada em valores (R$/saca), nunca em pesos. |
| **SLA** | Service Level Agreement — prazo máximo de cada pendência por categoria. |
| **Allowlist** | Lista opcional de transps autorizadas a reservar uma carga específica. |

## Entidades-chave

```
Produtor ──→ Local (fazenda)
   └────────→ Contrato ──→ Carga ──→ Reserva ──→ Autorização → OC
                  ↓             ↓                              ↓
              Cliente,      Allowlist                      3 trilhas
              Destino       (transps)                      operacional / fiscal / financeiro

Motorista (global) ⇄ N:N ⇄ Transportadora
Veículo   (global) ⇄ N:N ⇄ Transportadora
```

### N:N (Bloco G)
Motoristas e veículos são **globais** (identificados por CPF/placa). Um autônomo pode rodar pra várias transps — modelado como `transp_ids: string[]` (no mock) ou tabela de junção (Supabase).

## Fluxo sequencial do Bloco J (gating)

```
1.  TRANSP   anexa autorização         → gera OC
2.  TRANSP   anexa ticket carreg + peso → status_operacional: carregando
3.  TRANSP   anexa laudo               (opcional)
4.  LOGÍST   anexa NF                  → status_fiscal: nf_recebida
5.  LOGÍST   anexa agendamento destino
6.  TRANSP   anexa CT-e                → status_operacional: em_transito + status_fiscal: cte_recebido
7.  TRANSP   registra descarga
        ┌─────────────────────────────┐
        │ Se refugada (J.6):          │
        │ 7a. TRANSP avisa            │
        │ 7b. LOGÍST confirma/rejeita │
        │ 8.  TRANSP anexa CT-e retorno │
        │ 9.  TRANSP anexa estadia    (opcional) │
        └─────────────────────────────┘
10. FISCAL  calcula quebra (alerta > 0.5%) → status_operacional: operacional_concluido
11. FISCAL  valida descarga (auto se quebra OK)
12. TRANSP  anexa fatura dos CT-es     → IA confere automaticamente
13. FISCAL  confere resultado da IA    → libera financeiro
14. FINANC  paga                        → status_financeiro: pago + status: finalizada
```

Cada passo cria/resolve uma pendência (ver `lib/domain/sla.ts`). Pendências têm SLA em horas e filtragem por setor + transp_id.

## Sistema de pendências (Bloco I.7)

`lib/domain/sla.ts`:
- `SLA_PADRAO` — tabela com horas + setor + descrição por categoria
- `calcSeveridade(p, agora)` — retorna `no_prazo / proximo / vencendo / atrasada / critica`
- `criarPendencia(input)` — factory que retorna `Omit<Pendencia, "id">`

Setores: `comercial | logistica | fiscal | financeiro | transportadora`.

**Filtro por transp_id (Bloco J.1)**: pendências do setor "transportadora" carregam o `transp_id` da reserva → uma transp NUNCA vê pendências de outra.

## Modo dual: Mock OU Supabase

`lib/auth/AuthContext.tsx` detecta `NEXT_PUBLIC_SUPABASE_URL` no client. Se preenchido e diferente do exemplo, troca **automaticamente** de mock para Supabase real:

- `login(email, senha)` → `supabase.auth.signInWithPassword` ou tabela de senhas mock
- `logout()` → `supabase.auth.signOut` ou `localStorage.removeItem`
- Session restaurada via `getSession()` + `onAuthStateChange`

O mesmo padrão aplicar ao `/auth/invite`, `/esqueci-senha`, etc — toast warn se Supabase não configurado.

## Camadas

```
app/            ← rotas + server actions
  ↓
components/     ← UI reaproveitável (puro)
  ↓
lib/domain/     ← Regras de negócio (puras, testáveis)
  ↓
lib/data-store  ← Estado in-memory (Etapa 1) | Supabase (Etapa 2+)
  ↓
lib/types.ts    ← Tipos canônicos
```

## Convenções

- **Sem `any`** explícito (TS strict + ESLint). Use `unknown` + narrowing.
- **Imports**: paths absolutos via `@/`. Componentes UI base em `components/ui/`.
- **CSS**: variáveis em `globals.css`. Cores em `--g600` / `--a600` / `--b600` etc. Sem inline-style pra cores (use vars).
- **PT-BR** em strings de UI e nomes de domínio. Variáveis em inglês (`onClick`, `useEffect`, etc.).
- **KG canônico**. Conversões saca↔kg via constante `KG_POR_SACA = 60`.
- **Datas**: ISO string no banco/store. `fmtDate` para exibição. `toLocaleDateString("pt-BR")` em casos pontuais.
- **Sem `alert/confirm/prompt`** — use `useToast()` ou `useConfirm()` (Bloco K).
- **NF antiga NUNCA apagada** — substituição mantém histórico (status: `substituida`).
- **service_role NUNCA no client** — só em `createAdminClient()` (server-side).

## Bundle & performance

- **First Load shared**: 103 kB
- **Maior rota**: `/ordens/[id]` em 209 kB (após code-split do Bloco N.3 — era 341 kB)
- Modais do checklist e `jsPDF` carregados sob demanda via `next/dynamic`
- Recharts em chunk separado (carrega só em `/dashboard` e `/relatorios`)

## Testes

Não há testes automatizados ainda. O bloco J.13 (`docs/ROTEIRO_TESTE_BLOCO_J.md`) tem 10 seções de teste manual cobrindo o fluxo principal. Testes E2E (Playwright) virão quando o time crescer.

## Próximos passos

Ver `docs/PLANO_PROXIMOS_BLOCOS.md` — agora consolidado: blocos K, L, M, N concluídos. Falta apenas a **Etapa 2 (Supabase)** com seus 4 sub-blocos (B1-B4).
