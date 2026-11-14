// =====================================================================
// Dueño: P3 (Vista)
// Portada: el título domina sobre el relieve que gira detrás; un solo botón entra al atlas.
// =====================================================================

import { forwardRef } from 'react';
import { IconFlame, IconPeak } from './Icons.jsx';

const Hero = forwardRef(function Hero(props, ref) {
  const { t, onEnter, isReady } = props;
  return (
    <section className="hero" ref={ref} aria-labelledby="hero-title">
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
          </button>
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
    </section>
  );
});

export default Hero;
