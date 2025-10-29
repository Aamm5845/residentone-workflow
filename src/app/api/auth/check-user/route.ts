import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: {
        id: true,
        approvalStatus: true,
        role: true
      }
    })

    if (!user) {
      return NextResponse.json({
        exists: false,
        approvalStatus: null
      })
    }

    return NextResponse.json({
      exists: true,
      approvalStatus: user.approvalStatus,
      role: user.role
    })

  } catch (error) {
    console.error('Check user error:', error)
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    )
  }
}
