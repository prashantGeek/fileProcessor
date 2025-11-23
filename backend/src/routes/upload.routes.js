const express = require('express');
const router = express.Router();
const uploadController = require('../controllers/upload.controller');
const { upload } = require('../middleware/upload.middleware');
const { validateParams, validateQuery } = require('../middleware/validation.middleware');
const Joi = require('joi');

// Validation schemas
const fileIdSchema = Joi.object({
  fileId: Joi.string().uuid().required()
});

const listFilesSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  status: Joi.string().valid('uploaded', 'processing', 'processed', 'failed').optional()
});

const fileDataSchema = Joi.object({
  page: Joi.number().integer().min(1).optional(),
  limit: Joi.number().integer().min(1).max(1000).optional()
});

// Routes
router.post('/upload', upload.single('file'), uploadController.uploadFile);
router.get('/files', validateQuery(listFilesSchema), uploadController.listFiles);
router.get('/files/:fileId', validateParams(fileIdSchema), uploadController.getFile);
router.delete('/files/:fileId', validateParams(fileIdSchema), uploadController.deleteFile);
router.get('/files/:fileId/data', validateParams(fileIdSchema), validateQuery(fileDataSchema), uploadController.getFileData);

module.exports = router;