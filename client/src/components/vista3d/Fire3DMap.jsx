// =====================================================================
// Dueño: P3 (Vista) — BASE FUNCIONAL para que P3 haga el diseño encima.
// Mapa 3D del relieve de Cochabamba con columnas de focos (deck.gl).
//
//   <Fire3DMap zoneId="tunari-sur" fromMonth="2012-01" toMonth="2025-12" />
//
// Qué hace:
//  - Relieve real en 3D (elevación Terrarium + imagen satelital, sin API key)
//  - Una columna por celda (~2 km): altura y color = cantidad de detecciones
//  - Modo "Acumulado" (todo el rango) o "Animación" mes a mes con botón ▶
//  - Clic en una columna: muestra cantidad, mes y, si cae en Cercado, distrito/cota/periurbano
//
// Dependencias (en client/):  npm install deck.gl@^9.1
// Datos: GET /api/focos3d (P2). Sin servidor: VITE_USE_MOCKS=true
// =====================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { ColumnLayer } from '@deck.gl/layers';
import { TerrainLayer } from '@deck.gl/geo-layers';
import { _TerrainExtension as TerrainExtension } from '@deck.gl/extensions';
import { fetchHotspots3d, fetchPointInfo } from './focos3dApi.js';

// Relieve gratuito (AWS Terrain Tiles, formato Terrarium) y foto satelital (Esri World Imagery)
const ELEVATION_TILES_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const SATELLITE_TILES_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TERRARIUM_DECODER = { rScaler: 256, gScaler: 1, bScaler: 1 / 256, offset: -32768 };

// Rampa amarillo -> rojo oscuro (secuencial, apta para daltonismo)
const FIRE_COLOR_RAMP = [
  [255, 255, 178],
  [254, 217, 118],
  [254, 178, 76],
  [253, 141, 60],
  [240, 59, 32],
  [189, 0, 38],
  [128, 0, 38]
];

// Cobertura de la API de la Alcaldía (solo Cercado)
const GAMC_COVERAGE_BBOX = [-66.280703, -17.53119, -66.06952, -17.257306];

// Altura de la columna más alta (en metros, sobre el relieve)
const MAXIMUM_COLUMN_HEIGHT_METERS = 4000;
const ANIMATION_STEP_MILLISECONDS = 350;

function getColorForValue(value, maximumValue) {
  if (maximumValue <= 0) {
    return FIRE_COLOR_RAMP[0];
  }
  const ratio = Math.min(Math.max(value / maximumValue, 0), 1);
  const index = Math.min(Math.floor(ratio * FIRE_COLOR_RAMP.length), FIRE_COLOR_RAMP.length - 1);
  return FIRE_COLOR_RAMP[index];
}

function buildInitialViewState(bbox) {
  const centerLongitude = (bbox[0] + bbox[2]) / 2;
  const centerLatitude = (bbox[1] + bbox[3]) / 2;
  const longitudeSpan = Math.max(bbox[2] - bbox[0], 0.05);
  const zoom = Math.log2(360 / longitudeSpan) - 0.3;
  return {
    longitude: centerLongitude,
    latitude: centerLatitude - (bbox[3] - bbox[1]) * 0.35,
    zoom: zoom,
    pitch: 58,
    bearing: -15,
    maxPitch: 75
  };
}

function isInsideGamcCoverage(longitude, latitude) {
  const isInsideLongitude = longitude >= GAMC_COVERAGE_BBOX[0] && longitude <= GAMC_COVERAGE_BBOX[2];
  const isInsideLatitude = latitude >= GAMC_COVERAGE_BBOX[1] && latitude <= GAMC_COVERAGE_BBOX[3];
  return isInsideLongitude && isInsideLatitude;
}

function formatMonth(monthText) {
  const monthNames = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  if (!monthText) {
    return '';
  }
  const monthIndex = Number.parseInt(monthText.slice(5, 7), 10) - 1;
  return monthNames[monthIndex] + ' ' + monthText.slice(0, 4);
}

export default function Fire3DMap(props) {
  const zoneId = props.zoneId || 'tunari-sur';
  const height = props.height || 560;

  const [data, setData] = useState(null);
  const [errorMessage, setErrorMessage] = useState(null);
  const [viewState, setViewState] = useState(null);
  const [mode, setMode] = useState('acumulado');
  const [monthIndex, setMonthIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedCell, setSelectedCell] = useState(null);
  const [selectedCellInfo, setSelectedCellInfo] = useState(null);
  const animationTimerRef = useRef(null);

  // 1) Cargar datos de la zona
  useEffect(
    function loadZoneData() {
      let isCancelled = false;
      setErrorMessage(null);
      setSelectedCell(null);
      setIsPlaying(false);
      fetchHotspots3d(zoneId, props.fromMonth, props.toMonth)
        .then(function saveData(result) {
          if (isCancelled) {
            return;
          }
          setData(result);
          setViewState(buildInitialViewState(result.zone.bbox));
          setMonthIndex(0);
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
    [zoneId, props.fromMonth, props.toMonth]
  );

  // 2) Animación mes a mes
  useEffect(
    function runAnimation() {
      if (!isPlaying || data === null) {
        return undefined;
      }
      animationTimerRef.current = setInterval(function goToNextMonth() {
        setMonthIndex(function nextIndex(previousIndex) {
          const lastIndex = data.months.length - 1;
          if (previousIndex >= lastIndex) {
            setIsPlaying(false);
            return lastIndex;
          }
          return previousIndex + 1;
        });
      }, ANIMATION_STEP_MILLISECONDS);
      return function stopAnimation() {
        clearInterval(animationTimerRef.current);
      };
    },
    [isPlaying, data]
  );

  // 3) Valores de cada columna según el modo
  const currentMonth = data !== null && data.months.length > 0 ? data.months[monthIndex] : null;

  const columnData = useMemo(
    function computeColumnData() {
      if (data === null) {
        return [];
      }
      if (mode === 'acumulado') {
        return data.cells.map(function toColumn(cell) {
          return { id: cell.id, longitude: cell.longitude, latitude: cell.latitude, value: cell.total };
        });
      }
      const frame = data.frames[currentMonth] || [];
      return frame.map(function toColumn(entry) {
        const cell = data.cells[entry[0]];
        return { id: cell.id, longitude: cell.longitude, latitude: cell.latitude, value: entry[1] };
      });
    },
    [data, mode, currentMonth]
  );

  const maximumValue = data === null ? 1 : mode === 'acumulado' ? data.maxCellTotal : data.maxCellMonthly;
  const columnRadiusMeters = data === null ? 800 : (data.cellSizeDeg * 111000) / 2 * 0.85;

  // 4) Capas de deck.gl
  const layers = [
    new TerrainLayer({
      id: 'relieve',
      minZoom: 0,
      maxZoom: 13,
      elevationDecoder: TERRARIUM_DECODER,
      elevationData: ELEVATION_TILES_URL,
      texture: SATELLITE_TILES_URL,
      operation: 'terrain+draw',
      color: [200, 200, 200]
    }),
    new ColumnLayer({
      id: 'columnas-focos',
      data: columnData,
      diskResolution: 12,
      radius: columnRadiusMeters,
      extruded: true,
      pickable: true,
      elevationScale: MAXIMUM_COLUMN_HEIGHT_METERS / Math.max(maximumValue, 1),
      getPosition: function getPosition(column) {
        return [column.longitude, column.latitude];
      },
      getElevation: function getElevation(column) {
        return column.value;
      },
      getFillColor: function getFillColor(column) {
        return getColorForValue(column.value, maximumValue);
      },
      updateTriggers: {
        getFillColor: [maximumValue],
        getElevation: [maximumValue]
      },
      transitions: {
        getElevation: ANIMATION_STEP_MILLISECONDS * 0.8
      },
      extensions: [new TerrainExtension()],
      onClick: async function handleColumnClick(info) {
        if (!info.object) {
          return;
        }
        const column = info.object;
        setSelectedCell(column);
        setSelectedCellInfo(null);
        if (isInsideGamcCoverage(column.longitude, column.latitude)) {
          try {
            const pointInfo = await fetchPointInfo(column.latitude, column.longitude);
            setSelectedCellInfo(pointInfo);
          } catch (error) {
            setSelectedCellInfo({ error: error.message });
          }
        }
      }
    })
  ];

  function getTooltip(info) {
    if (!info.object) {
      return null;
    }
    const valueText = Math.round(info.object.value * 10) / 10;
    const periodText = mode === 'acumulado' ? 'total del período' : formatMonth(currentMonth);
    return { text: valueText + ' detecciones · ' + periodText };
  }

  if (errorMessage !== null) {
    return <div role="alert" style={{ padding: 16, color: '#b00020' }}>No se pudo cargar la vista 3D: {errorMessage}</div>;
  }
  if (data === null || viewState === null) {
    return <div style={{ padding: 16 }}>Cargando relieve y focos…</div>;
  }

  const monthTotal = currentMonth !== null ? data.monthlyTotals[currentMonth] || 0 : 0;

  return (
    <div className="fire3d" style={{ position: 'relative', width: '100%', height: height, borderRadius: 12, overflow: 'hidden', background: '#0b0b0b' }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={function handleViewStateChange(event) {
          setViewState(event.viewState);
        }}
        controller={true}
        layers={layers}
        getTooltip={getTooltip}
      />

      {/* Encabezado: zona y aviso de muestra */}
      <div className="fire3d__header" style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(255,255,255,0.92)', padding: '8px 12px', borderRadius: 8, fontSize: 13, maxWidth: 320 }}>
        <div style={{ fontWeight: 600 }}>{data.zone.nombre}</div>
        <div style={{ color: '#555' }}>{data.unit}</div>
        {data.isSample && <div style={{ color: '#8a5a00' }}>⚠ Datos de muestra (sintéticos)</div>}
      </div>

      {/* Panel de la columna elegida */}
      {selectedCell !== null && (
        <div className="fire3d__info" style={{ position: 'absolute', top: 12, right: 12, background: 'rgba(255,255,255,0.95)', padding: '10px 12px', borderRadius: 8, fontSize: 13, width: 240 }}>
          <button type="button" aria-label="Cerrar" onClick={function closeInfo() { setSelectedCell(null); }} style={{ float: 'right', border: 'none', background: 'transparent', cursor: 'pointer' }}>✕</button>
          <div style={{ fontWeight: 600 }}>{Math.round(selectedCell.value * 10) / 10} detecciones</div>
          <div style={{ color: '#555' }}>{mode === 'acumulado' ? 'Total del período' : formatMonth(currentMonth)}</div>
          <div style={{ color: '#555' }}>{selectedCell.latitude.toFixed(3)}, {selectedCell.longitude.toFixed(3)}</div>
          {selectedCellInfo !== null && selectedCellInfo.error && <div style={{ color: '#b00020' }}>{selectedCellInfo.error}</div>}
          {selectedCellInfo !== null && !selectedCellInfo.error && (
            <div style={{ marginTop: 6 }}>
              <div>Distrito: <b>{selectedCellInfo.distrito || '—'}</b> {selectedCellInfo.comuna ? '(' + selectedCellInfo.comuna + ')' : ''}</div>
              <div>Cota 2750: <b>{selectedCellInfo.insideCota2750Layer ? 'dentro' : 'no'}</b></div>
              <div>Periurbano: <b>{selectedCellInfo.periurbano || 'no'}</b></div>
              {selectedCellInfo.fuelProfile && <div>Vegetación: <b>{selectedCellInfo.fuelProfile.nombre}</b></div>}
            </div>
          )}
          <div style={{ marginTop: 6 }}>
            Vegetación de la zona: {data.zone.fuels.map(function fuelName(fuel) { return fuel.nombre; }).join(', ')}
          </div>
        </div>
      )}

      {/* Controles: modo, ▶ y barra de tiempo */}
      <div className="fire3d__controls" style={{ position: 'absolute', left: 12, right: 12, bottom: 12, background: 'rgba(255,255,255,0.95)', padding: '8px 12px', borderRadius: 8, display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, flexWrap: 'wrap' }}>
        <button type="button" onClick={function showTotal() { setMode('acumulado'); setIsPlaying(false); }} aria-pressed={mode === 'acumulado'} style={{ fontWeight: mode === 'acumulado' ? 700 : 400 }}>
          Acumulado
        </button>
        <button type="button" onClick={function showAnimation() { setMode('animacion'); }} aria-pressed={mode === 'animacion'} style={{ fontWeight: mode === 'animacion' ? 700 : 400 }}>
          Mes a mes
        </button>
        {mode === 'animacion' && (
          <>
            <button
              type="button"
              aria-label={isPlaying ? 'Pausar' : 'Reproducir'}
              onClick={function togglePlay() {
                if (!isPlaying && monthIndex >= data.months.length - 1) {
                  setMonthIndex(0);
                }
                setIsPlaying(!isPlaying);
              }}
            >
              {isPlaying ? '⏸' : '▶'}
            </button>
            <input
              type="range"
              min={0}
              max={Math.max(data.months.length - 1, 0)}
              step={1}
              value={monthIndex}
              onChange={function handleSlider(event) {
                setIsPlaying(false);
                setMonthIndex(Number.parseInt(event.target.value, 10));
              }}
              aria-label="Mes"
              style={{ flex: 1, minWidth: 160 }}
            />
            <span style={{ minWidth: 150 }}>
              <b>{formatMonth(currentMonth)}</b> · {Math.round(monthTotal)} detecciones
            </span>
          </>
        )}
      </div>

      {/* Créditos obligatorios de las fuentes */}
      <div style={{ position: 'absolute', right: 8, bottom: 64, fontSize: 10, color: '#fff', textShadow: '0 0 2px #000' }}>
        Focos: NASA FIRMS · Relieve: AWS Terrain Tiles · Imagen: Esri, Maxar, Earthstar Geographics
      </div>
    </div>
  );
}
