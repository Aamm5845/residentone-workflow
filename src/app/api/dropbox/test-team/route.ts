import { NextRequest, NextResponse } from 'next/server'
import { dropboxService } from '@/lib/dropbox-service-v2'

/**
 * Test Dropbox team configuration
 * Tests connection for all team members and displays configuration status
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Dropbox Test] Starting team configuration test...')

    // Get all team members
    const teamMembers = dropboxService.getTeamMembers()

    console.log(`[Dropbox Test] Found ${teamMembers.length} team members`)

    // Test connection for each member
    const results = await Promise.all(
      teamMembers.map(async (member) => {
        console.log(`[Dropbox Test] Testing connection for ${member.name} (${member.email})...`)
        
        const testResult = await dropboxService.testConnection(member.memberId)
        
        // If successful, try to list root folder to show actual files
        let rootContents = null
        if (testResult.success) {
          try {
            const folder = await dropboxService.listFolder('', member.memberId)
            rootContents = {
              folders: folder.folders.map(f => f.name),
              files: folder.files.map(f => f.name),
              totalFolders: folder.folders.length,
              totalFiles: folder.files.length
            }
          } catch (err) {
            console.error(`[Dropbox Test] Error listing folder for ${member.name}:`, err)
          }
        }

        return {
          member: {
            name: member.name,
            email: member.email,
            memberId: member.memberId,
            role: member.role
          },
          connectionTest: testResult,
          rootContents
        }
      })
    )

    // Check environment variables
    const envCheck = {
      hasAccessToken: !!process.env.DROPBOX_ACCESS_TOKEN,
      hasRefreshToken: !!process.env.DROPBOX_REFRESH_TOKEN,
      hasAppKey: !!process.env.DROPBOX_APP_KEY,
      hasAppSecret: !!process.env.DROPBOX_APP_SECRET,
      rootNamespaceId: process.env.DROPBOX_ROOT_NAMESPACE_ID,
      defaultMemberId: process.env.DROPBOX_API_SELECT_USER,
      teamMembersCount: teamMembers.length
    }

    // Summary
    const summary = {
      totalMembers: teamMembers.length,
      successfulConnections: results.filter(r => r.connectionTest.success).length,
      failedConnections: results.filter(r => !r.connectionTest.success).length,
      allConfigured: results.every(r => r.connectionTest.success)
    }

    return NextResponse.json({
      success: true,
      summary,
      environmentCheck: envCheck,
      memberTests: results,
      timestamp: new Date().toISOString()
    }, { status: 200 })

  } catch (error: any) {
    console.error('[Dropbox Test] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
