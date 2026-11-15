// =====================================================================
// Dueño: P3 (Vista)
// Página "Calendario": meses × años del departamento o de un municipio, en cantidad o
// en anomalía frente a la mediana del mismo mes, con la fase de El Niño/La Niña (ONI) como contexto.
// =====================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import gsap from 'gsap';
import Banner from './Banner.jsx';
import SiteFooter from './SiteFooter.jsx';

const BANNER_IMAGE = (import.meta.env.BASE_URL || '/') + 'img/valle_alto.webp';
import { MONTH_NAMES, formatMonth } from './i18n.js';
import { medianOf } from './geo.js';
import { rampColor, intensityRatio } from './ramp.js';
import { IconDownload, IconPrint, IconSheet } from './Icons.jsx';
import { downloadCsv, downloadXlsx, printView } from './exportData.js';

const ANOMALY_CLASSES = [
  { max: -50, color: [63, 107, 88], key: 'calClassLowest' },
  { max: -25, color: [122, 154, 91], key: 'calClassLow' },
  { max: 24, color: [191, 216, 196], key: 'calClassSame' },
  { max: 49, color: [246, 196, 106], key: 'calClassHigh' },
  { max: 74, color: [240, 150, 70], key: 'calClassHigher' },
  { max: Infinity, color: [224, 122, 47], key: 'calClassHighest' }
];

function classForPercent(percent) {
  for (let i = 0; i < ANOMALY_CLASSES.length; i = i + 1) {
    if (percent <= ANOMALY_CLASSES[i].max) {
      return ANOMALY_CLASSES[i];
    }
  }
  return ANOMALY_CLASSES[ANOMALY_CLASSES.length - 1];
}

function relativeLuminance(color) {
  function channel(value) {
    const scaled = value / 255;
    return scaled <= 0.03928 ? scaled / 12.92 : Math.pow((scaled + 0.055) / 1.055, 2.4);
  }
  return 0.2126 * channel(color[0]) + 0.7152 * channel(color[1]) + 0.0722 * channel(color[2]);
}

// elige la tinta (oscura o clara) con mayor contraste WCAG sobre el color de la casilla
function inkFor(color) {
  const luminance = relativeLuminance(color);
  const darkContrast = (luminance + 0.05) / (relativeLuminance([22, 37, 28]) + 0.05);
  const lightContrast = (relativeLuminance([241, 247, 242]) + 0.05) / (luminance + 0.05);
  return darkContrast >= lightContrast ? '#16251c' : '#f1f7f2';
}

function ensoOf(oni, month) {
  if (!oni || oni[month] === undefined) {
    return null;
  }
  return oni[month] >= 0.5 ? 'nino' : oni[month] <= -0.5 ? 'nina' : 'neutral';
}

function buildExport(scopeName, months, values, medians, isSample, t, language) {
  return {
    fileBase: 'calendario_focos_' + scopeName.toLowerCase().normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, ''),
    sheetName: t('exSheetData'),
    notesName: t('exSheetNotes'),
    title: t('printTitle') + ' · ' + scopeName,
    language: language,
    isSample: isSample,
    sampleText: 'MUESTRA SINTÉTICA / SYNTHETIC SAMPLE · ' + t('sampleLong'),
    headers: [
      { label: t('calScope'), width: 26, type: 'text' },
      { label: t('exMonth'), width: 12, type: 'text' },
      { label: t('exDetectionsViirs'), width: 28, type: 'dec' },
      { label: t('exMedian'), width: 20, type: 'dec' },
      { label: t('exSampleCol'), width: 18, type: 'text' }
    ],
    rows: months.map(function row(month, i) {
      return [scopeName, month, values[i], medians[Number.parseInt(month.slice(5, 7), 10) - 1], isSample ? t('exYes') : t('exNo')];
    }),
    notes: [
      [t('exScope'), scopeName],
      [t('exSource'), t('exSourceText')],
      [t('exWarning'), t('exWarningText')],
      [t('exUnit'), t('exUnitText')],
      [t('exMedian'), t('printMethod')],
      [t('exGenerated'), new Date().toLocaleDateString(language === 'en' ? 'en' : 'es')]
    ]
  };
}

export default function CalendarPage(props) {
  const { data, aggregated, geo, oni, t, language, isSample } = props;
  const [scopeIdx, setScopeIdx] = useState(-1);
  const [mode, setMode] = useState('count');
  const [tip, setTip] = useState(null);
  const pageRef = useRef(null);

  const months = data.months;

  const series = useMemo(
    function computeSeries() {
      if (scopeIdx >= 0) {
        return Array.from(aggregated.series[scopeIdx]);
      }
      const total = new Array(months.length).fill(0);
      aggregated.series.forEach(function add(municipalitySeries) {
        for (let i = 0; i < months.length; i = i + 1) {
          total[i] += municipalitySeries[i];
        }
      });
      return total;
    },
    [aggregated, scopeIdx, months]
  );

  const medians = useMemo(
    function computeMedians() {
      const perMonth = [];
      for (let calendarMonth = 0; calendarMonth < 12; calendarMonth = calendarMonth + 1) {
        const values = [];
        months.forEach(function collect(month, i) {
          if (Number.parseInt(month.slice(5, 7), 10) - 1 === calendarMonth) {
            values.push(series[i]);
          }
        });
        perMonth.push(medianOf(values));
      }
      return perMonth;
    },
    [months, series]
  );

  const rows = useMemo(
    function buildRows() {
      const list = [];
      const byYear = {};
      months.forEach(function place(month, i) {
        const year = month.slice(0, 4);
        if (!byYear[year]) {
          byYear[year] = { year: year, cells: new Array(12).fill(null) };
          list.push(byYear[year]);
        }
        byYear[year].cells[Number.parseInt(month.slice(5, 7), 10) - 1] = { month: month, value: series[i] };
      });
      return list;
    },
    [months, series]
  );

  const maxValue = useMemo(function computeMax() {
    return Math.max.apply(null, series.concat([1]));
  }, [series]);

  const summary = useMemo(
    function computeSummary() {
      const ranked = medians
        .map(function pair(value, calendarMonth) {
          return { calendarMonth: calendarMonth, value: value };
        })
        .sort(function descending(a, b) {
          return b.value - a.value;
        })
        .slice(0, 3)
        .map(function name(entry) {
          return (MONTH_NAMES[language] || MONTH_NAMES.es)[entry.calendarMonth];
        });
      const yearTotals = rows.map(function sum(row) {
        let total = 0;
        row.cells.forEach(function add(cell) {
          total += cell ? cell.value : 0;
        });
        return { year: row.year, total: total };
      });
      yearTotals.sort(function descending(a, b) {
        return b.total - a.total;
      });
      return { topMonths: ranked, topYears: yearTotals.slice(0, 3) };
    },
    [medians, rows, language]
  );

  const scopeName = scopeIdx >= 0 ? geo.municipalities[scopeIdx].name.replace('TIOC-', '') : t('calScopeAll');
  const monthLabels = MONTH_NAMES[language] || MONTH_NAMES.es;
  const sortedMunicipalities = useMemo(
    function sortNames() {
      return geo.municipalities.slice().sort(function alphabetical(a, b) {
        return a.name.localeCompare(b.name, 'es');
      });
    },
    [geo]
  );

  useEffect(function focusTitle() {
    const heading = document.getElementById('cal-title');
    if (heading) {
      heading.focus({ preventScroll: true });
    }
  }, []);

  useEffect(function animateIn() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !pageRef.current) {
      return undefined;
    }
    const context = gsap.context(function build() {
      gsap.from('.page__head > *', { y: 22, opacity: 0, duration: 0.8, ease: 'expo.out', stagger: 0.09, delay: 0.55 });
      gsap.from('.calgrid__row', { y: 14, opacity: 0, duration: 0.6, ease: 'expo.out', stagger: 0.035, delay: 0.75 });
      gsap.from('.calside > *', { x: 24, opacity: 0, duration: 0.7, ease: 'expo.out', stagger: 0.1, delay: 0.9 });
    }, pageRef);
    return function cleanup() {
      context.revert();
    };
  }, []);

  function exportSpec() {
    return buildExport(scopeName, months, series, medians, isSample, t, language);
  }

  function showTip(event, cell, color) {
    const calendarMonth = Number.parseInt(cell.month.slice(5, 7), 10) - 1;
    const median = medians[calendarMonth];
    const percent = median > 0 ? Math.round(((cell.value - median) / median) * 100) : null;
    setTip({ x: event.clientX, y: event.clientY, month: cell.month, value: cell.value, median: median, percent: percent, enso: ensoOf(oni, cell.month), color: color });
  }

  return (
    <section className="page page--calendar" ref={pageRef} aria-labelledby="cal-title">
      <Banner image={BANNER_IMAGE} label={t('aiPrefix') + t('capValleAlto')}>
        <div className="page__head">
          <h1 id="cal-title" tabIndex={-1}>{t('calTitle')}</h1>
          <p className="page__lead">{t('calLead')}</p>
        </div>
      </Banner>
      <div className="page__inner page__inner--banner">
        <div className="print-only print-head">
          <p className="print-kicker">{t('printTitle')}</p>
          <h1>{t('calTitle')}</h1>
          <p className="print-scope">{scopeName} · {mode === 'count' ? t('calCount') : t('calAnomaly')}</p>
          {isSample && <p className="tag-sample">{t('sample')} · {t('sampleLong')}</p>}
        </div>
        <header className="page__head">
          <div className="page__tools">
            <label className="field">
              <span>{t('calScope')}</span>
              <select value={scopeIdx} onChange={function change(event) { setScopeIdx(Number.parseInt(event.target.value, 10)); }}>
                <option value={-1}>{t('calScopeAll')}</option>
                {sortedMunicipalities.map(function option(municipality) {
                  return <option key={municipality.idx} value={municipality.idx}>{municipality.name.replace('TIOC-', '')}</option>;
                })}
              </select>
            </label>
            <div className="segmented segmented--small" role="group" aria-label={t('calMode')}>
              <button type="button" aria-pressed={mode === 'count'} onClick={function pick() { setMode('count'); }}>{t('calCount')}</button>
              <button type="button" aria-pressed={mode === 'anomaly'} onClick={function pick() { setMode('anomaly'); }}>{t('calAnomaly')}</button>
            </div>
            <button type="button" className="button-ghost" onClick={function csv() { downloadCsv(exportSpec()); }}><IconDownload /> {t('download')}</button>
            <button type="button" className="button-ghost" onClick={function excel() { downloadXlsx(exportSpec()); }}><IconSheet /> {t('downloadExcel')}</button>
            <button type="button" className="button-ghost" onClick={function print() { printView('is-printing-cal'); }}><IconPrint /> {t('printPdf')}</button>
            {isSample && <span className="tag-sample">{t('sample')}</span>}
          </div>
        </header>

        <div className="calwrap">
          <div className="calgrid" role="table" aria-label={t('calTitle') + ': ' + scopeName}>
            <div className="calgrid__head" role="row">
              <span role="columnheader" />
              {monthLabels.map(function monthName(name) {
                return <span role="columnheader" key={name}>{name}</span>;
              })}
            </div>
            {rows.map(function yearRow(row) {
              return (
                <div className="calgrid__row" role="row" key={row.year}>
                  <span className="calgrid__year" role="rowheader">{row.year}</span>
                  {row.cells.map(function cell(entry, i) {
                    if (entry === null) {
                      return <span className="calcell is-none" role="cell" key={i} />;
                    }
                    const calendarMonth = i;
                    const median = medians[calendarMonth];
                    let color;
                    if (mode === 'count') {
                      color = entry.value <= 0 ? null : rampColor(intensityRatio(entry.value, maxValue));
                    } else if (median <= 0) {
                      color = null;
                    } else {
                      color = classForPercent(((entry.value - median) / median) * 100).color;
                    }
                    const enso = ensoOf(oni, entry.month);
                    const style = color
                      ? { background: 'rgb(' + color.join(',') + ')', color: inkFor(color) }
                      : undefined;
                    return (
                      <span
                        className={'calcell' + (color ? '' : ' is-zero') + (enso ? ' enso-' + enso : '')}
                        role="cell"
                        tabIndex={0}
                        key={i}
                        style={style}
                        aria-label={formatMonth(language, entry.month) + ': ' + Math.round(entry.value) + ' ' + t('detections') + '. ' + t('calMedian') + ': ' + Math.round(median * 10) / 10 + (median > 0 ? ', ' + (Math.round(((entry.value - median) / median) * 100) > 0 ? '+' : '') + Math.round(((entry.value - median) / median) * 100) + ' %' : '') + (enso ? ', ' + t(enso === 'nino' ? 'ensoNino' : enso === 'nina' ? 'ensoNina' : 'ensoNeutral') : '')}
                        onMouseEnter={function enter(event) { showTip(event, entry, color); }}
                        onMouseMove={function move(event) { showTip(event, entry, color); }}
                        onMouseLeave={function leave() { setTip(null); }}
                        onFocus={function focus(event) {
                          const box = event.currentTarget.getBoundingClientRect();
                          showTip({ clientX: box.right, clientY: box.top }, entry, color);
                        }}
                        onBlur={function blur() { setTip(null); }}
                      >
                        {entry.value > 0 ? Math.round(entry.value) : ''}
                      </span>
                    );
                  })}
                </div>
              );
            })}
          </div>

          <aside className="calside">
            <section>
              <h2>{t('calReadTitle')}</h2>
              <p>{mode === 'count' ? t('calReadCount') : t('calReadAnomaly')}</p>
              {mode === 'anomaly' && (
                <ul className="calclasses">
                  {ANOMALY_CLASSES.map(function item(entry) {
                    return (
                      <li key={entry.key}>
                        <i style={{ background: 'rgb(' + entry.color.join(',') + ')' }} /> {t(entry.key)}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
            <section>
              <h2>{t('calSummaryTitle')}</h2>
              <p>{t('calTopMonths', { months: summary.topMonths.join(', ') })}</p>
              <p>{t('calTopYears', { years: summary.topYears.map(function y(entry) { return entry.year; }).join(', ') })}</p>
            </section>
            <section className="calside__enso">
              <h2>{t('elNinoTitle')}</h2>
              <p>
                <i className="dot dot--nino" /> {t('ensoNino')} · <i className="dot dot--nina" /> {t('ensoNina')}
              </p>
              <p className="muted">{t('calEnsoNote')}</p>
            </section>
          </aside>
        </div>
        <div className="print-only print-foot">
          <p>{t('printSource')}</p>
          <p>{t('printMethod')}</p>
          <p>{mode === 'count' ? t('printLegendCount') : ''}</p>
          <p>{t('printGenerated', { date: new Date().toLocaleDateString(language === 'en' ? 'en' : 'es') })}</p>
        </div>
      </div>

      <SiteFooter t={t} />

      {tip !== null && (
        <div className="cal-tip" style={{ left: Math.min(tip.x + 16, window.innerWidth - 250), top: Math.min(Math.max(tip.y - 10, 8), window.innerHeight - 150) }} role="presentation">
          <strong>{formatMonth(language, tip.month)}</strong>
          <span>{Math.round(tip.value * 10) / 10} {t('detections')}</span>
          <span>{t('calMedian')}: {Math.round(tip.median * 10) / 10}</span>
          <span>{tip.percent === null ? t('noMedian') : (tip.percent > 0 ? '+' : '') + tip.percent + ' %'}</span>
          {tip.enso !== null && <span>{t(tip.enso === 'nino' ? 'ensoNino' : tip.enso === 'nina' ? 'ensoNina' : 'ensoNeutral')}</span>}
        </div>
      )}
    </section>
  );
}
