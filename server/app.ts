import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import apiRoutes from './routes';

export function createApp() {
  const app = express();

  // Enable JSON request body parsing
  app.use(express.json({ limit: '10mb' }));

  // Mount API routes
  // Mounting on '/api' handles standard /api/* requests
  // Mounting on '/' handles requests where a proxy or rewrite may strip the prefix
  app.use('/api', apiRoutes);
  app.use('/', apiRoutes);

  return app;
}

export const app = createApp();
export default app;
