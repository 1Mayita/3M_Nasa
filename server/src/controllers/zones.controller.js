// =====================================================================
// Dueño: P2 (Controlador)
// =====================================================================

import { getZonesWithFuel, getZoneById, getFuelCatalog } from '../services/zones.service.js';

function sendError(response, error) {
  const httpStatus = error.httpStatus || 500;
  if (httpStatus >= 500) {
    console.error('[zones]', error.message);
  }
  response.status(httpStatus).json({ error: error.message });
}

export async function listZones(request, response) {
  try {
    const zones = await getZonesWithFuel();
    response.json(zones);
  } catch (error) {
    sendError(response, error);
  }
}

export async function getZone(request, response) {
  try {
    const zone = await getZoneById(request.params.id);
    response.json(zone);
  } catch (error) {
    sendError(response, error);
  }
}

export async function listFuels(request, response) {
  try {
    const fuels = await getFuelCatalog();
    response.json(fuels);
  } catch (error) {
    sendError(response, error);
  }
}
