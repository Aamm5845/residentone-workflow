import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/auth';
import { prisma } from '@/lib/prisma';
import { DropboxService } from '@/lib/dropbox-service';
import { put } from '@vercel/blob';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB for documents
const ALLOWED_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
  'application/zip',
  'application/x-zip-compressed'
];

// POST /api/design-items/[itemId]/attachments - Upload and add attachment
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
    const description = formData.get('description') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'File too large. Maximum size is 50MB' },
        { status: 400 }
      );
    }

    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type. Allowed types: PDF, Word, Excel, PowerPoint, Text, CSV, ZIP` },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Initialize Dropbox service
    const dropboxService = new DropboxService();

    // Create the Dropbox folder structure: ProjectFolder/7- SOURCES/RoomName/ItemName/Attachments/
    const sourcesPath = `${project.dropboxFolder}/7- SOURCES`;
    const roomPath = `${sourcesPath}/${roomName}`;
    const itemPath = `${roomPath}/${itemName}`;
    const attachmentsPath = `${itemPath}/Attachments`;

    try {
      await dropboxService.createFolder(sourcesPath);
      await dropboxService.createFolder(roomPath);
      await dropboxService.createFolder(itemPath);
      await dropboxService.createFolder(attachmentsPath);
    } catch (error) {
      console.error('[Design Item Attachments] Error creating Dropbox folders:', error);
      // Continue anyway - folders might already exist
    }

    // Generate safe filename
    const timestamp = Date.now();
    const fileExtension = file.name.split('.').pop() || 'bin';
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const fileName = `${timestamp}_${safeFileName}`;
    const dropboxPath = `${attachmentsPath}/${fileName}`;

    console.log('[Design Item Attachments] Uploading to Dropbox:', dropboxPath);

    // Upload to Dropbox (for backup/archival)
    await dropboxService.uploadFile(dropboxPath, buffer);

    // Create shared link from Dropbox
    const dropboxLink = await dropboxService.createSharedLink(dropboxPath);
    if (!dropboxLink) {
      throw new Error('Failed to create Dropbox shared link');
    }

    console.log('[Design Item Attachments] Uploading to Vercel Blob for fast access...');
    
    // Also upload to Vercel Blob (for fast access)
    const blobPath = `design-concept-attachments/${project.id}/${itemId}/${fileName}`;
    const blob = await put(blobPath, buffer, {
      access: 'public',
      contentType: file.type,
    });
    
    const blobUrl = blob.url;
    console.log('[Design Item Attachments] Blob URL:', blobUrl);

    // Get the current max order for this item
    const maxOrder = await prisma.designConceptItemAttachment.aggregate({
      where: { itemId },
      _max: { order: true },
    });

    // Save to database - use Blob URL for display and API access, keep Dropbox path for backup
    const attachment = await prisma.designConceptItemAttachment.create({
      data: {
        itemId,
        url: blobUrl,
        dropboxPath,
        fileName,
        fileSize: file.size,
        fileType: file.type,
        description: description || null,
        order: (maxOrder._max.order ?? -1) + 1,
      },
    });

    console.log('[Design Item Attachments] Attachment uploaded successfully:', attachment.id);

    return NextResponse.json(attachment);
  } catch (error) {
    console.error('[Design Item Attachments] Error adding attachment:', error);
    return NextResponse.json(
      { error: 'Failed to add attachment' },
      { status: 500 }
    );
  }
}

// GET /api/design-items/[itemId]/attachments - Get all attachments
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> }
) {
  const { itemId } = await params
  try {
    const attachments = await prisma.designConceptItemAttachment.findMany({
      where: { itemId },
      orderBy: { order: 'asc' },
    });

    return NextResponse.json(attachments);
  } catch (error) {
    console.error('[Design Item Attachments] Error fetching attachments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch attachments' },
      { status: 500 }
    );
  }
}
