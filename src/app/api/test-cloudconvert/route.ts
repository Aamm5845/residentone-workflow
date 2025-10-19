import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'

export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.CLOUDCONVERT_API_KEY) {
      return NextResponse.json({ 
        error: 'CLOUDCONVERT_API_KEY environment variable is required' 
      }, { status: 500 })
    }

    console.log('[CloudConvert Test] Testing API key with direct HTTP calls...')
    
    try {
      // Test 1: Get user info using direct API call
      console.log('[CloudConvert Test] Testing user info...')
      
      const userResponse = await fetch('https://api.cloudconvert.com/v2/users/me', {
        headers: {
          'Authorization': `Bearer ${process.env.CLOUDCONVERT_API_KEY}`,
          'Content-Type': 'application/json'
        }
      })
      
      if (!userResponse.ok) {
        const errorText = await userResponse.text()
        throw new Error(`API request failed: ${userResponse.status} ${userResponse.statusText} - ${errorText}`)
      }
      
      const userResult = await userResponse.json()
      const userInfo = userResult.data
      
      console.log('[CloudConvert Test] User info success:', {
        id: userInfo.id,
        email: userInfo.email,
        credits: userInfo.credits
      })

      return NextResponse.json({
        success: true,
        user: {
          id: userInfo.id,
          email: userInfo.email,
          credits: userInfo.credits
        },
        endpoint: 'https://api.cloudconvert.com/v2',
        method: 'Direct HTTP calls'
      })

    } catch (apiError) {
      console.error('[CloudConvert Test] API test failed:', apiError)
      return NextResponse.json({
        success: false,
        error: 'CloudConvert API test failed',
        details: {
          message: apiError instanceof Error ? apiError.message : 'Unknown error'
        }
      }, { status: 500 })
    }

  } catch (error) {
    console.error('[CloudConvert Test] Setup error:', error)
    return NextResponse.json({
      success: false,
      error: 'Test setup failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
