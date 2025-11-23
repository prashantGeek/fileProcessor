const express = require('express');
const router = express.Router();
const processController = require('../controllers/process.controller');
const { validateParams, validateQuery } = require('../middleware/validation.middleware');
const Joi = require('joi');

// Validation schemas
const fileIdSchema = Joi.object({
  fileId: Joi.string().uuid().required()
});

const jobIdSchema = Joi.object({
  jobId: Joi.string().required()
});

const listJobsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  status: Joi.string().valid('pending', 'processing', 'completed', 'failed').optional()
});

// Routes
router.post('/process/:fileId', validateParams(fileIdSchema), processController.processFile);
router.get('/jobs/:jobId', validateParams(jobIdSchema), processController.getJobStatus);
router.get('/jobs', validateQuery(listJobsSchema), processController.listJobs);
router.get('/queue/stats', processController.getQueueStats);

module.exports = router;