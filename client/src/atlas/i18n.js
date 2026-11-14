// =====================================================================
// Dueño: P3 (Vista) — textos de la interfaz del atlas.
// ES y EN completos. QU (quechua): SIN traducir a propósito; la revisa una persona
// hablante (textos de P1 en docs/textos_i18n.md). Mientras tanto cae a español.
// =====================================================================

export const LANGUAGES = ['es', 'qu', 'en'];

const TEXTS = {
  es: {
    title: 'Observatorio de focos de calor',
    subtitle: 'Cochabamba · Parque Nacional Tunari · 47 municipios',
    profile: 'Perfil',
    profiles: { bombero: 'Bombero / UGR', gestor: 'Gestor / SERNAP', ciudadano: 'Ciudadano' },
    language: 'Idioma',
    quNotice: 'Traducción al quechua en revisión: se muestra en español.',
    theme: 'Tema',
    themeDark: 'Oscuro',
    themeLight: 'Claro',
    honest: 'Detecciones satelitales, no incendios confirmados. Análisis histórico, no predicción.',
    sample: 'Muestra sintética',
    sampleLong: 'Datos de muestra sintéticos: no usar para conclusiones.',
    loading: 'Cargando relieve y municipios…',
    loadError: 'No se pudo cargar el atlas',
    municipalities: 'Municipios',
    searchMunicipality: 'Buscar municipio',
    chooseMunicipality: 'Elige un municipio…',
    topNow: 'Con más focos en este período',
    topNowBombero: 'Zonas con más focos ahora',
    rotate: 'Girar la cámara',
    rotateStop: 'Detener giro',
    accumulated: 'Acumulado',
    monthly: 'Mes a mes',
    play: 'Reproducir',
    pause: 'Pausar',
    month: 'Mes',
    detections: 'detecciones',
    detectionsOne: 'detección',
    legendLow: 'menos',
    legendHigh: 'más',
    legendTitle: 'Focos por municipio',
    close: 'Cerrar',
    province: 'Provincia',
    area: 'Superficie',
    nameTiocNote: 'Territorio indígena originario campesino, unidad aparte de Mizque.',
    sensorNote: 'Serie armonizada, equivalente VIIRS. MODIS y VIIRS nunca se suman.',
    periodTotal: 'En todo el período',
    thisMonth: 'En {month}',
    vsMedian: 'La mediana de ese mes en años anteriores es {median} ({years} años).',
    aboveMedian: '{pct} % por encima de la mediana',
    belowMedian: '{pct} % por debajo de la mediana',
    atMedian: 'Igual que la mediana',
    noMedian: 'Sin años anteriores para comparar',
    medianZero: 'La mediana de ese mes es 0: no se puede calcular un porcentaje',
    calendarTitle: 'Calendario de actividad',
    calendarHelp: 'Cada casilla es un mes; el color indica la cantidad de detecciones.',
    elNinoTitle: 'El Niño, solo contexto',
    elNinoText: 'Los años de El Niño suelen traer condiciones más cálidas y secas en la región. Se muestra como contexto histórico: no demuestra que cause más focos.',
    download: 'Descargar CSV',
    citizenTitle: 'Si ves humo o fuego',
    citizenText: 'Aléjate, no intentes apagarlo y avisa de inmediato a los bomberos o a la UGR de tu municipio. Evita hacer fuego en la temporada seca.',
    seasonTitle: 'Temporada de riesgo',
    seasonText: 'En los datos de esta muestra, los meses con más detecciones van de julio a octubre. La noche de San Juan (23 de junio) suele aumentar las quemas.',
    clickHint: 'Haz clic en un municipio',
    credits: 'Focos: NASA FIRMS · Relieve: AWS Terrain Tiles · Imagen: Esri, Maxar, Earthstar Geographics · Límites: Lab TecnoSocial 2024 (CC BY 4.0)',
    classic: 'Calendario clásico'
  },
  en: {
    title: 'Hot spot observatory',
    subtitle: 'Cochabamba · Tunari National Park · 47 municipalities',
    profile: 'Profile',
    profiles: { bombero: 'Firefighter / UGR', gestor: 'Manager / SERNAP', ciudadano: 'Citizen' },
    language: 'Language',
    quNotice: 'Quechua translation under review: shown in Spanish.',
    theme: 'Theme',
    themeDark: 'Dark',
    themeLight: 'Light',
    honest: 'Satellite detections, not confirmed fires. Historical analysis, not a forecast.',
    sample: 'Synthetic sample',
    sampleLong: 'Synthetic sample data: do not use for conclusions.',
    loading: 'Loading terrain and municipalities…',
    loadError: 'The atlas could not be loaded',
    municipalities: 'Municipalities',
    searchMunicipality: 'Find a municipality',
    chooseMunicipality: 'Choose a municipality…',
    topNow: 'Most detections in this period',
    topNowBombero: 'Zones with most detections now',
    rotate: 'Rotate the camera',
    rotateStop: 'Stop rotation',
    accumulated: 'Accumulated',
    monthly: 'Month by month',
    play: 'Play',
    pause: 'Pause',
    month: 'Month',
    detections: 'detections',
    detectionsOne: 'detection',
    legendLow: 'fewer',
    legendHigh: 'more',
    legendTitle: 'Detections per municipality',
    close: 'Close',
    province: 'Province',
    area: 'Area',
    nameTiocNote: 'Indigenous territory, separate from Mizque.',
    sensorNote: 'Harmonized series, VIIRS-equivalent. MODIS and VIIRS are never added together.',
    periodTotal: 'Over the whole period',
    thisMonth: 'In {month}',
    vsMedian: 'The median for that month in previous years is {median} ({years} years).',
    aboveMedian: '{pct} % above the median',
    belowMedian: '{pct} % below the median',
    atMedian: 'Same as the median',
    noMedian: 'No earlier years to compare',
    medianZero: 'The median for that month is 0: a percentage cannot be calculated',
    calendarTitle: 'Activity calendar',
    calendarHelp: 'Each square is a month; color shows the number of detections.',
    elNinoTitle: 'El Niño, context only',
    elNinoText: 'El Niño years tend to bring warmer, drier conditions in the region. It is shown as historical context: it does not prove it causes more hot spots.',
    download: 'Download CSV',
    citizenTitle: 'If you see smoke or fire',
    citizenText: 'Move away, do not try to put it out, and notify the fire brigade or your municipality UGR immediately. Avoid lighting fires in the dry season.',
    seasonTitle: 'Risk season',
    seasonText: 'In this sample, the months with the most detections run from July to October. Saint John’s night (June 23) usually increases burning.',
    clickHint: 'Click a municipality',
    credits: 'Hot spots: NASA FIRMS · Terrain: AWS Terrain Tiles · Imagery: Esri, Maxar, Earthstar Geographics · Boundaries: Lab TecnoSocial 2024 (CC BY 4.0)',
    classic: 'Classic calendar'
  },
  qu: {}
};

export function makeTranslator(language) {
  const table = TEXTS[language] || {};
  const fallback = TEXTS.es;
  return function translate(key, values) {
    let text = table[key];
    if (text === undefined) {
      text = fallback[key];
    }
    if (values && typeof text === 'string') {
      Object.keys(values).forEach(function replace(name) {
        text = text.replace('{' + name + '}', values[name]);
      });
    }
    return text;
  };
}

export function profileName(language, profile) {
  const table = TEXTS[language] && TEXTS[language].profiles ? TEXTS[language].profiles : TEXTS.es.profiles;
  return table[profile];
}

export const MONTH_NAMES = {
  es: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
  en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
};

export function formatMonth(language, monthText) {
  if (!monthText) {
    return '';
  }
  const names = MONTH_NAMES[language] || MONTH_NAMES.es;
  return names[Number.parseInt(monthText.slice(5, 7), 10) - 1] + ' ' + monthText.slice(0, 4);
}
