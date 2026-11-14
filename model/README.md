# Modelo: pipeline de datos y armonización (P1)

```bash
pip install -r requirements.txt
python make_sample.py        # regenera data/sample (sintético, ya incluido en el repo)
python harmonize.py          # data/raw/*.csv  ->  data/processed/  (lo usa el servidor solo)
python upload_firestore.py   # opcional: metadata + regiones a Firestore
```

## 1. Conseguir los datos reales (primera hora)

**Opción A: CSV anuales por país (recomendada para 20+ años).** Desde el sitio de NASA FIRMS, en la sección de descargas, bajen los CSV de **Bolivia** por año para MODIS y VIIRS (S-NPP y NOAA-20). Descompriman todo en `data/raw/` (pueden hacer subcarpetas). `harmonize.py` detecta solo qué sensor es cada archivo (por columnas y por nombre).

**Opción B: API de área**, para completar lo más reciente o si la opción A no está disponible:
```bash
export FIRMS_MAP_KEY=...     # gratis: https://firms.modaps.eosdis.nasa.gov/api/map_key/
python fetch_firms.py --source VIIRS_NOAA20_NRT --start 2026-10-01 --end 2026-11-14
python fetch_firms.py --source MODIS_NRT        --start 2026-10-01 --end 2026-11-14
```

⚠️ **Suomi NPP ya no entrega datos nuevos** (aviso de Earthdata). Por eso el pipeline continúa la serie VIIRS con **NOAA-20**, calibrado contra S-NPP en su período común (`k20`). Verifiquen en la primera hora qué años trae cada descarga.

## 2. Qué hace `harmonize.py`

1. **Estandariza** cualquier CSV de FIRMS (MODIS o VIIRS, archivo o casi tiempo real).
2. **Filtra**: área de Bolivia; MODIS `confidence ≥ 30`; VIIRS `confidence ∈ {n, h}`; `type == 0` cuando existe; quita duplicados.
3. **Agrega** por celda de 0.1° y por día, separando MODIS, VIIRS S-NPP y NOAA-20.
4. **Calibra** `k(mes) = Σ VIIRS / Σ MODIS` por mes del año en el período de solapamiento (2012 hasta el fin de ambos sensores), a nivel de toda el área. Usar un factor por mes captura la diferencia de sensibilidad según la estación (VIIRS ve muchos más fuegos chicos en temporada de quemas agrícolas).
5. **Serie armonizada** (`harm_n`, en equivalente VIIRS S-NPP):
   - antes de 2012-01-20: `MODIS × k(mes)`
   - mientras hay S-NPP: VIIRS S-NPP
   - después del fin de S-NPP: `NOAA-20 × k20(mes)`
6. **Valida**: calibra con 2012–2018 y prueba en 2019+. Guarda en `metadata.json` el error mensual armonizado vs sin armonizar (`mae_harmonized` vs `mae_naive`) y la correlación. **Estas cifras son el argumento científico del pitch.**

## 3. Ideas si sobra tiempo (en orden de impacto)
- Factor `k` por región (bosque vs sabana) en vez de uno para todo el país.
- Calibrar usando solo detecciones diurnas o separadas por día/noche.
- Gráfico "antes/después": serie MODIS cruda + VIIRS cruda (salto en 2012) vs serie armonizada (continua).

Entrega a P2: `data/processed/` con el formato de `docs/DATA.md`. No cambien columnas sin avisar.
