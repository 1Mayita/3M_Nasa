// =====================================================================
// Dueño: P3 (Vista) — datos FALSOS con la misma forma que /api/focos3d y /api/zonas/ahora
// =====================================================================

const MOCK_ZONE_BBOXES = {
  depto: [-67.6, -18.6, -64.2, -15.6],
  'tunari-sur': [-66.42, -17.40, -66.00, -17.22],
  'cercado-gamc': [-66.280703, -17.53119, -66.06952, -17.257306],
  tropico: [-65.95, -17.25, -64.40, -16.55]
};

const SEASON_WEIGHTS = [0.1, 0.05, 0.05, 0.2, 0.5, 1.2, 2.4, 3.2, 3.0, 2.0, 0.7, 0.2];

function createSeededRandom(seed) {
  let state = seed;
  return function nextRandom() {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state / 2147483648;
  };
}

export function buildMockHotspots3d(zoneId) {
  const selectedZoneId = MOCK_ZONE_BBOXES[zoneId] ? zoneId : 'tunari-sur';
  const bbox = MOCK_ZONE_BBOXES[selectedZoneId];
  const random = createSeededRandom(42);
  const cells = [];
  for (let index = 0; index < 60; index = index + 1) {
    const longitude = bbox[0] + random() * (bbox[2] - bbox[0]);
    const latitude = bbox[1] + random() * (bbox[3] - bbox[1]);
    cells.push({ id: index, longitude: longitude, latitude: latitude, total: 0, strength: 0.3 + random() });
  }

  const months = [];
  const frames = {};
  const monthlyTotals = {};
  let maxCellMonthly = 0;
  for (let year = 2012; year <= 2025; year = year + 1) {
    for (let month = 1; month <= 12; month = month + 1) {
      const monthText = String(year) + '-' + String(month).padStart(2, '0');
      months.push(monthText);
      const yearBoost = year === 2016 || year === 2020 ? 2 : 1;
      const frame = [];
      let monthTotal = 0;
      for (const cell of cells) {
        const count = Math.round(cell.strength * SEASON_WEIGHTS[month - 1] * yearBoost * random() * 3);
        if (count > 0) {
          frame.push([cell.id, count]);
          cell.total = cell.total + count;
          monthTotal = monthTotal + count;
          maxCellMonthly = Math.max(maxCellMonthly, count);
        }
      }
      if (frame.length > 0) {
        frames[monthText] = frame;
        monthlyTotals[monthText] = monthTotal;
      }
    }
  }

  let maxCellTotal = 0;
  const cleanCells = cells.map(function removeStrength(cell) {
    maxCellTotal = Math.max(maxCellTotal, cell.total);
    return { id: cell.id, longitude: cell.longitude, latitude: cell.latitude, total: cell.total };
  });

  return {
    zone: { id: selectedZoneId, nombre: 'Zona de prueba (MOCK)', bbox: bbox, municipios: ['Cochabamba'], fuels: [{ id: 'pajonal', nombre: 'Pajonal', inflamabilidad: 'Alta', color: '#E3B505' }] },
    unit: 'detecciones (equivalente VIIRS S-NPP)',
    cellSizeDeg: 0.02,
    harmonized: true,
    isSample: true,
    note: 'MOCK',
    cells: cleanCells,
    months: months,
    frames: frames,
    monthlyTotals: monthlyTotals,
    maxCellTotal: maxCellTotal,
    maxCellMonthly: maxCellMonthly
  };
}

export const mockZonesNow = {
  month: '2026-09',
  unit: 'detecciones (equivalente VIIRS S-NPP)',
  isSample: true,
  note: 'MOCK',
  zones: [
    { id: 'tropico', nombre: 'Trópico de Cochabamba', tipo: 'zona_critica', month: '2026-09', current: 320, median: 250, anomalyPercent: 28, yearsInMedian: 25 },
    { id: 'tunari-sur', nombre: 'Ladera sur del Parque Tunari', tipo: 'zona_critica', month: '2026-09', current: 48, median: 30, anomalyPercent: 60, yearsInMedian: 25 },
    { id: 'sudeste', nombre: 'Sudeste: Pocona, Totora, Vacas, Pojo', tipo: 'zona_critica', month: '2026-09', current: 22, median: 35, anomalyPercent: -37, yearsInMedian: 25 }
  ]
};
