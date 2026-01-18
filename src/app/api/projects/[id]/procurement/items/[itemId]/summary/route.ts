import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/auth';
import { getItemProcurementSummary } from '@/lib/procurement/status-sync';

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>;
}

/**
 * GET /api/projects/[id]/procurement/items/[itemId]/summary
 * Get the complete procurement summary for an item
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId } = await params;

    const summary = await getItemProcurementSummary(itemId);

    if (!summary) {
      return NextResponse.json(
        { error: 'Item not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      ...summary,
    });
  } catch (error) {
    console.error('Error getting item procurement summary:', error);
    return NextResponse.json(
      { error: 'Failed to get procurement summary' },
      { status: 500 }
    );
  }
}
