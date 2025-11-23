const mongoose = require('mongoose');

const fileSchema = new mongoose.Schema({
  fileId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  originalName: {
    type: String,
    required: true
  },
  s3Key: {
    type: String,
    required: true
  },
  s3Bucket: {
    type: String,
    required: true
  },
  fileSize: {
    type: Number,
    required: true
  },
  mimeType: {
    type: String,
    required: true
  },
  uploadedAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  status: {
    type: String,
    enum: ['uploaded', 'processing', 'processed', 'failed'],
    default: 'uploaded',
    index: true
  },
  processedAt: Date,
  metadata: {
    type: Map,
    of: String
  }
}, {
  timestamps: true
});

fileSchema.index({ uploadedAt: -1 });
fileSchema.index({ status: 1, uploadedAt: -1 });

module.exports = mongoose.model('File', fileSchema);