import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

// POST /api/design-items/[itemId]/links - Add link
const linkSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  description: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const data = linkSchema.parse(body);

    // Get the current max order for this item
    const maxOrder = await prisma.designConceptItemLink.aggregate({
      where: { itemId },
      _max: { order: true },
    });

    const link = await prisma.designConceptItemLink.create({
      data: {
        ...data,
        itemId,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    return NextResponse.json(link);
  } catch (error) {
    console.error('[Design Item Links] Error adding link:', error);
    return NextResponse.json(
      { error: 'Failed to add link' },
      { status: 500 }
    );
  }
}

// GET /api/design-items/[itemId]/links - Get all links
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params
  
  try {
    const links = await prisma.designConceptItemLink.findMany({
      where: { itemId },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json(links);
  } catch (error) {
    console.error('[Design Item Links] Error fetching links:', error);
    return NextResponse.json(
      { error: 'Failed to fetch links' },
      { status: 500 }
    );
  }
}
