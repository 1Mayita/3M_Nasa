---
version: 1
slug: "src-atlas-atlasapp-jsx"
primary_target: "src/atlas/AtlasApp.jsx"
related_targets: []
---

# Surface brief: Atlas 3D de focos de calor (pantalla principal)

Mode: Experience (el artefacto lidera; la interfaz se retira), con ficha municipal de tipo Operate.
Audiencia: jurado del hackathon (3 min de demo), GAMC/UGR/SERNAP, ciudadanía. Acción: elegir un municipio, leer sus focos frente a la mediana, reproducir 2000→2026.
Proof/contenido: 48 polígonos municipales (47 GAM + Raqaypampa), relieve real, focos de la muestra sintética rotulada, capas GAMC de Cercado. Nada de cifras inventadas como reales.
Constraints: laptop modesta; reglas científicas del repo (focos, no incendios; MODIS y VIIRS no se suman; no predicción).
Unresolved: textos finales de P1; datos reales; traducción quechua revisada.

## Direction contract

THESIS: El relieve de Cochabamba es la interfaz: un atlas nocturno en 3D donde los 48 territorios arden según sus focos, y un clic baja del valle al municipio. Rechaza el dashboard de tarjetas con un mapa plano al lado.

OWN-WORLD: Noche sobre el valle. Fondo verde-negro de bosque (#0E1A14), relieve satelital oscurecido, municipios como losas minerales verde pastel (#BFD8C4 → #4F7F63, pino #1F3D2B en sombra) con contorno fino salvia; solo los focos y la intensidad cálida usan ámbar (#E07A2F) con brillo; azul pizarra (#5B7C99) únicamente para El Niño. Tipografía: Young Serif para títulos y nombres de municipio, Hanken Grotesk para datos con numerales tabulares. Interruptor a tema claro crema (#F6F4EC, texto #16251C).

STORY: En cinco segundos se entiende dónde arde Cochabamba y que cada municipio se abre con un clic: focos, mediana del mes, calendario y contexto de El Niño. El visitante cree que es análisis honesto (sensor, muestra y "no es predicción" visibles) y actúa: elige municipio, cambia perfil/idioma, reproduce la línea de tiempo.

FIRST VIEWPORT: Terreno 3D a pantalla completa con los 48 municipios dibujados y una órbita lenta de cámara; título "Observatorio de focos de calor · Cochabamba" arriba a la izquierda en Young Serif; arriba a la derecha selector de perfil (Bombero/UGR, Gestor/SERNAP, Ciudadano) e idioma ES·QU·EN; abajo una barra de tiempo con ▶ (2000→2026) y el aviso honesto "Detecciones satelitales, no incendios confirmados · muestra sintética". Al pasar el cursor, el municipio se eleva y muestra su nombre; al hacer clic, la cámara vuela hacia él y la ficha entra por la derecha. La acción principal es el clic en el mapa.

FORM: Atlas cartográfico nocturno fijado por el usuario con las referencias de Codex 01/02 y el boceto de P2 ("mapa 3D en movimiento donde se vea los municipios... click"), posición en la lista: n/a; seed: none (pinned). Palabras que lo fijan: "colores de árboles, verde pastel" y "un mapa 3D en movimiento donde se vea los municipios... los 47... con click".

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
