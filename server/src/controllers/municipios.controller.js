// =====================================================================
// Dueño: P2 (Controlador)
// =====================================================================

import { getMunicipalMonthly } from '../services/municipios.service.js';

// GET /api/municipios/mensual?desde=2012-01&hasta=2025-12
export async function getMunicipalMonthlySeries(request, response) {
  try {
    const result = await getMunicipalMonthly(request.query.desde, request.query.hasta);
    response.set('Cache-Control', 'public, max-age=300');
    response.json(result);
  } catch (error) {
    const httpStatus = error.httpStatus || 500;
    if (httpStatus >= 500) {
      console.error('[municipios]', error.message);
    }
    response.status(httpStatus).json({ error: error.message });
  }
}
