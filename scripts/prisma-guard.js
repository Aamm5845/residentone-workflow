/**
 * Prisma Reset Protection Guard
 * 
 * This script prevents accidental database resets by requiring explicit environment variable approval.
 * Place this as a gate before any destructive Prisma operations.
 */

const RESET_COMMANDS = [
  'migrate reset',
  'reset',
  'db push --force-reset',
  'migrate reset --force'
];

function isResetCommand() {
  const args = process.argv.slice(2).join(' ');
  return RESET_COMMANDS.some(cmd => args.includes(cmd));
}

function main() {
  // Check if this is a reset operation
  if (!isResetCommand()) {
    // Not a reset command, allow it to proceed
    return;
  }

  // This IS a reset command - check for permission
  const allowReset = process.env.ALLOW_PRISMA_RESET;
  const isProduction = process.env.NODE_ENV === 'production';

  console.log('\n⚠️  PRISMA RESET PROTECTION ACTIVATED ⚠️\n');

  // Block ALL resets in production
  if (isProduction) {
    console.error('❌ PRISMA RESET IS BLOCKED IN PRODUCTION');
    console.error('   Database resets are never allowed in production mode.');
    process.exit(1);
  }

  // Require explicit approval for development
  if (allowReset !== 'true') {
    console.error('❌ PRISMA RESET IS BLOCKED');
    console.error('   To allow database reset, run:');
    console.error('   $env:ALLOW_PRISMA_RESET="true"  (PowerShell)');
    console.error('   set ALLOW_PRISMA_RESET=true     (CMD)');
    console.error('   export ALLOW_PRISMA_RESET=true  (Bash)');
    console.error('\n   Then run your command again.\n');
    process.exit(1);
  }

  console.log('✅ Reset authorized by ALLOW_PRISMA_RESET environment variable');
  console.log('   Proceeding with reset...\n');
}

main();
