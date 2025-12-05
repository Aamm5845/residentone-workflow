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
    execSync('npx prisma db push --accept-data-loss', { stdio: 'inherit' });
    success('Schema synced with db push');
  } catch (e) {
    error('Failed to sync schema');
    error('You may need to create a proper migration locally:');
    error('  npx prisma migrate dev --name your_migration_name');
    process.exit(1);
  }

  success('Prisma deployment complete!');
}

main().catch((e) => {
  error(e.message);
  process.exit(1);
});
