// Lógica del calendario de actividad de fuego y anomalías (dueño: P2 - Controlador)
// Entrada: celdas-día del modelo. Salida: el formato de docs/API.md (POST /api/calendar).

const r1 = (v) => Math.round(v * 10) / 10;

function median(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function monthsBetween(start, end) {
  const out = [];
  let y = +start.slice(0, 4), m = +start.slice(5, 7);
  const y1 = +end.slice(0, 4), m1 = +end.slice(5, 7);
  while (y < y1 || (y === y1 && m <= m1)) {
    out.push([y, m]);
    if (++m > 12) { m = 1; y++; }
  }
  return out;
}

function daysBetween(start, end) {
  const out = [];
  for (let d = new Date(start + 'T00:00:00Z'); d <= new Date(end + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * @param {{date,harm_n,source}[]} cells  celdas-día ya filtradas por área y fechas
 * @param {{start:string, end:string, dailyMaxDays:number}} opts
 */
export function buildCalendar(cells, { start, end, dailyMaxDays = 731 }) {
  const byDay = new Map();
  const byMonth = new Map();      // "YYYY-M" -> {count, src:{source:sum}}
  for (const c of cells) {
    byDay.set(c.date, (byDay.get(c.date) || 0) + c.harm_n);
    const key = `${+c.date.slice(0, 4)}-${+c.date.slice(5, 7)}`;
    const e = byMonth.get(key) || { count: 0, src: {} };
    e.count += c.harm_n;
    e.src[c.source] = (e.src[c.source] || 0) + c.harm_n;
    byMonth.set(key, e);
  }

  const months = monthsBetween(start, end).map(([year, month]) => {
    const e = byMonth.get(`${year}-${month}`);
    const source = e ? Object.entries(e.src).sort((a, b) => b[1] - a[1])[0][0] : null;
    return { year, month, count: e ? e.count : 0, source };
  });

  // mediana del mismo mes en los DEMÁS años del rango
  const monthly = months.map((row) => {
    const others = months.filter((o) => o.month === row.month && o.year !== row.year).map((o) => o.count);
    const med = median(others);
    const anomaly = row.count - med;
    return {
      year: row.year, month: row.month, count: r1(row.count), median: r1(med), anomaly: r1(anomaly),
      anomaly_pct: med > 0 ? r1((100 * anomaly) / med) : null, source: row.source,
    };
  });

  const yearMap = new Map();
  for (const m of monthly) yearMap.set(m.year, (yearMap.get(m.year) || 0) + m.count);
  const yearly = [...yearMap].map(([year, count]) => ({ year, count: r1(count) }));

  const nDays = (new Date(end) - new Date(start)) / 86400000 + 1;
  const daily = nDays <= dailyMaxDays ? daysBetween(start, end).map((date) => ({ date, count: r1(byDay.get(date) || 0) })) : undefined;

  // estadísticas resumen
  const total = r1(monthly.reduce((s, m) => s + m.count, 0));
  const peakYear = yearly.reduce((a, b) => (b.count > (a?.count ?? -1) ? b : a), null);
  const medByMonth = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1, median: r1(median(monthly.filter((m) => m.month === i + 1).map((m) => m.count))),
  }));
  const peakMonth = medByMonth.reduce((a, b) => (b.median > a.median ? b : a));
  const last = monthly[monthly.length - 1];

  return {
    monthly,
    yearly,
    ...(daily ? { daily } : {}),
    stats: {
      total,
      peak_year: peakYear,
      peak_month_of_year: peakMonth,
      current: last ? { year: last.year, month: last.month, count: last.count, median: last.median, anomaly_pct: last.anomaly_pct } : null,
    },
  };
}
