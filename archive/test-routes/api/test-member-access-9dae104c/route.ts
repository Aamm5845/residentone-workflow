import { NextRequest, NextResponse } from 'next/server'
import { Dropbox } from 'dropbox'

// Custom fetch implementation
const fetchImpl = async (url: string, options: any) => {
  const response = await fetch(url, options)
  if (!response.buffer) {
    response.buffer = async () => {
      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    }
  }
  return response
}

/**
 * Test different path approaches for non-admin team members
 */
export async function GET(request: NextRequest) {
  try {
    // Test with Shaya (member_only)
    const shayaMemberId = 'dbmid:AAB0duKVbkzvGMWP1V8R2Zhk0TBgzcPxtK4'
    
    const results: any = {}

    // Test 1: With pathRoot (we know this gives 422)
    try {
      const client1 = new Dropbox({
        fetch: fetchImpl,
        refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
        clientId: process.env.DROPBOX_APP_KEY,
        clientSecret: process.env.DROPBOX_APP_SECRET,
        selectUser: shayaMemberId,
        pathRoot: JSON.stringify({
          '.tag': 'root',
          'root': process.env.DROPBOX_ROOT_NAMESPACE_ID
        })
      })
      
      const response1 = await client1.filesListFolder({ path: '' })
      results.withPathRoot = {
        success: true,
        entries: response1.result.entries.map((e: any) => ({ name: e.name, type: e['.tag'] }))
      }
    } catch (err: any) {
      results.withPathRoot = {
        success: false,
        error: err.message,
        status: err.status
      }
    }

    // Test 2: Without pathRoot (personal root)
    try {
      const client2 = new Dropbox({
        fetch: fetchImpl,
        refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
        clientId: process.env.DROPBOX_APP_KEY,
        clientSecret: process.env.DROPBOX_APP_SECRET,
        selectUser: shayaMemberId
      })
      
      const response2 = await client2.filesListFolder({ path: '' })
      results.withoutPathRoot = {
        success: true,
        entries: response2.result.entries.map((e: any) => ({ name: e.name, type: e['.tag'] }))
      }
    } catch (err: any) {
      results.withoutPathRoot = {
        success: false,
        error: err.message,
        status: err.status
      }
    }

    // Test 3: With namespace_id pathRoot (alternative format)
    try {
      const client3 = new Dropbox({
        fetch: fetchImpl,
        refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
        clientId: process.env.DROPBOX_APP_KEY,
        clientSecret: process.env.DROPBOX_APP_SECRET,
        selectUser: shayaMemberId,
        pathRoot: JSON.stringify({
          '.tag': 'namespace_id',
          'namespace_id': process.env.DROPBOX_ROOT_NAMESPACE_ID
        })
      })
      
      const response3 = await client3.filesListFolder({ path: '' })
      results.withNamespaceId = {
        success: true,
        entries: response3.result.entries.map((e: any) => ({ name: e.name, type: e['.tag'] }))
      }
    } catch (err: any) {
      results.withNamespaceId = {
        success: false,
        error: err.message,
        status: err.status
      }
    }

    // Test 4: Try accessing team folder by path
    try {
      const client4 = new Dropbox({
        fetch: fetchImpl,
        refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
        clientId: process.env.DROPBOX_APP_KEY,
        clientSecret: process.env.DROPBOX_APP_SECRET,
        selectUser: shayaMemberId
      })
      
      const response4 = await client4.filesListFolder({ 
        path: '/Meisner Interiors Team Folder' 
      })
      results.teamFolderByPath = {
        success: true,
        entries: response4.result.entries.slice(0, 10).map((e: any) => ({ name: e.name, type: e['.tag'] }))
      }
    } catch (err: any) {
      results.teamFolderByPath = {
        success: false,
        error: err.message,
        status: err.status,
        errorSummary: err.error?.error_summary
      }
    }

    // Test 5: List namespaces accessible to this member
    try {
      const client5 = new Dropbox({
        fetch: fetchImpl,
        refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
        clientId: process.env.DROPBOX_APP_KEY,
        clientSecret: process.env.DROPBOX_APP_SECRET,
        selectUser: shayaMemberId
      })
      
      const response5 = await client5.usersGetCurrentAccount()
      results.accountInfo = {
        success: true,
        accountId: response5.result.account_id,
        name: response5.result.name.display_name,
        email: response5.result.email,
        accountType: response5.result.account_type['.tag']
      }
    } catch (err: any) {
      results.accountInfo = {
        success: false,
        error: err.message
      }
    }

    return NextResponse.json({
      success: true,
      testingMember: 'Shaya Gross (member_only)',
      results,
      recommendation: results.withoutPathRoot?.success 
        ? 'Use WITHOUT pathRoot for member_only users'
        : results.withNamespaceId?.success
        ? 'Use namespace_id format for pathRoot'
        : 'Check results for working approach'
    }, { status: 200 })

  } catch (error: any) {
    console.error('[Member Access Test] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error'
    }, { status: 500 })
  }
}
