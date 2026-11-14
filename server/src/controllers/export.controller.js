// Controlador: POST /api/export -> CSV de focos individuales (dueño: P2)
import { getPoints } from '../models/fireData.model.js';
import { parseQuery } from '../services/aoi.service.js';
import { toCsv } from '../services/csv.service.js';
import { env } from '../config/env.js';

export function exportCsv(req, res, next) {
  try {
    const q = parseQuery(req.body);
    const { header, rows, truncated } = getPoints({ ...q, limit: env.exportMaxRows, filter: q.polygon ? q.contains : null });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="focos_${q.start}_${q.end}.csv"`);
    res.setHeader('Access-Control-Expose-Headers', 'X-Truncated, Content-Disposition');
    if (truncated) res.setHeader('X-Truncated', 'true');
    res.send(toCsv(header, rows));
  } catch (e) { next(e); }
}
