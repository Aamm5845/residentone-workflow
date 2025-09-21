const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function setupAdminPassword() {
  try {
    const adminUser = await prisma.user.findFirst({
      where: { email: 'admin@example.com' }
    })
    
    if (!adminUser) {
      console.log('❌ Admin user not found')
      return
    }
    
    if (!adminUser.password) {
      console.log('🔧 Setting up password for admin@example.com...')
      const hashedPassword = await bcrypt.hash('admin123', 12)
      
      await prisma.user.update({
        where: { email: 'admin@example.com' },
        data: { password: hashedPassword }
      })
      
      console.log('✅ Password set!')
    } else {
      // Test if the current password is 'admin123'
      const isPasswordValid = await bcrypt.compare('admin123', adminUser.password)
      if (!isPasswordValid) {
        console.log('🔧 Resetting password to admin123...')
        const hashedPassword = await bcrypt.hash('admin123', 12)
        
        await prisma.user.update({
          where: { email: 'admin@example.com' },
          data: { password: hashedPassword }
        })
        
        console.log('✅ Password reset!')
      } else {
        console.log('✅ Password already set correctly!')
      }
    }
    
    console.log('\n🎯 Login Credentials:')
    console.log('   Email: admin@example.com')
    console.log('   Password: admin123')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  } finally {
    await prisma.$disconnect()
  }
}

setupAdminPassword()