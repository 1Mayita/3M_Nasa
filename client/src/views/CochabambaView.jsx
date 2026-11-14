// =====================================================================
// Dueño: P3 (Vista)
// Ejemplo de cómo juntar todo. Si ya tienen su propio mapa, copien solo las
// partes marcadas con "AGREGAR".
//
// onAreaChange(geometry) -> conectar con el calendario que ya existe
// (es lo mismo que cuando el usuario dibuja un polígono con geoman).
// =====================================================================

import { useEffect, useState } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import GamcLayers from '../components/GamcLayers.jsx';
import GamcLegend from '../components/GamcLegend.jsx';
import ZoneLayer from '../components/ZoneLayer.jsx';
import ZoneSelector from '../components/ZoneSelector.jsx';
import DistrictRanking from '../components/DistrictRanking.jsx';
import { fetchZones } from '../services/gamcApi.js';

const COCHABAMBA_CENTER = [-17.2, -65.9];
const INITIAL_ZOOM = 8;

export default function CochabambaView(props) {
  const [zones, setZones] = useState(null);
  const [selectedZoneId, setSelectedZoneId] = useState('tunari-sur');
  const [errorMessage, setErrorMessage] = useState(null);

  useEffect(function loadZones() {
    fetchZones()
      .then(function saveZones(result) {
        setZones(result);
      })
      .catch(function saveError(error) {
        setErrorMessage(error.message);
      });
  }, []);

  function handleSelectZone(zoneFeature) {
    setSelectedZoneId(zoneFeature.properties.id);
    // AGREGAR: avisar al calendario del área elegida
    if (props.onAreaChange) {
      props.onAreaChange(zoneFeature.geometry, zoneFeature.properties);
    }
  }

  const isCercadoSelected = selectedZoneId === 'cercado-gamc' || selectedZoneId === 'tunari-sur';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', height: '100vh' }}>
      <aside style={{ overflowY: 'auto', padding: 12, borderRight: '1px solid #ddd' }}>
        <h2 style={{ marginTop: 0 }}>Calendario de Fuego · Cochabamba</h2>
        <p style={{ fontSize: 12, color: '#555' }}>
          Detecciones satelitales (focos) armonizadas MODIS + VIIRS. Un foco es un píxel caliente, no un incendio.
        </p>
        {errorMessage !== null && <p style={{ color: '#b00020' }}>{errorMessage}</p>}

        {/* AGREGAR: selector de zonas con su vegetación */}
        <ZoneSelector zones={zones} selectedZoneId={selectedZoneId} onSelectZone={handleSelectZone} />

        {/* AGREGAR: aquí va el calendario que ya existe, usando el área elegida */}
        {props.children}

        {/* AGREGAR: detalle de Cercado con la API de la Alcaldía */}
        {isCercadoSelected && (
          <>
            <DistrictRanking fromDate={props.fromDate} toDate={props.toDate} />
            <GamcLegend />
          </>
        )}
      </aside>

      <MapContainer center={COCHABAMBA_CENTER} zoom={INITIAL_ZOOM} style={{ height: '100%', width: '100%' }}>
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution="&copy; OpenStreetMap"
        />
        {/* AGREGAR: zonas y capas de la Alcaldía dentro del mapa */}
        <ZoneLayer
          zones={zones}
          selectedZoneId={selectedZoneId}
          onZoneClick={handleSelectZone}
        />
        <GamcLayers />
      </MapContainer>
    </div>
  );
}
