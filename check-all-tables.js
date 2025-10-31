const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function checkAllTables() {
  try {
    // Read backup file
    const backupPath = 'C:\\Users\\ADMIN\\Desktop\\residentone-workflow\\backups\\residentone-complete-backup-2025-10-30T17-24-37-688Z.json';
    const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));

    console.log('\n📊 Comparing current database with backup:\n');

    const checks = [];

    // Get all table names from backup
    const tables = Object.keys(backup).sort();

    for (const table of tables) {
      const backupCount = backup[table]?.length || 0;
      
      // Skip empty tables in backup
      if (backupCount === 0) continue;

      try {
        const currentCount = await prisma[table].count();
        const match = currentCount === backupCount;
        
        checks.push({
          table,
          backupCount,
          currentCount,
          match
        });

        const icon = match ? '✅' : '❌';
        console.log(`${icon} ${table}: ${currentCount}/${backupCount}`);
      } catch (error) {
        console.log(`⚠️  ${table}: Unable to count (${error.message})`);
      }
    }

    console.log('\n' + '='.repeat(50));
    
    const mismatches = checks.filter(c => !c.match);
    if (mismatches.length === 0) {
      console.log('\n🎉 ALL TABLES FULLY RESTORED!\n');
    } else {
      console.log('\n❌ TABLES WITH MISMATCHES:\n');
      mismatches.forEach(m => {
        console.log(`  - ${m.table}: ${m.currentCount}/${m.backupCount} (missing ${m.backupCount - m.currentCount})`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkAllTables();
