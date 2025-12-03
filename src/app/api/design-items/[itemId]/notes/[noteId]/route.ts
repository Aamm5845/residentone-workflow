import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const updateNoteSchema = z.object({
  content: z.string().min(1, 'Note content is required'),
});

// PATCH /api/design-items/[itemId]/notes/[noteId] - Update a note
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string; noteId: string }> }
) {
  const { itemId, noteId } = await params;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Verify note exists and belongs to the item
    const existingNote = await prisma.designConceptItemNote.findFirst({
      where: { id: noteId, itemId },
    });

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    const body = await req.json();
    const { content } = updateNoteSchema.parse(body);

    // Update note
    const note = await prisma.designConceptItemNote.update({
      where: { id: noteId },
      data: { content },
      include: {
        author: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return NextResponse.json(note);
  } catch (error) {
    console.error('[Design Item Notes] Error updating note:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to update note' },
      { status: 500 }
    );
  }
}

// DELETE /api/design-items/[itemId]/notes/[noteId] - Delete a note
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string; noteId: string }> }
) {
  const { itemId, noteId } = await params;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify note exists and belongs to the item
    const existingNote = await prisma.designConceptItemNote.findFirst({
      where: { id: noteId, itemId },
    });

    if (!existingNote) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 });
    }

    // Delete note
    await prisma.designConceptItemNote.delete({
      where: { id: noteId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Design Item Notes] Error deleting note:', error);
    return NextResponse.json(
      { error: 'Failed to delete note' },
      { status: 500 }
    );
  }
}

