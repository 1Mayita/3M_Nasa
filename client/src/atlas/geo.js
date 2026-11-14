// =====================================================================
// Dueño: P3 (Vista)
// Utilidades geográficas del atlas: índice de municipios, punto-en-polígono y
// agregación de las celdas de /api/focos3d por municipio.
// =====================================================================

function ringBounds(ring) {
  let minLon = Infinity;
  let minLat = Infinity;
  let maxLon = -Infinity;
  let maxLat = -Infinity;
  ring.forEach(function visit(point) {
    if (point[0] < minLon) minLon = point[0];
    if (point[0] > maxLon) maxLon = point[0];
    if (point[1] < minLat) minLat = point[1];
    if (point[1] > maxLat) maxLat = point[1];
  });
  return [minLon, minLat, maxLon, maxLat];
}

function outerRings(geometry) {
  if (geometry.type === 'Polygon') {
    return [geometry.coordinates[0]];
  }
  return geometry.coordinates.map(function firstRing(polygon) {
    return polygon[0];
  });
}

function isPointInRing(longitude, latitude, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i = i + 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const crosses = (yi > latitude) !== (yj > latitude) && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
    if (crosses) {
      inside = !inside;
    }
  }
  return inside;
}

// Devuelve { collection, municipalities }; cada feature recibe properties.idx
export function buildMunicipalityIndex(featureCollection) {
  const municipalities = featureCollection.features.map(function toMunicipality(feature, idx) {
    feature.properties.idx = idx;
    const rings = outerRings(feature.geometry);
    const bboxes = rings.map(ringBounds);
    const bbox = [
      Math.min.apply(null, bboxes.map(function minLon(b) { return b[0]; })),
      Math.min.apply(null, bboxes.map(function minLat(b) { return b[1]; })),
      Math.max.apply(null, bboxes.map(function maxLon(b) { return b[2]; })),
      Math.max.apply(null, bboxes.map(function maxLat(b) { return b[3]; }))
    ];
    return {
      idx: idx,
      id: feature.properties.id,
      name: feature.properties.nombre,
      province: feature.properties.provincia,
      capital: feature.properties.capital,
      km2: feature.properties.km2,
      rings: rings,
      ringBboxes: bboxes,
      bbox: bbox,
      center: [(bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2]
    };
  });
  return { collection: featureCollection, municipalities: municipalities };
}

export function findMunicipalityIndex(municipalities, longitude, latitude) {
  for (let m = 0; m < municipalities.length; m = m + 1) {
    const municipality = municipalities[m];
    const b = municipality.bbox;
    if (longitude < b[0] || longitude > b[2] || latitude < b[1] || latitude > b[3]) {
      continue;
    }
    for (let r = 0; r < municipality.rings.length; r = r + 1) {
      const rb = municipality.ringBboxes[r];
      if (longitude < rb[0] || longitude > rb[2] || latitude < rb[1] || latitude > rb[3]) {
        continue;
      }
      if (isPointInRing(longitude, latitude, municipality.rings[r])) {
        return m;
      }
    }
  }
  return -1;
}

// Serie mensual por municipio a partir de las celdas y cuadros del API
export function aggregateByMunicipality(data, municipalities) {
  const cellToMunicipality = data.cells.map(function locate(cell) {
    return findMunicipalityIndex(municipalities, cell.longitude, cell.latitude);
  });
  const monthIndexByName = {};
  data.months.forEach(function index(month, i) {
    monthIndexByName[month] = i;
  });
  const series = municipalities.map(function empty() {
    return new Float32Array(data.months.length);
  });
  data.months.forEach(function addFrame(month) {
    const frame = data.frames[month] || [];
    frame.forEach(function addEntry(entry) {
      const municipalityIndex = cellToMunicipality[entry[0]];
      if (municipalityIndex >= 0) {
        series[municipalityIndex][monthIndexByName[month]] += entry[1];
      }
    });
  });
  return { series: series, cellToMunicipality: cellToMunicipality };
}

export function sumSeries(values) {
  let total = 0;
  for (let i = 0; i < values.length; i = i + 1) {
    total += values[i];
  }
  return total;
}

export function medianOf(values) {
  if (values.length === 0) {
    return 0;
  }
  const sorted = values.slice().sort(function ascending(a, b) { return a - b; });
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

// Mediana del mismo mes calendario en años anteriores al índice dado
export function medianForSameMonth(months, values, monthIdx) {
  const calendarMonth = months[monthIdx].slice(5, 7);
  const sameMonthValues = [];
  months.forEach(function collect(month, i) {
    if (i < monthIdx && month.slice(5, 7) === calendarMonth) {
      sameMonthValues.push(values[i]);
    }
  });
  return { median: medianOf(sameMonthValues), years: sameMonthValues.length };
}

// Zoom de mapa que encuadra un bbox en una vista de ancho dado
export function zoomForBbox(bbox, viewportWidth) {
  const span = Math.max(bbox[2] - bbox[0], (bbox[3] - bbox[1]) * 1.2, 0.02);
  return Math.log2((360 * (viewportWidth / 512)) / span) - 0.5;
}
