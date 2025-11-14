import { NextResponse } from 'next/server'
import { dropboxService } from '@/lib/dropbox-service'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const results: any = {
    timestamp: new Date().toISOString(),
    tests: []
  }

  // Test 1: Configuration
  const configTest = {
    name: 'Dropbox Configuration',
    status: 'pending' as 'pass' | 'fail' | 'pending',
    details: {} as any
  }

  try {
    const isConfigured = dropboxService.isConfigured()
    
    configTest.details = {
      hasRefreshToken: !!(process.env.DROPBOX_REFRESH_TOKEN && 
                         process.env.DROPBOX_APP_KEY && 
                         process.env.DROPBOX_APP_SECRET),
      hasAccessToken: !!process.env.DROPBOX_ACCESS_TOKEN,
      hasTeamMember: !!(process.env.DROPBOX_TEAM_MEMBER_ID || 
                       process.env.DROPBOX_API_SELECT_USER),
      hasCronSecret: !!process.env.CRON_SECRET,
      isConfigured
    }
    
    configTest.status = isConfigured ? 'pass' : 'fail'
  } catch (error: any) {
    configTest.status = 'fail'
    configTest.details.error = error.message
  }

  results.tests.push(configTest)

  // Test 2: Connection & Listing
  const connectionTest = {
    name: 'Dropbox Connection & Backup Folder',
    status: 'pending' as 'pass' | 'fail' | 'pending',
    details: {} as any
  }

  try {
    const folderContents = await dropboxService.listFolder('/Software Backups')
    
    const backupFiles = folderContents.files.filter(file =>
      file.name.startsWith('database-backup-') && file.name.endsWith('.json.gz')
    )

    connectionTest.details = {
      totalFiles: folderContents.files.length,
      totalFolders: folderContents.folders.length,
      backupFiles: backupFiles.length,
      recentBackups: backupFiles.slice(0, 5).map(f => ({
        name: f.name,
        size: `${(f.size / 1024 / 1024).toFixed(2)} MB`,
        date: f.lastModified.toISOString()
      }))
    }
    
    connectionTest.status = 'pass'
  } catch (error: any) {
    if (error.message?.includes('not_found')) {
      connectionTest.status = 'pass'
      connectionTest.details = {
        message: 'Folder does not exist yet - will be created on first backup',
        note: 'This is normal if no backups have run yet'
      }
    } else {
      connectionTest.status = 'fail'
      connectionTest.details.error = error.message
    }
  }

  results.tests.push(connectionTest)

  // Test 3: Download URL generation
  const downloadTest = {
    name: 'Download URL Generation',
    status: 'pending' as 'pass' | 'fail' | 'pending',
    details: {} as any
  }

  try {
    const folderContents = await dropboxService.listFolder('/Software Backups')
    const backupFiles = folderContents.files.filter(file =>
      file.name.startsWith('database-backup-') && file.name.endsWith('.json.gz')
    )

    if (backupFiles.length > 0) {
      const testFile = backupFiles[0]
      const downloadUrl = await dropboxService.getTemporaryLink(testFile.path)
      
      downloadTest.details = {
        testedFile: testFile.name,
        hasDownloadUrl: !!downloadUrl,
        urlLength: downloadUrl?.length || 0
      }
      
      downloadTest.status = downloadUrl ? 'pass' : 'fail'
    } else {
      downloadTest.status = 'pass'
      downloadTest.details = {
        message: 'No backup files to test download URLs',
        note: 'Will be tested after first backup runs'
      }
    }
  } catch (error: any) {
    if (error.message?.includes('not_found')) {
      downloadTest.status = 'pass'
      downloadTest.details = {
        message: 'No backups folder yet',
        note: 'Will be tested after first backup runs'
      }
    } else {
      downloadTest.status = 'fail'
      downloadTest.details.error = error.message
    }
  }

  results.tests.push(downloadTest)

  // Overall status
  const allPassed = results.tests.every((t: any) => t.status === 'pass')
  results.overallStatus = allPassed ? 'pass' : 'fail'
  results.summary = {
    passed: results.tests.filter((t: any) => t.status === 'pass').length,
    failed: results.tests.filter((t: any) => t.status === 'fail').length,
    total: results.tests.length
  }

  return NextResponse.json(results, {
    headers: {
      'Cache-Control': 'no-store'
    }
  })
}
