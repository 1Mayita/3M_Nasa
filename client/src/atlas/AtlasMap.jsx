// =====================================================================
// Dueño: P3 (Vista)
// Relieve 3D de Cochabamba con los 48 territorios municipales (deck.gl).
// - Municipios coloreados por intensidad de focos; hover eleva el contorno; clic selecciona
// - Cámara que vuela al municipio elegido y órbita lenta mientras nadie la toca
// - Columnas ámbar opcionales por celda (los focos como relieve vivo)
// =====================================================================

import { useEffect, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { FlyToInterpolator } from '@deck.gl/core';
import { GeoJsonLayer, ColumnLayer } from '@deck.gl/layers';
import { TerrainLayer } from '@deck.gl/geo-layers';
import { _TerrainExtension as TerrainExtension } from '@deck.gl/extensions';
import { rampColor, intensityRatio, EMPTY_COLOR } from './ramp.js';
import { findMunicipalityIndex, zoomForBbox } from './geo.js';
import { loadElevation, locateOnTerrain } from './dem.js';

const ELEVATION_TILES_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const SATELLITE_TILES_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const TERRARIUM_DECODER = { rScaler: 256, gScaler: 1, bScaler: 1 / 256, offset: -32768 };

const DEPARTMENT_VIEW = {
  longitude: -65.85,
  latitude: -17.55,
  zoom: 7.35,
  pitch: 56,
  bearing: -14,
  maxPitch: 78,
  minZoom: 6.2
};

const ROTATION_DEGREES_PER_SECOND = 2.2;
const IDLE_RESUME_MILLISECONDS = 9000;
const MAXIMUM_COLUMN_HEIGHT_METERS = 5200;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export default function AtlasMap(props) {
  const { collection, municipalities, values, maxValue, selectedIdx, hoverIdx, columns, columnMax, theme } = props;
  const { onSelect, onHover, onTerrainReady, rotationEnabled } = props;

  const [viewState, setViewState] = useState(DEPARTMENT_VIEW);
  const [isIdle, setIsIdle] = useState(true);
  const [terrainReady, setTerrainReady] = useState(false);
  const idleTimerRef = useRef(null);
  const reducedMotion = useMemo(prefersReducedMotion, []);

  // Vuelo de cámara al municipio elegido (o regreso al departamento)
  useEffect(
    function flyToSelection() {
      if (selectedIdx === null) {
        setViewState(function back(previous) {
          return Object.assign({}, previous, DEPARTMENT_VIEW, {
            transitionDuration: reducedMotion ? 0 : 1600,
            transitionInterpolator: new FlyToInterpolator({ speed: 1.2 })
          });
        });
        return;
      }
      const municipality = municipalities[selectedIdx];
      if (!municipality) {
        return;
      }
      const width = Math.max(window.innerWidth * 0.55, 420);
      setViewState(function fly(previous) {
        return Object.assign({}, previous, {
          longitude: municipality.center[0],
          latitude: municipality.center[1] - (municipality.bbox[3] - municipality.bbox[1]) * 0.18,
          zoom: Math.min(Math.max(zoomForBbox(municipality.bbox, width) - 1.1, 7.7), 10.2),
          pitch: 58,
          bearing: previous.bearing,
          transitionDuration: reducedMotion ? 0 : 1800,
          transitionInterpolator: new FlyToInterpolator({ speed: 1.3 })
        });
      });
      setIsIdle(false);
    },
    [selectedIdx, municipalities, reducedMotion]
  );

  // Órbita lenta mientras nadie interactúa
  useEffect(
    function orbit() {
      if (!rotationEnabled || !isIdle || reducedMotion || selectedIdx !== null) {
        return undefined;
      }
      let frameId = 0;
      let lastTime = performance.now();
      function tick(now) {
        const elapsed = now - lastTime;
        lastTime = now;
        setViewState(function turn(previous) {
          return Object.assign({}, previous, {
            bearing: previous.bearing + (ROTATION_DEGREES_PER_SECOND * elapsed) / 1000,
            transitionDuration: 0
          });
        });
        frameId = requestAnimationFrame(tick);
      }
      frameId = requestAnimationFrame(tick);
      return function stop() {
        cancelAnimationFrame(frameId);
      };
    },
    [rotationEnabled, isIdle, reducedMotion, selectedIdx]
  );

  useEffect(function preloadElevation() {
    loadElevation();
  }, []);

  function locate(info) {
    if (info.viewport && info.x !== undefined && info.x >= 0) {
      const coordinate = locateOnTerrain(info.viewport, info.x, info.y);
      return findMunicipalityIndex(municipalities, coordinate[0], coordinate[1]);
    }
    return -1;
  }

  function handleInteraction(state) {
    if (state.isDragging || state.isZooming || state.isPanning || state.isRotating) {
      setIsIdle(false);
      clearTimeout(idleTimerRef.current);
      idleTimerRef.current = setTimeout(function resume() {
        setIsIdle(true);
      }, IDLE_RESUME_MILLISECONDS);
    }
  }

  useEffect(
    function notifyReady() {
      if (terrainReady && onTerrainReady) {
        onTerrainReady();
      }
    },
    [terrainReady, onTerrainReady]
  );

  // Si el relieve no llega (sin internet), mostrar igual los municipios
  useEffect(function terrainFailsafe() {
    const timer = setTimeout(function force() {
      setTerrainReady(true);
    }, 14000);
    return function cancel() {
      clearTimeout(timer);
    };
  }, []);

  useEffect(function clearTimer() {
    return function cleanup() {
      clearTimeout(idleTimerRef.current);
    };
  }, []);

  const fillColors = useMemo(
    function computeFillColors() {
      return values.map(function colorFor(value) {
        if (value <= 0) {
          return EMPTY_COLOR.concat([120]);
        }
        return rampColor(intensityRatio(value, maxValue)).concat([185]);
      });
    },
    [values, maxValue]
  );

  const layers = useMemo(
    function buildLayers() {
      const reliefBrightness = theme === 'light' ? [225, 228, 222] : [150, 160, 150];
      const terrainLayer = new TerrainLayer({
          id: 'relieve',
          minZoom: 0,
          maxZoom: 12,
          elevationDecoder: TERRARIUM_DECODER,
          elevationData: ELEVATION_TILES_URL,
          texture: SATELLITE_TILES_URL,
          operation: 'terrain+draw',
          onViewportLoad: function viewportLoaded() {
            setTerrainReady(true);
          },
          color: reliefBrightness
      });
      if (!terrainReady) {
        return [terrainLayer];
      }
      return [
        terrainLayer,
        new GeoJsonLayer({
          id: 'municipios',
          data: collection,
          pickable: false,
          stroked: true,
          filled: true,
          lineWidthUnits: 'pixels',
          getFillColor: function fill(feature) {
            return fillColors[feature.properties.idx];
          },
          getLineColor: function line(feature) {
            if (feature.properties.idx === selectedIdx) {
              return [255, 244, 214, 255];
            }
            if (feature.properties.idx === hoverIdx) {
              return [234, 243, 236, 255];
            }
            return [191, 216, 196, 150];
          },
          getLineWidth: function width(feature) {
            if (feature.properties.idx === selectedIdx) {
              return 3.2;
            }
            if (feature.properties.idx === hoverIdx) {
              return 2.4;
            }
            return 0.9;
          },
          updateTriggers: {
            getFillColor: [fillColors],
            getLineColor: [selectedIdx, hoverIdx],
            getLineWidth: [selectedIdx, hoverIdx]
          },
          transitions: { getFillColor: 450, getLineWidth: 200 },
          extensions: [new TerrainExtension()]
        }),
        new ColumnLayer({
          id: 'columnas-focos',
          data: columns,
          diskResolution: 10,
          radius: 650,
          extruded: true,
          pickable: false,
          elevationScale: MAXIMUM_COLUMN_HEIGHT_METERS / Math.max(columnMax, 1),
          getPosition: function position(column) {
            return [column.longitude, column.latitude];
          },
          getElevation: function elevation(column) {
            return column.value;
          },
          getFillColor: function color(column) {
            return rampColor(0.78 + 0.22 * intensityRatio(column.value, columnMax)).concat([235]);
          },
          updateTriggers: { getElevation: [columnMax, columns], getFillColor: [columnMax, columns] },
          transitions: { getElevation: 320 },
          extensions: [new TerrainExtension()]
        })
      ];
    },
    [collection, fillColors, selectedIdx, hoverIdx, columns, columnMax, theme, terrainReady, onHover, onSelect]
  );

  return (
    <DeckGL
      viewState={viewState}
      onViewStateChange={function changeView(event) {
        setViewState(event.viewState);
      }}
      onInteractionStateChange={handleInteraction}
      onHover={function hoverMap(info) {
        const idx = locate(info);
        onHover(idx >= 0 ? { idx: idx, x: info.x, y: info.y } : null);
      }}
      onClick={function clickMap(info) {
        const idx = locate(info);
        if (idx >= 0) {
          onSelect(idx);
        }
      }}
      controller={{ inertia: 400, touchRotate: true }}
      layers={layers}
      getCursor={function cursor(state) {
        return hoverIdx !== null && hoverIdx !== undefined ? 'pointer' : state.isDragging ? 'grabbing' : 'grab';
      }}
    />
  );
}
