const { Readable } = require('stream');
const readline = require('readline');
const logger = require('./logger');

class StreamProcessor {
  constructor(batchSize = 100, batchTimeoutMs = 3000) {
    this.batchSize = batchSize;
    this.batchTimeoutMs = batchTimeoutMs;
  }

  /**
   * Force garbage collection if available
   */
  tryGC() {
    if (global.gc) {
      try {
        global.gc();
      } catch (e) {
        // Ignore GC errors
      }
    }
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
      crlfDelay: Infinity,
      terminal: false
    });

    const flushBatch = async () => {
      if (batch.length === 0) return;

      const currentBatch = batch;
      const batchLength = currentBatch.length;
      
      // Clear batch array immediately to free memory
      batch = [];
      
      try {
        await batchProcessor(currentBatch);
        processedCount += batchLength;
        logger.info(`Processed batch of ${batchLength} records. Total: ${processedCount}`);
      } catch (error) {
        failedCount += batchLength;
        logger.error(`Batch processing failed:`, error);
        errors.push({
          type: 'batch_error',
          message: error.message,
          batchSize: batchLength
        });
      }

      // Clear the batch reference
      currentBatch.length = 0;
      
      if (batchTimer) {
        clearTimeout(batchTimer);
        batchTimer = null;
      }

      // Force GC after each batch
      this.tryGC();
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
          
          // Only keep limited error details
          if (errors.length < 100) {
            errors.push({
              line: lineNumber,
              content: line.substring(0, 100),
              error: error.message
            });
          }
        }
      });

      rl.on('close', async () => {
        try {
          // Flush remaining batch
          await flushBatch();
          
          // Clean up
          if (batchTimer) {
            clearTimeout(batchTimer);
          }
          rl.removeAllListeners();
          
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
        if (batchTimer) {
          clearTimeout(batchTimer);
        }
        rl.removeAllListeners();
        reject(error);
      });
    });
  }

  /**
   * Parse CSV line - handles quoted fields with commas
   */
  parseCSVLine(line, lineNumber) {
    const values = this.parseCSVValues(line);
    
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
   * Parse CSV values handling quoted fields
   */
  parseCSVValues(line) {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        // Check for escaped quote
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    // Don't forget the last value
    values.push(current.trim());
    
    return values;
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