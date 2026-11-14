// Rutas del API (dueño: P2). Contrato en docs/API.md
import { Router } from 'express';
import { health, meta, regions } from '../controllers/meta.controller.js';
import { calendar } from '../controllers/calendar.controller.js';
import { exportCsv } from '../controllers/export.controller.js';

const router = Router();
router.get('/health', health);
router.get('/meta', meta);
router.get('/regions', regions);
router.post('/calendar', calendar);
router.post('/export', exportCsv);

export default router;
