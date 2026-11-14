// =====================================================================
// Dueño: P2 (Controlador)
// Montado en app.js:  app.use('/api', municipiosRoutes);
// =====================================================================

import { Router } from 'express';
import { getMunicipalMonthlySeries } from '../controllers/municipios.controller.js';

const municipiosRoutes = Router();

municipiosRoutes.get('/municipios/mensual', getMunicipalMonthlySeries);

export default municipiosRoutes;
