// =====================================================================
// Dueño: P3 (Vista)
// Relieve 3D de Cochabamba con los 48 territorios municipales (deck.gl).
// - Municipios coloreados por intensidad de focos; hover eleva el contorno; clic selecciona
// - Cámara que vuela al municipio elegido y órbita lenta mientras nadie la toca
// - Columnas ámbar opcionales por celda (los focos como relieve vivo)
// =====================================================================

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import DeckGL from '@deck.gl/react';
import { FlyToInterpolator } from '@deck.gl/core';
import { GeoJsonLayer, ColumnLayer, BitmapLayer } from '@deck.gl/layers';
import { TerrainLayer, TileLayer } from '@deck.gl/geo-layers';
import { getGamcTileUrl } from '../services/gamcApi.js';
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

const HERO_VIEW = {
  longitude: -65.9,
  latitude: -17.35,
  zoom: 6.85,
  pitch: 63,
  bearing: -32,
  maxPitch: 78,
  minZoom: 6.2
};

// Cobertura de la API de la Alcaldía (solo el municipio de Cercado)
const GAMC_BBOX = [-66.280703, -17.53119, -66.06952, -17.257306];

function lonLatToWebMercator(longitude, latitude) {
  const x = (longitude * 20037508.34) / 180;
  const y = (Math.log(Math.tan(((90 + latitude) * Math.PI) / 360)) / (Math.PI / 180) * 20037508.34) / 180;
  return [x, y];
}

const ROTATION_DEGREES_PER_SECOND = 2.2;
const HERO_ROTATION_DEGREES_PER_SECOND = 3.4;
const IDLE_RESUME_MILLISECONDS = 9000;
const MAXIMUM_COLUMN_HEIGHT_METERS = 5200;

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const AtlasMap = forwardRef(function AtlasMap(props, ref) {
  const { collection, municipalities, values, maxValue, selectedIdx, hoverIdx, columns, columnMax, theme } = props;
  const { onSelect, onHover, onTerrainReady, rotationEnabled, entered, interactive, focusRegion, gamcLayers, active } = props;

  const [viewState, setViewState] = useState(HERO_VIEW);
  const [isIdle, setIsIdle] = useState(true);
  const [terrainReady, setTerrainReady] = useState(false);
  const [terrainLoaded, setTerrainLoaded] = useState(false);
  const idleTimerRef = useRef(null);
  const hasEnteredRef = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion());

  // el sistema puede cambiar la preferencia mientras la página está abierta
  useEffect(function watchMotionPreference() {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    function onChange() {
      setReducedMotion(query.matches);
    }
    query.addEventListener('change', onChange);
    return function cleanup() {
      query.removeEventListener('change', onChange);
    };
  }, []);

  // Vuelo de cámara al municipio elegido (o regreso al departamento)
  useEffect(
    function flyToSelection() {
      if (selectedIdx === null && focusRegion) {
        const regionWidth = Math.max(window.innerWidth * 0.5, 420);
        setViewState(function flyRegion(previous) {
          return Object.assign({}, previous, {
            longitude: (focusRegion.bbox[0] + focusRegion.bbox[2]) / 2 + (focusRegion.bbox[2] - focusRegion.bbox[0]) * 0.18,
            latitude: (focusRegion.bbox[1] + focusRegion.bbox[3]) / 2 - (focusRegion.bbox[3] - focusRegion.bbox[1]) * 0.12,
            zoom: Math.min(Math.max(zoomForBbox(focusRegion.bbox, regionWidth) - 0.6, 7.6), 9.6),
            pitch: 60,
            bearing: -18,
            transitionDuration: reducedMotion ? 0 : 2200,
            transitionInterpolator: new FlyToInterpolator({ speed: 1.0 })
          });
        });
        holdOrbit(2600);
        return;
      }
      if (selectedIdx === null) {
        if (!entered && !hasEnteredRef.current) {
          return;
        }
        hasEnteredRef.current = hasEnteredRef.current || entered;
        const targetView = entered ? DEPARTMENT_VIEW : HERO_VIEW;
        setViewState(function back(previous) {
          return Object.assign({}, previous, targetView, {
            transitionDuration: reducedMotion ? 0 : 2400,
            transitionInterpolator: new FlyToInterpolator({ speed: 0.9 })
          });
        });
        holdOrbit(3000);
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
    [selectedIdx, municipalities, reducedMotion, entered, focusRegion]
  );

  // Órbita lenta mientras nadie interactúa
  useEffect(
    function orbit() {
      if (!rotationEnabled || !active || !isIdle || reducedMotion || selectedIdx !== null || focusRegion) {
        return undefined;
      }
      let frameId = 0;
      let lastTime = performance.now();
      function tick(now) {
        const elapsed = now - lastTime;
        lastTime = now;
        setViewState(function turn(previous) {
          return Object.assign({}, previous, {
            bearing: previous.bearing + ((entered ? ROTATION_DEGREES_PER_SECOND : HERO_ROTATION_DEGREES_PER_SECOND) * elapsed) / 1000,
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
    [rotationEnabled, active, isIdle, reducedMotion, selectedIdx, entered, focusRegion]
  );

  // comandos de la barra de herramientas del mapa
  useImperativeHandle(ref, function expose() {
    return {
      zoomBy: function zoomBy(delta) {
        setIsIdle(false);
        setViewState(function change(previous) {
          return Object.assign({}, previous, {
            zoom: Math.min(Math.max(previous.zoom + delta, 6.2), 14),
            transitionDuration: reducedMotion ? 0 : 400,
            transitionInterpolator: undefined
          });
        });
      },
      reset: function reset() {
        holdOrbit(3000);
        setViewState(function change(previous) {
          return Object.assign({}, previous, focusRegion ? {} : DEPARTMENT_VIEW, {
            transitionDuration: reducedMotion ? 0 : 1600,
            transitionInterpolator: new FlyToInterpolator({ speed: 1.2 })
          });
        });
      },
      toggleTilt: function toggleTilt() {
        setIsIdle(false);
        setViewState(function change(previous) {
          return Object.assign({}, previous, {
            pitch: previous.pitch > 30 ? 0 : 58,
            transitionDuration: reducedMotion ? 0 : 900,
            transitionInterpolator: undefined
          });
        });
      },
      getPitch: function getPitch() {
        return viewState.pitch;
      }
    };
  });

  useEffect(function preloadElevation() {
    loadElevation();
  }, []);

  function locate(info) {
    if (info.viewport && info.x !== undefined && info.x >= 0) {
      const coordinate = locateOnTerrain(info.viewport, info.x, info.y);
      if (coordinate === null) {
        return -1;
      }
      return findMunicipalityIndex(municipalities, coordinate[0], coordinate[1]);
    }
    return -1;
  }

  // Pausa la órbita mientras la cámara vuela, para no cortar el vuelo
  function holdOrbit(milliseconds) {
    setIsIdle(false);
    clearTimeout(idleTimerRef.current);
    idleTimerRef.current = setTimeout(function resume() {
      setIsIdle(true);
    }, milliseconds);
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
      return values.map(function colorFor(value, i) {
        const dimmed = focusRegion && focusRegion.indices.indexOf(i) < 0;
        if (value <= 0) {
          if (focusRegion && !dimmed) {
            return [79, 127, 99, 120];
          }
          return EMPTY_COLOR.concat([dimmed ? 50 : 120]);
        }
        return rampColor(intensityRatio(value, maxValue)).concat([dimmed ? 55 : 185]);
      });
    },
    [values, maxValue, focusRegion]
  );

  const layers = useMemo(
    function buildLayers() {
      const draping = terrainLoaded ? [new TerrainExtension()] : [];
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
            setTerrainLoaded(true);
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
            if (focusRegion) {
              return focusRegion.indices.indexOf(feature.properties.idx) >= 0 ? [214, 232, 218, 235] : [191, 216, 196, 50];
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
            if (focusRegion && focusRegion.indices.indexOf(feature.properties.idx) >= 0) {
              return 1.8;
            }
            return 0.9;
          },
          updateTriggers: {
            getFillColor: [fillColors],
            getLineColor: [selectedIdx, hoverIdx, focusRegion],
            getLineWidth: [selectedIdx, hoverIdx, focusRegion]
          },
          transitions: reducedMotion ? {} : { getFillColor: 450, getLineWidth: 200 },
          extensions: draping
        }),
        ...(gamcLayers || []).map(function gamcLayer(name) {
          return new TileLayer({
            id: 'gamc-' + name,
            data: null,
            extent: GAMC_BBOX,
            minZoom: 9,
            maxZoom: 16,
            tileSize: 256,
            getTileData: function loadTile(tile) {
              const corner1 = lonLatToWebMercator(tile.bbox.west, tile.bbox.south);
              const corner2 = lonLatToWebMercator(tile.bbox.east, tile.bbox.north);
              const url = getGamcTileUrl(name) + '?SRS=EPSG:3857&BBOX=' + [corner1[0], corner1[1], corner2[0], corner2[1]].join(',') + '&WIDTH=256&HEIGHT=256';
              return fetch(url, { signal: tile.signal })
                .then(function toBlob(response) {
                  return response.ok ? response.blob() : null;
                })
                .then(function toBitmap(blob) {
                  return blob ? createImageBitmap(blob) : null;
                })
                .catch(function ignore() {
                  return null;
                });
            },
            renderSubLayers: function renderTile(layerProps) {
              const box = layerProps.tile.bbox;
              return new BitmapLayer(layerProps, {
                data: null,
                image: layerProps.data,
                bounds: [box.west, box.south, box.east, box.north],
                opacity: 0.9,
                extensions: draping
              });
            }
          });
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
          transitions: reducedMotion ? {} : { getElevation: 320 },
          extensions: draping
        })
      ];
    },
    [collection, fillColors, selectedIdx, hoverIdx, columns, columnMax, theme, terrainReady, terrainLoaded, gamcLayers, focusRegion, reducedMotion, onHover, onSelect]
  );

  return (
    <DeckGL
      viewState={viewState}
      onViewStateChange={function changeView(event) {
        setViewState(event.viewState);
      }}
      onInteractionStateChange={handleInteraction}
      onHover={function hoverMap(info) {
        if (!interactive) {
          return;
        }
        const idx = locate(info);
        onHover(idx >= 0 ? { idx: idx, x: info.x, y: info.y } : null);
      }}
      onClick={function clickMap(info) {
        if (!interactive) {
          return;
        }
        const idx = locate(info);
        if (idx >= 0) {
          onSelect(idx);
        }
      }}
      controller={{ inertia: 400, touchRotate: true }}
      layers={layers}
      useDevicePixels={Math.min(typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1, 1.5)}
      getCursor={function cursor(state) {
        return hoverIdx !== null && hoverIdx !== undefined ? 'pointer' : state.isDragging ? 'grabbing' : 'grab';
      }}
    />
  );
});

export default AtlasMap;
