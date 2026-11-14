// =====================================================================
// Dueño: P2 (Controlador)
// Ejecutar desde server/:  node --test test/focos3d.test.js
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildHotspots3d,
  buildZonesNow,
  calculateMedian,
  listMonthsBetween,
  getHotspots3d,
  getZonesNow,
  Focos3dServiceError
} from '../src/services/focos3d.service.js';

const records = [
  [-66.15, -17.31, '2019-08', 4],
  [-66.15, -17.31, '2020-08', 10],
  [-66.13, -17.33, '2020-08', 2],
  [-65.40, -16.90, '2020-08', 50],
  [-66.15, -17.31, '2021-08', 1]
];
const tunariBbox = [-66.42, -17.40, -66.00, -17.22];

test('lista de meses entre dos fechas', function () {
  assert.deepEqual(listMonthsBetween('2019-11', '2020-02'), ['2019-11', '2019-12', '2020-01', '2020-02']);
});

test('agrupa celdas y cuadros solo dentro de la zona', function () {
  const result = buildHotspots3d(records, tunariBbox, null, null);
  assert.equal(result.cells.length, 2);
  assert.equal(result.cells[0].total, 15);
  assert.equal(result.monthlyTotals['2020-08'], 12);
  assert.equal(result.frames['2020-08'].length, 2);
  assert.equal(result.months[0], '2019-08');
  assert.equal(result.months[result.months.length - 1], '2021-08');
  assert.equal(result.maxCellMonthly, 10);
});

test('respeta el rango de meses', function () {
  const result = buildHotspots3d(records, tunariBbox, '2020-01', '2020-12');
  assert.equal(result.cells[0].total, 10);
  assert.equal(result.months.length, 12);
});

test('mediana', function () {
  assert.equal(calculateMedian([3, 1, 2]), 2);
  assert.equal(calculateMedian([4, 1, 2, 3]), 2.5);
  assert.equal(calculateMedian([]), null);
});

test('zonas ahora: anomalía contra la mediana del mismo mes', function () {
  const zones = [{ properties: { id: 'tunari-sur', nombre: 'Tunari', tipo: 'zona_critica', bbox: tunariBbox } }];
  const result = buildZonesNow(records, zones, '2021-08');
  assert.equal(result[0].current, 1);
  assert.equal(result[0].median, 8);
  assert.equal(result[0].anomalyPercent, -87);
});

test('con la muestra: endpoint 3D del Tunari', async function () {
  const result = await getHotspots3d('tunari-sur', '2015-01', '2020-12');
  assert.ok(result.cells.length > 0);
  assert.equal(result.months.length, 72);
  assert.equal(result.zone.id, 'tunari-sur');
  assert.ok(result.zone.fuels.length > 0);
});

test('con la muestra: zonas ahora', async function () {
  const result = await getZonesNow();
  assert.ok(result.zones.length >= 5);
  assert.ok(result.zones[0].current >= result.zones[1].current);
});

test('errores claros', async function () {
  await assert.rejects(getHotspots3d('no-existe'), Focos3dServiceError);
  await assert.rejects(getHotspots3d('depto', '2020-1'), Focos3dServiceError);
});
