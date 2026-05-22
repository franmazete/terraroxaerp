/* ════════════════════════════════════════════════════════════════════
 * BLOCO J.10 — Helpers de geolocalização
 * Distância em linha reta (Haversine) + URLs do Google Maps externo.
 * Integração real de rotas (distância por estrada) virá com API Google.
 * ════════════════════════════════════════════════════════════════════ */

/** Velocidade média assumida para estimar tempo (km/h) — caminhão em rodovia. */
export const VELOCIDADE_MEDIA_KMH = 60;

/** Distância em linha reta entre dois pontos (km). */
export function distanciaHaversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/** Tempo estimado em horas a partir da distância (assume velocidade média). */
export function tempoEstimadoHoras(distanciaKm: number): number {
  if (distanciaKm <= 0) return 0;
  return distanciaKm / VELOCIDADE_MEDIA_KMH;
}

/** Formata duração em horas para "Xh Ymin" ou "Y dias Z h". */
export function fmtDuracao(horas: number): string {
  if (horas <= 0) return "—";
  if (horas < 24) {
    const h = Math.floor(horas);
    const min = Math.round((horas - h) * 60);
    return min > 0 ? `${h}h ${min}min` : `${h}h`;
  }
  const dias = Math.floor(horas / 24);
  const restoH = Math.round(horas - dias * 24);
  return restoH > 0 ? `${dias}d ${restoH}h` : `${dias}d`;
}

/** URL externa do Google Maps para visualizar um ponto. */
export function urlPonto(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

/** URL externa do Google Maps para rota origem → destino. */
export function urlRota(
  origemLat: number,
  origemLng: number,
  destinoLat: number,
  destinoLng: number,
): string {
  return `https://www.google.com/maps/dir/?api=1&origin=${origemLat},${origemLng}&destination=${destinoLat},${destinoLng}&travelmode=driving`;
}

/** URL externa fallback baseada em nome+cidade (quando não tem lat/lng). */
export function urlBuscaTexto(query: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}
