"use client";

import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";
import { AlertBox } from "@/components/ui/AlertBox";
import { Field, FormRow, Input, Select, Textarea, SectionLabel, UploadZone } from "@/components/ui/Form";
import { NumberInput } from "@/components/ui/NumberInput";
import { useAuth } from "@/lib/auth/AuthContext";
import { useDataStore } from "@/lib/data-store";
import { useToast } from "@/components/ui/Toast";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useRouter } from "next/navigation";
import { criarReservaAction } from "@/lib/api/actions";
import {
  criarMotorista as criarMotoristaAction,
  criarVeiculo as criarVeiculoAction,
  vincularMotoristaTransp,
  vincularVeiculoTransp,
} from "@/lib/api/cadastros-actions";
import { disponivelKg } from "@/lib/domain/saldo";
import { fmtKg, fmtBRLNumber } from "@/lib/domain/format";
import { transportadorasDb } from "@/lib/mock-data";
import { createClient } from "@/lib/supabase/client";
import type { Carga, Motorista, TipoVeiculo, Transportadora, Veiculo } from "@/lib/types";

interface Props {
  carga: Carga | null;
  onClose: () => void;
  onSuccess?: () => void;
}

const TIPOS_VEICULO: TipoVeiculo[] = ["Bitrem", "Rodotrem", "Treminhão", "Carreta Simples", "Truck"];

interface NovoMotorista { nome: string; cpf: string; cnh: string; celular: string; }
interface NovoVeiculo { placa_cavalo: string; placa_carreta: string; tipo: TipoVeiculo; capacidade_kg: number; }

const EMPTY_MOT: NovoMotorista = { nome: "", cpf: "", cnh: "", celular: "" };
const EMPTY_VEI: NovoVeiculo = { placa_cavalo: "", placa_carreta: "", tipo: "Bitrem", capacidade_kg: 40000 };

export function ReservarCargaModal({ carga, onClose, onSuccess }: Props) {
  const { user, supabaseConfigured } = useAuth();
  const toast = useToast();
  const confirmar = useConfirm();
  const router = useRouter();
  const { criarReserva, motoristas, veiculos, addMotorista, addVeiculo, vincularTranspAoMotorista, vincularTranspAoVeiculo } = useDataStore();
  const [qtd, setQtd] = useState<number | "">("");
  const [frete, setFrete] = useState<number | "">("");
  const [obs, setObs] = useState("");
  const [motoristaId, setMotoristaId] = useState<string>("");
  const [veiculoId, setVeiculoId] = useState<string>("");
  const [novoMotOpen, setNovoMotOpen] = useState(false);
  const [novoMot, setNovoMot] = useState<NovoMotorista>(EMPTY_MOT);
  const [novoVeiOpen, setNovoVeiOpen] = useState(false);
  const [novoVei, setNovoVei] = useState<NovoVeiculo>(EMPTY_VEI);

  // Estado da transportadora vinda do banco real (Supabase) — necessário porque
  // o user.transp_id é UUID que não bate com o objeto mock transportadorasDb.
  const [transpReal, setTranspReal] = useState<Transportadora | null>(null);
  const [erroBuscarTransp, setErroBuscarTransp] = useState<string | null>(null);

  // Motoristas e veículos da transp em modo Supabase (busca via Supabase client).
  // O useDataStore retorna mock vazio em produção, então precisamos buscar do banco.
  const [motoristasReais, setMotoristasReais] = useState<Motorista[]>([]);
  const [veiculosReais, setVeiculosReais] = useState<Veiculo[]>([]);
  const [salvandoMot, setSalvandoMot] = useState(false);
  const [salvandoVei, setSalvandoVei] = useState(false);

  // Busca a transportadora + motoristas + veículos do user logado em modo Supabase
  useEffect(() => {
    if (!user?.transp_id || !supabaseConfigured || !carga) return;
    let cancelado = false;
    (async () => {
      const supabase = createClient();
      const transpId = user.transp_id!;

      // 1. Transportadora
      const { data: transpData, error: errT } = await supabase
        .from("transportadoras")
        .select("*")
        .eq("id", transpId)
        .maybeSingle();
      if (cancelado) return;
      if (errT || !transpData) {
        setErroBuscarTransp(
          "Não conseguimos carregar os dados da sua transportadora. Avise o administrador para verificar o vínculo do seu usuário.",
        );
        setTranspReal(null);
        return;
      }
      setErroBuscarTransp(null);
      setTranspReal(transpData as Transportadora);

      // 2. Motoristas vinculados (via tabela N:N)
      const { data: motData } = await supabase
        .from("motoristas")
        .select("*, motorista_transportadoras!inner(transp_id)")
        .eq("motorista_transportadoras.transp_id", transpId)
        .eq("ativo", true);
      if (!cancelado) {
        const motoristas = (motData ?? []).map((m: Record<string, unknown>) => ({
          ...m,
          transp_ids: [transpId],
        })) as Motorista[];
        setMotoristasReais(motoristas);
      }

      // 3. Veículos vinculados (via tabela N:N)
      const { data: veiData } = await supabase
        .from("veiculos")
        .select("*, veiculo_transportadoras!inner(transp_id)")
        .eq("veiculo_transportadoras.transp_id", transpId)
        .eq("ativo", true);
      if (!cancelado) {
        const veiculos = (veiData ?? []).map((v: Record<string, unknown>) => ({
          ...v,
          transp_ids: [transpId],
        })) as Veiculo[];
        setVeiculosReais(veiculos);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [user?.transp_id, supabaseConfigured, carga]);

  const meusMotoristas = useMemo(
    () => {
      if (supabaseConfigured) return motoristasReais;
      return motoristas.filter((m) => user?.transp_id && m.transp_ids.includes(user.transp_id) && m.ativo);
    },
    [supabaseConfigured, motoristasReais, motoristas, user?.transp_id],
  );
  const meusVeiculos = useMemo(
    () => {
      if (supabaseConfigured) return veiculosReais;
      return veiculos.filter((v) => user?.transp_id && v.transp_ids.includes(user.transp_id) && v.ativo);
    },
    [supabaseConfigured, veiculosReais, veiculos, user?.transp_id],
  );

  if (!carga || !user || user.role !== "transportadora" || !user.transp_id) return null;

  // Em modo Supabase: usa transpReal (buscado do banco). Em modo mock: usa o dict legacy.
  const transp: Transportadora | null = supabaseConfigured
    ? transpReal
    : (transportadorasDb[user.transp_id] as Transportadora | undefined) ?? null;

  // Se não conseguiu carregar a transportadora, mostra mensagem clara
  if (!transp) {
    return (
      <Modal open={!!carga} onClose={onClose} title="Reservar Carga">
        <AlertBox tone="amber" icon="⚠️" title="Não foi possível carregar sua transportadora">
          {erroBuscarTransp ?? "Aguardando dados da sua transportadora..."}
          <div style={{ marginTop: 10, fontSize: 12 }}>
            <strong>O que fazer:</strong>
            <ul style={{ marginTop: 6, paddingLeft: 20, lineHeight: 1.6 }}>
              <li>Confira com o administrador se seu usuário está vinculado a uma transportadora cadastrada.</li>
              <li>O administrador pode editar o vínculo em <strong>Configurações → Usuários</strong>.</li>
              <li>Se a transportadora foi recém-criada, tente recarregar a página.</li>
            </ul>
          </div>
        </AlertBox>
        <div style={{ marginTop: 16, textAlign: "right" }}>
          <Button onClick={onClose}>Fechar</Button>
        </div>
      </Modal>
    );
  }

  const disp = disponivelKg(carga);
  const qtdN = typeof qtd === "number" ? qtd : 0;
  const freteN = typeof frete === "number" ? frete : 0;
  const total = (qtdN / 1000) * freteN;

  async function cadastrarMotorista() {
    if (!novoMot.nome.trim()) { toast.warn("Informe o nome do motorista."); return; }
    if (!novoMot.cpf.trim()) { toast.warn("Informe o CPF."); return; }
    if (!novoMot.cnh.trim()) { toast.warn("Informe a CNH."); return; }
    if (!user?.transp_id) return;

    // Detector de CPF duplicado: oferece vincular existente em vez de criar
    const cpfLimpo = novoMot.cpf.replace(/\D+/g, "");
    const existente = motoristas.find((m) => m.cpf.replace(/\D+/g, "") === cpfLimpo);
    if (existente) {
      if (existente.transp_ids.includes(user.transp_id)) {
        toast.info(`Motorista "${existente.nome}" já está vinculado — selecione no dropdown acima.`);
        setMotoristaId(existente.id);
        setNovoMot(EMPTY_MOT);
        setNovoMotOpen(false);
        return;
      }
      const ok = await confirmar({
        titulo: "CPF já cadastrado",
        mensagem: (
          <>
            Já existe um motorista com este CPF: <strong>{existente.nome}</strong> (CNH {existente.cnh}).
            <div style={{ marginTop: 8 }}>Vincular sua transportadora a este motorista para usar nesta reserva?</div>
          </>
        ),
        variante: "warn",
        confirmarLabel: "Vincular",
      });
      if (ok) {
        vincularTranspAoMotorista(existente.id, user.transp_id);
        setMotoristaId(existente.id);
        setNovoMot(EMPTY_MOT);
        setNovoMotOpen(false);
      }
      return;
    }

    if (supabaseConfigured) {
      setSalvandoMot(true);
      try {
        const res = await criarMotoristaAction({
          nome: novoMot.nome.trim(),
          cpf: novoMot.cpf.trim(),
          cnh: novoMot.cnh.trim(),
          celular: novoMot.celular.trim() || "—",
          transp_ids: [user.transp_id],
        });
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        const novo = res.data as Motorista;
        // Adiciona à lista local pra aparecer no select imediatamente
        setMotoristasReais((arr) => [...arr, novo]);
        setMotoristaId(novo.id);
        setNovoMot(EMPTY_MOT);
        setNovoMotOpen(false);
        toast.success(`Motorista "${novo.nome}" cadastrado.`);
      } finally {
        setSalvandoMot(false);
      }
      return;
    }

    // Modo mock (fallback)
    const m = addMotorista({ ...novoMot, transp_ids: [user.transp_id], ativo: true });
    setMotoristaId(m.id);
    setNovoMot(EMPTY_MOT);
    setNovoMotOpen(false);
    toast.success(`Motorista "${m.nome}" cadastrado.`);
  }

  async function cadastrarVeiculo() {
    if (!novoVei.placa_cavalo.trim()) { toast.warn("Informe a placa do cavalo."); return; }
    if (!novoVei.capacidade_kg || novoVei.capacidade_kg <= 0) { toast.warn("Informe a capacidade em kg."); return; }
    if (!user?.transp_id) return;

    const placaUp = novoVei.placa_cavalo.toUpperCase().replace(/\s+/g, "");
    const existente = veiculos.find((v) => v.placa_cavalo.toUpperCase().replace(/\s+/g, "") === placaUp);
    if (existente) {
      if (existente.transp_ids.includes(user.transp_id)) {
        toast.info(`Veículo "${existente.placa_cavalo}" já está vinculado — selecione no dropdown acima.`);
        setVeiculoId(existente.id);
        setNovoVei(EMPTY_VEI);
        setNovoVeiOpen(false);
        return;
      }
      const ok = await confirmar({
        titulo: "Placa já cadastrada",
        mensagem: (
          <>
            Já existe um veículo com esta placa: <strong>{existente.placa_cavalo}</strong> ({existente.tipo}, {existente.capacidade_kg.toLocaleString("pt-BR")} kg).
            <div style={{ marginTop: 8 }}>Vincular sua transportadora a este veículo para usar nesta reserva?</div>
          </>
        ),
        variante: "warn",
        confirmarLabel: "Vincular",
      });
      if (ok) {
        vincularTranspAoVeiculo(existente.id, user.transp_id);
        setVeiculoId(existente.id);
        setNovoVei(EMPTY_VEI);
        setNovoVeiOpen(false);
      }
      return;
    }

    if (supabaseConfigured) {
      setSalvandoVei(true);
      try {
        const res = await criarVeiculoAction({
          placa_cavalo: novoVei.placa_cavalo.toUpperCase().trim(),
          placa_carreta: novoVei.placa_carreta.toUpperCase().trim() || undefined,
          tipo: novoVei.tipo,
          capacidade_kg: novoVei.capacidade_kg,
          transp_ids: [user.transp_id],
        });
        if ("error" in res) {
          toast.error(res.error);
          return;
        }
        const novo = res.data as Veiculo;
        // Adiciona à lista local pra aparecer no select imediatamente
        setVeiculosReais((arr) => [...arr, novo]);
        setVeiculoId(novo.id);
        setNovoVei(EMPTY_VEI);
        setNovoVeiOpen(false);
        toast.success(`Veículo "${novo.placa_cavalo}" cadastrado.`);
      } finally {
        setSalvandoVei(false);
      }
      return;
    }

    // Modo mock (fallback)
    const v = addVeiculo({
      placa_cavalo: novoVei.placa_cavalo,
      placa_carreta: novoVei.placa_carreta || undefined,
      tipo: novoVei.tipo,
      capacidade_kg: novoVei.capacidade_kg,
      transp_ids: [user.transp_id],
      ativo: true,
    });
    setVeiculoId(v.id);
    setNovoVei(EMPTY_VEI);
    setNovoVeiOpen(false);
    toast.success(`Veículo "${v.placa_cavalo}" cadastrado.`);
  }

  async function submit() {
    if (!carga || !user?.transp_id) return;
    if (qtdN <= 0) { toast.warn("Informe a quantidade em kg."); return; }
    if (qtdN > disp) { toast.error(`Quantidade maior que disponível (${fmtKg(disp)}).`); return; }
    if (freteN <= 0) { toast.warn("Informe o valor do frete por tonelada."); return; }
    if (!motoristaId) { toast.warn("Selecione ou cadastre um motorista."); return; }
    if (!veiculoId) { toast.warn("Selecione ou cadastre um veículo."); return; }

    const mot = motoristas.find((m) => m.id === motoristaId);
    const vei = veiculos.find((v) => v.id === veiculoId);
    if (!mot || !vei) { toast.error("Motorista ou veículo inválido."); return; }

    if (qtdN > vei.capacidade_kg) {
      const ok = await confirmar({
        titulo: "Quantidade acima da capacidade do veículo",
        mensagem: (
          <>
            A quantidade reservada (<strong>{fmtKg(qtdN)}</strong>) é maior que a capacidade do veículo
            (<strong>{fmtKg(vei.capacidade_kg)}</strong>).
            <div style={{ marginTop: 8 }}>Continuar mesmo assim?</div>
          </>
        ),
        variante: "warn",
        confirmarLabel: "Sim, continuar",
      });
      if (!ok) return;
    }

    if (supabaseConfigured) {
      // ─── Modo Supabase: grava via Server Action ─────────────────
      const r = await criarReservaAction({
        carga_id: carga.id,
        motorista_id: mot.id,
        veiculo_id: vei.id,
        motorista: mot.nome,
        placa: vei.placa_cavalo,
        qtd_kg: qtdN,
        frete_ton: freteN,
        obs,
      });
      if ("error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(
        `Reserva criada · ${fmtKg(qtdN)} · R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Aguardando aprovação da cerealista.`,
        "Reserva enviada",
      );
      router.refresh();
      onSuccess?.();
      onClose();
      return;
    }

    // ─── Modo mock (fallback) ────────────────────────────────────
    // transp já foi validado como não-null acima
    const reserva = criarReserva(carga.id, {
      transp_id: user.transp_id,
      transp_nome: transp!.nome_fantasia,
      motorista_id: mot.id,
      veiculo_id: vei.id,
      motorista: mot.nome,
      cpf: mot.cpf,
      cnh: mot.cnh,
      placa: vei.placa_cavalo,
      carreta: vei.placa_carreta,
      tipo_veiculo: vei.tipo,
      qtd_kg: qtdN,
      frete_ton: freteN,
      obs,
    });

    if (reserva) {
      toast.success(
        `${reserva.id} · ${fmtKg(qtdN)} · R$ ${total.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}. Aguardando aprovação da cerealista.`,
        "Reserva enviada",
      );
      onSuccess?.();
      onClose();
    }
  }

  return (
    <Modal
      open={!!carga}
      onClose={onClose}
      title={<>🚚 Reservar Carga — {carga.produto}</>}
      subtitle={
        <>
          {carga.origem} → {carga.destino || "Destino a definir"} · {fmtKg(disp)} disponíveis
        </>
      }
      wide
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button variant="primary" size="lg" onClick={submit}>
            🚚 Confirmar Reserva
          </Button>
        </>
      }
    >
      <AlertBox tone="green" icon="ℹ️" title="Reserva parcial permitida">
        Você pode reservar qualquer quantidade até {fmtKg(disp)} disponíveis. O saldo restante ficará aberto para outras transportadoras.
      </AlertBox>

      <div style={{ background: "var(--surf2)", borderRadius: "var(--radius)", padding: 12, margin: "12px 0 16px" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
          Transportadora (vinculada ao seu login)
        </div>
        <div style={{ fontSize: 14, fontWeight: 600 }}>{transp.nome_fantasia}</div>
        <div style={{ fontSize: 11, color: "var(--muted)" }}>{transp.cnpj_cpf}</div>
      </div>

      <FormRow>
        <Field label="Quantidade que deseja carregar *" hint={`Máx disponível: ${fmtKg(disp)}`}>
          <NumberInput value={qtd} onChange={setQtd} placeholder="Ex: 50.000" suffix="kg" />
        </Field>
        <Field label="Valor do Frete *" hint="R$ por tonelada">
          <NumberInput value={frete} onChange={setFrete} variant="currency" placeholder="Ex: 65,00" suffix="R$/t" />
        </Field>
      </FormRow>

      {qtdN > 0 && freteN > 0 && (
        <div style={{ background: "var(--g100)", borderRadius: "var(--radius)", padding: "10px 12px", marginBottom: 12, fontSize: 13, color: "var(--g700)", fontWeight: 600 }}>
          💰 Total estimado do frete: R$ {fmtBRLNumber(total)}
        </div>
      )}

      <SectionLabel>Motorista</SectionLabel>
      <Field
        label={`Motorista * (${meusMotoristas.length} cadastrado${meusMotoristas.length !== 1 ? "s" : ""})`}
        hint={meusMotoristas.length === 0 ? "Você não tem motoristas cadastrados — clique no '+ Novo' pra cadastrar rapidamente." : "Clique no '+ Novo' pra cadastrar outro motorista sem sair desta tela."}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <Select value={motoristaId} onChange={(e) => setMotoristaId(e.target.value)} style={{ flex: 1 }}>
            <option value="">Selecione o motorista...</option>
            {meusMotoristas.map((m) => (
              <option key={m.id} value={m.id}>{m.nome} — CPF {m.cpf} — CNH {m.cnh}</option>
            ))}
          </Select>
          <Button
            size="sm"
            variant={novoMotOpen ? "danger" : "success"}
            onClick={() => setNovoMotOpen((v) => !v)}
            title={novoMotOpen ? "Fechar cadastro rápido" : "Cadastrar novo motorista sem fechar este modal"}
          >
            {novoMotOpen ? "× Fechar" : "+ Novo"}
          </Button>
        </div>
      </Field>

      {novoMotOpen && (
        <div style={{ background: "var(--surf2)", padding: 14, borderRadius: "var(--radius)", marginBottom: 14, border: "1px dashed var(--g400)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g700)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
            ＋ Novo motorista (vinculado a {transp.nome_fantasia})
          </div>
          <FormRow variant="triple">
            <Field label="Nome *">
              <Input value={novoMot.nome} onChange={(e) => setNovoMot({ ...novoMot, nome: e.target.value })} />
            </Field>
            <Field label="CPF *">
              <Input value={novoMot.cpf} onChange={(e) => setNovoMot({ ...novoMot, cpf: e.target.value })} placeholder="000.000.000-00" />
            </Field>
            <Field label="CNH *">
              <Input value={novoMot.cnh} onChange={(e) => setNovoMot({ ...novoMot, cnh: e.target.value })} />
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Celular">
              <Input value={novoMot.celular} onChange={(e) => setNovoMot({ ...novoMot, celular: e.target.value })} placeholder="(65) 99000-0000" />
            </Field>
            <Field label="Upload CNH">
              <UploadZone label="Clique para anexar CNH (PDF/imagem)" icon="📄" required />
            </Field>
          </FormRow>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <Button variant="success" onClick={cadastrarMotorista} disabled={salvandoMot}>
              {salvandoMot ? "Salvando..." : "✓ Salvar motorista e usar nesta reserva"}
            </Button>
          </div>
        </div>
      )}

      <SectionLabel>Veículo</SectionLabel>
      <Field
        label={`Veículo * (${meusVeiculos.length} cadastrado${meusVeiculos.length !== 1 ? "s" : ""})`}
        hint={meusVeiculos.length === 0 ? "Você não tem veículos cadastrados — clique no '+ Novo' pra cadastrar rapidamente." : "Clique no '+ Novo' pra cadastrar outro veículo sem sair desta tela."}
      >
        <div style={{ display: "flex", gap: 6 }}>
          <Select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} style={{ flex: 1 }}>
            <option value="">Selecione o veículo...</option>
            {meusVeiculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.placa_cavalo}{v.placa_carreta ? ` + ${v.placa_carreta}` : ""} — {v.tipo} — {fmtKg(v.capacidade_kg)}
              </option>
            ))}
          </Select>
          <Button
            size="sm"
            variant={novoVeiOpen ? "danger" : "success"}
            onClick={() => setNovoVeiOpen((v) => !v)}
            title={novoVeiOpen ? "Fechar cadastro rápido" : "Cadastrar novo veículo sem fechar este modal"}
          >
            {novoVeiOpen ? "× Fechar" : "+ Novo"}
          </Button>
        </div>
      </Field>

      {novoVeiOpen && (
        <div style={{ background: "var(--surf2)", padding: 14, borderRadius: "var(--radius)", marginBottom: 14, border: "1px dashed var(--g400)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--g700)", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 10 }}>
            ＋ Novo veículo (vinculado a {transp.nome_fantasia})
          </div>
          <FormRow variant="triple">
            <Field label="Placa Cavalo *">
              <Input value={novoVei.placa_cavalo} onChange={(e) => setNovoVei({ ...novoVei, placa_cavalo: e.target.value.toUpperCase() })} placeholder="AAA-0000" />
            </Field>
            <Field label="Placa Carreta">
              <Input value={novoVei.placa_carreta} onChange={(e) => setNovoVei({ ...novoVei, placa_carreta: e.target.value.toUpperCase() })} placeholder="BBB-1111" />
            </Field>
            <Field label="Tipo *">
              <Select value={novoVei.tipo} onChange={(e) => setNovoVei({ ...novoVei, tipo: e.target.value as TipoVeiculo })}>
                {TIPOS_VEICULO.map((t) => <option key={t}>{t}</option>)}
              </Select>
            </Field>
          </FormRow>
          <FormRow>
            <Field label="Capacidade *">
              <NumberInput
                value={novoVei.capacidade_kg || ""}
                onChange={(n) => setNovoVei({ ...novoVei, capacidade_kg: typeof n === "number" ? n : 0 })}
                suffix="kg"
                placeholder="Ex: 40.000"
              />
            </Field>
            <Field label="Documento CRLV">
              <UploadZone label="Clique para anexar CRLV" icon="📋" required />
            </Field>
          </FormRow>
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 6 }}>
            <Button variant="success" onClick={cadastrarVeiculo} disabled={salvandoVei}>
              {salvandoVei ? "Salvando..." : "✓ Salvar veículo e usar nesta reserva"}
            </Button>
          </div>
        </div>
      )}

      <FormRow variant="single">
        <Field label="Observações">
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Informações adicionais, restrições, disponibilidade..." />
        </Field>
      </FormRow>
    </Modal>
  );
}
