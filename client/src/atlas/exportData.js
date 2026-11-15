// =====================================================================
// Dueño: P3 (Vista)
// Exportación de datos sin librerías: CSV que abre bien en Excel (BOM UTF-8 y separador según idioma)
// y libro .xlsx mínimo (zip sin comprimir + XML) con hoja de datos y hoja de notas.
// Spec: { fileBase, sheetName, notesName, title, headers: [{ label, width, type: 'text'|'int'|'dec' }],
//         rows: [[...]], notes: [[etiqueta, texto]], isSample, sampleText, language }
// =====================================================================

const encoder = new TextEncoder();

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(function release() { URL.revokeObjectURL(url); }, 4000);
}

function fileName(spec, extension) {
  return (spec.isSample ? 'MUESTRA_SINTETICA_' : '') + spec.fileBase + '.' + extension;
}

// ---------- CSV ----------
// En español Excel usa ';' como separador y ',' como decimal; en inglés ',' y '.'
export function buildCsv(spec) {
  const spanish = spec.language !== 'en';
  const separator = spanish ? ';' : ',';
  function cell(value, type) {
    if (typeof value === 'number') {
      const text = type === 'int' ? String(Math.round(value)) : String(Math.round(value * 10) / 10);
      return spanish ? text.replace('.', ',') : text;
    }
    const text = String(value);
    return text.indexOf(separator) >= 0 || text.indexOf('"') >= 0 || text.indexOf('\n') >= 0 ? '"' + text.replace(/"/g, '""') + '"' : text;
  }
  const lines = [];
  // sin filas previas: la primera fila es el encabezado; la muestra se marca en el nombre y en una columna
  lines.push(spec.headers.map(function head(h) { return cell(h.label, 'text'); }).join(separator));
  spec.rows.forEach(function addRow(row) {
    lines.push(row.map(function mapCell(value, i) { return cell(value, spec.headers[i].type); }).join(separator));
  });
  return '﻿' + lines.join('\r\n') + '\r\n';
}

export function downloadCsv(spec) {
  triggerDownload(new Blob([buildCsv(spec)], { type: 'text/csv;charset=utf-8' }), fileName(spec, 'csv'));
}

// ---------- XLSX ----------
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

// Zip con método "stored" (sin compresión): válido para Excel y LibreOffice
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
  return String.fromCharCode(65 + index);
}

// estilos: 0 normal · 1 encabezado · 2 aviso de muestra · 3 decimal · 4 entero · 5 texto con ajuste · 6 etiqueta en negrita · 7 título
const STYLES = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
  '<numFmts count="1"><numFmt numFmtId="164" formatCode="0.0"/></numFmts>' +
  '<fonts count="5">' +
  '<font><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="12"/><color rgb="FF9C2A00"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="11"/><name val="Calibri"/></font>' +
  '<font><b/><sz val="14"/><name val="Calibri"/></font>' +
  '</fonts>' +
  '<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FF1F3D2B"/><bgColor indexed="64"/></patternFill></fill>' +
  '<fill><patternFill patternType="solid"><fgColor rgb="FFFFD9A0"/><bgColor indexed="64"/></patternFill></fill></fills>' +
  '<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>' +
  '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
  '<cellXfs count="8">' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>' +
  '<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1" applyAlignment="1"><alignment vertical="center" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="2" fillId="3" borderId="0" xfId="0" applyFont="1" applyFill="1"/>' +
  '<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="1" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>' +
  '<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment vertical="top" wrapText="1"/></xf>' +
  '<xf numFmtId="0" fontId="4" fillId="0" borderId="0" xfId="0" applyFont="1"/>' +
  '</cellXfs>' +
  '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
  '</styleSheet>';

function textCell(ref, text, style) {
  return '<c r="' + ref + '" t="inlineStr" s="' + style + '"><is><t xml:space="preserve">' + xml(text) + '</t></is></c>';
}

function numberCell(ref, value, style) {
  return '<c r="' + ref + '" s="' + style + '"><v>' + (Number.isFinite(value) ? value : 0) + '</v></c>';
}

function sheetXml(cols, rowsXml, freezeRow) {
  const pane = freezeRow > 0
    ? '<sheetViews><sheetView workbookViewId="0"><pane ySplit="' + freezeRow + '" topLeftCell="A' + (freezeRow + 1) + '" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    : '<sheetViews><sheetView workbookViewId="0"/></sheetViews>';
  const widths = '<cols>' + cols.map(function col(width, i) {
    return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + width + '" customWidth="1"/>';
  }).join('') + '</cols>';
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
    pane + '<sheetFormatPr defaultRowHeight="15"/>' + widths + '<sheetData>' + rowsXml.join('') + '</sheetData></worksheet>';
}

export function buildXlsx(spec) {
  const dataRows = [];
  let rowNumber = 1;
  if (spec.isSample) {
    dataRows.push('<row r="' + rowNumber + '" ht="22" customHeight="1">' + textCell('A' + rowNumber, spec.sampleText, 2) + '</row>');
    rowNumber += 1;
  }
  const headerRow = rowNumber;
  dataRows.push('<row r="' + rowNumber + '" ht="32" customHeight="1">' + spec.headers.map(function head(h, i) {
    return textCell(columnName(i) + rowNumber, h.label, 1);
  }).join('') + '</row>');
  rowNumber += 1;
  spec.rows.forEach(function addRow(row) {
    dataRows.push('<row r="' + rowNumber + '">' + row.map(function mapCell(value, i) {
      const ref = columnName(i) + rowNumber;
      const type = spec.headers[i].type;
      if (typeof value === 'number') {
        return numberCell(ref, type === 'int' ? Math.round(value) : Math.round(value * 10) / 10, type === 'int' ? 4 : 3);
      }
      return textCell(ref, value, 0);
    }).join('') + '</row>');
    rowNumber += 1;
  });
  const notesRows = [];
  notesRows.push('<row r="1" ht="24" customHeight="1">' + textCell('A1', spec.title, 7) + '</row>');
  if (spec.isSample) {
    notesRows.push('<row r="2" ht="22" customHeight="1">' + textCell('A2', spec.sampleText, 2) + '</row>');
  }
  const notesStart = spec.isSample ? 4 : 3;
  spec.notes.forEach(function addNote(note, i) {
    const r = notesStart + i;
    notesRows.push('<row r="' + r + '">' + textCell('A' + r, note[0], 6) + textCell('B' + r, note[1], 5) + '</row>');
  });
  const dataName = (spec.isSample ? 'MUESTRA - ' : '') + spec.sheetName;
  const files = [
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { name: 'xl/workbook.xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="' + xml(dataName.slice(0, 31)) + '" sheetId="1" r:id="rId1"/><sheet name="' + xml(spec.notesName.slice(0, 31)) + '" sheetId="2" r:id="rId2"/></sheets></workbook>' },
    { name: 'xl/_rels/workbook.xml.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { name: 'xl/styles.xml', content: STYLES },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml(spec.headers.map(function w(h) { return h.width; }), dataRows, headerRow) },
    { name: 'xl/worksheets/sheet2.xml', content: sheetXml([26, 100], notesRows, 0) }
  ];
  return buildZip(files);
}

export function downloadXlsx(spec) {
  triggerDownload(buildXlsx(spec), fileName(spec, 'xlsx'));
}

// Abre el diálogo de impresión con una clase en <body> que activa la hoja A4 de cada vista
export function printView(className) {
  const body = document.body;
  function clean() {
    body.classList.remove(className);
    window.removeEventListener('afterprint', clean);
  }
  body.classList.add(className);
  window.addEventListener('afterprint', clean);
  // Deja que el navegador aplique la clase antes de maquetar la página
  requestAnimationFrame(function later() {
    window.print();
  });
}
