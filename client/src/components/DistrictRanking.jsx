// =====================================================================
// Dueño: P3 (Vista)
// Ranking de distritos de Cercado por número de detecciones (serie armonizada)
// y mini-calendario por mes con colores accesibles.
// =====================================================================

import { useEffect, useState } from 'react';
import { fetchDistrictSummary } from '../services/gamcApi.js';
import { getSequentialColor, getReadableTextColor } from '../utils/colorRamps.js';

const MONTH_LABELS = ['E', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];

export default function DistrictRanking(props) {
  const [summary, setSummary] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(
    function loadSummary() {
      let isCancelled = false;
      setErrorMessage(null);
      fetchDistrictSummary(props.fromDate, props.toDate)
        .then(function saveSummary(result) {
          if (!isCancelled) {
            setSummary(result);
          }
        })
        .catch(function saveError(error) {
          if (!isCancelled) {
            setErrorMessage(error.message);
          }
        });
      return function cancel() {
        isCancelled = true;
      };
    },
    [props.fromDate, props.toDate]
  );

  if (errorMessage !== null) {
    return <p style={{ color: '#b00020' }}>No se pudo cargar el resumen por distrito: {errorMessage}</p>;
  }
  if (summary === null) {
    return <p>Cargando distritos…</p>;
  }

  let maximumMonthlyValue = 0;
  for (const district of summary.districts) {
    for (const monthKey of Object.keys(district.byMonth)) {
      maximumMonthlyValue = Math.max(maximumMonthlyValue, district.byMonth[monthKey]);
    }
  }

  return (
    <section aria-label="Detecciones por distrito de Cercado" style={{ fontSize: 13 }}>
      <h4 style={{ margin: '8px 0' }}>Distritos de Cercado con más detecciones</h4>
      {summary.isSample && (
        <p style={{ background: '#fff3cd', padding: 6, borderRadius: 4 }}>⚠ Datos de MUESTRA sintética (no reales).</p>
      )}
      {!summary.harmonized && (
        <p style={{ background: '#fff3cd', padding: 6, borderRadius: 4 }}>⚠ Sin factores k: la serie no está armonizada.</p>
      )}
      <p style={{ color: '#555' }}>Unidad: {summary.unit}. {summary.note}</p>

      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th style={{ textAlign: 'left' }}>Distrito</th>
            <th style={{ textAlign: 'right', paddingRight: 6 }}>Total</th>
            <th style={{ textAlign: 'right', paddingRight: 6 }}>En cota 2750</th>
            {MONTH_LABELS.map(function renderMonthHeader(label, index) {
              return (
                <th key={index} style={{ width: 18, fontWeight: 400 }}>
                  {label}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {summary.districts.map(function renderDistrictRow(district) {
            return (
              <tr key={district.distrito}>
                <td>
                  {district.distrito} <span style={{ color: '#666' }}>{district.comuna}</span>
                </td>
                <td style={{ textAlign: 'right', paddingRight: 6 }}>{district.total}</td>
                <td style={{ textAlign: 'right', paddingRight: 6 }}>{district.insideCota2750Layer}</td>
                {MONTH_LABELS.map(function renderMonthCell(label, index) {
                  const monthValue = district.byMonth[String(index + 1)] || 0;
                  const backgroundColor = getSequentialColor(monthValue, maximumMonthlyValue);
                  return (
                    <td
                      key={index}
                      title={district.distrito + ' mes ' + (index + 1) + ': ' + monthValue}
                      style={{
                        background: backgroundColor,
                        color: getReadableTextColor(backgroundColor),
                        textAlign: 'center',
                        fontSize: 10,
                        border: '1px solid #fff'
                      }}
                    >
                      {monthValue > 0 ? Math.round(monthValue) : ''}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
