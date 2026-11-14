# Plan nuevo: Calendario de Fuego Armonizado · Cochabamba

Equipo de 3 · entrega mañana · domingo 15/11/2026

## 1. Qué cambia

**Antes:** Bolivia en general (Chiquitanía, Beni, Pando, Santa Cruz).
**Ahora:** departamento de **Cochabamba**, solo en las zonas donde más se quema, y el municipio de **Cercado al detalle** con la API de la Alcaldía.

La historia que contamos en la demo:

1. **Dónde arde Cochabamba.** El satélite ve más focos en el **trópico** (Villa Tunari, chaqueo), pero la mitad de los incendios **reportados** está en el **Parque Tunari**, al lado de la ciudad. Los dos lugares se queman distinto.
2. **Qué se quema importa.** Cada zona muestra su vegetación: eucalipto y pino plantados (arden fuerte y rápido), pajonal (corre rápido y se apaga pronto), kewiña nativa (tarda décadas en volver) y bosque húmedo del trópico (se quema por chaqueo).
3. **Cuándo arde.** El calendario armonizado MODIS + VIIRS muestra la temporada de junio a noviembre, el pico de San Juan, los años malos (2016, 2020) y el mes actual contra la mediana.
4. **Dónde exactamente en la ciudad.** Con la API de la Alcaldía, cada foco de Cercado se asigna a su **distrito**, se marca si cae en la **capa de la cota 2750** (límite de urbanización del Tunari) y en qué **periurbano en crecimiento** cae. Esto conecta el fuego con el avance urbano y el loteamiento.

## 2. La API de la Alcaldía, explicada fácil

Piensa en la API como una **ventanilla de la Alcaldía**. Llegas con tu credencial (la **API key**) y el número del trámite (el **service_id** de la capa), y puedes pedir tres cosas:

| Pedido | Qué te devuelve | Para qué lo usamos |
|---|---|---|
| **GetMap** | Una imagen PNG transparente de la capa (distritos, cota, periurbanos) | Dibujarla encima del mapa |
| **GetLegendGraphic** | La leyenda (PNG o JSON con colores) | Mostrar qué significa cada color |
| **GetFeatureInfo** | "¿Qué hay en este punto?" en JSON | Saber en qué distrito cae cada foco |

Lo que comprobamos al probarla hoy:
- **Funciona**, y responde en `https://serviciosgamc.cochabamba.bo/api/gs/wms`.
- Cubre **solo el municipio de Cercado** (la ciudad y la ladera sur del Tunari que le toca).
- **Distritos** devuelve `{ Distrito: "D13", Comuna: "TUNARI" }`. Los distritos al pie del Tunari son **D1, D2 y D13** (comuna Tunari).
- **Cota 2750** devuelve `{ Distrito: "D13" }` cuando el punto cae dentro de la capa.
- **Periurbanos** devuelve `{ Periurbano: "Periurbanos en crecimiento" | "Periurbanos consolidados", Detalle: "Herbazales ralos con intervención urbana" | "Arbustales ralos con herbazales…" | … }`. El "Detalle" sirve como **tipo de cobertura** (pasto o arbusto).
- **No devuelve polígonos**, solo atributos. Por eso preguntamos punto por punto.
- **Si le mandas cientos de preguntas juntas, se satura** (nos pasó). Por eso se pregunta de a una, con pausa, y se guardan las respuestas.
- La key **no va en el navegador ni en git**: nuestro servidor la agrega. La Vista solo habla con nuestro servidor.

## 3. Reparto

### P1 · Modelo (datos)
1. Descargar FIRMS (MODIS + VIIRS S-NPP + NOAA-20) de Bolivia y **recortar a Cochabamba** (lon -67.6 a -64.2, lat -18.6 a -15.6). Pasar los filtros de la regla 4.
2. Calibrar y exportar **`data/processed/k_factors.json`** (k por mes y fecha real de fin de S-NPP).
3. Correr **`model/gamc_tag.py`** sobre los focos de Cercado → `data/processed/gamc_tags.json`. Primero con `--limit 50` para probar. El script guarda caché, así que si se corta se puede volver a correr.
4. Revisar `data/zones/cochabamba_zones.geojson`: son **rectángulos aproximados**. Si hay tiempo, reemplazarlos por los municipios reales de GeoBolivia (HDX `bol_adm_geobolivia_2019`).
5. Revisar `data/vegetation/fuel_profiles.json` (textos de vegetación).
6. Pasarle a P3 la **tabla de cifras oficiales** (hectáreas por año en el Tunari y por municipio) para el panel de validación. Están en el doc de investigación.

### P2 · Controlador (API Express)
1. Copiar del kit `routes/`, `controllers/` y `services/` de **gamc** y **zones**, y montar las rutas (ver `server/src/gamc.mount.example.js`).
2. Crear `server/.env` con `GAMC_API_KEY` (de `.env.example`). Verificar que `import 'dotenv/config'` sea el **primer** import del archivo principal.
3. Probar: `node --test test/gamc.test.js` y luego los endpoints de `docs/API_GAMC.md` con el navegador.
4. Hacer que el **calendario existente** acepte el `geometry` de una zona (debería funcionar igual que un polígono dibujado; si el área es grande, revisar el rendimiento).
5. Pegar `API_GAMC.md` en `API.md` y `DATA_GAMC.md` en `DATA.md`.

### P3 · Vista (React)
1. Copiar `components/`, `services/gamcApi.js`, `mocks/gamc.mock.js`, `utils/colorRamps.js` y `views/CochabambaView.jsx`.
2. Trabajar primero con `VITE_USE_MOCKS=true` hasta que P2 tenga el servidor listo.
3. Integrar en la pantalla principal: **selector de zonas** + **tarjetas de vegetación** + **capas de la Alcaldía** + **ranking por distrito**. El calendario existente recibe el área de la zona elegida.
4. Usar los colores accesibles de `colorRamps.js` en el calendario (viridis para cantidad, púrpura-naranja para anomalías).
5. Panel **"Validación con datos locales"**: hectáreas oficiales al lado, con etiqueta "otra métrica: hectáreas (UGR/SERNAP)".
6. Textos: siempre "focos" o "detecciones", nunca "incendios contados".

## 4. Cronograma (hasta mañana)

| Cuándo | P1 Modelo | P2 Controlador | P3 Vista |
|---|---|---|---|
| **Hoy 11:30–12:30 (los 3 juntos)** | Leer este plan, copiar el kit al repo en una rama `cochabamba`, crear los `.env`, levantar servidor y cliente | ← | ← |
| **Hoy 12:30–16:00** | FIRMS Cochabamba + filtros. Probar `gamc_tag.py --limit 50` | Montar rutas GAMC y zonas. Tests. Probar las capas en el navegador | Selector de zonas + tarjetas de vegetación + capas de la Alcaldía (con mocks) |
| **Hoy 16:00–20:00** | k_factors.json + correr `gamc_tag.py` completo | Calendario con geometría de zona. Revisar errores y caché | Ranking por distrito + integración con el servidor real |
| **Hoy 20:00–23:00** | Tabla de cifras oficiales para validar. Revisar textos de vegetación | Deploy de prueba del API | Panel de validación, colores accesibles, textos en español |
| **Mañana 8:00–10:00** | Ensayo de la demo (los 3) | Arreglar bugs | Arreglar bugs |
| **Mañana 10:00–12:00** | Video o slides y entrega | Deploy final | Deploy final (Firebase Hosting) |

Si algo se atrasa, **se corta en este orden** (primero lo menos importante): reemplazar rectángulos por municipios reales → panel de validación → leyenda JSON → ranking por distrito con datos reales (se muestra la muestra marcada como "muestra").

## 5. Guion de la demo (3 minutos)

1. Mapa del departamento con las zonas críticas: "el satélite ve más focos en el trópico, pero la mitad de los incendios reportados está en el Tunari".
2. Elegir **Trópico**: calendario con pico de julio a octubre. Tarjeta: bosque húmedo + chaqueo.
3. Elegir **Ladera sur del Tunari**: calendario con San Juan, años 2016 y 2020, y el mes actual contra la mediana. Tarjetas de eucalipto, pino, pajonal y kewiña.
4. Zoom a **Cercado**: se encienden las capas de la Alcaldía. Clic en un punto de Tirani: distrito D13, dentro de la capa cota 2750, periurbano en crecimiento, pajonal.
5. **Ranking de distritos**: D13, D1 y D2 arriba. Mensaje: el fuego está donde la ciudad sube hacia el parque.
6. Descargar CSV. Cierre: "es análisis histórico, no predicción; una herramienta para la UGR, los bomberos y el SERNAP".

## 6. Checklist antes de entregar
- [ ] Ninguna key en git (`git grep 8da301` no devuelve nada).
- [ ] `isSample` en false en la demo, o la muestra visiblemente marcada como "muestra".
- [ ] Ningún texto dice "N incendios" a partir de focos.
- [ ] Las cifras oficiales llevan su fuente.
- [ ] Colores accesibles en el calendario.
