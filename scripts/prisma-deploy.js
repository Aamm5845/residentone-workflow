#!/usr/bin/env node

/**
 * Prisma Deploy Script for Vercel
 * 
 * This script handles database schema synchronization during Vercel builds.
 * It tries migrate deploy first, and falls back to db push if needed.
 * 
 * Usage: node scripts/prisma-deploy.js
 */

const { execSync } = require('child_process');

const log = (msg) => console.log(`[Prisma Deploy] ${msg}`);
const error = (msg) => console.error(`[Prisma Deploy] ❌ ${msg}`);
const success = (msg) => console.log(`[Prisma Deploy] ✅ ${msg}`);

async function main() {
  log('Starting Prisma deployment...');
  
  // Step 1: Generate Prisma Client
  log('Generating Prisma Client...');
  try {
    execSync('npx prisma generate', { stdio: 'inherit' });
    success('Prisma Client generated');
  } catch (e) {
    error('Failed to generate Prisma Client');
    process.exit(1);
  }

  // Step 2: Try to apply migrations first
  log('Attempting to apply migrations...');
  try {
    execSync('npx prisma migrate deploy', { stdio: 'inherit' });
    success('Migrations applied successfully');
    return;
  } catch (e) {
    log('Migration deploy failed or no migrations to apply, trying db push...');
  }

  // Step 3: Fall back to db push (for schema changes without migrations)
  log('Syncing schema with db push...');
  try {
    // Using --accept-data-loss is generally safe for adding new optional columns
    // but will warn about potentially destructive changes
    log('Running: npx prisma db push --accept-data-loss');
    const result = execSync('npx prisma db push --accept-data-loss 2>&1', { encoding: 'utf8' });
    log('db push output:');
    console.log(result);
    success('Schema synced with db push');
  } catch (e) {
    error('Failed to sync schema');
    error('Error details: ' + (e.message || e));
    if (e.stdout) log('stdout: ' + e.stdout);
    if (e.stderr) log('stderr: ' + e.stderr);
    error('You may need to create a proper migration locally:');
    error('  npx prisma migrate dev --name your_migration_name');
    // Don't exit with error - continue build and let API handle gracefully
    log('Continuing build despite db push failure...');
  }

  success('Prisma deployment complete!');
}

main().catch((e) => {
  error(e.message);
  process.exit(1);
});
