// =====================================================================
// Dueño: P1 (Modelo)
// Lectura de archivos de datos locales: zonas críticas, perfiles de combustible,
// etiquetas GAMC de cada detección y factores k de armonización.
// =====================================================================

import { readFile, access } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

// server/src/models/ -> ../../../ = raíz del repo
const DATA_FOLDER_URL = new URL('../../../data/', import.meta.url);

function getDataFilePath(relativePath) {
  return fileURLToPath(new URL(relativePath, DATA_FOLDER_URL));
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

async function readJsonFile(relativePath) {
  const filePath = getDataFilePath(relativePath);
  const text = await readFile(filePath, 'utf8');
  return JSON.parse(text);
}

/**
 * Lee el primer archivo que exista de la lista (primero datos reales, después la muestra).
 */
async function readFirstExistingJson(relativePaths) {
  for (const relativePath of relativePaths) {
    const filePath = getDataFilePath(relativePath);
    const exists = await fileExists(filePath);
    if (exists) {
      const content = await readJsonFile(relativePath);
      return { content: content, source: relativePath };
    }
  }
  return { content: null, source: null };
}

let zonesCache = null;
let fuelProfilesCache = null;

export async function readZones() {
  if (zonesCache === null) {
    zonesCache = await readJsonFile('zones/cochabamba_zones.geojson');
  }
  return zonesCache;
}

export async function readFuelProfiles() {
  if (fuelProfilesCache === null) {
    fuelProfilesCache = await readJsonFile('vegetation/fuel_profiles.json');
  }
  return fuelProfilesCache;
}

/**
 * Detecciones dentro de Cercado etiquetadas con la API GAMC (las genera model/gamc_tag.py).
 * Si no existe el archivo real, usa la muestra sintética.
 */
export async function readGamcTags() {
  const result = await readFirstExistingJson([
    'processed/gamc_tags.json',
    'sample/gamc_tags.sample.json'
  ]);
  if (result.content === null) {
    return { detections: [], source: null };
  }
  return { detections: result.content.detections || [], source: result.source, metadata: result.content.metadata || {} };
}

/**
 * Factores k(mes) de la armonización. Los exporta el pipeline de P1.
 * Si no existen, se devuelve null y el servicio avisa que la serie NO está armonizada.
 */
export async function readHarmonizationFactors() {
  const result = await readFirstExistingJson([
    'processed/k_factors.json',
    'sample/k_factors.sample.json'
  ]);
  if (result.content === null) {
    return null;
  }
  return { factors: result.content, source: result.source };
}
