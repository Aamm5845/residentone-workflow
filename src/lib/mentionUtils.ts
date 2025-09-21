import { prisma } from '@/lib/prisma'
import { notifyMention } from './notificationUtils'

// Regular expression to match @mentions (supports names with spaces)
const MENTION_REGEX = /@([a-zA-Z]+(?:\s+[a-zA-Z]+)*)/g

/**
 * Extract @mentions from text
 * Returns array of mentioned names (without the @ symbol)
 */
export function extractMentions(text: string): string[] {
  const mentions: string[] = []
  const matches = text.matchAll(MENTION_REGEX)
  
  for (const match of matches) {
    const mentionedName = match[1].trim()
    if (mentionedName && !mentions.includes(mentionedName)) {
      mentions.push(mentionedName)
    }
  }
  
  return mentions
}

/**
 * Find users by their names (case-insensitive, supports partial matching)
 */
export async function findUsersByNames(names: string[], orgId: string): Promise<Array<{ id: string; name: string; email: string }>> {
  if (names.length === 0) return []
  
  try {
    const users = await prisma.user.findMany({
      where: {
        orgId,
        OR: names.map(name => ({
          name: {
            contains: name,
            mode: 'insensitive'
          }
        }))
      },
      select: {
        id: true,
        name: true,
        email: true
      }
    })
    
    return users
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
  
  // Extract mentions from the text
  const mentionedNames = extractMentions(text)
  
  if (mentionedNames.length === 0) {
    return { mentionedUsers: [], notificationCount: 0 }
  }
  
  // Find users by mentioned names
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
  
  console.log(`Created ${successCount}/${usersToNotify.length} mention notifications`)
  
  return { 
    mentionedUsers: usersToNotify.map(u => ({ id: u.id, name: u.name })), 
    notificationCount: successCount 
  }
}

/**
 * Highlight @mentions in text for display (wrap them in spans with CSS classes)
 */
export function highlightMentions(text: string): string {
  return text.replace(MENTION_REGEX, '<span class="mention">@$1</span>')
}

/**
 * Get all team members for mention suggestions
 */
export async function getTeamMembersForMentions(orgId: string): Promise<Array<{ id: string; name: string; email: string; role: string }>> {
  try {
    const users = await prisma.user.findMany({
      where: {
        orgId,
        name: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true
      },
      orderBy: {
        name: 'asc'
      }
    })
    
    return users.filter(user => user.name) as Array<{ id: string; name: string; email: string; role: string }>
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