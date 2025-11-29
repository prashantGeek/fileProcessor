const { v4: uuidv4 } = require('uuid');
const File = require('../models/file.model');
const FileData = require('../models/fileData.model');
const s3Service = require('./s3.service');
const StreamProcessor = require('../utils/streamProcessor');
const logger = require('../utils/logger');
const config = require('../config/server.config');

class FileService {
  constructor() {
    this.streamProcessor = new StreamProcessor(
      config.batch.size,
      config.batch.timeoutMs
    );
  }

  /**
   * Create file record and upload to S3
   */
  async uploadFile(fileStream, originalName, fileSize, mimeType) {
    const fileId = uuidv4();
    const s3Key = `uploads/${fileId}/${originalName}`;

    try {
      // Upload to S3
      const s3Result = await s3Service.uploadFile(fileStream, s3Key, {
        originalName,
        uploadedAt: new Date().toISOString()
      });

      // Create database record
      const file = new File({
        fileId,
        originalName,
        s3Key: s3Result.key,
        s3Bucket: s3Result.bucket,
        fileSize,
        mimeType,
        status: 'uploaded'
      });

      await file.save();

      logger.info(`File created: ${fileId}`);

      return {
        fileId,
        originalName,
        fileSize,
        uploadedAt: file.uploadedAt,
        status: file.status
      };
    } catch (error) {
      logger.error('File upload error:', error);
      throw error;
    }
  }

  /**
   * Get file by ID
   */
  async getFileById(fileId) {
    const file = await File.findOne({ fileId });
    
    if (!file) {
      throw new Error('File not found');
    }

    return file;
  }

  /**
   * Process file: read from S3 and store in MongoDB
   */
  async processFile(fileId) {
    const file = await this.getFileById(fileId);

    if (file.status === 'processing') {
      throw new Error('File is already being processed');
    }

    // Update status
    file.status = 'processing';
    await file.save();

    try {
      // Get file stream from S3
      const fileStream = s3Service.getFileStream(file.s3Key);

      // Determine parser based on file type
      const parser = this.getParserForFile(file.originalName);

      // Process stream in batches
      const result = await this.streamProcessor.processStream(
        fileStream,
        parser,
        async (batch) => {
          // Bulk insert to MongoDB
          await this.saveBatch(fileId, batch);
        }
      );

      // Update file status
      file.status = 'processed';
      file.processedAt = new Date();
      await file.save();

      logger.info(`File processing completed: ${fileId}`);

      return result;
    } catch (error) {
      file.status = 'failed';
      await file.save();
      
      logger.error(`File processing failed: ${fileId}`, error);
      throw error;
    }
  }

  /**
   * Save batch of parsed data to MongoDB
   */
  async saveBatch(fileId, batch) {
    const documents = batch.map(item => ({
      fileId,
      lineNumber: item.lineNumber,
      content: item.content,
      data: item.data,
      timestamp: item.timestamp
    }));

    try {
      await FileData.insertMany(documents, { ordered: false });
    } catch (error) {
      // Handle duplicate key errors gracefully
      if (error.code !== 11000) {
        throw error;
      }
      logger.warn(`Some documents were duplicates in batch for file ${fileId}`);
    }
  }

  /**
   * Get parser based on file extension
   */
  getParserForFile(filename) {
    const ext = filename.toLowerCase().split('.').pop();

    switch (ext) {
      case 'csv':
        return this.streamProcessor.parseCSVLine.bind(this.streamProcessor);
      case 'json':
      case 'jsonl':
        return this.streamProcessor.parseJSONLine.bind(this.streamProcessor);
      case 'log':
      case 'txt':
      default:
        return this.streamProcessor.parseTextLine.bind(this.streamProcessor);
    }
  }

  /**
   * Get file data with pagination
   */
  async getFileData(fileId, page = 1, limit = 100) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      FileData.find({ fileId })
        .sort({ lineNumber: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      FileData.countDocuments({ fileId })
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * List all files with pagination
   */
  async listFiles(page = 1, limit = 20, status = null) {
    const skip = (page - 1) * limit;
    const filter = status ? { status } : {};

    const [files, total] = await Promise.all([
      File.find(filter)
        .sort({ uploadedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      File.countDocuments(filter)
    ]);

    return {
      files,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Delete file and its data
   */
  async deleteFile(fileId) {
    const file = await this.getFileById(fileId);

    // Delete from S3
    await s3Service.deleteFile(file.s3Key);

    // Delete file data
    await FileData.deleteMany({ fileId });

    // Delete file record
    await File.deleteOne({ fileId });

    logger.info(`File deleted: ${fileId}`);
  }
}

module.exports = new FileService();