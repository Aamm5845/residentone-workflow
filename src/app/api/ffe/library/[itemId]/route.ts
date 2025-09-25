import { NextRequest, NextResponse } from 'next/server'
import { 
  updateCustomFFEItem,
  removeCustomFFEItem 
} from '@/lib/ffe/library-manager'
import { getSession } from '@/auth'

// Update FFE library item
export async function PUT(request: NextRequest, { params }: { params: { itemId: string } }) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const itemId = params.itemId
    const body = await request.json()
    const { orgId, name, category, roomTypes, isRequired, isStandard, notes } = body

    if (!orgId || !name || !category || !roomTypes || roomTypes.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    await updateCustomFFEItem(
      orgId,
      itemId,
      session.user.id,
      {
        name,
        category,
        roomTypes,
        isRequired: Boolean(isRequired),
        isStandard: Boolean(isStandard),
        notes
      }
    )

    return NextResponse.json({ success: true, message: 'FFE item updated' })

  } catch (error) {
    console.error('Error updating FFE item:', error)
    return NextResponse.json({ error: 'Failed to update FFE item' }, { status: 500 })
  }
}

// Delete FFE library item
export async function DELETE(request: NextRequest, { params }: { params: { itemId: string } }) {
  try {
    const session = await getSession()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const itemId = params.itemId
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')

    if (!orgId) {
      return NextResponse.json({ error: 'Organization ID is required' }, { status: 400 })
    }

    await removeCustomFFEItem(orgId, itemId, session.user.id)

    return NextResponse.json({ success: true, message: 'FFE item deleted' })

  } catch (error) {
    console.error('Error deleting FFE item:', error)
    return NextResponse.json({ error: 'Failed to delete FFE item' }, { status: 500 })
  }
}