import { notifyMention } from './notificationUtils'

// Regular expression to match @mentions (more precise matching)
// Matches @word or @word word (max 2 words), stops at punctuation or after second word
const MENTION_REGEX = /@([a-zA-Z]+(?:\s+[a-zA-Z]+)?)(?=[.,!?;:\s]|$)/g

/**
 * Extract @mentions from text
 * Returns array of mentioned names (without the @ symbol)
 * Uses a two-pass approach: first find all @word patterns, then extend with following word if reasonable
 */
export function extractMentions(text: string): string[] {
  const mentions: string[] = []
  
  // Find all @word patterns
  const simpleMatches = text.match(/@[a-zA-Z]+/g)
  if (!simpleMatches) return []
  
  for (const match of simpleMatches) {
    const startIndex = text.indexOf(match)
    const afterMatch = text.substring(startIndex + match.length)
    
    // Check if there's a space followed by a capitalized word (potential last name)
    // Only capture if it looks like a proper name (starts with capital letter)
    const nextWordMatch = afterMatch.match(/^\s+([A-Z][a-zA-Z]*)(?=[\s.,!?;:]|$)/)
    
    let mentionedName = match.substring(1) // Remove @
    if (nextWordMatch && nextWordMatch[1]) {
      // Additional check: make sure this looks like a name, not a common word
      const nextWord = nextWordMatch[1]
      // Include the next word if it's capitalized (proper noun pattern)
      mentionedName += ' ' + nextWord
    }
    
    if (mentionedName && !mentions.includes(mentionedName)) {
      mentions.push(mentionedName)
    }
  }
  
  return mentions
}

/**
 * Extract @mentions from text with team member validation
 * Only returns mentions that match actual team member names
 */
export async function extractValidMentions(text: string, orgId: string): Promise<string[]> {
  // Get all potential mentions from the text
  const potentialMentions = extractMentions(text)
  
  if (potentialMentions.length === 0) {
    return []
  }
  
  // Get all team members
  const teamMembers = await getTeamMembersForMentions(orgId)
  const validMentions: string[] = []
  
  for (const mention of potentialMentions) {
    // Check if this mention matches any team member name (case-insensitive)
    // Support both exact matches and partial matches (e.g., "Aaron" matches "Aaron (Designer)")
    const matchingMember = teamMembers.find(member => {
      const memberNameLower = member.name.toLowerCase()
      const mentionLower = mention.toLowerCase()
      
      // Exact match
      if (memberNameLower === mentionLower) {
        return true
      }
      
      // Partial match - check if the mention is contained in the member name
      // or if the member name starts with the mention
      if (memberNameLower.includes(mentionLower) || memberNameLower.startsWith(mentionLower)) {
        return true
      }
      
      // Also check first name only (extract first word from both)
      const memberFirstName = memberNameLower.split(/\s|\(|\)/)[0]
      const mentionFirstName = mentionLower.split(/\s|\(|\)/)[0]
      
      return memberFirstName === mentionFirstName
    })
    
    if (matchingMember && !validMentions.includes(matchingMember.name)) {
      validMentions.push(matchingMember.name)
    }
  }
  
  return validMentions
}

/**
 * Find users by their names (case-insensitive, supports partial matching)
 */
export async function findUsersByNames(names: string[], orgId: string): Promise<Array<{ id: string; name: string; email: string }>> {
  if (names.length === 0) return []
  
  try {
    const response = await fetch('/api/mentions/users-by-names', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        names,
        orgId
      })
    })
    
    if (!response.ok) {
      console.error('Failed to find users by names:', response.status)
      return []
    }
    
    const result = await response.json()
    
    if (result.success) {
      return result.data
    } else {
      console.error('API returned error:', result.error)
      return []
    }
  } catch (error) {
    console.error('Error finding users by names:', error)
    return []
  }
}

/**
 * Process @mentions in text and create notifications
 */
export async function processMentions({
  text,
  authorId,
  authorName,
  orgId,
  contextTitle,
  relatedId,
  relatedType,
  messagePreview
}: {
  text: string
  authorId: string
  authorName: string
  orgId: string
  contextTitle: string
  relatedId: string
  relatedType: string
  messagePreview?: string
}): Promise<{ mentionedUsers: Array<{ id: string; name: string }>, notificationCount: number }> {
  
  // Extract valid mentions from the text (only actual team member names)
  const mentionedNames = await extractValidMentions(text, orgId)
  
  if (mentionedNames.length === 0) {
    return { mentionedUsers: [], notificationCount: 0 }
  }
  
  // Find users by mentioned names (exact matches)
  const mentionedUsers = await findUsersByNames(mentionedNames, orgId)
  
  // Filter out the author (don't notify yourself)
  const usersToNotify = mentionedUsers.filter(user => user.id !== authorId)
  
  if (usersToNotify.length === 0) {
    return { mentionedUsers, notificationCount: 0 }
  }
  
  // Create mention notifications for each user
  const notificationPromises = usersToNotify.map(user => 
    notifyMention({
      userId: user.id,
      mentionedByName: authorName,
      messagePreview: messagePreview || text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      contextTitle,
      relatedId,
      relatedType
    }).catch(error => {
      console.error(`Failed to create mention notification for user ${user.id}:`, error)
      return null
    })
  )
  
  // Wait for all notifications to be created
  const results = await Promise.allSettled(notificationPromises)
  const successCount = results.filter(result => result.status === 'fulfilled' && result.value !== null).length

  return { 
    mentionedUsers: usersToNotify.map(u => ({ id: u.id, name: u.name })), 
    notificationCount: successCount 
  }
}

/**
 * Highlight @mentions in text for display (wrap them in spans with CSS classes)
 */
export function highlightMentions(text: string): string {
  const mentions = extractMentions(text)
  
  let highlightedText = text
  
  // Highlight each extracted mention
  for (const mention of mentions) {
    // Escape special regex characters and create word boundary pattern
    const escapedMention = mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const mentionPattern = new RegExp(`@${escapedMention}(?=\s|[.,!?;:]|$)`, 'gi')
    highlightedText = highlightedText.replace(mentionPattern, '<span class="mention">@' + mention + '</span>')
  }
  
  return highlightedText
}

/**
 * Highlight only valid @mentions in text for display
 * Only highlights mentions that match actual team member names
 */
export async function highlightValidMentions(text: string, orgId: string): Promise<string> {
  const validMentions = await extractValidMentions(text, orgId)
  
  if (validMentions.length === 0) {
    return text
  }
  
  let highlightedText = text
  
  // Highlight each valid mention
  for (const mention of validMentions) {
    // Escape special regex characters and create word boundary pattern
    const escapedMention = mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const mentionPattern = new RegExp(`@${escapedMention}(?=\s|[.,!?;:]|$)`, 'gi')
    highlightedText = highlightedText.replace(mentionPattern, '<span class="mention">@' + mention + '</span>')
  }
  
  return highlightedText
}

/**
 * Get all team members for mention suggestions
 */
export async function getTeamMembersForMentions(orgId: string): Promise<Array<{ id: string; name: string; email: string; role: string }>> {
  try {
    const response = await fetch(`/api/mentions/team-members?orgId=${orgId}`)
    
    if (!response.ok) {
      console.error('Failed to fetch team members:', response.status)
      return []
    }
    
    const result = await response.json()
    
    if (result.success) {
      return result.data
    } else {
      console.error('API returned error:', result.error)
      return []
    }
  } catch (error) {
    console.error('Error fetching team members:', error)
    return []
  }
}

/**
 * Validate and sanitize mention text
 */
export function sanitizeMentionText(text: string): string {
  // Remove excessive whitespace and normalize
  return text.replace(/\s+/g, ' ').trim()
}

/**
 * Convert @mentions to user links for rich text display
 */
export function convertMentionsToLinks(text: string, mentionedUsers: Array<{ id: string; name: string }>): string {
  let processedText = text
  
  mentionedUsers.forEach(user => {
    const mentionPattern = new RegExp(`@${user.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'gi')
    processedText = processedText.replace(mentionPattern, `<a href="/team/${user.id}" class="mention-link">@${user.name}</a>`)
  })
  
  return processedText
}

// Export types for TypeScript
export interface MentionResult {
  mentionedUsers: Array<{ id: string; name: string }>
  notificationCount: number
}

export interface TeamMember {
  id: string
  name: string
  email: string
  role: string
}