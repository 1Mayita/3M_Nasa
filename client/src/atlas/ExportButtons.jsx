// =====================================================================
// Dueño: P3 (Vista)
// Dos botones de exportación: Excel con diseño e informe PDF. Estados: hover, focus-visible,
// pressed, disabled y loading (aria-busy). Se bloquean mientras se genera un archivo.
// =====================================================================

import { useRef, useState } from 'react';
import { IconPdf, IconSheet } from './Icons.jsx';
import { exportReport } from './exportActions.js';

export default function ExportButtons(props) {
  const { kind, getInput, t } = props;
  const [busy, setBusy] = useState(null);
  const [failed, setFailed] = useState(false);
  const lock = useRef(false);

  function run(format) {
    if (lock.current) {
      return;
    }
    lock.current = true;
    setFailed(false);
    setBusy(format);
    // Deja pintar el estado "Generando…" antes del trabajo pesado
    setTimeout(function start() {
      exportReport(format, kind, getInput()).catch(function fail() {
        setFailed(true);
      }).finally(function done() {
        lock.current = false;
        setBusy(null);
      });
    }, 50);
  }

  return (
    <>
      <button type="button" className="button-ghost" onClick={function excel() { run('xlsx'); }} disabled={busy !== null} aria-busy={busy === 'xlsx'}>
        <IconSheet /> {busy === 'xlsx' ? t('generating') : t('downloadExcel')}
      </button>
      <button type="button" className="button-ghost" onClick={function pdf() { run('pdf'); }} disabled={busy !== null} aria-busy={busy === 'pdf'}>
        <IconPdf /> {busy === 'pdf' ? t('generating') : t('downloadPdf')}
      </button>
      <span className="export-status" role="status" aria-live="polite">{failed ? t('exportError') : ''}</span>
    </>
  );
}
