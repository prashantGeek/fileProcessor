const { Readable } = require('stream');
const readline = require('readline');
const logger = require('./logger');

class StreamProcessor {
  constructor(batchSize = 1000, batchTimeoutMs = 5000) {
    this.batchSize = batchSize;
    this.batchTimeoutMs = batchTimeoutMs;
  }

  /**
   * Process a stream line by line with batching
   * @param {Readable} stream - Input stream
   * @param {Function} lineParser - Function to parse each line
   * @param {Function} batchProcessor - Function to process batch of parsed lines
   * @returns {Promise<{processed: number, failed: number, errors: Array}>}
   */
  async processStream(stream, lineParser, batchProcessor) {
    let batch = [];
    let lineNumber = 0;
    let processedCount = 0;
    let failedCount = 0;
    const errors = [];
    let batchTimer = null;

    const rl = readline.createInterface({
      input: stream,
      crlfDelay: Infinity
    });

    const flushBatch = async () => {
      if (batch.length === 0) return;

      try {
        await batchProcessor(batch);
        processedCount += batch.length;
        logger.info(`Processed batch of ${batch.length} records. Total: ${processedCount}`);
      } catch (error) {
        failedCount += batch.length;
        logger.error(`Batch processing failed:`, error);
        errors.push({
          type: 'batch_error',
          message: error.message,
          batchSize: batch.length
        });
      }

      batch = [];
      
      if (batchTimer) {
        clearTimeout(batchTimer);
        batchTimer = null;
      }
    };

    const scheduleBatchFlush = () => {
      if (batchTimer) {
        clearTimeout(batchTimer);
      }
      batchTimer = setTimeout(async () => {
        await flushBatch();
      }, this.batchTimeoutMs);
    };

    return new Promise((resolve, reject) => {
      rl.on('line', async (line) => {
        lineNumber++;
        
        // Skip empty lines
        if (!line.trim()) {
          return;
        }

        try {
          const parsedData = lineParser(line, lineNumber);
          
          if (parsedData) {
            batch.push(parsedData);
          }

          // Flush batch when it reaches the batch size
          if (batch.length >= this.batchSize) {
            rl.pause();
            await flushBatch();
            rl.resume();
          } else {
            scheduleBatchFlush();
          }
        } catch (error) {
          failedCount++;
          logger.warn(`Failed to parse line ${lineNumber}: ${error.message}`);
          errors.push({
            line: lineNumber,
            content: line.substring(0, 100),
            error: error.message
          });
        }
      });

      rl.on('close', async () => {
        try {
          // Flush remaining batch
          await flushBatch();
          
          logger.info(`Stream processing completed. Processed: ${processedCount}, Failed: ${failedCount}`);
          
          resolve({
            processed: processedCount,
            failed: failedCount,
            errors: errors.slice(0, 100) // Limit error list
          });
        } catch (error) {
          reject(error);
        }
      });

      rl.on('error', (error) => {
        logger.error('Stream reading error:', error);
        reject(error);
      });
    });
  }

  /**
   * Parse CSV line
   */
  parseCSVLine(line, lineNumber) {
    const values = line.split(',').map(v => v.trim());
    
    if (values.length === 0) {
      throw new Error('Empty line');
    }

    return {
      lineNumber,
      data: values,
      timestamp: new Date()
    };
  }

  /**
   * Parse JSON line
   */
  parseJSONLine(line, lineNumber) {
    try {
      const data = JSON.parse(line);
      return {
        lineNumber,
        data,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Invalid JSON: ${error.message}`);
    }
  }

  /**
   * Parse plain text line
   */
  parseTextLine(line, lineNumber) {
    return {
      lineNumber,
      content: line,
      timestamp: new Date()
    };
  }
}

module.exports = StreamProcessor;