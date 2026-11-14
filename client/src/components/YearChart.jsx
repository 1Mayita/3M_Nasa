// Barras por año coloreadas por el sensor del que sale la serie armonizada. Dueño: P3
import { SOURCE_COLOR, SOURCE_LABEL } from '../colors.js';

export default function YearChart({ yearly, monthly }) {
  // sensor dominante por año (según los meses)
  const src = {};
  for (const m of monthly) if (m.source) src[m.year] = src[m.year] || {}, (src[m.year][m.source] = (src[m.year][m.source] || 0) + m.count);
  const dom = (y) => Object.entries(src[y] || {}).sort((a, b) => b[1] - a[1])[0]?.[0];

  const W = 760, H = 220, P = 34;
  const max = Math.max(...yearly.map((d) => d.count), 1);
  const bw = (W - P * 2) / yearly.length;
  const used = [...new Set(yearly.map((d) => dom(d.year)).filter(Boolean))];

  return (
    <figure className="yearchart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Focos armonizados por año">
        {yearly.map((d, i) => {
          const h = ((H - P * 2) * d.count) / max;
          return (
            <g key={d.year}>
              <rect x={P + i * bw + 1} y={H - P - h} width={bw - 2} height={h} fill={SOURCE_COLOR[dom(d.year)] || '#999'} rx="2">
                <title>{`${d.year}: ${Math.round(d.count).toLocaleString('es-BO')} focos (${SOURCE_LABEL[dom(d.year)] || ''})`}</title>
              </rect>
              {(i % 2 === 0 || yearly.length < 14) && (
                <text x={P + i * bw + bw / 2} y={H - P + 14} textAnchor="middle" fontSize="10">{String(d.year).slice(2)}</text>
              )}
            </g>
          );
        })}
        <line x1={P} x2={W - P} y1={H - P} y2={H - P} stroke="#999" />
        <text x={P} y={P - 10} fontSize="11">{Math.round(max).toLocaleString('es-BO')}</text>
      </svg>
      <figcaption className="legend">
        {used.map((s) => <span key={s}><i style={{ background: SOURCE_COLOR[s] }} />{SOURCE_LABEL[s]}</span>)}
      </figcaption>
    </figure>
  );
}
