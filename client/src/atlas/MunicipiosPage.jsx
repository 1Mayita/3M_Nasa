// =====================================================================
// Dueño: P3 (Vista)
// Página "Municipios": recorrido con scroll. Bienvenida y una escena a pantalla completa por municipio
// (imagen ilustrada con IA, zona, breve descripción). Solo afirma datos geográficos generales y conocidos;
// las cifras de focos por municipio están en el Atlas. Quechua: aviso y texto en español (falta traducción).
// =====================================================================

import { useEffect, useRef, useState } from 'react';
import SiteFooter from './SiteFooter.jsx';
import { IconArrow, IconFlame } from './Icons.jsx';

const BASE = import.meta.env.BASE_URL || '/';

const PLACES = [
  { id: 'cercado', image: 'm_cercado' },
  { id: 'sacaba', image: 'm_sacaba' },
  { id: 'quillacollo', image: 'm_quillacollo' },
  { id: 'tiquipaya', image: 'm_tiquipaya' },
  { id: 'colcapirhua', image: 'm_colcapirhua' },
  { id: 'vinto', image: 'm_vinto' },
  { id: 'sipesipe', image: 'm_sipesipe' },
  { id: 'punata', image: 'm_punata' },
  { id: 'colomi', image: 'm_colomi' },
  { id: 'villatunari', image: 'm_villatunari' }
];

const CONTENT = {
  es: {
    title: 'Bienvenido a Cochabamba',
    qu: 'Allin hamuy Quchapampaman',
    lead: 'Cochabamba tiene 47 municipios, del valle seco al trópico húmedo. Desliza para conocer algunos y luego míralos en el mapa.',
    scroll: 'Desliza',
    imageLabel: 'Ilustración generada con IA: ',
    toAtlas: 'Ver en el atlas',
    indexLabel: 'Ir a un municipio',
    note: 'Descripciones breves y generales. Las imágenes son ilustraciones generadas con IA, no fotografías. Las cifras de focos están en el Atlas.',
    quNotice: 'Textos largos en español: falta su traducción al quechua.',
    endTitle: 'Ahora, el mapa.',
    places: {
      cercado: ['Cercado', 'Valle central', 'La ciudad de Cochabamba, capital del departamento, al pie de la cordillera del Tunari. Aquí están la plaza 14 de Septiembre y el Cristo de la Concordia.'],
      sacaba: ['Sacaba', 'Valle central', 'Ciudad al este de Cercado, en el borde del valle y pegada a las laderas del Tunari. Es una de las puertas hacia el Chapare.'],
      quillacollo: ['Quillacollo', 'Valle central', 'Al oeste de Cercado. Cada agosto recibe a miles de personas en la fiesta de la Virgen de Urkupiña.'],
      tiquipaya: ['Tiquipaya', 'Valle central', 'Al noroeste de la ciudad, entre huertos y flores, con la cordillera del Tunari como telón de fondo.'],
      colcapirhua: ['Colcapirhua', 'Valle central', 'Un municipio pequeño y muy urbanizado, entre Cercado y Quillacollo.'],
      vinto: ['Vinto', 'Valle central', 'Entre Quillacollo y Sipe Sipe, donde el valle se abre a campos de cultivo y al río.'],
      sipesipe: ['Sipe Sipe', 'Valle central', 'Hacia el extremo oeste del valle central, con un paisaje más rural de cultivos y cerros secos.'],
      punata: ['Punata', 'Valle Alto', 'En el Valle Alto, al sureste de la ciudad: pueblo de mercado rodeado de campos de maíz.'],
      colomi: ['Colomi', 'Camino al trópico', 'Paso de montaña entre el valle y el Chapare, con bosque nuboso y neblina.'],
      villatunari: ['Villa Tunari', 'Trópico del Chapare', 'Puerta del trópico: selva, ríos anchos y un clima húmedo muy distinto al del valle.']
    }
  },
  en: {
    title: 'Welcome to Cochabamba',
    qu: 'Allin hamuy Quchapampaman',
    lead: 'Cochabamba has 47 municipalities, from the dry valley to the humid tropics. Scroll to meet some of them, then see them on the map.',
    scroll: 'Scroll',
    imageLabel: 'AI-generated illustration: ',
    toAtlas: 'See it on the atlas',
    indexLabel: 'Jump to a municipality',
    note: 'Short, general descriptions. Images are AI-generated illustrations, not photographs. Hot-spot figures are in the Atlas.',
    quNotice: '',
    endTitle: 'Now, the map.',
    places: {
      cercado: ['Cercado', 'Central valley', 'The city of Cochabamba, capital of the department, at the foot of the Tunari range. Home to the 14 de Septiembre plaza and the Christ of Concord.'],
      sacaba: ['Sacaba', 'Central valley', 'A city east of Cercado, on the edge of the valley and right up against the slopes of the Tunari. One of the gateways to the Chapare.'],
      quillacollo: ['Quillacollo', 'Central valley', 'West of Cercado. Every August it welcomes thousands of people for the festival of the Virgin of Urkupiña.'],
      tiquipaya: ['Tiquipaya', 'Central valley', 'Northwest of the city, among gardens and flowers, with the Tunari range as a backdrop.'],
      colcapirhua: ['Colcapirhua', 'Central valley', 'A small, highly urbanized municipality between Cercado and Quillacollo.'],
      vinto: ['Vinto', 'Central valley', 'Between Quillacollo and Sipe Sipe, where the valley opens onto farmland and the river.'],
      sipesipe: ['Sipe Sipe', 'Central valley', 'Toward the western end of the central valley, with a more rural landscape of crops and dry hills.'],
      punata: ['Punata', 'Valle Alto', 'In the Valle Alto, southeast of the city: a market town surrounded by cornfields.'],
      colomi: ['Colomi', 'Road to the tropics', 'A mountain pass between the valley and the Chapare, with cloud forest and mist.'],
      villatunari: ['Villa Tunari', 'Chapare tropics', 'Gateway to the tropics: jungle, wide rivers and a humid climate very different from the valley.']
    }
  }
};

export default function MunicipiosPage(props) {
  const { language, t } = props;
  const content = language === 'en' ? CONTENT.en : CONTENT.es;
  const pageRef = useRef(null);
  const sceneRefs = useRef([]);
  const [active, setActive] = useState(-1);

  useEffect(function focusTitle() {
    const heading = document.getElementById('municipios-title');
    if (heading) {
      heading.focus({ preventScroll: true });
    }
  }, []);

  // Cada escena se revela y solo anima su foto mientras está en pantalla (ahorra GPU)
  useEffect(function observe() {
    const root = pageRef.current;
    if (!root || typeof IntersectionObserver === 'undefined') {
      sceneRefs.current.forEach(function show(el) { if (el) { el.classList.add('is-in', 'is-live'); } });
      return undefined;
    }
    const observer = new IntersectionObserver(
      function onIntersect(entries) {
        entries.forEach(function check(entry) {
          entry.target.classList.toggle('is-live', entry.isIntersecting);
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            if (entry.intersectionRatio > 0.5) {
              setActive(Number.parseInt(entry.target.getAttribute('data-index'), 10));
            }
          }
        });
      },
      { root: root, threshold: [0.15, 0.55] }
    );
    sceneRefs.current.forEach(function watch(el) { if (el) { observer.observe(el); } });
    return function cleanup() { observer.disconnect(); };
  }, []);

  function jump(index) {
    const el = sceneRefs.current[index];
    if (el) {
      el.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function register(index) {
    return function set(el) { sceneRefs.current[index] = el; };
  }

  return (
    <section className="page page--places" ref={pageRef} aria-labelledby="municipios-title">
      <div className="places__welcome places__scene" data-index="-1" ref={register(PLACES.length + 2)}>
        <div className="places__welcome-inner">
          <p className="places__qu" lang="qu">{content.qu}</p>
          <h1 id="municipios-title" tabIndex={-1}>{content.title}</h1>
          <p className="page__lead">{content.lead}</p>
          {language === 'qu' && <p className="page__notice" lang="es">Textos largos en español: falta su traducción al quechua.</p>}
          <nav className="places__index" aria-label={content.indexLabel}>
            {PLACES.map(function chip(place, i) {
              return (
                <button type="button" key={place.id} onClick={function go() { jump(i); }}>
                  {content.places[place.id][0]}
                </button>
              );
            })}
          </nav>
        </div>
        <button type="button" className="story__scroll" onClick={function next() { jump(0); }} aria-label={content.scroll}>
          <span>{content.scroll}</span>
          <i aria-hidden="true" />
        </button>
      </div>

      {PLACES.map(function scene(place, i) {
        const info = content.places[place.id];
        return (
          <article
            className={'places__scene places__place' + (i % 2 ? ' is-flip' : '')}
            key={place.id}
            data-index={i}
            ref={register(i)}
            aria-label={info[0]}
          >
            <img
              className="places__photo"
              src={BASE + 'img/' + place.image + '.webp'}
              alt={content.imageLabel + info[0] + ', ' + info[1]}
              loading="lazy"
              decoding="async"
              width="1600"
              height="1000"
            />
            <div className="places__shade" aria-hidden="true" />
            <div className="places__card">
              <p className="places__zone">{String(i + 1).padStart(2, '0')} · {info[1]}</p>
              <h2>{info[0]}</h2>
              <p>{info[2]}</p>
              <a className="btn btn--secondary" href="#/atlas"><IconFlame /> {content.toAtlas}</a>
            </div>
          </article>
        );
      })}

      <div className="places__end places__scene" data-index={PLACES.length} ref={register(PLACES.length + 1)}>
        <h2>{content.endTitle}</h2>
        <a className="hero__cta" href="#/atlas">
          <IconFlame />
          <span>{t('heroCta')}</span>
          <IconArrow />
        </a>
        <p className="places__note">{content.note}</p>
      </div>

      <ol className="places__dots" aria-label={content.indexLabel}>
        {PLACES.map(function dot(place, i) {
          return (
            <li key={place.id}>
              <button type="button" onClick={function go() { jump(i); }} aria-label={content.places[place.id][0]} aria-current={active === i ? 'step' : undefined} />
            </li>
          );
        })}
      </ol>

      <SiteFooter t={t} />
    </section>
  );
}
