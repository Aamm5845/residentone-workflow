import { z } from 'zod'

// Zod schema for due date validation
export const dueDateSchema = z.object({
  dueDate: z.union([
    z.string().datetime().nullable(),
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(), // Accept YYYY-MM-DD format
    z.null()
  ]).optional()
    .refine((date) => {
      if (!date) return true // Allow null dates
      try {
        const parsedDate = new Date(date)
        if (isNaN(parsedDate.getTime())) return false // Invalid date
        
        // Allow past dates for now - this can be adjusted later if needed
        return true
      } catch {
        return false
      }
    }, {
      message: "Invalid date format"
    })
})

// Phase ordering for validation
export const PHASE_ORDER = {
  'DESIGN': 1,
  'THREE_D': 2,
  'CLIENT_APPROVAL': 3,
  'DRAWINGS': 4,
  'FFE': 5
} as const

export type PhaseType = keyof typeof PHASE_ORDER

// Validate due date logic for phases
export function validatePhaseDueDates(phases: Array<{
  type: string
  dueDate: Date | null
}>): { isValid: boolean; errors: string[] } {
  const errors: string[] = []
  
  // Sort phases by their natural order
  const sortedPhases = phases
    .filter(p => p.dueDate) // Only consider phases with due dates
    .sort((a, b) => {
      const orderA = PHASE_ORDER[a.type as PhaseType] || 999
      const orderB = PHASE_ORDER[b.type as PhaseType] || 999
      return orderA - orderB
    })
  
  // Check if due dates are in logical order
  for (let i = 0; i < sortedPhases.length - 1; i++) {
    const currentPhase = sortedPhases[i]
    const nextPhase = sortedPhases[i + 1]
    
    if (currentPhase.dueDate && nextPhase.dueDate) {
      if (currentPhase.dueDate > nextPhase.dueDate) {
        const currentPhaseName = currentPhase.type.replace('_', ' ').toLowerCase()
        const nextPhaseName = nextPhase.type.replace('_', ' ').toLowerCase()
        errors.push(`${currentPhaseName} phase cannot be due after ${nextPhaseName} phase`)
      }
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  }
}

// Calculate recommended due dates based on phase dependencies
export function calculateRecommendedDueDates(
  startDate: Date,
  phases: string[]
): Record<string, Date> {
  const recommendations: Record<string, Date> = {}
  
  // Default phase durations (in days)
  const phaseDurations = {
    'DESIGN': 7,        // 1 week
    'THREE_D': 5,       // 5 days
    'CLIENT_APPROVAL': 3, // 3 days
    'DRAWINGS': 10,     // 1.5 weeks
    'FFE': 14           // 2 weeks
  }
  
  let currentDate = new Date(startDate)
  
  for (const phaseType of phases) {
    const duration = phaseDurations[phaseType as PhaseType] || 7
    currentDate = new Date(currentDate.getTime() + duration * 24 * 60 * 60 * 1000)
    recommendations[phaseType] = new Date(currentDate)
  }
  
  return recommendations
}

// Check if a phase is overdue
export function isPhaseOverdue(dueDate: Date | null, status: string): boolean {
  if (!dueDate || status === 'COMPLETED' || status === 'NOT_APPLICABLE') {
    return false
  }
  
  return new Date() > new Date(dueDate)
}

// Check if a phase is due soon (within specified days)
export function isPhaseDueSoon(
  dueDate: Date | null, 
  status: string, 
  daysAhead: number = 3
): boolean {
  if (!dueDate || status === 'COMPLETED' || status === 'NOT_APPLICABLE') {
    return false
  }
  
  const now = new Date()
  const warningDate = new Date(now.getTime() + daysAhead * 24 * 60 * 60 * 1000)
  
  return new Date(dueDate) <= warningDate && new Date(dueDate) > now
}

// Get urgency level for a phase
export function getPhaseUrgency(
  dueDate: Date | null,
  status: string
): 'critical' | 'high' | 'medium' | 'low' {
  if (isPhaseOverdue(dueDate, status)) {
    return 'critical'
  }
  
  if (isPhaseDueSoon(dueDate, status, 1)) { // Due within 1 day
    return 'high'
  }
  
  if (isPhaseDueSoon(dueDate, status, 3)) { // Due within 3 days
    return 'medium'
  }
  
  return 'low'
}

// Format relative due date text
export function formatRelativeDueDate(dueDate: Date | null): string {
  if (!dueDate) return 'No due date'
  
  const now = new Date()
  const diff = new Date(dueDate).getTime() - now.getTime()
  const daysDiff = Math.ceil(diff / (1000 * 60 * 60 * 24))
  
  if (daysDiff < 0) {
    const overdueDays = Math.abs(daysDiff)
    return overdueDays === 1 ? '1 day overdue' : `${overdueDays} days overdue`
  }
  
  if (daysDiff === 0) return 'Due today'
  if (daysDiff === 1) return 'Due tomorrow'
  if (daysDiff <= 7) return `Due in ${daysDiff} days`
  
  return new Date(dueDate).toLocaleDateString()
}
