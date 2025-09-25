import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})

async function updateAllPasswords() {
  console.log('🔄 Updating all user passwords to "password123"...')
  
  try {
    // Test database connection first
    console.log('🔍 Testing database connection...')
    await prisma.$connect()
    console.log('✅ Database connected successfully')
    
    // Get all existing users
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        password: true
      }
    })
    
    if (users.length === 0) {
      console.log('ℹ️  No users found in database.')
      return
    }
    
    console.log(`\n📋 Found ${users.length} users:`)
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} (${user.name || 'No name'}) - ${user.role}${user.password ? ' [has password]' : ' [no password]'}`)
    })
    
    // Hash the new password
    const newPassword = 'password123'
    const hashedPassword = await bcrypt.hash(newPassword, 12)
    console.log('\n🔐 Generated password hash...')
    
    // Update all users' passwords
    console.log('\n🔄 Updating passwords...')
    
    for (const user of users) {
      try {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            password: hashedPassword,
            mustChangePassword: false, // Don't force them to change it since this is for testing
            updatedAt: new Date()
          }
        })
        console.log(`✅ Updated password for: ${user.email}`)
      } catch (error) {
        console.error(`❌ Failed to update password for ${user.email}:`, error)
      }
    }
    
    console.log('\n🎉 Password update complete!')
    console.log(`🔑 All users now have password: ${newPassword}`)
    console.log('\n📝 Updated users:')
    users.forEach((user, index) => {
      console.log(`${index + 1}. ${user.email} - password: ${newPassword}`)
    })

  } catch (error) {
    console.error('❌ Error updating passwords:', error)
    
    if (error instanceof Error && error.message.includes('planLimitReached')) {
      console.log('\n🚨 PRISMA ACCELERATE LIMIT REACHED')
      console.log('Please check your Prisma account and upgrade your plan.')
      console.log('Alternatively, update your DATABASE_URL to use direct connection.')
    } else if (error instanceof Error && error.message.includes("Can't reach database")) {
      console.log('\n🚨 DATABASE CONNECTION FAILED')
      console.log('Please check:')
      console.log('1. Your database server is running')
      console.log('2. DATABASE_URL is correct in .env')
      console.log('3. Network connectivity to database')
    }
    
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the update
updateAllPasswords()
  .then(() => {
    console.log('\n✅ Password update completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Password update failed:', error)
    process.exit(1)
  })