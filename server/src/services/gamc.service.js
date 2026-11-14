// =====================================================================
// Dueño: P2 (Controlador)
// Lógica de negocio sobre la API GAMC:
//  - validar los pedidos de teselas que llegan desde el mapa (Leaflet)
//  - juntar la info de un punto con el perfil de combustible
//  - resumir detecciones por distrito respetando las reglas de armonización
// =====================================================================

import {
  getMapTile,
  getLegendPng,
  getLegendClasses,
  getAllGamcInfoAtPoint,
  getLayerConfig,
  listLayerConfigs,
  isInsideGamcCoverage
} from '../models/gamc.model.js';
import { readFuelProfiles, readGamcTags, readHarmonizationFactors } from '../models/zones.model.js';
import { GAMC_CONFIG, isGamcConfigured } from '../config/gamc.js';

const ALLOWED_SPATIAL_REFERENCE_SYSTEMS = ['EPSG:3857', 'EPSG:4326'];
const MAXIMUM_TILE_SIZE_PIXELS = 1024;
const SNPP_START_DATE = '2012-01-20';

export class GamcServiceError extends Error {
  constructor(message, httpStatus) {
    super(message);
    this.httpStatus = httpStatus;
  }
}

// ---------------------------------------------------------------------
// Capas y validación de pedidos
// ---------------------------------------------------------------------

export function getLayersCatalog() {
  return {
    configured: isGamcConfigured(),
    coverageBbox: GAMC_CONFIG.coverageBbox,
    layers: listLayerConfigs()
  };
}

function ensureLayerExists(layerName) {
  const layer = getLayerConfig(layerName);
  if (layer === null) {
    throw new GamcServiceError('Capa desconocida: ' + layerName + '. Usa distritos, cota2750 o periurbanos.', 404);
  }
  return layer;
}

function ensureGamcConfigured() {
  if (!isGamcConfigured()) {
    throw new GamcServiceError('Falta GAMC_API_KEY en server/.env', 503);
  }
}

/**
 * Leaflet manda los parámetros en minúscula (bbox, width, srs...) y otros clientes en mayúscula.
 * Aquí los leemos sin importar mayúsculas y solo dejamos pasar lo necesario (lista blanca).
 */
export function sanitizeTileQuery(rawQuery) {
  const normalizedQuery = {};
  const rawKeys = Object.keys(rawQuery || {});
  for (const rawKey of rawKeys) {
    normalizedQuery[rawKey.toUpperCase()] = rawQuery[rawKey];
  }

  const bboxText = String(normalizedQuery.BBOX || '');
  const bboxParts = bboxText.split(',');
  if (bboxParts.length !== 4) {
    throw new GamcServiceError('BBOX inválido: se esperan 4 números separados por coma', 400);
  }
  const bboxNumbers = [];
  for (const bboxPart of bboxParts) {
    const number = Number(bboxPart);
    if (!Number.isFinite(number)) {
      throw new GamcServiceError('BBOX inválido: ' + bboxText, 400);
    }
    bboxNumbers.push(number);
  }

  const width = Number.parseInt(normalizedQuery.WIDTH || '256', 10);
  const height = Number.parseInt(normalizedQuery.HEIGHT || '256', 10);
  const widthIsValid = Number.isInteger(width) && width > 0 && width <= MAXIMUM_TILE_SIZE_PIXELS;
  const heightIsValid = Number.isInteger(height) && height > 0 && height <= MAXIMUM_TILE_SIZE_PIXELS;
  if (!widthIsValid || !heightIsValid) {
    throw new GamcServiceError('WIDTH/HEIGHT inválidos (1 a 1024)', 400);
  }

  const spatialReference = String(normalizedQuery.SRS || normalizedQuery.CRS || 'EPSG:3857').toUpperCase();
  if (!ALLOWED_SPATIAL_REFERENCE_SYSTEMS.includes(spatialReference)) {
    throw new GamcServiceError('SRS no permitido: ' + spatialReference, 400);
  }

  return {
    bbox: bboxNumbers.join(','),
    width: width,
    height: height,
    srs: spatialReference
  };
}

export async function getTile(layerName, rawQuery) {
  ensureLayerExists(layerName);
  ensureGamcConfigured();
  const tileRequest = sanitizeTileQuery(rawQuery);
  const tile = await getMapTile(layerName, tileRequest);
  return tile;
}

export async function getLegendImage(layerName) {
  ensureLayerExists(layerName);
  ensureGamcConfigured();
  return getLegendPng(layerName);
}

export async function getLegend(layerName) {
  ensureLayerExists(layerName);
  ensureGamcConfigured();
  const classes = await getLegendClasses(layerName);
  return { layer: layerName, classes: classes };
}

// ---------------------------------------------------------------------
// Información de un punto + combustible
// ---------------------------------------------------------------------

export function parseCoordinates(rawLatitude, rawLongitude) {
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);
  const latitudeIsValid = Number.isFinite(latitude) && latitude >= -90 && latitude <= 90;
  const longitudeIsValid = Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
  if (!latitudeIsValid || !longitudeIsValid) {
    throw new GamcServiceError('lat y lon deben ser números válidos', 400);
  }
  return { latitude: latitude, longitude: longitude };
}

/**
 * Traduce lo que dice la capa Periurbanos a una clase de combustible del archivo fuel_profiles.json.
 */
export function mapPeriurbanToFuelClass(periurbanProperties, fuelProfiles) {
  if (periurbanProperties === null || periurbanProperties === undefined) {
    return null;
  }
  const detailText = String(periurbanProperties.Detalle || '').toLowerCase();
  const rules = Array.isArray(fuelProfiles.gamcDetailRules) ? fuelProfiles.gamcDetailRules : [];
  for (const rule of rules) {
    const keyword = String(rule.contains).toLowerCase();
    if (detailText.includes(keyword)) {
      return rule.fuelClass;
    }
  }
  return fuelProfiles.gamcDefaultFuelClass || null;
}

export async function getPointInfo(rawLatitude, rawLongitude) {
  const coordinates = parseCoordinates(rawLatitude, rawLongitude);
  const inside = isInsideGamcCoverage(coordinates.longitude, coordinates.latitude);
  if (!inside) {
    return {
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      insideGamcCoverage: false,
      message: 'Fuera de la cobertura de la API de la Alcaldía (solo municipio de Cercado).'
    };
  }

  ensureGamcConfigured();
  const gamcInfo = await getAllGamcInfoAtPoint(coordinates.longitude, coordinates.latitude);
  const fuelProfiles = await readFuelProfiles();
  const fuelClass = mapPeriurbanToFuelClass(gamcInfo.periurbanos, fuelProfiles);
  const fuelProfile = fuelClass !== null ? fuelProfiles.classes[fuelClass] || null : null;

  return {
    latitude: coordinates.latitude,
    longitude: coordinates.longitude,
    insideGamcCoverage: true,
    distrito: gamcInfo.distritos ? gamcInfo.distritos.Distrito || null : null,
    comuna: gamcInfo.distritos ? gamcInfo.distritos.Comuna || null : null,
    insideCota2750Layer: gamcInfo.cota2750 !== null,
    cota2750Distrito: gamcInfo.cota2750 ? gamcInfo.cota2750.Distrito || null : null,
    periurbano: gamcInfo.periurbanos ? gamcInfo.periurbanos.Periurbano || null : null,
    coberturaGamc: gamcInfo.periurbanos ? gamcInfo.periurbanos.Detalle || null : null,
    fuelClass: fuelClass,
    fuelProfile: fuelProfile,
    raw: gamcInfo
  };
}

// ---------------------------------------------------------------------
// Resumen por distrito (serie armonizada, equivalente VIIRS S-NPP)
// ---------------------------------------------------------------------

function getMonthNumber(dateText) {
  return Number.parseInt(String(dateText).slice(5, 7), 10);
}

function getYearNumber(dateText) {
  return Number.parseInt(String(dateText).slice(0, 4), 10);
}

/**
 * Decide si una detección cuenta en la serie armonizada y con qué peso.
 * Regla 2 y 3 del CLAUDE.md: nunca se suman sensores del mismo período.
 *  - antes de 2012-01-20: solo MODIS × k_modis(mes)
 *  - S-NPP activo: solo VIIRS S-NPP × 1
 *  - después del fin de S-NPP: solo NOAA-20 × k_noaa20(mes)
 * Devuelve 0 si la detección no corresponde al sensor de ese período.
 */
export function getHarmonizedWeight(detection, harmonizationFactors) {
  const dateText = String(detection.date);
  const month = getMonthNumber(dateText);
  const factors = harmonizationFactors || {};
  const snppEndDate = factors.snpp_end || null;
  const modisFactors = factors.k_modis || {};
  const noaa20Factors = factors.k_noaa20 || {};

  const isBeforeSnpp = dateText < SNPP_START_DATE;
  const isAfterSnpp = snppEndDate !== null && dateText > snppEndDate;
  const isSnppPeriod = !isBeforeSnpp && !isAfterSnpp;

  if (isBeforeSnpp) {
    if (detection.source !== 'MODIS') {
      return 0;
    }
    const factor = modisFactors[String(month)];
    return typeof factor === 'number' ? factor : 1;
  }
  if (isSnppPeriod) {
    if (detection.source !== 'VIIRS_SNPP') {
      return 0;
    }
    return 1;
  }
  if (isAfterSnpp) {
    if (detection.source !== 'VIIRS_NOAA20') {
      return 0;
    }
    const factor = noaa20Factors[String(month)];
    return typeof factor === 'number' ? factor : 1;
  }
  return 0;
}

function roundToOneDecimal(value) {
  return Math.round(value * 10) / 10;
}

export function buildDistrictSummary(detections, harmonizationFactors, fromDate, toDate) {
  const districtsByCode = new Map();

  for (const detection of detections) {
    const dateText = String(detection.date || '');
    if (dateText.length < 10) {
      continue;
    }
    if (fromDate && dateText < fromDate) {
      continue;
    }
    if (toDate && dateText > toDate) {
      continue;
    }
    if (!detection.distrito) {
      continue;
    }

    const weight = getHarmonizedWeight(detection, harmonizationFactors);
    if (weight === 0) {
      continue;
    }

    if (!districtsByCode.has(detection.distrito)) {
      const monthlyCounts = {};
      for (let monthNumber = 1; monthNumber <= 12; monthNumber = monthNumber + 1) {
        monthlyCounts[String(monthNumber)] = 0;
      }
      districtsByCode.set(detection.distrito, {
        distrito: detection.distrito,
        comuna: detection.comuna || null,
        total: 0,
        byYear: {},
        byMonth: monthlyCounts,
        insideCota2750Layer: 0,
        byPeriurbano: {}
      });
    }

    const district = districtsByCode.get(detection.distrito);
    const year = String(getYearNumber(dateText));
    const month = String(getMonthNumber(dateText));

    district.total = district.total + weight;
    district.byYear[year] = (district.byYear[year] || 0) + weight;
    district.byMonth[month] = district.byMonth[month] + weight;
    if (detection.insideCota2750Layer === true) {
      district.insideCota2750Layer = district.insideCota2750Layer + weight;
    }
    const periurbanLabel = detection.periurbano || 'Fuera de periurbanos';
    district.byPeriurbano[periurbanLabel] = (district.byPeriurbano[periurbanLabel] || 0) + weight;
  }

  const districts = Array.from(districtsByCode.values());
  for (const district of districts) {
    district.total = roundToOneDecimal(district.total);
    district.insideCota2750Layer = roundToOneDecimal(district.insideCota2750Layer);
    for (const key of Object.keys(district.byYear)) {
      district.byYear[key] = roundToOneDecimal(district.byYear[key]);
    }
    for (const key of Object.keys(district.byMonth)) {
      district.byMonth[key] = roundToOneDecimal(district.byMonth[key]);
    }
    for (const key of Object.keys(district.byPeriurbano)) {
      district.byPeriurbano[key] = roundToOneDecimal(district.byPeriurbano[key]);
    }
  }
  districts.sort(function sortByTotalDescending(first, second) {
    return second.total - first.total;
  });
  return districts;
}

export async function getDistrictSummary(fromDate, toDate) {
  const datePattern = /^\d{4}-\d{2}-\d{2}$/;
  if (fromDate && !datePattern.test(fromDate)) {
    throw new GamcServiceError('from debe tener formato YYYY-MM-DD', 400);
  }
  if (toDate && !datePattern.test(toDate)) {
    throw new GamcServiceError('to debe tener formato YYYY-MM-DD', 400);
  }

  const tags = await readGamcTags();
  const harmonization = await readHarmonizationFactors();
  const factors = harmonization !== null ? harmonization.factors : null;
  const districts = buildDistrictSummary(tags.detections, factors, fromDate, toDate);

  return {
    unit: 'detecciones (equivalente VIIRS S-NPP)',
    harmonized: harmonization !== null,
    harmonizationSource: harmonization !== null ? harmonization.source : null,
    dataSource: tags.source,
    isSample: tags.source !== null && tags.source.startsWith('sample/'),
    from: fromDate || null,
    to: toDate || null,
    note: 'Una detección es un píxel caliente, no un incendio. Análisis histórico, no predicción.',
    districts: districts
  };
}
