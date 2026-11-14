// =====================================================================
// Dueño: P2 (Controlador)
// Ejecutar:  node --test test/gamc.test.js   (desde la carpeta server/)
// No llama a la API real: prueba la lógica propia.
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  sanitizeTileQuery,
  getHarmonizedWeight,
  buildDistrictSummary,
  mapPeriurbanToFuelClass,
  parseCoordinates,
  GamcServiceError
} from '../src/services/gamc.service.js';
import {
  convertLonLatToWebMercator,
  isInsideGamcCoverage,
  buildGamcUrl,
  simplifyLegendDocument
} from '../src/models/gamc.model.js';
import { getZonesWithFuel } from '../src/services/zones.service.js';

test('acepta parámetros en minúscula como los manda Leaflet', function () {
  const result = sanitizeTileQuery({ bbox: '-7364284,-1966770,-7363284,-1965770', width: '256', height: '256', srs: 'EPSG:3857', styles: 'hack' });
  assert.equal(result.width, 256);
  assert.equal(result.srs, 'EPSG:3857');
  assert.equal(result.bbox.split(',').length, 4);
  assert.equal(result.styles, undefined);
});

test('rechaza BBOX y SRS inválidos', function () {
  assert.throws(function () { sanitizeTileQuery({ BBOX: '1,2,3' }); }, GamcServiceError);
  assert.throws(function () { sanitizeTileQuery({ BBOX: '1,2,3,4', SRS: 'EPSG:9999' }); }, GamcServiceError);
  assert.throws(function () { sanitizeTileQuery({ BBOX: '1,2,3,4', WIDTH: '99999' }); }, GamcServiceError);
});

test('convierte coordenadas a Web Mercator', function () {
  const point = convertLonLatToWebMercator(-66.157, -17.39);
  const expectedX = (-66.157 * 20037508.34) / 180;
  assert.ok(Math.abs(point.x - expectedX) < 1);
  assert.ok(point.y < -1960000 && point.y > -1970000);
});

test('cobertura de la Alcaldía', function () {
  assert.equal(isInsideGamcCoverage(-66.157, -17.39), true);
  assert.equal(isInsideGamcCoverage(-65.42, -16.97), false);
});

test('la URL lleva key y service_id', function () {
  const url = buildGamcUrl('abc', { REQUEST: 'GetMap', LAYERS: '' });
  assert.ok(url.includes('service_id=abc'));
  assert.ok(url.includes('key='));
  assert.ok(url.includes('LAYERS='));
});

test('regla de armonización: nunca suma sensores del mismo período', function () {
  const factors = { k_modis: { '8': 2 }, k_noaa20: { '8': 1.1 }, snpp_end: '2024-12-31' };
  assert.equal(getHarmonizedWeight({ source: 'MODIS', date: '2010-08-10' }, factors), 2);
  assert.equal(getHarmonizedWeight({ source: 'VIIRS_SNPP', date: '2010-08-10' }, factors), 0);
  assert.equal(getHarmonizedWeight({ source: 'MODIS', date: '2016-08-10' }, factors), 0);
  assert.equal(getHarmonizedWeight({ source: 'VIIRS_SNPP', date: '2016-08-10' }, factors), 1);
  assert.equal(getHarmonizedWeight({ source: 'VIIRS_SNPP', date: '2025-08-10' }, factors), 0);
  assert.equal(getHarmonizedWeight({ source: 'VIIRS_NOAA20', date: '2025-08-10' }, factors), 1.1);
});

test('resumen por distrito ordena de mayor a menor', function () {
  const detections = [
    { source: 'VIIRS_SNPP', date: '2016-08-01', distrito: 'D1', comuna: 'TUNARI', insideCota2750Layer: true },
    { source: 'VIIRS_SNPP', date: '2016-09-01', distrito: 'D13', comuna: 'TUNARI', insideCota2750Layer: true },
    { source: 'VIIRS_SNPP', date: '2016-09-02', distrito: 'D13', comuna: 'TUNARI', insideCota2750Layer: false },
    { source: 'MODIS', date: '2016-09-02', distrito: 'D13', comuna: 'TUNARI' }
  ];
  const districts = buildDistrictSummary(detections, null, null, null);
  assert.equal(districts[0].distrito, 'D13');
  assert.equal(districts[0].total, 2);
  assert.equal(districts[0].insideCota2750Layer, 1);
  assert.equal(districts[0].byMonth['9'], 2);
});

test('traduce Detalle de periurbanos a combustible', function () {
  const fuelProfiles = {
    gamcDetailRules: [{ contains: 'arbustal', fuelClass: 'matorral' }, { contains: 'herbazal', fuelClass: 'pajonal' }],
    gamcDefaultFuelClass: 'interfaz_urbana'
  };
  assert.equal(mapPeriurbanToFuelClass({ Detalle: 'Arbustales ralos con herbazales e intervención urbana' }, fuelProfiles), 'matorral');
  assert.equal(mapPeriurbanToFuelClass({ Detalle: 'Herbazales ralos con intervención urbana' }, fuelProfiles), 'pajonal');
  assert.equal(mapPeriurbanToFuelClass({ Detalle: 'Periurbano' }, fuelProfiles), 'interfaz_urbana');
  assert.equal(mapPeriurbanToFuelClass(null, fuelProfiles), null);
});

test('coordenadas inválidas', function () {
  assert.throws(function () { parseCoordinates('abc', '-66'); }, GamcServiceError);
});

test('simplifica la leyenda JSON de GeoServer', function () {
  const legend = { Legend: [{ rules: [
    { title: 'Periurbanos en crecimiento', symbolizers: [{ Polygon: { fill: '#70FF24', stroke: '#8f8f8f' } }] },
    { name: 'otros', symbolizers: [] }
  ] }] };
  const classes = simplifyLegendDocument(legend);
  assert.equal(classes.length, 1);
  assert.equal(classes[0].fill, '#70FF24');
});

test('las zonas cargan con sus combustibles', async function () {
  const zones = await getZonesWithFuel();
  assert.ok(zones.features.length >= 5);
  const tunari = zones.features.find(function (feature) { return feature.properties.id === 'tunari-sur'; });
  const fuelIds = tunari.properties.fuels.map(function (fuel) { return fuel.id; });
  assert.ok(fuelIds.includes('eucalipto'));
  assert.ok(fuelIds.includes('kewina'));
});
