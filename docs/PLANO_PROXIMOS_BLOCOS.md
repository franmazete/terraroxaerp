# Plano de próximos blocos — terraroxa

**Estado atual** (2026-05-20): Bloco A–J completos em mock + Etapa 2 (Supabase) com código pronto mas **não aplicado** (por decisão — fica por último).

Build de produção atual: ✅ 19 páginas, 0 erros, 273 kB max First Load (em `/ordens/[id]`).

---

## O que ainda falta no produto

### 1. Tratamento de erros e UX
- **122 `alert()` e `confirm()`** espalhados em 32 arquivos — UX precária.
- Sem `Toast` global, sem `ConfirmDialog`, sem `LoadingButton`.
- Erros de mutation são silenciosos quando o `data-store` retorna `null`.

### 2. Features operacionais incompletas
- `/auth/invite` existe como endpoint, mas **não tem UI** para o admin convidar.
- `/esqueci-senha` mencionado no middleware, mas a página não existe.
- **Contratos**: só "disponibilizar" — não tem editar valor/quantidade/cliente.
- **Cancelar OC**: status existe (`cancelada`), mas não tem botão acessível.
- **Substituir documento**: função no `data-store` existe, sem UI.
- **Validar NF (fiscal)**: anexa NF mas não tem botão "validar" explícito.
- **Detalhe de Local**: só listagem; um Local pode merecer página própria com mapa grande.
- **Reserva como página**: hoje é só modal — em mobile fica ruim.

### 3. Relatórios e analytics
- Dashboards atuais têm StatBox, mas **zero gráficos**.
- Sem relatórios de período (volume mês, valor pago/mês, quebra acumulada).
- Sem export CSV/Excel das listagens.
- Filtros nas listagens são simples (search + 1-2 selects).

### 4. Qualidade técnica
- Zero testes (unit/E2E).
- Não auditamos acessibilidade nem mobile.
- `/ordens/[id]` é 273 kB First Load (alto — código-split do checklist/modais ajudaria).
- README ainda básico, sem doc de arquitetura.
- HTML legado em `legacy/` ainda no repo (~1.261 linhas mortas).
- Nenhum CI configurado.

### 5. Etapa 2 — Supabase
- Código pronto em `supabase/migrations/` (3 arquivos: schema, RLS, storage).
- `lib/auth/AuthContext.tsx` em modo dual (mock OU Supabase).
- Falta: aplicar no projeto Cloud + B1-B4 (migrar `data-store` de in-memory pra queries).
- **Mantido por último por decisão sua.**

---

## Proposta: 4 blocos antes do Supabase

### Bloco K — UX/Qualidade (substituir alerts + toasts + loading)
**Por que primeiro:** é a fricção mais visível no uso diário. 122 `alert()` é UX de protótipo, não de SaaS.

**Entregas:**
- `<Toast>` global + `useToast()` hook
- `<ConfirmDialog>` controlado
- Substituir os ~122 alerts em batches: mutations bem-sucedidas → toast; erros → toast vermelho; deletes → confirm dialog
- `<LoadingButton>` reutilizável + loading state em todos submits de modal
- Erros consistentes: todas as mutations que retornam `null` agora viram toast vermelho explicando

**Esforço:** médio — refactor amplo, mas mecânico.

---

### Bloco L — Features operacionais que faltam
**Por que:** completa o fluxo onde o user ainda esbarra em "isso não existe".

**Entregas:**
- **L.1 — Convidar usuário (UI)**: tela em `/configuracoes/usuarios` com form (email, nome, perfil, transp_id se transp). Chama `POST /auth/invite`.
- **L.2 — Esqueci minha senha**: página `/esqueci-senha` + `supabase.auth.resetPasswordForEmail`.
- **L.3 — Editar contrato**: modal de edição completo (valor, qtd, cliente, datas, observações).
- **L.4 — Cancelar OC**: botão "Cancelar OC" no detalhe + modal com motivo obrigatório.
- **L.5 — Substituir documento (UI)**: botão "📋 Substituir" no CentralDocumentosTab quando user tem permissão.
- **L.6 — Validar NF (fiscal)**: card "NF" no detalhe da OC ganha botão "✓ Validar / ✗ Solicitar Troca".
- **L.7 — Detalhe de Local com mapa**: nova rota `/cadastros/locais/[id]` com `MapaPlaceholder` grande.

**Esforço:** alto — várias frentes, mas cada uma é pequena.

---

### Bloco M — Relatórios e analytics
**Por que:** dashboards atuais mostram contagem, mas dono quer ver tendência.

**Entregas:**
- **M.1 — Recharts instalado** + componentes `<BarChart>`, `<LineChart>`, `<PieChart>` wrapper
- **M.2 — Dashboard Comercial reforçado**: volume por mês, top 5 transps por volume, top 5 produtores por contrato, ticket médio de carga.
- **M.3 — Relatório de operações por período**: novo `/relatorios` com filtros (de–até, transp, produto), tabela detalhada + total.
- **M.4 — Quebra acumulada / por transp**: relatório fiscal — qual transp tem mais quebra média?
- **M.5 — Export CSV** em listagens (cargas, ordens, pendências, contratos)
- **M.6 — Filtros avançados** em ordens/pendências (status × setor × transp × período).

**Esforço:** alto — depende do appetite por gráficos. Pode entrar em fases.

---

### Bloco N — Polimento e produção
**Por que:** preparar pro mundo real depois da Etapa 2.

**Entregas:**
- **N.1 — Mobile responsivo**: revisar todos os layouts grid-2/grid-4. Algumas listagens travam < 600px.
- **N.2 — Acessibilidade básica**: foco visível, ARIA labels em botões só com ícone, contrastes mínimos.
- **N.3 — Code-split do `/ordens/[id]`**: 7 modais carregados sob demanda via `next/dynamic`. Meta: < 200 kB First Load.
- **N.4 — README + ARQUITETURA.md**: setup local, estrutura de pastas, glossário PT-BR (NF, CT-e, quebra, etc.).
- **N.5 — Limpar legacy/**: remover HTML mock antigo do repo.
- **N.6 — CI GitHub Actions**: lint + typecheck + build em PR.
- **N.7 — Tags + CHANGELOG**: marcar v0.1.0 (fim do Bloco J) e versionar daqui pra frente.

**Esforço:** médio — paralelizável.

---

## Etapa 2 — Supabase (por último)

- Aplicar as 3 migrations no Cloud
- Criar admin inicial
- **B1**: queries de leitura via `supabase.from()` (substituir `useState` por fetch + cache)
- **B2**: mutations no banco antes de atualizar cache local
- **B3**: Realtime channels — sino do J.12 vira instant ao invés de re-render local
- **B4**: Upload real no Storage (substitui `pending-upload://`)

---

## Ordem sugerida

```
K (UX)  →  L (features)  →  M (relatórios)  →  N (polimento)  →  Supabase
   |          |               |                  |                  |
  alto      alto             médio              médio             alto
  impacto   impacto         impacto            impacto           impacto
  rápido    medio           medio              lento             muito grande
```

**Recomendação:** começar por **K** porque cada outro bloco vai herdar a UX nova (toasts/confirms). Se começar por L, vamos retrabalhar os modais quando K chegar.

Alternativa: se quiser feedback mais rápido pra usuário final usar, vai direto para **L** (features que faltam) e refatora UX (K) depois — funciona, mas vai gerar alguns alerts a mais que terão que ser refeitos.

---

## O que NÃO está aqui (descartado por escopo)

- **i18n**: tudo PT-BR — não precisamos.
- **Testes E2E**: o Bloco J.13 já documenta roteiro manual. Playwright/Vitest virá só quando o time crescer.
- **PWA / app mobile**: web responsivo cobre o caso de uso atual.
- **Multi-tenant**: cliente é single-tenant por design.
