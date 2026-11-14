// Configuración del servidor (dueño: P2 - Controlador)
import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(here, '../../..');          // raíz del repo
export const SERVER_ROOT = path.resolve(here, '../..');

function pickDataDir() {
  if (process.env.DATA_DIR) return path.resolve(SERVER_ROOT, process.env.DATA_DIR);
  const processed = path.join(ROOT, 'data', 'processed');
  if (fs.existsSync(path.join(processed, 'daily_cells.csv'))) return processed;
  return path.join(ROOT, 'data', 'sample');
}

export const env = {
  port: Number(process.env.PORT || 4000),
  corsOrigin: process.env.CORS_ORIGIN || '*',
  dataDir: pickDataDir(),
  regionsFile: path.join(ROOT, 'data', 'regions.json'),
  firebaseServiceAccount: process.env.FIREBASE_SERVICE_ACCOUNT
    ? path.resolve(SERVER_ROOT, process.env.FIREBASE_SERVICE_ACCOUNT)
    : null,
  exportMaxRows: 200_000,
  dailyMaxDays: 731,
};
