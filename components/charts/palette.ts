/* ════════════════════════════════════════════════════════════════════
 * Paleta unificada para gráficos (Recharts)
 * Casa com as cores --g600 / --a600 / --b600 etc. do tema agro.
 * ════════════════════════════════════════════════════════════════════ */

export const CORES_CHART = {
  green: "#2e7d32",
  greenLight: "#66bb6a",
  amber: "#f57f17",
  amberLight: "#ffb020",
  blue: "#1565c0",
  blueLight: "#42a5f5",
  red: "#c62828",
  teal: "#00897b",
  grey: "#9e9e9e",
} as const;

/** Sequência para charts categóricos (barras, pies). */
export const CORES_SEQUENCIAIS = [
  CORES_CHART.green,
  CORES_CHART.amber,
  CORES_CHART.blue,
  CORES_CHART.teal,
  CORES_CHART.red,
  CORES_CHART.greenLight,
  CORES_CHART.amberLight,
  CORES_CHART.blueLight,
];

/** Estilo padrão para tooltips. */
export const TOOLTIP_STYLE = {
  background: "white",
  border: "1px solid #e0e0e0",
  borderRadius: 8,
  fontSize: 12,
  padding: "8px 10px",
  boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
};
