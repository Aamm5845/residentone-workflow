'use client'

import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Get all room libraries for an organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    const libraries = await prisma.fFERoomLibrary.findMany({
      where: { orgId },
      orderBy: { roomType: 'asc' },
    })

    return NextResponse.json({ libraries })

  } catch (error) {
    console.error('Error getting room libraries:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Create a new room library
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orgId, name, roomType, description, basedOnLibrary } = body

    if (!orgId || !name || !roomType) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    let categories = []
    if (basedOnLibrary) {
      const existingLibrary = await prisma.fFERoomLibrary.findFirst({
        where: { orgId, id: basedOnLibrary }
      })
      if (existingLibrary) {
        categories = existingLibrary.categories as any
      }
    }

    const newLibrary = await prisma.fFERoomLibrary.create({
      data: {
        orgId,
        name,
        roomType,
        description,
        categories,
        version: '1.0',
        createdById: session.user.id,
        updatedById: session.user.id,
      },
    })

    return NextResponse.json({ library: newLibrary })

  } catch (error) {
    console.error('Error creating room library:', error)
    return NextResponse.json({ error: 'Failed to create room library' }, { status: 500 })
  }
}