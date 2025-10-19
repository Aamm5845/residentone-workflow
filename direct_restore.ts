import { PrismaClient } from '@prisma/client'
import fs from 'fs'

const prisma = new PrismaClient()

async function directRestore() {
  try {
    console.log('🔄 Starting direct database restore...')
    
    // Read the backup file
    const backupPath = 'backups/full-backup-2025-09-26T00-28-06-573Z.json'
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'))
    
    console.log(`📅 Backup from: ${backupData.timestamp || 'Unknown date'}`)
    console.log('📊 Backup contains:')
    if (backupData.data.projects) console.log(`   - ${backupData.data.projects.length} projects`)
    if (backupData.data.clients) console.log(`   - ${backupData.data.clients.length} clients`)
    if (backupData.data.stages) console.log(`   - ${backupData.data.stages.length} stages`)
    if (backupData.data.rooms) console.log(`   - ${backupData.data.rooms.length} rooms`)
    
    const { data } = backupData
    
    console.log('🧹 Clearing existing data...')
    
    // Clear all data including users and organizations for complete restore
    await prisma.asset.deleteMany({})
    await prisma.designSection.deleteMany({})
    await prisma.stage.deleteMany({})
    await prisma.room.deleteMany({})
    await prisma.project.deleteMany({})
    await prisma.client.deleteMany({})
    await prisma.user.deleteMany({})
    await prisma.organization.deleteMany({})
    
    console.log('📥 Restoring data...')
    
    // Restore organizations first
    if (data.organizations?.length > 0) {
      await prisma.organization.createMany({ data: data.organizations })
      console.log(`✅ Restored ${data.organizations.length} organizations`)
    }
    
    // Restore users
    if (data.users?.length > 0) {
      // Filter out nested relations that Prisma doesn't handle in createMany
      const usersData = data.users.map(user => {
        const { accounts, sessions, userSessions, ...userData } = user
        return userData
      })
      await prisma.user.createMany({ data: usersData })
      console.log(`✅ Restored ${usersData.length} users`)
    }
    
    // Restore clients
    if (data.clients?.length > 0) {
      await prisma.client.createMany({ data: data.clients })
      console.log(`✅ Restored ${data.clients.length} clients`)
    }
    
    // Restore projects
    if (data.projects?.length > 0) {
      await prisma.project.createMany({ data: data.projects })
      console.log(`✅ Restored ${data.projects.length} projects`)
    }
    
    // Restore rooms
    if (data.rooms?.length > 0) {
      await prisma.room.createMany({ data: data.rooms })
      console.log(`✅ Restored ${data.rooms.length} rooms`)
    }
    
    // Restore stages
    if (data.stages?.length > 0) {
      await prisma.stage.createMany({ data: data.stages })
      console.log(`✅ Restored ${data.stages.length} stages`)
    }
    
    // Restore design sections if they exist
    if (data.designSections?.length > 0) {
      await prisma.designSection.createMany({ data: data.designSections })
      console.log(`✅ Restored ${data.designSections.length} design sections`)
    }
    
    // Restore assets if they exist
    if (data.assets?.length > 0) {
      // Find a valid user ID and org ID for assets missing required fields
      const fallbackUserId = data.users?.find(user => user.role === 'OWNER')?.id || 
                             data.users?.[0]?.id
      const fallbackOrgId = data.organizations?.[0]?.id || 
                            data.users?.[0]?.orgId
      
      if (!fallbackUserId || !fallbackOrgId) {
        console.error('❌ No valid user ID or org ID found for assets. Skipping asset restore.')
      } else {
        // Map backup asset fields to Prisma schema fields
        const assetsWithCorrectFields = data.assets.map(asset => {
          // Determine asset type from filename or mimeType
          let assetType = asset.type || 'OTHER'
          if (!asset.type) {
            if (asset.mimeType) {
              if (asset.mimeType.startsWith('image/')) {
                assetType = 'IMAGE'
              } else if (asset.mimeType === 'application/pdf') {
                assetType = 'PDF'
              } else if (asset.mimeType.startsWith('video/')) {
                assetType = 'OTHER'
              } else {
                assetType = 'DOCUMENT'
              }
            } else if (asset.filename) {
              const ext = asset.filename.split('.').pop()?.toLowerCase()
              if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
                assetType = 'IMAGE'
              } else if (ext === 'pdf') {
                assetType = 'PDF'
              } else {
                assetType = 'DOCUMENT'
              }
            }
          }
          
          return {
            ...asset,
            title: asset.title || asset.filename || 'Untitled Asset',
            filename: asset.filename || null,
            type: assetType,
            uploadedBy: asset.uploadedBy || fallbackUserId,
            orgId: asset.orgId || fallbackOrgId
          }
        })
        await prisma.asset.createMany({ data: assetsWithCorrectFields })
        console.log(`✅ Restored ${assetsWithCorrectFields.length} assets`)
      }
    }
    
    console.log('🎉 Database restore completed successfully!')
    console.log('🔄 Please refresh your browser to see the restored data.')
    
  } catch (error) {
    console.error('❌ Restore failed:', error)
    
    // More specific error handling
    if (error instanceof Error) {
      if (error.message.includes('Unique constraint')) {
        console.error('💡 Tip: Some data might already exist. This is usually not a problem.')
      }
    }
  } finally {
    await prisma.$disconnect()
  }
}

directRestore()