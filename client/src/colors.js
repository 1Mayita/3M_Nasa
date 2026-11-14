// Rampas de color accesibles (aptas para daltonismo). Dueño: P3 - Vista
// Secuencial "llamas" (YlOrRd) para cantidad de focos
export const FLAME = ['#fff5d6', '#fee391', '#fec44f', '#fe9929', '#ec7014', '#cc4c02', '#8c2d04'];
// Divergente (RdBu invertida) para anomalía: azul = menos que lo normal, rojo = más
export const DIVERGING = ['#2166ac', '#67a9cf', '#d1e5f0', '#f7f7f7', '#fddbc7', '#ef8a62', '#b2182b'];
export const EMPTY = '#eef0f2';

/** Color por cantidad, en escala logarítmica respecto del máximo */
export function flameColor(v, max) {
  if (!v || v <= 0 || !max) return EMPTY;
  const t = Math.log1p(v) / Math.log1p(max);
  return FLAME[Math.min(FLAME.length - 1, Math.floor(t * FLAME.length))];
}

/** Color por anomalía en % respecto de la mediana (cortes simétricos) */
export const ANOMALY_BREAKS = [-75, -40, -10, 10, 40, 100];
export function anomalyColor(pct) {
  if (pct === null || pct === undefined) return EMPTY;
  let i = 0;
  while (i < ANOMALY_BREAKS.length && pct > ANOMALY_BREAKS[i]) i++;
  return DIVERGING[i];
}

export const SOURCE_COLOR = { modis_scaled: '#7a5195', viirs: '#ef5675', viirs_noaa20_scaled: '#ffa600' };
export const SOURCE_LABEL = {
  modis_scaled: 'MODIS escalado a VIIRS',
  viirs: 'VIIRS S-NPP',
  viirs_noaa20_scaled: 'VIIRS NOAA-20 (calibrado)',
};
