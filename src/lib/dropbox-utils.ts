import { dropboxService } from '@/lib/dropbox-service-v2'
import { CtbFile } from '@/types/cad-preferences'

/**
 * Get a temporary download link for a Dropbox file
 * This is specifically designed for CloudConvert imports
 */
export async function getDropboxTemporaryLink(
  dropboxPath: string,
  expiryMinutes: number = 60
): Promise<string | null> {
  try {
    const temporaryLink = await dropboxService.getTemporaryLink(dropboxPath)
    
    if (!temporaryLink) {
      console.error(`Failed to get temporary link for: ${dropboxPath}`)
      return null
    }
    
    console.log(`Generated temporary link for ${dropboxPath} (expires in ${expiryMinutes} minutes)`)
    return temporaryLink
  } catch (error) {
    console.error(`Error getting temporary link for ${dropboxPath}:`, error)
    return null
  }
}

/**
 * Validate that a file is a valid CTB file
 */
export function isValidCtbFile(fileName: string): boolean {
  if (!fileName) return false
  
  const extension = fileName.toLowerCase().split('.').pop()
  return extension === 'ctb'
}

/**
 * Get CTB file metadata for CloudConvert processing
 */
export async function getCtbFileMetadata(dropboxPath: string): Promise<CtbFile | null> {
  try {
    const metadata = await dropboxService.getFileMetadata(dropboxPath)
    
    if (!metadata) {
      return null
    }
    
    // Validate it's a CTB file
    if (!isValidCtbFile(metadata.name)) {
      throw new Error('File is not a valid CTB file')
    }
    
    return {
      id: metadata.id,
      dropboxPath: metadata.path,
      fileName: metadata.name,
      fileSize: metadata.size,
      lastModified: metadata.lastModified,
      revision: metadata.revision
    }
  } catch (error) {
    console.error(`Error getting CTB file metadata for ${dropboxPath}:`, error)
    return null
  }
}

/**
 * Download a CTB file buffer for CloudConvert processing
 */
export async function downloadCtbFile(dropboxPath: string): Promise<Buffer | null> {
  try {
    // Validate it's a CTB file first
    const fileName = dropboxPath.split('/').pop() || ''
    if (!isValidCtbFile(fileName)) {
      throw new Error('File is not a valid CTB file')
    }
    
    const buffer = await dropboxService.downloadFile(dropboxPath)
    
    if (!buffer) {
      throw new Error('Failed to download CTB file')
    }
    
    console.log(`Downloaded CTB file: ${dropboxPath} (${buffer.length} bytes)`)
    return buffer
  } catch (error) {
    console.error(`Error downloading CTB file ${dropboxPath}:`, error)
    return null
  }
}

/**
 * Get multiple temporary links in batch (for efficiency)
 */
export async function getBatchTemporaryLinks(
  dropboxPaths: string[],
  expiryMinutes: number = 60
): Promise<{ [path: string]: string | null }> {
  const results: { [path: string]: string | null } = {}
  
  // Process in parallel for better performance
  const promises = dropboxPaths.map(async (path) => {
    const link = await getDropboxTemporaryLink(path, expiryMinutes)
    results[path] = link
  })
  
  await Promise.all(promises)
  
  return results
}

/**
 * Common CAD file extensions that are supported
 */
export const CAD_FILE_EXTENSIONS = ['.dwg', '.dxf', '.step', '.stp', '.iges', '.igs'] as const
export const CTB_FILE_EXTENSIONS = ['.ctb'] as const
export const ALL_CAD_EXTENSIONS = [...CAD_FILE_EXTENSIONS, ...CTB_FILE_EXTENSIONS] as const

/**
 * Check if a file is a supported CAD file
 */
export function isSupportedCadFile(fileName: string): boolean {
  if (!fileName) return false
  
  const extension = '.' + fileName.toLowerCase().split('.').pop()
  return CAD_FILE_EXTENSIONS.includes(extension as any)
}

/**
 * Get file type description based on extension
 */
export function getCadFileTypeDescription(fileName: string): string {
  if (!fileName) return 'Unknown'
  
  const extension = fileName.toLowerCase().split('.').pop()
  
  switch (extension) {
    case 'dwg': return 'AutoCAD Drawing'
    case 'dxf': return 'Drawing Exchange Format'
    case 'step':
    case 'stp': return 'STEP 3D Model'
    case 'iges':
    case 'igs': return 'IGES 3D Model'
    case 'ctb': return 'Color Table (Plot Style)'
    default: return 'CAD File'
  }
}

/**
 * Estimate conversion cost based on file types
 */
export function estimateConversionCost(fileNames: string[]): number {
  let cost = 0
  
  for (const fileName of fileNames) {
    if (isSupportedCadFile(fileName)) {
      cost += 0.008 // Base CAD conversion cost
    }
    // CTB files don't add conversion cost, but might increase processing cost slightly
    if (isValidCtbFile(fileName)) {
      cost += 0.002 // Small additional cost for CTB processing
    }
  }
  
  return cost
}

/**
 * Generate a cache key for a CAD file conversion with preferences
 */
export function generateConversionCacheKey(
  dropboxPath: string,
  revision: string,
  preferences: any // EffectiveCadPreferences
): string {
  const crypto = require('crypto')
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
