# CLAUDE.md: contexto para el asistente de cada integrante

Lee esto antes de escribir código en este repo.

## El proyecto
NASA Space Apps 2026, reto **"Harmonization of MODIS and VIIRS Hot Spots"**. Hay que construir una app web con un **calendario de actividad de fuego armonizado** que combine MODIS (1 km, desde 2000) y VIIRS (375 m: S-NPP desde 2012-01-20; NOAA-20 cuando S-NPP deja de dar datos). El usuario elige un área (dibujo en el mapa o lat/lon) y un rango de fechas, y ve:
- qué meses y años tuvieron más focos,
- el mes actual comparado con la mediana histórica (anomalías),
- y puede descargar un CSV de los focos.

Caso de estudio: Bolivia (Chiquitanía, Beni, Pando, Santa Cruz). Equipo de 3 personas, hackathon de 48 h: prioriza que funcione sobre que sea perfecto.

## Arquitectura MVC y propiedad de carpetas: NO edites carpetas ajenas
| Capa | Carpetas | Dueño |
|---|---|---|
| Modelo | `model/` (Python), `server/src/models/`, `server/src/config/firebase.js`, `data/` | P1 |
| Controlador | `server/` excepto lo del Modelo | P2 |
| Vista | `client/` | P3 |

Si tu tarea necesita un cambio en una carpeta ajena, **no lo hagas**: escribe qué se necesita para que el dueño lo haga.
Contratos entre capas: `docs/DATA.md` (Modelo↔Controlador) y `docs/API.md` (Controlador↔Vista). Respétalos al pie de la letra. Si hay que cambiarlos, se cambian el doc y los mocks en el mismo commit, y se avisa al equipo.

## Reglas científicas (no negociables)
1. Una detección es un **píxel caliente**, no un incendio. Habla de "focos" o "detecciones", nunca de "incendios" contados.
2. **Nunca sumes** detecciones MODIS + VIIRS del mismo período, porque se cuenta dos veces el mismo fuego.
3. La serie armonizada está en "equivalente VIIRS S-NPP": antes de 2012-01-20 se usa MODIS × k(mes) calibrado en el período de solapamiento; luego VIIRS S-NPP; y después del fin de S-NPP (ya no entrega datos nuevos), NOAA-20 × k20(mes).
4. Filtros: MODIS `confidence >= 30`; VIIRS `confidence in {n, h}`; si existe la columna `type`, solo `type == 0` (fuego de vegetación presunto).
5. No presentes nada como predicción: es análisis histórico y comparación con la mediana.

## Stack
- Modelo: Python 3 + pandas (`model/`), Node (`server/src/models/`), Firebase Firestore solo para metadatos y presets (cuotas gratuitas bajas: no subas focos individuales).
- Controlador: Node 20+, Express, ES modules. Estructura: `routes/` → `controllers/` → `services/` (lógica) → `models/` (datos).
- Vista: React + Vite + react-leaflet + leaflet-geoman (dibujo). Deploy: Firebase Hosting.

## Cómo correr
```bash
# datos de muestra (ya incluidos; regenerar si hace falta)
cd model && pip install -r requirements.txt && python make_sample.py
# API
cd server && npm install && npm run dev          # http://localhost:4000/api/health
npm test                                         # pruebas del calendario y del área
# Vista
cd client && npm install && npm run dev          # http://localhost:5173 (VITE_USE_MOCKS=true para trabajar sin API)
```

## Estilo
- Código y nombres en inglés; textos de la interfaz y documentación en español (la interfaz se puede traducir al inglés para el jurado al final).
- Commits pequeños: `modelo: ...`, `controlador: ...`, `vista: ...`.
- Nada de secretos en git: `FIRMS_MAP_KEY` y las credenciales de Firebase van en `.env` o `serviceAccount.json` (ignorados).
