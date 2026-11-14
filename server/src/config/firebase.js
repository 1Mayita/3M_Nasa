// Conexión opcional a Firebase Firestore (dueño: P1 - Modelo, la usa server/src/models)
// Si no hay credenciales o firebase-admin no está instalado, devuelve null y el modelo usa archivos locales.
import fs from 'node:fs';
import { env } from './env.js';

let dbPromise = null;

export function getFirestore() {
  if (dbPromise) return dbPromise;
  dbPromise = (async () => {
    const key = env.firebaseServiceAccount;
    if (!key || !fs.existsSync(key)) return null;
    try {
      const admin = (await import('firebase-admin')).default;
      if (!admin.apps.length) {
        const cred = JSON.parse(fs.readFileSync(key, 'utf8'));
        admin.initializeApp({ credential: admin.credential.cert(cred) });
      }
      console.log('[firebase] Firestore conectado');
      return admin.firestore();
    } catch (err) {
      console.warn('[firebase] no disponible, uso archivos locales:', err.message);
      return null;
    }
  })();
  return dbPromise;
}
