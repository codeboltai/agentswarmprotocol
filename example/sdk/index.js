/**
 * Agent Swarm Protocol SDK
 * This package provides client and agent SDKs for interacting with Agent Swarm Protocol
 */

// Export client SDK
const SwarmClientSDK = require('./clientsdk/SwarmClientSDK');

// Export utility functions
const createClient = (config) => {
  return new SwarmClientSDK(config);
};

module.exports = {
  SwarmClientSDK,
  createClient
}; 