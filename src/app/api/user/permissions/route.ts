import { NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ canSeeFinancials: false, canSeeBilling: false })
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: {
        canSeeFinancials: true,
        canSeeBilling: true,
      },
    })

    return NextResponse.json({
      canSeeFinancials: user?.canSeeFinancials || false,
      canSeeBilling: user?.canSeeBilling || false,
    })
  } catch {
    return NextResponse.json({ canSeeFinancials: false, canSeeBilling: false })
  }
}
