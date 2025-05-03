/**
 * Simple script to test that the SDK can be built
 */

import { SwarmClientSDK } from './';

async function main() {
  console.log('Creating SDK instance');
  const sdk = new SwarmClientSDK({
    orchestratorUrl: 'ws://localhost:3001'
  });

  console.log('SDK created successfully');
}

main().catch(console.error); 