// =====================================================================
// Dueño: P3 (Vista)
// Franja de textil andino que se desplaza en bucle hacia la izquierda.
// Solo usa transform (capa propia, sin repintar). Se pausa fuera de pantalla y con la pestaña oculta
// (clase is-live puesta por un único IntersectionObserver compartido); sin movimiento si el usuario lo pide.
// =====================================================================

import { useEffect, useRef } from 'react';

let sharedObserver = null;
let visibilityBound = false;

function observer() {
  if (sharedObserver === null && typeof IntersectionObserver !== 'undefined') {
    sharedObserver = new IntersectionObserver(
      function onChange(entries) {
        entries.forEach(function toggle(entry) {
          entry.target.classList.toggle('is-live', entry.isIntersecting);
        });
      },
      { rootMargin: '48px' }
    );
  }
  return sharedObserver;
}

function bindVisibility() {
  if (visibilityBound || typeof document === 'undefined') {
    return;
  }
  visibilityBound = true;
  document.addEventListener('visibilitychange', function sync() {
    document.documentElement.classList.toggle('is-tab-hidden', document.hidden);
  });
}

export default function Textile(props) {
  const ref = useRef(null);

  useEffect(function watch() {
    const element = ref.current;
    const io = observer();
    bindVisibility();
    if (!element || io === null) {
      return undefined;
    }
    io.observe(element);
    return function cleanup() {
      io.unobserve(element);
      element.classList.remove('is-live');
    };
  }, []);

  return (
    <div className={props.className} ref={ref} aria-hidden="true">
      <span className="textile__belt" />
    </div>
  );
}
