// =====================================================================
// Dueño: P3 (Vista)
// Llamadas al API del equipo (NUNCA directo a la Alcaldía: la key vive en el servidor).
// Con VITE_USE_MOCKS=true devuelve datos falsos para trabajar sin servidor.
// =====================================================================

import {
  mockLayersCatalog,
  mockZones,
  mockPointInfo,
  mockDistrictSummary
} from '../mocks/gamc.mock.js';

export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';

async function getJson(path) {
  const response = await fetch(API_BASE_URL + path);
  if (!response.ok) {
    let message = 'Error ' + response.status;
    try {
      const body = await response.json();
      message = body.error || message;
    } catch (error) {
      // la respuesta no era JSON
    }
    throw new Error(message);
  }
  return response.json();
}

export function getGamcTileUrl(layerName) {
  return API_BASE_URL + '/api/gamc/wms/' + layerName;
}

export function getGamcLegendImageUrl(layerName) {
  return API_BASE_URL + '/api/gamc/legend/' + layerName;
}

export async function fetchGamcLayers() {
  if (USE_MOCKS) {
    return mockLayersCatalog;
  }
  return getJson('/api/gamc/layers');
}

export async function fetchGamcLegendClasses(layerName) {
  if (USE_MOCKS) {
    return { layer: layerName, classes: [] };
  }
  return getJson('/api/gamc/legend/' + layerName + '/json');
}

export async function fetchPointInfo(latitude, longitude) {
  if (USE_MOCKS) {
    return mockPointInfo(latitude, longitude);
  }
  const query = new URLSearchParams({ lat: String(latitude), lon: String(longitude) });
  return getJson('/api/gamc/info?' + query.toString());
}

export async function fetchDistrictSummary(fromDate, toDate) {
  if (USE_MOCKS) {
    return mockDistrictSummary;
  }
  const query = new URLSearchParams();
  if (fromDate) {
    query.set('from', fromDate);
  }
  if (toDate) {
    query.set('to', toDate);
  }
  return getJson('/api/gamc/districts/summary?' + query.toString());
}

export async function fetchZones() {
  if (USE_MOCKS) {
    return mockZones;
  }
  return getJson('/api/zones');
}
