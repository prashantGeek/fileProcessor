const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db.config');
const config = require('./config/server.config');
const logger = require('./utils/logger');
const jobQueue = require('./services/queue/jobQueue');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

// Import routes
const uploadRoutes = require('./routes/upload.routes');
const processRoutes = require('./routes/process.routes');

// Initialize Express app
const app = express();

// Trust proxy (important for EC2 behind load balancer)
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS
app.use(cors({
  origin: config.corsOrigin,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Logging middleware
if (config.env === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim())
    }
  }));
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.env
  });
});

// API routes
app.use('/api', uploadRoutes);
app.use('/api', processRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'FileProc Backend API',
    version: '1.0.0',
    status: 'running',
    endpoints: {
      upload: 'POST /api/upload',
      process: 'POST /api/process/:fileId',
      jobs: 'GET /api/jobs',
      files: 'GET /api/files',
      health: 'GET /health'
    }
  });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);
  
  // Stop accepting new requests
  server.close(async () => {
    logger.info('HTTP server closed');
    
    try {
      // Shutdown job queue
      await jobQueue.shutdown();
      
      // Close database connection
      const mongoose = require('mongoose');
      await mongoose.connection.close();
      logger.info('Database connection closed');
      
      logger.info('Graceful shutdown completed');
      process.exit(0);
    } catch (error) {
      logger.error('Error during shutdown:', error);
      process.exit(1);
    }
  });

  // Force shutdown after 45 seconds
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 45000);
};

// Start server
let server;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Initialize job queue
    await jobQueue.initialize();
    
    // Start HTTP server
    server = app.listen(config.port, config.host, () => {
      logger.info(`Server running on http://${config.host}:${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`Max concurrent jobs: ${config.queue.maxConcurrentJobs}`);
    });

    // Graceful shutdown handlers
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;