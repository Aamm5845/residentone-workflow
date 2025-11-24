/**
 * HTTP-based Team Setup Script
 * This script sets up team members through the application's API endpoints
 * Use this when direct database access is not available
 */

const fetch = require('node-fetch')

const BASE_URL = 'http://localhost:3000'
const TEMP_PASSWORD = 'Meisner6700'

const teamMembers = [
  {
    name: 'Aaron Meisner',
    email: 'aaron@meisnerinteriors.com',
    role: 'OWNER',
    phases: ['Design Concept']
  },
  {
    name: 'Shaya Gross', 
    email: 'shata@meisnerinteriors.com',
    role: 'FFE',
    phases: ['Client Approval', 'FFE']
  },
  {
    name: 'Sami Youssef',
    email: 'sami@meisnerinteriors.com', 
    role: 'DRAFTER',
    phases: ['Drawings']
  },
  {
    name: 'Manoel Vitor',
    email: 'euvi.3d@gmail.com',
    role: 'RENDERER',
    phases: ['3D Rendering']
  }
]

async function makeRequest(url, method = 'GET', body = null, headers = {}) {
  try {
    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      ...(body && { body: JSON.stringify(body) })
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`HTTP ${response.status}: ${errorText}`)
    }

    return await response.json()
  } catch (error) {
    console.error(`Request failed: ${method} ${url}`, error.message)
    throw error
  }
}

async function setupTeamMembers() {
  console.log('🚀 Setting up team members via HTTP API...')
  
  try {
    // Check if server is running
    console.log('🔍 Checking if server is running...')
    await makeRequest(`${BASE_URL}/api/auth/session`)
    console.log('✅ Server is accessible')

    const createdUsers = []

    // Create each team member
    for (const member of teamMembers) {
      console.log(`👤 Creating ${member.name} (${member.role})...`)
      
      try {
        const result = await makeRequest(`${BASE_URL}/api/team`, 'POST', {
          name: member.name,
          email: member.email,
          role: member.role
        })
        
        console.log(`✅ Created: ${member.name}`)
        createdUsers.push({ ...result.user, originalData: member })
        
      } catch (error) {
        if (error.message.includes('already exists')) {
          console.log(`⚠️  User ${member.email} already exists, skipping creation`)
        } else {
          console.error(`❌ Failed to create ${member.name}:`, error.message)
        }
      }
    }

    // Set passwords for created users
    console.log('\\n🔑 Setting temporary passwords...')
    for (const user of createdUsers) {
      try {
        await makeRequest(`${BASE_URL}/api/team/${user.id}/set-password`, 'POST', {
          password: TEMP_PASSWORD,
          forceChange: true
        })
        console.log(`🔒 Password set for ${user.name}`)
      } catch (error) {
        console.error(`❌ Failed to set password for ${user.name}:`, error.message)
      }
    }

    console.log('\\n🎉 Team setup complete!')
    console.log('\\n👥 Team Members:')
    teamMembers.forEach(member => {
      console.log(`• ${member.name} (${member.role}) - ${member.phases.join(', ')}`)
    })
    console.log('\\n🔑 Temporary password: Meisner6700')
    console.log('   (Users must change on first login)')

  } catch (error) {
    console.error('❌ Setup failed:', error.message)
    
    if (error.message.includes('ECONNREFUSED')) {
      console.log('\\n🚨 SERVER NOT RUNNING')
      console.log('Please start the development server first:')
      console.log('npm run dev')
    } else if (error.message.includes('Unauthorized')) {
      console.log('\\n🚨 AUTHENTICATION REQUIRED')
      console.log('You may need to be logged in as an admin to create team members.')
      console.log('Try accessing the team setup through the web interface at:')
      console.log(`${BASE_URL}/team`)
    }
    
    throw error
  }
}

async function verifySetup() {
  console.log('\\n🔍 Verifying team setup...')
  
  try {
    const response = await makeRequest(`${BASE_URL}/api/team`)
    const teamMembers = response.teamMembers || []
    
    console.log(`\\n👥 Found ${teamMembers.length} team members:`)
    teamMembers.forEach(member => {
      console.log(`• ${member.name || 'No name'} (${member.email}) - ${member.role}`)
      console.log(`  Active stages: ${member._count?.assignedStages || 0}`)
    })
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message)
  }
}

// Main execution
async function main() {
  try {
    await setupTeamMembers()
    await verifySetup()
    console.log('\\n✅ All done!')
  } catch (error) {
    console.error('\\n❌ Script failed:', error.message)
    process.exit(1)
  }
}

// Check if this script is being run directly
if (require.main === module) {
  main()
}

module.exports = { setupTeamMembers, verifySetup }