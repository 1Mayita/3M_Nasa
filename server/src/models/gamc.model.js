// =====================================================================
// Dueño: P1 (Modelo)
// Acceso a datos de la API WMS de la Alcaldía de Cochabamba (GAMC).
// Aquí se habla con el servidor de la Alcaldía; nadie más del proyecto lo hace.
//
// Analogía: este archivo es "la persona que va a la ventanilla de la Alcaldía".
// Lleva la credencial (API key), pide un mapa o la info de un punto, y vuelve.
// =====================================================================

import { GAMC_CONFIG } from '../config/gamc.js';

const EARTH_HALF_CIRCUMFERENCE_METERS = 20037508.34;

// Tamaño del cuadrito (en metros) que se dibuja alrededor de un punto para preguntar
// "¿qué hay aquí?". 50 m hacia cada lado es suficiente para caer dentro del polígono.
const FEATURE_INFO_HALF_SIZE_METERS = 50;
const FEATURE_INFO_IMAGE_SIZE_PIXELS = 101;
const FEATURE_INFO_CENTER_PIXEL = 50;

// ---------------------------------------------------------------------
// Utilidades de coordenadas
// ---------------------------------------------------------------------

export function convertLonLatToWebMercator(longitude, latitude) {
  const x = (longitude * EARTH_HALF_CIRCUMFERENCE_METERS) / 180;
  const tangentTerm = Math.tan(((90 + latitude) * Math.PI) / 360);
  const yInDegrees = Math.log(tangentTerm) / (Math.PI / 180);
  const y = (yInDegrees * EARTH_HALF_CIRCUMFERENCE_METERS) / 180;
  return { x: x, y: y };
}

export function isInsideBbox(longitude, latitude, bbox) {
  const minimumLongitude = bbox[0];
  const minimumLatitude = bbox[1];
  const maximumLongitude = bbox[2];
  const maximumLatitude = bbox[3];
  const isInsideLongitude = longitude >= minimumLongitude && longitude <= maximumLongitude;
  const isInsideLatitude = latitude >= minimumLatitude && latitude <= maximumLatitude;
  return isInsideLongitude && isInsideLatitude;
}

export function isInsideGamcCoverage(longitude, latitude) {
  return isInsideBbox(longitude, latitude, GAMC_CONFIG.coverageBbox);
}

export function getLayerConfig(layerName) {
  const layer = GAMC_CONFIG.layers[layerName];
  if (layer === undefined) {
    return null;
  }
  return layer;
}

export function listLayerConfigs() {
  const layerNames = Object.keys(GAMC_CONFIG.layers);
  const layers = [];
  for (const layerName of layerNames) {
    const layer = GAMC_CONFIG.layers[layerName];
    layers.push({
      name: layer.name,
      label: layer.label,
      representation: layer.representation,
      bbox: layer.bbox,
      attributes: layer.attributes
    });
  }
  return layers;
}

// ---------------------------------------------------------------------
// Construcción de URLs y llamadas HTTP
// ---------------------------------------------------------------------

export function buildGamcUrl(serviceId, wmsParameters) {
  const searchParameters = new URLSearchParams();
  searchParameters.set('key', GAMC_CONFIG.apiKey);
  searchParameters.set('service_id', serviceId);
  const parameterNames = Object.keys(wmsParameters);
  for (const parameterName of parameterNames) {
    searchParameters.set(parameterName, String(wmsParameters[parameterName]));
  }
  return GAMC_CONFIG.wmsUrl + '?' + searchParameters.toString();
}

async function fetchWithTimeout(url) {
  const abortController = new AbortController();
  const timeoutId = setTimeout(function abortRequest() {
    abortController.abort();
  }, GAMC_CONFIG.requestTimeoutMs);
  try {
    const response = await fetch(url, { signal: abortController.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

function waitMilliseconds(milliseconds) {
  return new Promise(function resolveLater(resolve) {
    setTimeout(resolve, milliseconds);
  });
}

// ---------------------------------------------------------------------
// Fila de espera para GetFeatureInfo (una consulta a la vez, con pausa)
// ---------------------------------------------------------------------

let featureInfoQueueTail = Promise.resolve();
let lastFeatureInfoRequestTime = 0;

function runInFeatureInfoQueue(task) {
  const previousTail = featureInfoQueueTail;
  let releaseQueue;
  featureInfoQueueTail = new Promise(function createRelease(resolve) {
    releaseQueue = resolve;
  });

  const runTask = async function runTask() {
    await previousTail;
    try {
      const elapsedMilliseconds = Date.now() - lastFeatureInfoRequestTime;
      if (elapsedMilliseconds < GAMC_CONFIG.featureInfoDelayMs) {
        await waitMilliseconds(GAMC_CONFIG.featureInfoDelayMs - elapsedMilliseconds);
      }
      lastFeatureInfoRequestTime = Date.now();
      const result = await task();
      return result;
    } finally {
      releaseQueue();
    }
  };

  return runTask();
}

// ---------------------------------------------------------------------
// Cachés en memoria
// ---------------------------------------------------------------------

const tileCache = new Map();
const featureInfoCache = new Map();
const legendJsonCache = new Map();

function saveTileInCache(cacheKey, tile) {
  if (tileCache.size >= GAMC_CONFIG.tileCacheMaxEntries) {
    const oldestKey = tileCache.keys().next().value;
    tileCache.delete(oldestKey);
  }
  tileCache.set(cacheKey, tile);
}

// ---------------------------------------------------------------------
// GetMap: una tesela (imagen PNG) de una capa
// ---------------------------------------------------------------------

/**
 * @param {string} layerName  'distritos' | 'cota2750' | 'periurbanos'
 * @param {{bbox: string, width: number, height: number, srs: string}} tileRequest  ya validado por el servicio
 * @returns {Promise<{contentType: string, body: Buffer}>}
 */
export async function getMapTile(layerName, tileRequest) {
  const layer = getLayerConfig(layerName);
  if (layer === null) {
    throw new Error('Capa GAMC desconocida: ' + layerName);
  }

  const wmsParameters = {
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetMap',
    LAYERS: '',
    FORMAT: 'image/png',
    TRANSPARENT: 'true',
    SRS: tileRequest.srs,
    BBOX: tileRequest.bbox,
    WIDTH: tileRequest.width,
    HEIGHT: tileRequest.height
  };

  const cacheKey = layerName + '|' + tileRequest.srs + '|' + tileRequest.bbox + '|' + tileRequest.width + 'x' + tileRequest.height;
  if (tileCache.has(cacheKey)) {
    return tileCache.get(cacheKey);
  }

  const url = buildGamcUrl(layer.serviceId, wmsParameters);
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error('La API GAMC respondió ' + response.status + ' en GetMap (' + layerName + ')');
  }
  const contentType = response.headers.get('content-type') || 'image/png';
  const arrayBuffer = await response.arrayBuffer();
  const tile = { contentType: contentType, body: Buffer.from(arrayBuffer) };

  // Solo guardamos imágenes (si la API devolvió un error en XML no lo guardamos).
  if (contentType.startsWith('image/')) {
    saveTileInCache(cacheKey, tile);
  }
  return tile;
}

// ---------------------------------------------------------------------
// GetLegendGraphic: la leyenda (PNG o JSON)
// ---------------------------------------------------------------------

export async function getLegendPng(layerName) {
  const layer = getLayerConfig(layerName);
  if (layer === null) {
    throw new Error('Capa GAMC desconocida: ' + layerName);
  }
  const url = buildGamcUrl(layer.serviceId, {
    REQUEST: 'GetLegendGraphic',
    VERSION: '1.0.0',
    FORMAT: 'image/png'
  });
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error('La API GAMC respondió ' + response.status + ' en GetLegendGraphic (' + layerName + ')');
  }
  const contentType = response.headers.get('content-type') || 'image/png';
  const arrayBuffer = await response.arrayBuffer();
  return { contentType: contentType, body: Buffer.from(arrayBuffer) };
}

/**
 * Devuelve las clases de la leyenda simplificadas:
 * [{ label: 'Periurbanos en crecimiento', fill: '#70FF24', stroke: '#8f8f8f' }, ...]
 */
export async function getLegendClasses(layerName) {
  if (legendJsonCache.has(layerName)) {
    return legendJsonCache.get(layerName);
  }
  const layer = getLayerConfig(layerName);
  if (layer === null) {
    throw new Error('Capa GAMC desconocida: ' + layerName);
  }
  const url = buildGamcUrl(layer.serviceId, {
    REQUEST: 'GetLegendGraphic',
    VERSION: '1.0.0',
    FORMAT: 'application/json'
  });
  const response = await fetchWithTimeout(url);
  if (!response.ok) {
    throw new Error('La API GAMC respondió ' + response.status + ' en la leyenda JSON (' + layerName + ')');
  }
  const legendDocument = await response.json();
  const classes = simplifyLegendDocument(legendDocument);
  legendJsonCache.set(layerName, classes);
  return classes;
}

export function simplifyLegendDocument(legendDocument) {
  const classes = [];
  const seenLabels = new Set();
  if (!legendDocument || !Array.isArray(legendDocument.Legend)) {
    return classes;
  }
  for (const legendLayer of legendDocument.Legend) {
    const rules = Array.isArray(legendLayer.rules) ? legendLayer.rules : [];
    for (const rule of rules) {
      const label = rule.title || rule.name || '';
      if (label === '' || label === 'otros' || seenLabels.has(label)) {
        continue;
      }
      let fill = null;
      let stroke = null;
      const symbolizers = Array.isArray(rule.symbolizers) ? rule.symbolizers : [];
      for (const symbolizer of symbolizers) {
        if (symbolizer.Polygon) {
          fill = symbolizer.Polygon.fill || fill;
          stroke = symbolizer.Polygon.stroke || stroke;
        }
        if (symbolizer.Line && stroke === null) {
          stroke = symbolizer.Line.stroke || stroke;
        }
      }
      seenLabels.add(label);
      classes.push({ label: label, fill: fill, stroke: stroke });
    }
  }
  return classes;
}

// ---------------------------------------------------------------------
// GetFeatureInfo: "¿qué hay en este punto?"
// ---------------------------------------------------------------------

function buildFeatureInfoCacheKey(layerName, longitude, latitude) {
  // 4 decimales ≈ 11 metros: dos clics casi en el mismo lugar usan la misma respuesta.
  return layerName + '|' + longitude.toFixed(4) + '|' + latitude.toFixed(4);
}

/**
 * Devuelve las propiedades del elemento de la capa que está en el punto, o null si no hay nada.
 */
export async function getFeatureInfoAtPoint(layerName, longitude, latitude) {
  const layer = getLayerConfig(layerName);
  if (layer === null) {
    throw new Error('Capa GAMC desconocida: ' + layerName);
  }
  if (!isInsideBbox(longitude, latitude, layer.bbox)) {
    return null;
  }

  const cacheKey = buildFeatureInfoCacheKey(layerName, longitude, latitude);
  if (featureInfoCache.has(cacheKey)) {
    return featureInfoCache.get(cacheKey);
  }

  const center = convertLonLatToWebMercator(longitude, latitude);
  const bbox = [
    center.x - FEATURE_INFO_HALF_SIZE_METERS,
    center.y - FEATURE_INFO_HALF_SIZE_METERS,
    center.x + FEATURE_INFO_HALF_SIZE_METERS,
    center.y + FEATURE_INFO_HALF_SIZE_METERS
  ].join(',');

  const url = buildGamcUrl(layer.serviceId, {
    SERVICE: 'WMS',
    VERSION: '1.1.1',
    REQUEST: 'GetFeatureInfo',
    LAYERS: '',
    QUERY_LAYERS: '',
    SRS: 'EPSG:3857',
    BBOX: bbox,
    WIDTH: FEATURE_INFO_IMAGE_SIZE_PIXELS,
    HEIGHT: FEATURE_INFO_IMAGE_SIZE_PIXELS,
    X: FEATURE_INFO_CENTER_PIXEL,
    Y: FEATURE_INFO_CENTER_PIXEL,
    INFO_FORMAT: 'application/json',
    FEATURE_COUNT: 1
  });

  const properties = await runInFeatureInfoQueue(async function askGamc() {
    const response = await fetchWithTimeout(url);
    if (!response.ok) {
      throw new Error('La API GAMC respondió ' + response.status + ' en GetFeatureInfo (' + layerName + ')');
    }
    const featureCollection = await response.json();
    const features = Array.isArray(featureCollection.features) ? featureCollection.features : [];
    if (features.length === 0) {
      return null;
    }
    return features[0].properties || null;
  });

  featureInfoCache.set(cacheKey, properties);
  return properties;
}

/**
 * Consulta las 3 capas en un punto y devuelve todo junto.
 */
export async function getAllGamcInfoAtPoint(longitude, latitude) {
  const districtProperties = await getFeatureInfoAtPoint('distritos', longitude, latitude);
  const cotaProperties = await getFeatureInfoAtPoint('cota2750', longitude, latitude);
  const periurbanProperties = await getFeatureInfoAtPoint('periurbanos', longitude, latitude);
  return {
    distritos: districtProperties,
    cota2750: cotaProperties,
    periurbanos: periurbanProperties
  };
}
