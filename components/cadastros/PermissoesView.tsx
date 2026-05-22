"use client";

import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { CadastroHeader } from "./CadastroHeader";
import { PERMISSOES_PADRAO } from "@/lib/domain/permissions";
import type { Acao, Modulo, Perfil } from "@/lib/types";

const PERFIS: Perfil[] = ["admin", "logistica", "fiscal", "financeiro", "transportadora", "motorista", "cliente"];

const MODULOS: { id: Modulo; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "contratos", label: "Contratos" },
  { id: "cargas", label: "Cargas" },
  { id: "reservas", label: "Reservas" },
  { id: "ordens_carregamento", label: "Ordens" },
  { id: "notas_fiscais", label: "NF" },
  { id: "ctes", label: "CTE" },
  { id: "romaneios", label: "Romaneios" },
  { id: "transportadoras", label: "Transportadoras" },
  { id: "motoristas", label: "Motoristas" },
  { id: "veiculos", label: "Veículos" },
  { id: "terminais", label: "Terminais" },
  { id: "locais", label: "Locais" },
  { id: "produtores", label: "Produtores" },
  { id: "clientes", label: "Clientes" },
  { id: "produtos", label: "Produtos" },
  { id: "usuarios", label: "Usuários" },
  { id: "historico", label: "Histórico" },
];

const ACOES: Acao[] = ["visualizar", "criar", "editar", "excluir", "aprovar", "cancelar", "anexar_doc", "baixar_doc"];

function podeMatriz(perfil: Perfil, modulo: Modulo): { permitidas: Acao[]; total: number } {
  const permitidas = ACOES.filter((a) =>
    PERMISSOES_PADRAO.some((p) => p.perfil === perfil && p.modulo === modulo && p.acao === a && p.permitido),
  );
  return { permitidas, total: ACOES.length };
}

export function PermissoesView() {
  return (
    <>
      <CadastroHeader
        title="Matriz de Permissões"
        description="Matriz padrão: perfil × módulo × ação. Edição granular será habilitada na Etapa 2."
        icon="🔐"
      />

      <Card>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--border)", fontSize: 10, textTransform: "uppercase", color: "var(--hint)", letterSpacing: ".08em" }}>
                  Módulo
                </th>
                {PERFIS.map((p) => (
                  <th key={p} style={{ textAlign: "center", padding: 8, borderBottom: "1px solid var(--border)", fontSize: 10, textTransform: "uppercase", color: "var(--hint)", letterSpacing: ".08em" }}>
                    {p}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MODULOS.map((m) => (
                <tr key={m.id}>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--border)", fontWeight: 600 }}>{m.label}</td>
                  {PERFIS.map((p) => {
                    const { permitidas, total } = podeMatriz(p, m.id);
                    const ratio = permitidas.length / total;
                    const tone = ratio === 1 ? "green" : ratio === 0 ? "red" : "amber";
                    return (
                      <td key={p} style={{ padding: 8, borderBottom: "1px solid var(--border)", textAlign: "center" }}>
                        <Badge tone={tone}>{permitidas.length}/{total}</Badge>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 16, fontSize: 11, color: "var(--muted)" }}>
          <strong>Legenda das ações:</strong> {ACOES.join(" · ")}
        </div>
      </Card>
    </>
  );
}
