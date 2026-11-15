// =====================================================================
// Dueño: P3 (Vista)
// Modelo común del informe: lo usan el PDF y el Excel. Se carga solo al exportar.
// El informe sale en español o inglés (quechua usa español).
// =====================================================================

import { makeTranslator, MONTH_NAMES, formatMonth } from './i18n.js';
import { medianForSameMonth, medianOf, sumSeries } from './geo.js';

function slug(text) {
  return String(text).toLowerCase().normalize('NFD').replace(/[^\x20-\x7e]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
}

function isoDate(date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}

function buildMatrix(months, values, monthLabels) {
  const rows = [];
  const byYear = {};
  let max = 0;
  let allInt = true;
  months.forEach(function place(month, i) {
    const year = month.slice(0, 4);
    if (!byYear[year]) {
      byYear[year] = { year: year, cells: new Array(12).fill(null), total: 0 };
      rows.push(byYear[year]);
    }
    const value = values[i];
    byYear[year].cells[Number.parseInt(month.slice(5, 7), 10) - 1] = value;
    byYear[year].total += value;
    if (value > max) {
      max = value;
    }
    if (Math.abs(value - Math.round(value)) > 1e-6) {
      allInt = false;
    }
  });
  const medians = [];
  for (let m = 0; m < 12; m = m + 1) {
    const list = [];
    rows.forEach(function collect(row) {
      if (row.cells[m] !== null) {
        list.push(row.cells[m]);
      }
    });
    medians.push(list.length > 0 ? medianOf(list) : null);
  }
  return { rows: rows, medians: medians, max: max, allInt: allInt, monthLabels: monthLabels };
}

function ensoOf(oni, month) {
  if (!oni || oni[month] === undefined) {
    return null;
  }
  return oni[month] >= 0.5 ? 'nino' : oni[month] <= -0.5 ? 'nina' : 'neutral';
}

function common(input, kind) {
  const lang = input.language === 'en' ? 'en' : 'es';
  const t = makeTranslator(lang);
  const locale = lang === 'en' ? 'en' : 'es';
  const now = new Date();
  const months = input.months;
  return {
    kind: kind,
    lang: lang,
    locale: locale,
    t: t,
    isSample: input.isSample === true,
    harmonized: input.harmonized !== false,
    title: t('printTitle'),
    sampleBanner: t('rpSampleBanner'),
    period: formatMonth(lang, months[0]) + ' – ' + formatMonth(lang, months[months.length - 1]),
    generated: now.toLocaleDateString(locale),
    isoDate: isoDate(now),
    monthLabels: MONTH_NAMES[lang],
    source: t('rpFooterSource'),
    method: t('printMethod')
  };
}

function numberText(value, locale, decimals) {
  return value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function notesFor(report, scopeLine) {
  const t = report.t;
  const notes = [
    [t('exScope'), scopeLine],
    [t('rpPeriod'), report.period],
    [t('exSource'), t('exSourceText')],
    [t('exMethod'), t('printMethod')],
    [t('exWarning'), t('exWarningText')],
    [t('exUnit'), t('exUnitText')],
    [t('elNinoTitle'), t('elNinoText') + ' ' + t('rpEnsoNote')]
  ];
  if (report.isSample) {
    notes.push([t('sample'), t('sampleLong')]);
  }
  notes.push([t('exLicenses'), t('exLicenseBounds')]);
  notes.push([t('exLicenseImagesLabel'), t('exLicenseImages')]);
  notes.push([t('exGenerated'), report.generated]);
  return notes;
}

export function buildFichaReport(input) {
  const { municipality, months, values, monthIdx, rank, count, oni } = input;
  const report = common(input, 'ficha');
  const t = report.t;
  const lang = report.lang;
  const name = municipality.name.replace('TIOC-', '');
  const index = Math.min(monthIdx, months.length - 1);
  const current = values[index] || 0;
  const same = medianForSameMonth(months, values, index);
  let percent = null;
  if (same.years > 0 && same.median > 0) {
    percent = Math.round(((current - same.median) / same.median) * 100);
  } else if (same.years > 0 && current === 0) {
    percent = 0;
  }
  const percentText = percent === null
    ? (same.years > 0 ? t('medianZero') : t('noMedian'))
    : percent === 0 ? t('atMedian') : percent > 0 ? t('aboveMedian', { pct: percent }) : t('belowMedian', { pct: Math.abs(percent) });
  const total = sumSeries(values);
  const matrix = buildMatrix(months, values, report.monthLabels);
  const decimals = matrix.allInt ? 0 : 1;
  const monthName = formatMonth(lang, months[index]);
  const ensoValue = oni ? oni[months[index]] : undefined;
  let enso = { phase: null, line: '' };
  if (ensoValue !== undefined) {
    const phase = ensoOf(oni, months[index]);
    const phaseText = t(phase === 'nino' ? 'ensoNino' : phase === 'nina' ? 'ensoNina' : 'ensoNeutral');
    enso = { phase: phase, line: t('ensoLine', { month: monthName, value: (ensoValue > 0 ? '+' : '') + ensoValue.toFixed(2), phase: phaseText }) };
  }
  const rankText = rank === null || rank === undefined ? '–' : rank + ' / ' + count;
  const scopeLine = name + ' · ' + t('province') + ' ' + municipality.province;
  return Object.assign(report, {
    subtitle: name,
    scope: scopeLine,
    fileScope: slug(name),
    meta: [
      [t('province'), municipality.province],
      [t('rpCapital'), municipality.capital || '–'],
      [t('rpArea'), Math.round(municipality.km2).toLocaleString(report.locale) + ' km²'],
      [t('rpRank'), rankText]
    ],
    facts: [
      { label: t('periodTotal'), value: numberText(total, report.locale, decimals), note: t('detections') },
      { label: t('thisMonth', { month: monthName }), value: numberText(current, report.locale, decimals), note: current === 1 ? t('detectionsOne') : t('detections') },
      { label: t('rpMedianSame'), value: same.years > 0 ? numberText(same.median, report.locale, 1) : '–', note: percentText },
      { label: t('rpRank'), value: rankText, note: t('rpRankNote') }
    ],
    years: matrix.rows.map(function pick(row) { return { year: row.year, total: row.total }; }),
    matrix: matrix,
    enso: enso,
    highlights: [],
    notes: notesFor(report, scopeLine)
  });
}

export function buildCalendarReport(input) {
  const { scopeName, months, series } = input;
  const report = common(input, 'calendar');
  const t = report.t;
  const matrix = buildMatrix(months, series, report.monthLabels);
  const decimals = matrix.allInt ? 0 : 1;
  const total = sumSeries(series);
  const topMonths = matrix.medians
    .map(function pair(value, i) { return { i: i, value: value === null ? -1 : value }; })
    .sort(function descending(a, b) { return b.value - a.value; })
    .slice(0, 3);
  const topYears = matrix.rows
    .map(function pick(row) { return { year: row.year, total: row.total }; })
    .sort(function descending(a, b) { return b.total - a.total; })
    .slice(0, 3);
  const scopeLine = t('calScope') + ': ' + scopeName;
  return Object.assign(report, {
    subtitle: t('rpCalendarTitle'),
    scope: scopeName,
    fileScope: 'calendario_' + slug(scopeName),
    meta: [],
    facts: [
      { label: t('periodTotal'), value: numberText(total, report.locale, decimals), note: t('detections') },
      { label: t('rpTopYear'), value: topYears[0].year, note: numberText(topYears[0].total, report.locale, decimals) + ' ' + t('detections') },
      { label: t('rpTopMonth'), value: report.monthLabels[topMonths[0].i], note: t('calMedian') + ': ' + numberText(Math.max(topMonths[0].value, 0), report.locale, 1) }
    ],
    years: matrix.rows.map(function pick(row) { return { year: row.year, total: row.total }; }),
    matrix: matrix,
    enso: { phase: null, line: '' },
    highlights: [
      {
        title: t('rpTopMonths'),
        items: topMonths.map(function item(entry, n) { return (n + 1) + '. ' + report.monthLabels[entry.i] + ' · ' + t('calMedian') + ' ' + numberText(Math.max(entry.value, 0), report.locale, 1); })
      },
      {
        title: t('rpTopYears'),
        items: topYears.map(function item(entry, n) { return (n + 1) + '. ' + entry.year + ' · ' + numberText(entry.total, report.locale, decimals) + ' ' + t('detections'); })
      }
    ],
    notes: notesFor(report, scopeLine)
  });
}
