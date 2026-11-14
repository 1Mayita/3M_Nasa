// =====================================================================
// Dueño: P3 (Vista)
// Página "Método": qué se mide, cómo se armonizan MODIS y VIIRS, qué no se puede decir y fuentes.
// Solo afirma lo que está verificado en la investigación del equipo.
// =====================================================================

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

const CONTENT = {
  es: {
    title: 'Cómo se construyó este atlas',
    lead: 'Un foco de calor es un píxel que un satélite vio más caliente de lo normal. No es un incendio confirmado. Esta página explica qué se muestra, cómo se juntan dos satélites y qué límites tiene.',
    sections: [
      {
        heading: 'Dos satélites, una sola serie',
        paragraphs: [
          'MODIS (desde el año 2000) ve píxeles de unos 1 km. VIIRS (desde 2012) ve píxeles de 375 m, así que detecta fuegos más pequeños. Por eso sus conteos no se pueden comparar a ojo ni sumar.',
          'El atlas expresa todo en “detecciones equivalentes a VIIRS”: antes de 2012 se escala MODIS con un factor mensual calibrado en los años en que ambos sensores coincidieron; después se usa VIIRS. MODIS y VIIRS del mismo período nunca se suman, porque se contaría dos veces el mismo fuego.',
          'El satélite Suomi NPP dejó de entregar datos el 2 de noviembre de 2026, según el aviso oficial de NOAA. Después de esa fecha la serie se apoya en NOAA-20, calibrado contra S-NPP en el período en que ambos coincidieron.'
        ]
      },
      {
        heading: 'Qué se filtra',
        paragraphs: [
          'Se conservan las detecciones MODIS con confianza de 30 o más y las VIIRS de confianza nominal o alta. Si el dato trae el tipo de fuente, solo se usan las de vegetación presunta.',
          'Aun así, que no haya detecciones no prueba que no hubo fuego: las nubes, el humo denso y la hora de paso del satélite pueden impedir verlo.'
        ]
      },
      {
        heading: 'Qué no se puede decir con estos datos',
        paragraphs: [
          'Los focos no son incendios contados, ni hectáreas quemadas, ni la causa de un fuego. No es una predicción: es análisis histórico y comparación con la mediana del mismo mes.',
          'El fenómeno de El Niño se muestra solo como contexto. En el altiplano suele asociarse a condiciones más cálidas y secas, pero no hay evidencia local que cuantifique su efecto sobre los focos en Cochabamba.'
        ]
      },
      {
        heading: 'Estado de los datos en esta versión',
        paragraphs: [
          'Las cifras que ves ahora son una muestra sintética para probar el diseño, y se rotulan así en toda la interfaz. Cuando el equipo de datos entregue la serie real, el atlas la usa sin cambiar el diseño.'
        ]
      }
    ],
    sourcesTitle: 'Fuentes y licencias',
    sources: [
      ['Focos de calor', 'NASA FIRMS (MODIS y VIIRS)'],
      ['Contexto de El Niño', 'Índice ONI, NOAA Climate Prediction Center'],
      ['Límites municipales', 'Lab TecnoSocial 2024, licencia CC BY 4.0 (compilación no oficial del Estado)'],
      ['Relieve', 'AWS Terrain Tiles'],
      ['Imagen satelital', 'Esri, Maxar, Earthstar Geographics'],
      ['Capas de la Alcaldía', 'GAMC, a través del servidor del proyecto (próximamente en el atlas)']
    ]
  },
  en: {
    title: 'How this atlas was built',
    lead: 'A hot spot is a pixel a satellite saw hotter than usual. It is not a confirmed fire. This page explains what is shown, how two satellites are combined and what the limits are.',
    sections: [
      {
        heading: 'Two satellites, one series',
        paragraphs: [
          'MODIS (since 2000) sees pixels of about 1 km. VIIRS (since 2012) sees 375 m pixels, so it detects smaller fires. That is why their counts cannot be compared by eye or added together.',
          'The atlas expresses everything as “VIIRS-equivalent detections”: before 2012 MODIS is scaled by a monthly factor calibrated in the years both sensors overlapped; afterwards VIIRS is used. MODIS and VIIRS for the same period are never added, because the same fire would be counted twice.',
          'The Suomi NPP satellite stopped delivering data on 2 November 2026, according to the official NOAA notice. After that date the series relies on NOAA-20, calibrated against S-NPP over the period when both overlapped.'
        ]
      },
      {
        heading: 'What is filtered',
        paragraphs: [
          'MODIS detections with confidence of 30 or more and VIIRS detections of nominal or high confidence are kept. When the record carries a source type, only presumed vegetation fires are used.',
          'Even so, no detections does not prove there was no fire: clouds, dense smoke and the satellite pass time can prevent it from being seen.'
        ]
      },
      {
        heading: 'What these data cannot say',
        paragraphs: [
          'Hot spots are not counted fires, burned hectares or the cause of a fire. This is not a forecast: it is historical analysis and a comparison with the median of the same month.',
          'El Niño is shown only as context. In the Altiplano it is usually associated with warmer, drier conditions, but there is no local evidence quantifying its effect on hot spots in Cochabamba.'
        ]
      },
      {
        heading: 'State of the data in this version',
        paragraphs: [
          'The figures you see now are a synthetic sample used to test the design, and they are labelled as such across the interface. When the data team delivers the real series, the atlas uses it without changing the design.'
        ]
      }
    ],
    sourcesTitle: 'Sources and licenses',
    sources: [
      ['Hot spots', 'NASA FIRMS (MODIS and VIIRS)'],
      ['El Niño context', 'ONI index, NOAA Climate Prediction Center'],
      ['Municipal boundaries', 'Lab TecnoSocial 2024, CC BY 4.0 license (compilation, not an official State release)'],
      ['Terrain', 'AWS Terrain Tiles'],
      ['Satellite imagery', 'Esri, Maxar, Earthstar Geographics'],
      ['Municipal layers', 'GAMC, through the project server (coming soon to the atlas)']
    ]
  }
};

export default function MethodPage(props) {
  const { language, isSample } = props;
  const content = CONTENT[language] || CONTENT.es;
  const realDataNote = language === 'en'
    ? 'The figures shown come from the harmonized series delivered by the data team. Hot spots remain satellite detections, not confirmed fires.'
    : 'Las cifras que ves provienen de la serie armonizada entregada por el equipo de datos. Siguen siendo detecciones satelitales, no incendios confirmados.';
  const pageRef = useRef(null);

  useEffect(function focusTitle() {
    const heading = document.getElementById('method-title');
    if (heading) {
      heading.focus({ preventScroll: true });
    }
  }, []);

  useEffect(function animateIn() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !pageRef.current) {
      return undefined;
    }
    const context = gsap.context(function build() {
      gsap.from('.method__head > *', { y: 26, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.1, delay: 0.55 });
      gsap.from('.method__section', { y: 28, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.12, delay: 0.8 });
    }, pageRef);
    return function cleanup() {
      context.revert();
    };
  }, []);

  return (
    <section className="page page--method" ref={pageRef} aria-labelledby="method-title">
      <div className="page__inner page__inner--narrow">
        <header className="method__head">
          <h1 id="method-title" tabIndex={-1}>{content.title}</h1>
          <p className="page__lead">{content.lead}</p>
        </header>
        {content.sections.map(function section(item, index) {
          const isDataSection = index === content.sections.length - 1;
          return (
            <article className="method__section" key={item.heading}>
              <h2>{item.heading}</h2>
              {item.paragraphs.map(function paragraph(text, i) {
                return <p key={i}>{isDataSection && !isSample ? realDataNote : text}</p>;
              })}
            </article>
          );
        })}
        <article className="method__section method__sources">
          <h2>{content.sourcesTitle}</h2>
          <dl>
            {content.sources.map(function source(pair) {
              return (
                <div key={pair[0]}>
                  <dt>{pair[0]}</dt>
                  <dd>{pair[1]}</dd>
                </div>
              );
            })}
          </dl>
        </article>
      </div>
    </section>
  );
}
