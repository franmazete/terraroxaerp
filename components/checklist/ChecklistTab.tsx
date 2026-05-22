"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/Button";
import { Card, CardHeader, CardTitle } from "@/components/ui/Card";
import { AlertBox } from "@/components/ui/AlertBox";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ChecklistOC } from "./ChecklistOC";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { calcChecklist, progressoChecklist } from "@/lib/domain/checklist";
import { buildOCSnapshot } from "@/lib/domain/oc-snapshot";
import type { PassoChecklist } from "@/lib/types";

// Modais carregados sob demanda (Bloco N.3 — reduz First Load do /ordens/[id])
const AnexarTicketCarregamentoModal = dynamic(
  () => import("./AnexarTicketCarregamentoModal").then((m) => m.AnexarTicketCarregamentoModal),
  { ssr: false },
);
const AnexarLaudoModal = dynamic(() => import("./AnexarLaudoModal").then((m) => m.AnexarLaudoModal), { ssr: false });
const AnexarAgendamentoModal = dynamic(
  () => import("./AnexarAgendamentoModal").then((m) => m.AnexarAgendamentoModal),
  { ssr: false },
);
const AvisarRefugoModal = dynamic(() => import("./AvisarRefugoModal").then((m) => m.AvisarRefugoModal), { ssr: false });
const ConfirmarRefugoModal = dynamic(
  () => import("./ConfirmarRefugoModal").then((m) => m.ConfirmarRefugoModal),
  { ssr: false },
);
const AnexarCteRetornoModal = dynamic(
  () => import("./AnexarCteRetornoModal").then((m) => m.AnexarCteRetornoModal),
  { ssr: false },
);
const AnexarEstadiaModal = dynamic(() => import("./AnexarEstadiaModal").then((m) => m.AnexarEstadiaModal), { ssr: false });
const CalcularQuebraModal = dynamic(
  () => import("./CalcularQuebraModal").then((m) => m.CalcularQuebraModal),
  { ssr: false },
);

interface Props {
  ocId: string;
}

/** Aba "Checklist" da página de detalhe da OC — mostra os passos e CTAs por papel. */
export function ChecklistTab({ ocId }: Props) {
  const { user } = useAuth();
  const store = useDataStore();
  const toast = useToast();
  const [modalAberto, setModalAberto] = useState<PassoChecklist | null>(null);

  const snap = buildOCSnapshot(ocId, store);
  if (!snap) return <div>OC não encontrada.</div>;
  const passos = calcChecklist(snap);
  const prog = progressoChecklist(passos);

  // Decide se o user atual pode agir num passo pendente (mostra CTA quando sim)
  const meuPerfil = user?.perfil;
  const meuSetor: "transportadora" | "logistica" | "fiscal" | "financeiro" | null =
    meuPerfil === "transportadora"
      ? "transportadora"
      : meuPerfil === "logistica" || meuPerfil === "admin"
      ? "logistica"
      : meuPerfil === "fiscal"
      ? "fiscal"
      : meuPerfil === "financeiro"
      ? "financeiro"
      : null;

  // Próximo passo pendente do MEU setor (CTA principal)
  const meuPassoPendente = passos.find((p) => p.status === "pendente" && p.setor === meuSetor);

  // Passo opcional 'laudo_classificacao' que pode ser anexado pela transp a qualquer momento se passo 2 ok
  const podeAnexarLaudo =
    meuSetor === "transportadora" &&
    !snap.laudo &&
    !!snap.ticketCarreg &&
    !snap.cte; // antes do CT-e ser anexado

  // Refugo: transp pode AVISAR refugo a partir do passo 6 (CT-e anexado) e antes do CT-e retorno existir
  const podeAvisarRefugo =
    meuSetor === "transportadora" &&
    !!snap.cte &&
    !snap.cteRetorno &&
    (!snap.avisoRefugo || snap.avisoRefugo.status === "rejeitado");

  // Estadia: transp pode anexar a qualquer momento após confirmar refugo
  const podeAnexarEstadia =
    meuSetor === "transportadora" &&
    snap.avisoRefugo?.status === "confirmado" &&
    !snap.estadia;

  function abrirModalDoPasso(passo: PassoChecklist) {
    if (
      passo === "ticket_carregamento" ||
      passo === "laudo_classificacao" ||
      passo === "anexo_agendamento" ||
      passo === "aviso_refugo" ||
      passo === "confirmacao_refugo" ||
      passo === "cte_retorno" ||
      passo === "estadia" ||
      passo === "calc_quebra"
    ) {
      setModalAberto(passo);
    } else {
      const mensagem =
        passo === "nf_venda"
          ? "Vá ao card 'Notas Fiscais' nesta página para anexar a NF."
          : passo === "cte_emissao"
          ? "Vá ao card 'CT-e' nesta página para anexar o CT-e."
          : passo === "comprovante_descarga"
          ? "Vá à aba 'Resumo' → seção 'Descarga' para registrar a descarga."
          : passo === "fatura_ctes"
          ? "Vá ao card 'Faturamento' nesta página para anexar a fatura."
          : "Em breve.";
      toast.info(mensagem, "Este passo é executado em outra tela");
    }
  }

  return (
    <>
      <Card className="section-gap">
        <CardHeader>
          <CardTitle>
            ✅ Checklist Sequencial — {prog.concluidos}/{prog.total} passos ({prog.pct}%)
          </CardTitle>
        </CardHeader>
        <div style={{ maxWidth: 480, marginBottom: 12 }}>
          <ProgressBar
            percent={prog.pct}
            color={prog.pct >= 100 ? "green" : prog.pct >= 50 ? "amber" : "red"}
          />
        </div>

        {meuPassoPendente && (
          <AlertBox
            tone="amber"
            icon="⏳"
            title={`Sua próxima ação: ${meuPassoPendente.label}`}
            actions={
              <Button
                variant="primary"
                size="sm"
                onClick={() => abrirModalDoPasso(meuPassoPendente.passo)}
              >
                Executar agora →
              </Button>
            }
          >
            {meuPassoPendente.hint || "Clique no botão para executar este passo."}
          </AlertBox>
        )}

        {podeAnexarLaudo && (
          <div style={{ marginTop: 10 }}>
            <AlertBox
              tone="blue"
              icon="🔬"
              title="Laudo de classificação disponível (opcional)"
              actions={
                <Button
                  size="sm"
                  onClick={() => setModalAberto("laudo_classificacao")}
                >
                  Anexar laudo
                </Button>
              }
            >
              Você pode anexar o laudo de classificação enquanto o carregamento ainda não foi finalizado pelo CT-e.
            </AlertBox>
          </div>
        )}

        {podeAvisarRefugo && (
          <div style={{ marginTop: 10 }}>
            <AlertBox
              tone="red"
              icon="⚠️"
              title="Carga foi refugada no destino?"
              actions={
                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => setModalAberto("aviso_refugo")}
                >
                  Avisar refugo
                </Button>
              }
            >
              Se o cliente recusou a carga no destino, avise o refugo. A cerealista precisará confirmar antes de você anexar o CT-e de retorno.
            </AlertBox>
          </div>
        )}

        {podeAnexarEstadia && (
          <div style={{ marginTop: 10 }}>
            <AlertBox
              tone="amber"
              icon="⏱️"
              title="Estadia disponível (opcional)"
              actions={
                <Button size="sm" onClick={() => setModalAberto("estadia")}>
                  Anexar estadia
                </Button>
              }
            >
              Se houve cobrança de estadia durante o refugo, registre aqui.
            </AlertBox>
          </div>
        )}

        <div style={{ marginTop: 14 }}>
          <ChecklistOC passos={passos} />
        </div>
      </Card>

      {/* Modais */}
      <AnexarTicketCarregamentoModal
        ocId={modalAberto === "ticket_carregamento" ? ocId : null}
        onClose={() => setModalAberto(null)}
      />
      <AnexarLaudoModal
        ocId={modalAberto === "laudo_classificacao" ? ocId : null}
        onClose={() => setModalAberto(null)}
      />
      <AnexarAgendamentoModal
        ocId={modalAberto === "anexo_agendamento" ? ocId : null}
        onClose={() => setModalAberto(null)}
      />
      <AvisarRefugoModal
        ocId={modalAberto === "aviso_refugo" ? ocId : null}
        onClose={() => setModalAberto(null)}
      />
      <ConfirmarRefugoModal
        ocId={modalAberto === "confirmacao_refugo" ? ocId : null}
        onClose={() => setModalAberto(null)}
      />
      <AnexarCteRetornoModal
        ocId={modalAberto === "cte_retorno" ? ocId : null}
        onClose={() => setModalAberto(null)}
      />
      <AnexarEstadiaModal
        ocId={modalAberto === "estadia" ? ocId : null}
        onClose={() => setModalAberto(null)}
      />
      <CalcularQuebraModal
        ocId={modalAberto === "calc_quebra" ? ocId : null}
        onClose={() => setModalAberto(null)}
      />
    </>
  );
}
