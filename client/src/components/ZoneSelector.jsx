// =====================================================================
// Dueño: P3 (Vista)
// Lista de zonas críticas para elegir (panel lateral). Al elegir una zona,
// se llama onSelectZone(feature): el padre usa feature.geometry como "área"
// para el calendario que ya existe (mismo flujo que dibujar en el mapa).
// =====================================================================

import FuelProfileCard from './FuelProfileCard.jsx';

export default function ZoneSelector(props) {
  const zones = props.zones;
  const selectedZoneId = props.selectedZoneId;

  if (!zones) {
    return <p>Cargando zonas…</p>;
  }

  const selectedZone = zones.features.find(function matchesSelected(feature) {
    return feature.properties.id === selectedZoneId;
  });

  return (
    <section aria-label="Zonas críticas de fuego en Cochabamba">
      <label htmlFor="zone-select" style={{ fontWeight: 700, display: 'block', marginBottom: 4 }}>
        Zona de Cochabamba
      </label>
      <select
        id="zone-select"
        value={selectedZoneId || ''}
        onChange={function handleChange(event) {
          const zone = zones.features.find(function matchesValue(feature) {
            return feature.properties.id === event.target.value;
          });
          if (zone && props.onSelectZone) {
            props.onSelectZone(zone);
          }
        }}
        style={{ width: '100%', padding: 6 }}
      >
        <option value="" disabled>
          Elige una zona…
        </option>
        {zones.features.map(function renderOption(feature) {
          return (
            <option key={feature.properties.id} value={feature.properties.id}>
              {feature.properties.nombre}
            </option>
          );
        })}
      </select>

      {selectedZone && (
        <div style={{ marginTop: 10, fontSize: 13 }}>
          <p style={{ margin: '4px 0' }}>
            <b>Municipios:</b> {selectedZone.properties.municipios.join(', ')}
          </p>
          <p style={{ margin: '4px 0' }}>{selectedZone.properties.contexto}</p>
          <p style={{ margin: '4px 0', color: '#555' }}>
            <b>Referencia:</b> {selectedZone.properties.referencia}
          </p>
          <h4 style={{ margin: '10px 0 6px' }}>Vegetación que se quema aquí</h4>
          {(selectedZone.properties.fuels || []).map(function renderFuel(fuel) {
            return <FuelProfileCard key={fuel.id} fuel={fuel} />;
          })}
        </div>
      )}
    </section>
  );
}
