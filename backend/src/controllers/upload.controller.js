const fileService = require('../services/file.service');
const { Readable } = require('stream');
const logger = require('../utils/logger');

class UploadController {
  async uploadFile(req, res, next) {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded'
        });
      }

      const { originalname, size, mimetype, buffer } = req.file;

      // Convert buffer to stream for S3 upload
      const fileStream = Readable.from(buffer);

      const result = await fileService.uploadFile(
        fileStream,
        originalname,
        size,
        mimetype
      );

      logger.info(`File uploaded successfully: ${result.fileId}`);

      res.status(201).json({
        success: true,
        message: 'File uploaded successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async getFile(req, res, next) {
    try {
      const { fileId } = req.params;
      const file = await fileService.getFileById(fileId);

      res.json({
        success: true,
        data: file
      });
    } catch (error) {
      if (error.message === 'File not found') {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }
      next(error);
    }
  }

  async listFiles(req, res, next) {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const status = req.query.status;

      const result = await fileService.listFiles(page, limit, status);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }

  async deleteFile(req, res, next) {
    try {
      const { fileId } = req.params;
      await fileService.deleteFile(fileId);

      res.json({
        success: true,
        message: 'File deleted successfully'
      });
    } catch (error) {
      if (error.message === 'File not found') {
        return res.status(404).json({
          success: false,
          error: 'File not found'
        });
      }
      next(error);
    }
  }

  async getFileData(req, res, next) {
    try {
      const { fileId } = req.params;
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 100;

      const result = await fileService.getFileData(fileId, page, limit);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UploadController();