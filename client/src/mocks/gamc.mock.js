// =====================================================================
// Dueño: P3 (Vista) — mocks que siguen el contrato de docs/API_GAMC.md.
// Si cambia el contrato, se cambian el doc y este archivo en el mismo commit.
// =====================================================================

export const mockLayersCatalog = {
  configured: true,
  coverageBbox: [-66.280703, -17.53119, -66.06952, -17.257306],
  layers: [
    { name: 'distritos', label: 'Límite de distritos (Cercado)', representation: 'simple', bbox: [-66.280703, -17.53119, -66.06952, -17.257306], attributes: ['Distrito', 'Comuna'] },
    { name: 'cota2750', label: 'Cota 2750 (límite de urbanización del Tunari)', representation: 'categorizado', bbox: [-66.193763, -17.367136, -66.103902, -17.257306], attributes: ['Distrito'] },
    { name: 'periurbanos', label: 'Periurbanos (crecimiento urbano)', representation: 'categorizado', bbox: [-66.275711, -17.525117, -66.072201, -17.326109], attributes: ['Periurbano', 'Detalle'] }
  ]
};

function buildRectangle(minimumLongitude, minimumLatitude, maximumLongitude, maximumLatitude) {
  return {
    type: 'Polygon',
    coordinates: [[
      [minimumLongitude, minimumLatitude],
      [maximumLongitude, minimumLatitude],
      [maximumLongitude, maximumLatitude],
      [minimumLongitude, maximumLatitude],
      [minimumLongitude, minimumLatitude]
    ]]
  };
}

const pajonalFuel = { id: 'pajonal', nombre: 'Pajonal / herbazal de altura', inflamabilidad: 'Alta', propagacion: 'Muy rápida', intensidad: 'Baja a media', recuperacion: 'Rápida', color: '#E3B505', explicacion: 'Prende rápido y corre con el viento, pero se apaga pronto.' };
const eucaliptoFuel = { id: 'eucalipto', nombre: 'Plantación de eucalipto', inflamabilidad: 'Muy alta', propagacion: 'Rápida, con saltos', intensidad: 'Alta', recuperacion: 'Rebrota del tocón', color: '#B23A48', explicacion: 'Aceites en las hojas y corteza que vuela encendida.' };
const bosqueHumedoFuel = { id: 'bosque_humedo', nombre: 'Bosque húmedo (trópico)', inflamabilidad: 'Baja normal; alta tras desmonte', propagacion: 'Lenta', intensidad: 'Media a alta', recuperacion: 'Muy lenta', color: '#1B5E20', explicacion: 'El fuego llega con el chaqueo.' };

export const mockZones = {
  type: 'FeatureCollection',
  metadata: { advertencia: 'MOCK' },
  features: [
    { type: 'Feature', geometry: buildRectangle(-66.42, -17.40, -66.00, -17.22), properties: { id: 'tunari-sur', nombre: 'Ladera sur del Parque Tunari', tipo: 'zona_critica', municipios: ['Cochabamba (Cercado)', 'Sacaba', 'Quillacollo', 'Tiquipaya'], bbox: [-66.42, -17.40, -66.00, -17.22], contexto: 'Mitad de los incendios reportados del departamento.', referencia: 'UGR Gobernación', fuels: [pajonalFuel, eucaliptoFuel] } },
    { type: 'Feature', geometry: buildRectangle(-66.280703, -17.53119, -66.06952, -17.257306), properties: { id: 'cercado-gamc', nombre: 'Cercado — detalle Alcaldía', tipo: 'detalle_gamc', municipios: ['Cochabamba (Cercado)'], bbox: [-66.280703, -17.53119, -66.06952, -17.257306], contexto: 'Capas de la API GAMC.', referencia: 'SERNAP', fuels: [pajonalFuel] } },
    { type: 'Feature', geometry: buildRectangle(-65.95, -17.25, -64.40, -16.55), properties: { id: 'tropico', nombre: 'Trópico de Cochabamba', tipo: 'zona_critica', municipios: ['Villa Tunari', 'Chimoré'], bbox: [-65.95, -17.25, -64.40, -16.55], contexto: 'Donde el satélite ve más focos (chaqueo).', referencia: 'ABT 2019', fuels: [bosqueHumedoFuel] } }
  ]
};

export function mockPointInfo(latitude, longitude) {
  return {
    latitude: latitude,
    longitude: longitude,
    insideGamcCoverage: true,
    distrito: 'D13',
    comuna: 'TUNARI',
    insideCota2750Layer: true,
    cota2750Distrito: 'D13',
    periurbano: 'Periurbanos en crecimiento',
    coberturaGamc: 'Herbazales ralos con intervención urbana',
    fuelClass: 'pajonal',
    fuelProfile: pajonalFuel
  };
}

export const mockDistrictSummary = {
  unit: 'detecciones (equivalente VIIRS S-NPP)',
  harmonized: true,
  isSample: true,
  note: 'MOCK',
  districts: [
    { distrito: 'D13', comuna: 'TUNARI', total: 120.5, byYear: { '2016': 20, '2020': 18 }, byMonth: { '1': 1, '2': 0, '3': 1, '4': 2, '5': 4, '6': 12, '7': 20, '8': 25, '9': 24, '10': 18, '11': 9, '12': 4 }, insideCota2750Layer: 70, byPeriurbano: { 'Periurbanos en crecimiento': 30 } },
    { distrito: 'D9', comuna: 'ITOCTA', total: 60, byYear: {}, byMonth: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 2, '6': 6, '7': 10, '8': 14, '9': 12, '10': 9, '11': 4, '12': 2 }, insideCota2750Layer: 0, byPeriurbano: {} },
    { distrito: 'D1', comuna: 'TUNARI', total: 45, byYear: {}, byMonth: { '1': 0, '2': 0, '3': 0, '4': 1, '5': 2, '6': 5, '7': 8, '8': 10, '9': 9, '10': 6, '11': 3, '12': 1 }, insideCota2750Layer: 25, byPeriurbano: {} }
  ]
};
