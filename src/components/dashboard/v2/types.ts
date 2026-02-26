// Dashboard V2 — Shared Types & Utilities

export interface DashboardStats {
  activeProjects: number
  activeRooms: number
  pendingApprovals: number
  completedThisMonth: number
  totalRevenue: number
  activeStages: number
  overdueTasks: number
}

export interface Task {
  id: string
  title: string
  project: string
  projectId: string
  client: string
  priority: 'high' | 'medium' | 'low'
  dueDate: string | null
  status: string
  stageType: string
  roomType: string
  roomId: string
}

export interface MyTask {
  id: string
  title: string
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW'
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL'
  dueDate: string | null
  project: { id: string; name: string }
  _count: { subtasks: number; comments: number }
  completedSubtasks: number
}

export interface UpcomingMeeting {
  id: string
  title: string
  date: string
  startTime: string
  endTime: string
  locationType: string
  locationDetails?: string | null
  meetingLink?: string | null
  project?: { id: string; name: string } | null
  organizer?: { id: string; name: string | null; email: string } | null
  attendeeCount: number
  attendees: Array<{
    id: string
    type: string
    status: string
    name: string
  }>
}

export interface LastCompletedPhase {
  id: string
  stageType: string
  roomType: string
  roomName?: string
  clientName: string
  projectName: string
  completedAt: string
  completedBy: {
    id: string
    name: string
    role: string
    image?: string
  }
}

export interface RecentCompletionDto {
  id: string
  stageType: string
  roomType: string
  roomName?: string
  clientName: string
  projectName: string
  completedAt: string
  completedBy: {
    id: string
    name: string
    role: string
    image?: string
  }
}

export interface PendingApprovalDto {
  id: string
  version: string
  stageId: string
  status: string
  createdAt: string
  roomType: string
  roomName?: string
  projectName: string
  clientName: string
  assetCount: number
  createdBy: {
    id: string
    name: string
    role: string
    image?: string
  }
}

// ── Utility Functions ──

export function formatDueDate(dueDate: string | null): string {
  if (!dueDate) return 'No due date'
  const date = new Date(dueDate)
  if (isNaN(date.getTime())) return 'No due date'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const dueDateOnly = new Date(date)
  dueDateOnly.setHours(0, 0, 0, 0)
  const diffDays = Math.ceil(
    (dueDateOnly.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (diffDays < 0) return 'Overdue'
  if (diffDays === 0) return 'Due today'
  if (diffDays === 1) return 'Due tomorrow'
  if (diffDays <= 7) return `Due in ${diffDays} days`
  return date.toLocaleDateString()
}

export function formatPhaseName(stageType: string): string {
  if (!stageType.includes('_')) return stageType
  switch (stageType.toUpperCase()) {
    case 'DESIGN_CONCEPT':
    case 'DESIGN':
      return 'Design Concept'
    case 'THREE_D':
    case 'RENDERING':
      return '3D Rendering'
    case 'CLIENT_APPROVAL':
      return 'Client Approval'
    case 'DRAWINGS':
      return 'Drawings'
    case 'FFE':
      return 'FFE'
    default:
      if (
        stageType.toUpperCase().includes('THREE') ||
        stageType.toUpperCase().includes('3D')
      )
        return '3D Rendering'
      return stageType
        .replace('_', ' ')
        .toLowerCase()
        .replace(/\b\w/g, (l) => l.toUpperCase())
  }
}

export function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString)
  const today = new Date()
  const diffTime = today.getTime() - date.getTime()
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays <= 7) return `${diffDays} days ago`
  return date.toLocaleDateString()
}

export function formatMeetingDate(dateStr: string): string {
  const d = new Date(dateStr)
  const today = new Date()
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)

  today.setHours(0, 0, 0, 0)
  tomorrow.setHours(0, 0, 0, 0)
  const meetingDay = new Date(d)
  meetingDay.setHours(0, 0, 0, 0)

  if (meetingDay.getTime() === today.getTime()) return 'Today'
  if (meetingDay.getTime() === tomorrow.getTime()) return 'Tomorrow'
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })
}

export function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

// ── Design Tokens ──

export const CARD_SHADOW =
  'shadow-[0_1px_3px_rgba(0,0,0,0.04),0_1px_2px_rgba(0,0,0,0.06)]'
export const CARD_HOVER_SHADOW =
  'hover:shadow-[0_4px_12px_rgba(0,0,0,0.08)]'

export const fetcher = (url: string) => fetch(url).then((res) => res.json())
