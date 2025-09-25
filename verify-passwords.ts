import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function verifyPasswords() {
  console.log('🔍 Verifying password updates...')
  
  try {
    // Get all users with active emails (not deleted ones)
    const users = await prisma.user.findMany({
      where: {
        email: {
          not: {
            startsWith: 'deleted_'
          }
        }
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true,
        approvalStatus: true
      }
    })
    
    console.log(`\n📋 Testing password for ${users.length} active users:`)
    
    const testPassword = 'password123'
    let successCount = 0
    let failCount = 0
    
    for (const user of users) {
      try {
        if (!user.password) {
          console.log(`❌ ${user.email} - No password set`)
          failCount++
          continue
        }
        
        const isPasswordValid = await bcrypt.compare(testPassword, user.password)
        
        if (isPasswordValid) {
          console.log(`✅ ${user.email} (${user.name}) - Password verified [${user.role}] [${user.approvalStatus}]`)
          successCount++
        } else {
          console.log(`❌ ${user.email} - Password verification failed`)
          failCount++
        }
      } catch (error) {
        console.log(`❌ ${user.email} - Error verifying password:`, error)
        failCount++
      }
    }
    
    console.log(`\n📊 Verification Results:`)
    console.log(`✅ Success: ${successCount} users`)
    console.log(`❌ Failed: ${failCount} users`)
    
    if (successCount > 0) {
      console.log(`\n🔑 You can now log in with any of these accounts using password: ${testPassword}`)
      console.log(`\n📝 Active user accounts:`)
      users.forEach((user, index) => {
        if (user.approvalStatus === 'APPROVED') {
          console.log(`${index + 1}. Email: ${user.email}`)
          console.log(`   Name: ${user.name}`)
          console.log(`   Role: ${user.role}`)
          console.log(`   Password: ${testPassword}`)
          console.log('')
        }
      })
    }

  } catch (error) {
    console.error('❌ Error verifying passwords:', error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the verification
verifyPasswords()
  .then(() => {
    console.log('✅ Password verification completed!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('❌ Password verification failed:', error)
    process.exit(1)
  })