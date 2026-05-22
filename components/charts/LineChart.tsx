"use client";

import {
  CartesianGrid,
  Legend,
  Line,
  LineChart as RLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CORES_SEQUENCIAIS, TOOLTIP_STYLE } from "./palette";

export interface LinePoint {
  name: string;
  [serie: string]: string | number;
}

interface Props {
  data: LinePoint[];
  /** Nomes das séries (cada uma vira uma linha). */
  series: { key: string; label: string; cor?: string }[];
  altura?: number;
  formatValor?: (v: number) => string;
  grid?: boolean;
}

export function LineChart({
  data,
  series,
  altura = 240,
  formatValor = (v) => v.toLocaleString("pt-BR"),
  grid = true,
}: Props) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <RLineChart data={data} margin={{ top: 10, right: 16, bottom: 0, left: 0 }}>
        {grid && <CartesianGrid strokeDasharray="3 3" stroke="#e8e8e8" />}
        <XAxis dataKey="name" fontSize={11} stroke="#888" />
        <YAxis tickFormatter={formatValor} fontSize={11} stroke="#888" />
        <Tooltip
          formatter={(v) => (typeof v === "number" ? formatValor(v) : String(v ?? ""))}
          contentStyle={TOOLTIP_STYLE}
        />
        {series.length > 1 && <Legend wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />}
        {series.map((s, i) => (
          <Line
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.label}
            stroke={s.cor ?? CORES_SEQUENCIAIS[i % CORES_SEQUENCIAIS.length]}
            strokeWidth={2.5}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </RLineChart>
    </ResponsiveContainer>
  );
}
