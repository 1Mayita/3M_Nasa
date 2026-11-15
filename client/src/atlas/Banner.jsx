// =====================================================================
// Dueño: P3 (Vista)
// Banner de página: imagen de Cochabamba con movimiento lento (Ken Burns) y paralaje al hacer scroll,
// degradado para leer el título y una banda de textil andino como divisor.
// Las imágenes son ilustraciones generadas con IA y se rotulan.
// =====================================================================

import { useEffect, useRef } from 'react';
import Textile from './Textile.jsx';

export default function Banner(props) {
  const { image, children, label } = props;
  const bannerRef = useRef(null);

  // paralaje: la imagen baja más despacio que el contenido
  useEffect(function parallax() {
    const banner = bannerRef.current;
    if (!banner || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return undefined;
    }
    const scroller = banner.closest('.page');
    if (!scroller) {
      return undefined;
    }
    let frame = 0;
    function onScroll() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(function update() {
        banner.style.setProperty('--py', Math.min(scroller.scrollTop * 0.32, 260) + 'px');
      });
    }
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return function cleanup() {
      cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', onScroll);
    };
  }, []);

  return (
    <header className="banner" ref={bannerRef}>
      <div className="banner__parallax">
        <div className="banner__img" style={{ backgroundImage: 'url(' + image + '), linear-gradient(135deg, #1f3d2b, #0e1a14)' }} role="img" aria-label={label} />
      </div>
      <div className="banner__shade" aria-hidden="true" />
      <div className="banner__content">{children}</div>
      <Textile className="banner__textile" />
    </header>
  );
}
