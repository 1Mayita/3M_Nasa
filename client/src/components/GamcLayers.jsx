// =====================================================================
// Dueño: P3 (Vista)
// Capas de la Alcaldía (GAMC) en el mapa + clic para ver info del punto.
// Va DENTRO de <MapContainer>. Ejemplo:
//
//   <MapContainer ...>
//     <TileLayer ... />
//     <GamcLayers />
//   </MapContainer>
//
// Las imágenes se piden a NUESTRO servidor (/api/gamc/wms/:capa), que agrega la key.
// =====================================================================

import { useState } from 'react';
import { LayersControl, WMSTileLayer, Popup, useMapEvents } from 'react-leaflet';
import { getGamcTileUrl, fetchPointInfo } from '../services/gamcApi.js';
import FuelProfileCard from './FuelProfileCard.jsx';

const GAMC_COVERAGE_BBOX = [-66.280703, -17.53119, -66.06952, -17.257306];

const GAMC_LAYERS = [
  { name: 'distritos', label: 'Alcaldía · Distritos', checked: true, opacity: 0.9 },
  { name: 'cota2750', label: 'Alcaldía · Cota 2750', checked: true, opacity: 0.8 },
  { name: 'periurbanos', label: 'Alcaldía · Periurbanos', checked: false, opacity: 0.6 }
];

const WMS_PARAMETERS = {
  layers: '',
  format: 'image/png',
  transparent: true,
  version: '1.1.1'
};

function isInsideCoverage(latitude, longitude) {
  const isInsideLongitude = longitude >= GAMC_COVERAGE_BBOX[0] && longitude <= GAMC_COVERAGE_BBOX[2];
  const isInsideLatitude = latitude >= GAMC_COVERAGE_BBOX[1] && latitude <= GAMC_COVERAGE_BBOX[3];
  return isInsideLongitude && isInsideLatitude;
}

// Leaflet usa [latitud, longitud]
const COVERAGE_BOUNDS = [
  [GAMC_COVERAGE_BBOX[1], GAMC_COVERAGE_BBOX[0]],
  [GAMC_COVERAGE_BBOX[3], GAMC_COVERAGE_BBOX[2]]
];

function PointInfoOnClick(props) {
  const [clickedPoint, setClickedPoint] = useState(null);
  const [pointInfo, setPointInfo] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState(null);

  useMapEvents({
    click: async function handleMapClick(event) {
      if (props.enabled === false) {
        return;
      }
      const latitude = event.latlng.lat;
      const longitude = event.latlng.lng;
      if (!isInsideCoverage(latitude, longitude)) {
        return;
      }
      setClickedPoint([latitude, longitude]);
      setPointInfo(null);
      setErrorMessage(null);
      setIsLoading(true);
      try {
        const info = await fetchPointInfo(latitude, longitude);
        setPointInfo(info);
      } catch (error) {
        setErrorMessage(error.message);
      } finally {
        setIsLoading(false);
      }
    }
  });

  if (clickedPoint === null) {
    return null;
  }

  return (
    <Popup position={clickedPoint} maxWidth={320}>
      <div style={{ fontSize: 13, lineHeight: 1.4 }}>
        <strong>Datos de la Alcaldía en este punto</strong>
        {isLoading && <p>Consultando…</p>}
        {errorMessage !== null && <p style={{ color: '#b00020' }}>No se pudo consultar: {errorMessage}</p>}
        {pointInfo !== null && (
          <div>
            <p style={{ margin: '6px 0' }}>
              <b>Distrito:</b> {pointInfo.distrito || '—'} {pointInfo.comuna ? '(comuna ' + pointInfo.comuna + ')' : ''}
              <br />
              <b>Capa Cota 2750:</b> {pointInfo.insideCota2750Layer ? 'Sí, dentro' : 'No'}
              <br />
              <b>Periurbano:</b> {pointInfo.periurbano || 'No'}
              <br />
              <b>Cobertura (Alcaldía):</b> {pointInfo.coberturaGamc || '—'}
            </p>
            {pointInfo.fuelProfile && <FuelProfileCard fuel={pointInfo.fuelProfile} compact={true} />}
          </div>
        )}
      </div>
    </Popup>
  );
}

export default function GamcLayers(props) {
  const clickInfoEnabled = props.clickInfoEnabled !== false;

  return (
    <>
      <LayersControl position="topright">
        {GAMC_LAYERS.map(function renderLayer(layer) {
          return (
            <LayersControl.Overlay key={layer.name} name={layer.label} checked={layer.checked}>
              <WMSTileLayer
                url={getGamcTileUrl(layer.name)}
                params={WMS_PARAMETERS}
                opacity={layer.opacity}
                bounds={COVERAGE_BOUNDS}
                attribution="Capas: Gobierno Autónomo Municipal de Cochabamba"
              />
            </LayersControl.Overlay>
          );
        })}
      </LayersControl>
      <PointInfoOnClick enabled={clickInfoEnabled} />
    </>
  );
}
