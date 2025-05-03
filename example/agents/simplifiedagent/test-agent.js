/**
 * Test Script for Simplified Agent
 * 
 * This script runs the simplified agent with debugging enabled.
 */

// Enable debug mode
process.env.DEBUG = 'true';

// Import and start the agent
console.log('Starting simplified agent in debug mode...');
console.log('Press Ctrl+C to exit\n');

// Run the agent
require('./index.js'); 