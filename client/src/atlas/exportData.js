// =====================================================================
// Dueño: P3 (Vista)
// Libro .xlsx hecho a mano, sin librerías: zip sin comprimir + XML (Resumen, Datos, Notas) con
// estilos reales (fuentes, rellenos, bordes, formatos numéricos), encabezado fijo, autofiltro
// y relleno por valor con la rampa verde→ámbar del atlas. Se carga solo al pulsar el botón.
// =====================================================================

import { rampColor, intensityRatio } from './ramp.js';
import { triggerDownload } from './download.js';

const encoder = new TextEncoder();
const GREEN = 'FF10241A';
const AMBER_BG = 'FFFFE9C2';
const AMBER_INK = 'FF7A3500';
const BORDER = 'FFD3DED6';
const BAND_SOFT = 'FFF2F6F3';
const BAND_MEDIAN = 'FFE4EDE7';

// ---------- zip "stored": válido para Excel y LibreOffice ----------
const CRC_TABLE = (function makeTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n = n + 1) {
    let c = n;
    for (let k = 0; k < 8; k = k + 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i = i + 1) {
    crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function buildZip(files) {
  const now = new Date();
  const dosTime = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
  const dosDate = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [];
  const central = [];
  let offset = 0;
  files.forEach(function add(file) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint16(10, dosTime, true);
    local.setUint16(12, dosDate, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, data);
    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, 0, true);
    entry.setUint16(12, dosTime, true);
    entry.setUint16(14, dosDate, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);
    offset += 30 + name.length + data.length;
  });
  let centralSize = 0;
  central.forEach(function size(chunk) { centralSize += chunk.length; });
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);
  return new Blob(parts.concat(central, [new Uint8Array(end.buffer)]), {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

function xml(text) {
  return String(text)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function columnName(index) {
  let name = '';
  let n = index + 1;
  while (n > 0) {
    const rest = (n - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    n = Math.floor((n - 1) / 26);
  }
  return name;
}

function hexOf(color) {
  return 'FF' + color.map(function pad(v) { return v.toString(16).padStart(2, '0'); }).join('').toUpperCase();
}

// ---------- registro de estilos: cada combinación recibe un índice de cellXfs ----------
function makeStyles() {
  const fonts = [];
  const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
  const borders = [];
  const formats = [];
  const xfs = [];
  const cache = {};
  function indexOf(list, item) {
    let i = list.indexOf(item);
    if (i < 0) {
      list.push(item);
      i = list.length - 1;
    }
    return i;
  }
  function formatId(code) {
    if (!code || code === 'General') {
      return 0;
    }
    if (code === '#,##0') {
      return 3;
    }
    return 164 + indexOf(formats, code);
  }
  function side(name) {
    return '<' + name + ' style="thin"><color rgb="' + BORDER + '"/></' + name + '>';
  }
  function style(o) {
    const key = JSON.stringify(o);
    if (cache[key] !== undefined) {
      return cache[key];
    }
    const font = '<font>' + (o.bold ? '<b/>' : '') + (o.italic ? '<i/>' : '') + '<sz val="' + (o.size || 11) + '"/><color rgb="' + (o.color || 'FF1A2A20') + '"/><name val="Calibri"/><family val="2"/></font>';
    const fill = o.fill ? '<fill><patternFill patternType="solid"><fgColor rgb="' + o.fill + '"/><bgColor indexed="64"/></patternFill></fill>' : fills[0];
    const border = o.border
      ? '<border>' + side('left') + side('right') + side('top') + side('bottom') + '<diagonal/></border>'
      : o.rule
        ? '<border><left/><right/><top/><bottom style="medium"><color rgb="' + o.rule + '"/></bottom><diagonal/></border>'
        : '<border><left/><right/><top/><bottom/><diagonal/></border>';
    const f = indexOf(fonts, font);
    const fl = indexOf(fills, fill);
    const b = indexOf(borders, border);
    const n = formatId(o.format);
    const alignment = '<alignment' + (o.h ? ' horizontal="' + o.h + '"' : '') + ' vertical="' + (o.v || 'center') + '"' + (o.wrap ? ' wrapText="1"' : '') + (o.indent ? ' indent="' + o.indent + '"' : '') + '/>';
    xfs.push('<xf numFmtId="' + n + '" fontId="' + f + '" fillId="' + fl + '" borderId="' + b + '" xfId="0" applyNumberFormat="1" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' + alignment + '</xf>');
    cache[key] = xfs.length - 1;
    return cache[key];
  }
  function toXml() {
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      (formats.length > 0 ? '<numFmts count="' + formats.length + '">' + formats.map(function fmt(code, i) { return '<numFmt numFmtId="' + (164 + i) + '" formatCode="' + xml(code) + '"/>'; }).join('') + '</numFmts>' : '') +
      '<fonts count="' + fonts.length + '">' + fonts.join('') + '</fonts>' +
      '<fills count="' + fills.length + '">' + fills.join('') + '</fills>' +
      '<borders count="' + borders.length + '">' + borders.join('') + '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + xfs.length + '">' + xfs.join('') + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
  }
  style({}); // índice 0: estilo por defecto
  return { style: style, toXml: toXml };
}

// ---------- hoja: filas, celdas, combinaciones ----------
function makeSheet() {
  const rows = [];
  const merges = [];
  function row(r, height) {
    const entry = { r: r, height: height || 0, cells: [] };
    rows.push(entry);
    return {
      text: function text(c, value, s) {
        entry.cells.push('<c r="' + columnName(c) + r + '" s="' + s + '" t="inlineStr"><is><t xml:space="preserve">' + xml(value) + '</t></is></c>');
      },
      number: function number(c, value, s) {
        entry.cells.push('<c r="' + columnName(c) + r + '" s="' + s + '"><v>' + (Number.isFinite(value) ? value : 0) + '</v></c>');
      },
      blank: function blank(c, s) {
        entry.cells.push('<c r="' + columnName(c) + r + '" s="' + s + '"/>');
      }
    };
  }
  function merge(r1, c1, r2, c2) {
    merges.push(columnName(c1) + r1 + ':' + columnName(c2) + r2);
  }
  function toXml(opts) {
    const cols = '<cols>' + opts.widths.map(function col(width, i) {
      return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + width + '" customWidth="1"/>';
    }).join('') + '</cols>';
    const sheetData = rows.map(function line(entry) {
      return '<row r="' + entry.r + '"' + (entry.height ? ' ht="' + entry.height + '" customHeight="1"' : '') + '>' + entry.cells.join('') + '</row>';
    }).join('');
    const lastRow = rows.length > 0 ? rows[rows.length - 1].r : 1;
    let view = '<sheetView workbookViewId="0"' + (opts.grid === false ? ' showGridLines="0"' : '') + (opts.selected ? ' tabSelected="1"' : '') + '>';
    if (opts.freeze) {
      view += '<pane xSplit="' + opts.freeze.cols + '" ySplit="' + opts.freeze.rows + '" topLeftCell="' + columnName(opts.freeze.cols) + (opts.freeze.rows + 1) + '" activePane="bottomRight" state="frozen"/>' +
        '<selection pane="topRight"/><selection pane="bottomLeft"/><selection pane="bottomRight" activeCell="' + columnName(opts.freeze.cols) + (opts.freeze.rows + 1) + '" sqref="' + columnName(opts.freeze.cols) + (opts.freeze.rows + 1) + '"/>';
    }
    view += '</sheetView>';
    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<sheetPr><tabColor rgb="' + (opts.tab || GREEN) + '"/><pageSetUpPr fitToPage="1"/></sheetPr>' +
      '<dimension ref="A1:' + columnName(opts.widths.length - 1) + lastRow + '"/>' +
      '<sheetViews>' + view + '</sheetViews>' +
      '<sheetFormatPr defaultRowHeight="15"/>' + cols +
      '<sheetData>' + sheetData + '</sheetData>' +
      (opts.filter ? '<autoFilter ref="' + opts.filter + '"/>' : '') +
      (merges.length > 0 ? '<mergeCells count="' + merges.length + '">' + merges.map(function m(ref) { return '<mergeCell ref="' + ref + '"/>'; }).join('') + '</mergeCells>' : '') +
      '<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/>' +
      '<pageSetup paperSize="9" orientation="' + (opts.landscape ? 'landscape' : 'portrait') + '" fitToWidth="1" fitToHeight="0"/>' +
      '</worksheet>';
  }
  return { row: row, merge: merge, toXml: toXml };
}

function wrapHeight(text, charsPerLine, base) {
  const lines = Math.max(1, Math.ceil(String(text).length / charsPerLine));
  return Math.max(base, 15 * lines + 4);
}

function inkFor(color) {
  return (0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]) < 150 ? 'FFFFFFFF' : 'FF16251C';
}

export function buildXlsx(report) {
  const t = report.t;
  const styles = makeStyles();
  const S = styles.style;
  const valueFormat = report.matrix.allInt ? '#,##0' : '#,##0.0';
  const monthCount = 12;

  // ----- Resumen -----
  const summary = makeSheet();
  const cols = 6;
  const band = { fill: GREEN, color: 'FFFFFFFF' };
  let r = 1;
  const titleRow = summary.row(r, 36);
  titleRow.text(0, report.title, S({ bold: true, size: 18, fill: GREEN, color: 'FFFFFFFF', indent: 1 }));
  for (let c = 1; c < cols; c = c + 1) { titleRow.blank(c, S(band)); }
  summary.merge(r, 0, r, cols - 1);
  r += 1;
  const subRow = summary.row(r, 24);
  subRow.text(0, report.subtitle, S({ bold: true, size: 13, fill: GREEN, color: 'FFD6E6DA', indent: 1 }));
  for (let c = 1; c < cols; c = c + 1) { subRow.blank(c, S(band)); }
  summary.merge(r, 0, r, cols - 1);
  r += 1;
  const infoRow = summary.row(r, 22);
  infoRow.text(0, t('exScope') + ': ' + report.scope + '   ·   ' + t('rpPeriod') + ': ' + report.period + '   ·   ' + t('exGenerated') + ': ' + report.generated, S({ size: 10, fill: GREEN, color: 'FFBFD8C4', indent: 1 }));
  for (let c = 1; c < cols; c = c + 1) { infoRow.blank(c, S(band)); }
  summary.merge(r, 0, r, cols - 1);
  r += 2;
  const warnStyle = S({ bold: true, size: 11, fill: AMBER_BG, color: AMBER_INK, border: true, wrap: true, indent: 1 });
  if (report.isSample) {
    const warn = summary.row(r, 34);
    warn.text(0, report.sampleBanner + ' · ' + t('sampleLong'), warnStyle);
    for (let c = 1; c < cols; c = c + 1) { warn.blank(c, warnStyle); }
    summary.merge(r, 0, r, cols - 1);
    r += 2;
  }
  function heading(text) {
    const h = summary.row(r, 24);
    h.text(0, text, S({ bold: true, size: 13, color: GREEN, rule: GREEN }));
    for (let c = 1; c < cols; c = c + 1) { h.blank(c, S({ rule: GREEN })); }
    r += 1;
  }
  const labelStyle = S({ bold: true, fill: BAND_SOFT, border: true, indent: 1 });
  const valueStyle = S({ bold: true, size: 13, color: GREEN, border: true, h: 'left', indent: 1 });
  const noteStyle = S({ color: 'FF4A5A50', border: true, wrap: true, indent: 1 });
  function labelled(label, value, note) {
    const line = summary.row(r, note ? wrapHeight(note, 48, 24) : 24);
    line.text(0, label, labelStyle);
    line.text(1, value, valueStyle);
    if (note) {
      line.text(2, note, noteStyle);
    } else {
      line.blank(2, noteStyle);
    }
    for (let c = 3; c < cols; c = c + 1) { line.blank(c, noteStyle); }
    summary.merge(r, 2, r, cols - 1);
    r += 1;
  }
  if (report.meta.length > 0) {
    heading(report.subtitle);
    report.meta.forEach(function add(entry) { labelled(entry[0], String(entry[1])); });
    r += 1;
  }
  heading(t('rpKeyFigures'));
  report.facts.forEach(function add(fact) { labelled(fact.label, fact.value, fact.note); });
  r += 1;
  if (report.highlights.length > 0) {
    heading(t('rpHighlights'));
    report.highlights.forEach(function group(block) {
      block.items.forEach(function item(text, i) { labelled(i === 0 ? block.title : '', text); });
    });
    r += 1;
  }
  if (report.enso.line) {
    heading(t('elNinoTitle'));
    const ensoRow = summary.row(r, 22);
    const ensoStyle = S({ border: true, indent: 1 });
    ensoRow.text(0, report.enso.line, ensoStyle);
    for (let c = 1; c < cols; c = c + 1) { ensoRow.blank(c, ensoStyle); }
    summary.merge(r, 0, r, cols - 1);
    r += 1;
    const caveat = summary.row(r, 22);
    caveat.text(0, t('rpEnsoNote'), S({ italic: true, color: 'FF4A5A50', indent: 1 }));
    r += 1;
  }

  // ----- Datos -----
  const data = makeSheet();
  const dataCols = monthCount + 2;
  let d = 1;
  const dataTitle = data.row(d, 28);
  dataTitle.text(0, t('rpTableYears') + ' · ' + report.scope, S({ bold: true, size: 14, color: GREEN }));
  d += 1;
  if (report.isSample) {
    const warn = data.row(d, 24);
    warn.text(0, report.sampleBanner, S({ bold: true, fill: AMBER_BG, color: AMBER_INK, border: true, indent: 1 }));
    for (let c = 1; c < dataCols; c = c + 1) { warn.blank(c, S({ fill: AMBER_BG, border: true })); }
    data.merge(d, 0, d, dataCols - 1);
    d += 1;
  }
  const headerRowNumber = d;
  const headStyle = S({ bold: true, color: 'FFFFFFFF', fill: GREEN, border: true, h: 'center', wrap: true });
  const head = data.row(d, 28);
  head.text(0, t('exYear'), headStyle);
  report.monthLabels.forEach(function label(name, i) { head.text(1 + i, name, headStyle); });
  head.text(dataCols - 1, t('rpTotal'), headStyle);
  d += 1;
  const zeroStyle = S({ fill: 'FFF4F4F1', color: 'FF8A978E', border: true, h: 'center', format: valueFormat });
  const emptyStyle = S({ border: true });
  report.matrix.rows.forEach(function addYear(yearRow, i) {
    const fill = i % 2 === 0 ? 'FFFFFFFF' : BAND_SOFT;
    const line = data.row(d);
    line.text(0, yearRow.year, S({ bold: true, fill: fill, border: true, h: 'center' }));
    yearRow.cells.forEach(function cell(value, m) {
      if (value === null) {
        line.blank(1 + m, emptyStyle);
      } else if (value <= 0) {
        line.number(1 + m, 0, zeroStyle);
      } else {
        const bucket = Math.round(intensityRatio(value, report.matrix.max) * 20) / 20;
        const color = rampColor(bucket);
        line.number(1 + m, value, S({ fill: hexOf(color), color: inkFor(color), border: true, h: 'center', format: valueFormat }));
      }
    });
    line.number(dataCols - 1, yearRow.total, S({ bold: true, fill: fill, border: true, h: 'right', format: valueFormat }));
    d += 1;
  });
  const lastYearRow = d - 1;
  const medianStyle = S({ bold: true, fill: BAND_MEDIAN, border: true, h: 'center', format: '#,##0.0' });
  const medianLine = data.row(d);
  medianLine.text(0, t('calMedian'), S({ bold: true, fill: BAND_MEDIAN, border: true, h: 'center', wrap: true }));
  report.matrix.medians.forEach(function median(value, m) {
    if (value === null) {
      medianLine.blank(1 + m, medianStyle);
    } else {
      medianLine.number(1 + m, value, medianStyle);
    }
  });
  medianLine.blank(dataCols - 1, medianStyle);
  d += 2;
  const legend = data.row(d, 20);
  legend.text(0, t('printLegend'), S({ bold: true, h: 'center' }));
  legend.text(1, t('rpLess'), S({ size: 9, color: 'FF4A5A50', h: 'right' }));
  for (let k = 0; k < 10; k = k + 1) {
    legend.blank(2 + k, S({ fill: hexOf(rampColor(k / 9)), border: true }));
  }
  legend.text(12, t('rpMore'), S({ size: 9, color: 'FF4A5A50', h: 'left' }));

  // ----- Notas -----
  const notes = makeSheet();
  let n = 1;
  const notesTitle = notes.row(n, 32);
  notesTitle.text(0, report.title + ' · ' + t('exSheetNotes'), S({ bold: true, size: 16, fill: GREEN, color: 'FFFFFFFF', indent: 1 }));
  notesTitle.blank(1, S(band));
  notes.merge(n, 0, n, 1);
  n += 2;
  if (report.isSample) {
    const warn = notes.row(n, 34);
    warn.text(0, report.sampleBanner + ' · ' + t('sampleLong'), warnStyle);
    warn.blank(1, warnStyle);
    notes.merge(n, 0, n, 1);
    n += 2;
  }
  report.notes.forEach(function addNote(note, i) {
    const fill = i % 2 === 0 ? 'FFFFFFFF' : BAND_SOFT;
    const line = notes.row(n, wrapHeight(note[1], 95, 22));
    line.text(0, note[0], S({ bold: true, fill: fill, border: true, wrap: true, v: 'top', indent: 1 }));
    line.text(1, note[1], S({ fill: fill, border: true, wrap: true, v: 'top', indent: 1 }));
    n += 1;
  });

  const sheetNames = [t('exSheetSummary'), t('exSheetData'), t('exSheetNotes')];
  const dataRef = 'A' + headerRowNumber + ':' + columnName(dataCols - 1) + lastYearRow;
  const filterName = '\'' + xml(sheetNames[1]) + '\'!$A$' + headerRowNumber + ':$' + columnName(dataCols - 1) + '$' + lastYearRow;
  const contentTypes = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>';
  const relType = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/';
  const files = [
    { name: '[Content_Types].xml', content: contentTypes },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + relType + 'officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    {
      name: 'xl/workbook.xml',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView activeTab="0"/></bookViews><sheets>' +
        sheetNames.map(function sheet(name, i) { return '<sheet name="' + xml(name.slice(0, 31)) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>'; }).join('') +
        '</sheets><definedNames><definedName name="_xlnm._FilterDatabase" localSheetId="1" hidden="1">' + filterName + '</definedName></definedNames></workbook>'
    },
    {
      name: 'xl/_rels/workbook.xml.rels',
      content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="' + relType + 'worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="' + relType + 'worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="' + relType + 'worksheet" Target="worksheets/sheet3.xml"/><Relationship Id="rId4" Type="' + relType + 'styles" Target="styles.xml"/></Relationships>'
    },
    { name: 'xl/styles.xml', content: styles.toXml() },
    { name: 'xl/worksheets/sheet1.xml', content: summary.toXml({ widths: [30, 30, 16, 16, 16, 16], grid: false, selected: true }) },
    { name: 'xl/worksheets/sheet2.xml', content: data.toXml({ widths: [11].concat(new Array(monthCount).fill(9.5), [13]), freeze: { cols: 1, rows: headerRowNumber }, filter: dataRef, landscape: true, tab: 'FFE07A2F' }) },
    { name: 'xl/worksheets/sheet3.xml', content: notes.toXml({ widths: [26, 100], grid: false, tab: 'FF4F7F63' }) }
  ];
  return buildZip(files);
}

export function downloadXlsx(report) {
  const name = (report.isSample ? 'MUESTRA_' : '') + 'datos_' + report.fileScope + '_' + report.isoDate + '.xlsx';
  triggerDownload(buildXlsx(report), name);
}
