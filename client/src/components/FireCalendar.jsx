// Calendario "en llamas": filas = años, columnas = meses. Dueño: P3
import { FLAME, DIVERGING, ANOMALY_BREAKS, flameColor, anomalyColor } from '../colors.js';

export const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const fmt = (v) => (v === null || v === undefined ? '–' : Math.round(v).toLocaleString('es-BO'));

export default function FireCalendar({ monthly, mode }) {
  const max = Math.max(...monthly.map((m) => m.count), 0);
  const years = [...new Set(monthly.map((m) => m.year))].sort((a, b) => b - a);
  const get = (y, m) => monthly.find((r) => r.year === y && r.month === m);

  return (
    <div className="calendar-wrap">
      <table className="calendar" aria-label="Calendario de actividad de fuego por año y mes">
        <thead>
          <tr><th scope="col">Año</th>{MONTHS.map((m) => <th key={m} scope="col">{m}</th>)}</tr>
        </thead>
        <tbody>
          {years.map((y) => (
            <tr key={y}>
              <th scope="row">{y}</th>
              {MONTHS.map((_, i) => {
                const r = get(y, i + 1);
                if (!r) return <td key={i} className="out" />;
                const bg = mode === 'anomaly' ? anomalyColor(r.anomaly_pct) : flameColor(r.count, max);
                const label = `${MONTHS[i]} ${y}: ${fmt(r.count)} focos (mediana ${fmt(r.median)}${r.anomaly_pct != null ? `, ${r.anomaly_pct > 0 ? '+' : ''}${Math.round(r.anomaly_pct)}%` : ''})`;
                return <td key={i} style={{ background: bg }} title={label} aria-label={label} />;
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <Legend mode={mode} max={max} />
    </div>
  );
}

function Legend({ mode, max }) {
  if (mode === 'anomaly') {
    const labels = ['< -75%', '-75…-40', '-40…-10', '±10%', '+10…40', '+40…100', '> +100%'];
    return (
      <div className="legend" aria-hidden="true">
        {DIVERGING.map((c, i) => <span key={c}><i style={{ background: c }} />{labels[i]}</span>)}
        <small>vs mediana del mismo mes en los demás años ({ANOMALY_BREAKS.length + 1} clases)</small>
      </div>
    );
  }
  return (
    <div className="legend" aria-hidden="true">
      <span>0</span>
      {FLAME.map((c) => <i key={c} style={{ background: c }} />)}
      <span>{fmt(max)} focos/mes (escala log)</span>
    </div>
  );
}
