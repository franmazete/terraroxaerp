# Changelog

Todas as mudanças notáveis. Versões seguem [SemVer](https://semver.org/lang/pt-BR/).

## [0.1.0] — 2026-05-20 — Mock completo

Primeira marca de versão. App 100% funcional em memória, pronto para conectar ao Supabase (`docs/SETUP_ETAPA_2_SUPABASE.md`).

### Fluxos completos

- **TMS sequencial** (Bloco J): 15 passos do checklist (autorização → ticket → laudo opcional → NF → agendamento → CT-e → descarga → quebra → fatura+IA → conferência fiscal → financeiro → pagamento)
- **Fluxo refugado**: avisar → confirmar/rejeitar → CT-e retorno → estadia
- **3 trilhas paralelas de status** na OC: operacional / fiscal / financeiro
- **2 portais** (cerealista, transportadora) com 8 perfis (admin, comercial, logística, fiscal, financeiro, transp, motorista, cliente)
- **Substituição de NF** auditável (status: substituida + motivo + trocada_em)
- **IA mock** confere fatura × CT-e em 4 campos (valor, transp, prestador, número)
- **Sino de notificações** entre portais com pulse animado, filtrado por setor + transp_id

### Cadastros

- 8 entidades base: usuários, transportadoras, motoristas (global, N:N), veículos (global, N:N), produtores, clientes, terminais, locais (com lat/lng e contato), produtos
- Detector de duplicata por CPF/placa com modal de "vincular ao existente"
- Detalhe de Local (`/cadastros/locais/[id]`) com mapa grande + stats relacionados

### Domínio

- **KG canônico** em tudo
- Cálculo de quebra com alerta > 0,5% (justificativa obrigatória)
- Cálculo de faturamento automático (peso_descarga × frete/t)
- Conversões saca↔kg via constante (60kg)
- Sistema de pendências com SLA por categoria + severidade (no_prazo/proximo/vencendo/atrasada/critica)

### Relatórios e analytics (Bloco M)

- Dashboard Comercial com 4 gráficos (Recharts): linha de volume/mês, barras top-5 transps + top-5 produtores, donut por produto
- Página `/relatorios` com 2 abas: Operações por período + Quebra por transp
- Export CSV em ordens, pendências, contratos, relatórios
- Filtros avançados em /ordens (status × origem × transp × período)

### Documentos e integrações (mock-first)

- **PDF da OC** real via jsPDF (cabeçalho, 5 seções, multi-página, rodapé)
- **WhatsApp/Email** mock listando destinatários com contatos cadastrados
- **Google Maps** placeholder com distância haversine + link externo
- **Central Documental** unificada (14 categorias em 6 grupos) com substituição versionada

### Segurança e auth

- **Modo dual** mock/Supabase automático
- Fluxo de convite por e-mail via `/auth/invite` (admin only)
- Esqueci minha senha via `/esqueci-senha`
- Definir senha via `/definir-senha` (pós-convite)
- 3 migrations SQL prontas (schema + RLS + storage buckets)

### UX e qualidade (Bloco K)

- **Toast global** + **ConfirmDialog** + **LoadingButton**
- **Zero `alert/confirm/prompt`** em produção (~122 substituídos)
- Validações com feedback inline (toast.warn) + sucesso (toast.success) + erro (toast.error)

### Polimento (Bloco N)

- Layouts responsivos (breakpoints 600px e 900px)
- Acessibilidade básica: foco visível, skip-link, ARIA labels em pontos críticos
- Code-split do `/ordens/[id]`: **341 kB → 209 kB** First Load (−39%)
- README + ARQUITETURA.md com glossário PT-BR
- CI GitHub Actions (lint + typecheck + build em PRs)

### Métricas

```
Total: 22 páginas
First Load JS shared: 103 kB

Maiores rotas:
  /ordens/[id]                209 kB (depois do code-split)
  /relatorios                 239 kB (Recharts + tabelas)
  /dashboard                  321 kB (Recharts no DashComercial)
  /cadastros/[entity]         195 kB
```

---

## [Pendente] — Etapa 2 (Supabase real)

Código pronto em `supabase/migrations/`. Próximos blocos quando aplicado:

- **B1** — Queries de leitura (substituir `useState` por `supabase.from()`)
- **B2** — Mutations gravam no banco antes do cache local
- **B3** — Realtime channels (sino do J.12 ao vivo)
- **B4** — Upload real no Storage (substitui `pending-upload://`)
