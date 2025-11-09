import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';
import { DropboxService } from '@/lib/dropbox-service';
import { put } from '@vercel/blob';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

// POST /api/design-items/[itemId]/images - Upload and add image
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params;
  
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the design concept item with stage and project info
    const item = await prisma.designConceptItem.findUnique({
      where: { id: itemId },
      include: {
        libraryItem: true,
        stage: {
          include: {
            room: {
              include: {
                project: {
                  select: {
                    id: true,
                    name: true,
                    dropboxFolder: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!item) {
      return NextResponse.json({ error: 'Design item not found' }, { status: 404 });
    }

    const project = item.stage.room.project;
    const roomName = item.stage.room.name || item.stage.room.type;
    const itemName = item.libraryItem.name;

    if (!project.dropboxFolder) {
      return NextResponse.json(
        { error: 'Project is not linked to a Dropbox folder' },
        { status: 400 }
      );
    }

    // Parse form data
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 10MB' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: 'Invalid file type. Only images are allowed' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Initialize Dropbox service
    const dropboxService = new DropboxService();

    // Create the Dropbox folder structure: ProjectFolder/7- SOURCES/RoomName/ItemName/
    const sourcesPath = `${project.dropboxFolder}/7- SOURCES`;
    const roomPath = `${sourcesPath}/${roomName}`;
    const itemPath = `${roomPath}/${itemName}`;

    try {
      await dropboxService.createFolder(sourcesPath);
      await dropboxService.createFolder(roomPath);
      await dropboxService.createFolder(itemPath);
    } catch (error) {
      console.error('[Design Item Images] Error creating Dropbox folders:', error);
      // Continue anyway - folders might already exist
    }

    // Generate safe filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${safeFileName}`;
    const dropboxPath = `${itemPath}/${fileName}`;

    console.log('[Design Item Images] Uploading to Dropbox:', dropboxPath);

    // Upload to Dropbox (for backup/archival)
    await dropboxService.uploadFile(dropboxPath, buffer);

    // Create shared link from Dropbox
    const dropboxLink = await dropboxService.createSharedLink(dropboxPath);
    if (!dropboxLink) {
      throw new Error('Failed to create Dropbox shared link');
    }

    console.log('[Design Item Images] Uploading to Vercel Blob for fast access...');
    
    // Also upload to Vercel Blob (for fast access and OpenAI)
    const blobPath = `design-concept-images/${project.id}/${itemId}/${fileName}`;
    const blob = await put(blobPath, buffer, {
      access: 'public',
      contentType: file.type,
    });
    
    const blobUrl = blob.url;
    console.log('[Design Item Images] Blob URL:', blobUrl);

    // Get the current max order for this item
    const maxOrder = await prisma.designConceptItemImage.aggregate({
      where: { itemId },
      _max: { order: true },
    });

    // Save to database - use Blob URL for display and API access, keep Dropbox path for backup
    const image = await prisma.designConceptItemImage.create({
      data: {
        itemId,
        url: blobUrl, // Use Blob URL for fast access
        dropboxPath, // Keep Dropbox path for backup/archival reference
        fileName,
        fileSize: file.size,
        thumbnailUrl: blobUrl, // Use Blob URL for thumbnail too
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    console.log('[Design Item Images] Image uploaded successfully:', image.id);

    return NextResponse.json(image);
  } catch (error) {
    console.error('[Design Item Images] Error adding image:', error);
    return NextResponse.json(
      { error: 'Failed to add image' },
      { status: 500 }
    );
  }
}

// GET /api/design-items/[itemId]/images - Get all images
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params
  try {
    const images = await prisma.designConceptItemImage.findMany({
      where: { itemId },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json(images);
  } catch (error) {
    console.error('[Design Item Images] Error fetching images:', error);
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    );
  }
}
