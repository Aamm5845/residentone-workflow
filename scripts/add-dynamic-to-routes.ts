import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';

const apiDir = join(process.cwd(), 'src', 'app', 'api');

function getAllRouteFiles(dir: string): string[] {
  const files: string[] = [];
  
  function traverse(currentDir: string) {
    const items = readdirSync(currentDir);
    
    for (const item of items) {
      const fullPath = join(currentDir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        traverse(fullPath);
      } else if (item === 'route.ts') {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function addDynamicExport(filePath: string): boolean {
  const content = readFileSync(filePath, 'utf-8');
  
  // Check if already has dynamic export
  if (content.includes('export const dynamic')) {
    return false;
  }
  
  // Check if it's an API route with session/prisma usage
  const hasSession = content.includes('getSession') || content.includes('getServerSession');
  const hasPrisma = content.includes('prisma.');
  
  if (!hasSession && !hasPrisma) {
    return false;
  }
  
  // Find the last import statement (handle multi-line imports)
  const lines = content.split('\n');
  let lastImportIndex = -1;
  let inImport = false;
  
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    
    // Start of an import
    if (trimmed.startsWith('import ') || trimmed.startsWith('import{')) {
      inImport = true;
      lastImportIndex = i;
    }
    
    // If we're in an import, check for the end
    if (inImport) {
      lastImportIndex = i;
      // Check if this line ends the import (has 'from' followed by string)
      if (trimmed.includes('from ') && (trimmed.includes("'") || trimmed.includes('"'))) {
        inImport = false;
      }
    }
  }
  
  if (lastImportIndex === -1) {
    console.warn(`  ⚠️ No imports found in ${filePath}`);
    return false;
  }
  
  // Insert after the last import
  lines.splice(lastImportIndex + 1, 0, '', "export const dynamic = 'force-dynamic'");
  
  const newContent = lines.join('\n');
  writeFileSync(filePath, newContent, 'utf-8');
  
  return true;
}

console.log('🔍 Finding all API route files...\n');
const routeFiles = getAllRouteFiles(apiDir);
console.log(`Found ${routeFiles.length} route files\n`);

let modified = 0;
let skipped = 0;

for (const file of routeFiles) {
  const relativePath = file.replace(process.cwd(), '').replace(/\\/g, '/');
  
  if (addDynamicExport(file)) {
    console.log(`✅ Added to ${relativePath}`);
    modified++;
  } else {
    skipped++;
  }
}

console.log(`\n✅ Modified: ${modified}`);
console.log(`⏭️  Skipped: ${skipped}`);
console.log(`📊 Total: ${routeFiles.length}`);
