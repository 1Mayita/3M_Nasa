# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
React 18 + Vite 5 (existente, `client/`), Leaflet/react-leaflet en la vista actual, deck.gl 9 para la vista 3D. Despliegue previsto: Firebase Hosting. La Vista solo habla con el servidor del equipo (la clave de la API de la Alcaldía vive en el servidor, nunca en el navegador ni en git).

## Users
- **Jurado del NASA Space Apps Challenge 2026** (primera impresión, evalúa en pocos minutos una demo de 3 minutos).
- **Alcaldía de Cochabamba (GAMC), UGR, bomberos forestales y SERNAP**: deciden dónde vigilar y prevenir; leen focos por municipio, comparan el mes con la mediana y revisan el contexto histórico.
- **Ciudadanía** (perfil simple): temporada de riesgo, qué hacer si ve humo. Hablantes de español, quechua e inglés.

## Product Purpose
Panel web del reto *Harmonization of MODIS and VIIRS Hot Spots*: muestra los focos de calor (detecciones satelitales armonizadas de MODIS y VIIRS, datos NASA FIRMS) del departamento de Cochabamba, con el Parque Nacional Tunari y los 47 municipios (más el territorio indígena Raqaypampa como unidad aparte), y el detalle de Cercado con las capas de la Alcaldía. Éxito: ganar el hackathon y que la Alcaldía/UGR lo pueda usar para decidir dónde vigilar esta semana.

## Positioning
Es un atlas 3D del relieve de Cochabamba donde el fuego se lee sobre la montaña (el Tunari sobre la ciudad), por municipio, con la armonización MODIS+VIIRS explicada y las capas oficiales de la Alcaldía conectadas. Un equipo sin acceso a la API del GAMC y sin el relieve como protagonista no podría decir lo mismo.

## Operating Context
Demo en vivo de 3 minutos ante jurado y entrega mañana (15/11/2026). Equipo de 3: P1 Modelo (datos), P2 Controlador (API), P3 Vista (este directorio, diseño). Laptop modesta (Intel Iris Xe, 12 GB): el 3D debe ser fluido. Datos de muestra sintéticos hasta que P1 entregue `data/processed/`.

## Capabilities and Constraints
- Reglas científicas del repo: decir "focos" o "detecciones", nunca "incendios" contados; nunca sumar MODIS + VIIRS; nada es predicción (análisis histórico); El Niño solo como contexto histórico, sin causalidad.
- Datos de muestra se rotulan "muestra (sintética)" siempre que se vean.
- Vista 3D: relieve AWS Terrain + imagen Esri (créditos obligatorios en pantalla). Límites municipales: compilado Lab TecnoSocial 2024 (CC BY 4.0, no oficial), 48 unidades (47 GAM + TIOC Raqaypampa); citar fuente.
- API del GAMC: solo Cercado; capas Periurbanos, Cota 2750 y Límite Distritos (WMS vía servidor).
- Perfiles sin login: Bombero/UGR, Gestor/SERNAP, Ciudadano. Idiomas ES / QU / EN (textos en quechua los revisa una persona hablante).
- Sin definir: textos finales de P1, cifras oficiales de hectáreas (UGR/SERNAP), serie real de focos.

## Brand Commitments
- Nombre de trabajo: "Calendario de Fuego · Cochabamba" / "Observatorio de focos de calor".
- **Paleta fijada por el usuario**: verdes de bosque y pastel (pino, eucalipto, salvia, menta, musgo); ámbar reservado a los focos de calor; azul pizarra para El Niño. Tema oscuro de noche como principal, con interruptor a claro.
- Referencias visuales aprobadas: `D:\Investigacion_SpaceApps\referencias_diseno\` (01–05).
- No usar logos de NASA ni del municipio.

## Evidence on Hand
- Investigación: `D:\Investigacion_SpaceApps\INVESTIGACION_3M_NASA.md` y `LEEME_EQUIPO.md`.
- Municipios Cochabamba (GeoJSON, 48 unidades) y kit base `vista3d` (`Fire3DMap.jsx`).
- No hay serie real de focos todavía ni cifras oficiales verificadas: no inventar.

## Product Principles
1. El relieve es la historia: la montaña y el fuego se ven juntos, en movimiento.
2. Honestidad visible: sensor, unidad, muestra vs real y "no es predicción" siempre a la vista.
3. Un clic lleva del mapa al municipio: de lo regional a lo accionable en una interacción.
4. Cada perfil ve primero lo que necesita decidir.
5. Fluido en equipo modesto; si el 3D falla, el mapa normal sigue funcionando.

## Accessibility & Inclusion
Escala de color accesible (daltonismo) en calendario y focos; contraste AA en ambos temas; control por teclado; respetar `prefers-reduced-motion`; textos en español, quechua e inglés.
