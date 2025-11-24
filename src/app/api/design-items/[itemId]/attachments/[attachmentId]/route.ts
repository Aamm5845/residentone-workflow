import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { del } from '@vercel/blob';

// DELETE /api/design-items/[itemId]/attachments/[attachmentId]
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string; attachmentId: string }> }
) {
  const { itemId, attachmentId } = await params
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the attachment
    const attachment = await prisma.designConceptItemAttachment.findUnique({
      where: { id: attachmentId },
    });

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    if (attachment.itemId !== itemId) {
      return NextResponse.json({ error: 'Attachment does not belong to this item' }, { status: 400 });
    }

    // Delete from Vercel Blob if it's a blob URL
    if (attachment.url.includes('blob.vercel-storage.com')) {
      try {
        await del(attachment.url);
        console.log('[Design Item Attachments] Deleted from Vercel Blob:', attachment.url);
      } catch (error) {
        console.error('[Design Item Attachments] Error deleting from Vercel Blob:', error);
        // Continue anyway - the blob might not exist
      }
    }

    // Delete from database
    await prisma.designConceptItemAttachment.delete({
      where: { id: attachmentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Design Item Attachments] Error deleting attachment:', error);
    return NextResponse.json(
      { error: 'Failed to delete attachment' },
      { status: 500 }
    );
  }
}
