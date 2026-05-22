# terraroxa — Portal Logístico Agro/Portuário

> **Documento de produto · v1.0** · maio/2026
>
> Plataforma SaaS de gestão operacional, documental e fiscal entre cerealistas e transportadoras parceiras.

---

## 1. Visão Geral do Produto

### O que é

**terraroxa** é uma plataforma SaaS de gestão operacional ponta-a-ponta para o ciclo de **compra/venda de grãos com escoamento logístico até porto/cliente**. Conecta a operação interna da cerealista (comercial, logística, fiscal, financeiro) com suas transportadoras parceiras, centralizando rastreabilidade, gestão documental, workflow fiscal (incluindo **troca de nota**), SLAs de pendências e auditoria.

### Posicionamento

Não é apenas um TMS (controle de frete). É uma **plataforma de orquestração documental e fiscal** com workflow operacional logístico embutido. O diferencial é a integração de 3 disciplinas que hoje vivem em planilhas, e-mail e WhatsApp:

1. **Operacional** (carregamento, trânsito, descarga)
2. **Documental** (NF, CT-e, ticket, romaneio, autorização, fatura — versionados)
3. **Fiscal/financeiro** (validação NF, troca de nota, faturamento, pagamento)

### Segmento

Cerealistas de médio porte com operação de exportação ou de venda a indústrias. Frota terceirizada (parceiras autônomas) atendendo trajetos longos (interior MT/GO/MS → portos de Santos, Paranaguá, Rondonópolis).

### Problema atual do mercado

| Hoje | Dor |
|---|---|
| Operação em planilhas, e-mail, WhatsApp | Rastreabilidade zero, retrabalho, perda de documento |
| NF/CT-e por e-mail individual | Troca de nota sem histórico, divergência fiscal |
| Logística sem visão consolidada | Atraso descoberto tarde demais |
| Fiscal recebe doc fora do contexto | Validação demorada, faturamento atrasa |
| Sem SLA de pendências | "Esquecimentos" gerando perdas |

### Solução

| Camada | Entrega |
|---|---|
| **Operacional** | Workflow visual da OC com status independentes (operacional/fiscal/financeiro). Kanban e timeline por carga |
| **Documental** | Central única por operação. Cada doc tem versão, auditoria, status (pendente/aprovado/rejeitado) e SLA |
| **Fiscal** | Troca de NF como subfluxo nativo. CT-e nunca substituído automaticamente. Validação rastreável |
| **Financeiro** | Cálculo automático de frete (peso descarregado × valor/ton). Conferência. Pagamento |
| **Permissões** | 4 setores na cerealista (comercial/logística/fiscal/financeiro) + transportadora externa. Cada setor com pendências, dashboards e ações próprias |
| **Auditoria** | Log com `valor_antes`/`valor_depois`. Nada apagado fisicamente. Versionamento de documentos |

---

## 2. Objetivo do Sistema

### Objetivo principal

Reduzir o **tempo entre carregamento e faturamento** e eliminar a **perda de documentos fiscais e operacionais**, dando visibilidade em tempo real a todas as partes envolvidas (com permissões granulares).

### Objetivos secundários

1. Centralizar a comunicação documental que hoje vive em e-mail/WhatsApp
2. Padronizar a troca de NF com workflow auditável
3. Permitir SLA de pendências por setor (cobrar quem está parado)
4. Suportar operação multiempresa (várias transportadoras parceiras)
5. Histórico operacional completo por carga/contrato

### Métricas de sucesso (KPIs)

| Métrica | Meta |
|---|---|
| Tempo médio carregamento → faturamento liberado | ↓ 40% vs. processo manual |
| % de NFs trocadas com histórico completo | 100% |
| Pendências resolvidas dentro do SLA | > 85% |
| Operações com 100% docs anexados | > 95% |
| Adesão das transportadoras parceiras | > 80% no 1º trimestre |

---

## 3. Fluxo Operacional Detalhado

### Visão completa do ciclo

```
[Comercial cerealista]
    Cadastra contrato (compra ou venda)
         ↓
    Disponibiliza contrato p/ publicação
         ↓
    Publica carga (escolhe quais transportadoras podem reservar) ★
         ↓
─────────────────────────────────────────────
[Transportadora]
    Visualiza carga (só se estiver na allowlist)
         ↓
    Reserva (informa motorista, veículo, RNTRC, datas)
         ↓
─────────────────────────────────────────────
[Logística cerealista]
    Avalia reserva
         ↓
   ┌────────────┬───────────┐
   ↓            ↓
[Reprovada]  [Aprovada]
                ↓
─────────────────────────────────────────────
[Transportadora]
    Vê status "Aprovada — confirme operação"
         ↓
    Confirma operação
         ↓
    Anexa AUTORIZAÇÃO DE CARREGAMENTO ★
         ↓
    ⚡ Sistema gera OC AUTOMATICAMENTE
─────────────────────────────────────────────
[Logística]
    Acompanha:
      → carregando (fazenda anexa ticket carregamento)
      → em trânsito
      → aguardando descarga
      → descarregado (porto anexa ticket descarga, canhoto, peso)
─────────────────────────────────────────────
[Fiscal]
    Anexa NF do cliente (recebida por fora)
         ↓
   ┌─ NF ok? ─┐
   ↓          ↓
 [valida]   [solicita troca]
              ↓
        Cliente envia nova NF
              ↓
        Fiscal anexa nova NF
              ↓
        Aprova/rejeita troca
              ↓
        NF antiga vira "substituída" (histórico mantido)
              ↓
      [Volta a ser validada]
─────────────────────────────────────────────
[Transportadora]
    Anexa CT-e
         ↓
[Fiscal]
    Libera faturamento
─────────────────────────────────────────────
[Sistema]
    Calcula valor = frete_ton × (peso_descarregado / 1000)
         ↓
[Transportadora]
    Confere e anexa fatura como comprovante
─────────────────────────────────────────────
[Financeiro]
    Processa pagamento
         ↓
    [Finalizado]
```

★ = novidade vs. plano anterior

### Pontos-chave do fluxo

1. **OC só é gerada APÓS a autorização de carregamento ser anexada** (não na aprovação da reserva — mudança importante)
2. **Comercial controla quais transportadoras podem reservar cada carga** (allowlist por publicação)
3. **3 trilhas paralelas** após descarga: operacional já em "descarregado", fiscal pode estar em "troca solicitada", financeiro pode estar em "aguardando CT-e"
4. **Nenhum status bloqueia outro** — descarga não espera fiscal, fiscal não espera operacional

---

## 4. Fluxo Fiscal

```
[NF original recebida pelo fiscal por fora]
         ↓
[Fiscal anexa NF na central documental da OC]
         ↓
   Status: nf_recebida
         ↓
[Fiscal analisa]
         ↓
   ┌─ Está correta? ─┐
   ↓                 ↓
 [Valida]      [Solicita troca]
   ↓                 ↓
[nf_validada]   Cria SolicitacaoTrocaNota
                     ↓ motivo, prazo, responsável
                Status NF: troca_solicitada
                     ↓
                [Cliente envia nova NF via e-mail/whatsapp]
                     ↓
                [Fiscal anexa nova NF]
                     ↓
                [Fiscal aprova ou rejeita a substituição]
                     ↓
                ┌─ Aprovou? ─┐
                ↓            ↓
            NF antiga    [Rejeita]
            recebe       Mantém NF antiga
            status="substituida" como ativa
            + ponteiros
            + auditoria
                ↓
            NF nova vira "ativa"
                ↓
            [Volta para validação]
                ↓
            nf_validada
```

### Regras fiscais inquebráveis

| Regra | Aplicação |
|---|---|
| NF antiga NUNCA é apagada | Marcada como `substituida` + ponteiro para a nova |
| CT-e NÃO é substituído automaticamente | Mudança manual via ação dedicada do fiscal |
| Toda troca tem motivo obrigatório | Validação no form |
| Toda troca grava `quem`, `quando`, `valor_antes`, `valor_depois` | Trigger no DB |
| Operação pode ter N NFs no histórico, 1 ativa | Constraint via status |
| Fiscal pode rejeitar a substituição | Workflow tem aprovação |

---

## 5. Fluxo Documental

### Categorias de documentos (8)

| Categoria | Documentos | Quem anexa | Quando |
|---|---|---|---|
| **Pré-operacional** | Autorização de carregamento | Transportadora | Após aprovação da reserva |
| **Carregamento** | Ticket carregamento · Comprovante fazenda · Peso origem | Logística (com base no que fazenda manda) | Carregamento concluído |
| **Trajeto** | (sem docs próprios) | — | Em trânsito |
| **Descarga** | Ticket descarga · Laudo classificação · Comprovante porto · Canhoto · Peso descarga | Logística (com base no que porto/cliente manda) | Descarga concluída |
| **Fiscal NF** | NF original · NFs substitutas (histórico) | Fiscal (recebida por fora) | Após carregamento |
| **Fiscal CT-e** | CT-e (1 ativo) | Transportadora | Após trânsito iniciado |
| **Financeiro** | Fatura da transportadora · Comprovante de pagamento | Transportadora + Financeiro | Após liberação faturamento |
| **Outros** | Anexos livres | Qualquer setor | Sempre |

### Metadados por documento (todos)

```
DocumentoOperacao {
  id, oc_id
  categoria, tipo (subcategoria)
  arquivo_url, nome_original, tamanho_bytes, mime_type
  versao: int (1, 2, 3 — incremental quando substituído)
  versao_anterior_id?: FK (cadeia de versões)
  status: 'enviado' | 'em_analise' | 'aprovado' | 'rejeitado' | 'substituido'
  observacao?: string (motivo aprov/rejeição)
  enviado_em, enviado_por_user_id
  decidido_em?, decidido_por_user_id?
  ativo: boolean (false quando substituído ou cancelado)
}
```

### Central documental (por OC)

UI única que organiza por categoria + mostra histórico + permite ações conforme perfil.

```
┌─ OC-2026-001 — Central Documental ──────────────────────────────┐
│                                                                  │
│ 📦 Pré-operacional                       [completo / 1 pendente] │
│   ✅ Autorização de Carregamento v1                              │
│      ↳ Transp Cerrado · 02/04 14:23                              │
│                                                                  │
│ 🚛 Carregamento                          [3/3 docs]              │
│   ✅ Ticket Carregamento — 42.500 kg                             │
│   ✅ Comprovante Fazenda                                         │
│   ✅ Peso Origem (romaneio)                                      │
│                                                                  │
│ 🏗️  Descarga                              [3/5 docs · 2 pendentes]│
│   ✅ Ticket Descarga — 40.300 kg líquido                         │
│   ✅ Comprovante Porto                                           │
│   ✅ Canhoto                                                     │
│   ⏸ Laudo Classificação (aguardando porto)                       │
│   ⏸ Peso Descarga oficial                                        │
│                                                                  │
│ 📋 Fiscal — NFs                          [2 versões · 1 ativa]   │
│   ❌ NF-001 v1 [SUBSTITUÍDA em 12/04]                            │
│      Motivo: "CFOP errado — 5102 deveria ser 6102"               │
│      Por: Marina (fiscal) · trocada por NF-002                   │
│   ✅ NF-002 v1 [ATIVA] · R$ 29.100                               │
│      ↳ substitui NF-001                                          │
│                                                                  │
│ 🧾 Fiscal — CT-e                                                 │
│   ✅ CT-e 000456 v1 [autorizado SEFAZ em 13/04]                  │
│                                                                  │
│ 💰 Financeiro                            [1/2 docs]              │
│   ⏸ Fatura Transportadora (cálculo: R$ 2.619,50)                 │
│   ⏸ Comprovante Pagamento                                        │
└──────────────────────────────────────────────────────────────────┘
```

---

## 6. Fluxo Financeiro

```
[Descarga confirmada]
         ↓
[Fiscal valida NF ativa + CT-e]
         ↓
[Fiscal libera faturamento]
         ↓
Sistema calcula:
   peso_base_kg  = peso_descarregado_kg
   valor_calculado = (peso_base_kg / 1000) × frete_ton_da_reserva
         ↓
[Transportadora vê valor calculado no seu painel]
         ↓
[Transportadora confere]
         ↓
   ┌─ Concorda com o valor? ─┐
   ↓                          ↓
[Confirma]                 [Justifica divergência]
   ↓                          ↓
[Transp anexa fatura]      [Financeiro analisa]
   ↓                          ↓
[Status: faturado]         (aprova/rejeita ajuste)
   ↓
[Financeiro confere docs + valor]
   ↓
[Financeiro anexa comprovante pagamento]
   ↓
[Status: pago]
   ↓
[Finalizado]
```

### Regras financeiras

| Regra | Aplicação |
|---|---|
| Só libera faturamento se: descarga confirmada + NF ativa validada + CT-e anexado | Validação no botão |
| Valor calculado é a base, ajuste manual exige justificativa | Form |
| Divergência > X% gera alerta para financeiro | SLA |
| Pagamento finaliza a OC | Última transição |

---

## 7. Estrutura de Permissões

### 2 portais × perfis

```
┌─ PORTAL CEREALISTA ────────────────────────┐
│                                            │
│  • admin (master)                          │
│  • comercial   ← define quais transps     │
│                  podem reservar a carga    │
│  • logistica   ← aprova reservas,         │
│                  acompanha operacional     │
│  • fiscal      ← NF, CT-e, troca de nota, │
│                  libera faturamento        │
│  • financeiro  ← cálculo, pagamento,      │
│                  finalização               │
│                                            │
└────────────────────────────────────────────┘

┌─ PORTAL TRANSPORTADORA ────────────────────┐
│                                            │
│  • transp_admin  ← gestão da empresa      │
│  • transp_operacional  ← reserva, anexa   │
│  • motorista     ← (opcional) vê sua OC   │
│                                            │
└────────────────────────────────────────────┘
```

### Matriz de permissões por setor da cerealista

| Módulo | Comercial | Logística | Fiscal | Financeiro | Admin |
|---|---|---|---|---|---|
| Contratos: criar/editar | ✅ | ❌ (só visualizar) | ❌ | ❌ visualizar | ✅ |
| Cargas: publicar | ✅ | ❌ | ❌ | ❌ | ✅ |
| Cargas: definir allowlist transps | ✅ | ❌ | ❌ | ❌ | ✅ |
| Reservas: aprovar/reprovar | ❌ | ✅ | ❌ | ❌ | ✅ |
| OC: acompanhar status operacional | ❌ visualizar | ✅ | ❌ visualizar | ❌ visualizar | ✅ |
| Anexar Ticket Carregamento | ❌ | ✅ | ❌ | ❌ | ✅ |
| Anexar Ticket Descarga | ❌ | ✅ | ❌ | ❌ | ✅ |
| Anexar NF | ❌ | ❌ | ✅ | ❌ | ✅ |
| Validar NF | ❌ | ❌ | ✅ | ❌ | ✅ |
| Solicitar troca NF | ❌ | ✅ pode solicitar | ✅ | ❌ | ✅ |
| Aprovar troca NF | ❌ | ❌ | ✅ | ❌ | ✅ |
| Liberar faturamento | ❌ | ❌ | ✅ | ❌ | ✅ |
| Anexar comprovante pagamento | ❌ | ❌ | ❌ | ✅ | ✅ |
| Finalizar OC | ❌ | ❌ | ❌ | ✅ | ✅ |
| Cadastros (transps, motoristas, etc) | ❌ | ✅ | ❌ visualizar | ❌ visualizar | ✅ |
| Usuários/Permissões | ❌ | ❌ | ❌ | ❌ | ✅ |

---

## 8. Estrutura de Telas

### Portal Cerealista — agrupamento por setor

**Navegação topbar:** Operação | Cadastros | Configurações *(igual hoje)*. Cada perfil só vê o que pode acessar.

**Operação** (filtrada por perfil):

| Tela | Comercial | Logística | Fiscal | Financeiro |
|---|---|---|---|---|
| Dashboard | KPIs comerciais | KPIs operacionais | KPIs fiscais | KPIs financeiros |
| Contratos | ✅ CRUD completo | ✅ visualizar | — | ✅ visualizar |
| Cargas | ✅ publicar | ✅ acompanhar | — | — |
| Reservas | ❌ | ✅ aprovar | — | — |
| Operações (OCs) | ✅ visualizar | ✅ acompanhar | ✅ visualizar fiscal | ✅ visualizar financeiro |
| **Central de Pendências** | ✅ minhas | ✅ minhas | ✅ minhas | ✅ minhas |
| Troca de Nota | — | ✅ solicitar | ✅ aprovar | — |
| Faturamento | — | — | ✅ liberar | ✅ processar |
| Histórico/Auditoria | ✅ | ✅ | ✅ | ✅ |

**Cadastros** (compartilhado, com filtros por permissão).

**Configurações** (admin only): Usuários · Permissões · Setores.

### Portal Transportadora

| Tela | Função |
|---|---|
| Painel | KPIs próprios (cargas aprovadas, em trânsito, pendências de doc) |
| Cargas Disponíveis | Só vê cargas onde a transp está na allowlist |
| Minhas Reservas | Status detalhado de cada reserva |
| Minhas Operações | OCs ativas com checklist de documentos |
| **Anexar Autorização** | Após aprovação da reserva |
| **Anexar CT-e** | Após trânsito iniciado |
| **Faturamento** | Vê valor calculado, confere, anexa fatura |
| Cadastros | Meus Motoristas + Meus Veículos |

### Telas-chave por sua importância

**1. Painel da Operação** (`/operacoes/[id]`) — A tela mais importante do sistema

```
┌─ OC-2026-001 ─────────────────────────────────────────────────────┐
│  [Sair]  [Imprimir]  [Histórico/Auditoria]                        │
│                                                                   │
│  Contrato: CT-001 · Transp Cerrado · Soja · 40.300 kg            │
│  Fazenda Boa Esperança / MT → Porto de Santos / SP                │
│                                                                   │
│  🔄 STATUS                                                        │
│  Operacional: 🟢 Descarregado                                     │
│  Fiscal:      🟡 Troca NF aprovada — aguardando nova NF           │
│  Financeiro:  ⚪ Aguardando CT-e                                   │
│                                                                   │
│  ⏱  PENDÊNCIAS (3)                                                │
│  • Nova NF do cliente (Fiscal — SLA: 2 dias atrás · ATRASADO)     │
│  • CT-e (Transp Cerrado — SLA: 1 dia)                             │
│  • Laudo classificação (Logística — SLA: 3 dias)                  │
│                                                                   │
│  Abas: Resumo | Timeline | Documentos | Pendências | Auditoria    │
└───────────────────────────────────────────────────────────────────┘
```

**2. Central de Pendências** (`/pendencias`) — Por setor

```
┌─ Pendências de FISCAL ────────────────────────────────────────────┐
│  Filtros: [Operação] [Categoria] [SLA] [Atrasada] [Buscar]        │
│                                                                   │
│  🔴 ATRASADAS (5)                                                 │
│  ├─ OC-2026-003 · Validar NF · há 4 dias · Marina                 │
│  ├─ OC-2026-007 · Aprovar troca NF · há 2 dias · Marina           │
│  └─ ...                                                           │
│                                                                   │
│  🟡 NO PRAZO (12)                                                 │
│  ├─ OC-2026-010 · Validar NF · vence em 4h · Marina               │
│  └─ ...                                                           │
└───────────────────────────────────────────────────────────────────┘
```

**3. Workflow Visual da OC**

Linha do tempo horizontal com 14 estágios + indicadores das 3 trilhas (operacional/fiscal/financeiro) em cores diferentes.

---

## 9. Estrutura de Banco — modelagem ER

### Tabelas (refinadas a partir do que já existe na Etapa 1.5)

```
┌─ AUTH/MULTI-EMPRESA ─────────────────────────────────────────────┐
│ empresas (id, nome, cnpj, ...) ← preparado para multi-tenant     │
│ usuarios (id, email, perfil, empresa_id, transp_id?, ativo)     │
│ setores  (id, nome, perfil_required) ← agrupa por área           │
│ permissoes (perfil × modulo × acao × permitido)                  │
└──────────────────────────────────────────────────────────────────┘

┌─ CADASTROS BASE ─────────────────────────────────────────────────┐
│ transportadoras (+ rntrc)                                        │
│ motoristas (+ foto_url, transp_ids[])                            │
│ veiculos (+ transp_ids[])                                        │
│ produtores / clientes / terminais (porto) / locais / produtos    │
└──────────────────────────────────────────────────────────────────┘

┌─ FLUXO PRINCIPAL ────────────────────────────────────────────────┐
│ contratos (+ porto_id, + quantidade_cotas, + tipo: compra/venda) │
│ cargas (+ transps_permitidas: jsonb[] ← allowlist do comercial)  │
│ reservas (+ rntrc_motorista)                                     │
│ autorizacoes_carregamento (oc_id, url, anexada_em, anexada_por) │
│ ordens_carregamento — state machine 14 estados                   │
└──────────────────────────────────────────────────────────────────┘

┌─ DOCUMENTOS UNIFICADO ──────────────────────────────────────────┐
│ documentos_operacao                                              │
│   id, oc_id, categoria, tipo, arquivo_url, nome, mime, tamanho   │
│   versao, versao_anterior_id, status, observacao                 │
│   enviado_em, enviado_por_user_id                                │
│   decidido_em, decidido_por_user_id                              │
│   ativo                                                          │
└──────────────────────────────────────────────────────────────────┘

┌─ NF e CT-e ─────────────────────────────────────────────────────┐
│ notas_fiscais (+ status, + substitui_nf_id, + motivo_subst,     │
│                + trocada_em, + trocada_por_user_id)              │
│ solicitacoes_troca_nota (oc_id, nf_original_id, motivo, status, │
│                          decidida_em, decidida_por, nova_nf_id)  │
│ ctes (+ tipo: emissao/substituicao_manual)                       │
└──────────────────────────────────────────────────────────────────┘

┌─ DESCARGA ──────────────────────────────────────────────────────┐
│ dados_descarga (oc_id, peso_descarregado_kg,                    │
│                 ticket_url, canhoto_url, comprovante_url,        │
│                 laudo_url, descarga_em, validado_em, validado_por)│
└──────────────────────────────────────────────────────────────────┘

┌─ FATURAMENTO ───────────────────────────────────────────────────┐
│ faturamentos (oc_id, peso_base_kg, frete_ton, valor_calculado,  │
│               valor_informado, divergencia, justificativa,       │
│               fatura_url, cte_id, status, criado_em)             │
│ pagamentos (faturamento_id, valor, comprovante_url, pago_em,    │
│             pago_por_user_id)                                    │
└──────────────────────────────────────────────────────────────────┘

┌─ TRANSVERSAIS ──────────────────────────────────────────────────┐
│ pendencias (oc_id, categoria, descricao, setor_responsavel,     │
│             sla_horas, criada_em, resolvida_em, status,          │
│             severidade)                                          │
│ historico_eventos (+ valor_antes jsonb, + valor_depois jsonb)   │
│ notificacoes (user_id, oc_id?, tipo, titulo, body, lida, ...)   │
└──────────────────────────────────────────────────────────────────┘
```

### Relacionamentos críticos

```
Empresa 1───N Usuario
Usuario N───1 Setor (via perfil)
Empresa 1───N Contrato
Contrato 1───N Carga
Carga ───── jsonb transps_permitidas[]
Carga 1───N Reserva
Reserva 1───1 AutorizacaoCarregamento (gate p/ OC)
AutorizacaoCarregamento 1───1 OC (gera automática)
OC 1───N DocumentoOperacao (todos os anexos)
OC 1───N NotaFiscal (histórico de NFs trocadas)
OC 1───N SolicitacaoTrocaNota
OC 1───1 CTE
OC 1───1 DadosDescarga
OC 1───1 Faturamento
Faturamento 1───1 Pagamento
OC 1───N Pendencia
* ───N HistoricoEvento (polimórfico)
```

### Triggers DB sugeridos

| Trigger | Quando | Faz |
|---|---|---|
| `gera_oc_apos_autorizacao` | INSERT em `autorizacoes_carregamento` | Cria registro em `ordens_carregamento` com status `oc_emitida` |
| `marca_nf_substituida` | UPDATE em `solicitacoes_troca_nota` com status='aprovada' e nova_nf_id IS NOT NULL | UPDATE `notas_fiscais` da antiga para status='substituida' |
| `cria_pendencia_descarga` | OC entra em status `em_transito` | INSERT em `pendencias` para Logística com SLA 5 dias |
| `cria_pendencia_nf` | OC entra em status `descarregado` | INSERT em `pendencias` para Fiscal com SLA 3 dias |
| `audit_log` | UPDATE/INSERT em qualquer tabela importante | INSERT em `historico_eventos` com valor_antes/depois |
| `recalcula_saldo_contrato` | INSERT/UPDATE/DELETE em `cargas` | Atualiza `contratos.saldo_kg` |

---

## 10. Timeline Operacional

Cada OC tem uma timeline vertical mostrando todos os eventos em ordem cronológica:

```
🟢 14/04 16:20 · Marina (fiscal)
   NF-002 aprovada como substituta de NF-001
   ✏️ valor: R$ 29.100 (antes: R$ 28.800)
   📎 Anexou NF-002.pdf

🟡 13/04 09:15 · Marina (fiscal)
   Solicitou troca de NF-001
   Motivo: "CFOP errado — 5102 deveria ser 6102"

🔵 12/04 11:00 · Sistema
   OC entrou em status "Descarregado"

🔵 12/04 10:45 · Ana (logística)
   Anexou Ticket Descarga + Canhoto
   Peso descarga: 40.300 kg

🔵 10/04 08:00 · João (motorista — Transp Cerrado)
   OC iniciou trajeto (em trânsito)

🟢 09/04 14:23 · Paulo (Transp Cerrado)
   Anexou Autorização de Carregamento
   ⚡ OC-2026-001 gerada automaticamente

🟢 09/04 11:00 · Ana (logística)
   Aprovou reserva RES-001 da Transp Cerrado

🔵 08/04 16:00 · João (Transp Cerrado)
   Reservou carga CRG-001 (40.300 kg / R$ 65/t)

🔵 05/04 10:00 · Maria (comercial)
   Publicou carga CRG-001
   Allowlist: Transp Cerrado, Rancho Fundo
```

---

## 11. Central de Pendências (SLA)

### Tipos de pendência com SLA padrão

| Pendência | Setor responsável | SLA padrão |
|---|---|---|
| Aprovar reserva | Logística | 1 dia útil |
| Anexar autorização carregamento | Transportadora | 2 dias úteis após aprovação |
| Anexar ticket carregamento | Logística | 1 dia após carregamento |
| Anexar ticket descarga | Logística | 2 dias após chegada porto |
| Anexar laudo classificação | Logística | 3 dias úteis após descarga |
| Anexar NF | Fiscal | 3 dias úteis após carregamento |
| Validar NF | Fiscal | 2 dias úteis após anexar |
| Aprovar troca NF | Fiscal | 2 dias úteis |
| Anexar CT-e | Transportadora | 5 dias após trânsito |
| Liberar faturamento | Fiscal | 1 dia após docs completos |
| Anexar fatura | Transportadora | 5 dias após liberação |
| Processar pagamento | Financeiro | 30 dias contratuais |

### Severidades

- 🟢 **No prazo** — dentro do SLA
- 🟡 **Próximo do vencimento** — 50% do SLA decorrido
- 🟠 **Vencendo** — 80% do SLA
- 🔴 **Atrasado** — passou do SLA
- ⚫ **Crítico** — > 200% do SLA

### Notificações automáticas

- Email + in-app quando: pendência criada / vence em 24h / venceu
- Resumo diário para gestores

---

## 12. Dashboard Operacional (por setor)

### Comercial
- KPIs: Contratos ativos · Cargas publicadas (mês) · % de cargas reservadas · Top 5 transportadoras por volume
- Alertas: contratos vencendo · cargas sem reserva há > 7 dias

### Logística
- KPIs: OCs ativas · em trânsito · descarregadas (mês) · tempo médio carregamento→descarga
- Alertas: reservas pendentes · OCs sem movimento há > 3 dias · autorizações vencidas

### Fiscal
- KPIs: NFs pendentes · NFs em troca · CT-es pendentes · faturamentos a liberar
- Alertas: trocas com SLA estourado · OCs sem NF há > 5 dias

### Financeiro
- KPIs: a pagar (volume + R$) · pagos (mês) · divergências em análise · ticket médio
- Alertas: faturamentos com > 60 dias · divergências > 5%

### Transportadora
- KPIs: cargas aprovadas a confirmar · OCs em trânsito · NFs pendentes do cliente · faturas pagas (mês)
- Alertas: autorizações pendentes · CT-es pendentes · fatura não anexada após liberação

---

## 13. Ideias Avançadas de UX

| Ideia | Como |
|---|---|
| **Cards de pendência arrastáveis** | Logística pode reordenar prioridade visualmente |
| **Atalhos de teclado** | `g + o` → operações, `g + p` → pendências, `n` → nova reserva |
| **Busca global (Cmd/Ctrl+K)** | Acha OC, contrato, NF por número, transp, motorista |
| **Filtros salvos** | Cada user salva filtros próprios ("Minhas OCs em trânsito") |
| **Preview de doc inline** | Click no PDF abre preview lateral sem sair da tela |
| **Comentários internos** | Thread por OC entre setores (separado do histórico de auditoria) |
| **Bulk actions** | Validar 20 NFs de uma vez com checklist |
| **Anexar por drag-drop** | Arrastar arquivo na timeline já vincula à categoria certa |
| **Status colorido condicional** | Linha da tabela inteira fica vermelha se SLA estourou |
| **Snooze de pendência** | "Adiar 4h" com justificativa registrada |
| **Print-friendly da OC** | Botão "Gerar PDF da OC" mantém formato padrão |
| **Templates de motivo de troca NF** | Dropdown com motivos mais comuns + campo livre |
| **Auto-fill de campos baseado em histórico** | Transp Cerrado sempre escolhe Marcos? Pré-seleciona |

---

## 14. Estrutura SaaS

### Tenancy

| Fase | Modelo |
|---|---|
| MVP | **Single-tenant** (1 cerealista, várias transps parceiras) |
| Fase 2 | **Multi-tenant** com `empresa_id` em todas as tabelas, RLS por empresa |
| Premium | Customização por cliente (campos extras configuráveis) |

### Decisões arquiteturais

- **Banco:** PostgreSQL (Supabase para MVP, migratable para self-hosted)
- **Frontend:** Next.js 15 App Router + TypeScript + CSS Modules
- **Auth:** Supabase Auth com convite por e-mail (sem signup público)
- **Storage:** Supabase Storage (buckets `documentos/` privado e `fotos/` semi-público)
- **Tempo real:** Supabase Realtime para notificações in-app
- **Notificações email:** Resend ou Postmark (transactional)
- **Audit log:** Triggers DB + tabela append-only

---

## 15. Roadmap MVP

### O que entra (escopo mínimo para uso real)

**Já entregue na Etapa 1.5 (mock):**
- ✅ Login com 7 perfis · 8 cadastros base (transp, motoristas globais N:N, veículos, locais, terminais, etc.) · Contratos (com flag disponível) · Publicar carga · Reservar com selects + cadastro inline · Kanban dnd · OCs com NF/CTE/Romaneio básicos · Matriz de permissões visual

**Falta no MVP (Bloco I):**
1. **Allowlist de transps por carga** (Comercial escolhe)
2. **Autorização de Carregamento** (gate antes da OC)
3. **OC só gerada após autorização** (mudar trigger atual)
4. **Central documental por OC** (aba unificada substituindo NF/CTE/Romaneio separados)
5. **Troca de NF** (workflow completo: solicitar → aprovar → substituir → histórico)
6. **Dados de descarga** (peso, ticket, canhoto, comprovante porto, laudo)
7. **Validação fiscal da descarga**
8. **Faturamento com cálculo automático**
9. **3 trilhas de status paralelas** (operacional, fiscal, financeiro)
10. **Central de Pendências** com SLA
11. **Timeline da OC** (vertical, evento por evento)
12. **Dashboards por setor** (4 dashboards diferentes)
13. **Auditoria com valor_antes/depois**
14. **Notificações in-app**

### Cronograma sugerido (mock-first)

| Bloco | Conteúdo | Tempo |
|---|---|---|
| I.1 | State machine + tipos (sem UI ainda) | 1-2h |
| I.2 | Allowlist + Autorização Carreg. → OC | 2-3h |
| I.3 | Central documental unificada | 2-3h |
| I.4 | Troca de NF (workflow completo) | 3-4h |
| I.5 | Descarga + validação fiscal | 2-3h |
| I.6 | Faturamento com cálculo | 2-3h |
| I.7 | Pendências com SLA + timeline | 3-4h |
| I.8 | Dashboards por setor | 2-3h |
| I.9 | Teste E2E completo | 1h |
| **Etapa 2 revisada** | Supabase com schema completo (já com Bloco I) | 1-2 dias |

---

## 16. Roadmap Fase 2 (pós-MVP)

- **Multi-tenant** (várias cerealistas, isolamento por RLS)
- **API pública** para integração com ERPs (Protheus, SAP, custom)
- **Mobile** (app para motorista — só sua OC ativa)
- **Integração SEFAZ** (autorização CT-e real)
- **Integração NF-e** (importar XML direto)
- **Geração automática de OC.pdf** (com layout padrão da cerealista)
- **Assinatura digital** de documentos
- **Webhook** para parceiros (transp recebe avisos via API)
- **Relatórios customizáveis** (exportar CSV/Excel)

---

## 17. Funcionalidades Premium Futuras

- **BI embarcado** (dashboards customizáveis estilo Metabase)
- **Rastreamento GPS** do veículo (integração com plataformas como Cobli, Omnilink)
- **Previsão de chegada** baseada em IA
- **Cotação automática de frete** (sugere R$/t com base em histórico)
- **Match inteligente** de transp para carga (sugere quem aceitaria)
- **OCR de documentos** (lê NF/CT-e e preenche campos)
- **Workflow customizável** (cliente define seus próprios estados/SLAs)

---

## 18. Riscos Operacionais

| Risco | Impacto | Mitigação |
|---|---|---|
| Transportadora demora a anexar autorização | OC não gera, atrasa fluxo | SLA + notificação + escalation |
| NF com erro vira loop infinito de trocas | Operação travada | Limite de 3 trocas com aprovação de gestor após |
| Documento perdido (transp esquece) | Fiscal não valida | Pendência visível + e-mail diário |
| Cálculo de frete diverge (peso bruto vs líquido) | Conflito transp ↔ financeiro | Justificativa obrigatória + revisão |
| Allowlist mal configurada | Transp boa não vê carga | Tela de auditoria de allowlist |
| Usuário criando duplicata de motorista | Dado sujo | Detector de CPF/placa (já existe) |
| Vazamento de doc sensível (NF de cliente) | Compliance | RLS + buckets privados + audit log |
| Caiu o e-mail de notificação | Pendência esquecida | In-app + resumo diário + dashboard |

---

## 19. Pontos Críticos do Processo

1. **Geração da OC** — não pode ser antes da autorização, senão emite ordem sem autorização
2. **Substituição de NF** — antiga NUNCA apagada, ponteiros + status
3. **CT-e único** — substituição manual, nunca automática
4. **3 trilhas paralelas** — uma não pode bloquear a outra (descarga não espera fiscal)
5. **Allowlist** — comercial pode mudar depois da publicação? Sim, mas reservas já feitas se mantêm
6. **Auditoria** — toda mudança grava valor_antes e valor_depois, sem exceção
7. **Cálculo de frete** — peso base é o peso DESCARREGADO (não o reservado nem o carregado)
8. **Multi-empresa preparation** — schema já com `empresa_id` desde o MVP, mas tudo single por enquanto

---

## 20. Sugestões Inteligentes para a Operação Real

1. **Quadro do dia** para logística — só as OCs que precisam de ação hoje
2. **Bloqueio automático** de transportadora com 3+ NFs trocadas em 30 dias (revisão de qualidade)
3. **Alerta de descasamento** — peso descarregado < 95% peso carregado dispara revisão
4. **Conversa por OC** — chat interno cerealista ↔ transp, separado do histórico técnico
5. **Recibo digital** — quando transp confirma operação, gera recibo assinado em PDF
6. **Calendário de carregamentos** — agenda visual da fazenda
7. **Modo offline** para motorista (mobile fase 2)
8. **Importar planilha** de cargas (comercial publica 50 cargas via CSV)
9. **Notificação WhatsApp** para transportadoras (canal preferido do mercado)
10. **Dashboard de SLA** com ranking de setores que mais atrasam

---

## 🎯 GAPS no SaaS atual vs. este documento

| O que tem hoje (Etapa 1.5 + G) | O que falta |
|---|---|
| 7 perfis genéricos | ❌ Falta separação real entre os 4 setores cerealista com dashboards próprios |
| Contratos com flag `disponivel` | ❌ Falta `quantidade_cotas`, `porto_id`, `tipo: compra/venda` |
| Cargas publicáveis | ❌ Falta **allowlist de transportadoras** por carga |
| Reserva → Aprovação Logística → OC automática | ❌ Mudar: OC só após autorização anexada |
| OC com NF/CTE/Romaneio em cards separados | ❌ Substituir por **Central Documental unificada** |
| NF com upload simples | ❌ Falta versionamento + status + workflow de troca |
| Sem solicitação de troca de NF | ❌ Criar workflow inteiro |
| Sem dados de descarga formal | ❌ Criar entidade `dados_descarga` |
| Sem validação fiscal | ❌ Criar ação dedicada do fiscal |
| Faturamento não existe | ❌ Criar módulo inteiro com cálculo automático |
| Status único por OC | ❌ Separar em 3 trilhas (op/fiscal/financ) |
| Sem central de pendências | ❌ Criar com SLA |
| Sem timeline visual da OC | ❌ Criar |
| Dashboard único | ❌ Criar 4 dashboards por setor |
| Histórico sem versionamento | ❌ Adicionar valor_antes/depois |
| Sem notificações | ❌ Estrutura mínima in-app no MVP |

---

> **Documento vivo.** Será refinado conforme implementação e feedback de uso.
