// Tarjetas de resumen. Dueño: P3
import { MONTHS } from './FireCalendar.jsx';

const fmt = (v) => Math.round(v ?? 0).toLocaleString('es-BO');

export default function StatsCards({ stats, dataUntil }) {
  const cur = stats.current;
  const pct = cur?.anomaly_pct;
  const tone = pct == null ? '' : pct > 10 ? 'hot' : pct < -10 ? 'cool' : '';
  return (
    <div className="cards">
      <div className="card"><small>Total de focos (armonizado)</small><b>{fmt(stats.total)}</b></div>
      <div className="card"><small>Año con más actividad</small><b>{stats.peak_year?.year ?? '–'}</b><span>{fmt(stats.peak_year?.count)} focos</span></div>
      <div className="card"><small>Mes crítico típico</small><b>{stats.peak_month_of_year ? MONTHS[stats.peak_month_of_year.month - 1] : '–'}</b><span>mediana {fmt(stats.peak_month_of_year?.median)}</span></div>
      {cur && (
        <div className={`card ${tone}`}>
          <small>{MONTHS[cur.month - 1]} {cur.year} vs mediana histórica</small>
          <b>{pct == null ? 's/d' : `${pct > 0 ? '+' : ''}${Math.round(pct)}%`}</b>
          <span>{fmt(cur.count)} vs {fmt(cur.median)} focos{dataUntil ? ` · datos hasta ${dataUntil}` : ''}</span>
        </div>
      )}
    </div>
  );
}
