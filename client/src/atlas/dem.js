// =====================================================================
// Dueño: P3 (Vista)
// Elevación gruesa de Cochabamba (AWS Terrarium, zoom 7) para corregir el clic en 3D:
// el rayo del cursor choca contra la montaña, no contra el plano z=0.
// Estados: 'idle' | 'loading' | 'ready' | 'failed'. Mientras carga no se confirma ningún clic
// (evita seleccionar el municipio equivocado); si falla, se usa el plano z=0 como respaldo.
// =====================================================================

const TILE_ZOOM = 7;
const TILE_URL = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const BBOX = [-67.8, -18.8, -64.0, -15.4];

let tiles = null;
let status = 'idle';
let loadingPromise = null;

function lonToTileX(lon) {
  return ((lon + 180) / 360) * Math.pow(2, TILE_ZOOM);
}

function latToTileY(lat) {
  const radians = (lat * Math.PI) / 180;
  return ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) * Math.pow(2, TILE_ZOOM);
}

function loadTile(x, y) {
  return new Promise(function load(resolve) {
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = function loaded() {
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      context.drawImage(image, 0, 0);
      resolve({ key: x + '/' + y, pixels: context.getImageData(0, 0, 256, 256).data });
    };
    image.onerror = function failed() {
      resolve(null);
    };
    image.src = TILE_URL.replace('{z}', String(TILE_ZOOM)).replace('{x}', String(x)).replace('{y}', String(y));
  });
}

export function loadElevation() {
  if (loadingPromise !== null || status === 'ready') {
    return loadingPromise;
  }
  status = 'loading';
  const minX = Math.floor(lonToTileX(BBOX[0]));
  const maxX = Math.floor(lonToTileX(BBOX[2]));
  const minY = Math.floor(latToTileY(BBOX[3]));
  const maxY = Math.floor(latToTileY(BBOX[1]));
  const jobs = [];
  for (let x = minX; x <= maxX; x = x + 1) {
    for (let y = minY; y <= maxY; y = y + 1) {
      jobs.push(loadTile(x, y));
    }
  }
  loadingPromise = Promise.all(jobs).then(function store(results) {
    tiles = tiles || {};
    let failures = 0;
    results.forEach(function add(tile) {
      if (tile === null) {
        failures = failures + 1;
      } else {
        tiles[tile.key] = tile.pixels;
      }
    });
    status = failures === 0 ? 'ready' : 'failed';
    // si algo falló, permitir un reintento en la próxima llamada
    loadingPromise = failures === 0 ? loadingPromise : null;
    return tiles;
  });
  return loadingPromise;
}

export function elevationStatus() {
  return status;
}

// Metros sobre el nivel del mar; 0 donde no hay dato (fuera de la zona o tile caído)
export function elevationAt(lon, lat) {
  if (tiles === null) {
    return 0;
  }
  const fractionalX = lonToTileX(lon);
  const fractionalY = latToTileY(lat);
  const tileX = Math.floor(fractionalX);
  const tileY = Math.floor(fractionalY);
  const pixels = tiles[tileX + '/' + tileY];
  if (!pixels) {
    return 0;
  }
  const px = Math.min(255, Math.floor((fractionalX - tileX) * 256));
  const py = Math.min(255, Math.floor((fractionalY - tileY) * 256));
  const offset = (py * 256 + px) * 4;
  return pixels[offset] * 256 + pixels[offset + 1] + pixels[offset + 2] / 256 - 32768;
}

// Punto geográfico bajo el cursor, siguiendo el rayo hasta la superficie del relieve.
// Devuelve null mientras la elevación carga o si el cálculo no converge.
export function locateOnTerrain(viewport, x, y) {
  if (status === 'idle' || status === 'loading') {
    loadElevation();
    return null;
  }
  let coordinate = viewport.unproject([x, y]);
  let previousHeight = Infinity;
  for (let step = 0; step < 6; step = step + 1) {
    const height = elevationAt(coordinate[0], coordinate[1]);
    coordinate = viewport.unproject([x, y], { targetZ: height });
    if (Math.abs(height - previousHeight) < 5) {
      return coordinate;
    }
    previousHeight = height;
  }
  // no convergió (ladera muy empinada): se acepta solo si la última diferencia fue pequeña
  const lastHeight = elevationAt(coordinate[0], coordinate[1]);
  return Math.abs(lastHeight - previousHeight) < 120 ? coordinate : null;
}
