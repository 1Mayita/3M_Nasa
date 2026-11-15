// =====================================================================
// Dueño: P3 (Vista)
// Pantalla de bienvenida: desfile acelerado de fotos de Cochabamba, collage que se oscurece,
// texto que se arma letra por letra y cortina dividida hacia la portada.
// Una sola línea de tiempo GSAP; solo se animan transform y opacity.
// Se carga con React.lazy y solo se monta la primera vez por sesión en la raíz del sitio.
// =====================================================================

import { Fragment, useEffect, useRef } from 'react';
import gsap from 'gsap';

const BASE = import.meta.env.BASE_URL || '/';
const SEEN_KEY = 'atlas.intro';
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const ILLUSTRATIONS = [
  'plaza_catedral', 'mercado_cancha', 'laguna_alalay', 'tunari_cumbre', 'chapare_selva', 'valle_alto', 'ciudad_noche',
  'palacio_portales', 'bomberos_forestales', 'andes_satelite', 'cochabamba_valle', 'cristo_concordia', 'm_cercado',
  'm_quillacollo', 'm_sacaba'
];
const PHOTOS = [
  'p030101', 'p030201', 'p030202', 'p030203', 'p030302', 'p030303', 'p030401', 'p030402', 'p030403', 'p030501',
  'p030502', 'p030601', 'p030602', 'p030701', 'p030703', 'p030801', 'p030802', 'p030803', 'p030901', 'p030902',
  'p030903', 'p031001', 'p031002', 'p031003', 'p031201', 'p031202', 'p031203', 'p031301', 'p031302', 'p031303',
  'p031401', 'p031402', 'p031403', 'p031501', 'p031602'
];

// Una ilustración cada dos fotos: el ritmo mezcla lo real con lo ilustrado
function buildOrder() {
  const order = [];
  let photo = 0;
  ILLUSTRATIONS.forEach(function add(name) {
    order.push(name);
    for (let n = 0; n < 2 && photo < PHOTOS.length; n += 1) {
      order.push(PHOTOS[photo]);
      photo += 1;
    }
  });
  while (photo < PHOTOS.length) {
    order.push(PHOTOS[photo]);
    photo += 1;
  }
  return order;
}

const ORDER = buildOrder();
const COUNT = ORDER.length;
const URLS = ORDER.map(function url(name) {
  return BASE + 'img/intro/' + name + '.webp';
});

// Duración de cada corte: de 0,18 s a 0,09 s, acelerando de forma gradual
const CUTS = (function cuts() {
  const durations = [];
  const starts = [0];
  for (let k = 0; k < COUNT; k += 1) {
    const d = 0.17 - 0.09 * Math.pow(k / (COUNT - 1), 1.25);
    durations.push(d);
    starts.push(starts[k] + d);
  }
  return { durations, starts, total: starts[COUNT] };
})();

function pad(n) {
  return n < 10 ? '0' + n : String(n);
}

function Letters({ text }) {
  const words = text.split(' ');
  return words.map(function word(w, wi) {
    return (
      <Fragment key={wi}>
      <span className="intro__word" aria-hidden="true">
        {Array.from(w).map(function letter(ch, ci) {
          return (
            <span className="intro__mask" key={ci}>
              <span className="intro__char" data-word={wi}>{ch}</span>
            </span>
          );
        })}
      </span>
      {wi < words.length - 1 ? ' ' : null}
      </Fragment>
    );
  });
}

export default function Intro({ t, onDone }) {
  const rootRef = useRef(null);
  const frameRefs = useRef([null, null]);
  const cellRefs = useRef([]);
  const exitRef = useRef(null);

  useEffect(function run() {
    const root = rootRef.current;
    if (!root) {
      return undefined;
    }
    try {
      window.sessionStorage.setItem(SEEN_KEY, '1');
    } catch (error) {
      // sin almacenamiento: la intro simplemente puede repetirse al recargar
    }
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const previousFocus = document.activeElement;
    const q = gsap.utils.selector(root);
    const enterButton = root.querySelector('.intro__enter');
    const skipButton = root.querySelector('.intro__skip');
    const live = root.querySelector('.intro__live');
    const status = new Array(COUNT).fill(0); // 0 pendiente, 1 lista, 2 fallida
    const loaders = [];
    let dead = false;
    let ready = false;
    let leaving = false;
    let main = null;
    let waitTimer = 0;

    root.focus({ preventScroll: true });

    // ---------- precarga progresiva: 6 primeras, luego el resto en paralelo ----------
    function load(i, onSettle) {
      const image = new Image();
      loaders.push(image);
      image.decoding = 'async';
      image.onload = function loaded() {
        status[i] = 1;
        const cell = cellRefs.current[i];
        if (cell && !dead) {
          cell.src = URLS[i];
        }
        if (onSettle) {
          onSettle();
        }
      };
      image.onerror = function failed() {
        status[i] = 2;
        if (onSettle) {
          onSettle();
        }
      };
      image.src = URLS[i];
    }

    function loadRest() {
      for (let i = 6; i < COUNT; i += 1) {
        load(i, null);
      }
    }

    let settled = 0;
    let started = false;
    function begin() {
      if (started || dead || leaving) {
        return;
      }
      started = true;
      window.clearTimeout(waitTimer);
      loadRest();
      play();
    }
    function onFirstSettle() {
      settled += 1;
      if (settled >= 6) {
        begin();
      }
    }

    // ---------- estados iniciales ----------
    const chars = q('.intro__char');
    const copy = q('.intro__copy');
    const cells = q('.intro__cell');
    gsap.set(chars, { yPercent: 118 });
    gsap.set(cells, { opacity: 0, scale: 0.7 });
    gsap.set(q('.intro__line'), { scaleX: 0 });
    gsap.set(q('.intro__rule'), { scaleX: 0 });
    gsap.set(q('.intro__panel--top'), { y: 0, yPercent: -100 });
    gsap.set(q('.intro__panel--bottom'), { y: 0, yPercent: 100 });
    gsap.set(q('.intro__quechua, .intro__subtitle'), { opacity: 0, y: 14 });
    gsap.set(q('.intro__enter'), { opacity: 0, y: 14 });
    gsap.set(q('.intro__count'), { opacity: 0 });

    function showReadyButton() {
      ready = true;
      enterButton.classList.add('is-on');
      if (root.contains(document.activeElement) || document.activeElement === document.body) {
        enterButton.focus({ preventScroll: true });
      }
    }

    function announce() {
      live.textContent = t('introWelcome') + '. ' + t('introQuechua') + '. ' + t('introSubtitle') + '.';
    }

    // ---------- secuencia completa ----------
    function play() {
      if (dead || leaving) {
        return;
      }
      if (reduced) {
        const first = status.indexOf(1);
        const layer = frameRefs.current[0];
        layer.src = URLS[first >= 0 ? first : 0];
        layer.classList.add('is-on');
        gsap.set(q('.intro__shade'), { opacity: 1 });
        gsap.set(chars, { yPercent: 0 });
        gsap.set(copy, { opacity: 0 });
        gsap.set(q('.intro__quechua, .intro__subtitle'), { opacity: 1, y: 0 });
        main = gsap.timeline({ onComplete: showReadyButton });
        main.to(copy, { opacity: 1, duration: 0.9, ease: 'power2.out' }, 0.2).call(announce, null, 0.4);
        main.to(enterButton, { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out' }, 1.1);
        return;
      }

      const frames = frameRefs.current;
      const flash = q('.intro__flash')[0];
      const counter = q('.intro__count-n')[0];
      const line = q('.intro__line')[0];
      const total = CUTS.total;
      const clock = { t: 0 };
      let active = 0;
      let shown = -1;
      let cut = -1;

      function showFrame(index) {
        const next = 1 - active;
        frames[next].src = URLS[index];
        frames[next].classList.add('is-on');
        frames[active].classList.remove('is-on');
        gsap.set(frames[next], { scale: 1 });
        active = next;
        shown = index;
      }

      function tick() {
        const time = clock.t;
        while (cut < COUNT - 1 && time >= CUTS.starts[cut + 1]) {
          cut += 1;
          let index = Math.max(cut, shown + 1);
          while (index < COUNT && status[index] !== 1) {
            index += 1;
          }
          if (index < COUNT) {
            showFrame(index);
            counter.textContent = pad(cut + 1);
          }
        }
        if (cut >= 0) {
          const f = Math.min(1, (time - CUTS.starts[cut]) / CUTS.durations[cut]);
          gsap.set(frames[active], { scale: 1 + 0.07 * f });
          flash.style.opacity = String(0.2 * (1 - f) * (1 - f));
        }
      }

      main = gsap.timeline({ defaults: { ease: 'expo.out' } });

      // 1 · desfile: un contador y una línea fina marcan el avance
      main.to(q('.intro__count'), { opacity: 1, duration: 0.5 }, 0);
      main.to(line, { scaleX: 1, duration: total, ease: 'none' }, 0);
      main.to(clock, { t: total, duration: total, ease: 'none', onUpdate: tick }, 0);

      // 2 · del desfile al collage: las miniaturas caen en cascada mientras el desfile se apaga
      const mosaicAt = total - 0.25;
      main.to(q('.intro__count'), { opacity: 0, duration: 0.4, ease: 'power2.in' }, total - 0.2);
      main.to(line, { opacity: 0, duration: 0.5, ease: 'power2.in' }, total - 0.1);
      main.to(cells, { opacity: 1, scale: 1, duration: 0.6, ease: 'power4.out', stagger: { amount: 1.2, from: 'random' } }, mosaicAt);
      main.to(q('.intro__frames'), { opacity: 0, duration: 0.5, ease: 'power2.inOut' }, mosaicAt + 1.0);
      main.fromTo(q('.intro__mosaic'), { scale: 1 }, { scale: 1.06, duration: 6, ease: 'none' }, mosaicAt);
      main.to(q('.intro__shade'), { opacity: 1, duration: 1.3, ease: 'power2.inOut' }, mosaicAt + 0.9);

      // 3 · texto letra por letra, con desfase entre palabras
      const textAt = mosaicAt + 1.3;
      main.set(copy, { opacity: 1 }, textAt);
      main.call(announce, null, textAt);
      const titleChars = q('.intro__title .intro__char');
      titleChars.forEach(function place(el, i) {
        const word = Number(el.getAttribute('data-word')) || 0;
        main.to(el, { yPercent: 0, duration: 1.15, ease: 'expo.out' }, textAt + i * 0.038 + word * 0.14);
      });
      main.to(q('.intro__quechua'), { opacity: 1, y: 0, duration: 1.1, ease: 'expo.out' }, textAt + 0.9);
      main.to(q('.intro__quechua .intro__char'), { yPercent: 0, duration: 1, ease: 'expo.out', stagger: 0.03 }, textAt + 0.9);
      main.to(q('.intro__subtitle'), { opacity: 1, y: 0, duration: 1, ease: 'expo.out' }, textAt + 1.35);
      main.to(q('.intro__rule'), { scaleX: 1, duration: 1.2, ease: 'power4.inOut' }, textAt + 1.3);

      // 4 · botón para entrar
      main.to(enterButton, {
        opacity: 1,
        y: 0,
        duration: 0.9,
        ease: 'expo.out',
        onStart: showReadyButton
      }, textAt + 1.9);
    }

    // ---------- salida: cortina dividida ----------
    function exit(fast) {
      if (leaving || dead) {
        return;
      }
      leaving = true;
      if (main) {
        main.kill();
      }
      const finish = function finish() {
        if (dead) {
          return;
        }
        if (previousFocus && previousFocus !== document.body && typeof previousFocus.focus === 'function') {
          previousFocus.focus({ preventScroll: true });
        }
        onDone();
      };
      if (reduced) {
        gsap.to(root, { opacity: 0, duration: 0.3, ease: 'power1.out', onComplete: finish });
        return;
      }
      const speed = fast ? 1.5 : 1;
      const top = q('.intro__panel--top');
      const bottom = q('.intro__panel--bottom');
      const out = gsap.timeline({ onComplete: finish });
      out.timeScale(speed);
      exitRef.current = out;
      out.to(copy, { opacity: 0, y: -24, duration: 0.45, ease: 'power3.in' }, 0);
      out.to(q('.intro__actions, .intro__credit, .intro__skip, .intro__count'), { opacity: 0, duration: 0.3 }, 0);
      out.to([top, bottom], { yPercent: 0, duration: 0.7, ease: 'power4.inOut' }, 0.1);
      out.set(q('.intro__stage'), { visibility: 'hidden' });
      out.set(root, { backgroundColor: 'rgba(0,0,0,0)' });
      out.to(top, { yPercent: -100, duration: 0.95, ease: 'expo.inOut' }, '+=0.12');
      out.to(bottom, { yPercent: 100, duration: 0.95, ease: 'expo.inOut' }, '<');
    }

    // ---------- teclado y rueda ----------
    function onKey(event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        exit(true);
        return;
      }
      if (event.key === 'Enter' || event.key === ' ') {
        if (event.target && event.target.closest && event.target.closest('button')) {
          return;
        }
        event.preventDefault();
        exit(false);
        return;
      }
      if (event.key === 'Tab') {
        const list = ready ? [skipButton, enterButton] : [skipButton];
        const index = list.indexOf(document.activeElement);
        event.preventDefault();
        if (event.shiftKey) {
          list[index <= 0 ? list.length - 1 : index - 1].focus();
        } else {
          list[index < 0 || index === list.length - 1 ? 0 : index + 1].focus();
        }
      }
    }
    function onWheel(event) {
      event.stopPropagation();
      event.preventDefault();
    }
    function onSkip() {
      exit(true);
    }
    function onEnter() {
      exit(false);
    }
    document.addEventListener('keydown', onKey, true);
    root.addEventListener('wheel', onWheel, { passive: false });
    skipButton.addEventListener('click', onSkip);
    enterButton.addEventListener('click', onEnter);

    // arranque: las 6 primeras fotos (tope de 1,5 s por si alguna tarda)
    for (let i = 0; i < 6; i += 1) {
      load(i, onFirstSettle);
    }
    waitTimer = window.setTimeout(begin, 1500);

    return function cleanup() {
      dead = true;
      window.clearTimeout(waitTimer);
      document.removeEventListener('keydown', onKey, true);
      root.removeEventListener('wheel', onWheel);
      skipButton.removeEventListener('click', onSkip);
      enterButton.removeEventListener('click', onEnter);
      loaders.forEach(function stop(image) {
        image.onload = null;
        image.onerror = null;
      });
      if (main) {
        main.kill();
      }
      if (exitRef.current) {
        exitRef.current.kill();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="intro" ref={rootRef} role="dialog" aria-modal="true" aria-label={t('introLabel')} tabIndex={-1}>
      <div className="intro__stage">
        <div className="intro__frames" aria-hidden="true">
          <img className="intro__frame" alt="" src={BLANK} ref={function a(el) { frameRefs.current[0] = el; }} />
          <img className="intro__frame" alt="" src={BLANK} ref={function b(el) { frameRefs.current[1] = el; }} />
          <div className="intro__flash" />
        </div>
        <div className="intro__mosaic" aria-hidden="true">
          {URLS.map(function cell(url, i) {
            return (
              <div className="intro__cell" key={url}>
                <img alt="" src={BLANK} ref={function ref(el) { cellRefs.current[i] = el; }} />
              </div>
            );
          })}
        </div>
        <div className="intro__shade" aria-hidden="true" />

        <p className="intro__count" aria-hidden="true"><span className="intro__count-n">00</span><span className="intro__count-sep"> / </span>{COUNT}</p>
        <span className="intro__line" aria-hidden="true" />

        <div className="intro__copy">
          <h1 className="intro__title" aria-label={t('introWelcome')}><Letters text={t('introWelcome')} /></h1>
          <p className="intro__quechua" lang="qu"><span className="intro__quechua-text" aria-hidden="true"><Letters text={t('introQuechua')} /></span><span className="intro__sr">{t('introQuechua')}</span></p>
          <span className="intro__rule" aria-hidden="true" />
          <p className="intro__subtitle">{t('introSubtitle')}</p>
        </div>

        <div className="intro__actions">
          <button type="button" className="intro__enter"><span className="intro__enter-label">{t('introEnter')}</span></button>
        </div>
        <button type="button" className="intro__skip">{t('introSkip')}</button>
        <p className="intro__live intro__sr" role="status" aria-live="polite" />
      </div>
      <div className="intro__panel intro__panel--top" aria-hidden="true" />
      <div className="intro__panel intro__panel--bottom" aria-hidden="true" />
    </div>
  );
}
