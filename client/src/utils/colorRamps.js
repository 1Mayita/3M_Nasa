// =====================================================================
// Dueño: P3 (Vista)
// Rampas de color accesibles (aptas para daltonismo), como pide el reto.
//  - Secuencial (más focos = más oscuro): viridis invertido.
//  - Divergente (anomalía vs mediana): púrpura <-> naranja (PuOr de ColorBrewer).
// =====================================================================

// De pocos a muchos focos (claro -> oscuro)
export const SEQUENTIAL_RAMP = ['#fde725', '#90d743', '#35b779', '#21918c', '#31688e', '#443983', '#440154'];

// De "mucho menos que la mediana" (púrpura) a "mucho más que la mediana" (naranja)
export const DIVERGING_RAMP = ['#542788', '#8073ac', '#b2abd2', '#d8daeb', '#f7f7f7', '#fee0b6', '#fdb863', '#e08214', '#b35806'];

export const NO_DATA_COLOR = '#e0e0e0';

/**
 * Color para un valor entre 0 y maximumValue.
 */
export function getSequentialColor(value, maximumValue) {
  if (value === null || value === undefined || maximumValue <= 0) {
    return NO_DATA_COLOR;
  }
  const ratio = Math.min(Math.max(value / maximumValue, 0), 1);
  const index = Math.min(Math.floor(ratio * SEQUENTIAL_RAMP.length), SEQUENTIAL_RAMP.length - 1);
  return SEQUENTIAL_RAMP[index];
}

/**
 * Color para una anomalía en porcentaje respecto a la mediana (-100 % ... +100 % o más).
 */
export function getAnomalyColor(anomalyPercent) {
  if (anomalyPercent === null || anomalyPercent === undefined || Number.isNaN(anomalyPercent)) {
    return NO_DATA_COLOR;
  }
  const clampedPercent = Math.min(Math.max(anomalyPercent, -100), 100);
  const ratio = (clampedPercent + 100) / 200;
  const index = Math.min(Math.floor(ratio * DIVERGING_RAMP.length), DIVERGING_RAMP.length - 1);
  return DIVERGING_RAMP[index];
}

/**
 * Color de texto legible encima de un fondo (negro o blanco).
 */
export function getReadableTextColor(backgroundHex) {
  const hex = backgroundHex.replace('#', '');
  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  const luminance = (0.299 * red + 0.587 * green + 0.114 * blue) / 255;
  return luminance > 0.55 ? '#111111' : '#ffffff';
}
