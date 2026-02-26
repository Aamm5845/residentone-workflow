import {
  BarChart3, CheckSquare, Calendar, Layers, Award,
  ShoppingCart, MessageSquare, Activity, Receipt, Bell,
  FolderOpen, DollarSign, Timer,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { WidgetLayout } from './types'

export interface WidgetDefinition {
  id: string
  title: string
  description: string
  icon: LucideIcon
  defaultW: number
  defaultH: number
  minW: number
  minH: number
  maxW?: number
  maxH?: number
  // Which user permissions are required (empty = everyone)
  requiredPermission?: 'canSeeBilling' | 'canSeeFinancials'
}

export const WIDGET_REGISTRY: Record<string, WidgetDefinition> = {
  'quick-stats': {
    id: 'quick-stats',
    title: 'Quick Stats',
    description: 'Key metrics at a glance — projects, rooms, approvals, completed',
    icon: BarChart3,
    defaultW: 12, defaultH: 2, minW: 6, minH: 2,
  },
  'my-tasks': {
    id: 'my-tasks',
    title: 'My Tasks',
    description: 'Tasks assigned to you with status and due dates',
    icon: CheckSquare,
    defaultW: 6, defaultH: 5, minW: 4, minH: 3,
  },
  'upcoming-meetings': {
    id: 'upcoming-meetings',
    title: 'Upcoming Meetings',
    description: 'Your next scheduled meetings with join links',
    icon: Calendar,
    defaultW: 6, defaultH: 5, minW: 4, minH: 3,
  },
  'active-stages': {
    id: 'active-stages',
    title: 'Active Stages',
    description: 'Design phases currently assigned to you',
    icon: Layers,
    defaultW: 12, defaultH: 6, minW: 6, minH: 3,
  },
  'last-completed': {
    id: 'last-completed',
    title: 'Last Completed',
    description: 'Most recently completed design phase',
    icon: Award,
    defaultW: 4, defaultH: 3, minW: 3, minH: 3,
  },
  'procurement-inbox': {
    id: 'procurement-inbox',
    title: 'Procurement Inbox',
    description: 'Pending quotes, orders, and delivery alerts',
    icon: ShoppingCart,
    defaultW: 6, defaultH: 5, minW: 4, minH: 3,
  },
  'team-messages': {
    id: 'team-messages',
    title: 'Team Messages',
    description: 'Latest team chat messages',
    icon: MessageSquare,
    defaultW: 6, defaultH: 5, minW: 4, minH: 3,
  },
  'activity-timeline': {
    id: 'activity-timeline',
    title: 'Activity Timeline',
    description: 'Recent activity across all projects',
    icon: Activity,
    defaultW: 6, defaultH: 5, minW: 4, minH: 3,
  },
  'billing-overview': {
    id: 'billing-overview',
    title: 'Billing Overview',
    description: 'Outstanding invoices and unbilled hours',
    icon: Receipt,
    defaultW: 6, defaultH: 5, minW: 4, minH: 3,
    requiredPermission: 'canSeeBilling',
  },
  'notifications': {
    id: 'notifications',
    title: 'Notifications',
    description: 'Your unread notifications',
    icon: Bell,
    defaultW: 4, defaultH: 5, minW: 3, minH: 3,
  },
  'project-progress': {
    id: 'project-progress',
    title: 'Project Progress',
    description: 'Overview of all active project completion',
    icon: FolderOpen,
    defaultW: 6, defaultH: 5, minW: 4, minH: 3,
  },
  'financial-summary': {
    id: 'financial-summary',
    title: 'Financial Summary',
    description: 'Revenue and expense overview',
    icon: DollarSign,
    defaultW: 6, defaultH: 5, minW: 4, minH: 3,
    requiredPermission: 'canSeeFinancials',
  },
  'time-tracking': {
    id: 'time-tracking',
    title: 'Time Tracking',
    description: 'Your active timer and today\'s logged hours',
    icon: Timer,
    defaultW: 4, defaultH: 3, minW: 3, minH: 2,
  },
}

// Default layout for new users
export const DEFAULT_ENABLED_WIDGETS = [
  'quick-stats', 'upcoming-meetings', 'my-tasks', 'active-stages', 'last-completed'
]

export const DEFAULT_LAYOUTS: WidgetLayout[] = [
  { i: 'quick-stats',       x: 0,  y: 0,  w: 12, h: 2,  minW: 6,  minH: 2  },
  { i: 'upcoming-meetings', x: 0,  y: 2,  w: 6,  h: 5,  minW: 4,  minH: 3  },
  { i: 'my-tasks',          x: 6,  y: 2,  w: 6,  h: 5,  minW: 4,  minH: 3  },
  { i: 'active-stages',     x: 0,  y: 7,  w: 12, h: 6,  minW: 6,  minH: 3  },
  { i: 'last-completed',    x: 0,  y: 13, w: 4,  h: 3,  minW: 3,  minH: 3  },
]

// Get all widget IDs in order
export function getAllWidgetIds(): string[] {
  return Object.keys(WIDGET_REGISTRY)
}
