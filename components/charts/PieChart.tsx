"use client";

import {
  Cell,
  Legend,
  Pie,
  PieChart as RPieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { CORES_SEQUENCIAIS, TOOLTIP_STYLE } from "./palette";

export interface PieItem {
  name: string;
  value: number;
  cor?: string;
}

interface Props {
  data: PieItem[];
  altura?: number;
  formatValor?: (v: number) => string;
  /** Donut em vez de pie completo. Default true. */
  donut?: boolean;
}

export function PieChart({
  data,
  altura = 240,
  formatValor = (v) => v.toLocaleString("pt-BR"),
  donut = true,
}: Props) {
  return (
    <ResponsiveContainer width="100%" height={altura}>
      <RPieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius={donut ? "50%" : 0}
          outerRadius="80%"
          paddingAngle={1}
          labelLine={false}
        >
          {data.map((item, i) => (
            <Cell key={i} fill={item.cor ?? CORES_SEQUENCIAIS[i % CORES_SEQUENCIAIS.length]} />
          ))}
        </Pie>
        <Tooltip
          formatter={(v) => (typeof v === "number" ? formatValor(v) : String(v ?? ""))}
          contentStyle={TOOLTIP_STYLE}
        />
        <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" iconSize={8} />
      </RPieChart>
    </ResponsiveContainer>
  );
}
