#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

/**
 * Comprehensive Debug Statement Cleanup Script
 * 
 * This script removes common debug statements from the codebase while preserving
 * essential error logging and maintaining code functionality.
 */

// Configuration
const CONFIG = {
  // Directories to process
  includeDirs: ['src', 'scripts'],
  
  // File extensions to process
  extensions: ['.ts', '.tsx', '.js', '.jsx'],
  
  // Files to skip
  skipFiles: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next'
  ],
  
  // Debug patterns to remove (with priority - higher priority processed first)
  patterns: [
    // High priority - verbose debug logs with emojis
    {
      priority: 1,
      pattern: /console\.log\(['"]\s*[🔍🚀📧✅❌⚠️🗑️📝🎨💾📤📋🔎🏷️🎯📊🚨📄🌟🆔🔧📦🔄⭐🎪]\s*[^']*['"]\s*,\s*\{[^}]*\}\s*\);?\s*$/gm,
      description: 'Verbose debug logs with emojis and objects'
    },
    
    // High priority - emoji debug logs
    {
      priority: 2, 
      pattern: /console\.log\(['"]\s*[🔍🚀📧✅❌⚠️🗑️📝🎨💾📤📋🔎🏷️🎯📊🚨📄🌟🆔🔧📦🔄⭐🎪][^'"]*['"]\s*(?:,\s*[^)]+)?\);?\s*$/gm,
      description: 'Debug logs with emojis'
    },
    
    // Medium priority - console.log with template literals
    {
      priority: 3,
      pattern: /console\.log\(`[^`]*`(?:,\s*[^)]+)?\);?\s*$/gm,
      description: 'Template literal console logs'
    },
    
    // Medium priority - specific debug patterns
    {
      priority: 4,
      pattern: /console\.log\(['"](?:Found|Creating|Deleting|Updating|Processing|Starting|Completed|Failed|Success)[^'"]*['"](?:,\s*[^)]+)?\);?\s*$/gm,
      description: 'Action-based debug logs'
    },
    
    // Low priority - general console.log (but preserve error context)
    {
      priority: 5,
      pattern: /(?<!\/\/.*)console\.log\([^)]*\);?\s*$/gm,
      description: 'General console.log statements',
      // Don't remove if in catch blocks or error contexts
      skipIfContext: /catch\s*\([^)]*\)\s*\{[^}]*console\.log/
    }
  ],
  
  // Comments to add for removed logging
  replacements: {
    errorContext: '// Removed debug logging',
    emptyLine: ''
  }
};

// Statistics tracking
const stats = {
  filesProcessed: 0,
  patternsFound: 0,
  patternsRemoved: 0,
  errors: 0
};

/**
 * Get all files to process
 */
function getFilesToProcess(dir, files = []) {
  const items = fs.readdirSync(dir);
  
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      if (!CONFIG.skipFiles.some(skip => fullPath.includes(skip))) {
        getFilesToProcess(fullPath, files);
      }
    } else {
      const ext = path.extname(fullPath);
      if (CONFIG.extensions.includes(ext)) {
        files.push(fullPath);
      }
    }
  }
  
  return files;
}

/**
 * Process a single file
 */
function processFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    let modifiedContent = content;
    let fileChanged = false;
    
    // Sort patterns by priority
    const sortedPatterns = [...CONFIG.patterns].sort((a, b) => a.priority - b.priority);
    
    for (const patternConfig of sortedPatterns) {
      const matches = modifiedContent.match(patternConfig.pattern);
      
      if (matches) {
        stats.patternsFound += matches.length;
        
        // Check if we should skip based on context
        if (patternConfig.skipIfContext) {
          const hasContext = patternConfig.skipIfContext.test(modifiedContent);
          if (hasContext) {
            console.log(`  Skipping ${matches.length} matches in ${filePath} due to context`);
            continue;
          }
        }
        
        // Remove the pattern
        modifiedContent = modifiedContent.replace(patternConfig.pattern, CONFIG.replacements.emptyLine);
        stats.patternsRemoved += matches.length;
        fileChanged = true;
        
        console.log(`  Removed ${matches.length} instances of: ${patternConfig.description}`);
      }
    }
    
    // Clean up extra empty lines
    if (fileChanged) {
      modifiedContent = modifiedContent.replace(/\n\s*\n\s*\n/g, '\n\n');
      fs.writeFileSync(filePath, modifiedContent);
      console.log(`✅ Updated: ${filePath}`);
    }
    
    stats.filesProcessed++;
    return fileChanged;
    
  } catch (error) {
    console.error(`❌ Error processing ${filePath}: ${error.message}`);
    stats.errors++;
    return false;
  }
}

/**
 * Main execution
 */
function main() {
  console.log('🧹 Starting debug statement cleanup...\n');
  
  const startTime = Date.now();
  let totalFilesChanged = 0;
  
  // Process each include directory
  for (const includeDir of CONFIG.includeDirs) {
    const fullPath = path.resolve(includeDir);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`⚠️  Directory ${fullPath} does not exist, skipping...`);
      continue;
    }
    
    console.log(`📁 Processing directory: ${fullPath}`);
    const files = getFilesToProcess(fullPath);
    console.log(`   Found ${files.length} files to process\n`);
    
    for (const file of files) {
      const changed = processFile(file);
      if (changed) totalFilesChanged++;
    }
  }
  
  // Print summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 CLEANUP COMPLETE');
  console.log('='.repeat(60));
  console.log(`⏱️  Duration: ${duration}s`);
  console.log(`📄 Files processed: ${stats.filesProcessed}`);
  console.log(`📝 Files modified: ${totalFilesChanged}`);
  console.log(`🔍 Debug patterns found: ${stats.patternsFound}`);
  console.log(`🗑️  Debug patterns removed: ${stats.patternsRemoved}`);
  console.log(`❌ Errors: ${stats.errors}`);
  console.log('='.repeat(60));
  
  if (stats.patternsRemoved > 0) {
    console.log('\n💡 Recommendations:');
    console.log('   • Review the changes before committing');
    console.log('   • Run your test suite to ensure nothing broke');
    console.log('   • Consider keeping error logging in catch blocks');
    console.log('   • Use a proper logging library for production');
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { processFile, getFilesToProcess };