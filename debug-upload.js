const fs = require('fs')
const path = require('path')

console.log('🔍 Debugging Upload Issues...\n')

// Check critical files and directories
const checks = [
  {
    name: 'Upload directory',
    path: path.join(__dirname, 'public', 'uploads', 'design'),
    isDir: true
  },
  {
    name: 'Upload API route',
    path: path.join(__dirname, 'src', 'app', 'api', 'design', 'upload', 'route.ts')
  },
  {
    name: 'Sections API route',
    path: path.join(__dirname, 'src', 'app', 'api', 'design', 'sections', 'route.ts')
  },
  {
    name: 'UploadZone component',
    path: path.join(__dirname, 'src', 'components', 'design', 'UploadZone.tsx')
  },
  {
    name: 'ReferenceBoard component',
    path: path.join(__dirname, 'src', 'components', 'design', 'ReferenceBoard.tsx')
  }
]

console.log('📂 File System Checks:')
checks.forEach(check => {
  const exists = fs.existsSync(check.path)
  const status = exists ? '✅ EXISTS' : '❌ MISSING'
  console.log(`   ${check.name}: ${status}`)
  
  if (exists && !check.isDir) {
    const content = fs.readFileSync(check.path, 'utf8')
    
    // Check specific patterns based on file type
    if (check.name.includes('Upload API')) {
      const hasFormData = content.includes('formData.get')
      const hasFileStorage = content.includes('writeFile')
      const hasLogging = content.includes('console.log')
      console.log(`      - FormData handling: ${hasFormData ? '✅' : '❌'}`)
      console.log(`      - File storage: ${hasFileStorage ? '✅' : '❌'}`)
      console.log(`      - Debug logging: ${hasLogging ? '✅' : '❌'}`)
    }
    
    if (check.name.includes('UploadZone')) {
      const hasDropzone = content.includes('react-dropzone')
      const hasApiCall = content.includes('/api/design/upload')
      const hasErrorHandling = content.includes('onUploadError')
      console.log(`      - React Dropzone: ${hasDropzone ? '✅' : '❌'}`)
      console.log(`      - API endpoint: ${hasApiCall ? '✅' : '❌'}`)
      console.log(`      - Error handling: ${hasErrorHandling ? '✅' : '❌'}`)
    }
  }
})

// Check environment and dependencies
console.log('\n📦 Environment Checks:')

// Check package.json for required dependencies
const packageJsonPath = path.join(__dirname, 'package.json')
if (fs.existsSync(packageJsonPath)) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'))
  const requiredDeps = ['react-dropzone', 'sonner']
  
  requiredDeps.forEach(dep => {
    const hasInDeps = packageJson.dependencies?.[dep]
    const hasInDevDeps = packageJson.devDependencies?.[dep]
    const installed = hasInDeps || hasInDevDeps
    console.log(`   ${dep}: ${installed ? '✅ INSTALLED' : '❌ MISSING'}`)
  })
}

// Check for common upload issues
console.log('\n🔧 Common Upload Issues Check:')

// Check if uploads directory is writable
const uploadsDir = path.join(__dirname, 'public', 'uploads', 'design')
try {
  const testFile = path.join(uploadsDir, 'test-write.txt')
  fs.writeFileSync(testFile, 'test')
  fs.unlinkSync(testFile)
  console.log('   Directory writable: ✅ YES')
} catch (error) {
  console.log('   Directory writable: ❌ NO - ' + error.message)
}

// Check if public directory is accessible
const publicDir = path.join(__dirname, 'public')
if (fs.existsSync(publicDir)) {
  console.log('   Public directory: ✅ EXISTS')
} else {
  console.log('   Public directory: ❌ MISSING')
}

// Instructions
console.log('\n📋 Next Steps:')
console.log('1. Try uploading an image in the browser')
console.log('2. Check the browser console for JavaScript errors')
console.log('3. Check the network tab for failed API requests')
console.log('4. Look at the server logs for upload attempts')
console.log('\n🌟 The server should show detailed logs when upload attempts are made')

console.log('\n🚀 To monitor server logs in real-time:')
console.log('   The development server is already running and will show upload logs automatically')