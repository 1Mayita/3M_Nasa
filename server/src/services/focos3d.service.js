// =====================================================================
// Dueño: P2 (Controlador)
// Lógica de la Vista 3D:
//  - getHotspots3d: columnas (celdas) de una zona y su animación mes a mes
//  - getZonesNow: zonas con más focos en el mes actual vs la mediana histórica
// Los datos ya vienen armonizados (equivalente VIIRS S-NPP) desde el Modelo.
// =====================================================================

import { readMonthlyHotspots } from '../models/focos3d.model.js';
import { readZones, readFuelProfiles } from '../models/zones.model.js';
import { readMunicipalities } from '../models/municipios.model.js';
import { prepareMunicipalities, findMunicipality } from './municipios.service.js';

// Año de 4 dígitos y mes de 01 a 12 (rechaza, por ejemplo, 2020-13)
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class Focos3dServiceError extends Error {
  constructor(message, httpStatus) {
    super(message);
    this.httpStatus = httpStatus;
  }
}

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

function isInsideBbox(longitude, latitude, bbox) {
  const isInsideLongitude = longitude >= bbox[0] && longitude <= bbox[2];
  const isInsideLatitude = latitude >= bbox[1] && latitude <= bbox[3];
  return isInsideLongitude && isInsideLatitude;
}

function validateMonth(monthText, parameterName) {
  if (monthText === undefined || monthText === null || monthText === '') {
    return null;
  }
  if (!MONTH_PATTERN.test(monthText)) {
    throw new Focos3dServiceError(parameterName + ' debe tener formato YYYY-MM', 400);
  }
  return monthText;
}

/**
 * Rectángulo [lonMin, latMin, lonMax, latMax] calculado desde el polígono (Polygon o MultiPolygon).
 * Se usa si la zona no trae properties.bbox.
 */
export function computeBboxFromGeometry(geometry) {
  let polygons = [];
  if (geometry.type === 'Polygon') {
    polygons = [geometry.coordinates];
  } else if (geometry.type === 'MultiPolygon') {
    polygons = geometry.coordinates;
  }
  let minimumLongitude = Infinity;
  let minimumLatitude = Infinity;
  let maximumLongitude = -Infinity;
  let maximumLatitude = -Infinity;
  for (const polygon of polygons) {
    for (const point of polygon[0]) {
      minimumLongitude = Math.min(minimumLongitude, point[0]);
      minimumLatitude = Math.min(minimumLatitude, point[1]);
      maximumLongitude = Math.max(maximumLongitude, point[0]);
      maximumLatitude = Math.max(maximumLatitude, point[1]);
    }
  }
  return [minimumLongitude, minimumLatitude, maximumLongitude, maximumLatitude];
}

async function findZone(zoneId) {
  const zones = await readZones();
  const zone = zones.features.find(function matchesId(feature) {
    return feature.properties.id === zoneId;
  });
  if (zone === undefined) {
    throw new Focos3dServiceError('Zona no encontrada: ' + zoneId, 404);
  }
  if (!Array.isArray(zone.properties.bbox)) {
    zone.properties.bbox = computeBboxFromGeometry(zone.geometry);
  }
  return zone;
}

/**
 * Lista de meses 'YYYY-MM' desde fromMonth hasta toMonth (inclusive).
 */
export function listMonthsBetween(fromMonth, toMonth) {
  const months = [];
  let year = Number.parseInt(fromMonth.slice(0, 4), 10);
  let month = Number.parseInt(fromMonth.slice(5, 7), 10);
  const lastYear = Number.parseInt(toMonth.slice(0, 4), 10);
  const lastMonth = Number.parseInt(toMonth.slice(5, 7), 10);
  while (year < lastYear || (year === lastYear && month <= lastMonth)) {
    months.push(String(year) + '-' + String(month).padStart(2, '0'));
    month = month + 1;
    if (month > 12) {
      month = 1;
      year = year + 1;
    }
  }
  return months;
}

/**
 * Agrupa los registros de una zona en celdas (columnas) y cuadros mensuales (animación).
 *
 * Respuesta:
 * {
 *   cells: [{ id, longitude, latitude, total }],             // acumulado del rango
 *   months: ['2001-01', ...],                                // todos los meses del rango
 *   frames: { '2020-08': [[cellId, cantidad], ...], ... },   // solo meses con focos
 *   maxCellTotal, maxCellMonthly, monthlyTotals: { '2020-08': 123.4 }
 * }
 */
export function buildHotspots3d(records, bbox, fromMonth, toMonth) {
  const cellIdByKey = new Map();
  const cells = [];
  const frames = {};
  const monthlyTotals = {};
  let maxCellMonthly = 0;

  for (const record of records) {
    const longitude = record[0];
    const latitude = record[1];
    const monthText = record[2];
    const count = record[3];
    if (fromMonth !== null && monthText < fromMonth) {
      continue;
    }
    if (toMonth !== null && monthText > toMonth) {
      continue;
    }
    if (!isInsideBbox(longitude, latitude, bbox)) {
      continue;
    }

    const cellKey = longitude + '|' + latitude;
    if (!cellIdByKey.has(cellKey)) {
      cellIdByKey.set(cellKey, cells.length);
      cells.push({ id: cells.length, longitude: longitude, latitude: latitude, total: 0 });
    }
    const cellId = cellIdByKey.get(cellKey);
    cells[cellId].total = cells[cellId].total + count;

    if (frames[monthText] === undefined) {
      frames[monthText] = [];
    }
    frames[monthText].push([cellId, count]);
    monthlyTotals[monthText] = (monthlyTotals[monthText] || 0) + count;
    maxCellMonthly = Math.max(maxCellMonthly, count);
  }

  let maxCellTotal = 0;
  for (const cell of cells) {
    cell.total = roundToOneDecimal(cell.total);
    maxCellTotal = Math.max(maxCellTotal, cell.total);
  }
  for (const monthText of Object.keys(monthlyTotals)) {
    monthlyTotals[monthText] = roundToOneDecimal(monthlyTotals[monthText]);
  }

  const monthsWithData = Object.keys(frames).sort();
  let months = [];
  if (monthsWithData.length > 0) {
    const firstMonth = fromMonth !== null ? fromMonth : monthsWithData[0];
    const lastMonth = toMonth !== null ? toMonth : monthsWithData[monthsWithData.length - 1];
    months = listMonthsBetween(firstMonth, lastMonth);
  }

  return {
    cells: cells,
    months: months,
    frames: frames,
    monthlyTotals: monthlyTotals,
    maxCellTotal: maxCellTotal,
    maxCellMonthly: roundToOneDecimal(maxCellMonthly)
  };
}

// ---------------------------------------------------------------------
// Solo celdas dentro del departamento (zona "depto")
// ---------------------------------------------------------------------

// El recorte del Modelo es un RECTÁNGULO (lon -67.6 a -64.2, lat -18.6 a -15.6),
// y ese rectángulo también toma pedazos de La Paz, Beni, Santa Cruz y otros vecinos.
// Para la zona "depto" dejamos solo las celdas cuyo centro cae en alguno de los
// 48 municipios de Cochabamba (los mismos polígonos de /api/municipios/mensual).
// ---------------------------------------------------------------------
// Filtro por la GEOMETRÍA real de la zona (no solo por su rectángulo)
// ---------------------------------------------------------------------

// Así /api/focos3d y /api/zonas/ahora cuentan lo mismo que el calendario,
// que también usa el polígono de la zona. Sirve para Polygon y MultiPolygon.
const preparedZoneById = new Map();
const isCellInsideZoneByKey = new Map();

function getPreparedZone(zoneFeature) {
  const zoneId = zoneFeature.properties.id;
  if (!preparedZoneById.has(zoneId)) {
    const prepared = prepareMunicipalities({ type: 'FeatureCollection', features: [zoneFeature] });
    preparedZoneById.set(zoneId, prepared);
  }
  return preparedZoneById.get(zoneId);
}

export function isRecordInsideZoneGeometry(record, zoneFeature) {
  const cellKey = zoneFeature.properties.id + '|' + record[0] + '|' + record[1];
  if (!isCellInsideZoneByKey.has(cellKey)) {
    const preparedZone = getPreparedZone(zoneFeature);
    const isInside = findMunicipality(record[0], record[1], preparedZone) !== null;
    isCellInsideZoneByKey.set(cellKey, isInside);
  }
  return isCellInsideZoneByKey.get(cellKey);
}

export function filterRecordsInsideZoneGeometry(records, zoneFeature) {
  const recordsInside = [];
  for (const record of records) {
    if (isRecordInsideZoneGeometry(record, zoneFeature)) {
      recordsInside.push(record);
    }
  }
  return recordsInside;
}

let cachedPreparedMunicipalities = null;
const isCellInsideDepartmentByKey = new Map();

export async function filterRecordsInsideDepartment(records) {
  if (cachedPreparedMunicipalities === null) {
    const featureCollection = await readMunicipalities();
    cachedPreparedMunicipalities = prepareMunicipalities(featureCollection);
  }
  const recordsInside = [];
  for (const record of records) {
    const cellKey = record[0] + '|' + record[1];
    if (!isCellInsideDepartmentByKey.has(cellKey)) {
      const municipality = findMunicipality(record[0], record[1], cachedPreparedMunicipalities);
      isCellInsideDepartmentByKey.set(cellKey, municipality !== null);
    }
    if (isCellInsideDepartmentByKey.get(cellKey) === true) {
      recordsInside.push(record);
    }
  }
  return recordsInside;
}

export async function getHotspots3d(zoneId, rawFromMonth, rawToMonth) {
  const fromMonth = validateMonth(rawFromMonth, 'desde');
  const toMonth = validateMonth(rawToMonth, 'hasta');
  const zone = await findZone(zoneId || 'depto');
  const dataset = await readMonthlyHotspots();
  const fuelProfiles = await readFuelProfiles();

  const isDepartment = zone.properties.id === 'depto';
  let records = [];
  if (isDepartment) {
    records = await filterRecordsInsideDepartment(dataset.records);
  } else {
    records = filterRecordsInsideZoneGeometry(dataset.records, zone);
  }
  const result = buildHotspots3d(records, zone.properties.bbox, fromMonth, toMonth);

  const fuels = [];
  for (const fuelId of zone.properties.combustibles || []) {
    const fuelProfile = fuelProfiles.classes[fuelId];
    if (fuelProfile !== undefined) {
      fuels.push({ id: fuelId, nombre: fuelProfile.nombre, inflamabilidad: fuelProfile.inflamabilidad, color: fuelProfile.color });
    }
  }

  return {
    zone: {
      id: zone.properties.id,
      nombre: zone.properties.nombre,
      bbox: zone.properties.bbox,
      municipios: zone.properties.municipios,
      fuels: fuels
    },
    unit: dataset.metadata.unidad || 'detecciones (equivalente VIIRS S-NPP)',
    cellSizeDeg: dataset.metadata.cellSizeDeg || 0.02,
    harmonized: dataset.metadata.armonizado === true,
    isSample: dataset.metadata.sintetico === true,
    dataSource: dataset.source,
    note: 'Una detección es un píxel caliente, no un incendio. Análisis histórico, no predicción.',
    cells: result.cells,
    months: result.months,
    frames: result.frames,
    monthlyTotals: result.monthlyTotals,
    maxCellTotal: result.maxCellTotal,
    maxCellMonthly: result.maxCellMonthly
  };
}

// ---------------------------------------------------------------------
// Zonas "ahora": mes actual vs mediana del mismo mes en años anteriores
// ---------------------------------------------------------------------

export function calculateMedian(values) {
  if (values.length === 0) {
    return null;
  }
  const sortedValues = values.slice().sort(function ascending(first, second) {
    return first - second;
  });
  const middleIndex = Math.floor(sortedValues.length / 2);
  if (sortedValues.length % 2 === 0) {
    return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2;
  }
  return sortedValues[middleIndex];
}

/**
 * Para cada zona: focos del mes elegido, mediana del mismo mes en años anteriores y anomalía (%).
 */
/**
 * isInsideZone(record, feature) es opcional: por defecto usa el rectángulo (bbox) de la zona.
 * El servicio le pasa el filtro por geometría real.
 */
export function buildZonesNow(records, zoneFeatures, targetMonth, isInsideZone) {
  const checkInsideZone = typeof isInsideZone === 'function'
    ? isInsideZone
    : function isInsideZoneBbox(record, feature) {
      return isInsideBbox(record[0], record[1], feature.properties.bbox);
    };
  const targetYear = Number.parseInt(targetMonth.slice(0, 4), 10);
  const targetMonthNumber = targetMonth.slice(5, 7);
  let firstYearWithData = targetYear;
  for (const record of records) {
    const year = Number.parseInt(record[2].slice(0, 4), 10);
    if (year < firstYearWithData) {
      firstYearWithData = year;
    }
  }

  const results = [];
  for (const feature of zoneFeatures) {
    const totalsByYear = {};
    for (let year = firstYearWithData; year <= targetYear; year = year + 1) {
      totalsByYear[year] = 0;
    }
    for (const record of records) {
      const monthText = record[2];
      if (monthText.slice(5, 7) !== targetMonthNumber) {
        continue;
      }
      const year = Number.parseInt(monthText.slice(0, 4), 10);
      if (year > targetYear) {
        continue;
      }
      if (!checkInsideZone(record, feature)) {
        continue;
      }
      totalsByYear[year] = totalsByYear[year] + record[3];
    }

    const currentValue = totalsByYear[targetYear] || 0;
    const previousValues = [];
    for (let year = firstYearWithData; year < targetYear; year = year + 1) {
      previousValues.push(totalsByYear[year]);
    }
    const median = calculateMedian(previousValues);
    let anomalyPercent = null;
    if (median !== null && median > 0) {
      anomalyPercent = Math.round(((currentValue - median) / median) * 100);
    }

    results.push({
      id: feature.properties.id,
      nombre: feature.properties.nombre,
      tipo: feature.properties.tipo,
      month: targetMonth,
      current: roundToOneDecimal(currentValue),
      median: median === null ? null : roundToOneDecimal(median),
      anomalyPercent: anomalyPercent,
      yearsInMedian: previousValues.length
    });
  }

  results.sort(function byCurrentDescending(first, second) {
    return second.current - first.current;
  });
  return results;
}

export async function getZonesNow(rawMonth) {
  const requestedMonth = validateMonth(rawMonth, 'mes');
  const dataset = await readMonthlyHotspots();
  if (dataset.records.length === 0) {
    throw new Focos3dServiceError('No hay datos de focos mensuales', 503);
  }
  const lastMonthWithData = dataset.records[dataset.records.length - 1][2];
  const targetMonth = requestedMonth !== null ? requestedMonth : lastMonthWithData;

  const zones = await readZones();
  const criticalZones = zones.features.filter(function isNotDepartment(feature) {
    return feature.properties.tipo !== 'departamental';
  });
  for (const feature of criticalZones) {
    if (!Array.isArray(feature.properties.bbox)) {
      feature.properties.bbox = computeBboxFromGeometry(feature.geometry);
    }
  }

  return {
    month: targetMonth,
    unit: dataset.metadata.unidad || 'detecciones (equivalente VIIRS S-NPP)',
    isSample: dataset.metadata.sintetico === true,
    note: 'Comparación con la mediana del mismo mes en años anteriores. No es una predicción.',
    zones: buildZonesNow(dataset.records, criticalZones, targetMonth, isRecordInsideZoneGeometry)
  };
}
