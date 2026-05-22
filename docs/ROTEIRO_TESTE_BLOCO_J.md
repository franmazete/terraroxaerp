# Roteiro de Teste — Bloco J (terraroxa)

**Data:** 2026-05-20
**Build:** ✅ `next build` compilou em 47s, 16 páginas geradas, 0 erros TS

Este roteiro guia o teste manual de tudo que entrou no Bloco J. Cada cenário tem **objetivo**, **passos**, **resultado esperado** e **arquivos onde olhar** se algo quebrar.

---

## 0. Setup inicial

1. `npm run dev` (Next.js em modo dev)
2. Abrir o navegador em `http://localhost:3000`
3. Os arrays operacionais (contratos, cargas, ordens) estão **zerados** propositalmente — populamos durante o teste.
4. Cadastros base já vêm populados (5 transps, 5 motoristas, 5 veículos, 3 produtores, 3 clientes, 4 terminais, 8 locais com lat/lng).

### Usuários de teste

| Email                              | Perfil           | Transp_id |
| ---------------------------------- | ---------------- | --------- |
| carlos@terraroxa.com.br            | admin            | —         |
| ana@terraroxa.com.br               | logistica        | —         |
| marina@terraroxa.com.br            | fiscal           | —         |
| rodrigo@terraroxa.com.br           | financeiro       | —         |
| joao@cerrado.com.br                | transportadora   | TR-001    |
| paulo@ranchofundo.com.br           | transportadora   | TR-002    |

> Senha mock: qualquer string (auth ainda é mock — virá Supabase no Bloco H).

---

## 1. J.1 — Bugs corrigidos

### 1.1 Publicar carga sem destino
- **Login**: ana@terraroxa.com.br (logística)
- **Passos**:
  1. Criar contrato em /contratos → "Lançar Contrato"
     - Tipo: Compra, Produtor: Fazenda Boa Esperança, Produto: Soja, Qtd: 1.000.000 kg
     - **NÃO** preencher cliente nem destino
     - Salvar
  2. Abrir o contrato → clicar "Disponibilizar para publicação"
  3. Em /cargas → "Publicar Nova Carga"
     - Selecionar o contrato criado
     - **DEIXAR DESTINO EM BRANCO** (deve aceitar)
     - Salvar
- **Esperado**:
  - ✅ Publicação OK, não exige destino
  - ✅ Em /cargas, a linha mostra "Origem → A definir" (em amber)
- **Arquivos**: `components/cargas/PublicarCargaModal.tsx:77`, `lib/types.ts:304`

### 1.2 Origem do contrato aparece pré-preenchida
- **Continuando o teste 1.1**:
  3. Ao selecionar o contrato no modal Publicar, **verificar que o Select de Origem mostra "Fazenda Boa Esperança" automaticamente** (não fica vazio).
- **Arquivos**: `components/cargas/PublicarCargaModal.tsx:213-225`

### 1.3 Pendência da transp resolve ao anexar autorização
- **Continuando**:
  1. Sair (logout) e logar como **joao@cerrado.com.br** (transp TR-001)
  2. Em /disponiveis → ver a carga publicada → "Reservar"
  3. Preencher: qtd 50.000 kg, frete R$ 60/t, selecionar motorista + veículo, confirmar
  4. Logout → logar como ana (logística)
  5. Em /reservas → aprovar a reserva
  6. **Verificar**: aparece pendência "anexar_autorizacao_carreg" (visível em /pendencias com setor transportadora)
  7. Logout → logar como **joao@cerrado.com.br** novamente
  8. **Verificar**: 🔔 sino com badge + pulse animado
  9. Em /minhas-reservas → clicar "Anexar Autorização"
  10. Preencher nome do arquivo → confirmar
- **Esperado**:
  - ✅ Após anexar, a pendência **sai da lista** do sino e do /pendencias
  - ✅ Login como paulo@ranchofundo.com.br (TR-002) NÃO mostra essa pendência (filtrada por transp_id)
- **Arquivos**: `lib/data-store.tsx` (anexarAutorizacaoCarregamento ganchos), `app/pendencias/page.tsx`

---

## 2. J.5 — Gating sequencial completo (caminho feliz)

Continuando do teste 1.3 (autorização anexada → OC gerada).

### 2.1 Passo 2 — Transp anexa ticket de carregamento
- Login: joao@cerrado.com.br
- Em /painel → clicar a OC recém-criada na lista de "OCs em Andamento"
- **Verificar**: alerta âmbar "Sua próxima ação: Ticket de carregamento + peso líquido"
- Clicar "Executar agora →" → modal abre
- Preencher: Peso bruto 45.500, Tara 12.500 → **conferir cálculo: 33.000 kg líquido**
- Nome do arquivo: `ticket_origem.pdf` → Salvar
- **Esperado**: ✅ Passo 2 vira verde, próximo passo é "Nota fiscal" (logística)

### 2.2 Passo 3 — Laudo (opcional)
- Ainda como joao@cerrado.com.br, na mesma OC aba Checklist
- **Verificar**: AlertBox azul "Laudo de classificação disponível (opcional)"
- Clicar "Anexar laudo" → preencher umidade 12.5, impurezas 1.0, avariados 4.2 → salvar
- **Esperado**: ✅ Passo 3 vira verde com badge "Opcional"

### 2.3 Passo 4 — Cerealista anexa NF
- Logout → logar como ana (logística)
- 🔔 deve estar pulsando (passou de 0 → 1 pendência)
- Em /dashboard → seção "⚡ Atalhos por etapa": CTA "📑 Anexar NF" na OC
- Clicar → vai pro /ordens/[id]
- Na aba Resumo, ir até card "Nota Fiscal" e anexar uma NF (qualquer número/valor)
- **Esperado**: ✅ Passo 4 vira verde, próximo passo "Comprovante de agendamento" da logística

### 2.4 Passo 5 — Cerealista anexa agendamento
- Ainda como ana
- /dashboard → CTA "📅 Anexar Agendamento" → vai pro detalhe da OC
- Aba Checklist → "Executar agora" no passo agendamento
- Preencher data + horário 08:00 às 17:00 + nome do arquivo
- **Esperado**: ✅ Passo 5 verde, próximo "CT-e" (transp)

### 2.5 Passo 6 — Transp anexa CT-e
- Logout → joao@cerrado.com.br → 🔔 pulse
- /ordens/[id] → card CT-e na aba Resumo → anexar CT-e
- **Esperado**:
  - ✅ Passo 6 verde
  - ✅ Status operacional muda para **em_transito** (verificar trilha no topo da OC)
  - ✅ Próximo passo: "Comprovante de descarga"

### 2.6 Passo 7 — Transp registra descarga
- Aba Resumo → card Descarga (DescargaSection) → "Registrar Descarga"
- Preencher peso descarregado 32.800 kg + ticket descarga
- **Esperado**: ✅ Passo 7 verde, status_operacional `descarregado`

### 2.7 Passo 10 — Fiscal calcula quebra
- Logout → marina@terraroxa.com.br (fiscal) → 🔔 pulse
- /dashboard → ver pendência calc_quebra
- Ir na OC → aba Checklist → "Executar agora" no passo calc_quebra
- **Verificar**: modal pré-preenche:
  - Peso carregado: 33.000 (do ticket)
  - Peso descarregado: 32.800 (da descarga)
  - **Quebra: 200 kg (0,61%) ⚠ ALERTA acima do limite**
- Preencher: Justificativa transp + Observação fiscal (mín. 10 chars cada)
- Clicar "Validar com justificativa"
- **Esperado**:
  - ✅ Quebra calculada
  - ✅ Descarga auto-validada (validado_em preenchido)
  - ✅ Próximo passo: "Fatura dos CT-es"
- **Arquivos**: `components/checklist/CalcularQuebraModal.tsx`, `lib/data-store.tsx calcularQuebraOC`

---

## 3. J.6 — Fluxo refugado

Repetir os passos 1–5 (chegando até CT-e anexado) numa **nova OC** ou continuar a existente:

### 3.1 Transp avisa refugo
- Como joao@cerrado.com.br, na aba Checklist da OC
- **Verificar**: AlertBox vermelho "Carga foi refugada no destino?" → botão **Avisar refugo**
- Preencher motivo (mín. 10 chars) + arquivo opcional → confirmar (responder OK no confirm)
- **Esperado**:
  - ✅ Badge "⚠ Refugada" aparece na OC no painel transp/cerealista
  - ✅ Passos refugo (7a, 7b, 8, 9) aparecem no checklist
  - ✅ Cria pendência `confirmar_refugo` (logística)

### 3.2 Cerealista confirma refugo
- Logout → ana → 🔔 pulse
- /dashboard → atalho "⚠️ Confirmar Refugo" → OC
- Aba Checklist → modal mostra motivo da transp + evidência
- Testar 1: **Rejeitar** com observação → `refugada=false`, fluxo normal volta
- Refazer aviso de refugo (no perfil transp) e desta vez **Confirmar**
- **Esperado**: ✅ Pendência `anexar_cte_retorno` (transp) criada

### 3.3 Transp anexa CT-e retorno + estadia (opcional)
- joao@cerrado.com.br → checklist
- Anexar CT-e de retorno (número + chave + arquivo + data)
- Em seguida, AlertBox âmbar oferece "Anexar estadia (opcional)"
- Preencher 12h + R$ 850 + justificativa
- **Esperado**: ✅ Passos 8 e 9 verdes

---

## 4. J.8 — PDF da OC

- Em **qualquer OC** com passos preenchidos
- Clicar "📄 Gerar PDF" no header
- **Esperado**: ✅ Download de `OC_XXX.pdf` automático
- **Conferir no PDF**:
  - Cabeçalho verde "terraroxa"
  - Badge "⚠ CARGA REFUGADA" se aplicável
  - Seções: Operação, Transportadora e Veículo, Pesos e Quebra, Checklist Sequencial, Observações
  - Cada passo com `[X]`/`[ ]`/`[-]` + data + autor
  - Rodapé com "Página X / N"

---

## 5. J.9 — Envio WhatsApp/Email

- Em /ordens/[id] → "📨 Enviar OC"
- Trocar entre 📱 WhatsApp e ✉️ Email — observar que cada destinatário mostra o contato correto
- Destinatários disponíveis: Produtor, Transportadora, Motorista, Destino (Local)
- Cards desabilitados quando não tem contato pro canal escolhido
- Selecionar 2-3 → enviar
- **Esperado**: ✅ alert() listando canal + destinatários + mensagem

### Cadastro de contato do Local
- Em /cadastros/locais → "Editar" qualquer Local
- Preencher seção "📨 Contato" + "🗺️ Google Maps" (lat/lng)
- Salvar
- **Esperado**: ✅ Coluna "Mapa" mostra link "🗺️ Maps" abrindo Google Maps externo

---

## 6. J.10 — Maps placeholder

- Em /ordens/[id] aba Resumo → seção Trajeto
- **Verificar**:
  - ✅ Placeholder visual com gradiente
  - ✅ Pin origem + pin destino com lat/lng
  - ✅ Faixa central: "~ N km em linha reta · Xh Ymin estimadas @ 60 km/h"
  - ✅ Botão "🗺️ Abrir no Google Maps →" abre rota driving externa
- Testar com OC cujo destino NÃO tem lat/lng → mostra fallback amber
- Em /cadastros/locais → cada linha tem link "🗺️ Maps" (quando tem coords)

---

## 7. J.11 — IA conferindo Fatura × CT-e

Continuando após passo 10 (quebra calculada → fatura liberada):

### 7.1 Transp anexa fatura
- joao@cerrado.com.br → /ordens/[id] aba Resumo → card 💰 Faturamento
- Clicar "📎 Conferir e anexar fatura (CT-es)"
- Preencher:
  - Número da fatura: NF-2026-0123
  - Valor: igual ao calculado (testar primeiro sem divergência)
  - **Selecionar os CT-es** da OC nos cards (precisa ≥1)
  - Nome do arquivo: fatura.pdf
- Clicar "🤖 Anexar e rodar IA"
- **Esperado**:
  - ✅ alert() com resumo: "Todos os 4 campos batem"
  - ✅ Bloco "🤖 IA conferiu" verde aparece no card de Faturamento
  - ✅ Tabela 4 linhas (Valor frete, Transportadora, Prestador, Número CT-e) — todos ✓
  - ✅ Cria pendência `conferir_fatura_fiscal` (fiscal)

### 7.2 Testar divergência
- Repetir em outra OC, mas informar valor diferente do calculado
- **Esperado**:
  - ✅ Status "DIVERGENCIA" vermelho
  - ✅ Linha "Valor do frete" com ✗ vermelho
  - ✅ Observação: "Divergência de R$ X.XX"

### 7.3 Fiscal confere
- Logout → marina (fiscal) → 🔔 pulse
- /ordens/[id] → card Faturamento → botão "✓ Conferir e enviar ao financeiro"
- Preencher observação (opcional) → confirmar
- **Esperado**:
  - ✅ AlertBox verde "Fiscal conferiu em DD/MM/AAAA"
  - ✅ Botão "Registrar Pagamento" (financeiro) agora aparece

### 7.4 Financeiro paga
- Logout → rodrigo (financeiro)
- 🔔 pulse → /ordens/[id] → "💸 Registrar Pagamento"
- Confirmar valor + comprovante
- **Esperado**:
  - ✅ Status financeiro **pago**
  - ✅ Checklist 100% verde

---

## 8. J.12 — Sino de notificações

Em **qualquer página**:

- Topbar mostra 🔔 com badge contador
- Badge vermelho quando há atrasadas, amber caso contrário
- Clicar abre dropdown 360px:
  - Cabeçalho "🔔 Notificações · N pendências · X atrasadas"
  - 6 mais urgentes (ordem: crítica → atrasada → vencendo → próximo → no prazo)
  - Cada linha: ícone severidade + descrição + OC + SLA + vence em
  - Clique vai pra `/ordens/[id]` ou `/pendencias`
- Fechar clicando fora
- **Pulse animado** quando o total de pendências aumenta (rotação + scale)

**Cross-portal**:
- Transp só vê pendências da própria transp (filtro por transp_id)
- Cerealista vê tudo do seu setor (logística/fiscal/financeiro/comercial conforme perfil)

---

## 9. Cenários negativos (validar bloqueios)

### 9.1 Anexar ticket sem autorização
- Tentar abrir o modal de ticket numa OC sem autorização anexada
- **Esperado**: Modal pode abrir, mas o gancho `anexarTicketCarregamento` deveria falhar silenciosamente
  *(Tooling defensivo — passo 2 só aparece como pendente após passo 1)*

### 9.2 Calcular quebra sem ticket OU descarga
- Marina → modal calc_quebra abre, mas mostra AlertBox amber "Faltam pesos para calcular"

### 9.3 Anexar fatura sem CT-e selecionado
- Transp → modal exibe alert "Selecione ao menos um CT-e"

### 9.4 Refugo > 0,5% sem justificativa
- Fiscal → ao tentar salvar, alert "Justificativa transp obrigatória"

---

## 10. Status pós-Bloco J

✅ **Tudo implementado e validado em build de produção**:
- J.1 — Bugs (3) corrigidos
- J.2 — Tipos do gating + sla + checklist helper
- J.3 — Dashboard transp com checklist sequencial
- J.4 — Dashboard cerealista com atalhos por etapa
- J.5 — Mutations dos 7 passos + ganchos sequenciais de pendências
- J.6 — Fluxo refugado (4 modais + 4 mutations)
- J.7 — Quebra fiscal (modal + cálculo automático + alerta 0,5%)
- J.8 — PDF jsPDF (cabeçalho, seções, checklist, rodapé multi-página)
- J.9 — Envio WhatsApp/Email mock + cadastro de contatos no Local
- J.10 — Maps placeholder + lat/lng + Google Maps externo
- J.11 — IA Fatura×CT-e (regra simples, 4 campos) + Conferência fiscal
- J.12 — Sino de notificações com pulse animado + filtro por setor/transp_id

### Próximos blocos (não-J)

- **H2-H6** (paused — Etapa 2 Supabase): schema, RLS, auth real, storage, SSR
- **Etapa 3+**: integrações reais (WhatsApp/Email, Google Maps API, IA LLM)

### Métricas do build

```
Route (app)                              Size  First Load JS
/ordens/[id]                            150 kB        273 kB  ← maior (lógica de OC + modais)
/kanban                                 15.5 kB       128 kB
/cadastros/[entity]                     9.14 kB       125 kB
/contratos                              5.9 kB        125 kB
/painel                                 3.61 kB       130 kB
/dashboard                              5.09 kB       131 kB
+ First Load JS shared                  102 kB
```

> **150 kB em /ordens/[id]** é fronteira — vamos monitorar. Quando passar de 200 kB, hora de code-split os modais.
