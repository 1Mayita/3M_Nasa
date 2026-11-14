// =====================================================================
// Dueño: P3 (Vista)
// Leyenda de las capas de la Alcaldía (imágenes PNG que devuelve GetLegendGraphic).
// Va FUERA del mapa (en el panel lateral).
// =====================================================================

import { getGamcLegendImageUrl } from '../services/gamcApi.js';

const LEGEND_ITEMS = [
  { name: 'distritos', title: 'Distritos' },
  { name: 'cota2750', title: 'Cota 2750' },
  { name: 'periurbanos', title: 'Periurbanos' }
];

export default function GamcLegend() {
  return (
    <section aria-label="Leyenda de capas de la Alcaldía" style={{ fontSize: 13 }}>
      <h4 style={{ margin: '8px 0' }}>Capas de la Alcaldía de Cochabamba</h4>
      {LEGEND_ITEMS.map(function renderLegendItem(item) {
        return (
          <div key={item.name} style={{ marginBottom: 8 }}>
            <div style={{ fontWeight: 600 }}>{item.title}</div>
            <img
              src={getGamcLegendImageUrl(item.name)}
              alt={'Leyenda de ' + item.title}
              onError={function hideBrokenImage(event) {
                event.currentTarget.style.display = 'none';
              }}
            />
          </div>
        );
      })}
      <p style={{ color: '#555', marginTop: 4 }}>Fuente: Gobierno Autónomo Municipal de Cochabamba (solo municipio de Cercado).</p>
    </section>
  );
}
