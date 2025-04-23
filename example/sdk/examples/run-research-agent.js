/**
 * Example script demonstrating how to use the Research Agent with the Agent Swarm Protocol SDK.
 * This script allows users to submit research queries, analyze content, summarize information,
 * and generate reports.
 */

require('dotenv').config();
const { createClient } = require('../../../sdk/node');
const readline = require('readline');

// Initialize the Swarm SDK client
const orchestratorUrl = process.env.ORCHESTRATOR_URL || 'ws://localhost:3000';
const client = createClient({ orchestratorUrl });

// Create CLI interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Helper function to prompt for user input
function askQuestion(query) {
  return new Promise((resolve) => rl.question(query, resolve));
}

// Display available commands
function displayHelp() {
  console.log('\nResearch Agent Commands:');
  console.log('  research <query> - Submit a research query on a topic');
  console.log('  analyze - Analyze content (you\'ll be prompted for the content)');
  console.log('  summarize - Summarize content (you\'ll be prompted for the content)');
  console.log('  report - Generate a report based on previous findings');
  console.log('  help - Display this help message');
  console.log('  exit - Exit the application\n');
}

// Main function to run the research agent interaction
async function main() {
  try {
    console.log('Connecting to the orchestrator...');
    await client.connect();
    console.log('Connected successfully!');
    
    const username = await askQuestion('What\'s your name? ');
    console.log(`\nHello ${username}! I'm the Research Agent interface.`);
    displayHelp();
    
    // Track research findings for potential report generation
    let researchFindings = [];
    
    // Main interaction loop
    while (true) {
      const input = await askQuestion('\nEnter a command (or type "help" for assistance): ');
      
      if (input.toLowerCase() === 'exit') {
        console.log('Exiting the research application. Goodbye!');
        break;
      }
      
      if (input.toLowerCase() === 'help') {
        displayHelp();
        continue;
      }
      
      // Handle research query
      if (input.toLowerCase().startsWith('research ')) {
        const query = input.substring('research '.length);
        console.log(`\nResearching: "${query}"...`);
        
        try {
          const task = {
            agentId: 'research-agent',
            type: 'research.query',
            data: {
              query,
              sources: ['web', 'news', 'academic'],
              maxResults: 5,
              user: { name: username }
            }
          };
          
          const response = await client.sendTask(task);
          console.log('\nResearch Results:');
          console.log(JSON.stringify(response.results, null, 2));
          
          // Store findings for potential report generation
          if (response.results && response.results.items) {
            researchFindings.push({
              query,
              timestamp: new Date().toISOString(),
              results: response.results
            });
          }
        } catch (error) {
          console.error('Error during research:', error.message);
        }
      }
      
      // Handle content analysis
      else if (input.toLowerCase() === 'analyze') {
        const content = await askQuestion('\nEnter the content to analyze: ');
        if (!content.trim()) {
          console.log('No content provided. Aborting analysis.');
          continue;
        }
        
        try {
          const task = {
            agentId: 'research-agent',
            type: 'research.analyze',
            data: {
              content,
              analysisType: 'comprehensive',
              user: { name: username }
            }
          };
          
          const response = await client.sendTask(task);
          console.log('\nAnalysis Results:');
          console.log(JSON.stringify(response.analysis, null, 2));
        } catch (error) {
          console.error('Error during analysis:', error.message);
        }
      }
      
      // Handle content summarization
      else if (input.toLowerCase() === 'summarize') {
        const content = await askQuestion('\nEnter the content to summarize: ');
        if (!content.trim()) {
          console.log('No content provided. Aborting summarization.');
          continue;
        }
        
        try {
          const task = {
            agentId: 'research-agent',
            type: 'research.summarize',
            data: {
              content,
              maxLength: 200,
              user: { name: username }
            }
          };
          
          const response = await client.sendTask(task);
          console.log('\nSummary:');
          console.log(response.summary);
          console.log(`\nOriginal length: ${response.originalLength} characters`);
          console.log(`Summary length: ${response.summaryLength} characters`);
        } catch (error) {
          console.error('Error during summarization:', error.message);
        }
      }
      
      // Handle report generation
      else if (input.toLowerCase() === 'report') {
        if (researchFindings.length === 0) {
          console.log('No research findings available for report generation. Please conduct research first.');
          continue;
        }
        
        const format = await askQuestion('Report format (text/markdown/html): ');
        const title = await askQuestion('Report title: ');
        
        try {
          const task = {
            agentId: 'research-agent',
            type: 'research.generateReport',
            data: {
              findings: researchFindings,
              format: format.toLowerCase(),
              title,
              includeReferences: true,
              user: { name: username }
            }
          };
          
          const response = await client.sendTask(task);
          console.log('\nGenerated Report:');
          console.log(response.report);
        } catch (error) {
          console.error('Error generating report:', error.message);
        }
      }
      
      // Handle unknown commands
      else {
        console.log('Unknown command. Type "help" to see available commands.');
      }
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    // Clean up
    rl.close();
    await client.disconnect();
  }
}

// Run the main function
main().catch(console.error); 