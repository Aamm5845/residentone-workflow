import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// AWS S3 Configuration
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || ''
  }
})

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'interior-design-files'
const CDN_URL = process.env.AWS_CLOUDFRONT_URL // Optional CloudFront CDN

export interface UploadResult {
  key: string
  url: string
  cdnUrl?: string
}

/**
 * Upload file to AWS S3
 */
export async function uploadToS3(
  file: File,
  key: string,
  options: {
    contentType?: string
    metadata?: Record<string, string>
  } = {}
): Promise<UploadResult> {
  try {
    const buffer = await file.arrayBuffer()
    
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: Buffer.from(buffer),
      ContentType: options.contentType || file.type,
      Metadata: options.metadata,
      // Security settings
      ServerSideEncryption: 'AES256',
      // Cache control for images
      CacheControl: file.type.startsWith('image/') ? 'max-age=31536000' : 'max-age=86400'
    })

    await s3Client.send(command)

    const url = `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`
    const cdnUrl = CDN_URL ? `${CDN_URL}/${key}` : undefined

    return {
      key,
      url,
      cdnUrl
    }
  } catch (error) {
    console.error('S3 upload error:', error)
    throw new Error('Failed to upload file to cloud storage')
  }
}

/**
 * Generate a presigned URL for secure downloads
 */
export async function getDownloadUrl(key: string, expiresIn: number = 3600): Promise<string> {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    })

    return await getSignedUrl(s3Client, command, { expiresIn })
  } catch (error) {
    console.error('Error generating download URL:', error)
    throw new Error('Failed to generate download URL')
  }
}

/**
 * Delete file from S3
 */
export async function deleteFromS3(key: string): Promise<void> {
  try {
    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: key
    })

    await s3Client.send(command)
  } catch (error) {
    console.error('S3 delete error:', error)
    throw new Error('Failed to delete file from cloud storage')
  }
}

/**
 * Generate file key with proper organization
 */
export function generateFileKey(
  projectId: string,
  roomId: string,
  sectionId: string,
  fileName: string
): string {
  const timestamp = new Date().toISOString().split('T')[0]
  const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_')
  
  return `projects/${projectId}/rooms/${roomId}/sections/${sectionId}/${timestamp}/${sanitizedFileName}`
}

/**
 * Check if cloud storage is configured
 */
export function isCloudStorageConfigured(): boolean {
  return !!(
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET
  )
}