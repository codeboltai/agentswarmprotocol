import { SwarmServiceSDK } from '@agent-swarm/service-sdk';

// Create a new base service
const service = new SwarmServiceSDK({
  name: 'Data Processing Service',
  description: 'A simple service that processes data in various formats',
  capabilities: ['textAnalyze', 'jsonTransform']
});

// Connect to the orchestrator
service.connect()
  .then(() => {
    console.log('Connected to orchestrator');
  })
  .catch(error => {
    console.error('Error connecting to orchestrator:', error.message);
  });

// Helper function to send task notifications
// Using only the valid notification types: 'progress' | 'info' | 'warning' | 'error' | 'debug'
async function sendProgressNotification(
  taskId: string, 
  message: string, 
  progressData: any = {}, 
  type: 'progress' | 'info' | 'warning' | 'error' | 'debug' = 'progress'
) {
  await service.sendTaskNotification(taskId, message, type, progressData);
}

// Register a text analysis function
service.onTask('textAnalyze', async (params, message) => {
  const taskId = message.id;
  console.log('Received text analysis request:', params);
  const { text } = params;
  
  if (!text || typeof text !== 'string') {
    throw new Error('Invalid input: text parameter must be a string');
  }
  
  // Send initial progress notification
  await sendProgressNotification(taskId, 'Starting text analysis...', { progress: 10 });
  
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Calculate basic text metrics
  const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
  const charCount = text.length;
  const sentenceCount = (text.match(/[.!?]+\s/g) || []).length + 1;
  const avgWordLength = wordCount > 0 ? 
    text.split(/\s+/).filter(word => word.length > 0)
      .reduce((sum, word) => sum + word.length, 0) / wordCount : 0;
  
  // Send progress update
  await sendProgressNotification(taskId, 'Processing text metrics...', { progress: 50 });
  
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Return the analysis results
  return {
    analysis: {
      wordCount,
      charCount,
      sentenceCount,
      avgWordLength: parseFloat(avgWordLength.toFixed(2)),
      lengthCategory: wordCount < 100 ? 'short' : wordCount < 500 ? 'medium' : 'long'
    },
    metadata: {
      processedAt: new Date().toISOString(),
      serviceVersion: '1.0.0'
    }
  };
});

// Register a JSON transformation function
service.onTask('jsonTransform', async (params, message) => {
  const taskId = message.id;
  console.log('Received JSON transform request:', params);
  const { data, transformation } = params;
  
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid input: data parameter must be an object');
  }
  
  if (!transformation || typeof transformation !== 'string') {
    throw new Error('Invalid input: transformation parameter must be a string');
  }
  
  // Send initial progress notification
  await sendProgressNotification(taskId, 'Starting JSON transformation...', { progress: 10 });
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  let result;
  
  // Send info notification with transformation details
  await sendProgressNotification(
    taskId, 
    'Applying transformation...', 
    {
      transformationType: transformation,
      dataSize: JSON.stringify(data).length
    }, 
    'info'
  );
  
  // Process the transformation
  try {
    switch (transformation) {
      case 'flatten':
        // Example implementation of flattening a nested JSON
        result = flattenObject(data);
        break;
        
      case 'keysToCamelCase':
        // Convert keys to camelCase
        result = convertKeysToCamelCase(data);
        break;
        
      case 'keysToSnakeCase':
        // Convert keys to snake_case
        result = convertKeysToSnakeCase(data);
        break;
        
      default:
        throw new Error(`Unsupported transformation: ${transformation}`);
    }
    
    await sendProgressNotification(taskId, 'Transformation completed', { progress: 90 });
    
    return {
      transformed: result,
      metadata: {
        transformation,
        processedAt: new Date().toISOString()
      }
    };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    await sendProgressNotification(taskId, `Error during transformation: ${errorMsg}`, {}, 'error');
    throw error;
  }
});

// Helper functions
function flattenObject(obj: Record<string, any>, prefix = ''): Record<string, any> {
  return Object.keys(obj).reduce((acc: Record<string, any>, key) => {
    const pre = prefix.length ? prefix + '.' : '';
    if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
      Object.assign(acc, flattenObject(obj[key], pre + key));
    } else {
      acc[pre + key] = obj[key];
    }
    return acc;
  }, {});
}

function convertKeysToCamelCase(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map((item: any) => convertKeysToCamelCase(item));
  }
  
  return Object.keys(obj).reduce((acc: Record<string, any>, key) => {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
    acc[camelKey] = typeof obj[key] === 'object' && obj[key] !== null 
      ? convertKeysToCamelCase(obj[key])
      : obj[key];
    return acc;
  }, {});
}

function convertKeysToSnakeCase(obj: any): any {
  if (typeof obj !== 'object' || obj === null) return obj;
  
  if (Array.isArray(obj)) {
    return obj.map((item: any) => convertKeysToSnakeCase(item));
  }
  
  return Object.keys(obj).reduce((acc: Record<string, any>, key) => {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    acc[snakeKey] = typeof obj[key] === 'object' && obj[key] !== null 
      ? convertKeysToSnakeCase(obj[key])
      : obj[key];
    return acc;
  }, {});
}

// Listen for events
service.on('error', (error) => {
  console.error('Service error:', error.message);
});

service.on('disconnected', () => {
  console.log('Disconnected from orchestrator');
});

console.log('Base service initialized and waiting for function calls...');
