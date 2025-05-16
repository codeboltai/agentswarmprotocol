/**
 * Agent Swarm Protocol UI Loading Fix
 * 
 * This script addresses the issue where the UI remains in a loading state
 * even after receiving a task.result message.
 * 
 * It works by intercepting WebSocket messages and directly manipulating
 * the DOM to remove the loading indicator when task.result messages are received.
 */

(function() {
  // Store the original WebSocket implementation
  const OriginalWebSocket = window.WebSocket;
  
  // Create a custom WebSocket class that intercepts messages
  class InterceptingWebSocket extends OriginalWebSocket {
    constructor(url, protocols) {
      console.log('Creating intercepting WebSocket to', url);
      super(url, protocols);
      
      // Hook into the onmessage event
      const originalOnMessage = this.onmessage;
      this.onmessage = function(event) {
        try {
          // Try to parse the message as JSON
          const message = JSON.parse(event.data);
          
          // Check if it's a task.result message
          if (message && message.type === 'task.result') {
            console.log('Intercepted task.result message:', message);
            
            // Force UI to stop loading
            setTimeout(() => {
              console.log('Forcing loading state to stop');
              // Remove loading message
              const loadingMessages = document.querySelectorAll('[data-loading="true"]');
              loadingMessages.forEach(el => el.remove());
              
              // Re-enable input and buttons
              const inputs = document.querySelectorAll('input[disabled], button[disabled]');
              inputs.forEach(input => {
                if (input.disabled && !input.getAttribute('data-originally-disabled')) {
                  input.disabled = false;
                }
              });
              
              // Remove any loading spinners
              const spinners = document.querySelectorAll('.animate-spin');
              spinners.forEach(spinner => {
                spinner.style.display = 'none';
              });
            }, 100);
          }
        } catch (e) {
          // Not JSON or other error, ignore
        }
        
        // Call the original handler
        if (originalOnMessage) {
          originalOnMessage.apply(this, arguments);
        }
      };
    }
  }
  
  // Replace the WebSocket implementation
  window.WebSocket = InterceptingWebSocket;
  
  console.log('WebSocket interceptor installed to fix loading state issue');
})(); 