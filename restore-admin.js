const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createAdminUser() {
  try {
    console.log('🔧 Creating admin user and organization...')
    
    // Create organization first
    const organization = await prisma.organization.create({
      data: {
        name: "Interior Design Studio",
        slug: "interior-design-studio",
      }
    })
    
    console.log(`✅ Created organization: ${organization.name} (ID: ${organization.id})`)

    // Prompt for admin details
    const readline = require('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    const askQuestion = (question) => {
      return new Promise((resolve) => {
        rl.question(question, resolve)
      })
    }

    const email = await askQuestion('Enter your admin email: ')
    const name = await askQuestion('Enter your name: ')
    const password = await askQuestion('Enter your password: ')

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 12)

    // Create admin user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name.trim(),
        password: hashedPassword,
        role: 'OWNER',
        orgId: organization.id,
        emailVerified: new Date(),
        mustChangePassword: false
      }
    })

    console.log(`✅ Created admin user: ${user.email} (ID: ${user.id})`)
    console.log(`🔐 Password set successfully`)
    console.log(`\n🎉 You can now sign in with:`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Password: [the password you entered]`)

    rl.close()

  } catch (error) {
    console.error('❌ Error creating admin user:', error.message)
    
    if (error.code === 'P2002') {
      console.log('👤 User with this email already exists. Trying to find existing users...')
      
      const existingUsers = await prisma.user.findMany({
        select: {
          email: true,
          name: true,
          role: true,
          createdAt: true
        }
      })
      
      if (existingUsers.length > 0) {
        console.log('\n📋 Existing users found:')
        existingUsers.forEach((user, index) => {
          console.log(`${index + 1}. ${user.email} (${user.name}) - ${user.role}`)
        })
      }
    }
  } finally {
    await prisma.$disconnect()
  }
}

createAdminUser()