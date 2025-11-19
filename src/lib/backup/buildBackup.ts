import { prisma } from '@/lib/prisma'
import { dropboxService } from '@/lib/dropbox-service'
import pLimit from 'p-limit'

// Logger interface for progress tracking
export interface BackupLogger {
  onStart?: (meta: { totalAssets: number; totalTables: number }) => void
  onFileStart?: (file: { path: string; size: number }) => void
  onFileSuccess?: (file: { path: string; size: number; attempt: number; durationMs: number }) => void
  onFileFail?: (file: { path: string; attempt: number; error: string }) => void
  onFileSkip?: (file: { path: string; reason: string }) => void
  onProgress?: (progress: { completed: number; total: number; percentage: number }) => void
  onComplete?: (summary: BackupSummary) => void
  log?: (message: string) => void
}

export interface BackupOptions {
  mode?: 'cron' | 'preferences'
  concurrency?: number
  maxFileSize?: number // in bytes, default 50MB
  fileTimeout?: number // in milliseconds, default 30s
  maxRetries?: number // default 3
  logger?: BackupLogger
}

export interface BackupSummary {
  backupId: string
  startedAt: string
  finishedAt: string
  durationMs: number
  totalAssets: number
  successCount: number
  failedCount: number
  skippedCount: number
  totalBytes: number
  status: 'success' | 'degraded' | 'failed'
  failedFiles: Array<{
    path: string
    attempts: number
    lastError: string
    lastStatusCode?: number
  }>
  skippedFiles: Array<{
    path: string
    reason: string
    size?: number
  }>
}

export interface BackupResult {
  metadata: {
    timestamp: string
    version: string
    backupId: string
    description: string
    mode: string
    includes_passwords: boolean
    includes_files: boolean
    auto_discovered: boolean
  }
  data: Record<string, any[]>
  files: Record<string, string> // assetId -> base64 file data
  summary: BackupSummary
}

// Helper to sleep for exponential backoff
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Helper to add jitter to backoff
const jitter = (ms: number) => ms + Math.random() * 1000

// Download a single file with retries
async function downloadFileWithRetry(
  url: string,
  assetId: string,
  options: Required<Pick<BackupOptions, 'maxFileSize' | 'fileTimeout' | 'maxRetries'>>,
  logger?: BackupLogger
): Promise<{ success: boolean; data?: string; error?: string; attempts: number; statusCode?: number }> {
  let lastError = ''
  let lastStatusCode: number | undefined
  
  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), options.fileTimeout)
      
      let buffer: Buffer
      let mimeType = 'application/octet-stream'
      
      // Check if this is a Dropbox path or an HTTP URL
      const isDropboxPath = url.startsWith('/') || url.toLowerCase().includes('dropbox')
      
      if (isDropboxPath) {
        // Download from Dropbox
        buffer = await dropboxService.downloadFile(url)
        
        // Infer MIME type from file extension
        const extension = url.split('.').pop()?.toLowerCase()
        const mimeTypes: Record<string, string> = {
          'jpg': 'image/jpeg',
          'jpeg': 'image/jpeg',
          'png': 'image/png',
          'gif': 'image/gif',
          'webp': 'image/webp',
          'pdf': 'application/pdf',
          'svg': 'image/svg+xml'
        }
        mimeType = mimeTypes[extension || ''] || 'application/octet-stream'
      } else {
        // Download from HTTP URL
        const response = await fetch(url, {
          method: 'GET',
          signal: controller.signal,
          headers: {
            'User-Agent': 'ResidentOne-Backup-System/3.0'
          }
        })
        
        clearTimeout(timeoutId)
        
        if (!response.ok) {
          lastStatusCode = response.status
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        
        const arrayBuffer = await response.arrayBuffer()
        buffer = Buffer.from(arrayBuffer)
        mimeType = response.headers.get('content-type') || 'application/octet-stream'
      }
      
      clearTimeout(timeoutId)
      
      // Check buffer size
      if (buffer.length > options.maxFileSize) {
        return {
          success: false,
          error: `File too large (${(buffer.length / 1024 / 1024).toFixed(2)}MB > ${options.maxFileSize / 1024 / 1024}MB)`,
          attempts: attempt
        }
      }
      
      // Convert to base64 and store with metadata
      const base64 = buffer.toString('base64')
      const fileData = {
        content: base64,
        originalUrl: url,
        mimeType,
        size: buffer.length,
        downloadedAt: new Date().toISOString()
      }
      
      return {
        success: true,
        data: JSON.stringify(fileData),
        attempts: attempt
      }
      
    } catch (error: any) {
      lastError = error.message || String(error)
      
      // Check if this is a retryable error
      const isRetryable = 
        lastError.includes('timeout') ||
        lastError.includes('ECONNRESET') ||
        lastError.includes('ETIMEDOUT') ||
        lastStatusCode === 429 ||
        (lastStatusCode && lastStatusCode >= 500)
      
      if (attempt < options.maxRetries && isRetryable) {
        // Exponential backoff with jitter
        const backoffMs = jitter(Math.pow(2, attempt - 1) * 500)
        logger?.log?.(`Retry ${attempt}/${options.maxRetries} for ${assetId} after ${backoffMs}ms (${lastError})`)
        await sleep(backoffMs)
        continue
      }
      
      return {
        success: false,
        error: lastError,
        attempts: attempt,
        statusCode: lastStatusCode
      }
    }
  }
  
  return {
    success: false,
    error: lastError,
    attempts: options.maxRetries,
    statusCode: lastStatusCode
  }
}

// List all assets from database
export async function listAllAssets(): Promise<Array<{ id: string; filename: string; url: string; size: number | null }>> {
  const assets = await prisma.asset.findMany({
    select: {
      id: true,
      filename: true,
      url: true,
      size: true
    },
    where: {
      url: {
        not: null
      }
    },
    orderBy: { createdAt: 'asc' }
  })
  
  return assets.filter(a => a.url) as Array<{ id: string; filename: string; url: string; size: number | null }>
}

// Main backup builder
export async function buildFullBackup(options: BackupOptions = {}): Promise<BackupResult> {
  const backupId = `backup-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const startTime = Date.now()
  const startedAt = new Date().toISOString()
  
  const opts = {
    mode: options.mode || 'manual',
    concurrency: parseInt(process.env.DROPBOX_CONCURRENCY || '20') || options.concurrency || 20,
    maxFileSize: options.maxFileSize || 50 * 1024 * 1024, // 50MB
    fileTimeout: options.fileTimeout || 30000, // 30s
    maxRetries: options.maxRetries || 3,
    logger: options.logger
  }
  
  const logger = opts.logger
  
  logger?.log?.(`[${backupId}] Starting backup in ${opts.mode} mode`)
  logger?.log?.(`[${backupId}] Concurrency: ${opts.concurrency}, Max file size: ${opts.maxFileSize / 1024 / 1024}MB, Timeout: ${opts.fileTimeout}ms`)
  
  // 1. Export all database tables
  logger?.log?.(`[${backupId}] Exporting database tables...`)
  const modelNames = Object.keys(prisma).filter(
    key => !key.startsWith('_') && !key.startsWith('$') && typeof (prisma as any)[key] === 'object'
  )
  
  const data: Record<string, any[]> = {}
  
  for (const modelName of modelNames) {
    try {
      data[modelName] = await (prisma as any)[modelName].findMany()
      logger?.log?.(`[${backupId}] ✅ ${modelName}: ${data[modelName].length} records`)
    } catch (error) {
      logger?.log?.(`[${backupId}] ⚠️ Could not backup ${modelName}: ${error}`)
      data[modelName] = []
    }
  }
  
  // 2. List all assets
  const assets = await listAllAssets()
  logger?.onStart?.({ totalAssets: assets.length, totalTables: modelNames.length })
  logger?.log?.(`[${backupId}] Found ${assets.length} assets to download`)
  
  // 3. Download files with concurrency control
  const files: Record<string, string> = {}
  const summary: BackupSummary = {
    backupId,
    startedAt,
    finishedAt: '',
    durationMs: 0,
    totalAssets: assets.length,
    successCount: 0,
    failedCount: 0,
    skippedCount: 0,
    totalBytes: 0,
    status: 'success',
    failedFiles: [],
    skippedFiles: []
  }
  
  // Create concurrency limiter
  const limit = pLimit(opts.concurrency)
  let completed = 0
  
  const downloadPromises = assets.map(asset => 
    limit(async () => {
      // Skip if file too large (pre-check)
      if (asset.size && asset.size > opts.maxFileSize) {
        summary.skippedCount++
        summary.skippedFiles.push({
          path: asset.url,
          reason: 'over_limit',
          size: asset.size
        })
        logger?.onFileSkip?.({ path: asset.url, reason: `File too large (${(asset.size / 1024 / 1024).toFixed(2)}MB)` })
        completed++
        logger?.onProgress?.({ completed, total: assets.length, percentage: Math.round((completed / assets.length) * 100) })
        return
      }
      
      logger?.onFileStart?.({ path: asset.url, size: asset.size || 0 })
      const fileStartTime = Date.now()
      
      const result = await downloadFileWithRetry(
        asset.url,
        asset.id,
        {
          maxFileSize: opts.maxFileSize,
          fileTimeout: opts.fileTimeout,
          maxRetries: opts.maxRetries
        },
        logger
      )
      
      const durationMs = Date.now() - fileStartTime
      
      if (result.success && result.data) {
        files[asset.id] = result.data
        summary.successCount++
        const fileSize = JSON.parse(result.data).size
        summary.totalBytes += fileSize
        logger?.onFileSuccess?.({ path: asset.url, size: fileSize, attempt: result.attempts, durationMs })
      } else {
        summary.failedCount++
        summary.failedFiles.push({
          path: asset.url,
          attempts: result.attempts,
          lastError: result.error || 'Unknown error',
          lastStatusCode: result.statusCode
        })
        logger?.onFileFail?.({ path: asset.url, attempt: result.attempts, error: result.error || 'Unknown error' })
      }
      
      completed++
      logger?.onProgress?.({ completed, total: assets.length, percentage: Math.round((completed / assets.length) * 100) })
    })
  )
  
  // Wait for all downloads
  await Promise.all(downloadPromises)
  
  // 4. Finalize summary
  const finishedAt = new Date().toISOString()
  const durationMs = Date.now() - startTime
  
  summary.finishedAt = finishedAt
  summary.durationMs = durationMs
  
  // Determine status
  if (summary.failedCount === 0) {
    summary.status = 'success'
  } else if (summary.successCount > 0) {
    summary.status = 'degraded'
  } else {
    summary.status = 'failed'
  }
  
  logger?.onComplete?.(summary)
  logger?.log?.(`[${backupId}] Backup completed: ${summary.successCount}/${summary.totalAssets} files (${summary.failedCount} failed, ${summary.skippedCount} skipped)`)
  logger?.log?.(`[${backupId}] Total size: ${(summary.totalBytes / 1024 / 1024).toFixed(2)}MB, Duration: ${(durationMs / 1000).toFixed(1)}s`)
  
  // 5. Build final result
  const totalRecords = Object.values(data).reduce((total, table) => total + (Array.isArray(table) ? table.length : 0), 0)
  
  const result: BackupResult = {
    metadata: {
      timestamp: startedAt,
      version: '3.0',
      backupId,
      description: `ResidentOne Workflow ${opts.mode} backup (COMPLETE with files)`,
      mode: opts.mode,
      includes_passwords: true,
      includes_files: true,
      auto_discovered: true
    },
    data,
    files,
    summary
  }
  
  return result
}
