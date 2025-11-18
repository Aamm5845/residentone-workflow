import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔄 Adding lastActivityViewedAt column to User table...')
  
  try {
    // Add the column using raw SQL
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "User" 
      ADD COLUMN IF NOT EXISTS "lastActivityViewedAt" TIMESTAMP(3);
    `)
    
    console.log('✅ Successfully added lastActivityViewedAt column')
    
    // Optionally add index for better performance
    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS "User_lastActivityViewedAt_idx" 
      ON "User"("lastActivityViewedAt");
    `)
    
    console.log('✅ Successfully created index on lastActivityViewedAt')
    
  } catch (error) {
    console.error('❌ Error adding column:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

main()
  .then(() => {
    console.log('🎉 Migration completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error)
    process.exit(1)
  })
