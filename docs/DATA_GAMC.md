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
