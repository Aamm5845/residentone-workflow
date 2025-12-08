import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'
import { randomBytes } from 'crypto'

// GET: Verify extension API key or session
export async function GET(request: NextRequest) {
  try {
    // First try API key from header
    const apiKey = request.headers.get('X-Extension-Key')
    
    if (apiKey) {
      // Verify API key from database
      const token = await prisma.clientAccessToken.findFirst({
        where: {
          token: apiKey,
          active: true,
          // Check if not expired
          OR: [
            { expiresAt: null },
            { expiresAt: { gt: new Date() } }
          ]
        },
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              orgId: true,
              role: true
            }
          }
        }
      })
      
      if (!token) {
        return NextResponse.json({ error: 'Invalid or expired API key' }, { status: 401 })
      }
      
      // Update last accessed
      await prisma.clientAccessToken.update({
        where: { id: token.id },
        data: {
          lastAccessedAt: new Date(),
          accessCount: { increment: 1 }
        }
      })
      
      return NextResponse.json({
        ok: true,
        user: token.createdBy,
        message: 'Authenticated via API key'
      })
    }
    
    // Fall back to session auth
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get full user info
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: {
        id: true,
        name: true,
        email: true,
        orgId: true,
        role: true
      }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    return NextResponse.json({
      ok: true,
      user,
      message: 'Authenticated via session'
    })
    
  } catch (error) {
    console.error('Extension auth error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST: Generate a new extension API key
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get user info
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true, orgId: true }
    })
    
    if (!user || !user.orgId) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    // Generate a unique API key
    const apiKey = `ext_${randomBytes(32).toString('hex')}`
    
    // Get or create a "placeholder" project for extension tokens
    // We'll use the ClientAccessToken model which requires a projectId
    // First, find any project from the user's organization
    let project = await prisma.project.findFirst({
      where: { orgId: user.orgId }
    })
    
    if (!project) {
      return NextResponse.json({ 
        error: 'No projects found. Please create a project first.' 
      }, { status: 400 })
    }
    
    // Deactivate any existing extension keys for this user
    await prisma.clientAccessToken.updateMany({
      where: {
        createdById: user.id,
        name: { startsWith: 'Extension:' }
      },
      data: { active: false }
    })
    
    // Create new extension token
    const token = await prisma.clientAccessToken.create({
      data: {
        projectId: project.id,
        token: apiKey,
        name: `Extension: Chrome Clipper`,
        active: true,
        expiresAt: null, // No expiration for extension tokens
        createdById: user.id
      }
    })
    
    return NextResponse.json({
      ok: true,
      apiKey: token.token,
      message: 'Extension API key generated successfully'
    })
    
  } catch (error) {
    console.error('Extension key generation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE: Revoke extension API key
export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession()
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true }
    })
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    // Deactivate all extension keys for this user
    await prisma.clientAccessToken.updateMany({
      where: {
        createdById: user.id,
        name: { startsWith: 'Extension:' }
      },
      data: { active: false }
    })
    
    return NextResponse.json({
      ok: true,
      message: 'Extension API key revoked'
    })
    
  } catch (error) {
    console.error('Extension key revocation error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
