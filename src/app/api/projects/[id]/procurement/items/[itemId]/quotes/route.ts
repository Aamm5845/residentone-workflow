import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/auth';
import { getItemQuotes, acceptQuoteForItem } from '@/lib/procurement/status-sync';

interface RouteParams {
  params: Promise<{ id: string; itemId: string }>;
}

/**
 * GET /api/projects/[id]/procurement/items/[itemId]/quotes
 * Get all quotes for an item for comparison
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId } = await params;

    const quotes = await getItemQuotes(itemId);

    return NextResponse.json({
      success: true,
      quotes,
      count: quotes.length,
      hasAccepted: quotes.some(q => q.isAccepted),
      lowestPrice: quotes.length > 0 ? Math.min(...quotes.map(q => q.unitPrice)) : null,
    });
  } catch (error) {
    console.error('Error getting item quotes:', error);
    return NextResponse.json(
      { error: 'Failed to get item quotes' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/projects/[id]/procurement/items/[itemId]/quotes
 * Accept a quote for an item
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { itemId } = await params;
    const body = await request.json();
    const { quoteLineItemId, markupPercent } = body;

    if (!quoteLineItemId) {
      return NextResponse.json(
        { error: 'quoteLineItemId is required' },
        { status: 400 }
      );
    }

    const result = await acceptQuoteForItem(
      itemId,
      quoteLineItemId,
      session.user.id,
      markupPercent
    );

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to accept quote' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Quote accepted successfully',
    });
  } catch (error) {
    console.error('Error accepting quote:', error);
    return NextResponse.json(
      { error: 'Failed to accept quote' },
      { status: 500 }
    );
  }
}
