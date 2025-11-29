const EventEmitter = require('events');
const Job = require('../../models/job.model');
const File = require('../../models/file.model');
const logger = require('../../utils/logger');
const config = require('../../config/server.config');

class JobQueue extends EventEmitter {
  constructor() {
    super();
    this.activeJobs = new Map();
    this.maxConcurrentJobs = config.queue.maxConcurrentJobs;
    this.processing = false;
    this.degradedMode = false; // True when MongoDB quota is exceeded
  }

  /**
   * Initialize queue - mark stuck jobs as failed to prevent crash loops
   */
  async initialize() {
    try {
      // Find jobs that were processing when server stopped
      const stuckJobs = await Job.find({ 
        status: 'processing' 
      });

      // Mark stuck jobs as FAILED (not pending) to prevent crash loops
      // They were likely causing OOM issues
      for (const job of stuckJobs) {
        try {
          job.status = 'failed';
          job.error = {
            message: 'Job was interrupted by server restart - marked as failed to prevent crash loop',
            timestamp: new Date()
          };
          job.completedAt = new Date();
          await job.save();
          logger.warn(`Marked stuck job as failed: ${job.jobId}`);
        } catch (saveError) {
          // If we can't save due to quota, just log and continue
          if (this.isQuotaError(saveError)) {
            logger.warn(`Cannot update stuck job ${job.jobId} - database quota exceeded`);
          } else {
            throw saveError;
          }
        }
      }

      logger.info('Job queue initialized');
      
      // Delay processing start to let server stabilize
      setTimeout(() => {
        this.startProcessing();
      }, 5000);
    } catch (error) {
      // Check if this is a quota error - if so, start in degraded mode
      if (this.isQuotaError(error)) {
        logger.warn('MongoDB quota exceeded - starting in degraded mode (read-only)');
        logger.warn('Please free up MongoDB storage or upgrade your plan');
        this.degradedMode = true;
        
        // Still start processing loop to handle reads/status checks
        setTimeout(() => {
          this.startProcessing();
        }, 5000);
        return; // Don't throw - allow server to start
      }
      
      logger.error('Job queue initialization error:', error);
      throw error;
    }
  }

  /**
   * Check if error is a MongoDB quota error
   */
  isQuotaError(error) {
    return error && (
      (error.code === 8000 && error.codeName === 'AtlasError') ||
      (error.message && error.message.includes('space quota'))
    );
  }

  /**
   * Add job to queue
   */
  async addJob(fileId, priority = 0) {
    // Check if in degraded mode
    if (this.degradedMode) {
      const error = new Error('Service temporarily unavailable - database storage quota exceeded. Please try again later.');
      error.statusCode = 503;
      throw error;
    }

    try {
      const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      const job = new Job({
        jobId,
        fileId,
        status: 'pending',
        priority,
        maxAttempts: config.queue.retryAttempts
      });

      await job.save();

      logger.info(`Job added to queue: ${jobId} for file: ${fileId}`);

      // Trigger processing
      this.processNext();

      return {
        jobId,
        fileId,
        status: job.status,
        createdAt: job.createdAt
      };
    } catch (error) {
      // Check for quota error and update degraded mode
      if (this.isQuotaError(error)) {
        this.degradedMode = true;
        const quotaError = new Error('Service temporarily unavailable - database storage quota exceeded. Please try again later.');
        quotaError.statusCode = 503;
        throw quotaError;
      }
      logger.error('Add job error:', error);
      throw error;
    }
  }

  /**
   * Start processing loop
   */
  startProcessing() {
    if (this.processing) return;
    
    this.processing = true;
    logger.info('Job queue processing started');
    
    // Process jobs every 2 seconds
    this.processingInterval = setInterval(() => {
      this.processNext();
    }, 2000);
  }

  /**
   * Stop processing
   */
  stopProcessing() {
    this.processing = false;
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
    }
    logger.info('Job queue processing stopped');
  }

  /**
   * Process next job in queue
   */
  async processNext() {
    try {
      // Check if we can process more jobs
      if (this.activeJobs.size >= this.maxConcurrentJobs) {
        return;
      }

      // Find next pending job (highest priority first)
      const job = await Job.findOne({ status: 'pending' })
        .sort({ priority: -1, createdAt: 1 })
        .exec();

      if (!job) {
        return; // No pending jobs
      }

      // Mark as processing
      job.status = 'processing';
      job.startedAt = new Date();
      await job.save();

      // Add to active jobs
      this.activeJobs.set(job.jobId, job);

      logger.info(`Processing job: ${job.jobId} (${this.activeJobs.size}/${this.maxConcurrentJobs} active)`);

      // Process job with timeout
      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Job timeout')), config.queue.jobTimeoutMs);
        });

        await Promise.race([
          this.executeJob(job),
          timeoutPromise
        ]);
      } catch (error) {
        logger.error(`Job execution error for ${job.jobId}:`, {
          message: error.message,
          fileId: job.fileId
        });
        await this.handleJobError(job, error);
      } finally {
        this.activeJobs.delete(job.jobId);
        
        // Process next job immediately
        setImmediate(() => this.processNext());
      }
    } catch (error) {
      logger.error('Process next error:', error);
      // Don't let errors stop the queue - retry after delay
      setTimeout(() => this.processNext(), 2000);
    }
  }

  /**
   * Execute job
   */
  async executeJob(job) {
    const fileService = require('../file.service');

    try {
      // Log memory before processing
      const memBefore = process.memoryUsage();
      logger.info(`Executing job ${job.jobId} - Memory before: ${Math.round(memBefore.heapUsed / 1024 / 1024)}MB / ${Math.round(memBefore.heapTotal / 1024 / 1024)}MB`);
      
      const result = await fileService.processFile(job.fileId);

      // Log memory after processing
      const memAfter = process.memoryUsage();
      logger.info(`Job completed: ${job.jobId} - Processed ${result.processed} records - Memory after: ${Math.round(memAfter.heapUsed / 1024 / 1024)}MB / ${Math.round(memAfter.heapTotal / 1024 / 1024)}MB`);

      // Mark as completed
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;
      await job.save();

      this.emit('job:complete', job);
    } catch (error) {
      logger.error(`Job execution failed for ${job.jobId}:`, {
        message: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Handle job error
   */
  async handleJobError(job, error) {
    job.attempts += 1;
    
    // Log detailed error information
    logger.error(`Job error details for ${job.jobId}:`, {
      message: error.message,
      stack: error.stack,
      fileId: job.fileId,
      attempt: job.attempts,
      maxAttempts: job.maxAttempts
    });
    
    job.error = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date()
    };

    if (job.attempts >= job.maxAttempts) {
      job.status = 'failed';
      job.completedAt = new Date();
      logger.error(`Job failed permanently after ${job.attempts} attempts: ${job.jobId} - Error: ${error.message}`);
      
      // Mark file as failed too
      try {
        const File = require('../../models/file.model');
        await File.updateOne(
          { fileId: job.fileId },
          { status: 'failed' }
        );
        logger.info(`Marked file ${job.fileId} as failed`);
      } catch (fileUpdateError) {
        logger.error('Failed to update file status:', fileUpdateError);
      }
      
      this.emit('job:failed', job);
    } else {
      job.status = 'pending';
      logger.warn(`Job failed (attempt ${job.attempts}/${job.maxAttempts}): ${job.jobId} - Will retry. Error: ${error.message}`);
      this.emit('job:retry', job);
    }

    await job.save();
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId) {
    const job = await Job.findOne({ jobId });
    
    if (!job) {
      throw new Error('Job not found');
    }

    return {
      jobId: job.jobId,
      fileId: job.fileId,
      status: job.status,
      priority: job.priority,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      result: job.result,
      error: job.error
    };
  }

  /**
   * List jobs with filtering and pagination
   */
  async listJobs(status = null, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const filter = status ? { status } : {};

    const [jobs, total] = await Promise.all([
      Job.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Job.countDocuments(filter)
    ]);

    return {
      jobs,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const [pending, processing, completed, failed, uploaded, fileProcessing, processed, fileFailed] = await Promise.all([
      Job.countDocuments({ status: 'pending' }),
      Job.countDocuments({ status: 'processing' }),
      Job.countDocuments({ status: 'completed' }),
      Job.countDocuments({ status: 'failed' }),
      File.countDocuments({ status: 'uploaded' }),
      File.countDocuments({ status: 'processing' }),
      File.countDocuments({ status: 'processed' }),
      File.countDocuments({ status: 'failed' })
    ]);

    return {
      pending,
      processing,
      completed,
      failed,
      active: this.activeJobs.size,
      maxConcurrent: this.maxConcurrentJobs,
      degradedMode: this.degradedMode,
      files: {
        uploaded,
        processing: fileProcessing,
        processed,
        failed: fileFailed
      }
    };
  }

  /**
   * Shutdown queue gracefully
   */
  async shutdown() {
    logger.info('Shutting down job queue...');
    
    this.stopProcessing();

    // Wait for active jobs to complete (max 30 seconds)
    const maxWaitTime = 30000;
    const startTime = Date.now();

    while (this.activeJobs.size > 0 && Date.now() - startTime < maxWaitTime) {
      logger.info(`Waiting for ${this.activeJobs.size} active jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeJobs.size > 0) {
      logger.warn(`Forcing shutdown with ${this.activeJobs.size} active jobs remaining`);
      
      // Mark remaining active jobs as pending so they can be restarted
      for (const [jobId, job] of this.activeJobs) {
        try {
          await Job.updateOne(
            { jobId },
            { status: 'pending', startedAt: null }
          );
          logger.info(`Reset job to pending: ${jobId}`);
        } catch (error) {
          logger.error(`Failed to reset job ${jobId}:`, error);
        }
      }
      
      this.activeJobs.clear();
    }

    logger.info('Job queue shutdown complete');
  }
}

module.exports = new JobQueue();