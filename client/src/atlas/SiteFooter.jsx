// =====================================================================
// Dueño: P3 (Vista)
// Pie de página con banner: imagen de Cochabamba de noche, banda de textil andino, enlaces y créditos.
// Se usa al final de la portada y de las páginas Método y Calendario.
// =====================================================================

import { IconFlame } from './Icons.jsx';

const BASE = import.meta.env.BASE_URL || '/';

const LINKS = [
  { href: '#/atlas', key: 'navAtlas' },
  { href: '#/tunari', key: 'navTunari' },
  { href: '#/calendario', key: 'navCalendar' },
  { href: '#/metodo', key: 'navMethod' }
];

export default function SiteFooter(props) {
  const { t } = props;
  return (
    <footer className="sitefooter">
      <div
        className="sitefooter__photo"
        style={{ backgroundImage: 'url(' + BASE + 'img/ciudad_noche.webp), linear-gradient(135deg, #1f3d2b, #0e1a14)' }}
        role="img"
        aria-label={t('aiPrefix') + t('capNoche')}
      />
      <div className="sitefooter__shade" aria-hidden="true" />
      <div className="sitefooter__textile" aria-hidden="true" />
      <div className="sitefooter__inner">
        <div className="sitefooter__brand">
          <p className="sitefooter__name"><IconFlame /> {t('title')}</p>
          <p>{t('footerBlurb')}</p>
        </div>
        <nav className="sitefooter__links" aria-label={t('footerExplore')}>
          <h2>{t('footerExplore')}</h2>
          <ul>
            {LINKS.map(function link(item) {
              return <li key={item.href}><a href={item.href}>{t(item.key)}</a></li>;
            })}
          </ul>
        </nav>
        <div className="sitefooter__data">
          <h2>{t('footerSources')}</h2>
          <p>{t('credits')}</p>
        </div>
      </div>
      <p className="sitefooter__made">{t('footerMade')}</p>
    </footer>
  );
}
