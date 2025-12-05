import sharp from 'sharp'
import path from 'path'
import fs from 'fs/promises'

// Cache for the logo buffer to avoid reading from disk every time
let cachedLogoBuffer: Buffer | null = null

/**
 * Add watermark logo to an image at the bottom-left corner
 * @param imageBuffer - The original image buffer
 * @param options - Watermark options
 * @returns Buffer of the watermarked image
 */
export async function addWatermark(
  imageBuffer: Buffer,
  options: {
    logoPath?: string
    padding?: number // Padding from edges in pixels
    logoHeightPercent?: number // Logo height as percentage of image height (0-100)
    opacity?: number // Logo opacity (0-1)
  } = {}
): Promise<Buffer> {
  const {
    logoPath = path.join(process.cwd(), 'public', 'meisnerinteriorlogo.png'),
    padding = 30,
    logoHeightPercent = 8, // Logo will be 8% of image height
    opacity = 0.85
  } = options

  try {
    // Get logo buffer (cached for performance)
    if (!cachedLogoBuffer) {
      try {
        cachedLogoBuffer = await fs.readFile(logoPath)
      } catch (error) {
        console.error('[Watermark] Failed to load logo file:', error)
        // Return original image if logo can't be loaded
        return imageBuffer
      }
    }

    // Get original image metadata
    const originalImage = sharp(imageBuffer)
    const metadata = await originalImage.metadata()
    
    if (!metadata.width || !metadata.height) {
      console.error('[Watermark] Could not read image dimensions')
      return imageBuffer
    }

    // Calculate logo size (proportional to image height)
    const targetLogoHeight = Math.round(metadata.height * (logoHeightPercent / 100))
    
    // Resize logo while maintaining aspect ratio
    const logoBuffer = await sharp(cachedLogoBuffer)
      .resize({
        height: targetLogoHeight,
        fit: 'inside'
      })
      .ensureAlpha()
      .toBuffer()

    // Get resized logo dimensions
    const logoMetadata = await sharp(logoBuffer).metadata()
    const logoWidth = logoMetadata.width || 100
    const logoHeight = logoMetadata.height || 50

    // If opacity is not 1, apply transparency to the logo
    let finalLogoBuffer = logoBuffer
    if (opacity < 1) {
      // Create a semi-transparent version of the logo
      const { data, info } = await sharp(logoBuffer)
        .raw()
        .toBuffer({ resolveWithObject: true })
      
      // Modify alpha channel
      for (let i = 3; i < data.length; i += 4) {
        data[i] = Math.round(data[i] * opacity)
      }
      
      finalLogoBuffer = await sharp(data, {
        raw: {
          width: info.width,
          height: info.height,
          channels: 4
        }
      })
        .png()
        .toBuffer()
    }

    // Calculate position (bottom-left with padding)
    const left = padding
    const top = metadata.height - logoHeight - padding

    // Composite the watermark onto the image
    const watermarkedBuffer = await originalImage
      .composite([
        {
          input: finalLogoBuffer,
          left: left,
          top: top,
          blend: 'over'
        }
      ])
      .toBuffer()

    console.log(`[Watermark] Successfully added watermark (${logoWidth}x${logoHeight}px at position ${left},${top})`)
    return watermarkedBuffer

  } catch (error) {
    console.error('[Watermark] Error adding watermark:', error)
    // Return original image on error
    return imageBuffer
  }
}

/**
 * Check if a file is an image that can be watermarked
 */
export function isWatermarkableImage(mimeType: string): boolean {
  const watermarkableTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp'
  ]
  return watermarkableTypes.includes(mimeType.toLowerCase())
}
