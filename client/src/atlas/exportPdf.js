// =====================================================================
// Dueño: P3 (Vista)
// Informe PDF real (A4 vertical) dibujado con jsPDF: rectángulos, texto y Helvetica nativa.
// Sin dependencias extra: las tablas y el gráfico se dibujan a mano.
// jsPDF se carga con import() solo cuando se pulsa el botón.
// =====================================================================

import { rampColor, intensityRatio } from './ramp.js';
import { triggerDownload } from './download.js';

const PW = 210;
const M = 15;
const CW = 180;
const BOTTOM = 262;
const FOOT_LINE = 265.5;

const C = {
  green: [16, 36, 26],
  ink: [26, 42, 32],
  gray: [74, 90, 80],
  soft: [242, 246, 243],
  median: [228, 237, 231],
  rule: [207, 217, 210],
  amber: [224, 122, 47],
  amberBg: [255, 241, 214],
  amberInk: [122, 53, 0],
  white: [255, 255, 255],
  bandText: [214, 230, 218],
  bandSoft: [191, 216, 196],
  zero: [244, 244, 241],
  zeroInk: [138, 151, 142]
};
const ENSO_COLOR = { nino: [91, 124, 153], nina: [150, 186, 184], neutral: [150, 168, 156] };

function inkOn(color) {
  return (0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]) < 150 ? C.white : C.ink;
}

export async function downloadPdf(report) {
  const mod = await import('jspdf');
  const JsPdf = mod.jsPDF || mod.default;
  const doc = new JsPdf({ unit: 'mm', format: 'a4', orientation: 'portrait', compress: true });
  const t = report.t;
  const locale = report.locale;
  let y = 0;
  let pageNumber = 1;

  function fill(color) { doc.setFillColor(color[0], color[1], color[2]); }
  function stroke(color) { doc.setDrawColor(color[0], color[1], color[2]); }
  function ink(color) { doc.setTextColor(color[0], color[1], color[2]); }
  function font(style, size) {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
  }
  function format(value, decimals) {
    return value.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  const decimals = report.matrix.allInt ? 0 : 1;

  // ---------- cabecera de cada página ----------
  function sampleBox(top, height) {
    fill(C.amberBg);
    stroke(C.amber);
    doc.setLineWidth(0.4);
    doc.roundedRect(M, top, CW, height, 1.2, 1.2, 'FD');
    font('bold', height > 7 ? 9 : 8);
    ink(C.amberInk);
    doc.text(report.sampleBanner, PW / 2, top + height / 2 + 1.2, { align: 'center' });
  }

  function drawHeader(first) {
    fill(C.green);
    let bottom;
    if (first) {
      doc.rect(0, 0, PW, 36, 'F');
      font('bold', 17);
      ink(C.white);
      doc.text(report.title, M, 14.5);
      font('normal', 8);
      ink(C.bandSoft);
      doc.text(t('exGenerated') + ': ' + report.generated, PW - M, 10, { align: 'right' });
      font('bold', 11.5);
      ink(C.bandText);
      doc.text(report.subtitle, M, 23);
      font('normal', 8.5);
      ink(C.bandSoft);
      doc.text(doc.splitTextToSize(t('exScope') + ': ' + report.scope + '   ·   ' + t('rpPeriod') + ': ' + report.period, CW)[0], M, 30);
      bottom = 36;
    } else {
      doc.rect(0, 0, PW, 12, 'F');
      font('bold', 9);
      ink(C.white);
      doc.text(report.title, M, 7.6);
      font('normal', 8);
      ink(C.bandSoft);
      doc.text(report.subtitle, PW - M, 7.6, { align: 'right' });
      bottom = 12;
    }
    // franja con la rampa del atlas bajo la banda
    const slices = 42;
    const width = PW / slices;
    for (let i = 0; i < slices; i = i + 1) {
      fill(rampColor(i / (slices - 1)));
      doc.rect(i * width, bottom, width + 0.1, 1.3, 'F');
    }
    y = bottom + 5;
    if (report.isSample) {
      sampleBox(y, first ? 8.5 : 7);
      y += (first ? 8.5 : 7) + 5;
    } else {
      y += 2;
    }
  }

  function newPage() {
    doc.addPage();
    pageNumber += 1;
    drawHeader(false);
  }

  function ensureSpace(height) {
    if (y + height > BOTTOM) {
      newPage();
    }
  }

  function heading(text, keepWith) {
    ensureSpace(11 + (keepWith || 0));
    fill(C.amber);
    doc.rect(M, y + 1.2, 1.6, 4.4, 'F');
    font('bold', 11.5);
    ink(C.green);
    doc.text(text, M + 4, y + 5);
    stroke(C.rule);
    doc.setLineWidth(0.25);
    doc.line(M, y + 7.6, M + CW, y + 7.6);
    y += 11;
  }

  function paragraph(text, size, color, style, width, lead) {
    font(style || 'normal', size);
    ink(color);
    const lines = doc.splitTextToSize(text, width || CW);
    lines.forEach(function line(entry) {
      doc.text(entry, M, y);
      y += lead;
    });
  }

  // ---------- bloques ----------
  function nameBlock() {
    if (report.kind === 'ficha') {
      font('bold', 21);
      ink(C.green);
      doc.text(report.subtitle, M, y + 7);
      font('normal', 9.5);
      ink(C.gray);
      const meta = report.meta.map(function pair(entry) { return entry[0] + ' ' + entry[1]; }).join('   ·   ');
      doc.text(doc.splitTextToSize(meta, CW)[0], M, y + 13.5);
      y += 19;
    } else {
      font('bold', 16);
      ink(C.green);
      doc.text(report.scope, M, y + 6);
      font('normal', 9.5);
      ink(C.gray);
      doc.text(t('rpMatrix') + ' · ' + report.period, M, y + 12);
      y += 17;
    }
  }

  function cards() {
    const n = report.facts.length;
    const gap = 4;
    const width = (CW - gap * (n - 1)) / n;
    const height = 24;
    ensureSpace(height + 5);
    report.facts.forEach(function card(fact, i) {
      const x = M + i * (width + gap);
      fill(C.soft);
      stroke(C.rule);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, y, width, height, 1.5, 1.5, 'FD');
      fill(C.amber);
      doc.rect(x, y + 3, 0.9, 6, 'F');
      font('normal', 7);
      ink(C.gray);
      doc.splitTextToSize(fact.label, width - 7).slice(0, 2).forEach(function line(entry, k) {
        doc.text(entry, x + 3.5, y + 5.2 + k * 3);
      });
      let size = 17;
      font('bold', size);
      while (doc.getTextWidth(fact.value) > width - 7 && size > 9) {
        size -= 1;
        font('bold', size);
      }
      ink(C.green);
      doc.text(fact.value, x + 3.5, y + 15);
      font('normal', 6.8);
      ink(C.gray);
      doc.splitTextToSize(fact.note, width - 7).slice(0, 2).forEach(function line(entry, k) {
        doc.text(entry, x + 3.5, y + 18.6 + k * 2.8);
      });
    });
    y += height + 5;
  }

  function barChart() {
    const years = report.years;
    if (years.length === 0) {
      return;
    }
    const plotH = 30;
    ensureSpace(plotH + 28);
    heading(t('chartTitle'));
    const x0 = M + 11;
    const plotW = CW - 11;
    const maximum = Math.max.apply(null, years.map(function pick(e) { return e.total; }).concat([1]));
    const top = y + 4;
    const base = top + plotH;
    // líneas guía con la escala
    stroke(C.rule);
    doc.setLineWidth(0.2);
    font('normal', 6.5);
    ink(C.gray);
    [0, 0.5, 1].forEach(function guide(ratio) {
      const gy = base - plotH * ratio;
      doc.line(x0, gy, x0 + plotW, gy);
      doc.text(format(maximum * ratio, 0), x0 - 1.5, gy + 0.9, { align: 'right' });
    });
    const slot = plotW / years.length;
    const barW = Math.min(slot * 0.68, 12);
    let best = years[0];
    years.forEach(function pick(e) { if (e.total > best.total) { best = e; } });
    years.forEach(function bar(entry, i) {
      const ratio = entry.total / maximum;
      const h = Math.max(ratio * plotH, 0.5);
      const bx = x0 + i * slot + (slot - barW) / 2;
      fill(entry.total > 0 ? rampColor(intensityRatio(ratio, 1)) : C.zero);
      doc.rect(bx, base - h, barW, h, 'F');
      const showValue = years.length <= 15 || entry === best;
      if (showValue) {
        font(entry === best ? 'bold' : 'normal', 6.5);
        ink(entry === best ? C.green : C.gray);
        doc.text(format(entry.total, decimals), bx + barW / 2, base - h - 1.2, { align: 'center' });
      }
      font('normal', 6.5);
      ink(C.gray);
      doc.text(slot < 8 ? entry.year.slice(2) : entry.year, bx + barW / 2, base + 3.8, { align: 'center' });
    });
    stroke(C.gray);
    doc.setLineWidth(0.3);
    doc.line(x0, base, x0 + plotW, base);
    y = base + 8.5;
    paragraph(t('chartHelp'), 7.5, C.gray, 'normal', CW, 3.2);
    y += 3;
  }

  function dot(x, cy, color) {
    fill(color);
    doc.circle(x, cy, 1.4, 'F');
  }

  function ensoBlock() {
    ensureSpace(36);
    heading(t('elNinoTitle'));
    if (report.enso.line) {
      dot(M + 1.6, y - 0.8, ENSO_COLOR[report.enso.phase] || ENSO_COLOR.neutral);
      font('bold', 9);
      ink(C.ink);
      doc.text(report.enso.line, M + 5, y);
      y += 5.2;
    }
    let x = M + 1.6;
    [['nino', 'ensoNino'], ['nina', 'ensoNina'], ['neutral', 'ensoNeutral']].forEach(function legend(entry) {
      dot(x, y - 0.8, ENSO_COLOR[entry[0]]);
      font('normal', 7.5);
      ink(C.gray);
      doc.text(t(entry[1]), x + 3, y);
      x += 6 + doc.getTextWidth(t(entry[1])) + 5;
    });
    y += 5;
    paragraph(t('rpEnsoNote') + ' ' + t('elNinoText'), 8.5, C.gray, 'normal', CW, 3.8);
    y += 3;
  }

  // ---------- tabla de años y meses ----------
  const yearW = 17;
  const totalW = 25;
  const monthW = (CW - yearW - totalW) / 12;

  function matrixTable(colored) {
    const matrix = report.matrix;
    const rowH = colored ? 5.2 : 5.1;
    const headH = 6.4;
    const needed = headH + rowH * (matrix.rows.length + 1) + 11;
    if (y + needed > BOTTOM && needed <= BOTTOM - 49) {
      newPage();
    }
    heading(colored ? t('rpMatrix') : t('rpTableYears'), headH + rowH * 3);

    function headerRow() {
      fill(C.green);
      doc.rect(M, y, CW, headH, 'F');
      font('bold', 7.2);
      ink(C.white);
      doc.text(t('exYear'), M + 2, y + 4.3);
      report.monthLabels.forEach(function label(name, i) {
        doc.text(name, M + yearW + monthW * i + monthW / 2, y + 4.3, { align: 'center' });
      });
      doc.text(t('rpTotal'), M + CW - 2, y + 4.3, { align: 'right' });
      y += headH;
    }
    headerRow();
    matrix.rows.forEach(function row(entry, i) {
      if (y + rowH > BOTTOM) {
        newPage();
        headerRow();
      }
      if (!colored) {
        fill(i % 2 === 0 ? C.white : C.soft);
        doc.rect(M, y, CW, rowH, 'F');
      }
      font('bold', 7.5);
      ink(C.green);
      doc.text(entry.year, M + 2, y + rowH / 2 + 1.2);
      entry.cells.forEach(function cell(value, m) {
        const cx = M + yearW + monthW * m;
        if (value === null) {
          return;
        }
        if (colored) {
          const color = value <= 0 ? C.zero : rampColor(intensityRatio(value, matrix.max));
          fill(color);
          stroke(C.white);
          doc.setLineWidth(0.35);
          doc.rect(cx, y, monthW, rowH, 'FD');
          font('normal', 7);
          ink(value <= 0 ? C.zeroInk : inkOn(color));
          doc.text(format(value, decimals), cx + monthW / 2, y + rowH / 2 + 1.1, { align: 'center' });
        } else {
          font('normal', 7.2);
          ink(value <= 0 ? C.zeroInk : C.ink);
          doc.text(format(value, decimals), cx + monthW / 2, y + rowH / 2 + 1.1, { align: 'center' });
        }
      });
      font('bold', 7.5);
      ink(C.green);
      doc.text(format(entry.total, decimals), M + CW - 2, y + rowH / 2 + 1.2, { align: 'right' });
      if (!colored) {
        stroke(C.rule);
        doc.setLineWidth(0.15);
        doc.line(M, y + rowH, M + CW, y + rowH);
      }
      y += rowH;
    });
    if (y + rowH > BOTTOM) {
      newPage();
      headerRow();
    }
    fill(C.median);
    doc.rect(M, y, CW, rowH, 'F');
    font('bold', 6.8);
    ink(C.green);
    doc.text(t('rpMedianShort'), M + 2, y + rowH / 2 + 1.1);
    matrix.medians.forEach(function median(value, m) {
      if (value === null) {
        return;
      }
      doc.text(format(value, 1), M + yearW + monthW * m + monthW / 2, y + rowH / 2 + 1.1, { align: 'center' });
    });
    y += rowH + 4;
  }

  function legend() {
    ensureSpace(14);
    font('bold', 8);
    ink(C.green);
    doc.text(t('printLegend'), M, y + 3.4);
    font('normal', 7.5);
    ink(C.gray);
    const barX = M + 28;
    doc.text(t('rpLess'), barX - 2, y + 3.4, { align: 'right' });
    const slices = 60;
    const barW = 70;
    for (let i = 0; i < slices; i = i + 1) {
      const ratio = i / (slices - 1);
      fill(rampColor(ratio));
      doc.rect(barX + (barW / slices) * i, y, barW / slices + 0.1, 4.4, 'F');
    }
    doc.text(t('rpMore') + ' (' + format(report.matrix.max, decimals) + ')', barX + barW + 2, y + 3.4);
    fill(C.zero);
    stroke(C.rule);
    doc.setLineWidth(0.2);
    doc.rect(M + 135, y, 7, 4.4, 'FD');
    doc.text(t('rpNoDetections'), M + 144, y + 3.4);
    y += 10;
  }

  // Calendario: meses y años destacados y el contexto El Niño/La Niña en una sola fila
  function highlightsRow() {
    const height = 33;
    ensureSpace(height + 14);
    heading(t('rpHighlights'), height);
    const boxes = report.highlights.length + 1;
    const gap = 4;
    const width = (CW - gap * (boxes - 1)) / boxes;
    function box(i, title) {
      const x = M + i * (width + gap);
      fill(C.soft);
      stroke(C.rule);
      doc.setLineWidth(0.25);
      doc.roundedRect(x, y, width, height, 1.5, 1.5, 'FD');
      font('bold', 8.2);
      ink(C.green);
      doc.text(doc.splitTextToSize(title, width - 8)[0], x + 4, y + 6);
      return x;
    }
    report.highlights.forEach(function block(entry, i) {
      const x = box(i, entry.title);
      font('normal', 8);
      ink(C.ink);
      entry.items.forEach(function item(text, k) {
        doc.text(doc.splitTextToSize(text, width - 8)[0], x + 4, y + 12 + k * 5.4);
      });
    });
    const ex = box(boxes - 1, t('elNinoTitle'));
    font('bold', 7.6);
    ink(C.ink);
    doc.text(t('rpEnsoNote'), ex + 4, y + 11.2);
    [['nino', 'ensoNino'], ['nina', 'ensoNina'], ['neutral', 'ensoNeutral']].forEach(function legendItem(entry, k) {
      dot(ex + 5, y + 16.6 + k * 4.6, ENSO_COLOR[entry[0]]);
      font('normal', 7.4);
      ink(C.gray);
      doc.text(t(entry[1]), ex + 8.5, y + 17.4 + k * 4.6);
    });
    y += height + 5;
  }

  // ---------- composición ----------
  drawHeader(true);
  nameBlock();
  cards();
  if (report.kind === 'ficha') {
    barChart();
    ensoBlock();
    matrixTable(false);
  } else {
    matrixTable(true);
    legend();
    highlightsRow();
  }

  // ---------- pie de cada página (ya se conoce el total) ----------
  const total = doc.getNumberOfPages();
  for (let p = 1; p <= total; p = p + 1) {
    doc.setPage(p);
    stroke(C.rule);
    doc.setLineWidth(0.3);
    doc.line(M, FOOT_LINE, M + CW, FOOT_LINE);
    font('normal', 6.6);
    ink(C.gray);
    let fy = FOOT_LINE + 4;
    doc.splitTextToSize(report.source, CW).concat(doc.splitTextToSize(report.method, CW)).forEach(function line(entry) {
      doc.text(entry, M, fy);
      fy += 2.8;
    });
    font('bold', 7);
    ink(C.green);
    doc.text(p + ' / ' + total, M + CW, 281.5, { align: 'right' });
    font('normal', 6.6);
    ink(C.gray);
    doc.text(report.title + ' · ' + report.generated, M, 281.5);
  }

  doc.setProperties({ title: report.title + ' · ' + report.subtitle, subject: report.scope + ' · ' + report.period, author: 'NASA FIRMS (MODIS, VIIRS)', creator: report.title });
  const name = (report.isSample ? 'MUESTRA_' : '') + 'informe_' + report.fileScope + '_' + report.isoDate + '.pdf';
  triggerDownload(doc.output('blob'), name);
}
