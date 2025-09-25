import { NextRequest, NextResponse } from 'next/server'
import { 
  getOrganizationFFELibrary, 
  addCustomFFEItem,
  removeCustomFFEItem,
  updateCustomFFEItem 
} from '@/lib/ffe/library-manager'
import { getSession } from '@/auth'

// Get FFE library items for an organization
export async function GET(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    const category = searchParams.get('category')
    const roomType = searchParams.get('roomType')
    const search = searchParams.get('search')

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    const items = await getOrganizationFFELibrary(orgId, {
      category: category || undefined,
      roomType: roomType || undefined,
      search: search || undefined
    })

    return NextResponse.json({ items })

  } catch (error) {
    console.error('Error getting FFE library:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// Add new FFE library item
export async function POST(request: NextRequest) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { orgId, itemId, name, category, roomTypes, isRequired, isStandard, notes } = body

    if (!orgId || !itemId || !name || !category || !roomTypes || roomTypes.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await addCustomFFEItem(
      orgId,
      session.user.id,
      {
        itemId,
        name,
        category,
        roomTypes,
        isRequired: Boolean(isRequired),
        isStandard: Boolean(isStandard),
        notes
      }
    )

    return NextResponse.json({ success: true, message: 'FFE item added to library' })

  } catch (error) {
    console.error('Error adding FFE item:', error)
    return NextResponse.json({ error: 'Failed to add FFE item' }, { status: 500 })
  }
}