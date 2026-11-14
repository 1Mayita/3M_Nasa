// =====================================================================
// Dueño: P2 (Controlador)
// Recibe las peticiones HTTP, llama al servicio y responde.
// =====================================================================

import {
  getLayersCatalog,
  getTile,
  getLegendImage,
  getLegend,
  getPointInfo,
  getDistrictSummary
} from '../services/gamc.service.js';

function sendError(response, error) {
  const httpStatus = error.httpStatus || 502;
  if (httpStatus >= 500) {
    console.error('[gamc]', error.message);
  }
  response.status(httpStatus).json({ error: error.message });
}

export function listLayers(request, response) {
  const catalog = getLayersCatalog();
  response.json(catalog);
}

export async function getLayerTile(request, response) {
  try {
    const tile = await getTile(request.params.layer, request.query);
    response.set('Content-Type', tile.contentType);
    response.set('Cache-Control', 'public, max-age=86400');
    response.send(tile.body);
  } catch (error) {
    sendError(response, error);
  }
}

export async function getLayerLegendImage(request, response) {
  try {
    const legend = await getLegendImage(request.params.layer);
    response.set('Content-Type', legend.contentType);
    response.set('Cache-Control', 'public, max-age=86400');
    response.send(legend.body);
  } catch (error) {
    sendError(response, error);
  }
}

export async function getLayerLegendClasses(request, response) {
  try {
    const legend = await getLegend(request.params.layer);
    response.json(legend);
  } catch (error) {
    sendError(response, error);
  }
}

export async function getInfoAtPoint(request, response) {
  try {
    const info = await getPointInfo(request.query.lat, request.query.lon);
    response.json(info);
  } catch (error) {
    sendError(response, error);
  }
}

export async function getDistrictsSummary(request, response) {
  try {
    const summary = await getDistrictSummary(request.query.from, request.query.to);
    response.json(summary);
  } catch (error) {
    sendError(response, error);
  }
}
