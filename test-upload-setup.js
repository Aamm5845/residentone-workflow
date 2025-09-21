// Test script to validate upload functionality setup
const fs = require('fs');
const path = require('path');

console.log('🔍 Testing Upload Functionality Setup...\n');

// Test 1: Check if upload directories exist
const uploadDir = path.join(__dirname, 'public', 'uploads', 'design');
const uploadDirExists = fs.existsSync(uploadDir);

console.log(`📁 Upload directory (${uploadDir}): ${uploadDirExists ? '✅ EXISTS' : '❌ MISSING'}`);

// Test 2: Check if UploadZone component exists and has correct exports
const uploadZonePath = path.join(__dirname, 'src', 'components', 'design', 'UploadZone.tsx');
const uploadZoneExists = fs.existsSync(uploadZonePath);

console.log(`🔧 UploadZone component: ${uploadZoneExists ? '✅ EXISTS' : '❌ MISSING'}`);

if (uploadZoneExists) {
  const uploadZoneContent = fs.readFileSync(uploadZonePath, 'utf8');
  const hasReactDropzone = uploadZoneContent.includes('react-dropzone');
  const hasUploadEndpoint = uploadZoneContent.includes('/api/design/upload');
  
  console.log(`   - react-dropzone integration: ${hasReactDropzone ? '✅' : '❌'}`);
  console.log(`   - Upload API endpoint: ${hasUploadEndpoint ? '✅' : '❌'}`);
}

// Test 3: Check if upload API route exists
const uploadApiPath = path.join(__dirname, 'src', 'app', 'api', 'design', 'upload', 'route.ts');
const uploadApiExists = fs.existsSync(uploadApiPath);

console.log(`🌐 Upload API route: ${uploadApiExists ? '✅ EXISTS' : '❌ MISSING'}`);

if (uploadApiExists) {
  const uploadApiContent = fs.readFileSync(uploadApiPath, 'utf8');
  const hasFileStorage = uploadApiContent.includes('writeFile');
  const hasFormData = uploadApiContent.includes('formData.get');
  
  console.log(`   - File storage implementation: ${hasFileStorage ? '✅' : '❌'}`);
  console.log(`   - FormData handling: ${hasFormData ? '✅' : '❌'}`);
}

// Test 4: Check if sections API route exists
const sectionsApiPath = path.join(__dirname, 'src', 'app', 'api', 'design', 'sections', 'route.ts');
const sectionsApiExists = fs.existsSync(sectionsApiPath);

console.log(`🌐 Sections API route: ${sectionsApiExists ? '✅ EXISTS' : '❌ MISSING'}`);

// Test 5: Check if ReferenceBoard integration exists
const referenceBoardPath = path.join(__dirname, 'src', 'components', 'design', 'ReferenceBoard.tsx');
const referenceBoardExists = fs.existsSync(referenceBoardPath);

console.log(`📋 ReferenceBoard component: ${referenceBoardExists ? '✅ EXISTS' : '❌ MISSING'}`);

if (referenceBoardExists) {
  const referenceBoardContent = fs.readFileSync(referenceBoardPath, 'utf8');
  const hasUploadZoneImport = referenceBoardContent.includes('from \'./UploadZone\'');
  const hasUploadModal = referenceBoardContent.includes('showUploadModal');
  
  console.log(`   - UploadZone import: ${hasUploadZoneImport ? '✅' : '❌'}`);
  console.log(`   - Upload modal integration: ${hasUploadModal ? '✅' : '❌'}`);
}

// Test 6: Check if ActionBar integration exists
const actionBarPath = path.join(__dirname, 'src', 'components', 'design', 'ActionBar.tsx');
const actionBarExists = fs.existsSync(actionBarPath);

console.log(`⚡ ActionBar component: ${actionBarExists ? '✅ EXISTS' : '❌ MISSING'}`);

if (actionBarExists) {
  const actionBarContent = fs.readFileSync(actionBarPath, 'utf8');
  const hasOnAddImage = actionBarContent.includes('onAddImage');
  const hasImageHandler = actionBarContent.includes('handleAddImage');
  
  console.log(`   - onAddImage callback: ${hasOnAddImage ? '✅' : '❌'}`);
  console.log(`   - Image upload handler: ${hasImageHandler ? '✅' : '❌'}`);
}

// Test 7: Check if BedroomDesignWorkspace integration exists
const bedroomWorkspacePath = path.join(__dirname, 'src', 'components', 'design', 'BedroomDesignWorkspace.tsx');
const bedroomWorkspaceExists = fs.existsSync(bedroomWorkspacePath);

console.log(`🏠 BedroomDesignWorkspace component: ${bedroomWorkspaceExists ? '✅ EXISTS' : '❌ MISSING'}`);

if (bedroomWorkspaceExists) {
  const bedroomWorkspaceContent = fs.readFileSync(bedroomWorkspacePath, 'utf8');
  const hasUploadModal = bedroomWorkspaceContent.includes('showUploadModal');
  const hasOnAddImageProp = bedroomWorkspaceContent.includes('onAddImage=');
  
  console.log(`   - Upload modal state: ${hasUploadModal ? '✅' : '❌'}`);
  console.log(`   - onAddImage prop passing: ${hasOnAddImageProp ? '✅' : '❌'}`);
}

// Summary
console.log('\n📊 Summary:');
const checks = [
  uploadDirExists,
  uploadZoneExists,
  uploadApiExists,
  sectionsApiExists,
  referenceBoardExists,
  actionBarExists,
  bedroomWorkspaceExists
];

const passedChecks = checks.filter(Boolean).length;
const totalChecks = checks.length;

console.log(`✅ Passed: ${passedChecks}/${totalChecks} core checks`);

if (passedChecks === totalChecks) {
  console.log('🎉 Upload functionality setup is COMPLETE!');
  console.log('\n📝 Next steps:');
  console.log('1. Start the development server: npm run dev');
  console.log('2. Navigate to the Design Concept workspace');
  console.log('3. Try uploading an image using the "Add Reference" button');
  console.log('4. Verify the image appears in the reference board');
} else {
  console.log('⚠️  Some components are missing. Please check the failed items above.');
}

console.log('\n🔚 Test complete!');