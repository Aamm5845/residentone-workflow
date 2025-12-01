import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { fetchLinkPreview } from '@/lib/link-preview';

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

    // Extract domain for site name fallback
    let siteName = '';
    try {
      const urlObj = new URL(data.url);
      siteName = urlObj.hostname.replace(/^www\./, '');
    } catch {
      siteName = '';
    }

    // Get the current max order for this item
    const maxOrder = await prisma.designConceptItemLink.aggregate({
      where: { itemId },
      _max: { order: true },
    });

    // Create link with basic data first (skip preview to ensure it works)
    const link = await prisma.designConceptItemLink.create({
      data: {
        url: data.url,
        title: data.title || siteName || data.url,
        siteName: siteName,
        itemId,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    // Fetch preview metadata asynchronously (non-blocking)
    // This can be done in background or on-demand later
    fetchLinkPreview(data.url).then(async (preview) => {
      try {
        await prisma.designConceptItemLink.update({
          where: { id: link.id },
          data: {
            title: preview.title || link.title,
            description: preview.description,
            imageUrl: preview.imageUrl,
            siteName: preview.siteName || link.siteName,
            favicon: preview.favicon,
          },
        });
        console.log(`[Design Item Links] Preview updated for link ${link.id}`);
      } catch (err) {
        console.warn(`[Design Item Links] Failed to update preview for link ${link.id}:`, err);
      }
    }).catch((err) => {
      console.warn(`[Design Item Links] Preview fetch failed for ${data.url}:`, err);
    });

    return NextResponse.json(link);
  } catch (error) {
    console.error('[Design Item Links] Error adding link:', error);
    return NextResponse.json(
      { error: 'Failed to add link', details: error instanceof Error ? error.message : 'Unknown error' },
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
