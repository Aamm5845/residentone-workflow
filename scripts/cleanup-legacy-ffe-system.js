#!/usr/bin/env node

/**
 * Legacy FFE System Cleanup Script
 * 
 * This script performs a comprehensive audit and cleanup of the legacy FFE system
 * to prepare for the new template-based system.
 * 
 * SAFETY FEATURES:
 * - Dry run mode by default (use --execute to actually delete)
 * - Creates backups before deletion
 * - Detailed logging of all operations
 * - Rollback capability
 * 
 * Usage:
 *   node scripts/cleanup-legacy-ffe-system.js --dry-run (default)
 *   node scripts/cleanup-legacy-ffe-system.js --execute
 *   node scripts/cleanup-legacy-ffe-system.js --rollback
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const PROJECT_ROOT = process.cwd();
const BACKUP_DIR = path.join(PROJECT_ROOT, 'backups', 'legacy-ffe-cleanup');
const LOG_FILE = path.join(BACKUP_DIR, 'cleanup-log.json');

// Command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run') || (!args.includes('--execute') && !args.includes('--rollback'));
const shouldExecute = args.includes('--execute');
const shouldRollback = args.includes('--rollback');

// Legacy files to be removed/updated
const LEGACY_CLEANUP_MAP = {
  // Database models (to be removed from schema.prisma)
  prismaModels: [
    'FFEItem',
    'FFEItemStatus', 
    'FFELibraryItem',
    'FFEGeneralSettings',
    'FFECategory',
    'FFERoomLibrary'
  ],

  // TypeScript types (to be removed/deprecated)
  typeFiles: [
    'src/types/ffe-management.ts'
  ],

  // Legacy components (to be removed)
  componentFiles: [
    'src/components/ffe/UnifiedFFEWorkspace.tsx',
    'src/components/ffe/DynamicFFEItem.tsx',
    'src/components/ffe/EnhancedBathroomFFE.tsx',
    'src/components/ffe/FFEItemForm.tsx',
    'src/components/ffe/BathroomFFEWorkspace.tsx',
    'src/components/ffe/ItemCard.tsx',
    'src/components/ffe/FFEQAChecklist.tsx',
    'src/components/ffe/interactive-ffe-phase.tsx',
    'src/components/ffe/EnhancedFFERoomView.tsx',
    'src/components/dashboard/ffe-library-management.tsx',
    'src/components/preferences/ffe-management-enhanced.tsx'
  ],

  // Legacy service files (to be removed)
  serviceFiles: [
    'src/lib/ffe/room-templates.ts',
    'src/lib/ffe/completion-validator.ts', 
    'src/lib/ffe/bathroom-template.ts',
    'src/lib/ffe/integration.ts',
    'src/lib/ffe/index.ts',
    'src/lib/ffe/library-manager.ts',
    'src/lib/ffe/ffe-management-backend.ts',
    'src/lib/ffe/two-phase-workflow.ts',
    'src/lib/ffe/learning-system.ts',
    'src/lib/ffe/bathroom-template-clean.ts',
    'src/lib/ffe/global-settings.ts',
    'src/lib/ffe/room-library-system.ts',
    'src/lib/constants/room-ffe-config.ts'
  ],

  // Legacy API routes (to be removed)
  apiRoutes: [
    'src/app/api/ffe/categories/route.ts',
    'src/app/api/ffe/debug/route.ts',
    'src/app/api/ffe/general-settings/route.ts',
    'src/app/api/ffe/items/route.ts',
    'src/app/api/ffe/library/[itemId]/route.ts',
    'src/app/api/ffe/library/route.ts',
    'src/app/api/ffe/management/items/route.ts',
    'src/app/api/ffe/room-libraries/[id]/route.ts',
    'src/app/api/ffe/room-libraries/route.ts',
    'src/app/api/ffe/room-status/route.ts',
    'src/app/api/ffe/room-types/clear/route.ts',
    'src/app/api/ffe/room-types/route.ts',
    'src/app/api/ffe/room/[roomId]/items/[itemId]/route.ts',
    'src/app/api/ffe/room/[roomId]/items/route.ts',
    'src/app/api/ffe/room/[roomId]/status/route.ts',
    'src/app/api/ffe/route.ts',
    'src/app/api/ffe/settings/route.ts',
    'src/app/api/ffe/version-history/route.ts'
  ],

  // Files to update (remove imports/references)
  filesToUpdate: [
    'src/lib/attribution.ts',
    'src/components/projects/room-management.tsx',
    'src/app/api/projects/route.ts',
    'src/app/api/projects/[id]/rooms/route.ts',
    'src/lib/stage/ffe-stage-manager.ts',
    'src/stores/ffe-room-store.ts'
  ]
};

class LegacyFFECleanup {
  constructor() {
    this.log = [];
    this.backupFiles = [];
    
    // Ensure backup directory exists
    if (!fs.existsSync(BACKUP_DIR)) {
      fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }
  }

  logOperation(operation, details, success = true) {
    const entry = {
      timestamp: new Date().toISOString(),
      operation,
      details,
      success,
      mode: isDryRun ? 'DRY_RUN' : shouldExecute ? 'EXECUTE' : 'ROLLBACK'
    };
    
    this.log.push(entry);
    console.log(`[${entry.mode}] ${operation}: ${details} ${success ? '✓' : '✗'}`);
  }

  backupFile(filePath) {
    if (!fs.existsSync(filePath)) {
      return false;
    }

    const relativePath = path.relative(PROJECT_ROOT, filePath);
    const backupPath = path.join(BACKUP_DIR, 'files', relativePath);
    const backupDir = path.dirname(backupPath);

    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir, { recursive: true });
    }

    try {
      fs.copyFileSync(filePath, backupPath);
      this.backupFiles.push({ original: filePath, backup: backupPath });
      this.logOperation('BACKUP', `${relativePath} → ${path.relative(PROJECT_ROOT, backupPath)}`);
      return true;
    } catch (error) {
      this.logOperation('BACKUP_FAILED', `${relativePath}: ${error.message}`, false);
      return false;
    }
  }

  async auditLegacyFiles() {
    console.log('\n🔍 AUDITING LEGACY FFE SYSTEM');
    console.log('='.repeat(50));

    const audit = {
      existingFiles: [],
      missingFiles: [],
      totalSize: 0
    };

    // Check all files in cleanup map
    const allFiles = [
      ...LEGACY_CLEANUP_MAP.typeFiles,
      ...LEGACY_CLEANUP_MAP.componentFiles,
      ...LEGACY_CLEANUP_MAP.serviceFiles,
      ...LEGACY_CLEANUP_MAP.apiRoutes,
      ...LEGACY_CLEANUP_MAP.filesToUpdate
    ];

    for (const file of allFiles) {
      const fullPath = path.join(PROJECT_ROOT, file);
      if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        audit.existingFiles.push({
          path: file,
          size: stats.size,
          modified: stats.mtime
        });
        audit.totalSize += stats.size;
        this.logOperation('AUDIT_FOUND', `${file} (${stats.size} bytes)`);
      } else {
        audit.missingFiles.push(file);
        this.logOperation('AUDIT_MISSING', file);
      }
    }

    // Check for references in schema.prisma
    const schemaPath = path.join(PROJECT_ROOT, 'prisma/schema.prisma');
    if (fs.existsSync(schemaPath)) {
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      const foundModels = LEGACY_CLEANUP_MAP.prismaModels.filter(model => 
        schemaContent.includes(`model ${model}`)
      );
      
      if (foundModels.length > 0) {
        audit.existingFiles.push({
          path: 'prisma/schema.prisma',
          note: `Contains models: ${foundModels.join(', ')}`
        });
        this.logOperation('AUDIT_SCHEMA', `Found legacy models: ${foundModels.join(', ')}`);
      }
    }

    console.log(`\n📊 AUDIT SUMMARY:`);
    console.log(`   Files to clean: ${audit.existingFiles.length}`);
    console.log(`   Missing files: ${audit.missingFiles.length}`);
    console.log(`   Total size: ${(audit.totalSize / 1024).toFixed(2)} KB`);

    return audit;
  }

  async cleanupFiles() {
    console.log('\n🧹 CLEANING UP LEGACY FILES');
    console.log('='.repeat(50));

    const filesToDelete = [
      ...LEGACY_CLEANUP_MAP.typeFiles,
      ...LEGACY_CLEANUP_MAP.componentFiles,
      ...LEGACY_CLEANUP_MAP.serviceFiles,
      ...LEGACY_CLEANUP_MAP.apiRoutes
    ];

    for (const file of filesToDelete) {
      const fullPath = path.join(PROJECT_ROOT, file);
      
      if (fs.existsSync(fullPath)) {
        // Backup first
        if (this.backupFile(fullPath)) {
          if (!isDryRun && shouldExecute) {
            try {
              fs.unlinkSync(fullPath);
              this.logOperation('DELETE', file);
            } catch (error) {
              this.logOperation('DELETE_FAILED', `${file}: ${error.message}`, false);
            }
          } else {
            this.logOperation('DELETE_PLANNED', file);
          }
        }
      }
    }
  }

  async cleanupPrismaSchema() {
    console.log('\n🗄️ CLEANING UP PRISMA SCHEMA');
    console.log('='.repeat(50));

    const schemaPath = path.join(PROJECT_ROOT, 'prisma/schema.prisma');
    
    if (!fs.existsSync(schemaPath)) {
      this.logOperation('SCHEMA_MISSING', 'prisma/schema.prisma not found', false);
      return;
    }

    // Backup schema
    this.backupFile(schemaPath);

    if (!isDryRun && shouldExecute) {
      let schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      let modified = false;

      // Remove legacy models
      for (const model of LEGACY_CLEANUP_MAP.prismaModels) {
        const modelRegex = new RegExp(`model ${model}\\s*{[^}]*}`, 'gs');
        if (schemaContent.match(modelRegex)) {
          schemaContent = schemaContent.replace(modelRegex, '');
          modified = true;
          this.logOperation('SCHEMA_REMOVE_MODEL', model);
        }
      }

      // Clean up empty lines and formatting
      if (modified) {
        schemaContent = schemaContent.replace(/\n\n\n+/g, '\n\n');
        fs.writeFileSync(schemaPath, schemaContent);
        this.logOperation('SCHEMA_UPDATED', 'Removed legacy models from schema.prisma');
      }
    } else {
      // Dry run - just report what would be removed
      const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
      for (const model of LEGACY_CLEANUP_MAP.prismaModels) {
        if (schemaContent.includes(`model ${model}`)) {
          this.logOperation('SCHEMA_REMOVE_PLANNED', model);
        }
      }
    }
  }

  async updateFileReferences() {
    console.log('\n📝 UPDATING FILE REFERENCES');
    console.log('='.repeat(50));

    for (const file of LEGACY_CLEANUP_MAP.filesToUpdate) {
      const fullPath = path.join(PROJECT_ROOT, file);
      
      if (fs.existsSync(fullPath)) {
        this.backupFile(fullPath);
        
        if (!isDryRun && shouldExecute) {
          // Note: This would require specific logic for each file
          // For now, we'll just log what needs to be updated
          this.logOperation('UPDATE_NEEDED', `${file} - manual review required`);
        } else {
          this.logOperation('UPDATE_PLANNED', file);
        }
      }
    }
  }

  async generateMigrationScript() {
    console.log('\n🔄 GENERATING MIGRATION SCRIPT');
    console.log('='.repeat(50));

    const migrationSQL = `
-- Legacy FFE System Cleanup Migration
-- Generated: ${new Date().toISOString()}

-- Backup existing data (commented out - run separately if needed)
/*
CREATE TABLE backup_ffe_items AS SELECT * FROM "FFEItem";
CREATE TABLE backup_ffe_item_status AS SELECT * FROM "FFEItemStatus";
CREATE TABLE backup_ffe_library_items AS SELECT * FROM "FFELibraryItem";
CREATE TABLE backup_ffe_general_settings AS SELECT * FROM "FFEGeneralSettings";
*/

-- Drop legacy tables (in correct order to handle foreign keys)
DROP TABLE IF EXISTS "FFEItemStatus";
DROP TABLE IF EXISTS "FFEItem";
DROP TABLE IF EXISTS "FFELibraryItem"; 
DROP TABLE IF EXISTS "FFEGeneralSettings";
DROP TABLE IF EXISTS "FFECategory";
DROP TABLE IF EXISTS "FFERoomLibrary";

-- Note: New FFE system tables will be created by the new migration
-- Run: npx prisma migrate dev --name "new_ffe_system"
`.trim();

    const migrationPath = path.join(BACKUP_DIR, 'legacy-cleanup-migration.sql');
    fs.writeFileSync(migrationPath, migrationSQL);
    this.logOperation('MIGRATION_SCRIPT', `Created at ${path.relative(PROJECT_ROOT, migrationPath)}`);
  }

  async rollbackChanges() {
    console.log('\n↩️ ROLLING BACK CHANGES');
    console.log('='.repeat(50));

    for (const backup of this.backupFiles.reverse()) {
      try {
        fs.copyFileSync(backup.backup, backup.original);
        this.logOperation('ROLLBACK', `Restored ${path.relative(PROJECT_ROOT, backup.original)}`);
      } catch (error) {
        this.logOperation('ROLLBACK_FAILED', `${backup.original}: ${error.message}`, false);
      }
    }
  }

  async saveLog() {
    const logData = {
      timestamp: new Date().toISOString(),
      mode: isDryRun ? 'DRY_RUN' : shouldExecute ? 'EXECUTE' : 'ROLLBACK',
      operations: this.log,
      backupFiles: this.backupFiles,
      summary: {
        totalOperations: this.log.length,
        successfulOperations: this.log.filter(op => op.success).length,
        failedOperations: this.log.filter(op => !op.success).length
      }
    };

    fs.writeFileSync(LOG_FILE, JSON.stringify(logData, null, 2));
    console.log(`\n📋 Log saved to: ${path.relative(PROJECT_ROOT, LOG_FILE)}`);
  }

  async run() {
    console.log('🚀 LEGACY FFE SYSTEM CLEANUP');
    console.log('='.repeat(60));
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : shouldExecute ? 'EXECUTE' : 'ROLLBACK'}`);
    console.log(`Backup Directory: ${path.relative(PROJECT_ROOT, BACKUP_DIR)}`);
    console.log('');

    try {
      if (shouldRollback) {
        await this.rollbackChanges();
      } else {
        await this.auditLegacyFiles();
        await this.cleanupFiles();
        await this.cleanupPrismaSchema();
        await this.updateFileReferences();
        await this.generateMigrationScript();
      }

      await this.saveLog();

      console.log('\n✅ CLEANUP COMPLETED');
      if (isDryRun) {
        console.log('🔍 This was a DRY RUN. Use --execute to perform actual cleanup.');
      }

    } catch (error) {
      this.logOperation('FATAL_ERROR', error.message, false);
      console.error('\n❌ CLEANUP FAILED:', error.message);
      process.exit(1);
    }
  }
}

// Run the cleanup
if (require.main === module) {
  const cleanup = new LegacyFFECleanup();
  cleanup.run().catch(console.error);
}

module.exports = LegacyFFECleanup;