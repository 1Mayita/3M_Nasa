# Contrato de la Vista (P3) con el Controlador (P2) y el Modelo (P1)

Este documento dice **qué usa hoy la Vista**, qué datos espera y qué falta. Vive en `client/` (carpeta de P3).
Para probar sin servidor: `cd client && VITE_USE_MOCKS=true npm run dev` (muestra sintética, siempre rotulada en pantalla).
Para probar con el servidor del equipo: levantar `server/` (con `GAMC_API_KEY` en `server/.env`) y `cd client && npm run dev` (el proxy envía `/api` a `localhost:4000`).

## Rutas de la web (hash, sin servidor)
| Ruta | Qué muestra |
|---|---|
| `#/inicio` (o vacío) | Portada con relieve girando |
| `#/atlas` | Atlas 3D: 48 unidades (47 municipios + TIOC Raqaypampa), ranking, ficha, línea de tiempo con ▶ y banda El Niño, capas de la Alcaldía |
| `#/tunari` | Mapa enfocado en el Parque Tunari, municipios resaltados, qué se quema y cifras oficiales citadas |
| `#/calendario` | Calendario meses × años (cantidad o anomalía), por departamento o municipio, descarga CSV |
| `#/metodo` | Cómo se armoniza, límites y fuentes |
| `#clasico` | Calendario original del esqueleto (sigue funcionando) |

Teclado: las flechas ← → sobre el mapa recorren los municipios por cantidad de detecciones; `Esc` cierra la ficha.

## Qué llama hoy la Vista
1. **`GET /api/focos3d?zona=depto`** (docs/API_FOCOS3D.md). Es lo único imprescindible.
   - La Vista pide la zona `depto` (todo Cochabamba) y **agrega ella misma por municipio** (punto en polígono sobre `cells`).
   - Usa `months`, `frames[mes] = [[idCelda, valor], ...]`, `cells[i] = {id, longitude, latitude, total}`, `maxCellTotal`, `maxCellMonthly`, `isSample`, `harmonized`.
   - Las celdas se enlazan **por `id`** (no por posición en el arreglo).
   - Si la llamada falla o tarda más de 20 s, usa la muestra sintética del kit y lo avisa con la etiqueta "Muestra sintética".
   - Cuando `isSample` es `false` la etiqueta desaparece sola; cuando `harmonized` es `false` se oculta la nota de "equivalente VIIRS".
2. **Capas de la Alcaldía (Cercado)**: `GET /api/gamc/wms/:layer?SRS=EPSG:3857&BBOX=minx,miny,maxx,maxy&WIDTH=256&HEIGHT=256` con `layer` = `distritos` | `cota2750` | `periurbanos`, y `GET /api/gamc/legend/:layer` para la leyenda. Probado contra el servidor del equipo. Con `VITE_USE_MOCKS=true` el panel de capas queda desactivado.
3. `fetchZonesNow` (`/api/zonas/ahora`) y `fetchPointInfo` (`/api/gamc/info`) existen en el código pero **el atlas aún no los usa**.

## Lo que necesita la Vista de P1/P2 para mostrar datos reales
- `data/processed/focos_mensuales.json` con focos **armonizados** de **todo el departamento** (lon -67.6 a -64.2, lat -18.6 a -15.6) y meses completos (idealmente 2000-2026). Si solo hay celdas del Tunari, el resto de municipios saldrá en cero.
- Celdas de ~0,02° (el kit usa 0,02°); si son más grandes los polígonos pequeños (Colcapirhua, Vinto...) pueden quedar sin celdas.
- `isSample: false` y `harmonized: true` solo cuando sea dato real.
- Evitar `months: []`: la Vista lo tolera, pero no mostrará nada útil.
- CORS habilitado para el origen de la Vista.
- (Opcional, mejor rendimiento) endpoint que ya devuelva el conteo **por municipio y mes**, para no agregar en el navegador:
  `GET /api/municipios/mensual` → `{ months: [...], municipios: [{ id, nombre, serie: [..] }] }` con los mismos ids que `client/public/data/municipios_cochabamba.geojson` (`properties.id`). Si P2 lo crea, avísenme y cambio la Vista a usarlo.

## Archivos de datos que ya trae la Vista (no hace falta servidor)
- `client/public/data/municipios_cochabamba.geojson`: 48 unidades (47 municipios + TIOC Raqaypampa). Fuente: Lab TecnoSocial 2024 (CC BY 4.0, compilación no oficial). Se cita en pantalla.
- `client/public/data/oni.json`: índice ONI de NOAA (mes central de cada trimestre móvil), descargado el 2026-11-14. Solo contexto de El Niño/La Niña. Para actualizarlo: bajar `https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt` y reconvertir.
- `client/public/data/combustibles.json`: copia de `data/vegetation/fuel_profiles.json` (P1) para la página del Tunari. Si P1 lo cambia, volver a copiarlo.

## Reglas que la Vista respeta (del CLAUDE.md del repo)
- Dice "focos" o "detecciones", nunca "incendios contados"; MODIS y VIIRS nunca se suman; nada se presenta como predicción.
- El Niño es contexto histórico, sin causalidad.
- La clave de la API del GAMC nunca está en el navegador ni en git.
- Los CSV que descarga la Vista llevan la columna `muestra_sintetica` y el prefijo `MUESTRA_` si los datos son de muestra.

## Pendiente de la Vista (P3)
Revisión del quechua por una persona hablante (hoy es preliminar y se rotula así); datos reales; cifras oficiales de hectáreas más allá de las citadas en la página del Tunari.

## Im�genes
- client/public/img/*.webp: ilustraciones generadas con IA (valle de Cochabamba, Cristo de la Concordia, laderas del Tunari y un textil andino original). Se rotulan en los cr�ditos de la web como ilustraciones generadas con IA. Si el equipo consigue fotograf�as propias, basta reemplazar esos cuatro archivos con el mismo nombre.
