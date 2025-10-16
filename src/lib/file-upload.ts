import { createReadStream } from 'fs'
import { v4 as uuidv4 } from 'uuid'

// Types for file upload and processing
export interface UploadResult {
  id: string
  url: string
  thumbnailUrl?: string
  filename: string
  originalName: string
  size: number
  mimeType: string
  metadata?: {
    width?: number
    height?: number
    gpsCoordinates?: { lat: number; lng: number }
    exif?: Record<string, any>
  }
}

export interface ProcessingOptions {
  generateThumbnail?: boolean
  extractGPS?: boolean
  extractEXIF?: boolean
  optimize?: boolean
  maxWidth?: number
  maxHeight?: number
  quality?: number
}

// Mock S3-compatible storage interface
class FileStorage {
  private baseUrl = process.env.NEXT_PUBLIC_CDN_URL || 'https://cdn.example.com'
  
  async uploadFile(
    buffer: Buffer, 
    filename: string, 
    mimeType: string,
    options: { 
      bucket?: string
      folder?: string
      metadata?: Record<string, string>
    } = {}
  ): Promise<string> {
    // In production, this would upload to S3/R2/etc.
    // For now, return a mock URL
    const fileId = uuidv4()
    const extension = filename.split('.').pop()
    const folder = options.folder ? `${options.folder}/` : ''
    const url = `${this.baseUrl}/${folder}${fileId}.${extension}`
    
    console.log(`Mock upload: ${filename} (${buffer.length} bytes) -> ${url}`)
    
    // Simulate upload delay
    await new Promise(resolve => setTimeout(resolve, 100))
    
    return url
  }

  async deleteFile(url: string): Promise<void> {
    console.log(`Mock delete: ${url}`)
    // In production, this would delete from S3/R2/etc.
  }
}

// Image processing utilities
class ImageProcessor {
  async processImage(
    buffer: Buffer, 
    options: ProcessingOptions = {}
  ): Promise<{
    processedBuffer: Buffer
    thumbnail?: Buffer
    metadata: {
      width: number
      height: number
      gpsCoordinates?: { lat: number; lng: number }
      exif?: Record<string, any>
    }
  }> {
    // Mock image processing
    // In production, this would use Sharp, Canvas, or similar
    
    const metadata = {
      width: 1920,
      height: 1080,
      gpsCoordinates: options.extractGPS ? this.extractGPS(buffer) : undefined,
      exif: options.extractEXIF ? this.extractEXIF(buffer) : undefined
    }

    // Mock thumbnail generation
    let thumbnail: Buffer | undefined
    if (options.generateThumbnail) {
      thumbnail = this.generateThumbnail(buffer)
    }

    // Mock optimization
    let processedBuffer = buffer
    if (options.optimize) {
      processedBuffer = this.optimizeImage(buffer, options)
    }

    return {
      processedBuffer,
      thumbnail,
      metadata
    }
  }

  private extractGPS(buffer: Buffer): { lat: number; lng: number } | undefined {
    // Mock GPS extraction from EXIF data
    // In production, this would use exif-parser or similar
    if (Math.random() > 0.5) {
      return {
        lat: 40.7128 + (Math.random() - 0.5) * 0.1,
        lng: -74.0060 + (Math.random() - 0.5) * 0.1
      }
    }
    return undefined
  }

  private extractEXIF(buffer: Buffer): Record<string, any> {
    // Mock EXIF extraction
    // In production, this would extract actual EXIF data
    return {
      camera: 'iPhone 14 Pro',
      focalLength: '24mm',
      aperture: 'f/1.78',
      iso: 125,
      shutterSpeed: '1/60',
      timestamp: new Date().toISOString()
    }
  }

  private generateThumbnail(buffer: Buffer): Buffer {
    // Mock thumbnail generation
    // In production, this would use Sharp to resize to 300x300
    return buffer // Return original for mock
  }

  private optimizeImage(buffer: Buffer, options: ProcessingOptions): Buffer {
    // Mock image optimization
    // In production, this would compress and resize using Sharp
    console.log(`Mock optimization: quality=${options.quality}, maxWidth=${options.maxWidth}`)
    return buffer
  }
}

// AI Image Analysis (mock implementation)
class ImageAnalyzer {
  async analyzeImage(buffer: Buffer, filename: string): Promise<{
    detectedObjects: string[]
    suggestedTags: string[]
    roomType?: string
    tradeCategory?: string
    qualityScore: number
    issues: string[]
    confidence: number
  }> {
    // Mock AI analysis
    // In production, this would use AWS Rekognition, Google Vision, or similar
    
    await new Promise(resolve => setTimeout(resolve, 500)) // Simulate API delay
    
    const mockResults = [
      {
        detectedObjects: ['electrical_outlet', 'wall', 'switch_plate'],
        suggestedTags: ['electrical', 'outlets', 'installation'],
        roomType: 'kitchen',
        tradeCategory: 'electrical',
        qualityScore: 0.92,
        issues: [],
        confidence: 0.95
      },
      {
        detectedObjects: ['plumbing', 'pipe', 'toilet', 'vanity'],
        suggestedTags: ['plumbing', 'bathroom', 'fixtures'],
        roomType: 'bathroom',
        tradeCategory: 'plumbing',
        qualityScore: 0.87,
        issues: ['blurry_image'],
        confidence: 0.83
      },
      {
        detectedObjects: ['drywall', 'paint', 'ceiling', 'trim'],
        suggestedTags: ['drywall', 'painting', 'finishing'],
        roomType: 'living_room',
        tradeCategory: 'painting',
        qualityScore: 0.95,
        issues: [],
        confidence: 0.91
      }
    ]

    // Return random result for demo
    const result = mockResults[Math.floor(Math.random() * mockResults.length)]
    
    // Adjust based on filename
    if (filename.toLowerCase().includes('kitchen')) {
      result.roomType = 'kitchen'
      result.tradeCategory = 'electrical'
    } else if (filename.toLowerCase().includes('bathroom')) {
      result.roomType = 'bathroom'
      result.tradeCategory = 'plumbing'
    }

    return result
  }
}

// Main file upload service
export class FileUploadService {
  private storage = new FileStorage()
  private imageProcessor = new ImageProcessor()
  private imageAnalyzer = new ImageAnalyzer()

  async uploadImage(
    file: File | Buffer,
    options: ProcessingOptions & {
      folder?: string
      filename?: string
      runAIAnalysis?: boolean
    } = {}
  ): Promise<UploadResult & { aiAnalysis?: any }> {
    let buffer: Buffer
    let originalName: string
    let mimeType: string

    if (file instanceof File) {
      buffer = Buffer.from(await file.arrayBuffer())
      originalName = file.name
      mimeType = file.type
    } else {
      buffer = file
      originalName = options.filename || 'upload.jpg'
      mimeType = 'image/jpeg'
    }

    // Process image
    const processed = await this.imageProcessor.processImage(buffer, {
      generateThumbnail: true,
      extractGPS: true,
      extractEXIF: true,
      optimize: true,
      maxWidth: 2048,
      quality: 85,
      ...options
    })

    // Generate unique filename
    const fileId = uuidv4()
    const extension = originalName.split('.').pop()
    const filename = `${fileId}.${extension}`

    // Upload main image
    const url = await this.storage.uploadFile(
      processed.processedBuffer, 
      filename, 
      mimeType,
      { 
        folder: options.folder || 'project-updates',
        metadata: {
          originalName,
          width: processed.metadata.width.toString(),
          height: processed.metadata.height.toString()
        }
      }
    )

    // Upload thumbnail if generated
    let thumbnailUrl: string | undefined
    if (processed.thumbnail) {
      const thumbnailFilename = `${fileId}_thumb.${extension}`
      thumbnailUrl = await this.storage.uploadFile(
        processed.thumbnail,
        thumbnailFilename,
        mimeType,
        { 
          folder: `${options.folder || 'project-updates'}/thumbnails`
        }
      )
    }

    // Run AI analysis if requested
    let aiAnalysis
    if (options.runAIAnalysis) {
      try {
        aiAnalysis = await this.imageAnalyzer.analyzeImage(buffer, originalName)
      } catch (error) {
        console.warn('AI analysis failed:', error)
        aiAnalysis = {
          detectedObjects: [],
          suggestedTags: [],
          qualityScore: 0.5,
          issues: ['analysis_failed'],
          confidence: 0
        }
      }
    }

    return {
      id: fileId,
      url,
      thumbnailUrl,
      filename,
      originalName,
      size: buffer.length,
      mimeType,
      metadata: processed.metadata,
      aiAnalysis
    }
  }

  async uploadDocument(
    file: File | Buffer,
    options: {
      folder?: string
      filename?: string
    } = {}
  ): Promise<UploadResult> {
    let buffer: Buffer
    let originalName: string
    let mimeType: string

    if (file instanceof File) {
      buffer = Buffer.from(await file.arrayBuffer())
      originalName = file.name
      mimeType = file.type
    } else {
      buffer = file
      originalName = options.filename || 'document.pdf'
      mimeType = 'application/pdf'
    }

    // Generate unique filename
    const fileId = uuidv4()
    const extension = originalName.split('.').pop()
    const filename = `${fileId}.${extension}`

    // Upload document
    const url = await this.storage.uploadFile(
      buffer, 
      filename, 
      mimeType,
      { 
        folder: options.folder || 'project-documents',
        metadata: {
          originalName,
          size: buffer.length.toString()
        }
      }
    )

    return {
      id: fileId,
      url,
      filename,
      originalName,
      size: buffer.length,
      mimeType
    }
  }

  async deleteFile(url: string): Promise<void> {
    await this.storage.deleteFile(url)
  }

  // Utility to validate file types
  static validateImageFile(file: File): { valid: boolean; error?: string } {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic']
    const maxSize = 10 * 1024 * 1024 // 10MB

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Invalid file type. Only JPEG, PNG, WebP, and HEIC images are allowed.'
      }
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'File size too large. Maximum size is 10MB.'
      }
    }

    return { valid: true }
  }

  static validateDocumentFile(file: File): { valid: boolean; error?: string } {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
    const maxSize = 25 * 1024 * 1024 // 25MB

    if (!allowedTypes.includes(file.type)) {
      return {
        valid: false,
        error: 'Invalid file type. Only PDF and Word documents are allowed.'
      }
    }

    if (file.size > maxSize) {
      return {
        valid: false,
        error: 'File size too large. Maximum size is 25MB.'
      }
    }

    return { valid: true }
  }
}

// Export singleton instance
export const fileUploadService = new FileUploadService()

// Utility functions for client-side usage
export async function uploadProjectImage(
  file: File,
  projectId: string,
  options: ProcessingOptions = {}
): Promise<UploadResult & { aiAnalysis?: any }> {
  const validation = FileUploadService.validateImageFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  return fileUploadService.uploadImage(file, {
    folder: `projects/${projectId}/images`,
    runAIAnalysis: true,
    ...options
  })
}

export async function uploadProjectDocument(
  file: File,
  projectId: string
): Promise<UploadResult> {
  const validation = FileUploadService.validateDocumentFile(file)
  if (!validation.valid) {
    throw new Error(validation.error)
  }

  return fileUploadService.uploadDocument(file, {
    folder: `projects/${projectId}/documents`
  })
}