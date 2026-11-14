// =====================================================================
// Dueño: P1 (Modelo) — escrito por P2 con acuerdo del equipo.
// Lee los límites de los 48 municipios (47 + TIOC Raqaypampa) de Cochabamba.
// Fuente: Lab TecnoSocial 2024 (CC BY 4.0, compilación no oficial).
// Es una copia de client/public/data/municipios_cochabamba.geojson (la de P3),
// para que el servidor no dependa de la carpeta client/.
// =====================================================================

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const MUNICIPALITIES_FILE_URL = new URL('../../../data/reference/municipios_cochabamba.geojson', import.meta.url);

let cachedMunicipalities = null;

export async function readMunicipalities() {
  if (cachedMunicipalities === null) {
    const filePath = fileURLToPath(MUNICIPALITIES_FILE_URL);
    const text = await readFile(filePath, 'utf8');
    cachedMunicipalities = JSON.parse(text);
  }
  return cachedMunicipalities;
}
