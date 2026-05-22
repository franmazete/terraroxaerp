"use client";

import { useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertBox } from "@/components/ui/AlertBox";
import { Badge } from "@/components/ui/Badge";
import { Field, FormRow, Textarea } from "@/components/ui/Form";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";

interface Props {
  ocId: string | null;
  onClose: () => void;
}

type Canal = "whatsapp" | "email";
type Origem = "produtor" | "transp" | "motorista" | "destino";

interface DestinatarioItem {
  id: string;
  origem: Origem;
  origemLabel: string;
  nome: string;
  whatsapp?: string;
  email?: string;
}

export function EnviarOCModal({ ocId, onClose }: Props) {
  const { ordens, contratos, cargas, transportadoras, motoristas, locais, produtores } =
    useDataStore();
  const toast = useToast();
  const [canal, setCanal] = useState<Canal>("whatsapp");
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [mensagem, setMensagem] = useState(
    "Olá! Segue a Ordem de Carregamento gerada pelo terraroxa. Em anexo o PDF com todos os detalhes do trajeto, motorista, veículo e checklist da operação.",
  );

  const destinatarios: DestinatarioItem[] = useMemo(() => {
    if (!ocId) return [];
    const oc = ordens.find((o) => o.id === ocId);
    if (!oc) return [];
    const carga = cargas.find((c) => c.id === oc.carga_id);
    const contrato = contratos.find((c) => c.id === oc.contrato_id);
    const produtor = contrato ? produtores.find((p) => p.id === contrato.produtor_id) : undefined;
    const transp = transportadoras.find((t) => t.id === oc.transp_id);
    const motorista = motoristas.find((m) => m.id === oc.motorista_id);
    const destino = oc.destino_local_id ? locais.find((l) => l.id === oc.destino_local_id) : undefined;

    const list: DestinatarioItem[] = [];
    if (produtor) {
      list.push({
        id: `produtor:${produtor.id}`,
        origem: "produtor",
        origemLabel: "Produtor",
        nome: produtor.nome,
        whatsapp: produtor.contato,
        email: produtor.email,
      });
    }
    if (transp) {
      list.push({
        id: `transp:${transp.id}`,
        origem: "transp",
        origemLabel: "Transportadora",
        nome: transp.nome_fantasia,
        whatsapp: transp.telefone,
        email: transp.email,
      });
    }
    if (motorista) {
      list.push({
        id: `motorista:${motorista.id}`,
        origem: "motorista",
        origemLabel: "Motorista",
        nome: motorista.nome,
        whatsapp: motorista.celular,
        email: motorista.email,
      });
    }
    if (destino) {
      list.push({
        id: `destino:${destino.id}`,
        origem: "destino",
        origemLabel: "Destino",
        nome: destino.nome,
        whatsapp: destino.contato_whatsapp,
        email: destino.contato_email,
      });
    }
    return list;
  }, [ocId, ordens, cargas, contratos, transportadoras, motoristas, locais, produtores]);

  function toggle(id: string) {
    setSelecionados((s) => {
      const novo = new Set(s);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }

  function podeReceber(d: DestinatarioItem) {
    return canal === "whatsapp" ? !!d.whatsapp : !!d.email;
  }

  function submit() {
    if (selecionados.size === 0) {
      toast.warn("Selecione pelo menos um destinatário.");
      return;
    }
    const escolhidos = destinatarios.filter((d) => selecionados.has(d.id) && podeReceber(d));
    if (escolhidos.length === 0) {
      toast.warn(
        `Nenhum destinatário selecionado tem ${canal === "whatsapp" ? "WhatsApp" : "email"} cadastrado.`,
      );
      return;
    }
    const nomes = escolhidos.map((d) => `${d.origemLabel}: ${d.nome}`).join(", ");
    toast.success(
      `${escolhidos.length} envio(s) ${canal === "whatsapp" ? "WhatsApp" : "email"} simulado(s) — ${nomes}. (Integração real na Etapa 3+)`,
      "Envio simulado",
    );
    setSelecionados(new Set());
    onClose();
  }

  if (!ocId) return null;

  return (
    <Modal
      open={!!ocId}
      onClose={onClose}
      title="📨 Enviar OC por WhatsApp / Email"
      subtitle="Mock — listagem de contatos vinculados à OC"
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" onClick={submit}>
            📨 Enviar via {canal === "whatsapp" ? "WhatsApp" : "Email"}
          </Button>
        </>
      }
    >
      <AlertBox tone="amber" icon="⚠️" title="Modo simulação">
        Esta tela apenas <strong>lista os destinatários e simula o envio</strong>. Integrações reais com WhatsApp Business / Resend / SMTP virão na Etapa 3+.
      </AlertBox>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <Button
          variant={canal === "whatsapp" ? "primary" : undefined}
          onClick={() => setCanal("whatsapp")}
        >
          📱 WhatsApp
        </Button>
        <Button
          variant={canal === "email" ? "primary" : undefined}
          onClick={() => setCanal("email")}
        >
          ✉️ Email
        </Button>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>
        Selecione destinatários
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 8, marginBottom: 14 }}>
        {destinatarios.map((d) => {
          const ok = podeReceber(d);
          const sel = selecionados.has(d.id);
          return (
            <label
              key={d.id}
              style={{
                display: "flex",
                alignItems: "start",
                gap: 8,
                padding: "10px 12px",
                background: !ok ? "var(--surf3)" : sel ? "var(--g100)" : "var(--surf2)",
                border: `1px solid ${!ok ? "var(--border)" : sel ? "var(--g500)" : "var(--border)"}`,
                borderRadius: "var(--radius)",
                cursor: ok ? "pointer" : "not-allowed",
                opacity: ok ? 1 : 0.55,
              }}
            >
              <input
                type="checkbox"
                checked={sel}
                disabled={!ok}
                onChange={() => toggle(d.id)}
                style={{ marginTop: 2 }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <Badge tone="blue">{d.origemLabel}</Badge>
                </div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{d.nome}</div>
                <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                  {canal === "whatsapp"
                    ? d.whatsapp
                      ? `📱 ${d.whatsapp}`
                      : <span style={{ color: "var(--r600)" }}>Sem WhatsApp cadastrado</span>
                    : d.email
                      ? `✉️ ${d.email}`
                      : <span style={{ color: "var(--r600)" }}>Sem email cadastrado</span>}
                </div>
                {/* Mostra o outro canal como referência */}
                {canal === "whatsapp" && d.email && (
                  <div style={{ fontSize: 10, color: "var(--hint)", marginTop: 2 }}>✉️ {d.email}</div>
                )}
                {canal === "email" && d.whatsapp && (
                  <div style={{ fontSize: 10, color: "var(--hint)", marginTop: 2 }}>📱 {d.whatsapp}</div>
                )}
              </div>
            </label>
          );
        })}
      </div>

      <FormRow variant="single">
        <Field label="Mensagem" hint="Será enviada com o PDF da OC anexado">
          <Textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} />
        </Field>
      </FormRow>
    </Modal>
  );
}
