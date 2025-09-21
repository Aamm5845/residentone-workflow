// Quick test to verify stage name mappings work correctly
const { getStageName } = require('./src/constants/workflow.ts');

// Test the stage name mappings
console.log('Testing stage name mappings:');
console.log('THREE_D ->', getStageName('THREE_D')); // Should be "3D Rendering Workspace"
console.log('DESIGN ->', getStageName('DESIGN')); // Should be "Design Concept" 
console.log('CLIENT_APPROVAL ->', getStageName('CLIENT_APPROVAL')); // Should be "Client Approval"
console.log('DRAWINGS ->', getStageName('DRAWINGS')); // Should be "Drawings"
console.log('FFE ->', getStageName('FFE')); // Should be "FFE"