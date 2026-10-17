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

// Health check endpoint for cloud hosting platforms (Render, Railway, AWS, Docker)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
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

// Server startup & Database Initialization
async function startServer() {
  try {
    await connectDB();
    await seedDatabaseIfEmpty();

    const server = app.listen(PORT, () => {
      console.log('===========================================================');
      console.log(`DLMS MVC Server running at: http://localhost:${PORT}`);
      console.log(`Architecture: Models / Views / Controllers (MERN)`);
      console.log('===========================================================');
    });

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
  } catch (err) {
    console.error('Server startup failed:', err.message);
    process.exit(1);
  }
}

startServer();
