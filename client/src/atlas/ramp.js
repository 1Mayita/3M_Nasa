// Rampa de intensidad: pino -> eucalipto -> salvia -> ámbar claro -> ámbar.
// El ámbar queda reservado al fuego: lo más caliente es lo más cálido.
const STOPS = [
  [0, [31, 61, 43]],
  [0.25, [79, 127, 99]],
  [0.55, [191, 216, 196]],
  [0.8, [246, 196, 106]],
  [1, [224, 122, 47]]
];

export const EMPTY_COLOR = [22, 38, 30];

export function rampColor(ratio) {
  const t = Math.min(Math.max(ratio, 0), 1);
  for (let i = 1; i < STOPS.length; i = i + 1) {
    const previous = STOPS[i - 1];
    const next = STOPS[i];
    if (t <= next[0]) {
      const local = (t - previous[0]) / (next[0] - previous[0]);
      return [
        Math.round(previous[1][0] + (next[1][0] - previous[1][0]) * local),
        Math.round(previous[1][1] + (next[1][1] - previous[1][1]) * local),
        Math.round(previous[1][2] + (next[1][2] - previous[1][2]) * local)
      ];
    }
  }
  return STOPS[STOPS.length - 1][1];
}

export function rampCss(ratio) {
  const color = rampColor(ratio);
  return 'rgb(' + color[0] + ',' + color[1] + ',' + color[2] + ')';
}

// Escala suave (raíz) para que los valores bajos sigan viéndose
export function intensityRatio(value, maximum) {
  if (maximum <= 0 || value <= 0) {
    return 0;
  }
  return Math.sqrt(Math.min(value / maximum, 1));
}

export const RAMP_GRADIENT_CSS =
  'linear-gradient(90deg, rgb(31,61,43), rgb(79,127,99) 25%, rgb(191,216,196) 55%, rgb(246,196,106) 80%, rgb(224,122,47))';
