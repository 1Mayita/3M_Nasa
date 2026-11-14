// =====================================================================
// Dueño: P2 (Controlador)
// Montar en la app:  app.use('/api/gamc', gamcRoutes);
// =====================================================================

import { Router } from 'express';
import {
  listLayers,
  getLayerTile,
  getLayerLegendImage,
  getLayerLegendClasses,
  getInfoAtPoint,
  getDistrictsSummary
} from '../controllers/gamc.controller.js';

const gamcRoutes = Router();

gamcRoutes.get('/layers', listLayers);
gamcRoutes.get('/wms/:layer', getLayerTile);
gamcRoutes.get('/legend/:layer', getLayerLegendImage);
gamcRoutes.get('/legend/:layer/json', getLayerLegendClasses);
gamcRoutes.get('/info', getInfoAtPoint);
gamcRoutes.get('/districts/summary', getDistrictsSummary);

export default gamcRoutes;
