import { prisma } from '../src/lib/prisma'
import bcrypt from 'bcryptjs'

async function createAdmin() {
  try {
    // Create organization first
    const org = await prisma.organization.upsert({
      where: { slug: 'your-design-studio' },
      update: {},
      create: {
        name: 'Your Design Studio',
        slug: 'your-design-studio'
      }
    })

    // Hash password
    const hashedPassword = await bcrypt.hash('admin123', 12)

    // Create admin user
    const admin = await prisma.user.upsert({
      where: { email: 'admin@example.com' },
      update: {},
      create: {
        email: 'admin@example.com',
        name: 'Admin User',
        password: hashedPassword,
        role: 'OWNER',
        orgId: org.id
      }
    })

    console.log('✅ Admin user created successfully!')
    console.log('📧 Email: admin@example.com')
    console.log('🔑 Password: admin123')
    console.log('')
    console.log('🚀 You can now login to your application!')
    
  } catch (error) {
    console.error('❌ Error creating admin user:', error)
  } finally {
    await prisma.$disconnect()
  }
}

createAdmin()
