// =====================================================================
// Dueño: P3 (Vista) — llamadas a los endpoints de P2 (ver docs/API_FOCOS3D.md)
// Con VITE_USE_MOCKS=true usa datos falsos para diseñar sin servidor.
// =====================================================================

import { buildMockHotspots3d, mockZonesNow } from './focos3d.mock.js';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
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

export async function fetchHotspots3d(zoneId, fromMonth, toMonth) {
  if (USE_MOCKS) {
    return buildMockHotspots3d(zoneId);
  }
  const query = new URLSearchParams({ zona: zoneId || 'depto' });
  if (fromMonth) {
    query.set('desde', fromMonth);
  }
  if (toMonth) {
    query.set('hasta', toMonth);
  }
  return getJson('/api/focos3d?' + query.toString());
}

export async function fetchZonesNow(month) {
  if (USE_MOCKS) {
    return mockZonesNow;
  }
  const query = new URLSearchParams();
  if (month) {
    query.set('mes', month);
  }
  return getJson('/api/zonas/ahora?' + query.toString());
}

export async function fetchPointInfo(latitude, longitude) {
  if (USE_MOCKS) {
    return { insideGamcCoverage: true, distrito: 'D13', comuna: 'TUNARI', insideCota2750Layer: true, periurbano: 'Periurbanos en crecimiento', fuelProfile: { nombre: 'Pajonal / herbazal de altura' } };
  }
  const query = new URLSearchParams({ lat: String(latitude), lon: String(longitude) });
  return getJson('/api/gamc/info?' + query.toString());
}
