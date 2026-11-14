// Pruebas rápidas: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendar } from '../src/services/calendar.service.js';
import { parseQuery, pointInPolygon } from '../src/services/aoi.service.js';

test('calendario: meses vacíos en 0, mediana de los otros años y anomalía', () => {
  const cells = [
    { date: '2020-08-10', harm_n: 10, source: 'viirs' },
    { date: '2021-08-10', harm_n: 20, source: 'viirs' },
    { date: '2022-08-10', harm_n: 60, source: 'viirs' },
  ];
  const cal = buildCalendar(cells, { start: '2020-01-01', end: '2022-12-31' });
  assert.equal(cal.monthly.length, 36);
  const aug22 = cal.monthly.find((m) => m.year === 2022 && m.month === 8);
  assert.equal(aug22.median, 15);       // mediana de 10 y 20
  assert.equal(aug22.anomaly, 45);
  assert.equal(aug22.anomaly_pct, 300);
  assert.equal(cal.monthly.find((m) => m.year === 2020 && m.month === 1).anomaly_pct, null);
  assert.equal(cal.stats.peak_year.year, 2022);
  assert.equal(cal.daily, undefined);   // rango > 2 años
});

test('AOI: polígono y validaciones', () => {
  const sq = [[0, 0], [2, 0], [2, 2], [0, 2]];
  assert.ok(pointInPolygon(1, 1, sq));
  assert.ok(!pointInPolygon(3, 1, sq));
  const q = parseQuery({ polygon: sq, start: '2020-01-01', end: '2020-02-01' });
  assert.deepEqual(q.bbox, [0, 0, 2, 2]);
  assert.throws(() => parseQuery({ bbox: [1, 1, 0, 0], start: '2020-01-01', end: '2020-02-01' }));
  assert.throws(() => parseQuery({ bbox: [0, 0, 1, 1], start: '2020-02-01', end: '2020-01-01' }));
});
