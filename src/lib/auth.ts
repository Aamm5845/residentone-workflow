import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { NextRequest } from 'next/server'

export async function getServerAuthSession() {
  return getServerSession(authOptions)
}

export async function requireAuth(request?: NextRequest) {
  const session = await getServerAuthSession()
  
  if (!session) {
    throw new Error('Unauthorized')
  }
  
  return session
}

export async function getCurrentUser(request?: NextRequest) {
  try {
    const session = await requireAuth(request)
    return session.user
  } catch (error) {
    return null
  }
}