// Controlador: salud, metadatos y regiones (dueño: P2)
import { getDataSource, getMetadata, getRegions } from '../models/fireData.model.js';

export const health = (req, res) => res.json({ ok: true, data: getDataSource() });

export const meta = (req, res) => res.json(getMetadata());

export async function regions(req, res, next) {
  try { res.json(await getRegions()); } catch (e) { next(e); }
}
