// App Express (dueño: P2)
import express from 'express';
import cors from 'cors';
import api from './routes/api.routes.js';
import gamcRoutes from './routes/gamc.routes.js';
import zonesRoutes from './routes/zones.routes.js';
import focos3dRoutes from './routes/focos3d.routes.js';
import { env } from './config/env.js';

export function createApp() {
  const app = express();
  app.use(cors({ origin: env.corsOrigin }));
  app.use(express.json({ limit: '1mb' }));
  app.use('/api/gamc', gamcRoutes);
  app.use('/api/zones', zonesRoutes);
  app.use('/api', focos3dRoutes);
  app.use('/api', api);
  app.use((req, res) => res.status(404).json({ error: 'No encontrado' }));
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (!err.status || err.status >= 500) console.error(err);
    res.status(err.status || 500).json({ error: err.status ? err.message : 'Error interno' });
  });
  return app;
}
