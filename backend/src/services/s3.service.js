const { s3 } = require('../config/aws.config');
const logger = require('../utils/logger');
const stream = require('stream');

class S3Service {
  constructor() {
    this.bucket = process.env.S3_BUCKET_NAME;
  }

  //Upload file to S3 using stream
  async uploadFile(fileStream, key, metadata = {}) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key,
        Body: fileStream,
        Metadata: metadata,
        ServerSideEncryption: 'AES256'
      };

      const result = await s3.upload(params).promise();
      
      logger.info(`File uploaded to S3: ${key}`);
      
      return {
        bucket: this.bucket,
        key: result.Key,
        location: result.Location,
        etag: result.ETag
      };
    } catch (error) {
      logger.error('S3 upload error:', error);
      throw new Error(`Failed to upload file to S3: ${error.message}`);
    }
  }

  //Get file stream from S3
  getFileStream(key) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key
      };

      const s3Stream = s3.getObject(params).createReadStream();
      
      s3Stream.on('error', (error) => {
        logger.error(`S3 stream error for key ${key}:`, error);
      });

      return s3Stream;
    } catch (error) {
      logger.error('S3 getObject error:', error);
      throw new Error(`Failed to get file from S3: ${error.message}`);
    }
  }

  //get file metadata from s3
  async getFileMetadata(key) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key
      };

      const metadata = await s3.headObject(params).promise();
      
      return {
        size: metadata.ContentLength,
        lastModified: metadata.LastModified,
        contentType: metadata.ContentType,
        metadata: metadata.Metadata
      };
    } catch (error) {
      logger.error('S3 headObject error:', error);
      throw new Error(`Failed to get file metadata: ${error.message}`);
    }
  }

  //Delete file from S3
  async deleteFile(key) {
    try {
      const params = {
        Bucket: this.bucket,
        Key: key
      };

      await s3.deleteObject(params).promise();
      logger.info(`File deleted from S3: ${key}`);
    } catch (error) {
      logger.error('S3 delete error:', error);
      throw new Error(`Failed to delete file from S3: ${error.message}`);
    }
  }

  //Check if file exists
  async fileExists(key) {
    try {
      await this.getFileMetadata(key);
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }
}

module.exports = new S3Service();