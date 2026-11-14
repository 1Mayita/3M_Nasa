# CLAUDE.md: contexto para el asistente de cada integrante

Lee esto antes de escribir código en este repo.

## El proyecto (enfoque nuevo: Cochabamba)
NASA Space Apps 2026, reto **"Harmonization of MODIS and VIIRS Hot Spots"**. App web con un **calendario de actividad de fuego armonizado** que combina MODIS (1 km, desde 2000) y VIIRS (375 m: S-NPP desde 2012-01-20; NOAA-20 cuando S-NPP deja de dar datos).

**Caso de estudio: departamento de Cochabamba, en las zonas con más fuego**, en dos niveles:
1. **Departamento → zonas críticas** (`data/zones/cochabamba_zones.geojson`): ladera sur del Tunari, trópico, TIPNIS/Carrasco, noroeste (Cocapata–Morochata–Independencia), cabeceras (Tiraque–Colomi), sudeste (Pocona–Totora–Vacas–Pojo), Capinota. Cada zona muestra **qué vegetación se quema** (eucalipto, pino, pajonal, kewiña, bosque húmedo…) desde `data/vegetation/fuel_profiles.json`.
2. **Municipio de Cercado al detalle con la API de la Alcaldía (GAMC)**: capas WMS de distritos, cota 2750 y periurbanos. Cada foco de Cercado se etiqueta con su distrito, si cae en la capa cota 2750 y su clase de periurbano. Resultado: ranking y calendario **por distrito**.

El usuario elige una zona (o dibuja / pone lat-lon) y un rango de fechas, y ve: meses y años con más focos, el mes actual contra la mediana histórica (anomalías), la vegetación de la zona y puede descargar un CSV.

Público: UGR de Gobernación y municipios, bomberos y voluntarios (Tunari Sin Fuego), SERNAP, gestores del territorio. Equipo de 3, hackathon: prioriza que funcione sobre que sea perfecto.

## Arquitectura MVC y propiedad de carpetas: NO edites carpetas ajenas
| Capa | Carpetas | Dueño |
|---|---|---|
| Modelo | `model/` (Python), `data/`, `server/src/models/`, `server/src/config/firebase.js`, `server/src/config/gamc.js` | P1 |
| Controlador | `server/` excepto lo del Modelo | P2 |
| Vista | `client/` | P3 |

Si tu tarea necesita un cambio en una carpeta ajena, **no lo hagas**: escribe qué se necesita para que el dueño lo haga.
Contratos: `docs/DATA.md` + `docs/DATA_GAMC.md` (Modelo↔Controlador) y `docs/API.md` + `docs/API_GAMC.md` (Controlador↔Vista). Si cambian, se cambian el doc y los mocks en el mismo commit, y se avisa al equipo.

## API de la Alcaldía (GAMC) — reglas
- Base: `https://serviciosgamc.cochabamba.bo/api/gs/wms` · WMS 1.1.1 · solo lectura · parámetros `key`, `service_id`, `REQUEST`, `LAYERS` vacío (sin STYLES).
- Servicios: distritos `7eb13092-…`, cota2750 `297cefa4-…`, periurbanos `c52066a1-…` (completos en `server/src/config/gamc.js`).
- Cobertura: **solo municipio de Cercado** (lon -66.2807…-66.0695, lat -17.5312…-17.2573).
- GetFeatureInfo devuelve **solo atributos, sin geometría**: distritos → `{Distrito, Comuna}`; cota2750 → `{Distrito}`; periurbanos → `{Periurbano, Detalle}`.
- **La key nunca va al navegador ni a git**: vive en `server/.env` (`GAMC_API_KEY`). La Vista pide todo a `/api/gamc/...`.
- La API se satura con cientos de consultas seguidas: GetFeatureInfo va **de a una con pausa** y se guarda en caché (`gamc_cache.json`). El etiquetado masivo se hace una vez con `model/gamc_tag.py`, no en cada request.

## Reglas científicas (no negociables)
1. Una detección es un **píxel caliente**, no un incendio. Habla de "focos" o "detecciones", nunca de "incendios" contados. (Vocabulario boliviano: foco = anomalía térmica; incendio = afecta bosque; quema = pastizal/arbusto.)
2. **Nunca sumes** detecciones MODIS + VIIRS del mismo período.
3. Serie armonizada en "equivalente VIIRS S-NPP": antes de 2012-01-20 MODIS × k(mes); luego VIIRS S-NPP; después del fin de S-NPP, NOAA-20 × k20(mes).
4. Filtros: MODIS `confidence >= 30`; VIIRS `confidence in {n, h}`; si existe `type`, solo `type == 0`.
5. No presentes nada como predicción. Los perfiles de vegetación son **contexto descriptivo**, no un modelo de riesgo.
6. Cifras oficiales (hectáreas de UGR/SERNAP) se muestran **al lado** como validación, nunca sumadas ni mezcladas con detecciones.
7. Colores accesibles: `client/src/utils/colorRamps.js` (viridis secuencial, PuOr divergente).

## Stack
- Modelo: Python 3 + pandas (`model/`), Node (`server/src/models/`), Firestore solo para metadatos y presets.
- Controlador: Node 20+, Express, ES modules. `routes/` → `controllers/` → `services/` → `models/`.
- Vista: React + Vite + react-leaflet + leaflet-geoman. Deploy: Firebase Hosting.

## Cómo correr
```bash
cd model && pip install -r requirements.txt && python make_sample.py
# etiquetar focos de Cercado con la Alcaldía (una vez, tarda: ~1 s por foco)
python gamc_tag.py --input ../data/processed/detections.csv --limit 50
cd server && npm install && npm run dev        # http://localhost:4000/api/health
node --test test/gamc.test.js                  # pruebas de la parte GAMC
cd client && npm install && npm run dev        # http://localhost:5173 (VITE_USE_MOCKS=true sin API)
```

## Estilo
- Código y nombres en inglés; interfaz y docs en español. Código explícito, sin atajos (se defiende en la presentación).
- Commits pequeños: `modelo: ...`, `controlador: ...`, `vista: ...`.
- Nada de secretos en git: `FIRMS_MAP_KEY`, `GAMC_API_KEY` y credenciales de Firebase van en `.env` o `serviceAccount.json` (ignorados).
