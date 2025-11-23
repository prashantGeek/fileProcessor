const mongoose = require('mongoose');

const jobSchema = new mongoose.Schema({
  jobId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  fileId: {
    type: String,
    required: true,
    index: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
    index: true
  },
  priority: {
    type: Number,
    default: 0
  },
  attempts: {
    type: Number,
    default: 0
  },
  maxAttempts: {
    type: Number,
    default: 3
  },
  result: {
    processed: Number,
    failed: Number,
    errors: [mongoose.Schema.Types.Mixed]
  },
  error: {
    message: String,
    stack: String,
    timestamp: Date
  },
  startedAt: Date,
  completedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

jobSchema.index({ status: 1, priority: -1, createdAt: 1 });
jobSchema.index({ fileId: 1, createdAt: -1 });

module.exports = mongoose.model('Job', jobSchema);