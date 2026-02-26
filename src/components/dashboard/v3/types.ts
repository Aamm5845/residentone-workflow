// Dashboard V3 — Shared Types & Utilities
// Re-exports V2 types (same data models) + adds V3-specific types

export type {
  DashboardStats,
  Task,
  MyTask,
  UpcomingMeeting,
  LastCompletedPhase,
  RecentCompletionDto,
  PendingApprovalDto,
} from '../v2/types'

export {
  formatDueDate,
  formatPhaseName,
  formatRelativeDate,
  formatMeetingDate,
  formatTime,
  fetcher,
} from '../v2/types'

// ── V3 Widget System Types ──

export interface WidgetLayout {
  i: string   // widget ID
  x: number
  y: number
  w: number
  h: number
  minW?: number
  minH?: number
  maxW?: number
  maxH?: number
}

export interface DashboardPreferencesResponse {
  layouts: WidgetLayout[]
  enabledWidgets: string[]
  isDefault: boolean
}
