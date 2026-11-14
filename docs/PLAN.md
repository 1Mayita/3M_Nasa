# Plan de trabajo: 3 personas, MVC

Reto: **Harmonization of MODIS and VIIRS Hot Spots** (NASA Space Apps 2026).
Producto: app web con un **calendario de actividad de fuego armonizado** (MODIS 2000– + VIIRS 2012–) para un área elegida, con anomalías respecto de la mediana histórica y descarga en CSV. Caso de estudio: **Bolivia**.

## Arquitectura (Modelo – Vista – Controlador)

```
 VISTA  (client/)                React + Leaflet: mapa, dibujo del área, calendario,
                                 anomalías, tarjetas, descarga CSV
          ▲  JSON / CSV          │  HTTP  (contrato: docs/API.md)
          │                      ▼
 CONTROLADOR (server/)           Express: rutas → controladores → servicios
                                 valida el área, arma calendario, mediana, anomalías, CSV
          ▲  funciones JS        │  (contrato: docs/DATA.md §4)
          │                      ▼
 MODELO (model/, server/src/models/, data/)
                                 Python: FIRMS → filtros → ARMONIZACIÓN → data/processed
                                 JS: lee data/processed + Firebase Firestore (regiones, metadatos)
```

## Reparto: cada persona es dueña de sus carpetas

### P1, Modelo (datos + ciencia)
**Dueña de:** `model/`, `server/src/models/`, `server/src/config/firebase.js`, `data/`
- [ ] Hora 1: pedir la MAP_KEY de FIRMS y bajar los CSV de Bolivia (MODIS + VIIRS S-NPP + NOAA-20) a `data/raw/`
- [ ] Correr `python harmonize.py` con datos reales y revisar `metadata.json` (k por mes, validación)
- [ ] Revisar los filtros y los casos raros: volcanes y fuentes fijas (`type`), días sin datos, el fin de S-NPP
- [ ] Crear el proyecto de Firebase y correr `upload_firestore.py` (regiones + metadatos)
- [ ] Pitch: gráfico "antes/después de armonizar" y 3 cifras de validación

### P2, Controlador (API + análisis + integración)
**Dueño de:** `server/` excepto `server/src/models/` y `server/src/config/firebase.js`
- [ ] Hora 1: `npm install && npm run dev` con `data/sample`, y leer `docs/API.md`
- [ ] Probar el rendimiento con datos reales (calendario de toda Bolivia en menos de 2 s)
- [ ] Endpoints extra si hacen falta (por ejemplo `/api/calendar` por departamento), **actualizando `docs/API.md` y los mocks**
- [ ] Deploy del API (Render, Railway o Cloud Run) y `CORS_ORIGIN` con la URL de Firebase Hosting
- [ ] Es el **integrador**: revisa y hace los merges a `main`

### P3, Vista (interfaz + presentación)
**Dueña de:** `client/`
- [ ] Hora 1: `npm install && npm run dev` con `VITE_USE_MOCKS=true`
- [ ] Pulir el calendario "en llamas" (tooltip, leyenda, accesibilidad) y la vista de anomalías
- [ ] Gráfico diario o semanal cuando el rango es menor a 2 años (`daily` del API)
- [ ] Interfaz en inglés para el jurado (o un selector ES/EN)
- [ ] Deploy en Firebase Hosting (`npm run deploy`), capturas y video de 30 s

**Archivos compartidos** (`README.md`, `CLAUDE.md`, `docs/`): solo se cambian **avisando al grupo**.

## Cómo evitamos conflictos

1. **Carpetas separadas:** nadie toca la carpeta de otra persona. Si necesitas algo de otra capa, se lo pides al dueño.
2. **Contratos congelados:** `docs/DATA.md` (Modelo↔Controlador) y `docs/API.md` (Controlador↔Vista). Si se cambia un contrato, se actualizan el doc y el mock en el mismo commit.
3. **Nadie espera a nadie:** el Controlador ya funciona con `data/sample/` (sintético, mismo formato) y la Vista con `client/src/mocks/`. Cuando P1 entrega `data/processed/`, el servidor lo usa solo, sin cambiar código.
4. **Git:**
   ```bash
   # una sola vez (quien suba el esqueleto)
   git init && git add . && git commit -m "esqueleto MVC" && git branch -M main
   git remote add origin <URL-del-repo> && git push -u origin main
   # cada integrante
   git clone <URL> && git checkout -b modelo        # o controlador / vista
   git add <tus carpetas> && git commit -m "modelo: ..." && git push -u origin modelo
   # en cada sync: Pull Request de tu rama a main; P2 hace el merge
   git checkout main && git pull && git checkout modelo && git merge main
   ```
   `data/raw` y `data/processed` **no se suben** (pesan mucho). P1 comparte `data/processed` por Drive o la sube como release si los demás la necesitan.

## Cronograma (ajústenlo a la hora de cierre de su evento)

| Bloque | P1 – Modelo | P2 – Controlador | P3 – Vista |
|---|---|---|---|
| Sáb 9:30–11 | MAP_KEY, descarga de Bolivia | Server con sample, revisar contrato | Cliente con mocks |
| Sáb 11–15 | `harmonize.py` con datos reales, revisar k y validación | Rendimiento, casos de borde, tests | Calendario, anomalías, dibujo |
| **Sáb 15:00 – Sync 1** | Merge a `main`. Flujo real de punta a punta | | |
| Sáb 15–21 | Firestore, mejoras de armonización | Deploy del API | Inglés, accesibilidad, Firebase Hosting |
| **Sáb 21:00 – Sync 2** | Merge. **Congelar funcionalidades** | | |
| Dom mañana | Gráfico antes/después + cifras | Pruebas, arreglos | Pulir UI, capturas |
| Dom tarde | **Todos:** video de 30 s, slides, texto de envío, revisar requisitos | | |

## Checklist del enunciado (lo que buscará el jurado)

- [x] Armonización MODIS + VIIRS (el sensor de origen deja de importar)
- [x] Calendario desde inicios de los 2000 hasta hoy
- [x] Elegir región (dibujo en el mapa o lat/lon) y rango de fechas
- [x] Meses y años con más actividad
- [x] Mes actual vs mediana histórica (anomalías)
- [x] Escala de color accesible ("calendario en llamas")
- [x] Descarga CSV de los focos de la búsqueda
- [ ] **Con datos reales de Bolivia** (P1)
- [ ] Publicado en una URL (P2 + P3)
- [ ] Público: alerta temprana, bomberos, científicos, gestores de tierras (pitch)
