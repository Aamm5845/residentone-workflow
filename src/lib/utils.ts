import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatRoomType(roomType: string): string {
  return roomType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

export function getStageProgress(stage: string, status: string): number {
  const stageWeights = {
    DESIGN: 20,
    THREE_D: 20,
    CLIENT_APPROVAL: 10,
    DRAWINGS: 25,
    FFE: 25
  }
  
  const statusMultipliers = {
    NOT_STARTED: 0,
    IN_PROGRESS: 0.5,
    COMPLETE: 1,
    PENDING_APPROVAL: 0.8,
    REVISION_REQUESTED: 0.3
  }
  
  const weight = stageWeights[stage as keyof typeof stageWeights] || 0
  const multiplier = statusMultipliers[status as keyof typeof statusMultipliers] || 0
  
  return weight * multiplier
}

export function calculateOverallProgress(stages: Array<{type: string, status: string}>): number {
  const totalProgress = stages.reduce((sum, stage) => {
    return sum + getStageProgress(stage.type, stage.status)
  }, 0)
  
  return Math.round(totalProgress)
}

export function getStatusColor(status: string): string {
  const colors = {
    NOT_STARTED: 'bg-gray-100 text-gray-800',
    IN_PROGRESS: 'bg-blue-100 text-blue-800',
    IN_DESIGN: 'bg-purple-100 text-purple-800',
    IN_3D: 'bg-indigo-100 text-indigo-800',
    WITH_CLIENT: 'bg-yellow-100 text-yellow-800',
    IN_PRODUCTION: 'bg-orange-100 text-orange-800',
    COMPLETE: 'bg-green-100 text-green-800',
    PENDING: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    REVISION_REQUESTED: 'bg-red-100 text-red-800',
    PENDING_APPROVAL: 'bg-amber-100 text-amber-800'
  }
  
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-800'
}

export function formatDate(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  // Check if date is valid
  if (!dateObj || isNaN(dateObj.getTime())) {
    return 'Unknown date'
  }
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(dateObj)
}

export function formatDateTime(date: Date | string): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date
  
  // Check if date is valid
  if (!dateObj || isNaN(dateObj.getTime())) {
    return 'Unknown date'
  }
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(dateObj)
}

export function generateApprovalUrl(token: string): string {
  return `${process.env.APP_URL || 'http://localhost:3000'}/approval/${token}`
}
