// =====================================================================
// Dueño: P2 (Controlador)
// =====================================================================

import { getHotspots3d, getZonesNow } from '../services/focos3d.service.js';

function sendError(response, error) {
  const httpStatus = error.httpStatus || 500;
  if (httpStatus >= 500) {
    console.error('[focos3d]', error.message);
  }
  response.status(httpStatus).json({ error: error.message });
}

// GET /api/focos3d?zona=tunari-sur&desde=2015-01&hasta=2020-12
export async function getHotspotsFor3d(request, response) {
  try {
    const result = await getHotspots3d(request.query.zona, request.query.desde, request.query.hasta);
    response.set('Cache-Control', 'public, max-age=300');
    response.json(result);
  } catch (error) {
    sendError(response, error);
  }
}

// GET /api/zonas/ahora?mes=2026-09
export async function getZonesRightNow(request, response) {
  try {
    const result = await getZonesNow(request.query.mes);
    response.json(result);
  } catch (error) {
    sendError(response, error);
  }
}
