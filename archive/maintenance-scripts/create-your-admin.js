const { PrismaClient } = require('@prisma/client')
const bcrypt = require('bcryptjs')

const prisma = new PrismaClient()

async function createYourAdmin() {
  try {
    console.log('🔧 Setting up your admin account...')
    
    // Get existing organization or create new one
    let organization = await prisma.organization.findFirst()
    
    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name: "Interior Design Studio",
          slug: "interior-design-studio",
        }
      })
      console.log(`✅ Created organization: ${organization.name}`)
    } else {
      console.log(`✅ Using existing organization: ${organization.name}`)
    }

    // Replace these with your actual details:
    const YOUR_EMAIL = "your-email@example.com"  // ← CHANGE THIS
    const YOUR_NAME = "Your Name"               // ← CHANGE THIS  
    const YOUR_PASSWORD = "your-password"       // ← CHANGE THIS

    console.log(`\n⚠️  PLEASE EDIT THIS FILE FIRST!`)
    console.log(`   1. Open create-your-admin.js`)
    console.log(`   2. Change YOUR_EMAIL to your actual email`)
    console.log(`   3. Change YOUR_NAME to your actual name`)
    console.log(`   4. Change YOUR_PASSWORD to your actual password`)
    console.log(`   5. Save the file and run again`)
    
    if (YOUR_EMAIL === "your-email@example.com") {
      console.log(`\n❌ Please edit the file first with your actual credentials!`)
      return
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(YOUR_PASSWORD, 12)

    // Create admin user
    const user = await prisma.user.create({
      data: {
        email: YOUR_EMAIL.toLowerCase().trim(),
        name: YOUR_NAME.trim(),
        password: hashedPassword,
        role: 'OWNER',
        orgId: organization.id,
        emailVerified: new Date(),
        mustChangePassword: false
      }
    })

    console.log(`✅ Created your admin account: ${user.email}`)
    console.log(`🎉 You can now sign in!`)

  } catch (error) {
    console.error('❌ Error:', error.message)
    
    if (error.code === 'P2002') {
      console.log('👤 User with this email already exists!')
      
      // Show existing users
      const users = await prisma.user.findMany({
        select: { email: true, name: true, role: true }
      })
      
      console.log('\n📋 Existing users:')
      users.forEach((user, index) => {
        console.log(`${index + 1}. ${user.email} (${user.name || 'No name'}) - ${user.role}`)
      })
    }
  } finally {
    await prisma.$disconnect()
  }
}

createYourAdmin()