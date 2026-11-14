// Mapa con dibujo del área de interés (rectángulo o polígono). Dueño: P3
import { useEffect } from 'react';
import { MapContainer, TileLayer, Rectangle, Polygon, useMap } from 'react-leaflet';
import '@geoman-io/leaflet-geoman-free';
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css';

function DrawControl({ onAoi }) {
  const map = useMap();
  useEffect(() => {
    map.pm.addControls({
      position: 'topleft', drawMarker: false, drawCircleMarker: false, drawPolyline: false, drawCircle: false,
      drawText: false, editMode: false, dragMode: false, cutPolygon: false, rotateMode: false, removalMode: false,
    });
    map.pm.setLang('es');
    const onCreate = (e) => {
      const ring = e.layer.getLatLngs()[0].map((p) => [+p.lng.toFixed(4), +p.lat.toFixed(4)]);
      map.removeLayer(e.layer);                 // lo redibuja React a partir del estado
      onAoi({ polygon: ring, label: e.shape === 'Rectangle' ? 'Rectángulo dibujado' : 'Polígono dibujado' });
    };
    map.on('pm:create', onCreate);
    return () => { map.off('pm:create', onCreate); map.pm.removeControls(); };
  }, [map, onAoi]);
  return null;
}

function FitTo({ aoi }) {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
    const b = aoi?.bbox || bboxOf(aoi?.polygon);
    if (b) map.fitBounds([[b[1], b[0]], [b[3], b[2]]], { padding: [20, 20], animate: false });
  }, [aoi, map]);
  return null;
}

function bboxOf(poly) {
  if (!poly) return null;
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

export default function MapPanel({ aoi, onAoi }) {
  const style = { color: '#cc4c02', weight: 2, fillOpacity: 0.08 };
  return (
    <MapContainer center={[-16.5, -64.5]} zoom={5} className="map" scrollWheelZoom>
      <TileLayer attribution="&copy; OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <DrawControl onAoi={onAoi} />
      <FitTo aoi={aoi} />
      {aoi?.polygon && <Polygon positions={aoi.polygon.map(([x, y]) => [y, x])} pathOptions={style} />}
      {aoi?.bbox && !aoi.polygon && (
        <Rectangle bounds={[[aoi.bbox[1], aoi.bbox[0]], [aoi.bbox[3], aoi.bbox[2]]]} pathOptions={style} />
      )}
    </MapContainer>
  );
}
