const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ override: true });

const connectDB = require('./config/db');
const { requestLogger } = require('./middleware/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const apiRoutes = require('./routes/index');
const { seedDatabaseIfEmpty } = require('./utils/seeder');

const app = express();
const PORT = process.env.PORT || 5000;

// Core Middleware
app.use(cors());
app.use(express.json({ limit: '16mb' }));
app.use(express.urlencoded({ extended: true, limit: '16mb' }));
app.use(requestLogger);

// Static frontend serving
app.use(express.static(__dirname));

// Mount MVC API Routes
app.use('/api', apiRoutes);

const mongoose = require('mongoose');

// Health check endpoint for cloud hosting platforms (Render, Railway, AWS, Docker)
app.get('/health', (req, res) => {
  const dbStates = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  const state = dbStates[mongoose.connection.readyState] || 'unknown';
  res.json({
    status: 'ok',
    database: state,
    timestamp: new Date().toISOString()
  });
});

// Root route serves the DLMS HTML interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Error handling middleware
app.use(notFoundHandler);
app.use(errorHandler);

// Start HTTP server immediately for instant port binding on Render / cloud providers
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('===========================================================');
  console.log(`DLMS MVC Server running at: http://0.0.0.0:${PORT}`);
  console.log(`Architecture: Models / Views / Controllers (MERN)`);
  console.log('===========================================================');
});

// Resilient background database initialization
async function initDatabase(retries = 5, delayMs = 3000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`[Database] Attempting connection (attempt ${attempt}/${retries})...`);
      await connectDB();
      await seedDatabaseIfEmpty();
      console.log('[Database] Connected and seeded successfully.');
      return;
    } catch (err) {
      console.warn(`[Database] Connection attempt ${attempt} failed: ${err.message}`);
      if (attempt < retries) {
        console.log(`[Database] Retrying in ${delayMs / 1000}s...`);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.error('[Database] All connection attempts failed. Server remains alive for health checks.');
      }
    }
  }
}

initDatabase();

// Graceful shutdown handling
const shutdown = async (signal) => {
  console.log(`\n[Server] Received ${signal}, closing gracefully...`);
  server.close(() => {
    console.log('[Server] HTTP connections closed.');
    process.exit(0);
  });
  setTimeout(() => {
    console.error('[Server] Forcefully terminating after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

