# Data Processing Base Service

This is a minimal example of a service built using the Agent Swarm Protocol Service SDK.

## Features

- Connects to an Agent Swarm Protocol orchestrator
- Provides text analysis functionality
- Provides JSON transformation capabilities
- Sends progress notifications
- Error handling

## Getting Started

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the service:
   ```bash
   npm start
   ```

## Available Functions

### 1. Text Analysis (`textAnalyze`)

Analyzes text and returns metrics like word count, character count, etc.

Example input:
```json
{
  "text": "This is a sample text that will be analyzed. It contains multiple sentences. The service will count words and other metrics."
}
```

Example output:
```json
{
  "analysis": {
    "wordCount": 21,
    "charCount": 116,
    "sentenceCount": 3,
    "avgWordLength": 4.52,
    "lengthCategory": "short"
  },
  "metadata": {
    "processedAt": "2023-06-15T12:34:56.789Z",
    "serviceVersion": "1.0.0"
  }
}
```

### 2. JSON Transformation (`jsonTransform`)

Transforms JSON data based on the specified transformation type.

Supported transformations:
- `flatten` - Flattens nested JSON objects
- `keysToCamelCase` - Converts all keys to camelCase format
- `keysToSnakeCase` - Converts all keys to snake_case format

Example input:
```json
{
  "data": {
    "user_info": {
      "first_name": "John",
      "last_name": "Doe",
      "contact": {
        "email_address": "john.doe@example.com",
        "phone_number": "123-456-7890"
      }
    },
    "settings": {
      "notification_preferences": {
        "email_notifications": true,
        "sms_notifications": false
      }
    }
  },
  "transformation": "keysToCamelCase"
}
```

## Development

To run in development mode with auto-reload:
```bash
npm run dev
```

To build the TypeScript code:
```bash
npm run build
``` 