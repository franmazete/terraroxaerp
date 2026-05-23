/* ════════════════════════════════════════════════════════════════════
 * Traduz mensagens de erro do Supabase / Postgres pra pt-BR claro.
 * Usado em todas as Server Actions pra que o usuário veja mensagens
 * úteis em vez de stack traces em inglês.
 * ════════════════════════════════════════════════════════════════════ */

interface ErroSupabase {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
}

/** Traduz uma mensagem de erro do Supabase pra português brasileiro claro. */
export function traduzirErro(error: ErroSupabase | string | null | undefined): string {
  if (!error) return "Erro desconhecido. Tente novamente.";
  const msg = (typeof error === "string" ? error : error.message ?? "").toLowerCase();
  const original = typeof error === "string" ? error : error.message ?? "";

  // ─── Erros de schema/coluna ─────────────────────────────────────────
  if (msg.includes("schema cache") && msg.includes("column")) {
    const m = original.match(/'(\w+)' column/i);
    return `Erro de configuração: a coluna ${m ? `"${m[1]}"` : "informada"} não existe no banco. Avise o suporte.`;
  }
  if (msg.includes("does not exist") && msg.includes("column")) {
    return "Erro de configuração: coluna não existe no banco. Avise o suporte.";
  }
  if (msg.includes("does not exist") && msg.includes("relation")) {
    return "Erro de configuração: tabela não existe no banco. Avise o suporte.";
  }

  // ─── Constraints ────────────────────────────────────────────────────
  if (msg.includes("duplicate key") || msg.includes("unique constraint")) {
    if (msg.includes("email")) return "Esse e-mail já está cadastrado.";
    if (msg.includes("cnpj") || msg.includes("cpf")) return "Esse CNPJ/CPF já está cadastrado.";
    if (msg.includes("numero")) return "Esse número já está em uso.";
    return "Já existe um registro com esses dados (campo único duplicado).";
  }

  if (msg.includes("violates not-null") || msg.includes("null value in column")) {
    const m = original.match(/column "(\w+)"/i);
    return `O campo ${m ? `"${m[1]}"` : "obrigatório"} não foi preenchido.`;
  }

  if (msg.includes("violates foreign key")) {
    return "Você está tentando vincular a um registro que não existe. Atualize a página e tente novamente.";
  }

  if (msg.includes("violates check constraint")) {
    return "Algum valor está fora do permitido. Confira os campos preenchidos.";
  }

  // ─── Autenticação / Permissão ───────────────────────────────────────
  if (msg.includes("row-level security") || msg.includes("rls") || msg.includes("policy")) {
    return "Você não tem permissão para realizar essa ação.";
  }
  if (msg.includes("invalid login") || msg.includes("invalid credentials")) {
    return "E-mail ou senha incorretos.";
  }
  if (msg.includes("email not confirmed")) {
    return "E-mail ainda não confirmado. Verifique sua caixa de entrada.";
  }
  if (msg.includes("user not found") || msg.includes("user_not_found")) {
    return "Usuário não encontrado no sistema.";
  }
  if (msg.includes("email rate limit") || msg.includes("rate_limit") || msg.includes("too many requests")) {
    return "Muitas tentativas em pouco tempo. Tente novamente em alguns minutos.";
  }
  if (msg.includes("not authenticated") || msg.includes("jwt expired") || msg.includes("invalid jwt")) {
    return "Sessão expirada. Faça login novamente.";
  }
  if (msg.includes("password should be at least")) {
    return "A senha precisa ter ao menos 6 caracteres.";
  }
  if (msg.includes("weak password")) {
    return "Senha muito fraca. Use ao menos 8 caracteres com letras e números.";
  }
  if (msg.includes("email address is invalid") || msg.includes("invalid email")) {
    return "E-mail inválido.";
  }

  // ─── Conexão / Rede ─────────────────────────────────────────────────
  if (msg.includes("fetch failed") || msg.includes("network error")) {
    return "Falha de conexão com o servidor. Verifique sua internet e tente novamente.";
  }
  if (msg.includes("timeout") || msg.includes("timed out")) {
    return "O servidor demorou demais para responder. Tente de novo.";
  }

  // ─── Tipos ───────────────────────────────────────────────────────────
  if (msg.includes("invalid input syntax") && msg.includes("uuid")) {
    return "Identificador inválido. Atualize a página e tente novamente.";
  }
  if (msg.includes("invalid input syntax") && msg.includes("type")) {
    return "Algum campo está com formato inválido. Confira os dados preenchidos.";
  }

  // ─── Genérico — mostra a mensagem original se for curta e legível ──
  if (original && original.length < 120) return original;
  return "Erro ao processar a requisição. Tente novamente em alguns instantes.";
}
