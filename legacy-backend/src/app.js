import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import apiRouter from './routes/api.js';
import { initializeDatabase } from './db/init.js';
import { startInterestScheduler } from './services/interest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const app = express();
const PORT = process.env.PORT || 5000;

// Security headers
app.use(helmet({
  // Disburse endpoints accept base64 image data URLs in JSON; CSP is left to
  // the frontend's own build, not relevant to this API-only server.
  contentSecurityPolicy: false,
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// General API rate limit — generous, just to blunt scripted abuse
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 500,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests. Please slow down and try again shortly.' }
}));

// Enable CORS and JSON parsing (5mb cap bounds base64 photo uploads)
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Serving uploaded proof images (local mock storage)
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Wire up API router
app.use('/api', apiRouter);

// Serve frontend build static files in production
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
app.use(express.static(frontendDist));
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/uploads')) {
    return next();
  }
  res.sendFile(path.join(frontendDist, 'index.html'));
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(500).json({ 
    message: 'An unexpected error occurred on the server.',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Bootstrapping function
async function boot() {
  // 1. Initialize DB tables and seed mock records if database is empty
  await initializeDatabase();

  // 2. Start Scheduled Interest Accrual engine (scans every 60 seconds in development)
  startInterestScheduler(60 * 1000);

  // 3. Listen on assigned port
  app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 CASH LENDING BACKEND STARTED`);
    console.log(`📡 Port: ${PORT}`);
    console.log(`📂 Database: Connecting via Knex (${process.env.DB_CLIENT})`);
    console.log(`🔑 JWT Authorization: Enabled`);
    console.log(`⏰ Interest Accrual Check: Running every 60s`);
    console.log(`======================================================\n`);
  });
}

boot().catch((err) => {
  console.error('Server boot failed:', err);
});
