// =====================================================================
// Dueño: P2 (Controlador)
// Montar en server/src/app.js, ANTES de app.use('/api', api):
//   import focos3dRoutes from './routes/focos3d.routes.js';
//   app.use('/api', focos3dRoutes);
// =====================================================================

import { Router } from 'express';
import { getHotspotsFor3d, getZonesRightNow } from '../controllers/focos3d.controller.js';

const focos3dRoutes = Router();

focos3dRoutes.get('/focos3d', getHotspotsFor3d);
focos3dRoutes.get('/zonas/ahora', getZonesRightNow);

export default focos3dRoutes;
