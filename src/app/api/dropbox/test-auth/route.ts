import { NextRequest, NextResponse } from 'next/server'
import { Dropbox } from 'dropbox'

// Custom fetch implementation that properly handles binary responses
const fetchImpl = async (url: string, options: any) => {
  const response = await fetch(url, options)
  
  // Add buffer method if it doesn't exist (for binary downloads)
  if (!response.buffer) {
    response.buffer = async () => {
      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    }
  }
  
  return response
}

/**
 * Simple test to verify Dropbox authentication works
 * Tests without pathRoot first to isolate the issue
 */
export async function GET(request: NextRequest) {
  try {
    console.log('[Auth Test] Testing Dropbox authentication...')

    // Test 1: Basic auth without any special headers
    const config1: any = {
      fetch: fetchImpl,
      refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
      clientId: process.env.DROPBOX_APP_KEY,
      clientSecret: process.env.DROPBOX_APP_SECRET,
    }

    console.log('[Auth Test] Config check:', {
      hasRefreshToken: !!process.env.DROPBOX_REFRESH_TOKEN,
      hasAppKey: !!process.env.DROPBOX_APP_KEY,
      hasAppSecret: !!process.env.DROPBOX_APP_SECRET,
      refreshTokenStart: process.env.DROPBOX_REFRESH_TOKEN?.substring(0, 20),
      appKey: process.env.DROPBOX_APP_KEY
    })

    const client1 = new Dropbox(config1)
    
    let test1Result
    try {
      const response1 = await client1.usersGetCurrentAccount()
      test1Result = {
        success: true,
        accountId: response1.result.account_id,
        name: response1.result.name.display_name,
        email: response1.result.email
      }
    } catch (err: any) {
      test1Result = {
        success: false,
        error: err.message,
        status: err.status
      }
    }

    // Test 2: With selectUser header
    const config2: any = {
      fetch: fetchImpl,
      refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
      clientId: process.env.DROPBOX_APP_KEY,
      clientSecret: process.env.DROPBOX_APP_SECRET,
      selectUser: process.env.DROPBOX_API_SELECT_USER
    }

    const client2 = new Dropbox(config2)
    
    let test2Result
    try {
      const response2 = await client2.filesListFolder({ path: '' })
      test2Result = {
        success: true,
        entriesCount: response2.result.entries.length,
        entries: response2.result.entries.slice(0, 5).map((e: any) => ({
          name: e.name,
          type: e['.tag']
        }))
      }
    } catch (err: any) {
      test2Result = {
        success: false,
        error: err.message,
        status: err.status,
        errorSummary: err.error?.error_summary
      }
    }

    // Test 3: With selectUser AND pathRoot
    const config3: any = {
      fetch: fetchImpl,
      refreshToken: process.env.DROPBOX_REFRESH_TOKEN,
      clientId: process.env.DROPBOX_APP_KEY,
      clientSecret: process.env.DROPBOX_APP_SECRET,
      selectUser: process.env.DROPBOX_API_SELECT_USER,
      pathRoot: JSON.stringify({
        '.tag': 'root',
        'root': process.env.DROPBOX_ROOT_NAMESPACE_ID
      })
    }

    const client3 = new Dropbox(config3)
    
    let test3Result
    try {
      const response3 = await client3.filesListFolder({ path: '' })
      test3Result = {
        success: true,
        entriesCount: response3.result.entries.length,
        entries: response3.result.entries.slice(0, 5).map((e: any) => ({
          name: e.name,
          type: e['.tag']
        }))
      }
    } catch (err: any) {
      test3Result = {
        success: false,
        error: err.message,
        status: err.status,
        errorSummary: err.error?.error_summary
      }
    }

    return NextResponse.json({
      success: true,
      tests: {
        basicAuth: test1Result,
        withSelectUser: test2Result,
        withSelectUserAndPathRoot: test3Result
      },
      environment: {
        hasRefreshToken: !!process.env.DROPBOX_REFRESH_TOKEN,
        hasAppKey: !!process.env.DROPBOX_APP_KEY,
        hasAppSecret: !!process.env.DROPBOX_APP_SECRET,
        defaultMemberId: process.env.DROPBOX_API_SELECT_USER,
        rootNamespaceId: process.env.DROPBOX_ROOT_NAMESPACE_ID
      }
    }, { status: 200 })

  } catch (error: any) {
    console.error('[Auth Test] Error:', error)
    
    return NextResponse.json({
      success: false,
      error: error.message || 'Unknown error',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }, { status: 500 })
  }
}
