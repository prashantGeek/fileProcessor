require('dotenv').config();

module.exports = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 10000,
  host: process.env.HOST || '0.0.0.0',
  corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 52428800, // 50MB max for free tier
    allowedFileTypes: (process.env.ALLOWED_FILE_TYPES || '.txt,.csv,.log').split(','),
    tempDir: '/tmp/uploads'
  },
  
  queue: {
    maxConcurrentJobs: parseInt(process.env.MAX_CONCURRENT_JOBS, 10) || 1, // Reduced for 512MB RAM
    retryAttempts: parseInt(process.env.JOB_RETRY_ATTEMPTS, 10) || 3,
    jobTimeoutMs: parseInt(process.env.JOB_TIMEOUT_MS, 10) || 300000 // 5 minutes
  },
  
  batch: {
    size: parseInt(process.env.BATCH_SIZE, 10) || 100, // Reduced for memory efficiency
    timeoutMs: parseInt(process.env.BATCH_TIMEOUT_MS, 10) || 3000
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS, 10) || 100
  }
};