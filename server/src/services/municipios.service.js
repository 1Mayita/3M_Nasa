// =====================================================================
// Dueño: P2 (Controlador)
// GET /api/municipios/mensual: detecciones armonizadas por municipio y por mes.
// Así la Vista no tiene que hacer "punto en polígono" en el navegador.
//
// Analogía: cada celda (~2 km) es una cajita con focos. Miramos en qué
// municipio cae el centro de la cajita y sumamos sus focos a ese municipio.
// =====================================================================

import { readMonthlyHotspots } from '../models/focos3d.model.js';
import { readMunicipalities } from '../models/municipios.model.js';
import { listMonthsBetween } from './focos3d.service.js';
import { pointInPolygon } from './aoi.service.js';

// Año de 4 dígitos y mes de 01 a 12 (rechaza, por ejemplo, 2020-13)
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class MunicipiosServiceError extends Error {
  constructor(message, httpStatus) {
    super(message);
    this.httpStatus = httpStatus;
  }
}

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

function validateMonth(monthText, parameterName) {
  if (monthText === undefined || monthText === null || monthText === '') {
    return null;
  }
  if (!MONTH_PATTERN.test(monthText)) {
    throw new MunicipiosServiceError(parameterName + ' debe tener formato YYYY-MM', 400);
  }
  return monthText;
}

function computeRingBbox(ring) {
  let minimumLongitude = Infinity;
  let minimumLatitude = Infinity;
  let maximumLongitude = -Infinity;
  let maximumLatitude = -Infinity;
  for (const point of ring) {
    minimumLongitude = Math.min(minimumLongitude, point[0]);
    minimumLatitude = Math.min(minimumLatitude, point[1]);
    maximumLongitude = Math.max(maximumLongitude, point[0]);
    maximumLatitude = Math.max(maximumLatitude, point[1]);
  }
  return [minimumLongitude, minimumLatitude, maximumLongitude, maximumLatitude];
}

/**
 * Prepara cada municipio con sus anillos (Polygon o MultiPolygon) y su bbox para filtrar rápido.
 */
export function prepareMunicipalities(featureCollection) {
  const prepared = [];
  for (const feature of featureCollection.features) {
    const geometry = feature.geometry;
    let polygons = [];
    if (geometry.type === 'Polygon') {
      polygons = [geometry.coordinates];
    } else if (geometry.type === 'MultiPolygon') {
      polygons = geometry.coordinates;
    }
    const outerRings = [];
    const holeRings = [];
    for (const polygon of polygons) {
      outerRings.push(polygon[0]);
      for (let ringIndex = 1; ringIndex < polygon.length; ringIndex = ringIndex + 1) {
        holeRings.push(polygon[ringIndex]);
      }
    }
    const ringBboxes = outerRings.map(computeRingBbox);
    prepared.push({
      id: feature.properties.id,
      nombre: feature.properties.nombre,
      provincia: feature.properties.provincia || null,
      outerRings: outerRings,
      holeRings: holeRings,
      ringBboxes: ringBboxes
    });
  }
  return prepared;
}

function isInsideBbox(longitude, latitude, bbox) {
  return longitude >= bbox[0] && longitude <= bbox[2] && latitude >= bbox[1] && latitude <= bbox[3];
}

/**
 * Devuelve el municipio que contiene el punto, o null si cae fuera de todos.
 */
export function findMunicipality(longitude, latitude, preparedMunicipalities) {
  for (const municipality of preparedMunicipalities) {
    for (let ringIndex = 0; ringIndex < municipality.outerRings.length; ringIndex = ringIndex + 1) {
      if (!isInsideBbox(longitude, latitude, municipality.ringBboxes[ringIndex])) {
        continue;
      }
      if (!pointInPolygon(longitude, latitude, municipality.outerRings[ringIndex])) {
        continue;
      }
      let isInsideHole = false;
      for (const holeRing of municipality.holeRings) {
        if (pointInPolygon(longitude, latitude, holeRing)) {
          isInsideHole = true;
          break;
        }
      }
      if (!isInsideHole) {
        return municipality;
      }
    }
  }
  return null;
}

/**
 * Arma la serie mensual de cada municipio.
 * records = [[longitud, latitud, 'YYYY-MM', cantidad], ...]
 */
export function buildMunicipalMonthly(records, preparedMunicipalities, fromMonth, toMonth) {
  const municipalityByCellKey = new Map();
  const totalsByMunicipality = new Map();
  let firstMonth = null;
  let lastMonth = null;
  let countOutside = 0;

  for (const record of records) {
    const monthText = record[2];
    if (fromMonth !== null && monthText < fromMonth) {
      continue;
    }
    if (toMonth !== null && monthText > toMonth) {
      continue;
    }
    if (firstMonth === null || monthText < firstMonth) {
      firstMonth = monthText;
    }
    if (lastMonth === null || monthText > lastMonth) {
      lastMonth = monthText;
    }

    const cellKey = record[0] + '|' + record[1];
    if (!municipalityByCellKey.has(cellKey)) {
      municipalityByCellKey.set(cellKey, findMunicipality(record[0], record[1], preparedMunicipalities));
    }
    const municipality = municipalityByCellKey.get(cellKey);
    if (municipality === null) {
      countOutside = countOutside + record[3];
      continue;
    }
    if (!totalsByMunicipality.has(municipality.id)) {
      totalsByMunicipality.set(municipality.id, new Map());
    }
    const monthlyTotals = totalsByMunicipality.get(municipality.id);
    monthlyTotals.set(monthText, (monthlyTotals.get(monthText) || 0) + record[3]);
  }

  const startMonth = fromMonth !== null ? fromMonth : firstMonth;
  const endMonth = toMonth !== null ? toMonth : lastMonth;
  const months = startMonth !== null && endMonth !== null ? listMonthsBetween(startMonth, endMonth) : [];

  const municipalities = [];
  for (const municipality of preparedMunicipalities) {
    const monthlyTotals = totalsByMunicipality.get(municipality.id) || new Map();
    const series = [];
    let total = 0;
    for (const monthText of months) {
      const value = roundToOneDecimal(monthlyTotals.get(monthText) || 0);
      series.push(value);
      total = total + value;
    }
    municipalities.push({
      id: municipality.id,
      nombre: municipality.nombre,
      provincia: municipality.provincia,
      total: roundToOneDecimal(total),
      serie: series
    });
  }
  municipalities.sort(function byTotalDescending(first, second) {
    return second.total - first.total;
  });

  return { months: months, municipios: municipalities, outsideTotal: roundToOneDecimal(countOutside) };
}

let cachedPreparedMunicipalities = null;

export async function getMunicipalMonthly(rawFromMonth, rawToMonth) {
  const fromMonth = validateMonth(rawFromMonth, 'desde');
  const toMonth = validateMonth(rawToMonth, 'hasta');
  if (cachedPreparedMunicipalities === null) {
    const featureCollection = await readMunicipalities();
    cachedPreparedMunicipalities = prepareMunicipalities(featureCollection);
  }
  const dataset = await readMonthlyHotspots();
  const result = buildMunicipalMonthly(dataset.records, cachedPreparedMunicipalities, fromMonth, toMonth);

  return {
    unit: dataset.metadata.unidad || 'detecciones (equivalente VIIRS S-NPP)',
    harmonized: dataset.metadata.armonizado === true,
    isSample: dataset.metadata.sintetico === true,
    dataSource: dataset.source,
    note: 'Cada celda de ~2 km se asigna al municipio donde cae su centro. Una detección es un píxel caliente, no un incendio. Análisis histórico, no predicción.',
    fuenteLimites: 'Lab TecnoSocial 2024 (CC BY 4.0, compilación no oficial)',
    months: result.months,
    municipios: result.municipios,
    fueraDeMunicipios: result.outsideTotal
  };
}
