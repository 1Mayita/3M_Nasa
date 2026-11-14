// =====================================================================
// Dueño: P3 (Vista)
// Ficha del municipio: lo que dicen los focos, frente a la mediana, con calendario.
// Entra desde la derecha; cambia el orden de los bloques según el perfil.
// =====================================================================

import { useEffect, useMemo, useRef } from 'react';
import gsap from 'gsap';
import { formatMonth } from './i18n.js';
import { medianForSameMonth, sumSeries } from './geo.js';
import { rampCss, intensityRatio } from './ramp.js';
import { IconClose, IconDownload } from './Icons.jsx';

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function buildCalendar(months, values) {
  const years = [];
  const rowByYear = {};
  months.forEach(function place(month, i) {
    const year = month.slice(0, 4);
    if (rowByYear[year] === undefined) {
      rowByYear[year] = { year: year, cells: new Array(12).fill(null) };
      years.push(rowByYear[year]);
    }
    rowByYear[year].cells[Number.parseInt(month.slice(5, 7), 10) - 1] = { month: month, value: values[i] };
  });
  return years;
}

function downloadCsv(municipality, months, values) {
  const rows = ['mes,detecciones_equivalente_viirs'];
  months.forEach(function addRow(month, i) {
    rows.push(month + ',' + Math.round(values[i] * 10) / 10);
  });
  const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'focos_' + municipality.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') + '.csv';
  link.click();
  URL.revokeObjectURL(url);
}

export default function Ficha(props) {
  const { municipality, values, months, monthIdx, rank, total: municipalityCount, levelRatio, oni, t, language, profile, isSample, onClose } = props;
  const panelRef = useRef(null);
  const figureRef = useRef(null);

  const total = useMemo(function computeTotal() {
    return sumSeries(values);
  }, [values]);

  const reference = useMemo(
    function computeReference() {
      const index = Math.min(monthIdx, months.length - 1);
      const current = values[index] || 0;
      const sameMonth = medianForSameMonth(months, values, index);
      let percent = null;
      if (sameMonth.years > 0 && sameMonth.median > 0) {
        percent = Math.round(((current - sameMonth.median) / sameMonth.median) * 100);
      } else if (sameMonth.years > 0 && current === 0) {
        percent = 0;
      }
      return { index: index, current: current, median: sameMonth.median, years: sameMonth.years, percent: percent };
    },
    [values, months, monthIdx]
  );

  const calendar = useMemo(function computeCalendar() {
    return buildCalendar(months, values);
  }, [months, values]);

  const calendarMax = useMemo(function computeMax() {
    let maximum = 0;
    for (let i = 0; i < values.length; i = i + 1) {
      if (values[i] > maximum) {
        maximum = values[i];
      }
    }
    return maximum;
  }, [values]);

  // Entrada animada: el panel desliza, las casillas del calendario se encienden una a una
  useEffect(
    function animateIn() {
      if (prefersReducedMotion() || !panelRef.current) {
        return undefined;
      }
      const context = gsap.context(function build() {
        gsap.fromTo(panelRef.current, { x: 56, opacity: 0 }, { x: 0, opacity: 1, duration: 0.7, ease: 'expo.out' });
        gsap.fromTo('.ficha__block', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out', stagger: 0.08, delay: 0.15 });
        gsap.fromTo('.cal__cell', { scale: 0.4, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.45, ease: 'expo.out', stagger: { each: 0.004, from: 'start' }, delay: 0.35 });
        if (figureRef.current) {
          const counter = { value: 0 };
          gsap.to(counter, {
            value: reference.current,
            duration: 1.1,
            ease: 'expo.out',
            delay: 0.3,
            onUpdate: function write() {
              if (figureRef.current) {
                figureRef.current.textContent = String(Math.round(counter.value));
              }
            }
          });
        }
      }, panelRef);
      return function cleanup() {
        context.revert();
      };
    },
    // Reanimar solo al cambiar de municipio
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [municipality.idx]
  );

  const percentText = reference.percent === null
    ? (reference.years > 0 ? t('medianZero') : t('noMedian'))
    : reference.percent === 0
      ? t('atMedian')
      : reference.percent > 0
        ? t('aboveMedian', { pct: reference.percent })
        : t('belowMedian', { pct: Math.abs(reference.percent) });

  const ensoValue = oni ? oni[months[reference.index]] : undefined;
  let ensoText = null;
  if (ensoValue !== undefined) {
    const phaseKey = ensoValue >= 0.5 ? 'ensoNino' : ensoValue <= -0.5 ? 'ensoNina' : 'ensoNeutral';
    ensoText = t('ensoLine', { month: formatMonth(language, months[reference.index]), value: (ensoValue > 0 ? '+' : '') + ensoValue.toFixed(2), phase: t(phaseKey) });
  }

  const isTioc = municipality.name.toLowerCase().indexOf('tioc') === 0;

  const comparisonBlock = (
    <section className="ficha__block" key="comparison" aria-labelledby="ficha-compare">
      <h3 id="ficha-compare">{t('thisMonth', { month: formatMonth(language, months[reference.index]) })}</h3>
      <p className="ficha__sentence">
        <strong className="ficha__figure" ref={figureRef}>{Math.round(reference.current)}</strong>{' '}
        {reference.current === 1 ? t('detectionsOne') : t('detections')}
      </p>
      <p className={'ficha__delta' + (reference.percent !== null && reference.percent > 0 ? ' is-up' : '')}>{percentText}</p>
      {reference.years > 0 && (
        <p className="ficha__muted">{t('vsMedian', { median: Math.round(reference.median * 10) / 10, years: reference.years })}</p>
      )}
      <p className="ficha__muted">{t('periodTotal')}: {Math.round(total)} {t('detections')}</p>
    </section>
  );

  const calendarBlock = (
    <section className="ficha__block" key="calendar" aria-labelledby="ficha-calendar">
      <h3 id="ficha-calendar">{t('calendarTitle')}</h3>
      <p className="ficha__muted">{t('calendarHelp')}</p>
      <div className="cal" role="img" aria-label={t('calendarTitle')}>
        <div className="cal__head" aria-hidden="true">
          <span />
          {['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map(function letter(l, i) {
            return <span key={i}>{l}</span>;
          })}
        </div>
        {calendar.map(function row(yearRow) {
          return (
            <div className="cal__row" key={yearRow.year}>
              <span className="cal__year">{yearRow.year.slice(2)}</span>
              {yearRow.cells.map(function cell(entry, i) {
                if (entry === null) {
                  return <span className="cal__cell is-empty" key={i} />;
                }
                const background = entry.value <= 0 ? undefined : rampCss(intensityRatio(entry.value, calendarMax));
                return (
                  <span
                    className={'cal__cell' + (entry.value <= 0 ? ' is-zero' : '')}
                    key={i}
                    style={background ? { background: background } : undefined}
                    title={formatMonth(language, entry.month) + ': ' + Math.round(entry.value * 10) / 10}
                  />
                );
              })}
            </div>
          );
        })}
      </div>
    </section>
  );

  const nietoBlock = (
    <section className="ficha__block ficha__context" key="nino" aria-labelledby="ficha-nino">
      <h3 id="ficha-nino">{t('elNinoTitle')}</h3>
      <p>{t('elNinoText')}</p>
      {ensoText !== null && <p className="ficha__enso">{ensoText}</p>}
    </section>
  );

  const citizenBlock = (
    <section className="ficha__block" key="citizen" aria-labelledby="ficha-citizen">
      <h3 id="ficha-citizen">{t('citizenTitle')}</h3>
      <p>{t('citizenText')}</p>
      <h3 id="ficha-season">{t('seasonTitle')}</h3>
      <p>{t('seasonText')}</p>
    </section>
  );

  let blocks;
  if (profile === 'ciudadano') {
    blocks = [citizenBlock, comparisonBlock, calendarBlock, nietoBlock];
  } else if (profile === 'gestor') {
    blocks = [calendarBlock, comparisonBlock, nietoBlock];
  } else {
    blocks = [comparisonBlock, calendarBlock, nietoBlock];
  }

  return (
    <aside className="ficha" ref={panelRef} aria-label={municipality.name}>
      <header className="ficha__header">
        <div>
          <h2>{municipality.name.replace('TIOC-', '')}</h2>
          <p className="ficha__muted">
            {t('province')} {municipality.province} · {Math.round(municipality.km2).toLocaleString(language === 'en' ? 'en' : 'es')} km²
          </p>
          {isTioc && <p className="ficha__muted">{t('nameTiocNote')}</p>}
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label={t('close')}>
          <IconClose />
        </button>
      </header>
      <div className="ficha__meter" aria-hidden="true">
        <span style={{ width: Math.max(levelRatio * 100, 3) + '%', background: rampCss(intensityRatio(levelRatio, 1)) }} />
      </div>
      {rank !== null && <p className="ficha__muted ficha__rank">{t('rankLine', { rank: rank, total: municipalityCount })}</p>}
      {isSample && <p className="tag-sample">{t('sample')}</p>}
      {blocks}
      <p className="ficha__muted ficha__note">{t('sensorNote')}</p>
      <button type="button" className="button-ghost" onClick={function download() { downloadCsv(municipality, months, values); }}>
        <IconDownload /> {t('download')}
      </button>
    </aside>
  );
}
