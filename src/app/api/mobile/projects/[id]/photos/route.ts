import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { jwtVerify } from 'jose';
import { dropboxService } from '@/lib/dropbox-service';

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'your-secret-key'
);

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

async function verifyToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  try {
    const token = authHeader.substring(7);
    const verified = await jwtVerify(token, JWT_SECRET);
    return verified.payload;
  } catch {
    return null;
  }
}

// Get photos for a project - from both ProjectUpdatePhotos AND Assets
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const { id } = await params;

    // Get photos from ProjectUpdatePhoto
    const updates = await prisma.projectUpdate.findMany({
      where: { projectId: id },
      include: { photos: { orderBy: { createdAt: 'desc' } } },
      orderBy: { createdAt: 'desc' }
    });

    const updatePhotos = updates.flatMap(update => 
      update.photos.map(photo => ({
        id: photo.id,
        fileUrl: photo.fileUrl,
        caption: photo.caption,
        takenAt: photo.takenAt,
        createdAt: photo.createdAt,
        gpsCoordinates: photo.gpsCoordinates,
        tags: photo.tags,
        source: 'update',
        updateId: update.id,
        updateTitle: update.title
      }))
    );

    // Get photos from Assets table (these include Dropbox photos)
    const assets = await prisma.asset.findMany({
      where: { 
        projectId: id,
        type: 'IMAGE'
      },
      orderBy: { createdAt: 'desc' }
    });

    const assetPhotos = await Promise.all(assets.map(async (asset) => {
      let fileUrl = asset.fileUrl;
      
      // If it's a Dropbox path, get a fresh shared link
      if (asset.dropboxPath && dropboxService.isConfigured()) {
        try {
          const sharedLink = await dropboxService.getSharedLink(asset.dropboxPath);
          fileUrl = sharedLink.replace('?dl=0', '?raw=1');
        } catch (e) {
          // Use existing URL or try thumbnail
          if (asset.fileUrl?.startsWith('dropbox://')) {
            try {
              const thumbnail = await dropboxService.getThumbnail(asset.dropboxPath);
              if (thumbnail) {
                fileUrl = `data:image/jpeg;base64,${thumbnail.toString('base64')}`;
              }
            } catch {
              fileUrl = null;
            }
          }
        }
      }
      
      return {
        id: asset.id,
        fileUrl: fileUrl || asset.fileUrl,
        caption: asset.caption,
        takenAt: asset.createdAt,
        createdAt: asset.createdAt,
        gpsCoordinates: null,
        tags: asset.tags,
        source: 'asset',
        fileName: asset.fileName,
        dropboxPath: asset.dropboxPath
      };
    }));

    // Combine and dedupe (prefer update photos over assets if same file)
    const seenUrls = new Set<string>();
    const allPhotos = [...updatePhotos, ...assetPhotos].filter(photo => {
      if (!photo.fileUrl) return false;
      if (seenUrls.has(photo.fileUrl)) return false;
      seenUrls.add(photo.fileUrl);
      return true;
    });

    // Sort by date
    allPhotos.sort((a, b) => {
      const dateA = new Date(a.createdAt || 0).getTime();
      const dateB = new Date(b.createdAt || 0).getTime();
      return dateB - dateA;
    });

    return NextResponse.json({ photos: allPhotos }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching photos:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}

// Upload a new photo - with Dropbox integration
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = await verifyToken(request);
    if (!payload) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders });
    }

    const { id: projectId } = await params;
    const userId = payload.userId as string;

    // Get project info including Dropbox folder
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        dropboxFolder: true,
        orgId: true,
      }
    });

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404, headers: corsHeaders });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400, headers: corsHeaders });
    }

    // Parse form data
    const caption = formData.get('caption') as string || '';
    const gpsCoordinates = formData.get('gpsCoordinates') as string;
    const tags = formData.get('tags') as string;
    const roomArea = formData.get('roomArea') as string;
    const tradeCategory = formData.get('tradeCategory') as string;
    const annotationsData = formData.get('annotationsData') as string;
    const takenAtStr = formData.get('takenAt') as string;
    const takenAt = takenAtStr ? new Date(takenAtStr) : new Date();

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    let dropboxPath: string | null = null;
    let fileUrl: string;

    // Upload to Dropbox if configured and project has dropbox folder
    if (dropboxService.isConfigured() && project.dropboxFolder) {
      try {
        console.log('[Mobile API] Uploading to Dropbox...');
        const result = await dropboxService.uploadSurveyPhoto(
          project.dropboxFolder,
          takenAt,
          fileBuffer,
          file.name
        );
        dropboxPath = result.path;
        
        // Try to get a shared link for the file
        try {
          const sharedLink = await dropboxService.getSharedLink(dropboxPath);
          // Convert shared link to direct download link
          fileUrl = sharedLink.replace('?dl=0', '?raw=1');
        } catch {
          // If we can't get a shared link, use the dropbox path as reference
          fileUrl = `dropbox://${dropboxPath}`;
        }
        
        console.log('[Mobile API] Uploaded to Dropbox:', dropboxPath);
      } catch (error) {
        console.error('[Mobile API] Dropbox upload failed:', error);
        // Fall back to base64 storage
        const base64 = fileBuffer.toString('base64');
        fileUrl = `data:${file.type};base64,${base64}`;
      }
    } else {
      // No Dropbox configured - store as base64
      const base64 = fileBuffer.toString('base64');
      fileUrl = `data:${file.type};base64,${base64}`;
    }

    // Get or create today's site survey update
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let update = await prisma.projectUpdate.findFirst({
      where: { 
        projectId, 
        type: 'SITE_SURVEY', 
        createdAt: { gte: today } 
      }
    });

    if (!update) {
      update = await prisma.projectUpdate.create({
        data: {
          projectId,
          type: 'SITE_SURVEY',
          title: `Mobile Site Survey - ${new Date().toLocaleDateString()}`,
          content: 'Photos captured from ResidentOne Mobile app',
          status: 'IN_PROGRESS',
          visibility: 'TEAM',
          createdById: userId
        }
      });
    }

    // Create the photo record
    const photo = await prisma.projectUpdatePhoto.create({
      data: {
        updateId: update.id,
        fileUrl,
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        caption: caption || null,
        gpsCoordinates: gpsCoordinates ? JSON.parse(gpsCoordinates) : null,
        takenAt,
        tags: tags ? JSON.parse(tags) : [],
        roomArea: roomArea || null,
        tradeCategory: tradeCategory || null,
        annotationsData: annotationsData ? JSON.parse(annotationsData) : null,
        uploadedById: userId
      }
    });

    // Also create an Asset record so it shows in the project's assets
    try {
      await prisma.asset.create({
        data: {
          projectId,
          type: 'IMAGE',
          name: file.name,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          fileUrl,
          dropboxPath,
          caption,
          tags: tags ? JSON.parse(tags) : [],
          uploadedById: userId
        }
      });
    } catch (assetError) {
      console.error('[Mobile API] Failed to create asset record:', assetError);
      // Continue even if asset creation fails
    }

    return NextResponse.json({ 
      success: true, 
      photo,
      updateId: update.id,
      dropboxPath,
      message: dropboxPath ? 'Photo uploaded to Dropbox and database' : 'Photo saved to database'
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error uploading photo:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: corsHeaders });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 200, headers: corsHeaders });
}
