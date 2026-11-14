// =====================================================================
// Dueño: P3 (Vista)
// Página "Tunari": el mapa 3D se enfoca en la cordillera y los municipios que comparten el parque;
// el panel explica qué se quema y qué dicen las cifras oficiales citadas (otra métrica que los focos).
// Solo afirma lo verificado en la investigación del equipo.
// =====================================================================

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

const FUEL_ORDER = ['pajonal', 'eucalipto', 'pino', 'kewina'];

const CONTENT = {
  es: {
    title: 'El Parque Nacional Tunari',
    lead: 'La cordillera que cierra el valle de Cochabamba. El mapa resalta los municipios que, según el mapa de SERNAP reproducido por CEDIB, comparten el parque; la lista aún no es definitiva.',
    clickHint: 'Haz clic en un municipio del mapa para abrir su ficha.',
    fuelsTitle: 'Qué se quema en el Tunari',
    fuelsLead: 'No todo arde igual. Esto es una referencia cualitativa del equipo, no un modelo del fuego ni una predicción.',
    labelFlammability: 'Inflamabilidad',
    labelRecovery: 'Recuperación',
    factsTitle: 'Lo que dicen las cifras oficiales citadas',
    factsLead: 'Son hectáreas e incidentes reportados: otra métrica distinta de los focos de calor del satélite. No se pueden comparar entre sí.',
    facts: [
      ['Creación', 'Decreto Supremo 6045 del 30 de marzo de 1962; sus límites se ampliaron por la Ley 1262 del 13 de septiembre de 1991. Fuente: compendio normativo de SERNAP.'],
      ['Superficie', 'Unas 300.000 ha según el Tribunal Agroambiental; el PTDI de Sacaba cita unas 328.439 ha. Son dos cifras documentadas distintas.'],
      ['Julio de 2023', '91 ha afectadas, cifra atribuida a la UGR y publicada por Los Tiempos (nota de prensa, no un informe técnico).'],
      ['Julio de 2024', '16 incidentes reportados hasta el 19 de julio, atribuidos a la UGR y publicados por Los Tiempos. No es el total del año.']
    ],
    factsNote: 'No existe, en lo que hemos podido verificar, una serie oficial completa de incidentes y hectáreas del Tunari para 2019–2026.',
    municipalitiesTitle: 'Municipios resaltados',
    municipalitiesNote: 'Lista según un mapa atribuido a SERNAP; otras fuentes incluyen también a Villa Tunari y Colcapirhua.'
  },
  en: {
    title: 'Tunari National Park',
    lead: 'The mountain range that closes the Cochabamba valley. The map highlights the municipalities that, according to the SERNAP map reproduced by CEDIB, share the park; the list is not final yet.',
    clickHint: 'Click a municipality on the map to open its sheet.',
    fuelsTitle: 'What burns in the Tunari',
    fuelsLead: 'Not everything burns the same. This is a qualitative team reference, not a fire model or a forecast.',
    labelFlammability: 'Flammability',
    labelRecovery: 'Recovery',
    factsTitle: 'What the cited official figures say',
    factsLead: 'These are hectares and reported incidents: a different metric from satellite hot spots. They cannot be compared with each other.',
    facts: [
      ['Creation', 'Supreme Decree 6045 of 30 March 1962; its limits were expanded by Law 1262 of 13 September 1991. Source: SERNAP legal compendium.'],
      ['Area', 'About 300,000 ha according to the Agro-environmental Tribunal; the Sacaba PTDI cites about 328,439 ha. Two different documented figures.'],
      ['July 2023', '91 ha affected, a figure attributed to the UGR and published by Los Tiempos (press report, not a technical report).'],
      ['July 2024', '16 incidents reported up to 19 July, attributed to the UGR and published by Los Tiempos. Not the yearly total.']
    ],
    factsNote: 'As far as we could verify, there is no complete official series of Tunari incidents and hectares for 2019–2026.',
    municipalitiesTitle: 'Highlighted municipalities',
    municipalitiesNote: 'List according to a map attributed to SERNAP; other sources also include Villa Tunari and Colcapirhua.'
  }
};

export default function TunariPage(props) {
  const { language, names } = props;
  const content = CONTENT[language] || CONTENT.es;
  const [fuels, setFuels] = useState(null);
  const pageRef = useRef(null);

  useEffect(function loadFuels() {
    let cancelled = false;
    fetch((import.meta.env.BASE_URL || '/') + 'data/combustibles.json')
      .then(function parse(response) {
        return response.ok ? response.json() : null;
      })
      .then(function save(payload) {
        if (!cancelled && payload) {
          setFuels(payload.classes);
        }
      })
      .catch(function ignore() {
        // sin el archivo, la página muestra el resto
      });
    return function cancel() {
      cancelled = true;
    };
  }, []);

  useEffect(function focusTitle() {
    const heading = document.getElementById('tunari-title');
    if (heading) {
      heading.focus({ preventScroll: true });
    }
  }, []);

  useEffect(function animateIn() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !pageRef.current) {
      return undefined;
    }
    const context = gsap.context(function build() {
      gsap.from('.tunari__panel', { x: -60, opacity: 0, duration: 1, ease: 'expo.out', delay: 0.6 });
      gsap.from('.tunari__panel section, .tunari__panel header', { y: 18, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.1, delay: 0.9 });
    }, pageRef);
    return function cleanup() {
      context.revert();
    };
  }, []);

  return (
    <section className="page--tunari" ref={pageRef} aria-labelledby="tunari-title">
      <div className="tunari__panel">
        <header>
          <h1 id="tunari-title" tabIndex={-1}>{content.title}</h1>
          <p className="page__lead">{content.lead}</p>
          <p className="tunari__hint">{content.clickHint}</p>
          {language === 'qu' && <p className="page__notice" lang="es">Explicación larga en español: falta su traducción al quechua.</p>}
        </header>

        <section aria-labelledby="tunari-municipalities">
          <h2 id="tunari-municipalities">{content.municipalitiesTitle}</h2>
          <p className="tunari__names">{names.join(' · ')}</p>
          <p className="muted">{content.municipalitiesNote}</p>
        </section>

        {fuels !== null && (
          <section aria-labelledby="tunari-fuels">
            <h2 id="tunari-fuels">{content.fuelsTitle}</h2>
            <p className="muted">{content.fuelsLead}</p>
            <ul className="fuels">
              {FUEL_ORDER.filter(function present(id) {
                return fuels[id];
              }).map(function fuel(id) {
                const item = fuels[id];
                return (
                  <li key={id}>
                    <i className="fuels__dot" style={{ background: item.color }} aria-hidden="true" />
                    <div>
                      <strong>{item.nombre}</strong>
                      <span className="fuels__meta">
                        {content.labelFlammability}: {item.inflamabilidad} · {content.labelRecovery}: {item.recuperacion}
                      </span>
                      <p lang="es">{item.explicacion}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section aria-labelledby="tunari-facts">
          <h2 id="tunari-facts">{content.factsTitle}</h2>
          <p className="muted">{content.factsLead}</p>
          <dl className="facts">
            {content.facts.map(function fact(pair) {
              return (
                <div key={pair[0]}>
                  <dt>{pair[0]}</dt>
                  <dd>{pair[1]}</dd>
                </div>
              );
            })}
          </dl>
          <p className="muted">{content.factsNote}</p>
        </section>
      </div>
    </section>
  );
}
