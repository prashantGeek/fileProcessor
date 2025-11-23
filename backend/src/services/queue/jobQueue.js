const EventEmitter = require('events');
const Job = require('../../models/job.model');
const logger = require('../../utils/logger');
const config = require('../../config/server.config');

class JobQueue extends EventEmitter {
  constructor() {
    super();
    this.activeJobs = new Map();
    this.maxConcurrentJobs = config.queue.maxConcurrentJobs;
    this.processing = false;
  }

  /**
   * Initialize queue - restore pending jobs from database
   */
  async initialize() {
    try {
      // Find jobs that were processing when server stopped
      const stuckJobs = await Job.find({ 
        status: 'processing' 
      });

      // Reset stuck jobs to pending
      for (const job of stuckJobs) {
        job.status = 'pending';
        await job.save();
        logger.info(`Reset stuck job: ${job.jobId}`);
      }

      logger.info('Job queue initialized');
      this.startProcessing();
    } catch (error) {
      logger.error('Job queue initialization error:', error);
      throw error;
    }
  }

  /**
   * Add job to queue
   */
  async addJob(fileId, priority = 0) {
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

      // Get next pending job with highest priority
      const job = await Job.findOne({ 
        status: 'pending' 
      })
      .sort({ priority: -1, createdAt: 1 })
      .exec();

      if (!job) {
        return;
      }

      // Mark as processing
      job.status = 'processing';
      job.startedAt = new Date();
      await job.save();

      this.activeJobs.set(job.jobId, job);

      logger.info(`Processing job: ${job.jobId}`);

      // Emit job start event
      this.emit('job:start', job);

      // Process with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Job timeout')), config.queue.jobTimeoutMs);
      });

      try {
        await Promise.race([
          this.executeJob(job),
          timeoutPromise
        ]);
      } catch (error) {
        await this.handleJobError(job, error);
      } finally {
        this.activeJobs.delete(job.jobId);
        
        // Process next job
        setImmediate(() => this.processNext());
      }
    } catch (error) {
      logger.error('Process next error:', error);
    }
  }

  /**
   * Execute job
   */
  async executeJob(job) {
    const fileService = require('../file.service');

    try {
      const result = await fileService.processFile(job.fileId);

      // Mark as completed
      job.status = 'completed';
      job.completedAt = new Date();
      job.result = result;
      await job.save();

      logger.info(`Job completed: ${job.jobId}`);
      this.emit('job:complete', job);
    } catch (error) {
      throw error;
    }
  }

  /**
   * Handle job error
   */
  async handleJobError(job, error) {
    job.attempts += 1;
    job.error = {
      message: error.message,
      stack: error.stack,
      timestamp: new Date()
    };

    if (job.attempts >= job.maxAttempts) {
      job.status = 'failed';
      job.completedAt = new Date();
      logger.error(`Job failed after ${job.attempts} attempts: ${job.jobId}`);
      this.emit('job:failed', job);
    } else {
      job.status = 'pending';
      logger.warn(`Job failed (attempt ${job.attempts}/${job.maxAttempts}): ${job.jobId}`);
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
      attempts: job.attempts,
      maxAttempts: job.maxAttempts,
      result: job.result,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt
    };
  }

  /**
   * Get queue statistics
   */
  async getStats() {
    const [pending, processing, completed, failed] = await Promise.all([
      Job.countDocuments({ status: 'pending' }),
      Job.countDocuments({ status: 'processing' }),
      Job.countDocuments({ status: 'completed' }),
      Job.countDocuments({ status: 'failed' })
    ]);

    return {
      pending,
      processing,
      completed,
      failed,
      active: this.activeJobs.size,
      maxConcurrent: this.maxConcurrentJobs
    };
  }

  /**
   * List jobs with filters
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
   * Graceful shutdown
   */
  async shutdown() {
    logger.info('Shutting down job queue...');
    this.stopProcessing();

    // Wait for active jobs to complete (with timeout)
    const shutdownTimeout = 30000; // 30 seconds
    const startTime = Date.now();

    while (this.activeJobs.size > 0 && Date.now() - startTime < shutdownTimeout) {
      logger.info(`Waiting for ${this.activeJobs.size} active jobs to complete...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    if (this.activeJobs.size > 0) {
      logger.warn(`Forcing shutdown with ${this.activeJobs.size} active jobs`);
    } else {
      logger.info('All jobs completed. Queue shutdown complete.');
    }
  }
}

module.exports = new JobQueue();