// =====================================================================
// Dueño: P1 (Modelo) — escrito por P2 con acuerdo del equipo.
// Lee los focos mensuales por celda que exporta model/export_focos_mensuales.py.
// Si no existe el archivo real, usa la muestra sintética.
// =====================================================================

import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// server/src/models/ -> ../../../ = raíz del repo
const DATA_FOLDER_URL = new URL('../../../data/', import.meta.url);

const CANDIDATE_FILES = [
  'processed/focos_mensuales.json',
  'sample/focos_mensuales.sample.json'
];

let cachedDataset = null;

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Devuelve { records, metadata, source }.
 * records = [[longitud, latitud, 'YYYY-MM', cantidad], ...] ordenados por mes.
 */
export async function readMonthlyHotspots() {
  if (cachedDataset !== null) {
    return cachedDataset;
  }
  for (const relativePath of CANDIDATE_FILES) {
    const filePath = fileURLToPath(new URL(relativePath, DATA_FOLDER_URL));
    const exists = await fileExists(filePath);
    if (exists) {
      const text = await readFile(filePath, 'utf8');
      const document = JSON.parse(text);
      cachedDataset = {
        records: Array.isArray(document.records) ? document.records : [],
        metadata: document.metadata || {},
        source: relativePath
      };
      return cachedDataset;
    }
  }
  cachedDataset = { records: [], metadata: {}, source: null };
  return cachedDataset;
}

/**
 * Para pruebas: olvida lo que hay en memoria y vuelve a leer el archivo.
 */
export function clearMonthlyHotspotsCache() {
  cachedDataset = null;
}
