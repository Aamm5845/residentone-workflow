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

  private getApiKey() {
    if (!process.env.CLOUDCONVERT_API_KEY) {
      throw new Error('CLOUDCONVERT_API_KEY environment variable is required')
    }
    return process.env.CLOUDCONVERT_API_KEY
  }

  private async makeApiRequest(endpoint: string, method: string = 'GET', body?: any) {
    const apiKey = this.getApiKey()
    const url = `https://api.cloudconvert.com/v2${endpoint}`
    
    console.log('[CloudConvert] Making request to:', url)
    
    const response = await fetch(url, {
      method,
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    })
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error('[CloudConvert] API error:', {
        status: response.status,
        statusText: response.statusText,
        url: response.url,
        error: errorText
      })
      throw new Error(`CloudConvert API error: ${response.status} ${response.statusText}`)
    }
    
    return response.json()
  }

  /**
   * Validate CloudConvert API key
   */
  private async validateApiKey() {
    try {
      const cloudConvert = this.getCloudConvert()
      // Try to get user info to validate the API key
      await cloudConvert.users.me()
      console.log('[CloudConvert] API key validation successful')
    } catch (error) {
      console.error('[CloudConvert] API key validation failed:', error)
      console.error('[CloudConvert] This may cause conversion failures')
    }
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
    // Check if already cached first
    const existingUrl = await this.checkCache(cacheKey)
    if (existingUrl) {
      console.log('[CloudConvert] File already cached, returning existing URL')
      return existingUrl
    }
    
    const blob = await put(`specbooks/cache/${cacheKey}.pdf`, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf',
      addRandomSuffix: false  // Keep consistent filenames for caching
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

      try {
        console.log('[CloudConvert] Starting job creation...')
        
        // Create CloudConvert job using direct API
        const jobData = {
          tasks: {
            'import-file': {
              operation: 'import/upload'
            },
            'convert-to-pdf': {
              operation: 'convert',
              input: 'import-file',
              output_format: 'pdf',
              // Remove engine specification - let CloudConvert choose the best one
              fit_to_page: true, // Scale drawing to fit page
              background_color: 'white'
            },
            'export-pdf': {
              operation: 'export/url',
              input: 'convert-to-pdf'
            }
          }
        }
        
        const job = await this.makeApiRequest('/jobs', 'POST', jobData)
        console.log('[CloudConvert] Job created successfully:', job.data.id)
        
        // Now upload the file
        const importTask = job.data.tasks.find((task: any) => task.name === 'import-file')
        if (!importTask?.result?.form) {
          throw new Error('No upload form found in import task')
        }
        
        // Upload file to CloudConvert
        const formData = new FormData()
        Object.entries(importTask.result.form.parameters).forEach(([key, value]) => {
          formData.append(key, value as string)
        })
        formData.append('file', new Blob([fileBuffer]), dropboxPath.split('/').pop() || 'drawing.dwg')
        
        const uploadResponse = await fetch(importTask.result.form.url, {
          method: 'POST',
          body: formData
        })
        
        if (!uploadResponse.ok) {
          throw new Error(`File upload failed: ${uploadResponse.statusText}`)
        }
        
        onProgress?.({ status: 'processing', progress: 30, message: 'Converting CAD file...' })

        // Wait for job completion using polling
        let finishedJob
        let attempts = 0
        const maxAttempts = 60 // 5 minutes max
        
        do {
          await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
          finishedJob = await this.makeApiRequest(`/jobs/${job.data.id}`)
          attempts++
          
          if (finishedJob.data.status === 'error') {
            throw new Error('CloudConvert job failed')
          }
        } while (finishedJob.data.status !== 'finished' && attempts < maxAttempts)
        
        if (finishedJob.data.status !== 'finished') {
          throw new Error('CloudConvert job timeout')
        }
        
        onProgress?.({ status: 'processing', progress: 80, message: 'Finalizing PDF...' })

        // Get the export task
        const exportTask = finishedJob.data.tasks.find((task: any) => task.name === 'export-pdf')
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
        
      } catch (jobError) {
        console.error('[CloudConvert] Job processing failed:', jobError)
        throw jobError
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