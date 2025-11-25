import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { Dropbox } from 'dropbox'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const results = {
      environmentVariables: {
        DROPBOX_ACCESS_TOKEN: !!process.env.DROPBOX_ACCESS_TOKEN,
        DROPBOX_TEAM_MEMBER_ID: !!process.env.DROPBOX_TEAM_MEMBER_ID,
        DROPBOX_REFRESH_TOKEN: !!process.env.DROPBOX_REFRESH_TOKEN,
        DROPBOX_APP_KEY: !!process.env.DROPBOX_APP_KEY,
        DROPBOX_APP_SECRET: !!process.env.DROPBOX_APP_SECRET
      },
      tests: [] as any[]
    }

    // Test 1: Basic client creation
    try {
      const dropbox = new Dropbox({
        accessToken: process.env.DROPBOX_ACCESS_TOKEN,
        selectUser: process.env.DROPBOX_TEAM_MEMBER_ID
      })
      results.tests.push({
        name: 'Client Creation',
        status: 'success',
        message: 'Dropbox client created successfully'
      })
      
      // Test 2: Simple API call to check authentication
      try {
        const accountInfo = await dropbox.usersGetCurrentAccount()
        results.tests.push({
          name: 'Authentication Test',
          status: 'success',
          message: 'Successfully authenticated',
          data: {
            email: accountInfo.result.email,
            name: accountInfo.result.name.display_name
          }
        })
      } catch (authError: any) {
        results.tests.push({
          name: 'Authentication Test',
          status: 'failed',
          message: authError.message,
          error: authError.error || authError
        })
      }

      // Test 3: Team namespaces list
      try {
        const teamClient = new Dropbox({
          accessToken: process.env.DROPBOX_ACCESS_TOKEN
          // No selectUser for team operations
        })
        const namespaces = await teamClient.teamNamespacesList({ limit: 50 })
        results.tests.push({
          name: 'Team Namespaces',
          status: 'success',
          message: `Found ${namespaces.result.namespaces.length} namespaces`,
          data: namespaces.result.namespaces.map((ns: any) => ({
            name: ns.name,
            type: ns.namespace_type?.['.tag'],
            id: ns.namespace_id
          }))
        })
      } catch (teamError: any) {
        results.tests.push({
          name: 'Team Namespaces',
          status: 'failed',
          message: teamError.message,
          error: teamError.error || teamError
        })
      }

      // Test 4: Shared link access
      try {
        const sharedLinkUrl = 'https://www.dropbox.com/scl/fo/7dk9gbqev0k04gw0ifm7t/AJH6jgqztvAlHM4DKJbtEL0?rlkey=xt236i59o7tevsfozuvd2zo2o&st=gjz3rjtp&dl=0'
        const response = await dropbox.filesListFolder({
          path: '',
          shared_link: {
            url: sharedLinkUrl
          },
          recursive: false,
          include_media_info: false,
          include_deleted: false
        })
        
        results.tests.push({
          name: 'Shared Link Access',
          status: 'success',
          message: `Found ${response.result.entries.length} entries`,
          data: response.result.entries.slice(0, 5).map((entry: any) => ({
            name: entry.name,
            type: entry['.tag'],
            path: entry.path_display || entry.path_lower
          }))
        })
      } catch (linkError: any) {
        results.tests.push({
          name: 'Shared Link Access',
          status: 'failed',
          message: linkError.message,
          error: linkError.error || linkError
        })
      }

    } catch (clientError: any) {
      results.tests.push({
        name: 'Client Creation',
        status: 'failed',
        message: clientError.message,
        error: clientError
      })
    }

    return NextResponse.json({
      success: true,
      ...results
    })

  } catch (error) {
    console.error('Dropbox test error:', error)
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
