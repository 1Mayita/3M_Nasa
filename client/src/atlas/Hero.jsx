// =====================================================================
// Dueño: P3 (Vista)
// Portada con historia que se recorre con scroll (inspirada en los sitios de estudio de la referencia):
// pantalla de entrada con el mapa 3D, una escena de identidad (Cochabamba / Quchapampa) con imagen a
// pantalla completa, cuatro escenas de tipografía grande y un cierre. La cámara del mapa cambia con cada escena.
// Las imágenes son ilustraciones generadas con IA y se rotulan en los créditos.
// =====================================================================

import { forwardRef, useEffect, useRef } from 'react';
import { IconArrow, IconCalendar, IconFlame, IconInfo, IconPeak } from './Icons.jsx';

const BASE = import.meta.env.BASE_URL || '/';
const IMAGE_VALLEY = BASE + 'img/cochabamba_valle.webp';
const IMAGE_CRISTO = BASE + 'img/cristo_concordia.webp';

const MAP_SCENES = [
  { id: 'where', title: 'storyWhereTitle', text: 'storyWhereText', href: '#/atlas', cta: 'storyWhereCta', Icon: IconFlame },
  { id: 'tunari', title: 'storyTunariTitle', text: 'storyTunariText', href: '#/tunari', cta: 'heroTunari', Icon: IconPeak },
  { id: 'when', title: 'storyWhenTitle', text: 'storyWhenText', href: '#/calendario', cta: 'heroCalendar', Icon: IconCalendar },
  { id: 'how', title: 'storyHowTitle', text: 'storyHowText', href: '#/metodo', cta: 'heroMethod', Icon: IconInfo }
];

// pasos: 0 portada · 1 identidad · 2 dónde · 3 Tunari · 4 cuándo · 5 cómo · 6 cierre
export const STORY_STEPS = MAP_SCENES.length + 3;

const Hero = forwardRef(function Hero(props, ref) {
  const { t, onEnter, isReady, onStep, step } = props;
  const sectionRefs = useRef([]);

  // Cada escena avisa cuando ocupa la pantalla: sirve para mover la cámara del mapa y revelar el texto
  useEffect(function observeScenes() {
    const container = ref && ref.current;
    if (!container || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }
    const observer = new IntersectionObserver(
      function onIntersect(entries) {
        entries.forEach(function check(entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            const index = Number.parseInt(entry.target.getAttribute('data-step'), 10);
            if (entry.intersectionRatio > 0.5 && onStep) {
              onStep(index);
            }
          }
        });
      },
      { root: container, threshold: [0.25, 0.55] }
    );
    sectionRefs.current.forEach(function watch(element) {
      if (element) {
        observer.observe(element);
      }
    });
    return function cleanup() {
      observer.disconnect();
    };
  }, [ref, onStep]);

  function goToStep(index) {
    const element = sectionRefs.current[index];
    if (element) {
      element.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function register(index) {
    return function set(element) {
      sectionRefs.current[index] = element;
    };
  }

  return (
    <section className="hero" ref={ref} aria-labelledby="hero-title">
      <div className="hero__screen story__scene" data-step="0" ref={register(0)}>
        <div className="hero__content">
          <h1 id="hero-title" className="hero__title">
            {t('title')}
          </h1>
          <p className="hero__subtitle">{t('subtitle')}</p>
          <p className="hero__lead">{t('heroLead')}</p>
          <div className="hero__actions">
            <button type="button" className="hero__cta" onClick={onEnter} disabled={!isReady}>
              <IconFlame />
              <span>{isReady ? t('heroCta') : t('loading')}</span>
              <IconArrow />
            </button>
            <a className="btn btn--secondary" href="#/tunari"><IconPeak /> {t('heroTunari')}</a>
            <a className="btn btn--secondary" href="#/calendario"><IconCalendar /> {t('heroCalendar')}</a>
            <a className="btn btn--secondary" href="#/metodo"><IconInfo /> {t('heroMethod')}</a>
          </div>
          <ul className="hero__facts">
            <li>{t('heroFact1')}</li>
            <li>{t('heroFact2')}</li>
            <li>{t('heroFact3')}</li>
          </ul>
          <p className="hero__honest">
            <IconPeak /> {t('honest')}
          </p>
        </div>
        <button type="button" className="story__scroll" onClick={function next() { goToStep(1); }} aria-label={t('storyScroll')}>
          <span>{t('storyScroll')}</span>
          <i aria-hidden="true" />
        </button>
      </div>

      <div
        className="story__scene story__block story__identity story__photo"
        data-step="1"
        ref={register(1)}
        style={{ '--photo': 'url(' + IMAGE_VALLEY + ')' }}
        role="img"
        aria-label={t('imgValley')}
      >
        <div className="story__inner">
          <p className="story__mega">{t('identityName')}</p>
          <p className="story__qu" lang="qu">{t('identityQu')}</p>
          <p className="story__text">{t('identityText')}</p>
        </div>
        <div className="story__textile" aria-hidden="true" />
      </div>

      {MAP_SCENES.map(function scene(item, i) {
        return (
          <div className="story__scene story__block" key={item.id} data-step={i + 2} ref={register(i + 2)}>
            <div className="story__inner">
              <h2 className="story__title">{t(item.title)}</h2>
              <p className="story__text">{t(item.text)}</p>
              <a className="btn btn--secondary" href={item.href}><item.Icon /> {t(item.cta)}</a>
            </div>
          </div>
        );
      })}

      <div
        className="story__scene story__block story__end story__photo"
        data-step={MAP_SCENES.length + 2}
        ref={register(MAP_SCENES.length + 2)}
        style={{ '--photo': 'url(' + IMAGE_CRISTO + ')' }}
        role="img"
        aria-label={t('imgCristo')}
      >
        <div className="story__inner">
          <h2 className="story__title">{t('storyEndTitle')}</h2>
          <button type="button" className="hero__cta" onClick={onEnter} disabled={!isReady}>
            <IconFlame />
            <span>{t('heroCta')}</span>
            <IconArrow />
          </button>
        </div>
        <div className="story__textile" aria-hidden="true" />
      </div>

      <ol className="story__dots" aria-label={t('storyScroll')}>
        {Array.from({ length: STORY_STEPS }).map(function dot(unused, i) {
          return (
            <li key={i}>
              <button type="button" onClick={function jump() { goToStep(i); }} aria-label={String(i + 1)} aria-current={step === i ? 'step' : undefined} />
            </li>
          );
        })}
      </ol>
    </section>
  );
});

export default Hero;
