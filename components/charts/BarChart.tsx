"use client";

import {
  Bar,
  BarChart as RBarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CORES_CHART, CORES_SEQUENCIAIS, TOOLTIP_STYLE } from "./palette";

export interface BarItem {
  /** Eixo X (categoria). */
  name: string;
  /** Valor da barra. */
  value: number;
  /** Cor opcional — se não informada, usa CORES_SEQUENCIAIS. */
  cor?: string;
}

interface Props {
  data: BarItem[];
  /** Altura em px. Default 240. */
  altura?: number;
  /** Formatador do valor pro tooltip. */
  formatValor?: (v: number) => string;
  /** Cor uniforme (sobrescreve a sequência). */
  cor?: string;
  /** Layout: vertical (default) ou horizontal (categorias no Y). */
  layout?: "vertical" | "horizontal";
  /** Mostrar grid de fundo. */
  grid?: boolean;
}

/** BarChart wrapper com paleta agro e formatação PT-BR. */
export function BarChart({
  data,
  altura = 240,
  formatValor = (v) => v.toLocaleString("pt-BR"),
  cor,
  layout = "vertical",
  grid = true,
}: Props) {
  const isHoriz = layout === "horizontal";
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <RBarChart
        data={data}
        layout={isHoriz ? "vertical" : "horizontal"}
        margin={{ top: 10, right: 16, bottom: 0, left: isHoriz ? 60 : 0 }}
      >
        {grid && <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />}
        {isHoriz ? (
          <>
            <XAxis type="number" tickFormatter={formatValor} fontSize={11} stroke="#888" />
            <YAxis type="category" dataKey="name" fontSize={11} stroke="#888" width={120} />
          </>
        ) : (
          <>
            <XAxis dataKey="name" fontSize={11} stroke="#888" />
            <YAxis tickFormatter={formatValor} fontSize={11} stroke="#888" />
          </>
        )}
        <Tooltip
          formatter={(v) => (typeof v === "number" ? formatValor(v) : String(v ?? ""))}
          contentStyle={TOOLTIP_STYLE}
          cursor={{ fill: "rgba(0,0,0,0.04)" }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]} fill={cor ?? CORES_CHART.green}>
          {data.map((item, i) => (
            <Cell key={i} fill={item.cor ?? cor ?? CORES_SEQUENCIAIS[i % CORES_SEQUENCIAIS.length]} />
          ))}
        </Bar>
      </RBarChart>
    </ResponsiveContainer>
  );
}
