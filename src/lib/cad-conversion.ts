import { put, head } from '@vercel/blob'
import CloudConvert from 'cloudconvert'
import crypto from 'crypto'

interface ConversionResult {
  success: boolean
  pdfUrl?: string
  error?: string
  cached?: boolean
  cost?: number
}

interface ConversionProgress {
  status: 'queued' | 'processing' | 'completed' | 'failed'
  progress: number
  message?: string
}

class CADConversionService {
  private cloudConvert: CloudConvert | null = null

  private getCloudConvert() {
    if (!this.cloudConvert) {
      if (!process.env.CLOUDCONVERT_API_KEY) {
        throw new Error('CLOUDCONVERT_API_KEY environment variable is required')
      }
      
      this.cloudConvert = new CloudConvert(process.env.CLOUDCONVERT_API_KEY, {
        sandbox: process.env.CLOUDCONVERT_SANDBOX === 'true'
      })
    }
    return this.cloudConvert
  }

  /**
   * Generate a unique cache key for a CAD file conversion
   */
  private generateCacheKey(dropboxPath: string, revision: string): string {
    const hash = crypto.createHash('sha256')
    hash.update(`${dropboxPath}:${revision}`)
    return hash.digest('hex')
  }

  /**
   * Check if converted PDF exists in cache
   */
  private async checkCache(cacheKey: string): Promise<string | null> {
    try {
      const cacheUrl = `https://${process.env.BLOB_READ_WRITE_TOKEN?.split('_')[1]}.public.blob.vercel-storage.com/specbooks/cache/${cacheKey}.pdf`
      
      // Check if blob exists
      const response = await head(cacheUrl)
      if (response.url) {
        return cacheUrl
      }
      return null
    } catch (error) {
      return null
    }
  }

  /**
   * Store converted PDF in cache
   */
  private async storeInCache(cacheKey: string, pdfBuffer: Buffer): Promise<string> {
    const blob = await put(`specbooks/cache/${cacheKey}.pdf`, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf'
    })
    return blob.url
  }

  /**
   * Convert CAD file to PDF with caching
   */
  async convertCADToPDF(
    dropboxPath: string, 
    revision: string,
    fileBuffer: Buffer,
    onProgress?: (progress: ConversionProgress) => void
  ): Promise<ConversionResult> {
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(dropboxPath, revision)
      const cachedUrl = await this.checkCache(cacheKey)
      
      if (cachedUrl) {
        onProgress?.({ status: 'completed', progress: 100, message: 'Using cached PDF' })
        return {
          success: true,
          pdfUrl: cachedUrl,
          cached: true,
          cost: 0
        }
      }

      onProgress?.({ status: 'queued', progress: 10, message: 'Starting conversion...' })

      // Create CloudConvert job
      const job = await this.getCloudConvert().jobs.create({
        tasks: {
          'import-file': {
            operation: 'import/upload',
            file: fileBuffer,
            filename: dropboxPath.split('/').pop() || 'drawing.dwg'
          },
          'convert-to-pdf': {
            operation: 'convert',
            input: 'import-file',
            output_format: 'pdf',
            some_other_option: 'value'
          },
          'export-pdf': {
            operation: 'export/url',
            input: 'convert-to-pdf'
          }
        }
      })

      onProgress?.({ status: 'processing', progress: 30, message: 'Converting CAD file...' })

      // Wait for job completion
      const finishedJob = await this.getCloudConvert().jobs.wait(job.id)
      
      onProgress?.({ status: 'processing', progress: 80, message: 'Finalizing PDF...' })

      // Get the export task
      const exportTask = finishedJob.tasks?.find(task => task.name === 'export-pdf')
      if (!exportTask?.result?.files?.[0]?.url) {
        throw new Error('No output file URL found')
      }

      // Download the converted PDF
      const pdfResponse = await fetch(exportTask.result.files[0].url)
      if (!pdfResponse.ok) {
        throw new Error('Failed to download converted PDF')
      }

      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer())

      // Store in cache
      const cachedPdfUrl = await this.storeInCache(cacheKey, pdfBuffer)

      onProgress?.({ status: 'completed', progress: 100, message: 'Conversion completed' })

      // Calculate approximate cost (CloudConvert pricing: ~$0.008 per conversion)
      const estimatedCost = 0.008

      return {
        success: true,
        pdfUrl: cachedPdfUrl,
        cached: false,
        cost: estimatedCost
      }

    } catch (error) {
      console.error('CAD conversion error:', error)
      onProgress?.({ status: 'failed', progress: 0, message: error instanceof Error ? error.message : 'Unknown error' })
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown conversion error'
      }
    }
  }

  /**
   * Estimate conversion cost for multiple files
   */
  estimateConversionCost(fileCount: number, cachedCount: number = 0): number {
    const conversionsNeeded = fileCount - cachedCount
    return conversionsNeeded * 0.008 // $0.008 per conversion
  }
}

export const cadConversionService = new CADConversionService()
export type { ConversionResult, ConversionProgress }