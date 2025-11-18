import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('🔍 Checking if lastActivityViewedAt column exists...')
  
  try {
    const result = await prisma.$queryRaw`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'User' 
      AND column_name = 'lastActivityViewedAt'
    `
    
    console.log('Query result:', result)
    
    if (Array.isArray(result) && result.length > 0) {
      console.log('✅ Column exists!')
    } else {
      console.log('❌ Column does NOT exist - adding it now...')
      
      await prisma.$executeRawUnsafe(`
        ALTER TABLE "User" 
        ADD COLUMN "lastActivityViewedAt" TIMESTAMP(3)
      `)
      
      console.log('✅ Column added successfully')
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  } finally {
    await prisma.$disconnect()
  }
}

main()
