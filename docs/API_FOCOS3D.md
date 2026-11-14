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
