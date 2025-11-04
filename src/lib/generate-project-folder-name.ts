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
  
  // 2. Count ALL existing projects to get next sequential number
  // This ensures continuous numbering (25010, 25011, 25012...)
  const projectCount = await prisma.project.count({
    where: {
      orgId: orgId
    }
  })
  
  // Next project number (padded to 3 digits)
  const projectNumber = (projectCount + 1).toString().padStart(3, '0')
  
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
  const folderName = `${yearPrefix}${projectNumber} - ${formattedAddress} (${clientInitial})`
  
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
