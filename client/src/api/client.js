// Acceso al API del Controlador (docs/API.md). Con VITE_USE_MOCKS=true usa src/mocks.
import mockRegions from '../mocks/regions.json';
import mockMeta from '../mocks/meta.json';
import mockCalendar from '../mocks/calendar.json';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true';
const BASE = (import.meta.env.VITE_API_URL || '') + '/api';
const wait = (v) => new Promise((r) => setTimeout(() => r(v), 300));

async function request(path, body) {
  const res = await fetch(BASE + path, body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }
    : undefined);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res;
}

export const usingMocks = USE_MOCKS;

export async function getRegions() {
  if (USE_MOCKS) return wait(mockRegions);
  return (await request('/regions')).json();
}

export async function getMeta() {
  if (USE_MOCKS) return wait(mockMeta);
  return (await request('/meta')).json();
}

/** body = { bbox | polygon, start, end } */
export async function getCalendar(body) {
  if (USE_MOCKS) return wait(mockCalendar);
  return (await request('/calendar', body)).json();
}

/** Descarga el CSV de focos. Devuelve { truncated } */
export async function downloadCsv(body) {
  if (USE_MOCKS) {
    alert('Modo mock: la descarga CSV necesita el API (VITE_USE_MOCKS=false).');
    return { truncated: false };
  }
  const res = await request('/export', body);
  const blob = await res.blob();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `focos_${body.start}_${body.end}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
  return { truncated: res.headers.get('X-Truncated') === 'true' };
}
