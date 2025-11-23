const jobQueue = require('../services/queue/jobQueue');
const logger = require('../utils/logger');

class ProcessController {
  async processFile(req, res, next) {
    try {
      const { fileId } = req.params;
      const priority = parseInt(req.body.priority) || 0;

      const job = await jobQueue.addJob(fileId, priority);

      logger.info(`Processing job created: ${job.jobId} for file: ${fileId}`);

      res.status(202).json({
        success: true,
        message: 'File processing job queued',
        data: job
      });
    } catch (error) {
      next(error);
    }
  }

  async getJobStatus(req, res, next) {
    try {
      const { jobId } = req.params;
      const job = await jobQueue.getJobStatus(jobId);

      res.json({
        success: true,
        data: job
      });
    } catch (error) {
      if (error.message === 'Job not found') {
        return res.status(404).json({
          success: false,
          error: 'Job not found'
        });
      }
      next(error);
    }
  }

  async listJobs(req, res, next) {
    try {
      const status = req.query.status;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;

      const result = await jobQueue.listJobs(status, page, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getQueueStats(req, res, next) {
    try {
      const stats = await jobQueue.getStats();

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProcessController();