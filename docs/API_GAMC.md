# API.md — sección nueva: Alcaldía (GAMC) y zonas de Cochabamba

Contrato **Controlador ↔ Vista**. Pegar al final de `docs/API.md`. Si cambia, se cambian este doc y `client/src/mocks/gamc.mock.js` en el mismo commit.

Base: `http://localhost:4000`. Todas las respuestas son JSON salvo las imágenes. La Vista **nunca** llama a la Alcaldía directo: la API key vive solo en `server/.env`.

## GET /api/gamc/layers
Catálogo de capas de la Alcaldía.
```json
{
  "configured": true,
  "coverageBbox": [-66.280703, -17.53119, -66.06952, -17.257306],
  "layers": [
    { "name": "distritos", "label": "Límite de distritos (Cercado)", "representation": "simple", "bbox": [...], "attributes": ["Distrito", "Comuna"] },
    { "name": "cota2750", "label": "Cota 2750 (límite de urbanización del Tunari)", "representation": "categorizado", "bbox": [...], "attributes": ["Distrito"] },
    { "name": "periurbanos", "label": "Periurbanos (crecimiento urbano)", "representation": "categorizado", "bbox": [...], "attributes": ["Periurbano", "Detalle"] }
  ]
}
```

## GET /api/gamc/wms/:layer
Proxy de **GetMap**. `:layer` = `distritos` | `cota2750` | `periurbanos`. Acepta los parámetros WMS que manda Leaflet (`bbox`, `width`, `height`, `srs`; minúscula o mayúscula). Devuelve `image/png`. Errores: 400 (parámetros), 404 (capa), 503 (falta la key), 502 (la Alcaldía falló).

## GET /api/gamc/legend/:layer
Leyenda en PNG (GetLegendGraphic).

## GET /api/gamc/legend/:layer/json
```json
{ "layer": "periurbanos", "classes": [ { "label": "Periurbanos en crecimiento", "fill": "#70FF24", "stroke": "#8f8f8f" } ] }
```

## GET /api/gamc/info?lat=-17.30&lon=-66.15
Qué dice la Alcaldía de un punto + combustible.
```json
{
  "latitude": -17.30, "longitude": -66.15,
  "insideGamcCoverage": true,
  "distrito": "D13", "comuna": "TUNARI",
  "insideCota2750Layer": true, "cota2750Distrito": "D13",
  "periurbano": "Periurbanos en crecimiento",
  "coberturaGamc": "Herbazales ralos con intervención urbana",
  "fuelClass": "pajonal",
  "fuelProfile": { "nombre": "...", "inflamabilidad": "Alta", "propagacion": "Muy rápida", "explicacion": "...", "color": "#E3B505" }
}
```
Fuera de Cercado: `{ "insideGamcCoverage": false, "message": "..." }`.

## GET /api/gamc/districts/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
Detecciones armonizadas por distrito (equivalente VIIRS S-NPP; regla 2 y 3: nunca se suman sensores del mismo período).
```json
{
  "unit": "detecciones (equivalente VIIRS S-NPP)",
  "harmonized": true,
  "isSample": false,
  "note": "Una detección es un píxel caliente, no un incendio. Análisis histórico, no predicción.",
  "districts": [
    { "distrito": "D13", "comuna": "TUNARI", "total": 120.5,
      "byYear": { "2016": 20.0 }, "byMonth": { "1": 0, "...": 0, "12": 4 },
      "insideCota2750Layer": 70, "byPeriurbano": { "Periurbanos en crecimiento": 30 } }
  ]
}
```

## GET /api/zones
GeoJSON `FeatureCollection` con las zonas críticas. Cada `properties`: `id`, `nombre`, `tipo` (`departamental` | `zona_critica` | `detalle_gamc`), `municipios[]`, `bbox`, `contexto`, `referencia`, `combustibles[]` (ids) y `fuels[]` (perfiles completos).

## GET /api/zones/:id
Una zona (404 si no existe).

## GET /api/zones/fuels
Catálogo de combustibles (`classes`) y reglas `gamcDetailRules`.

**Cómo se usa una zona en el calendario:** la Vista manda `feature.geometry` al mismo endpoint del calendario que ya existe (igual que un polígono dibujado). No hace falta un endpoint nuevo para eso.
