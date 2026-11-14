// Controlador: POST /api/calendar (dueño: P2)
import { getDailyCells, getMetadata } from '../models/fireData.model.js';
import { parseQuery } from '../services/aoi.service.js';
import { buildCalendar } from '../services/calendar.service.js';
import { env } from '../config/env.js';

export function calendar(req, res, next) {
  try {
    const q = parseQuery(req.body);
    const meta = getMetadata();
    // no analizar meses posteriores al último dato disponible (evita un "-100%" falso en el mes en curso)
    if (meta.date_max && q.end > meta.date_max) q.end = meta.date_max;
    if (q.start > q.end) q.start = q.end;
    const cells = getDailyCells(q).filter((c) => q.contains(c.lon, c.lat));
    const cal = buildCalendar(cells, { start: q.start, end: q.end, dailyMaxDays: env.dailyMaxDays });
    res.json({
      query: { bbox: q.bbox, polygon: q.polygon, start: q.start, end: q.end, data_until: meta.date_max, cells: new Set(cells.map((c) => `${c.lat},${c.lon}`)).size },
      ...cal,
      harmonization: {
        method: meta.method, unit: meta.unit, viirs_start: meta.viirs_start, snpp_end: meta.snpp_end,
        coefficients_by_month: meta.coefficients_by_month, validation: meta.validation, is_sample: meta.is_sample,
      },
    });
  } catch (e) { next(e); }
}
