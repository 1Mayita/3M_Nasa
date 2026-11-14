// =====================================================================
// Dueño: P3 (Vista)
// Dibuja las zonas críticas en el mapa y hace zoom a la zona elegida.
// Va DENTRO de <MapContainer>.
//
//   <ZoneLayer zones={zones} selectedZoneId={selectedZoneId} onZoneClick={handleSelectZone} />
// =====================================================================

import { useEffect } from 'react';
import { GeoJSON, useMap } from 'react-leaflet';

function getZoneStyle(feature, selectedZoneId) {
  const isSelected = feature.properties.id === selectedZoneId;
  const isGamcDetail = feature.properties.tipo === 'detalle_gamc';
  const isDepartment = feature.properties.tipo === 'departamental';
  return {
    color: isSelected ? '#b35806' : isGamcDetail ? '#542788' : '#333333',
    weight: isSelected ? 3 : 1.5,
    dashArray: isDepartment ? '6 6' : null,
    fillOpacity: isSelected ? 0.12 : 0.03
  };
}

export default function ZoneLayer(props) {
  const map = useMap();
  const zones = props.zones;
  const selectedZoneId = props.selectedZoneId;

  useEffect(
    function zoomToSelectedZone() {
      if (!zones || !selectedZoneId) {
        return;
      }
      const selectedZone = zones.features.find(function matchesSelected(feature) {
        return feature.properties.id === selectedZoneId;
      });
      if (!selectedZone) {
        return;
      }
      const bbox = selectedZone.properties.bbox;
      map.fitBounds([
        [bbox[1], bbox[0]],
        [bbox[3], bbox[2]]
      ]);
    },
    [zones, selectedZoneId, map]
  );

  if (!zones) {
    return null;
  }

  // La key cambia con la selección para que GeoJSON vuelva a aplicar estilos.
  return (
    <GeoJSON
      key={'zones-' + selectedZoneId}
      data={zones}
      style={function styleZone(feature) {
        return getZoneStyle(feature, selectedZoneId);
      }}
      onEachFeature={function bindZoneEvents(feature, layer) {
        layer.bindTooltip(feature.properties.nombre, { sticky: true });
        layer.on('click', function handleZoneClick() {
          if (props.onZoneClick) {
            props.onZoneClick(feature);
          }
        });
      }}
    />
  );
}
