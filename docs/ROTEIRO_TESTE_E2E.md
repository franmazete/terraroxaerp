# Roteiro de teste End-to-End — Publicar Carga → OC

Este documento descreve o fluxo completo que valida o "caminho feliz" do terraroxa:
**Contrato → Carga → Reserva → Ordem de Carregamento**.

## Pré-requisitos (já configurados)

✅ 130 contratos importados (todos `disponivel=true`, com saldo > 0)
✅ 95 contratos com `local_origem_id` vinculado automaticamente
✅ 1 transportadora de teste: **TranspTeste**
✅ 1 motorista de teste vinculado: **José Tester**
✅ 1 veículo de teste vinculado: **AAA0A00 / BBB0B00 (Bitrem 45t)**
✅ 1 usuário Auth criado

## Credenciais de teste

| Perfil | Email | Senha |
|---|---|---|
| **Admin Cerealista** | (use o seu próprio admin já criado) | — |
| **Transportadora** | `transp@teste.com` | `terraroxa2026` |

> ⚠️ Pra fazer o fluxo, você precisa de **2 abas/navegadores diferentes**:
> uma logada como admin/logística, outra como transportadora.
> Aba anônima do Chrome serve.

---

## Etapa 1 — Cerealista publica carga

**Quem:** admin (ou logística)

1. Login em `https://terraroxaerp-xxx.vercel.app/login`
2. Vá em **Contratos**
3. Filtre por safra `26-2026` (a maioria dos contratos)
4. Clique em qualquer contrato com saldo > 0 — abre o detalhe
5. Confirme que mostra:
   - Badge verde "✓ Disponível para publicação"
   - Saldo > 0
6. Clique em **"📦 Gerar Carga deste Contrato"**
7. Modal abre. Preencha:
   - **Quantidade:** ex `45000` (uma carreta cheia)
   - **Local de Origem:** verifica que já vem preenchido (se foi um dos 95 vinculados); senão, clica **+ Novo** ou seleciona da lista
   - **Destino:** opcional (escolha um terminal qualquer ou + Novo)
   - **Data Prevista Carregamento:** próxima semana
   - **Transportadoras permitidas:** deixe vazio (= todas podem reservar)
8. Clique em **"📦 Publicar Carga"**
9. Toast verde: "Transportadoras já podem ver e reservar"

**Verificação:** vá em **Cargas** e veja a carga recém-criada com status `disponivel`.

---

## Etapa 2 — Transportadora reserva a carga

**Quem:** TranspTeste

1. Abra **aba anônima** → `/login`
2. Email `transp@teste.com` / senha `terraroxa2026`
3. Vai cair em **Cargas Disponíveis** (`/disponiveis`)
4. Vai aparecer a carga que o cerealista publicou
5. Clique em **"Reservar"**
6. Modal abre. Preencha:
   - **Quantidade:** mesma da carga ou menor
   - **Frete/ton:** ex `250`
   - **Motorista:** `José Tester` (único cadastrado pra essa transp)
   - **Veículo/Placa:** `AAA0A00` (única pra essa transp)
   - **Data prevista retirada:** próxima semana
7. Clique em **"Reservar Carga"**
8. Toast verde: "Reserva criada — aguardando aprovação"

**Verificação:** vá em **Minhas Reservas** e veja a reserva com badge `⏳ Pendente`.

---

## Etapa 3 — Cerealista aprova a reserva

**Quem:** admin / logística (volta na primeira aba)

1. Vá em **Cargas**
2. Clica na carga publicada — abre o card
3. Tabela **"Reservas vinculadas"** mostra a reserva da TranspTeste com status `Pendente`
4. Clique em **"✓ Aprovar"**
5. Toast verde: "Reserva R-XXX aprovada"
6. **Magia:** sistema gera automaticamente:
   - 1 `autorizacao_carregamento`
   - 1 `ordem_carregamento` com numeração auto (ex `OC-2026-001`)

**Verificação:** vá em **Ordens** — sua nova OC aparece lá no topo.

---

## Etapa 4 — Acompanhar OC

**Quem:** ambos (cerealista vê tudo, transp vê só a OC dela)

1. Clica na OC pra abrir o detalhe (`/ordens/[id]`)
2. Vai mostrar o **gating sequencial** com cards:
   - ✓ Autorização (já tem)
   - ⏸ Carregamento (transp sobe Ticket + Laudo)
   - ⏸ Documentação Fiscal (NF + CT-e)
   - ⏸ Descarga
   - ⏸ Faturamento
   - ⏸ Pagamento

> ℹ️ O fluxo daqui pra frente (upload PDFs, peso de chegada, IA fatura, pagamento) **já está implementado mas não foi testado E2E ainda**. Pode continuar testando manualmente cada card.

---

## Validações importantes

✅ **RLS funcionando:**
- TranspTeste só vê cargas com `disponivel=true` e suas próprias reservas/OCs
- Cerealista vê tudo

✅ **Saldo do contrato decrementa:**
- Antes da reserva: saldo X
- Depois de aprovada: saldo X − qtd_reserva
- Confere em `/contratos/[id]`

✅ **Status da carga atualiza:**
- `disponivel` → `parcial` (reservou parte) → `fechada` (reservou tudo)

---

## Problemas comuns

### "Nenhum contrato disponível" no modal de Publicar Carga
- Confere que o contrato está com `disponivel=true` e `saldo_kg > 0`
- Confere que o `status` é `ativo`

### Reserva não aparece pra cerealista
- Refresh da página `/cargas` (Vercel pode cachear 30-60s)
- Confere RLS: cerealista deveria ter `perfil` em (admin/comercial/logistica/fiscal/financeiro)

### "Sem permissão" ao tentar publicar carga
- Logado como `transportadora` em vez de `cerealista`
- Confere `usuarios.perfil` no Supabase Studio

### Local de Origem null no contrato
- Use o botão **+ Novo** ao lado do select pra criar inline
- Ou vá em `/cadastros/locais` antes e crie

---

## Scripts úteis pra reset / re-seed

```bash
# Re-importar contratos do CSV (idempotente)
node scripts/test-import-csv.mjs "C:/Users/FranMaz/Downloads/CONTRATOATUAL2.csv" --apply

# Re-vincular locais de origem (heurística)
node scripts/vincular-locais-contratos.mjs --apply

# Re-criar transp/motorista/veículo de teste
node scripts/seed-dados-teste.mjs

# Re-criar / resetar senha do usuário transp
node scripts/criar-user-transp-teste.mjs
```
