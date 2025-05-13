/**
 * File Management Service using SwarmServiceSDK
 * Provides file system operations with real-time progress notifications
 */
const { SwarmServiceSDK } = require('servicesdk');
const fs = require('fs').promises;
const path = require('path');
const util = require('util');
const glob = util.promisify(require('glob'));
require('dotenv').config();

// Base working directory - can be configured or defaulted
const BASE_DIR = process.env.FILE_SERVICE_BASE_DIR || process.cwd();

// Utility to ensure paths don't escape the base directory
function sanitizePath(filePath) {
  // Normalize the path and remove any parent directory references
  const normalizedPath = path.normalize(filePath).replace(/^(\.\.(\/|\\|$))+/, '');
  // Join with the base directory
  return path.join(BASE_DIR, normalizedPath);
}

/**
 * Initialize and start the File Management Service
 * @param {Object} config - Configuration options
 * @returns {SwarmServiceSDK} The service instance
 */
function startFileManagementService(config = {}) {
  // Create the File Management service
  const fileService = new SwarmServiceSDK({
    name: config.name || 'File Management Service',
    description: config.description || 'A service for file system operations',
    capabilities: ['read', 'write', 'list', 'search', 'delete', 'move', 'copy'],
    orchestratorUrl: config.orchestratorUrl || process.env.ORCHESTRATOR_SERVICE_URL || 'ws://localhost:3002'
  });

  // Register the 'read' function to read file contents
  fileService.onTask('read', async (params, notify, metadata) => {
    console.log('Received file read request:', params);
    
    const { filePath, encoding = 'utf8' } = params;
    
    if (!filePath) {
      throw new Error('File path is required');
    }
    
    const fullPath = sanitizePath(filePath);
    
    // Send initial progress notification
    await notify('Starting file read operation...', { progress: 0 });
    
    try {
      // Check if the file exists
      await notify('Checking file existence...', { progress: 20 });
      const stats = await fs.stat(fullPath);
      
      if (!stats.isFile()) {
        throw new Error(`Path exists but is not a file: ${filePath}`);
      }
      
      // Read the file
      await notify('Reading file contents...', { 
        progress: 50,
        filePath,
        fileSize: stats.size
      });
      
      const content = await fs.readFile(fullPath, { encoding });
      
      // Completion
      await notify('File read complete', { progress: 100 });
      
      // Return the result
      return {
        content,
        stats: {
          size: stats.size,
          lastModified: stats.mtime,
          created: stats.birthtime
        }
      };
    } catch (error) {
      // Send error notification
      await notify(`Error reading file: ${error.message}`, {}, 'error');
      throw error;
    }
  });

  // Register the 'write' function to write content to a file
  fileService.onTask('write', async (params, notify, metadata) => {
    console.log('Received file write request:', params);
    
    const { filePath, content, encoding = 'utf8', createDirectories = false } = params;
    
    if (!filePath) {
      throw new Error('File path is required');
    }
    
    if (content === undefined) {
      throw new Error('Content is required');
    }
    
    const fullPath = sanitizePath(filePath);
    
    // Send initial progress notification
    await notify('Starting file write operation...', { progress: 0 });
    
    try {
      // Create directories if needed
      if (createDirectories) {
        await notify('Creating directories if needed...', { progress: 20 });
        await fs.mkdir(path.dirname(fullPath), { recursive: true });
      }
      
      // Write the file
      await notify('Writing file contents...', { 
        progress: 50,
        filePath,
        contentSize: typeof content === 'string' ? content.length : content.byteLength
      });
      
      await fs.writeFile(fullPath, content, { encoding });
      
      // Get file info
      const stats = await fs.stat(fullPath);
      
      // Completion
      await notify('File write complete', { progress: 100 });
      
      // Return the result
      return {
        success: true,
        filePath,
        stats: {
          size: stats.size,
          lastModified: stats.mtime,
          created: stats.birthtime
        }
      };
    } catch (error) {
      // Send error notification
      await notify(`Error writing file: ${error.message}`, {}, 'error');
      throw error;
    }
  });

  // Register the 'list' function to list directory contents
  fileService.onTask('list', async (params, notify, metadata) => {
    console.log('Received directory list request:', params);
    
    const { directoryPath = '.', recursive = false, pattern } = params;
    
    const fullPath = sanitizePath(directoryPath);
    
    // Send initial progress notification
    await notify('Starting directory list operation...', { progress: 0 });
    
    try {
      // Check if the directory exists
      await notify('Checking directory existence...', { progress: 20 });
      const stats = await fs.stat(fullPath);
      
      if (!stats.isDirectory()) {
        throw new Error(`Path exists but is not a directory: ${directoryPath}`);
      }
      
      // List the directory contents
      await notify('Reading directory contents...', { progress: 50 });
      
      let files;
      if (recursive) {
        // If recursive, use glob to get all files
        const searchPattern = pattern 
          ? path.join(fullPath, pattern) 
          : path.join(fullPath, '**/*');
        
        files = await glob(searchPattern, { nodir: false });
        
        // Convert absolute paths to relative paths
        files = files.map(file => path.relative(BASE_DIR, file));
      } else {
        // Non-recursive directory listing
        const items = await fs.readdir(fullPath, { withFileTypes: true });
        
        files = await Promise.all(items.map(async item => {
          const itemPath = path.join(directoryPath, item.name);
          const itemStats = await fs.stat(sanitizePath(itemPath));
          
          return {
            name: item.name,
            path: itemPath,
            isDirectory: item.isDirectory(),
            stats: {
              size: itemStats.size,
              lastModified: itemStats.mtime,
              created: itemStats.birthtime
            }
          };
        }));
      }
      
      // Completion
      await notify('Directory list complete', { progress: 100 });
      
      // Return the result
      return {
        directory: directoryPath,
        items: files,
        count: files.length
      };
    } catch (error) {
      // Send error notification
      await notify(`Error listing directory: ${error.message}`, {}, 'error');
      throw error;
    }
  });

  // Register the 'search' function to search for files
  fileService.onTask('search', async (params, notify, metadata) => {
    console.log('Received file search request:', params);
    
    const { 
      basePath = '.', 
      pattern, 
      contentPattern, 
      maxResults = 100, 
      includeContent = false 
    } = params;
    
    if (!pattern && !contentPattern) {
      throw new Error('Either pattern or contentPattern is required');
    }
    
    const fullBasePath = sanitizePath(basePath);
    
    // Send initial progress notification
    await notify('Starting file search operation...', { progress: 0 });
    
    try {
      // Find files matching the pattern
      await notify('Finding files matching pattern...', { progress: 20 });
      
      // Default to all files if no pattern specified
      const searchPattern = pattern 
        ? path.join(fullBasePath, pattern) 
        : path.join(fullBasePath, '**/*');
      
      let files = await glob(searchPattern, { nodir: true });
      
      // Report progress
      await notify(`Found ${files.length} files matching pattern`, { 
        progress: 40,
        fileCount: files.length
      });
      
      // Search for content pattern if specified
      const results = [];
      if (contentPattern) {
        await notify('Searching file contents for pattern...', { progress: 50 });
        
        // Convert the content pattern to a regex
        const regex = new RegExp(contentPattern, 'i');
        let processedCount = 0;
        
        for (const file of files) {
          if (results.length >= maxResults) {
            break;
          }
          
          try {
            const content = await fs.readFile(file, 'utf8');
            const matches = content.match(regex);
            
            if (matches) {
              const fileStats = await fs.stat(file);
              
              results.push({
                path: path.relative(BASE_DIR, file),
                stats: {
                  size: fileStats.size,
                  lastModified: fileStats.mtime,
                  created: fileStats.birthtime
                },
                matches: matches.length,
                content: includeContent ? content : undefined
              });
            }
            
            // Update progress periodically
            processedCount++;
            if (processedCount % 10 === 0) {
              const progressPercent = Math.min(90, 50 + (processedCount / files.length) * 40);
              await notify(`Processed ${processedCount}/${files.length} files...`, { 
                progress: progressPercent,
                processedCount,
                totalCount: files.length,
                matchesFound: results.length
              });
            }
          } catch (err) {
            console.error(`Error reading file ${file}:`, err);
            // Continue with next file
          }
        }
      } else {
        // Just return the file matches without content search
        results.push(...files.slice(0, maxResults).map(file => ({
          path: path.relative(BASE_DIR, file)
        })));
      }
      
      // Completion
      await notify('File search complete', { 
        progress: 100,
        resultsCount: results.length
      });
      
      // Return the result
      return {
        basePath,
        pattern,
        contentPattern,
        results,
        count: results.length,
        hasMore: files.length > maxResults
      };
    } catch (error) {
      // Send error notification
      await notify(`Error searching files: ${error.message}`, {}, 'error');
      throw error;
    }
  });

  // Register the 'delete' function
  fileService.onTask('delete', async (params, notify, metadata) => {
    console.log('Received file delete request:', params);
    
    const { filePath, recursive = false } = params;
    
    if (!filePath) {
      throw new Error('File path is required');
    }
    
    const fullPath = sanitizePath(filePath);
    
    // Send initial progress notification
    await notify('Starting file delete operation...', { progress: 0 });
    
    try {
      // Check if the path exists
      await notify('Checking path existence...', { progress: 20 });
      const stats = await fs.stat(fullPath);
      
      // Delete the file or directory
      await notify('Deleting path...', { progress: 50 });
      
      if (stats.isDirectory()) {
        if (!recursive) {
          throw new Error('Cannot delete directory without recursive flag');
        }
        
        // Recursive directory deletion requires additional steps
        // First, list all files
        const entries = await glob(path.join(fullPath, '**/*'), { dot: true });
        
        // Delete files first, then directories from deepest to shallowest
        const sortedEntries = entries.sort((a, b) => b.split(path.sep).length - a.split(path.sep).length);
        
        for (let i = 0; i < sortedEntries.length; i++) {
          const entry = sortedEntries[i];
          const stats = await fs.stat(entry);
          
          if (stats.isDirectory()) {
            await fs.rmdir(entry);
          } else {
            await fs.unlink(entry);
          }
          
          // Update progress
          const progressPercent = Math.min(90, 50 + (i / sortedEntries.length) * 40);
          if (i % 10 === 0 || i === sortedEntries.length - 1) {
            await notify(`Deleted ${i + 1}/${sortedEntries.length} items...`, { 
              progress: progressPercent
            });
          }
        }
        
        // Delete the root directory
        await fs.rmdir(fullPath);
      } else {
        // Simple file deletion
        await fs.unlink(fullPath);
      }
      
      // Completion
      await notify('Delete operation complete', { progress: 100 });
      
      // Return the result
      return {
        success: true,
        path: filePath,
        wasDirectory: stats.isDirectory()
      };
    } catch (error) {
      // Send error notification
      await notify(`Error deleting path: ${error.message}`, {}, 'error');
      throw error;
    }
  });

  // Set up event listeners
  fileService.on('connected', () => {
    console.log('File Management Service connected to orchestrator');
  });

  fileService.on('registered', (info) => {
    console.log('File Management Service registered successfully:', info);
    console.log(`Service ID: ${fileService.serviceId}`);
  });

  fileService.on('error', (error) => {
    console.error('File Management Service error:', error.message);
  });

  fileService.on('disconnected', () => {
    console.log('File Management Service disconnected from orchestrator');
  });

  // Connect to the orchestrator
  fileService.connect()
    .then(() => {
      console.log('File Management Service running and ready to accept tasks');
    })
    .catch(error => {
      console.error('Failed to connect to orchestrator:', error.message);
      process.exit(1);
    });

  return fileService;
}

// If file is run directly, start the service
if (require.main === module) {
  // Configuration from environment variables
  const config = {
    orchestratorUrl: process.env.ORCHESTRATOR_SERVICE_URL || 'ws://localhost:3002',
    name: process.env.SERVICE_NAME || 'File Management Service',
    description: process.env.SERVICE_DESCRIPTION || 'A service for file system operations',
    baseDir: process.env.FILE_SERVICE_BASE_DIR
  };

  console.log('Starting File Management Service with config:', config);

  // Start the service
  const service = startFileManagementService(config);

  // Handle process signals for graceful shutdown
  process.on('SIGINT', () => {
    console.log('Shutting down File Management Service...');
    service.disconnect();
    setTimeout(() => process.exit(0), 1000);
  });

  process.on('SIGTERM', () => {
    console.log('Terminating File Management Service...');
    service.disconnect();
    setTimeout(() => process.exit(0), 1000);
  });
}

module.exports = {
  startFileManagementService
}; 