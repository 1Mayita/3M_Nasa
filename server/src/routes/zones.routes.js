// =====================================================================
// Dueño: P2 (Controlador)
// Montar en la app:  app.use('/api/zones', zonesRoutes);
// =====================================================================

import { Router } from 'express';
import { listZones, getZone, listFuels } from '../controllers/zones.controller.js';

const zonesRoutes = Router();

zonesRoutes.get('/', listZones);
zonesRoutes.get('/fuels', listFuels);
zonesRoutes.get('/:id', getZone);

export default zonesRoutes;
