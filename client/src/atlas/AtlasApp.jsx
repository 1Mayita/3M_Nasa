// =====================================================================
// Dueño: P3 (Vista)
// Pantalla principal: atlas 3D nocturno de focos de calor de Cochabamba.
// Datos: /api/focos3d (P2) con respaldo a la muestra sintética del kit, siempre rotulada.
// =====================================================================

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import AtlasMap from './AtlasMap.jsx';
import Ficha from './Ficha.jsx';
import { fetchHotspots3d } from '../components/vista3d/focos3dApi.js';
import { buildMockHotspots3d } from '../components/vista3d/focos3d.mock.js';
import { aggregateByMunicipality, buildMunicipalityIndex, sumSeries } from './geo.js';
import { LANGUAGES, formatMonth, makeTranslator, profileName } from './i18n.js';
import { RAMP_GRADIENT_CSS } from './ramp.js';
import { IconFlame, IconMoon, IconOrbit, IconPause, IconPlay, IconSearch, IconSun } from './Icons.jsx';
import './atlas.css';

const PROFILES = ['bombero', 'gestor', 'ciudadano'];
const PLAY_STEP_MILLISECONDS = 380;

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

export default function AtlasApp() {
  const [language, setLanguage] = useState(readStored('atlas.language', 'es'));
  const [profile, setProfile] = useState(readStored('atlas.profile', 'bombero'));
  const [theme, setTheme] = useState(readStored('atlas.theme', 'dark'));
  const [geo, setGeo] = useState(null);
  const [data, setData] = useState(null);
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

  const t = useMemo(function makeT() {
    return makeTranslator(language);
  }, [language]);

  useEffect(function persist() {
    writeStored('atlas.language', language);
    writeStored('atlas.profile', profile);
    writeStored('atlas.theme', theme);
    document.documentElement.lang = language === 'qu' ? 'qu' : language;
  }, [language, profile, theme]);

  // Carga de municipios y de focos
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

  const ranking = useMemo(
    function computeRanking() {
      if (geo === null) {
        return [];
      }
      return geo.municipalities
        .map(function pair(municipality, i) {
          return { idx: municipality.idx, name: municipality.name, value: values[i] || 0 };
        })
        .sort(function descending(a, b) {
          return b.value - a.value;
        })
        .slice(0, 8);
    },
    [geo, values]
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

  // Entrada de la interfaz, una sola vez
  const isReady = geo !== null && data !== null;
  const isShown = isReady && mapReady;
  useEffect(
    function intro() {
      if (!isShown || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        return undefined;
      }
      const context = gsap.context(function build() {
        gsap.from('.atlas__title > *', { y: 18, opacity: 0, duration: 0.9, ease: 'expo.out', stagger: 0.12, delay: 0.2 });
        gsap.from('.atlas__controls, .rail, .timeline, .scale', { opacity: 0, y: 12, duration: 0.8, ease: 'expo.out', stagger: 0.1, delay: 0.5 });
      }, rootRef);
      return function cleanup() {
        context.revert();
      };
    },
    [isShown]
  );

  const handleSelect = useCallback(function select(idx) {
    setSelectedIdx(idx);
  }, []);
  const handleTerrainReady = useCallback(function terrainReady() {
    setMapReady(true);
  }, []);
  const handleHover = useCallback(function hoverChange(info) {
    setHover(info);
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

  const isSample = (data !== null && data.isSample) || isFallback;
  const selectedMunicipality = geo !== null && selectedIdx !== null ? geo.municipalities[selectedIdx] : null;
  const hoverMunicipality = geo !== null && hover !== null ? geo.municipalities[hover.idx] : null;
  const currentMonthText = data !== null ? formatMonth(language, data.months[monthIdx]) : '';
  const rankingTitle = profile === 'bombero' ? t('topNowBombero') : t('topNow');

  return (
    <div className="atlas" data-theme={theme} ref={rootRef}>
      <div className="atlas__map">
        {isReady && (
          <AtlasMap
            collection={geo.collection}
            municipalities={geo.municipalities}
            values={values}
            maxValue={maxValue}
            selectedIdx={selectedIdx}
            hoverIdx={hover === null ? null : hover.idx}
            columns={columns}
            columnMax={columnMax}
            theme={theme}
            rotationEnabled={rotationEnabled}
            onSelect={handleSelect}
            onHover={handleHover}
            onTerrainReady={handleTerrainReady}
          />
        )}
      </div>
      <div className="atlas__veil" aria-hidden="true" />

      {(!isReady || !mapReady) && errorMessage === null && <p className="atlas__status" role="status">{t('loading')}</p>}
      {errorMessage !== null && <p className="atlas__status is-error" role="alert">{t('loadError')}: {errorMessage}</p>}

      <header className="atlas__title">
        <h1><IconFlame /> {t('title')}</h1>
        <p>{t('subtitle')}</p>
      </header>

      <div className="atlas__controls">
        <div className="segmented" role="group" aria-label={t('profile')}>
          {PROFILES.map(function profileButton(id) {
            return (
              <button type="button" key={id} aria-pressed={profile === id} onClick={function pick() { setProfile(id); }}>
                {profileName(language, id)}
              </button>
            );
          })}
        </div>
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
          className="icon-button"
          aria-label={t('theme') + ': ' + (theme === 'dark' ? t('themeLight') : t('themeDark'))}
          onClick={function toggleTheme() { setTheme(theme === 'dark' ? 'light' : 'dark'); }}
        >
          {theme === 'dark' ? <IconSun /> : <IconMoon />}
        </button>
        <a className="classic-link" href="#clasico">{t('classic')}</a>
      </div>
      {language === 'qu' && <p className="atlas__notice" role="status">{t('quNotice')}</p>}

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
                    <button type="button" className={selectedIdx === entry.idx ? 'is-active' : ''} onClick={function pick() { handleSelect(entry.idx); }}>
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

      {hoverMunicipality !== null && (
        <div className="hover-label" style={{ left: hover.x + 14, top: hover.y + 14 }} role="presentation">
          <strong>{hoverMunicipality.name.replace('TIOC-', '')}</strong>
          <span>{Math.round(values[hoverMunicipality.idx] || 0)} {t('detections')}</span>
        </div>
      )}

      {selectedMunicipality !== null && aggregated !== null && (
        <Ficha
          key={selectedMunicipality.idx}
          municipality={selectedMunicipality}
          values={Array.from(aggregated.series[selectedMunicipality.idx])}
          months={data.months}
          monthIdx={monthIdx}
          t={t}
          language={language}
          profile={profile}
          isSample={isSample}
          onClose={function close() { setSelectedIdx(null); }}
        />
      )}

      <div className="scale">
        <span className="scale__title">{t('legendTitle')}</span>
        <div className="scale__bar" style={{ background: RAMP_GRADIENT_CSS }} />
        <div className="scale__ends"><span>{t('legendLow')}</span><span>{t('legendHigh')}</span></div>
      </div>

      <div className="timeline">
        <div className="segmented segmented--small" role="group" aria-label={t('month')}>
          <button type="button" aria-pressed={mode === 'acumulado'} onClick={function pick() { setMode('acumulado'); setIsPlaying(false); }}>{t('accumulated')}</button>
          <button type="button" aria-pressed={mode === 'mes'} onClick={function pick() { setMode('mes'); }}>{t('monthly')}</button>
        </div>
        <button type="button" className="icon-button icon-button--primary" onClick={togglePlay} aria-label={isPlaying ? t('pause') : t('play')} disabled={!isReady}>
          {isPlaying ? <IconPause /> : <IconPlay />}
        </button>
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
