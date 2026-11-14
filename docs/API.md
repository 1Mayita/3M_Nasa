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
