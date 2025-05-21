// Entry point for the orchestrator
// This file re-exports the orchestrator instance from core/index.ts
import orchestrator, { Orchestrator } from './core/index';

// Export the orchestrator instance and class
export default orchestrator;
export { Orchestrator };

// If this file is run directly, start the orchestrator
if (require.main === module) {
  orchestrator.start()
    .catch(error => {
      console.error('Failed to start orchestrator:', error);
      process.exit(1);
    });
} 