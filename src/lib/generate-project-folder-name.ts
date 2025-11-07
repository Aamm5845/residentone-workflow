import { prisma } from './prisma'

/**
 * Generates a Dropbox folder name in the format:
 * YYNNN - Address (Initial. LastName)
 * 
 * Example: "25009 - 602 Ch. De Tash Boisbriand, QC (L. Mermelstein)"
 * 
 * @param address - Full address string (streetAddress, city, province)
 * @param clientName - Client's full name
 * @param orgId - Organization ID to count projects for numbering
 * @returns Formatted folder name
 */
export async function generateProjectFolderName(
  address: string,
  clientName: string,
  orgId: string
): Promise<string> {
  // 1. Get current year (last 2 digits)
  const currentYear = new Date().getFullYear()
  const yearPrefix = currentYear.toString().slice(-2) // "25" for 2025
  
  // 2. Get the highest project number from existing Dropbox folders
  // This ensures we don't reuse numbers even if projects are deleted
  const projects = await prisma.project.findMany({
    where: {
      orgId: orgId,
      dropboxFolder: {
        not: null
      }
    },
    select: {
      dropboxFolder: true
    }
  })
  
  // Extract numbers from dropboxFolder paths (e.g., "25009" from "/Meisner.../25009 - Address...")
  let maxNumber = 0
  for (const project of projects) {
    if (project.dropboxFolder) {
      // Match pattern: YYNNN at the start of the folder name
      const match = project.dropboxFolder.match(/\/(\d{5})\s*-/)
      if (match) {
        const projectNum = parseInt(match[1])
        // Only consider projects from current year
        const projectYear = match[1].substring(0, 2)
        if (projectYear === yearPrefix && projectNum > maxNumber) {
          maxNumber = projectNum
        }
      }
    }
  }
  
  // Determine a minimum baseline for the next number
  // 1) Allow override via env var NEXT_PROJECT_MIN_NUMBER (e.g., 25011)
  // 2) Fallback to per-year defaults (for 2025 => 25011), else YY001
  let baseline = parseInt(yearPrefix + '001')
  const envMinRaw = process.env.NEXT_PROJECT_MIN_NUMBER
  if (envMinRaw && /^\d{5}$/.test(envMinRaw)) {
    const envMin = parseInt(envMinRaw)
    if (envMin.toString().startsWith(yearPrefix)) {
      baseline = envMin
    }
  } else if (yearPrefix === '25') {
    // Default baseline for 2025 as requested
    baseline = 25011
  }

  // Proposed number based on existing max
  const proposed = maxNumber === 0 ? parseInt(yearPrefix + '001') : maxNumber + 1

  // Final next number must be at least the baseline
  const nextNumber = Math.max(proposed, baseline)
  const projectNumber = nextNumber.toString() // Already 5 digits (YYNNN)
  
  // 3. Format address
  const formattedAddress = address.trim()
  
  // 4. Format client name: "FirstName LastName" -> "F. LastName"
  const nameParts = clientName.trim().split(' ')
  let clientInitial = ''
  
  if (nameParts.length >= 2) {
    // Get first initial and last name
    const firstName = nameParts[0]
    const lastName = nameParts[nameParts.length - 1]
    clientInitial = `${firstName.charAt(0)}. ${lastName}`
  } else if (nameParts.length === 1) {
    // Only one name provided
    clientInitial = nameParts[0]
  }
  
  // 5. Combine into final format: "YYNNN - Address (Initial. LastName)"
  const folderName = `${projectNumber} - ${formattedAddress} (${clientInitial})`
  
  return folderName
}

/**
 * Sanitizes the folder name for Dropbox compatibility
 * Removes invalid characters but keeps the structure readable
 */
export function sanitizeDropboxFolderName(folderName: string): string {
  return folderName
    .replace(/[<>:"|?*]/g, '') // Remove invalid characters
    .replace(/\\/g, '-') // Replace backslash with dash
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim()
}
