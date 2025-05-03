"use strict";
/**
 * Simple script to test that the SDK can be built
 */
Object.defineProperty(exports, "__esModule", { value: true });
const _1 = require("./");
async function main() {
    console.log('Creating SDK instance');
    const sdk = new _1.SwarmClientSDK({
        orchestratorUrl: 'ws://localhost:3001'
    });
    console.log('SDK created successfully');
}
main().catch(console.error);
//# sourceMappingURL=build.js.map