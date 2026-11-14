// VISTA principal (dueño: P3). Solo habla con el Controlador a través de src/api/client.js
import { useCallback, useEffect, useState } from 'react';
import { getRegions, getCalendar, downloadCsv, usingMocks } from './api/client.js';
import Controls from './components/Controls.jsx';
import MapPanel from './components/MapPanel.jsx';
import FireCalendar from './components/FireCalendar.jsx';
import StatsCards from './components/StatsCards.jsx';
import YearChart from './components/YearChart.jsx';

const today = new Date().toISOString().slice(0, 10);

export default function App() {
  const [regions, setRegions] = useState([]);
  const [aoi, setAoi] = useState(null);
  const [start, setStart] = useState('2001-01-01');
  const [end, setEnd] = useState(today);
  const [data, setData] = useState(null);
  const [mode, setMode] = useState('count');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getRegions().then((r) => {
      setRegions(r);
      const def = r.find((x) => x.id === 'chiquitania') || r[0];
      if (def) setAoi({ bbox: def.bbox, label: def.name });
    }).catch((e) => setError(e.message));
  }, []);

  const body = () => (aoi.polygon ? { polygon: aoi.polygon } : { bbox: aoi.bbox });
  const onAoi = useCallback((a) => setAoi(a), []);

  const run = async () => {
    setLoading(true); setError(null);
    try { setData(await getCalendar({ ...body(), start, end })); } catch (e) { setError(e.message); } finally { setLoading(false); }
  };
  const exportCsv = async () => {
    try {
      const { truncated } = await downloadCsv({ ...body(), start, end });
      if (truncated) alert('El CSV se cortó en 200 000 filas. Reduce el área o el rango de fechas.');
    } catch (e) { setError(e.message); }
  };

  // primera carga automática
  useEffect(() => { if (aoi && !data) run(); /* eslint-disable-next-line */ }, [aoi]);

  const h = data?.harmonization;
  return (
    <div className="app">
      <header>
        <h1>🔥 Calendario de Fuego Armonizado</h1>
        <p>MODIS (2000–) + VIIRS (2012–) en una sola serie coherente · datos NASA FIRMS</p>
        {(usingMocks || h?.is_sample) && <p className="warn">⚠️ Datos de muestra sintéticos: no usar para conclusiones.</p>}
      </header>

      <main>
        <section className="top">
          <Controls regions={regions} aoi={aoi} onAoi={onAoi} start={start} end={end} setStart={setStart}
            setEnd={setEnd} onRun={run} onExport={exportCsv} loading={loading} />
          <MapPanel aoi={aoi} onAoi={onAoi} />
        </section>

        {error && <p className="error" role="alert">{error}</p>}

        {data && (
          <>
            <StatsCards stats={data.stats} dataUntil={data.query.data_until} />
            <section className="panel">
              <div className="panel-head">
                <h2>Actividad de fuego por mes</h2>
                <div role="radiogroup" className="toggle">
                  <button aria-pressed={mode === 'count'} onClick={() => setMode('count')}>Cantidad</button>
                  <button aria-pressed={mode === 'anomaly'} onClick={() => setMode('anomaly')}>Anomalía</button>
                </div>
              </div>
              <FireCalendar monthly={data.monthly} mode={mode} />
            </section>
            <section className="panel">
              <h2>Focos por año (serie armonizada)</h2>
              <YearChart yearly={data.yearly} monthly={data.monthly} />
            </section>
            {h && (
              <section className="panel method">
                <h2>¿Cómo se armoniza?</h2>
                <p>{h.method}</p>
                <p>Unidad: {h.unit}. Celdas analizadas: {data.query.cells}.</p>
                {h.validation && (
                  <p>Validación ({h.validation.train} → {h.validation.test}): error mensual {h.validation.mae_harmonized} armonizado
                    vs {h.validation.mae_naive} sin armonizar · correlación {h.validation.corr}.</p>
                )}
              </section>
            )}
          </>
        )}
      </main>
      <footer>NASA Space Apps Challenge 2026 · Harmonization of MODIS and VIIRS Hot Spots</footer>
    </div>
  );
}
