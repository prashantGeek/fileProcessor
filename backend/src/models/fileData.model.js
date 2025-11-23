const mongoose = require('mongoose');

const fileDataSchema = new mongoose.Schema({
  fileId: {
    type: String,
    required: true,
    index: true
  },
  lineNumber: {
    type: Number,
    required: true
  },
  content: {
    type: String
  },
  data: {
    type: mongoose.Schema.Types.Mixed
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

fileDataSchema.index({ fileId: 1, lineNumber: 1 });
fileDataSchema.index({ fileId: 1, timestamp: -1 });

module.exports = mongoose.model('FileData', fileDataSchema);