/**
 * Helper to resolve Dropbox temporary links with fallbacks for renamed folders.
 * Handles "3- RENDERING" → "3- Renderings" / "3- Rendering" renames.
 */

interface DropboxLinkProvider {
  getTemporaryLink(path: string, memberId?: string): Promise<string | null>
}

const RENDERING_FOLDER_VARIANTS = ['3- RENDERING', '3- Renderings', '3- Rendering']

export async function getDropboxLinkWithFallbacks(
  service: DropboxLinkProvider,
  path: string
): Promise<string | null> {
  // Try original path first
  try {
    const link = await service.getTemporaryLink(path)
    if (link) return link
  } catch {}

  // Try alternative folder names for known renames
  const lowerPath = path.toLowerCase()
  for (const variant of RENDERING_FOLDER_VARIANTS) {
    if (lowerPath.includes(variant.toLowerCase())) {
      for (const replacement of RENDERING_FOLDER_VARIANTS) {
        if (replacement === variant) continue
        const regex = new RegExp(variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        const altPath = path.replace(regex, replacement)
        if (altPath === path) continue
        try {
          const link = await service.getTemporaryLink(altPath)
          if (link) return link
        } catch {}
      }
      break
    }
  }

  return null
}
