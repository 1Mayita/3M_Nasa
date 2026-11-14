# Calendario de Fuego Armonizado: MODIS + VIIRS 🔥🛰️

Proyecto para el **NASA Space Apps Challenge 2026**, reto *Harmonization of MODIS and VIIRS Hot Spots*.

Combina más de 20 años de detecciones de focos de calor de MODIS (1 km) y VIIRS (375 m; S-NPP y NOAA-20), datos de NASA FIRMS, en una sola serie coherente. Sobre esa serie arma un **calendario de actividad de fuego** para cualquier área de Bolivia (y adaptable a otras regiones).

## Estructura

```
model/      MODELO: pipeline Python (descarga FIRMS, filtros, armonización, Firestore)
data/       datos: sample/ (sintéticos, incluidos), raw/ y processed/ (ignorados en git)
server/     CONTROLADOR: API Express (server/src/models = acceso a datos, del Modelo)
client/     VISTA: React + Leaflet
docs/       PLAN.md (reparto y cronograma), DATA.md y API.md (contratos)
CLAUDE.md   contexto para el asistente de cada integrante
```

## Arranque rápido

```bash
cd server && npm install && npm run dev      # API en :4000 (usa data/sample si no hay data/processed)
cd client && npm install && npm run dev      # Vista en :5173
```

Para usar datos reales, ver `model/README.md`. Para el reparto de tareas y el flujo de git, ver `docs/PLAN.md`.

Para trabajar sin el API: `cd client && VITE_USE_MOCKS=true npm run dev`.

## Equipo
- P1, Modelo: _maya_
- P2, Controlador: _mayerli_
- P3, Vista: _yanarico_
