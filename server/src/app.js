import express from 'express';
import cors from 'cors';
import pool from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import githubRoutes from './routes/githubRoutes.js';
import analysisRoutes from './routes/analysisRoutes.js';
import skillRoutes from './routes/skillRoutes.js';

const app = express();

// ── 1. CORS Configuration ─────────────────────────────────────
// Allow requests from the local React frontend
const clientOrigin = process.env.CLIENT_URL || 'http://localhost:5173';
// Allow any origin in development for CORS to avoid blocked requests from localhost variations.
app.use(
  cors({
    origin: process.env.NODE_ENV === 'development' ? true : clientOrigin,
    credentials: true,
  })
);

// ── 2. Request Body Parsing ────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── 3. Health Check Endpoint ───────────────────────────────────
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Developer Growth Intelligence Platform backend is running successfully.',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// ── 4. Database Health Check Endpoint ──────────────────────────
app.get('/api/db-health', async (req, res) => {
  try {
    // Run a lightweight query to test pool connectivity
    const [rows] = await pool.query('SELECT 1 AS alive');

    if (rows && rows[0]?.alive === 1) {
      return res.status(200).json({
        status: 'OK',
        database: 'connected',
        message: 'MySQL database connection pool is active and operational.',
        timestamp: new Date().toISOString(),
      });
    }

    return res.status(500).json({
      status: 'ERROR',
      database: 'disconnected',
      message: 'Unexpected database query response.',
    });
  } catch (error) {
    console.error('[DB Health Check Error]:', error.message);

    return res.status(503).json({
      status: 'ERROR',
      database: 'unavailable',
      message: 'Unable to connect to MySQL database. Please verify server status and credentials.',
    });
  }
});

// ── 5. Application API Routes ──────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/analysis', analysisRoutes);
app.use('/api/skills', skillRoutes);

// ── 6. 404 Handler for Unknown Routes ──────────────────────────
app.use((req, res, next) => {
  res.status(404).json({
    success: false,
    message: `API endpoint not found: ${req.method} ${req.originalUrl}`,
  });
});

// ── 7. Centralized Error-Handling Middleware ───────────────────
app.use((err, req, res, next) => {
  console.error('[Server Error]:', err);
  const statusCode = res.statusCode && res.statusCode !== 200 ? res.statusCode : 500;
  res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' ? { stack: err.stack } : {}),
  });
});

export default app;
