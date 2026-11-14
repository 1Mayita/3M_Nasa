// =====================================================================
// Dueño: P1 (Modelo)
// Configuración de la API WMS de la Alcaldía de Cochabamba (GAMC).
// La API key NUNCA se escribe aquí: se lee de server/.env (GAMC_API_KEY).
// Los service_id no son secretos, pero también se pueden sobrescribir por .env.
// =====================================================================

export const GAMC_CONFIG = {
  wmsUrl: process.env.GAMC_WMS_URL || 'https://serviciosgamc.cochabamba.bo/api/gs/wms',

  apiKey: process.env.GAMC_API_KEY || '',

  // Cobertura total de los servicios (es la del límite de distritos del municipio de Cercado).
  // Formato: [longitudMinima, latitudMinima, longitudMaxima, latitudMaxima]
  coverageBbox: [-66.280703, -17.53119, -66.06952, -17.257306],

  layers: {
    distritos: {
      name: 'distritos',
      label: 'Límite de distritos (Cercado)',
      serviceId: process.env.GAMC_SERVICE_DISTRITOS || '7eb13092-bf0e-493b-aae6-03c43eedda2c',
      representation: 'simple',
      bbox: [-66.280703, -17.53119, -66.06952, -17.257306],
      // Atributos que devuelve GetFeatureInfo (probado el 14/11/2026): { Distrito: 'D13', Comuna: 'TUNARI' }
      attributes: ['Distrito', 'Comuna']
    },
    cota2750: {
      name: 'cota2750',
      label: 'Cota 2750 (límite de urbanización del Tunari)',
      serviceId: process.env.GAMC_SERVICE_COTA2750 || '297cefa4-0832-42bb-a98e-2cbea989fd9d',
      representation: 'categorizado',
      bbox: [-66.193763, -17.367136, -66.103902, -17.257306],
      // Atributos que devuelve GetFeatureInfo (probado): { Distrito: 'D13' }
      attributes: ['Distrito']
    },
    periurbanos: {
      name: 'periurbanos',
      label: 'Periurbanos (crecimiento urbano)',
      serviceId: process.env.GAMC_SERVICE_PERIURBANOS || 'c52066a1-32fd-4925-81e0-c2dcb8f4238f',
      representation: 'categorizado',
      bbox: [-66.275711, -17.525117, -66.072201, -17.326109],
      // Atributos que devuelve GetFeatureInfo (probado):
      // { Periurbano: 'Periurbanos en crecimiento' | 'Periurbanos consolidados',
      //   Detalle: 'Herbazales ralos con intervención urbana' | 'Arbustales ralos con herbazales e intervención urbana' | ... }
      attributes: ['Periurbano', 'Detalle']
    }
  },

  // La API se satura si se le mandan cientos de consultas juntas (lo comprobamos).
  // Por eso las consultas de "información de un punto" van de a una, con pausa.
  featureInfoDelayMs: 250,

  requestTimeoutMs: 10000,

  // Cuántas teselas (imágenes del mapa) se guardan en memoria para no pedirlas dos veces.
  tileCacheMaxEntries: 800
};

export function isGamcConfigured() {
  const hasKey = GAMC_CONFIG.apiKey.length > 0;
  return hasKey;
}
