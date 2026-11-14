# Contrato de datos — Modelo ↔ Controlador

Dueño: **P1 (Modelo)**. Cambios solo avisando a P2.

El pipeline de Python (`model/`) escribe en `data/processed/`. Si esa carpeta está vacía, el servidor usa `data/sample/` (mismo formato, datos sintéticos).

## 1. `daily_cells.csv`: conteo diario armonizado por celda

Una fila por **celda de 0.1° × 0.1° y día** con al menos una detección.

| columna | tipo | descripción |
|---|---|---|
| `date` | `YYYY-MM-DD` | fecha de adquisición (UTC) |
| `lat` | float | latitud del centro de la celda |
| `lon` | float | longitud del centro de la celda |
| `modis_n` | int | detecciones MODIS (Terra+Aqua) después de filtros |
| `viirs_n` | int | detecciones VIIRS después de filtros (S-NPP; después del fin de S-NPP, NOAA-20) |
| `harm_n` | float | **conteo armonizado en "equivalente VIIRS"**: es lo que usa el calendario |
| `source` | `modis_scaled` \| `viirs` \| `viirs_noaa20_scaled` | de qué sensor sale `harm_n` |

Regla:
- antes de 2012-01-20 (no existía VIIRS): `harm_n = modis_n × k(mes)`
- mientras S-NPP entrega datos: `harm_n = viirs_n` (S-NPP)
- después del fin de S-NPP: `harm_n = NOAA-20 × k20(mes)`, calibrado contra S-NPP en su período común

⚠️ Earthdata avisa que **Suomi NPP ya no entrega datos nuevos**. Por eso la serie VIIRS sigue con NOAA-20.
**Nunca** se suman `modis_n` + `viirs_n`, porque el mismo fuego se contaría dos veces.

## 2. `points/<año>.csv`: focos individuales (para la descarga CSV)

| columna | descripción |
|---|---|
| `sensor` | `MODIS` \| `VIIRS` |
| `platform` | `Terra` \| `Aqua` \| `SNPP` \| `NOAA20` \| `NOAA21` |
| `latitude`, `longitude` | ubicación del centro del píxel |
| `acq_date`, `acq_time` | fecha (YYYY-MM-DD) y hora (HHMM UTC) |
| `confidence` | MODIS 0–100 / VIIRS `n`,`h` |
| `frp` | potencia radiativa del fuego (MW) |
| `daynight` | `D` \| `N` |

## 3. `metadata.json`

```json
{
  "version": "2026-11-14T15:00",
  "is_sample": false,
  "cell_size_deg": 0.1,
  "bbox": [-69.7, -22.95, -57.4, -9.6],
  "viirs_start": "2012-01-20",
  "snpp_end": "2026-…", "modis_end": "2026-…",
  "date_min": "2000-11-01",
  "date_max": "2026-11-10",
  "method": "texto corto del método",
  "unit": "detecciones equivalentes a VIIRS S-NPP (375 m)",
  "coefficients_by_month": {"1": 3.1, "2": 2.9, "...": 0},
  "noaa20_coefficients_by_month": {"1": 1.05, "...": 0},
  "validation": {"train": "2012-2018", "test": "2019-...", "mae_harmonized": 0, "mae_naive": 0, "corr": 0}
}
```

## 4. Funciones del modelo JS (`server/src/models/fireData.model.js`)

Esto es lo que el Controlador llama. P1 puede cambiar la implementación interna, pero **no las firmas**.

```js
getDataSource()                        // -> "processed" | "sample"
getMetadata()                          // -> objeto de metadata.json
getDailyCells({ bbox, start, end })   // -> [{date, lat, lon, modis_n, viirs_n, harm_n, source}]
getPoints({ bbox, start, end, limit, filter }) // -> { header, rows, truncated }  (rows = arrays en el orden de header)
getRegions()                           // -> [{id, name, bbox}]  (Firestore si está configurado; si no, JSON local)
```

`bbox = [minLon, minLat, maxLon, maxLat]`. Las fechas van como `YYYY-MM-DD` (inclusive).

## 5. Firebase (Firestore): solo datos pequeños

El plan gratuito (Spark) tiene cuotas diarias de escrituras bajas, así que **no suban focos individuales a Firestore**.

| Colección/doc | Contenido | Quién escribe |
|---|---|---|
| `meta/harmonization` | copia de `metadata.json` | `model/upload_firestore.py` |
| `regions/{id}` | `{name, bbox}` presets de Bolivia | `model/upload_firestore.py` |
| `calendars/{regionId}` | serie mensual precalculada (opcional, cache) | P2 si lo necesita |


---

# DATA.md — sección nueva: archivos para el enfoque Cochabamba

Contrato **Modelo ↔ Controlador**. Pegar al final de `docs/DATA.md`. Dueño de todos estos archivos: **P1**.

| Archivo | Qué es | Lo genera |
|---|---|---|
| `data/zones/cochabamba_zones.geojson` | Zonas críticas (rectángulos aproximados) | A mano (kit). Mejorar con GeoBolivia |
| `data/vegetation/fuel_profiles.json` | Tipos de vegetación/combustible y reglas para traducir la capa Periurbanos | A mano (kit) |
| `data/processed/gamc_tags.json` | Detecciones dentro de Cercado con distrito, cota y periurbano | `model/gamc_tag.py` |
| `data/processed/gamc_cache.json` | Respuestas guardadas de la Alcaldía (no repetir consultas) | `model/gamc_tag.py` |
| `data/processed/k_factors.json` | Factores k(mes) de la armonización | Pipeline de armonización |
| `data/sample/*.sample.json` | Versiones **sintéticas** para desarrollar | Kit |

El servidor usa `processed/` si existe; si no, `sample/` (y la respuesta trae `isSample: true`).

## gamc_tags.json
```json
{
  "metadata": { "sintetico": false, "descripcion": "...", "entrada": "detections.csv", "generado": "2026-11-14 18:00" },
  "detections": [
    { "id": "D000123", "source": "VIIRS_SNPP", "date": "2016-08-02", "latitude": -17.35, "longitude": -66.15,
      "distrito": "D2", "comuna": "TUNARI", "insideCota2750Layer": false,
      "periurbano": "Periurbanos en crecimiento", "coberturaGamc": "Herbazales ralos con intervención urbana" }
  ]
}
```
`source` ∈ `MODIS` | `VIIRS_SNPP` | `VIIRS_NOAA20` | `VIIRS_NOAA21`. Ya pasaron los filtros de la regla 4.

## k_factors.json
```json
{ "k_modis": { "1": 2.1, "...": 0, "12": 1.9 }, "k_noaa20": { "1": 1.0, "...": 0, "12": 1.0 }, "snpp_end": "YYYY-MM-DD" }
```
- `k_modis[mes]`: multiplica MODIS antes de 2012-01-20 para llevarlo a "equivalente S-NPP".
- `k_noaa20[mes]`: multiplica NOAA-20 después de `snpp_end`.
- `snpp_end`: último día con datos S-NPP usados. **P1 debe poner la fecha real** (la muestra tiene una inventada).

## Datos FIRMS para Cochabamba
Descargar el archivo histórico de FIRMS (MODIS C6.1 y VIIRS S-NPP / NOAA-20) para Bolivia y recortar al departamento de Cochabamba:
`lon -67.6 a -64.2, lat -18.6 a -15.6`. Para la Alcaldía solo sirve lo que cae en `lon -66.2807 a -66.0695, lat -17.5312 a -17.2573`.
