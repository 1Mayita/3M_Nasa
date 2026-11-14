// MODELO (dueño: P1). Acceso a los datos procesados por el pipeline de Python.
// Las FIRMAS de las funciones exportadas son contrato (docs/DATA.md §4): no cambiarlas sin avisar a P2.
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';
import { getFirestore } from '../config/firebase.js';

let cache = null; // datos en memoria (columnar para no gastar RAM con millones de filas)

function loadCells() {
  if (cache) return cache;
  const file = path.join(env.dataDir, 'daily_cells.csv');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const header = lines[0].trim().split(',');
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  const n = lines.length - 1;
  const date = new Array(n), source = new Array(n);
  const lat = new Float32Array(n), lon = new Float32Array(n), harm = new Float32Array(n);
  const modis = new Int32Array(n), viirs = new Int32Array(n);
  let k = 0;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    const c = line.trim().split(',');
    date[k] = c[idx.date];
    lat[k] = +c[idx.lat];
    lon[k] = +c[idx.lon];
    modis[k] = +c[idx.modis_n];
    viirs[k] = +c[idx.viirs_n];
    harm[k] = +c[idx.harm_n];
    source[k] = c[idx.source];
    k++;
  }
  cache = { n: k, date, lat, lon, harm, modis, viirs, source };
  console.log(`[modelo] ${k.toLocaleString()} filas celda-día desde ${env.dataDir}`);
  return cache;
}

/** Nombre de la fuente de datos en uso: "processed" | "sample" | otra carpeta */
export function getDataSource() {
  return path.basename(env.dataDir);
}

export function getMetadata() {
  return JSON.parse(fs.readFileSync(path.join(env.dataDir, 'metadata.json'), 'utf8'));
}

/**
 * Celdas-día dentro de un bbox y rango de fechas (inclusive).
 * @param {{bbox:number[], start:string, end:string}} q  bbox = [minLon, minLat, maxLon, maxLat]
 * @returns {{date,lat,lon,modis_n,viirs_n,harm_n,source}[]}
 */
export function getDailyCells({ bbox, start, end }) {
  const d = loadCells();
  const [minx, miny, maxx, maxy] = bbox;
  const out = [];
  for (let i = 0; i < d.n; i++) {
    const dt = d.date[i];
    if (dt < start || dt > end) continue;
    const x = d.lon[i], y = d.lat[i];
    if (x < minx || x > maxx || y < miny || y > maxy) continue;
    out.push({ date: dt, lat: y, lon: x, modis_n: d.modis[i], viirs_n: d.viirs[i], harm_n: d.harm[i], source: d.source[i] });
  }
  return out;
}

/**
 * Focos individuales (para exportar CSV). Lee points/<año>.csv solo de los años necesarios.
 * @param {{bbox:number[], start:string, end:string, limit?:number, filter?:(lon:number,lat:number)=>boolean}} q
 * @returns {{header:string[], rows:string[][], truncated:boolean}}
 */
export function getPoints({ bbox, start, end, limit = Infinity, filter = null }) {
  const [minx, miny, maxx, maxy] = bbox;
  const y0 = +start.slice(0, 4), y1 = +end.slice(0, 4);
  let header = null;
  const rows = [];
  for (let y = y0; y <= y1; y++) {
    const file = path.join(env.dataDir, 'points', `${y}.csv`);
    if (!fs.existsSync(file)) continue;
    const lines = fs.readFileSync(file, 'utf8').split('\n');
    const h = lines[0].trim().split(',');
    header ??= h;
    const iLat = h.indexOf('latitude'), iLon = h.indexOf('longitude'), iDate = h.indexOf('acq_date');
    for (let i = 1; i < lines.length; i++) {
      if (!lines[i]) continue;
      const c = lines[i].trim().split(',');
      const dt = c[iDate];
      if (dt < start || dt > end) continue;
      const lat = +c[iLat], lon = +c[iLon];
      if (lon < minx || lon > maxx || lat < miny || lat > maxy) continue;
      if (filter && !filter(lon, lat)) continue;
      if (rows.length >= limit) return { header, rows, truncated: true };
      rows.push(c);
    }
  }
  return { header: header ?? ['sensor', 'platform', 'latitude', 'longitude', 'acq_date', 'acq_time', 'confidence', 'frp', 'daynight'], rows, truncated: false };
}

/** Regiones predefinidas: Firestore si está configurado, si no data/regions.json */
export async function getRegions() {
  const db = await getFirestore();
  if (db) {
    const snap = await db.collection('regions').get();
    if (!snap.empty) return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }
  return JSON.parse(fs.readFileSync(env.regionsFile, 'utf8'));
}
