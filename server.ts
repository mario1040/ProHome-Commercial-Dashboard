import dotenv from 'dotenv';
dotenv.config({ override: true });
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { initDb, isGoogleSheetsActive, db } from './server/db';
import apiRoutes from './server/routes';

async function startServer() {
  // Initialize Database from local store first so server is instantly ready
  initDb();

  const app = express();
  const PORT = 3000;

  // Enable JSON request body parsing
  app.use(express.json({ limit: '10mb' }));

  // API routes mounted FIRST
  app.use('/api', apiRoutes);

  // Vite middleware for development vs static build in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[ProHome Server] Ready and running on http://0.0.0.0:${PORT}`);

    // If Google Sheets integration is active, asynchronously pull fresh data
    if (isGoogleSheetsActive()) {
      console.log('[ProHome Server] Google Sheets active. Fetching initial dataset from Google Sheets...');
      db.pullAllFromSheets().then((res) => {
        console.log('[ProHome Server] Initial Google Sheets sync result:', res.message);
      }).catch((err) => {
        console.warn('[ProHome Server] Startup sync from Sheets had warning (using local store):', err.message);
      });
    }
  });
}

startServer().catch((err) => {
  console.error('[ProHome Server] Failed to start:', err);
  process.exit(1);
});
