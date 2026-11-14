// =====================================================================
// Dueño: P2 (Controlador)
// Ejecutar desde server/:  node --test test/municipios.test.js
// =====================================================================

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  prepareMunicipalities,
  findMunicipality,
  buildMunicipalMonthly,
  getMunicipalMonthly,
  MunicipiosServiceError
} from '../src/services/municipios.service.js';

const squareA = [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]];
const squareB = [[[1, 0], [2, 0], [2, 1], [1, 1], [1, 0]]];
const featureCollection = {
  type: 'FeatureCollection',
  features: [
    { type: 'Feature', properties: { id: 'A', nombre: 'Municipio A' }, geometry: { type: 'Polygon', coordinates: squareA } },
    { type: 'Feature', properties: { id: 'B', nombre: 'Municipio B' }, geometry: { type: 'Polygon', coordinates: squareB } }
  ]
};

test('encuentra el municipio de un punto', function () {
  const prepared = prepareMunicipalities(featureCollection);
  assert.equal(findMunicipality(0.5, 0.5, prepared).id, 'A');
  assert.equal(findMunicipality(1.5, 0.5, prepared).id, 'B');
  assert.equal(findMunicipality(5, 5, prepared), null);
});

test('serie mensual por municipio con meses completos', function () {
  const prepared = prepareMunicipalities(featureCollection);
  const records = [
    [0.5, 0.5, '2020-01', 2],
    [0.5, 0.5, '2020-03', 3],
    [1.5, 0.5, '2020-03', 10],
    [5, 5, '2020-02', 7]
  ];
  const result = buildMunicipalMonthly(records, prepared, null, null);
  assert.deepEqual(result.months, ['2020-01', '2020-02', '2020-03']);
  assert.equal(result.municipios[0].id, 'B');
  assert.deepEqual(result.municipios[1].serie, [2, 0, 3]);
  assert.equal(result.fueraDeMunicipios, undefined);
  assert.equal(result.outsideTotal, 7);
});

test('con la muestra: 48 municipios y series del mismo largo que months', async function () {
  const result = await getMunicipalMonthly('2015-01', '2020-12');
  assert.equal(result.municipios.length, 48);
  assert.equal(result.months.length, 72);
  for (const municipality of result.municipios) {
    assert.equal(municipality.serie.length, 72);
  }
  assert.ok(result.municipios[0].total >= result.municipios[1].total);
});

test('formato de mes inválido', async function () {
  await assert.rejects(getMunicipalMonthly('2020-1'), MunicipiosServiceError);
});
