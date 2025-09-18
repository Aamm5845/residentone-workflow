#!/usr/bin/env ts-node

// One-time script to clean up demo data from the database
// Run this in staging and production, then remove this file

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function cleanupDemoData() {
  console.log('🧹 Starting demo data cleanup...')
  
  try {
    // Delete projects with known demo names
    const deleteResult = await prisma.project.deleteMany({
      where: {
        name: {
          in: [
            'Johnson Residence',
            'Smith Residence',
            'Demo Project',
            'Test Project',
            'Sample Project'
          ]
        }
      }
    })
    
    console.log(`✅ Deleted ${deleteResult.count} demo projects`)
    
    // Also clean up any clients that might be demo clients
    const clientDeleteResult = await prisma.client.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Johnson' } },
          { name: { contains: 'Smith' } },
          { email: { contains: 'example.com' } },
          { email: { contains: 'demo' } },
          { email: { contains: 'test' } }
        ]
      }
    })
    
    console.log(`✅ Deleted ${clientDeleteResult.count} demo clients`)
    
    // Clean up any organizations with demo names
    const orgDeleteResult = await prisma.organization.deleteMany({
      where: {
        OR: [
          { name: { contains: 'Demo' } },
          { name: { contains: 'Test' } },
          { name: { contains: 'Sample' } },
          { slug: { contains: 'demo' } },
          { slug: { contains: 'test' } }
        ]
      }
    })
    
    console.log(`✅ Deleted ${orgDeleteResult.count} demo organizations`)
    
    console.log('🎉 Demo data cleanup completed successfully!')
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

// Run the cleanup
cleanupDemoData()