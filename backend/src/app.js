/**
 * app.js — Express application setup
 * Configures middleware, routes, error handling, and static file serving.
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const path = require('path');

// Import route handlers
const authRoutes = require('./routes/auth');
const musicRoutes = require('./routes/music');
const subscriptionRoutes = require('./routes/subscription');

const app = express();

// ─── MIDDLEWARE ──────────────────────────────────────────────

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // Disable CSP for dev (enable in production)
  crossOriginEmbedderPolicy: false,
}));

// CORS — allow frontend to call the API
app.use(cors({
  origin: '*', // In production, restrict to your domain
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Parse JSON request bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// HTTP request logging
app.use(morgan('dev'));

// ─── STATIC FILES ────────────────────────────────────────────
// Serve the frontend from the frontend/ directory
app.use(express.static(path.join(__dirname, '../../frontend')));

// ─── API ROUTES ──────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/music', musicRoutes);
app.use('/api/subscriptions', subscriptionRoutes);

// ─── HEALTH CHECK ────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'music-subscription-api',
  });
});

// ─── CATCH-ALL: Serve frontend for non-API routes ────────────
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(__dirname, '../../frontend/index.html'));
  } else {
    res.status(404).json({ error: 'API endpoint not found' });
  }
});

// ─── ERROR HANDLING ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('❌ Unhandled Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
});

module.exports = app;
