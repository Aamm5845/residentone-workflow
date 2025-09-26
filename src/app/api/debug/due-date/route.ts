import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { dueDateSchema } from '@/lib/validation/due-date-validation'

export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    console.log('Debug session:', session?.user?.id ? 'authenticated' : 'not authenticated')
    
    const body = await request.json()
    console.log('Debug request body:', body)
    
    // Test validation
    const validationResult = dueDateSchema.safeParse(body)
    console.log('Debug validation result:', validationResult)
    
    if (!validationResult.success) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        details: validationResult.error.issues,
        body
      })
    }
    
    return NextResponse.json({
      success: true,
      message: 'Debug test passed',
      data: validationResult.data,
      body
    })
    
  } catch (error) {
    console.error('Debug error:', error)
    return NextResponse.json({
      success: false,
      error: 'Debug endpoint error',
      details: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}