import { NextRequest, NextResponse } from 'next/server'
import { getSession } from '@/auth'
import { prisma } from '@/lib/prisma'

// Default layout for new users (core widgets)
const DEFAULT_LAYOUTS = [
  { i: 'quick-stats',       x: 0,  y: 0,  w: 12, h: 2,  minW: 6,  minH: 2  },
  { i: 'upcoming-meetings', x: 0,  y: 2,  w: 6,  h: 5,  minW: 4,  minH: 3  },
  { i: 'my-tasks',          x: 6,  y: 2,  w: 6,  h: 5,  minW: 4,  minH: 3  },
  { i: 'active-stages',     x: 0,  y: 7,  w: 12, h: 6,  minW: 6,  minH: 3  },
  { i: 'last-completed',    x: 0,  y: 13, w: 4,  h: 3,  minW: 3,  minH: 3  },
]

const DEFAULT_ENABLED_WIDGETS = [
  'quick-stats', 'upcoming-meetings', 'my-tasks', 'active-stages', 'last-completed'
]

export async function GET() {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id

    const prefs = await prisma.dashboardPreferences.findUnique({
      where: { userId }
    })

    if (!prefs) {
      return NextResponse.json({
        layouts: DEFAULT_LAYOUTS,
        enabledWidgets: DEFAULT_ENABLED_WIDGETS,
        isDefault: true
      })
    }

    return NextResponse.json({
      layouts: prefs.layouts,
      enabledWidgets: prefs.enabledWidgets,
      isDefault: false
    })
  } catch (error) {
    console.error('Error fetching dashboard preferences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userId = (session.user as any).id
    const body = await request.json()

    const { layouts, enabledWidgets } = body

    if (!layouts || !enabledWidgets) {
      return NextResponse.json({ error: 'Missing layouts or enabledWidgets' }, { status: 400 })
    }

    const prefs = await prisma.dashboardPreferences.upsert({
      where: { userId },
      create: {
        userId,
        layouts,
        enabledWidgets,
      },
      update: {
        layouts,
        enabledWidgets,
      }
    })

    return NextResponse.json({ success: true, preferences: prefs })
  } catch (error) {
    console.error('Error saving dashboard preferences:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
