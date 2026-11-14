# Contrato de API — Controlador ↔ Vista

Dueño: **P2 (Controlador)**. Base URL local: `http://localhost:4000/api`.
Los ejemplos de respuesta reales están en `client/src/mocks/`, y la Vista trabaja contra ellos hasta que el API esté listo.

## Área de interés (AOI)

Se acepta **una** de estas dos formas en el body:

```json
{ "bbox": [-62.5, -18.5, -59.0, -15.5] }
```
```json
{ "polygon": [[-62.5,-18.5],[-59.0,-18.5],[-59.0,-15.5],[-62.5,-15.5]] }
```
`polygon` es una lista de `[lon, lat]` (anillo exterior, sin cerrar o cerrado, da igual).

---

## `GET /api/health`
`{ "ok": true, "data": "sample" | "processed" }`

## `GET /api/meta`
Devuelve `metadata.json` (ver `docs/DATA.md`).

## `GET /api/regions`
```json
[{ "id": "chiquitania", "name": "Chiquitanía (Santa Cruz)", "bbox": [-62.5,-18.5,-58.5,-15.5] }]
```

## `POST /api/calendar`
Body:
```json
{ "bbox": [...], "start": "2001-01-01", "end": "2026-10-31" }
```
Respuesta:
```json
{
  "query": { "bbox": [...], "polygon": null, "start": "2001-01-01", "end": "2026-10-31", "data_until": "2026-10-31", "cells": 1234 },
  "monthly": [
    { "year": 2019, "month": 8, "count": 15234.0, "median": 6100.0, "anomaly": 9134.0, "anomaly_pct": 149.7, "source": "viirs" }
    // source: "modis_scaled" | "viirs" | "viirs_noaa20_scaled" | null (mes sin focos)
  ],
  "yearly":  [ { "year": 2019, "count": 40210.0 } ],
  "daily":   [ { "date": "2019-08-20", "count": 1520.0 } ],
  "stats": {
    "total": 512340.0,
    "peak_year": { "year": 2024, "count": 61234.0 },
    "peak_month_of_year": { "month": 9, "median": 7400.0 },
    "current": { "year": 2026, "month": 10, "count": 3200.0, "median": 2500.0, "anomaly_pct": 28.0 }
  },
  "harmonization": { "method": "...", "unit": "...", "viirs_start": "2012-01-20", "snpp_end": "...",
                     "coefficients_by_month": {...}, "validation": {...}, "is_sample": false }
}
```
- `count` siempre es el conteo **armonizado** (`harm_n`).
- `median` es la mediana de ese mismo mes en **todos los demás años** del rango.
- `anomaly_pct` es `null` si `median` = 0.
- `daily` solo viene si el rango es ≤ 2 años (para no mandar respuestas enormes).
- Si `end` es posterior al último dato disponible, se recorta a `data_until`, para no mostrar un "−100 %" falso en el mes en curso.

## `POST /api/export`
Mismo body que `/calendar`. Responde `text/csv` con los focos individuales (formato de `points/` en `docs/DATA.md`) y el header `Content-Disposition: attachment; filename="focos_<start>_<end>.csv"`.
Límite: 200 000 filas (si se pasa, se corta y se agrega el header `X-Truncated: true`).

## Errores
`400 { "error": "mensaje" }` para un AOI o fechas inválidas, `500 { "error": "..." }` para errores internos.


---

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


---

# API.md — sección nueva: Vista 3D y zonas "ahora"

Contrato **Controlador (P2) ↔ Vista (P3)**. Pegar al final de `docs/API.md`.
Mocks con la misma forma: `client/src/components/vista3d/focos3d.mock.js`.

Los datos vienen **ya armonizados** (equivalente VIIRS S-NPP) desde el Modelo (`data/processed/focos_mensuales.json`, o la muestra sintética si no existe). Una detección es un píxel caliente, no un incendio.

## GET /api/focos3d?zona=tunari-sur&desde=2015-01&hasta=2020-12
Columnas para el mapa 3D y cuadros para la animación. `zona` = id de `/api/zones` (por defecto `depto`). `desde` y `hasta` son opcionales (`YYYY-MM`).

```json
{
  "zone": { "id": "tunari-sur", "nombre": "Ladera sur del Parque Tunari…", "bbox": [-66.42, -17.4, -66.0, -17.22],
            "municipios": ["…"], "fuels": [{ "id": "eucalipto", "nombre": "Plantación de eucalipto", "inflamabilidad": "Muy alta", "color": "#B23A48" }] },
  "unit": "detecciones (equivalente VIIRS S-NPP)",
  "cellSizeDeg": 0.02,
  "harmonized": true,
  "isSample": false,
  "note": "Una detección es un píxel caliente, no un incendio. Análisis histórico, no predicción.",
  "cells": [ { "id": 0, "longitude": -66.15, "latitude": -17.31, "total": 42.5 } ],
  "months": ["2015-01", "2015-02", "…", "2020-12"],
  "frames": { "2020-08": [[0, 10], [3, 2.5]] },
  "monthlyTotals": { "2020-08": 123.4 },
  "maxCellTotal": 42.5,
  "maxCellMonthly": 10
}
```
- `cells`: una columna por celda (~2,2 km); `total` = suma del rango (modo "Acumulado").
- `months`: todos los meses del rango, para la barra de tiempo.
- `frames[mes]`: `[idDeCelda, cantidad]` solo de las celdas con focos ese mes (modo "Mes a mes").
- `maxCellTotal` / `maxCellMonthly`: para escalar la altura y el color.
- Errores: 400 (formato de mes), 404 (zona), 500.

## GET /api/zonas/ahora?mes=2026-09
Zonas ordenadas por focos del mes, comparadas con la **mediana del mismo mes en años anteriores**. Sin `mes`, usa el último mes con datos. Pensado para el perfil **Bombero / UGR**.

```json
{
  "month": "2026-09",
  "unit": "detecciones (equivalente VIIRS S-NPP)",
  "isSample": false,
  "note": "Comparación con la mediana del mismo mes en años anteriores. No es una predicción.",
  "zones": [
    { "id": "tropico", "nombre": "Trópico de Cochabamba", "tipo": "zona_critica", "month": "2026-09",
      "current": 320, "median": 250, "anomalyPercent": 28, "yearsInMedian": 25 }
  ]
}
```
`anomalyPercent` es `null` si la mediana es 0. Color sugerido: púrpura (menos) ↔ naranja (más), de `utils/colorRamps.js`.

## Para P1: formato de `data/processed/focos_mensuales.json`
Lo genera `model/export_focos_mensuales.py`:
```json
{ "metadata": { "sintetico": false, "armonizado": true, "unidad": "…", "cellSizeDeg": 0.02 },
  "records": [[-66.15, -17.31, "2020-08", 10.0]] }
```
`records` = `[longitud_centro, latitud_centro, "YYYY-MM", cantidad_armonizada]`, ordenado por mes.

## GET /api/municipios/mensual?desde=YYYY-MM&hasta=YYYY-MM
Detecciones armonizadas por municipio y por mes (48 unidades: 47 municipios + TIOC Raqaypampa), con los mismos `id` que `client/public/data/municipios_cochabamba.geojson`. Copia de los límites en `data/reference/municipios_cochabamba.geojson` (Lab TecnoSocial 2024, CC BY 4.0, compilación no oficial). `desde` y `hasta` son opcionales.

```json
{
  "unit": "detecciones (equivalente VIIRS S-NPP)",
  "harmonized": true,
  "isSample": false,
  "note": "Cada celda de ~2 km se asigna al municipio donde cae su centro. Una detección es un píxel caliente, no un incendio. Análisis histórico, no predicción.",
  "months": ["2001-01", "…", "2026-10"],
  "municipios": [ { "id": "031101", "nombre": "Villa Tunari", "provincia": "Chapare", "total": 19070, "serie": [0, 1.5, "…"] } ],
  "fueraDeMunicipios": 0
}
```
- `serie[i]` corresponde a `months[i]` (mismo largo). Ordenados de mayor a menor `total`.
- `fueraDeMunicipios`: detecciones cuyas celdas caen fuera de todos los polígonos (borde del departamento).
