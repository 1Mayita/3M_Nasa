// Panel de búsqueda: región, lat/lon, fechas. Dueño: P3
import { useState } from 'react';

export default function Controls({ regions, aoi, onAoi, start, end, setStart, setEnd, onRun, onExport, loading }) {
  const [box, setBox] = useState({ w: '', s: '', e: '', n: '' });

  const applyBox = (ev) => {
    ev.preventDefault();
    const b = [box.w, box.s, box.e, box.n].map(Number);
    if (b.some(Number.isNaN) || b[0] >= b[2] || b[1] >= b[3]) return alert('Revisa las coordenadas: oeste < este y sur < norte');
    onAoi({ bbox: b, label: `Coordenadas ${b.join(', ')}` });
  };

  return (
    <aside className="controls">
      <label>Región predefinida
        <select value="" onChange={(e) => {
          const r = regions.find((x) => x.id === e.target.value);
          if (r) onAoi({ bbox: r.bbox, label: r.name });
        }}>
          <option value="">Elegir…</option>
          {regions.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>

      <p className="hint">…o dibuja un rectángulo/polígono en el mapa, o ingresa coordenadas:</p>
      <form className="bbox" onSubmit={applyBox}>
        {[['w', 'Oeste (lon)'], ['e', 'Este (lon)'], ['s', 'Sur (lat)'], ['n', 'Norte (lat)']].map(([k, l]) => (
          <label key={k}>{l}<input inputMode="decimal" value={box[k]} onChange={(e) => setBox({ ...box, [k]: e.target.value })} placeholder="-60.5" /></label>
        ))}
        <button type="submit" className="secondary">Usar coordenadas</button>
      </form>

      <div className="dates">
        <label>Desde<input type="date" value={start} min="2000-11-01" onChange={(e) => setStart(e.target.value)} /></label>
        <label>Hasta<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} /></label>
      </div>

      <p className="aoi">Área: <b>{aoi?.label ?? 'ninguna'}</b></p>
      <button onClick={onRun} disabled={!aoi || loading}>{loading ? 'Calculando…' : 'Ver calendario'}</button>
      <button onClick={onExport} disabled={!aoi || loading} className="secondary">Descargar CSV de focos</button>
    </aside>
  );
}
