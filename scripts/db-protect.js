#!/usr/bin/env node

/**
 * DATABASE PROTECTION SYSTEM
 * 
 * This script intercepts dangerous Prisma commands and prevents accidental data loss.
 * It blocks commands like 'prisma migrate reset' and 'prisma db push --force-reset'
 * while allowing safe schema changes through 'prisma db push' and 'prisma migrate dev'
 */

const { execSync } = require('child_process');
const readline = require('readline');

const DANGEROUS_COMMANDS = [
  'prisma migrate reset',
  'prisma db push --force-reset',
  'prisma db push --accept-data-loss',
  'prisma migrate reset --force',
  'prisma migrate deploy --force'
];

const args = process.argv.slice(2).join(' ');

// Check if command is dangerous
const isDangerous = DANGEROUS_COMMANDS.some(cmd => args.includes(cmd));

if (isDangerous) {
  console.error('\n❌ BLOCKED: This command can DELETE ALL DATABASE DATA!\n');
  console.error('🛡️  Database Protection System has prevented this operation.\n');
  console.error('Blocked command:', args);
  console.error('\n📝 To make schema changes safely, use:');
  console.error('   npx prisma db push           (adds columns/tables without data loss)');
  console.error('   npx prisma migrate dev       (creates migration files)\n');
  console.error('⚠️  If you REALLY need to reset (THIS WILL DELETE ALL DATA):');
  console.error('   1. Create a backup first');
  console.error('   2. Set DB_PROTECTION=disabled in .env');
  console.error('   3. Run your command');
  console.error('   4. Remove DB_PROTECTION from .env\n');
  process.exit(1);
}

// Check if DB_PROTECTION is explicitly disabled
if (process.env.DB_PROTECTION === 'disabled') {
  console.warn('\n⚠️  WARNING: Database protection is DISABLED');
  console.warn('⚠️  This command can potentially delete data!\n');
  
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('Type "I UNDERSTAND THE RISK" to proceed: ', (answer) => {
    rl.close();
    if (answer === 'I UNDERSTAND THE RISK') {
      console.log('\n✅ Proceeding with command...\n');
      try {
        execSync(`npx ${args}`, { stdio: 'inherit' });
      } catch (error) {
        process.exit(error.status || 1);
      }
    } else {
      console.error('\n❌ Command cancelled for safety.\n');
      process.exit(1);
    }
  });
} else {
  // Safe command - execute it
  console.log('✅ Safe command detected. Executing...\n');
  try {
    execSync(`npx ${args}`, { stdio: 'inherit' });
  } catch (error) {
    process.exit(error.status || 1);
  }
}
