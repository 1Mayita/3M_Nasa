// =====================================================================
// Dueño: P2 (Controlador)
// Zonas críticas de fuego del departamento de Cochabamba y sus combustibles.
// =====================================================================

import { readZones, readFuelProfiles } from '../models/zones.model.js';

export class ZonesServiceError extends Error {
  constructor(message, httpStatus) {
    super(message);
    this.httpStatus = httpStatus;
  }
}

/**
 * Devuelve el GeoJSON de zonas y, dentro de cada zona, sus combustibles con detalle.
 */
export async function getZonesWithFuel() {
  const zones = await readZones();
  const fuelProfiles = await readFuelProfiles();

  const featuresWithFuel = [];
  for (const feature of zones.features) {
    const fuelClassNames = Array.isArray(feature.properties.combustibles) ? feature.properties.combustibles : [];
    const fuels = [];
    for (const fuelClassName of fuelClassNames) {
      const fuelProfile = fuelProfiles.classes[fuelClassName];
      if (fuelProfile !== undefined) {
        fuels.push(Object.assign({ id: fuelClassName }, fuelProfile));
      }
    }
    const propertiesWithFuel = Object.assign({}, feature.properties, { fuels: fuels });
    featuresWithFuel.push(Object.assign({}, feature, { properties: propertiesWithFuel }));
  }

  return {
    type: 'FeatureCollection',
    metadata: zones.metadata || {},
    features: featuresWithFuel
  };
}

export async function getZoneById(zoneId) {
  const zonesWithFuel = await getZonesWithFuel();
  const zone = zonesWithFuel.features.find(function matchesId(feature) {
    return feature.properties.id === zoneId;
  });
  if (zone === undefined) {
    throw new ZonesServiceError('Zona no encontrada: ' + zoneId, 404);
  }
  return zone;
}

export async function getFuelCatalog() {
  const fuelProfiles = await readFuelProfiles();
  return fuelProfiles;
}
