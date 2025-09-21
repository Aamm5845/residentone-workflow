import { put, del, list, head } from "@vercel/blob"

export interface UploadOptions {
  filename?: string
  contentType?: string
  metadata?: Record<string, string>
}

export interface UploadResult {
  url: string
  pathname: string
  contentType?: string
  contentDisposition?: string
  size: number
}

/**
 * Upload a file to Vercel Blob Storage
 */
export async function uploadFile(
  file: any, // Using `any` to allow Buffer, Uint8Array, File, string
  path: string,
  options: UploadOptions = {}
): Promise<UploadResult> {
  try {
    const result = await put(path, file, {
      access: "public",
      contentType: options.contentType,
      ...(options.metadata && { addRandomSuffix: false }),
    })

    // 🔎 Calculate size manually since PutBlobResult has no size property
    let size = 0
    if (file instanceof Buffer || file instanceof Uint8Array) {
      size = file.length
    } else if (typeof file === "string") {
      size = Buffer.byteLength(file)
    } else if (typeof File !== "undefined" && file instanceof File) {
      size = file.size
    }

    return {
      url: result.url,
      pathname: result.pathname,
      contentType: result.contentType,
      contentDisposition: result.contentDisposition,
      size,
    }
  } catch (error: any) {
    let responseText: string | null = null

    if (error?.response && typeof error.response.text === "function") {
      try {
        responseText = await error.response.text()
      } catch (_) {
        responseText = null
      }
    }

    console.error("Blob upload error:", {
      message: error?.message,
      name: error?.name,
      stack: error?.stack,
      response: responseText,
    })

    throw new Error("Failed to upload file to blob storage")
  }
}

/**
 * Delete a file from Vercel Blob Storage
 */
export async function deleteFile(url: string): Promise<void> {
  try {
    await del(url)
  } catch (error) {
    console.error("Blob delete error:", error)
    throw new Error("Failed to delete file from blob storage")
  }
}

/**
 * List files in a directory
 */
export async function listFiles(prefix?: string, limit?: number): Promise<any[]> {
  try {
    const result = await list({ prefix, limit })
    return result.blobs
  } catch (error) {
    console.error("Blob list error:", error)
    throw new Error("Failed to list files from blob storage")
  }
}

/**
 * Get file metadata
 */
export async function getFileInfo(url: string): Promise<any> {
  try {
    const result = await head(url)
    return result
  } catch (error) {
    console.error("Blob head error:", error)
    throw new Error("Failed to get file info from blob storage")
  }
}

/**
 * Generate a structured file path for the organization
 */
export function generateFilePath(
  orgId: string,
  projectId: string,
  roomId?: string,
  sectionId?: string,
  filename?: string
): string {
  const timestamp = Date.now()
  const sanitizedFilename = filename?.replace(/[^a-zA-Z0-9.-]/g, "_") || "file"

  let path = `orgs/${orgId}/projects/${projectId}`

  if (roomId) {
    path += `/rooms/${roomId}`
  }

  if (sectionId) {
    path += `/sections/${sectionId}`
  }

  path += `/${timestamp}-${sanitizedFilename}`

  return path
}

/**
 * Generate a user-specific file path
 */
export function generateUserFilePath(
  orgId: string,
  userId: string,
  filename: string,
  folder?: string
): string {
  const timestamp = Date.now()
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9.-]/g, "_")

  let path = `orgs/${orgId}/users/${userId}`

  if (folder) {
    path += `/${folder}`
  }

  path += `/${timestamp}-${sanitizedFilename}`

  return path
}

/**
 * Extract file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".")
  return lastDot > 0 ? filename.substring(lastDot) : ""
}

/**
 * Generate a content type from filename
 */
export function getContentType(filename: string): string {
  const ext = getFileExtension(filename).toLowerCase()

  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf",
    ".txt": "text/plain",
    ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xls": "application/vnd.ms-excel",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  }

  return mimeTypes[ext] || "application/octet-stream"
}

/**
 * Check if Vercel Blob is properly configured
 */
export function isBlobConfigured(): boolean {
  const hasToken = !!process.env.BLOB_READ_WRITE_TOKEN

  // In production, blob storage is required
  if (process.env.NODE_ENV === "production" && !hasToken) {
    throw new Error("BLOB_READ_WRITE_TOKEN is required in production environment")
  }

  return hasToken
}

/**
 * Format file size in human readable format
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"]
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
}
