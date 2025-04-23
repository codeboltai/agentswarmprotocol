/**
 * Example client for the Research Agent
 * 
 * This example demonstrates how to:
 * 1. Initialize the Swarm SDK client
 * 2. Send research tasks to the research agent
 * 3. Handle research results and progress updates
 */

require('dotenv').config({ path: '../../../.env' });
const { createClient } = require('../../../sdk');
const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

// Create CLI interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to get user input
function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('Research Agent Client Demo');
  console.log('--------------------------');
  
  try {
    // Initialize the client
    const client = createClient({
      orchestratorUrl: process.env.ORCHESTRATOR_URL || 'ws://localhost:3000'
    });
    
    // Connect to the orchestrator
    await client.connect();
    console.log('Connected to the orchestrator');
    
    // Generate a unique research ID
    const researchId = `research-${Date.now()}`;
    console.log(`Research ID: ${researchId}`);
    
    // Ask for research topic
    const topic = await askQuestion('Enter your research topic: ');
    
    // Ask for research parameters
    console.log('\nResearch Parameters:');
    const depth = await askQuestion('Research depth (brief/standard/deep): ');
    const format = await askQuestion('Output format (summary/detailed/structured): ');
    const sourceCount = await askQuestion('Number of sources to use (5-20): ');
    
    // Create output directory for saving results
    const outputDir = path.join(__dirname, 'research-results');
    try {
      await fs.mkdir(outputDir, { recursive: true });
    } catch (err) {
      // Directory may already exist
    }
    
    // Register for progress updates
    let lastUpdateTimestamp = Date.now();
    client.on('message', (message) => {
      if (message.type === 'progress' && 
          message.data && 
          message.data.researchId === researchId) {
        
        const now = Date.now();
        // Only show progress updates every 5 seconds to avoid flooding the console
        if (now - lastUpdateTimestamp > 5000) {
          lastUpdateTimestamp = now;
          console.log(`\nProgress update: ${message.data.status} (${message.data.progress}%)`);
          
          if (message.data.currentStep) {
            console.log(`Current step: ${message.data.currentStep}`);
          }
        }
      }
    });
    
    console.log('\nSending research task...');
    
    // Send the research task
    const task = {
      agentName: 'research-agent',
      taskData: {
        researchId,
        topic,
        parameters: {
          depth: depth || 'standard',
          format: format || 'detailed',
          sourceCount: parseInt(sourceCount, 10) || 10,
          includeCitations: true,
          language: 'en'
        }
      }
    };
    
    console.log('\nResearching topic. This may take several minutes...');
    console.log('You will receive progress updates as the research progresses.');
    
    // Send the task and wait for the complete response
    const response = await client.sendTaskAndWaitForResponse(task);
    
    // Display completion message and save results
    console.log('\n✅ Research completed!');
    console.log(`\nResearch summary: ${response.summary}`);
    
    if (response.sources && response.sources.length > 0) {
      console.log('\nSources used:');
      response.sources.slice(0, 5).forEach((source, index) => {
        console.log(`${index + 1}. ${source.title} - ${source.url}`);
      });
      
      if (response.sources.length > 5) {
        console.log(`...and ${response.sources.length - 5} more sources`);
      }
    }
    
    // Save the full research results to a file
    const outputFile = path.join(outputDir, `${researchId}.json`);
    await fs.writeFile(outputFile, JSON.stringify(response, null, 2));
    console.log(`\nFull research results saved to: ${outputFile}`);
    
    // If there's a formatted report, save it as well
    if (response.formattedReport) {
      const reportFile = path.join(outputDir, `${researchId}-report.md`);
      await fs.writeFile(reportFile, response.formattedReport);
      console.log(`Formatted report saved to: ${reportFile}`);
    }
    
    // Cleanup
    rl.close();
    await client.disconnect();
    console.log('Disconnected from the orchestrator');
    
  } catch (error) {
    console.error('Error in research client:', error);
    rl.close();
    process.exit(1);
  }
}

// Start the client if this file is run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Error running research client:', error);
    process.exit(1);
  });
}

module.exports = { main }; 