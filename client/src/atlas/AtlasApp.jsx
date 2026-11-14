// =====================================================================
// Dueño: P3 (Vista)
// Pantalla principal: portada + atlas 3D de focos de calor de Cochabamba.
// Datos: /api/focos3d (P2) con respaldo a la muestra sintética del kit, siempre rotulada.
// Contexto de El Niño: índice ONI de NOAA (public/data/oni.json), solo como contexto.
// =====================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import AtlasMap from './AtlasMap.jsx';
import Ficha from './Ficha.jsx';
import Hero from './Hero.jsx';
import CalendarPage from './CalendarPage.jsx';
import MethodPage from './MethodPage.jsx';
import { fetchHotspots3d } from '../components/vista3d/focos3dApi.js';
import { buildMockHotspots3d } from '../components/vista3d/focos3d.mock.js';
import { aggregateByMunicipality, buildMunicipalityIndex, sumSeries } from './geo.js';
import { LANGUAGES, formatMonth, makeTranslator, profileName } from './i18n.js';
import { RAMP_GRADIENT_CSS } from './ramp.js';
import { IconFlame, IconMoon, IconOrbit, IconPause, IconPlay, IconSearch, IconSun } from './Icons.jsx';
import './atlas.css';
import './atlas.extra.css';
import './atlas.pages.css';

const PROFILES = ['bombero', 'gestor', 'ciudadano'];
const ROUTES = ['inicio', 'atlas', 'calendario', 'metodo'];
const ROUTE_LABEL_KEYS = { inicio: 'navHome', atlas: 'navAtlas', calendario: 'navCalendar', metodo: 'navMethod' };
const PLAY_STEP_MILLISECONDS = 380;
const NINO_COLOR = 'rgba(91,124,153,0.95)';
const NINA_COLOR = 'rgba(150,186,184,0.75)';
const NEUTRAL_COLOR = 'rgba(255,255,255,0.07)';

function readStored(key, fallback) {
  try {
    return window.localStorage.getItem(key) || fallback;
  } catch (error) {
    return fallback;
  }
}

function writeStored(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    // sin almacenamiento: la interfaz sigue funcionando
  }
}

function parseRoute() {
  const name = window.location.hash.replace('#/', '').replace('#', '');
  return ROUTES.indexOf(name) >= 0 ? name : 'inicio';
}

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function ensoPhase(value) {
  if (value === undefined) {
    return null;
  }
  if (value >= 0.5) {
    return 'nino';
  }
  if (value <= -0.5) {
    return 'nina';
  }
  return 'neutral';
}

function buildEnsoGradient(months, oni) {
  if (!oni || months.length === 0) {
    return null;
  }
  const stops = months.map(function stop(month, i) {
    const phase = ensoPhase(oni[month]);
    const color = phase === 'nino' ? NINO_COLOR : phase === 'nina' ? NINA_COLOR : NEUTRAL_COLOR;
    const from = (i / months.length) * 100;
    const to = ((i + 1) / months.length) * 100;
    return color + ' ' + from.toFixed(3) + '% ' + to.toFixed(3) + '%';
  });
  return 'linear-gradient(90deg, ' + stops.join(', ') + ')';
}

export default function AtlasApp() {
  const [language, setLanguage] = useState(readStored('atlas.language', 'es'));
  const [profile, setProfile] = useState(readStored('atlas.profile', 'bombero'));
  const [theme, setTheme] = useState(readStored('atlas.theme', 'dark'));
  const initialRoute = useMemo(parseRoute, []);
  const [phase, setPhase] = useState(initialRoute === 'inicio' ? 'hero' : 'atlas');
  const [page, setPage] = useState(initialRoute === 'calendario' || initialRoute === 'metodo' ? initialRoute : null);
  const [curtainLabel, setCurtainLabel] = useState('');
  const [geo, setGeo] = useState(null);
  const [data, setData] = useState(null);
  const [oni, setOni] = useState(null);
  const [isFallback, setIsFallback] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);
  const [mode, setMode] = useState('acumulado');
  const [monthIdx, setMonthIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(null);
  const [hover, setHover] = useState(null);
  const [rotationEnabled, setRotationEnabled] = useState(true);
  const [search, setSearch] = useState('');
  const [mapReady, setMapReady] = useState(false);
  const rootRef = useRef(null);
  const heroRef = useRef(null);
  const curtainRef = useRef(null);
  const routeRef = useRef(initialRoute);

  const t = useMemo(function makeT() {
    return makeTranslator(language);
  }, [language]);

  useEffect(function persist() {
    writeStored('atlas.language', language);
    writeStored('atlas.profile', profile);
    writeStored('atlas.theme', theme);
    document.documentElement.lang = language;
  }, [language, profile, theme]);

  // Carga de municipios, focos y contexto El Niño
  useEffect(function load() {
    let cancelled = false;
    const base = import.meta.env.BASE_URL || '/';
    fetch(base + 'data/municipios_cochabamba.geojson')
      .then(function parse(response) {
        if (!response.ok) {
          throw new Error('municipios: ' + response.status);
        }
        return response.json();
      })
      .then(function save(collection) {
        if (!cancelled) {
          setGeo(buildMunicipalityIndex(collection));
        }
      })
      .catch(function fail(error) {
        if (!cancelled) {
          setErrorMessage(error.message);
        }
      });
    fetch(base + 'data/oni.json')
      .then(function parse(response) {
        return response.ok ? response.json() : null;
      })
      .then(function save(payload) {
        if (!cancelled && payload) {
          setOni(payload.data);
        }
      })
      .catch(function ignore() {
        // el contexto de El Niño es opcional
      });
    fetchHotspots3d('depto')
      .catch(function fallback() {
        const sample = buildMockHotspots3d('depto');
        sample.isSample = true;
        if (!cancelled) {
          setIsFallback(true);
        }
        return sample;
      })
      .then(function save(result) {
        if (!cancelled) {
          setData(result);
          setMonthIdx(Math.max(result.months.length - 1, 0));
        }
      });
    return function cleanup() {
      cancelled = true;
    };
  }, []);

  const aggregated = useMemo(
    function aggregate() {
      if (geo === null || data === null) {
        return null;
      }
      return aggregateByMunicipality(data, geo.municipalities);
    },
    [geo, data]
  );

  const totals = useMemo(
    function computeTotals() {
      if (aggregated === null) {
        return [];
      }
      return aggregated.series.map(sumSeries);
    },
    [aggregated]
  );

  const values = useMemo(
    function computeValues() {
      if (aggregated === null) {
        return [];
      }
      if (mode === 'acumulado') {
        return totals;
      }
      return aggregated.series.map(function pick(series) {
        return series[monthIdx] || 0;
      });
    },
    [aggregated, totals, mode, monthIdx]
  );

  const maxValue = useMemo(function computeMax() {
    return Math.max.apply(null, values.concat([1]));
  }, [values]);

  const columns = useMemo(
    function computeColumns() {
      if (data === null) {
        return [];
      }
      if (mode === 'acumulado') {
        return data.cells.map(function total(cell) {
          return { longitude: cell.longitude, latitude: cell.latitude, value: cell.total };
        });
      }
      const frame = data.frames[data.months[monthIdx]] || [];
      return frame.map(function entry(item) {
        const cell = data.cells[item[0]];
        return { longitude: cell.longitude, latitude: cell.latitude, value: item[1] };
      });
    },
    [data, mode, monthIdx]
  );

  const columnMax = data === null ? 1 : mode === 'acumulado' ? data.maxCellTotal : data.maxCellMonthly;

  const sortedAll = useMemo(
    function computeSorted() {
      if (geo === null) {
        return [];
      }
      return geo.municipalities
        .map(function pair(municipality, i) {
          return { idx: municipality.idx, name: municipality.name, value: values[i] || 0 };
        })
        .sort(function descending(a, b) {
          return b.value - a.value;
        });
    },
    [geo, values]
  );

  const ranking = useMemo(function top() {
    return sortedAll.slice(0, 8);
  }, [sortedAll]);

  const rankOfSelected = useMemo(
    function computeRank() {
      if (selectedIdx === null) {
        return null;
      }
      const position = sortedAll.findIndex(function match(entry) {
        return entry.idx === selectedIdx;
      });
      return position < 0 ? null : position + 1;
    },
    [sortedAll, selectedIdx]
  );

  const ensoGradient = useMemo(
    function computeBand() {
      return data === null ? null : buildEnsoGradient(data.months, oni);
    },
    [data, oni]
  );

  const filteredMunicipalities = useMemo(
    function filterList() {
      if (geo === null) {
        return [];
      }
      const query = search.trim().toLowerCase();
      return geo.municipalities
        .filter(function matches(municipality) {
          return query === '' || municipality.name.toLowerCase().indexOf(query) >= 0;
        })
        .sort(function alphabetical(a, b) {
          return a.name.localeCompare(b.name, 'es');
        });
    },
    [geo, search]
  );

  // Reproducción mes a mes
  useEffect(
    function play() {
      if (!isPlaying || data === null) {
        return undefined;
      }
      const timer = setInterval(function advance() {
        setMonthIdx(function next(previous) {
          if (previous >= data.months.length - 1) {
            setIsPlaying(false);
            return previous;
          }
          return previous + 1;
        });
      }, PLAY_STEP_MILLISECONDS);
      return function stop() {
        clearInterval(timer);
      };
    },
    [isPlaying, data]
  );

  const isReady = geo !== null && data !== null;
  const isShown = isReady && mapReady;

  // Entrada de la portada
  useEffect(
    function heroIntro() {
      if (phase !== 'hero' || window.matchMedia('(prefers-reduced-motion: reduce)').matches || !heroRef.current) {
        return undefined;
      }
      const context = gsap.context(function build() {
        gsap.from('.hero__title', { y: 36, opacity: 0, duration: 1.2, ease: 'expo.out', delay: 0.15 });
        gsap.from('.hero__subtitle, .hero__lead, .hero__actions, .hero__facts, .hero__honest', {
          y: 20,
          opacity: 0,
          duration: 0.9,
          ease: 'expo.out',
          stagger: 0.1,
          delay: 0.45
        });
      }, heroRef);
      return function cleanup() {
        context.revert();
      };
    },
    [phase]
  );

  // Entrada de la interfaz del atlas, una sola vez al salir de la portada
  useEffect(
    function atlasIntro() {
      if (phase !== 'atlas' || !isShown || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return undefined;
      }
      const context = gsap.context(function build() {
        gsap.from('.atlas__title > *', { y: 18, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.12, delay: 0.4 });
        gsap.from('.rail, .timeline, .scale', { opacity: 0, y: 14, duration: 0.9, ease: 'expo.out', stagger: 0.12, delay: 0.7 });
      }, rootRef);
      return function cleanup() {
        context.revert();
      };
    },
    [phase, isShown]
  );

  function enterAtlas() {
    if (!heroRef.current || prefersReducedMotion()) {
      setPhase('atlas');
      return;
    }
    // la cámara empieza a volar mientras la portada se desvanece
    setPhase('entering');
    gsap.to(heroRef.current, {
      opacity: 0,
      x: -40,
      duration: 0.7,
      ease: 'expo.in',
      onComplete: function done() {
        setPhase('atlas');
      }
    });
  }

  function applyRoute(route) {
    if (route === 'calendario' || route === 'metodo') {
      setPage(route);
      setHover(null);
      setPhase('atlas');
    } else if (route === 'atlas') {
      setPage(null);
      setPhase('atlas');
    } else {
      setPage(null);
      setSelectedIdx(null);
      setHover(null);
      setPhase('hero');
    }
    routeRef.current = route;
  }

  // Cortina verde que cubre la pantalla, cambia de página y se retira
  function runCurtain(route) {
    const element = curtainRef.current;
    if (!element) {
      applyRoute(route);
      return;
    }
    setCurtainLabel(t(ROUTE_LABEL_KEYS[route]));
    gsap.timeline()
      .set(element, { display: 'grid', clipPath: 'inset(100% 0% 0% 0%)' })
      .to(element, { clipPath: 'inset(0% 0% 0% 0%)', duration: 0.55, ease: 'expo.inOut' })
      .add(function swap() {
        applyRoute(route);
      })
      .to(element, { clipPath: 'inset(0% 0% 100% 0%)', duration: 0.7, ease: 'expo.inOut', delay: 0.35 })
      .set(element, { display: 'none' });
  }

  // Toda la navegación pasa por el hash (#/atlas, #/calendario...): sirve el botón Atrás
  useEffect(function listenToRoutes() {
    function onHashChange() {
      const target = parseRoute();
      const from = routeRef.current;
      if (target === from || window.location.hash === '#clasico') {
        return;
      }
      if (prefersReducedMotion()) {
        applyRoute(target);
        return;
      }
      if (from === 'inicio' && target === 'atlas') {
        routeRef.current = 'atlas';
        enterAtlas();
        return;
      }
      runCurtain(target);
    }
    window.addEventListener('hashchange', onHashChange);
    return function cleanup() {
      window.removeEventListener('hashchange', onHashChange);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t]);

  // Escape cierra la ficha
  useEffect(function listenToEscape() {
    function onKey(event) {
      if (event.key === 'Escape') {
        setSelectedIdx(null);
      }
    }
    window.addEventListener('keydown', onKey);
    return function cleanup() {
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  function goTo(route) {
    window.location.hash = '#/' + route;
  }

  const handleSelect = useCallback(function select(idx) {
    setSelectedIdx(idx);
  }, []);
  const handleHover = useCallback(function hoverChange(info) {
    setHover(info);
  }, []);
  const handleTerrainReady = useCallback(function terrainReady() {
    setMapReady(true);
  }, []);

  function togglePlay() {
    if (mode !== 'mes') {
      setMode('mes');
    }
    if (!isPlaying && monthIdx >= data.months.length - 1) {
      setMonthIdx(0);
    }
    setIsPlaying(!isPlaying);
  }

  const inHero = phase === 'hero';
  const inAtlas = phase === 'atlas';
  const onPage = page !== null;
  const currentRoute = page !== null ? page : inHero ? 'inicio' : 'atlas';
  const isSample = (data !== null && data.isSample) || isFallback;
  const selectedMunicipality = geo !== null && selectedIdx !== null ? geo.municipalities[selectedIdx] : null;
  const hoverMunicipality = geo !== null && hover !== null && !inHero ? geo.municipalities[hover.idx] : null;
  const currentMonthText = data !== null ? formatMonth(language, data.months[monthIdx]) : '';
  const rankingTitle = profile === 'bombero' ? t('topNowBombero') : t('topNow');
  const rankingMax = ranking.length > 0 ? Math.max(ranking[0].value, 1) : 1;

  return (
    <div className="atlas" data-theme={theme} data-phase={phase} ref={rootRef}>
      <div className="atlas__map">
        {isReady && (
          <AtlasMap
            collection={geo.collection}
            municipalities={geo.municipalities}
            values={values}
            maxValue={maxValue}
            selectedIdx={selectedIdx}
            hoverIdx={hover === null || inHero ? null : hover.idx}
            columns={columns}
            columnMax={columnMax}
            theme={theme}
            rotationEnabled={rotationEnabled}
            entered={!inHero}
            onSelect={handleSelect}
            onHover={handleHover}
            interactive={!inHero}
            onTerrainReady={handleTerrainReady}
          />
        )}
      </div>
      <div className="atlas__veil" aria-hidden="true" />

      {!isShown && errorMessage === null && inAtlas && <p className="atlas__status" role="status">{t('loading')}</p>}
      {errorMessage !== null && <p className="atlas__status is-error" role="alert">{t('loadError')}: {errorMessage}</p>}

      {phase !== 'atlas' && <Hero ref={heroRef} t={t} onEnter={function enter() { goTo('atlas'); }} isReady={isShown} />}

      {phase !== 'hero' && (
        <header className="atlas__title">
          <p className="atlas__name"><IconFlame /> {t('title')}</p>
          <p>{t('subtitle')}</p>
        </header>
      )}

      <div className={'atlas__controls' + (inHero ? ' is-hero' : '')}>
        <nav className="mainnav" aria-label="Navegación principal">
          {ROUTES.map(function routeLink(route) {
            return (
              <a key={route} href={'#/' + route} aria-current={currentRoute === route ? 'page' : undefined}>
                {t(ROUTE_LABEL_KEYS[route])}
              </a>
            );
          })}
        </nav>
        {!inHero && !onPage && (
          <div className="segmented" role="group" aria-label={t('profile')}>
            {PROFILES.map(function profileButton(id) {
              return (
                <button type="button" key={id} aria-pressed={profile === id} onClick={function pick() { setProfile(id); }}>
                  {profileName(language, id)}
                </button>
              );
            })}
          </div>
        )}
        <div className="segmented segmented--small" role="group" aria-label={t('language')}>
          {LANGUAGES.map(function languageButton(id) {
            return (
              <button type="button" key={id} aria-pressed={language === id} onClick={function pick() { setLanguage(id); }}>
                {id.toUpperCase()}
              </button>
            );
          })}
        </div>
        <button
          type="button"
          className="theme-toggle"
          aria-label={t('theme') + ': ' + (theme === 'dark' ? t('themeLight') : t('themeDark'))}
          onClick={function toggleTheme() { setTheme(theme === 'dark' ? 'light' : 'dark'); }}
        >
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
          <span>{theme === 'dark' ? t('day') : t('night')}</span>
        </button>
        {!inHero && !onPage && <a className="classic-link" href="#clasico">{t('classic')}</a>}
      </div>
      {language === 'qu' && <p className="atlas__notice" role="status">{t('quNotice')}</p>}

      {!inHero && !onPage && (
        <nav className="rail" aria-label={t('municipalities')}>
          {profile === 'ciudadano' ? (
            <div className="rail__plain">
              <h2>{t('seasonTitle')}</h2>
              <p>{t('seasonText')}</p>
              <p className="rail__hint">{t('clickHint')}</p>
            </div>
          ) : (
            <>
              <h2>{rankingTitle}</h2>
              <ol className="rail__list">
                {ranking.map(function rankRow(entry, rank) {
                  return (
                    <li key={entry.idx}>
                      <button
                        type="button"
                        className={selectedIdx === entry.idx ? 'is-active' : ''}
                        style={{ '--bar': Math.min(entry.value / rankingMax, 1) }}
                        onClick={function pick() { handleSelect(entry.idx); }}
                      >
                        <span className="rail__rank">{rank + 1}</span>
                        <span className="rail__name">{entry.name.replace('TIOC-', '')}</span>
                        <span className="rail__value">{Math.round(entry.value)}</span>
                      </button>
                    </li>
                  );
                })}
              </ol>
            </>
          )}
          <label className="search">
            <IconSearch />
            <span className="visually-hidden">{t('searchMunicipality')}</span>
            <input type="search" value={search} placeholder={t('searchMunicipality')} onChange={function change(event) { setSearch(event.target.value); }} />
          </label>
          {search.trim() !== '' && (
            <ul className="search__results">
              {filteredMunicipalities.slice(0, 7).map(function result(municipality) {
                return (
                  <li key={municipality.idx}>
                    <button type="button" onClick={function pick() { handleSelect(municipality.idx); setSearch(''); }}>
                      {municipality.name.replace('TIOC-', '')}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </nav>
      )}

      {hoverMunicipality !== null && (
        <div className="hover-label" style={{ left: hover.x + 14, top: hover.y + 14 }} role="presentation">
          <strong>{hoverMunicipality.name.replace('TIOC-', '')}</strong>
          <span>{Math.round(values[hoverMunicipality.idx] || 0)} {t('detections')}</span>
        </div>
      )}

      {!inHero && !onPage && selectedMunicipality !== null && aggregated !== null && (
        <Ficha
          key={selectedMunicipality.idx}
          municipality={selectedMunicipality}
          values={Array.from(aggregated.series[selectedMunicipality.idx])}
          months={data.months}
          monthIdx={monthIdx}
          rank={rankOfSelected}
          total={geo.municipalities.length}
          levelRatio={maxValue > 0 ? Math.min((values[selectedMunicipality.idx] || 0) / maxValue, 1) : 0}
          oni={oni}
          t={t}
          language={language}
          profile={profile}
          isSample={isSample}
          onClose={function close() { setSelectedIdx(null); }}
        />
      )}

      {!inHero && !onPage && (
        <div className="scale">
          <span className="scale__title">{t('legendTitle')}</span>
          <div className="scale__bar" style={{ background: RAMP_GRADIENT_CSS }} />
          <div className="scale__ends"><span>{t('legendLow')}</span><span>{t('legendHigh')}</span></div>
        </div>
      )}

      {!inHero && !onPage && (
        <div className="timeline">
          <div className="segmented segmented--small" role="group" aria-label={t('month')}>
            <button type="button" aria-pressed={mode === 'acumulado'} onClick={function pick() { setMode('acumulado'); setIsPlaying(false); }}>{t('accumulated')}</button>
            <button type="button" aria-pressed={mode === 'mes'} onClick={function pick() { setMode('mes'); }}>{t('monthly')}</button>
          </div>
          <button type="button" className="icon-button icon-button--primary" onClick={togglePlay} aria-label={isPlaying ? t('pause') : t('play')} disabled={!isReady}>
            {isPlaying ? <IconPause /> : <IconPlay />}
          </button>
          <div className="timeline__track">
            <input
              type="range"
              className="timeline__range"
              min={0}
              max={data === null ? 0 : Math.max(data.months.length - 1, 0)}
              step={1}
              value={monthIdx}
              disabled={!isReady}
              aria-label={t('month')}
              onChange={function change(event) {
                setMode('mes');
                setIsPlaying(false);
                setMonthIdx(Number.parseInt(event.target.value, 10));
              }}
            />
            {ensoGradient !== null && <div className="timeline__enso" style={{ background: ensoGradient }} title={t('ensoLabel')} />}
          </div>
          <span className="timeline__label">{mode === 'mes' ? currentMonthText : t('accumulated')}</span>
          <button
            type="button"
            className="icon-button"
            aria-pressed={rotationEnabled}
            aria-label={rotationEnabled ? t('rotateStop') : t('rotate')}
            onClick={function toggle() { setRotationEnabled(!rotationEnabled); }}
          >
            <IconOrbit />
          </button>
          {ensoGradient !== null && (
            <p className="timeline__legend">
              <i className="dot dot--nino" /> {t('ensoNino')} <i className="dot dot--nina" /> {t('ensoNina')}
              <span> · {t('ensoLabel')}</span>
            </p>
          )}
        </div>
      )}

      {page === 'calendario' && isReady && (
        <CalendarPage data={data} aggregated={aggregated} geo={geo} oni={oni} t={t} language={language} isSample={isSample} />
      )}
      {page === 'metodo' && <MethodPage language={language} />}

      <div className="curtain" ref={curtainRef} aria-hidden="true">
        <p className="curtain__label"><IconFlame /> {curtainLabel}</p>
      </div>

      <footer className="atlas__footer">
        <p>
          {isSample && <span className="tag-sample">{t('sample')}</span>} {t('honest')}
        </p>
        <p className="atlas__credits">{t('credits')}</p>
      </footer>
    </div>
  );
}
