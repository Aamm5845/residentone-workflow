import { put, head } from '@vercel/blob'
import crypto from 'crypto'
import { 
  EffectiveCadPreferences, 
  CadConversionResult, 
  CadConversionProgress,
  CloudConvertCadOptions,
  WindowCoordinates,
  Margins
} from '@/types/cad-preferences'
import { dropboxService } from '@/lib/dropbox-service-v2'

interface ConversionInput {
  dropboxPath: string
  revision: string
  fileBuffer?: Buffer // Optional - can fetch if not provided
  preferences: EffectiveCadPreferences
  ctbFileBuffer?: Buffer // Optional CTB file content
  onProgress?: (progress: CadConversionProgress) => void
}

interface CloudConvertJob {
  data: {
    id: string
    status: 'waiting' | 'processing' | 'finished' | 'error'
    tasks: Array<{
      name: string
      operation: string
      status: string
      result?: {
        form?: {
          url: string
          parameters: Record<string, string>
        }
        files?: Array<{
          url: string
          filename: string
          size: number
        }>
      }
    }>
  }
}

class EnhancedCADConversionService {
  private getApiKey(): string {
    if (!process.env.CLOUDCONVERT_API_KEY) {
      throw new Error('CLOUDCONVERT_API_KEY environment variable is required')
    }
    return process.env.CLOUDCONVERT_API_KEY
  }

  private async makeApiRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
    const apiKey = this.getApiKey()
    const url = `https://api.cloudconvert.com/v2${endpoint}`
    
    console.log('[CloudConvert Enhanced] Making request to:', url)
    
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
      console.error('[CloudConvert Enhanced] API error:', {
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
   * Generate cache key for a CAD file with preferences
   */
  private generateCacheKey(
    dropboxPath: string, 
    revision: string, 
    preferences: EffectiveCadPreferences
  ): string {
    const hash = crypto.createHash('sha256')
    
    // Include file info
    hash.update(`${dropboxPath}:${revision}`)
    
    // Include preferences that affect output
    const prefsForCache = {
      layoutName: preferences.layoutName,
      ctbDropboxPath: preferences.ctbDropboxPath,
      plotArea: preferences.plotArea,
      window: preferences.window,
      centerPlot: preferences.centerPlot,
      scaleMode: preferences.scaleMode,
      scaleDenominator: preferences.scaleDenominator,
      keepAspectRatio: preferences.keepAspectRatio,
      margins: preferences.margins,
      paperSize: preferences.paperSize,
      orientation: preferences.orientation,
      dpi: preferences.dpi
    }
    
    hash.update(JSON.stringify(prefsForCache, Object.keys(prefsForCache).sort()))
    
    return hash.digest('hex')
  }

  /**
   * Check if converted PDF exists in cache
   */
  private async checkCache(cacheKey: string): Promise<string | null> {
    try {
      const cacheUrl = `https://${process.env.BLOB_READ_WRITE_TOKEN?.split('_')[1]}.public.blob.vercel-storage.com/specbooks/cache/enhanced/${cacheKey}.pdf`
      
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
      console.log('[CloudConvert Enhanced] File already cached, returning existing URL')
      return existingUrl
    }
    
    const blob = await put(`specbooks/cache/enhanced/${cacheKey}.pdf`, pdfBuffer, {
      access: 'public',
      contentType: 'application/pdf',
      addRandomSuffix: false
    })
    return blob.url
  }

  /**
   * Get file extension from Dropbox path
   */
  private getFileExtension(path: string): string {
    const ext = path.toLowerCase().split('.').pop()
    return ext || 'dwg'
  }

  /**
   * Build CloudConvert converter options from preferences
   */
  private buildConverterOptions(
    preferences: EffectiveCadPreferences,
    hasCtb: boolean
  ): CloudConvertCadOptions {
    const options: CloudConvertCadOptions = {}

    // Layout selection
    if (preferences.layoutName) {
      options.layout = preferences.layoutName
    }

    // Plot area
    options.plot_area = preferences.plotArea
    if (preferences.plotArea === 'window' && preferences.window) {
      options.window = preferences.window
    }

    // Scaling and positioning
    options.center = preferences.centerPlot
    options.keep_aspect_ratio = preferences.keepAspectRatio

    if (preferences.scaleMode === 'fit') {
      options.fit_to_page = true
    } else if (preferences.scaleMode === 'custom' && preferences.scaleDenominator) {
      options.fit_to_page = false
      options.scale = `1:${preferences.scaleDenominator}`
    }

    // Paper settings
    if (preferences.paperSize && preferences.paperSize !== 'Auto') {
      options.paper_size = preferences.paperSize
    }
    
    if (preferences.orientation) {
      options.orientation = preferences.orientation
    }

    // Margins
    if (preferences.margins) {
      options.margins = preferences.margins
    }

    // DPI
    if (preferences.dpi) {
      options.dpi = preferences.dpi
    }

    // CTB plot style table
    if (hasCtb) {
      options.plot_style_table = 'import-ctb'
    }

    return options
  }

  /**
   * Get Dropbox signed URL for CloudConvert import
   */
  private async getDropboxSignedUrl(dropboxPath: string): Promise<string> {
    const temporaryLink = await dropboxService.getTemporaryLink(dropboxPath)
    if (!temporaryLink) {
      throw new Error(`Failed to get temporary link for: ${dropboxPath}`)
    }
    return temporaryLink
  }

  /**
   * Upload file buffer to CloudConvert
   */
  private async uploadToCloudConvert(
    fileBuffer: Buffer,
    uploadForm: { url: string, parameters: Record<string, string> },
    filename: string
  ): Promise<void> {
    const formData = new FormData()
    
    // Add form parameters
    Object.entries(uploadForm.parameters).forEach(([key, value]) => {
      formData.append(key, value)
    })
    
    // Add file
    formData.append('file', new Blob([fileBuffer]), filename)
    
    const uploadResponse = await fetch(uploadForm.url, {
      method: 'POST',
      body: formData
    })
    
    if (!uploadResponse.ok) {
      throw new Error(`File upload failed: ${uploadResponse.statusText}`)
    }
  }

  /**
   * Wait for CloudConvert job completion
   */
  private async waitForJobCompletion(
    jobId: string,
    onProgress?: (progress: CadConversionProgress) => void,
    maxAttempts: number = 60
  ): Promise<CloudConvertJob> {
    let attempts = 0
    
    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 5000)) // Wait 5 seconds
      
      const job: CloudConvertJob = await this.makeApiRequest(`/jobs/${jobId}`)
      attempts++
      
      // Update progress
      const progressPercent = Math.min(30 + (attempts / maxAttempts) * 50, 80)
      onProgress?.({
        status: 'processing',
        progress: progressPercent,
        message: `Converting... (${attempts}/${maxAttempts})`
      })
      
      if (job.data.status === 'finished') {
        return job
      }
      
      if (job.data.status === 'error') {
        throw new Error('CloudConvert job failed')
      }
    }
    
    throw new Error('CloudConvert job timeout')
  }

  /**
   * Convert CAD file to PDF with enhanced preferences support
   */
  async convertCADToPDF(input: ConversionInput): Promise<CadConversionResult> {
    const startTime = Date.now()
    
    try {
      // Check cache first
      const cacheKey = this.generateCacheKey(input.dropboxPath, input.revision, input.preferences)
      const cachedUrl = await this.checkCache(cacheKey)
      
      if (cachedUrl) {
        input.onProgress?.({ 
          status: 'completed', 
          progress: 100, 
          message: 'Using cached PDF' 
        })
        return {
          success: true,
          pdfUrl: cachedUrl,
          cached: true,
          cost: 0,
          processingTime: 0
        }
      }

      input.onProgress?.({ 
        status: 'queued', 
        progress: 10, 
        message: 'Starting enhanced conversion...' 
      })

      // Get file extension
      const fileExt = this.getFileExtension(input.dropboxPath)
      
      // Build job tasks
      const tasks: Record<string, any> = {
        'import-cad': {
          operation: 'import/url',
          url: await this.getDropboxSignedUrl(input.dropboxPath)
        }
      }

      // Add CTB import if needed
      const hasCtb = !!(input.preferences.ctbDropboxPath && input.ctbFileBuffer)
      if (hasCtb) {
        tasks['import-ctb'] = {
          operation: 'import/url',
          url: await this.getDropboxSignedUrl(input.preferences.ctbDropboxPath!)
        }
      }

      // Build converter options
      const converterOptions = this.buildConverterOptions(input.preferences, hasCtb)

      // Add convert task
      tasks['convert'] = {
        operation: 'convert',
        input: hasCtb ? ['import-cad', 'import-ctb'] : ['import-cad'],
        input_format: fileExt,
        output_format: 'pdf',
        engine: 'autocad', // Use AutoCAD engine for best CAD support
        converteroptions: converterOptions
      }

      // Add export task
      tasks['export'] = {
        operation: 'export/url',
        input: 'convert'
      }

      // Create CloudConvert job
      console.log('[CloudConvert Enhanced] Creating job with tasks:', JSON.stringify(tasks, null, 2))
      
      const job: CloudConvertJob = await this.makeApiRequest('/jobs', 'POST', { tasks })
      console.log('[CloudConvert Enhanced] Job created:', job.data.id)

      input.onProgress?.({ 
        status: 'processing', 
        progress: 20, 
        message: 'Job created, processing...' 
      })

      // Wait for completion
      const finishedJob = await this.waitForJobCompletion(job.data.id, input.onProgress)

      input.onProgress?.({ 
        status: 'processing', 
        progress: 85, 
        message: 'Downloading converted PDF...' 
      })

      // Get export result
      const exportTask = finishedJob.data.tasks.find(task => task.name === 'export')
      if (!exportTask?.result?.files?.[0]?.url) {
        throw new Error('No output file URL found in export task')
      }

      // Download the PDF
      const pdfResponse = await fetch(exportTask.result.files[0].url)
      if (!pdfResponse.ok) {
        throw new Error('Failed to download converted PDF')
      }

      const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer())
      const fileSize = pdfBuffer.length

      // Store in cache
      const cachedPdfUrl = await this.storeInCache(cacheKey, pdfBuffer)

      const processingTime = Date.now() - startTime

      input.onProgress?.({ 
        status: 'completed', 
        progress: 100, 
        message: 'Enhanced conversion completed' 
      })

      // Calculate cost (enhanced conversion might be slightly more expensive)
      const estimatedCost = hasCtb ? 0.010 : 0.008 // +$0.002 for CTB processing

      return {
        success: true,
        pdfUrl: cachedPdfUrl,
        fileSize,
        cached: false,
        cost: estimatedCost,
        jobId: job.data.id,
        processingTime
      }

    } catch (error) {
      console.error('[CloudConvert Enhanced] Conversion error:', error)
      
      input.onProgress?.({ 
        status: 'failed', 
        progress: 0, 
        message: error instanceof Error ? error.message : 'Unknown error' 
      })
      
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown enhanced conversion error',
        processingTime: Date.now() - startTime
      }
    }
  }

  /**
   * Discover layouts in a CAD file
   */
  async discoverLayouts(dropboxPath: string, revision: string): Promise<string[]> {
    try {
      // This is a simplified version - in a real implementation, you'd create
      // a probe job to discover layouts or use file metadata analysis
      
      console.log('[CloudConvert Enhanced] Discovering layouts for:', dropboxPath)
      
      // For now, return common layout names as fallback
      // In a real implementation, this would use CloudConvert's metadata extraction
      // or a lightweight conversion job to discover actual layouts
      
      const commonLayouts = ['Model', 'Layout1', 'Layout2', 'Layout3']
      
      // TODO: Implement actual layout discovery using CloudConvert probe job
      // This would involve creating a minimal job that extracts metadata or
      // attempts conversion with layout discovery enabled
      
      return commonLayouts
      
    } catch (error) {
      console.error('[CloudConvert Enhanced] Layout discovery error:', error)
      // Return fallback layouts
      return ['Model', 'Layout1']
    }
  }

  /**
   * Validate preferences before conversion
   */
  validatePreferences(preferences: EffectiveCadPreferences): { valid: boolean; errors: string[] } {
    const errors: string[] = []

    // Validate plot area and window coordinates
    if (preferences.plotArea === 'window') {
      if (!preferences.window) {
        errors.push('Window coordinates required when plot area is set to window')
      } else {
        const { x1, y1, x2, y2 } = preferences.window
        if (x1 >= x2 || y1 >= y2) {
          errors.push('Invalid window coordinates: x1 must be less than x2, y1 must be less than y2')
        }
      }
    }

    // Validate custom scale
    if (preferences.scaleMode === 'custom') {
      if (!preferences.scaleDenominator || preferences.scaleDenominator <= 0) {
        errors.push('Scale denominator must be a positive number for custom scale mode')
      }
    }

    // Validate DPI range
    if (preferences.dpi && (preferences.dpi < 72 || preferences.dpi > 600)) {
      errors.push('DPI must be between 72 and 600')
    }

    // Validate margins
    if (preferences.margins) {
      const { top, right, bottom, left } = preferences.margins
      if (top < 0 || right < 0 || bottom < 0 || left < 0) {
        errors.push('Margins must be non-negative values')
      }
    }

    return {
      valid: errors.length === 0,
      errors
    }
  }

  /**
   * Estimate conversion cost
   */
  estimateConversionCost(
    fileCount: number, 
    cachedCount: number = 0, 
    ctbCount: number = 0
  ): number {
    const conversionsNeeded = fileCount - cachedCount
    const baseConversions = conversionsNeeded - ctbCount
    const ctbConversions = Math.min(ctbCount, conversionsNeeded)
    
    return (baseConversions * 0.008) + (ctbConversions * 0.010)
  }
}

export const enhancedCADConversionService = new EnhancedCADConversionService()
export type { ConversionInput }
