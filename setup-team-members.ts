import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { autoAssignUserToPhases } from './src/lib/utils/auto-assignment'

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
})

async function setupTeamMembers() {
  console.log('🚀 Setting up team members...')
  
  try {
    // Test database connection first
    console.log('🔍 Testing database connection...')
    await prisma.$connect()
    console.log('✅ Database connected successfully')
    
    // First, ensure we have an organization
    let organization = await prisma.organization.findFirst()
    if (!organization) {
      organization = await prisma.organization.create({
        data: {
          name: 'Meisner Interiors',
          slug: 'meisner-interiors'
        }
      })
      console.log('✅ Created organization: Meisner Interiors')
    }

    // Hash the temporary password
    const temporaryPassword = 'Meisner6700'
    const hashedPassword = await bcrypt.hash(temporaryPassword, 12)

    // Define the team members
    const teamMembers = [
      {
        name: 'Aaron Meisner',
        email: 'aaron@meisnerinteriors.com',
        role: 'OWNER' as const,
        phases: ['DESIGN_CONCEPT'] // He will be auto-assigned to design concept phase
      },
      {
        name: 'Shaya Gross', 
        email: 'shata@meisnerinteriors.com',
        role: 'FFE' as const,
        phases: ['CLIENT_APPROVAL', 'FFE'] // Auto-assigned to client approval and FFE phases
      },
      {
        name: 'Sami Youssef',
        email: 'sami@meisnerinteriors.com', 
        role: 'DRAFTER' as const,
        phases: ['DRAWINGS'] // Auto-assigned to drawing phase
      },
      {
        name: 'Manoel Vitor',
        email: 'euvi.3d@gmail.com',
        role: 'RENDERER' as const,
        phases: ['THREE_D'] // Auto-assigned to 3D rendering phase  
      }
    ]

    // Clear existing users (but keep any data they may have created)
    console.log('🧹 Clearing existing team members...')
    await prisma.user.updateMany({
      data: {
        orgId: null, // Remove them from organization but keep their data
      }
    })

    // Create the new team members
    for (const member of teamMembers) {
      console.log(`👤 Creating ${member.name} (${member.role})...`)
      
      // Check if user already exists by email
      let user = await prisma.user.findUnique({
        where: { email: member.email }
      })

      if (user) {
        // Update existing user
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            name: member.name,
            role: member.role,
            orgId: organization.id,
            password: hashedPassword,
            mustChangePassword: true, // Force password change on first login
            updatedAt: new Date()
          }
        })
        console.log(`✅ Updated existing user: ${member.name}`)
      } else {
        // Create new user
        user = await prisma.user.create({
          data: {
            name: member.name,
            email: member.email,
            role: member.role,
            orgId: organization.id,
            password: hashedPassword,
            mustChangePassword: true, // Force password change on first login
          }
        })
        console.log(`✅ Created new user: ${member.name}`)
      }

      // Auto-assign to phases based on role
      try {
        const assignmentResult = await autoAssignUserToPhases(user.id, member.role, organization.id)
        console.log(`   📋 Auto-assigned ${assignmentResult.assignedCount} phases: ${assignmentResult.phases.join(', ')}`)
      } catch (assignmentError) {
        console.warn(`   ⚠️  Auto-assignment failed for ${member.name}:`, assignmentError)
      }
    }

    console.log('\n🎉 Team setup complete!')
    console.log('\n👥 Team Members:')
    console.log('• Aaron Meisner (OWNER) - Design Concept phase')
    console.log('• Shaya Gross (FFE) - Client Approval & FFE phases') 
    console.log('• Sami Youssef (DRAFTER) - Drawing phase')
    console.log('• Manoel Vitor (RENDERER) - 3D Rendering phase')
    console.log('\n🔑 All users have temporary password: Meisner6700')
    console.log('   They will be required to change it on first login.')

  } catch (error) {
    console.error('❌ Error setting up team members:', error)
    
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
    
    console.log('\n📚 See TEAM_SETUP_INSTRUCTIONS.md for alternative setup methods.')
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the setup
setupTeamMembers()
  .then(() => {
    console.log('\n✅ Setup completed successfully!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('\n❌ Setup failed:', error)
    process.exit(1)
  })