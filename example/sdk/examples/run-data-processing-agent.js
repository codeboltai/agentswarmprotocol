/**
 * Example script for running a Data Processing Agent using the Swarm Agent SDK.
 * This script demonstrates how to create, connect, and use a Data Processing Agent.
 */

// Load environment variables
require('dotenv').config({ path: '../../.env' });

// Import the SDK and other utilities
const { createAgent } = require('../index');
const fs = require('fs').promises;
const path = require('path');

/**
 * Main function to run the Data Processing Agent
 */
async function main() {
  try {
    console.log('Starting Data Processing Agent...');

    // Create the data processing agent
    const agent = createAgent({
      name: 'data-processing-agent-example',
      defaultModel: process.env.DEFAULT_LLM_MODEL || 'gpt-4',
      orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000'
    });

    // Register event handlers
    agent.on('task', async (message) => {
      console.log(`Received data processing task with ID: ${message.id}`);
      
      try {
        // Extract task details
        const { dataType, operation, dataPath, outputFormat } = message.data;
        
        if (!dataType || !operation) {
          throw new Error('Invalid task: dataType and operation are required');
        }
        
        console.log(`Processing ${dataType} data with operation: ${operation}`);
        
        // Example data processing operations
        let result;
        
        switch (operation) {
          case 'analyze':
            result = await analyzeData(dataPath, dataType);
            break;
          case 'transform':
            result = await transformData(dataPath, dataType, outputFormat);
            break;
          case 'clean':
            result = await cleanData(dataPath, dataType);
            break;
          default:
            throw new Error(`Unsupported operation: ${operation}`);
        }
        
        // Send the results back to the orchestrator
        agent.sendTaskResult(message.id, {
          result,
          operation,
          dataType,
          processingTime: new Date().toISOString(),
          statistics: {
            recordsProcessed: result.recordsProcessed || 0,
            errorCount: result.errorCount || 0
          }
        });
        
        console.log(`Data processing task ${message.id} completed successfully`);
      } catch (error) {
        console.error(`Error processing data task: ${error.message}`);
        agent.sendTaskError(message.id, error);
      }
    });

    agent.on('error', (error) => {
      console.error('Data Processing Agent error:', error);
    });

    // Connect to the orchestrator
    await agent.connect();
    console.log('Data Processing Agent connected to orchestrator');

    // Keep the process running
    console.log('Data Processing Agent is running. Press Ctrl+C to exit.');
  } catch (error) {
    console.error('Failed to start Data Processing Agent:', error);
    process.exit(1);
  }
}

/**
 * Example function to analyze data
 * @param {string} dataPath - Path to the data file
 * @param {string} dataType - Type of data (csv, json, etc.)
 * @returns {Object} - Analysis results
 */
async function analyzeData(dataPath, dataType) {
  console.log(`Analyzing ${dataType} data from ${dataPath || 'provided content'}`);
  
  // This is a simplified example
  return {
    recordsProcessed: 100,
    summary: "Sample data analysis complete",
    patterns: ["Detected pattern 1", "Detected pattern 2"],
    statistics: {
      mean: 42.5,
      median: 40,
      outliers: 3
    }
  };
}

/**
 * Example function to transform data
 * @param {string} dataPath - Path to the data file
 * @param {string} dataType - Type of data (csv, json, etc.)
 * @param {string} outputFormat - Desired output format
 * @returns {Object} - Transformation results
 */
async function transformData(dataPath, dataType, outputFormat) {
  console.log(`Transforming ${dataType} data to ${outputFormat} format`);
  
  // This is a simplified example
  return {
    recordsProcessed: 100,
    errorCount: 0,
    outputPath: `/tmp/transformed_data.${outputFormat}`,
    conversionDetails: {
      originalFormat: dataType,
      newFormat: outputFormat,
      compressionRatio: 0.8
    }
  };
}

/**
 * Example function to clean data
 * @param {string} dataPath - Path to the data file
 * @param {string} dataType - Type of data (csv, json, etc.)
 * @returns {Object} - Cleaning results
 */
async function cleanData(dataPath, dataType) {
  console.log(`Cleaning ${dataType} data`);
  
  // This is a simplified example
  return {
    recordsProcessed: 100,
    errorCount: 2,
    cleanedRecords: 98,
    issues: {
      missingValues: 5,
      incorrectFormats: 3,
      duplicates: 2
    }
  };
}

// Handle shutdown gracefully
process.on('SIGINT', async () => {
  console.log('Shutting down Data Processing Agent...');
  try {
    // Add any cleanup tasks here
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
});

// Run the main function
if (require.main === module) {
  main();
}

module.exports = { main }; 