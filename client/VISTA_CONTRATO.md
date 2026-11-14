# Contrato de la Vista (P3) con el Controlador (P2) y el Modelo (P1)

Este documento dice **qué usa hoy la Vista**, qué datos espera y qué falta conectar. Vive en `client/` (carpeta de P3).
Para probar sin servidor: `cd client && VITE_USE_MOCKS=true npm run dev` (muestra sintética, siempre rotulada en pantalla).

## Rutas de la web (hash, sin servidor)
| Ruta | Qué muestra |
|---|---|
| `#/inicio` (o vacío) | Portada con relieve girando |
| `#/atlas` | Atlas 3D: 48 municipios, ranking, ficha, línea de tiempo con ▶ y banda El Niño |
| `#/calendario` | Calendario meses × años (cantidad o anomalía), por departamento o municipio, descarga CSV |
| `#/metodo` | Cómo se armoniza, límites y fuentes |
| `#clasico` | Calendario original del esqueleto (sigue funcionando) |

## Qué llama hoy la Vista
1. **`GET /api/focos3d?zona=depto`** (docs/API_FOCOS3D.md). Es lo único imprescindible.
   - La Vista pide la zona `depto` (todo Cochabamba) y **agrega ella misma por municipio** (punto en polígono sobre `cells`).
   - Usa `months`, `frames[mes] = [[idCelda, valor], ...]`, `cells[i] = {longitude, latitude, total}`, `maxCellTotal`, `maxCellMonthly`, `isSample`.
   - Si la llamada falla, usa la muestra sintética del kit y lo avisa con la etiqueta "Muestra sintética".
   - Cuando `isSample` es `false`, la etiqueta desaparece sola.
2. `fetchZonesNow` (`/api/zonas/ahora`) **no se usa todavía** en el atlas (el ranking sale de los mismos datos).
3. `fetchPointInfo` (`/api/gamc/info`) y las capas GAMC (`/api/gamc/...`) **no están conectadas todavía** en el atlas. Quedan para Cercado (distrito, cota 2750, periurbano) si hay tiempo.

## Lo que necesita la Vista de P1/P2 para mostrar datos reales
- `data/processed/focos_mensuales.json` con focos **armonizados** de **todo el departamento** (lon -67.6 a -64.2, lat -18.6 a -15.6) y meses completos (idealmente 2000-2026). Si solo hay celdas del Tunari, el resto de municipios saldrá en cero.
- Celdas de ~0,02° (el kit usa 0,02°); si son más grandes los polígonos pequeños (Colcapirhua, Vinto...) pueden quedar sin celdas.
- `isSample: false` y `harmonized: true` solo cuando sea dato real.
- CORS habilitado para el origen de la Vista; `X-Truncated` expuesto si se usa el CSV del servidor.
- (Opcional, mejor rendimiento) endpoint que ya devuelva el conteo **por municipio y mes**, para no agregar en el navegador:
  `GET /api/municipios/mensual` → `{ months: [...], municipios: [{ id, nombre, serie: [..] }] }` con los mismos ids que `client/public/data/municipios_cochabamba.geojson` (`properties.id`). Si P2 lo crea, avísenme y cambio la Vista a usarlo.

## Archivos de datos que ya trae la Vista (no hace falta servidor)
- `client/public/data/municipios_cochabamba.geojson`: 48 unidades (47 municipios + TIOC Raqaypampa). Fuente: Lab TecnoSocial 2024 (CC BY 4.0, compilación no oficial). Se cita en pantalla.
- `client/public/data/oni.json`: índice ONI de NOAA (mes central de cada trimestre móvil), descargado el 2026-11-14. Solo contexto de El Niño/La Niña. Para actualizarlo: bajar `https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt` y reconvertir.

## Reglas que la Vista respeta (del CLAUDE.md del repo)
- Dice "focos" o "detecciones", nunca "incendios contados"; MODIS y VIIRS nunca se suman; nada se presenta como predicción.
- El Niño es contexto histórico, sin causalidad.
- La clave de la API del GAMC nunca está en el navegador ni en git.

## Pendiente de la Vista (P3)
Revisión del quechua por una persona hablante; capas de Cercado; vista del Tunari; panel de validación con cifras oficiales; datos reales.
