// Room phases configuration for interior design workflow
// Professional, enterprise-grade phase management
// Colors are defined in @/constants/colors.ts

import { PHASE_COLORS } from '@/constants/colors'

export const ROOM_PHASES = [
  {
    id: 'DESIGN_CONCEPT',
    label: 'Design Concept',
    shortLabel: 'Concept',
    icon: '🎨',
    color: 'purple',      // Brand color: #a657f0
    hexColor: PHASE_COLORS.DESIGN_CONCEPT.primary,
    description: 'Create mood boards, material selections, and design concepts'
  },
  {
    id: 'RENDERING',
    label: '3D Rendering',
    shortLabel: '3D',
    icon: '🎥',
    color: 'orange',      // Brand color: #f6762e
    hexColor: PHASE_COLORS.THREE_D.primary,
    description: 'Generate photorealistic 3D visualizations'
  },
  {
    id: 'CLIENT_APPROVAL',
    label: 'Client Approval',
    shortLabel: 'Approval',
    icon: '👥',
    color: 'teal',        // Brand color: #14b8a6
    hexColor: PHASE_COLORS.CLIENT_APPROVAL.primary,
    description: 'Client review and approval process'
  },
  {
    id: 'DRAWINGS',
    label: 'Drawings',
    shortLabel: 'Drawings',
    icon: '📐',
    color: 'indigo',      // Brand color: #6366ea
    hexColor: PHASE_COLORS.DRAWINGS.primary,
    description: 'Technical drawings and construction documentation'
  },
  {
    id: 'FFE',
    label: 'FFE',
    shortLabel: 'FFE',
    icon: '🛋️',
    color: 'pink',        // Brand color: #e94d97
    hexColor: PHASE_COLORS.FFE.primary,
    description: 'Furniture, fixtures, and equipment sourcing'
  }
] as const

export type PhaseId = typeof ROOM_PHASES[number]['id']

export const PHASE_STATUS = [
  'PENDING',
  'IN_PROGRESS', 
  'COMPLETE',
  'NOT_APPLICABLE'
] as const

export type PhaseStatus = typeof PHASE_STATUS[number]

// Status configuration with professional styling
export const STATUS_CONFIG = {
  PENDING: {
    label: 'Pending',
    color: 'gray',
    bgClass: 'bg-gray-100',
    textClass: 'text-gray-700',
    ringClass: 'ring-gray-300',
    icon: '⏸️'
  },
  IN_PROGRESS: {
    label: 'In Progress',
    color: 'blue',
    bgClass: 'bg-blue-100',
    textClass: 'text-blue-700',
    ringClass: 'ring-blue-300',
    icon: '▶️'
  },
  COMPLETE: {
    label: 'Complete',
    color: 'green',
    bgClass: 'bg-green-100',
    textClass: 'text-green-700', 
    ringClass: 'ring-green-300',
    icon: '✅'
  },
  NOT_APPLICABLE: {
    label: 'Not Applicable',
    color: 'slate',
    bgClass: 'bg-slate-100',
    textClass: 'text-slate-700',
    ringClass: 'ring-slate-300',
    icon: '➖'
  }
} as const

// Helper functions
export function getPhaseConfig(phaseId: PhaseId) {
  return ROOM_PHASES.find(phase => phase.id === phaseId)
}

export function getStatusConfig(status: PhaseStatus) {
  return STATUS_CONFIG[status]
}

export function getPhaseColor(phaseId: PhaseId, status: PhaseStatus = 'PENDING') {
  const phase = getPhaseConfig(phaseId)
  if (!phase) return 'gray'
  
  // Use status color if complete, otherwise use phase color
  return status === 'COMPLETE' ? 'green' : phase.color
}

export function getPhaseHexColor(phaseId: PhaseId) {
  const phase = getPhaseConfig(phaseId)
  return phase?.hexColor || '#6b7280'
}

// All phases are available to all team members
// Assignments are used for notification and task tracking only

/**
 * Maps database StageStatus to UI PhaseStatus
 */
export function mapStageStatusToPhaseStatus(stageStatus: string): PhaseStatus {
  switch (stageStatus) {
    case 'NOT_STARTED':
      return 'PENDING'
    case 'IN_PROGRESS':
      return 'IN_PROGRESS'
    case 'COMPLETED':
      return 'COMPLETE'
    case 'NOT_APPLICABLE':
      return 'NOT_APPLICABLE'
    case 'ON_HOLD':
    case 'NEEDS_ATTENTION':
    default:
      return 'PENDING'
  }
}

/**
 * Maps UI PhaseStatus to database StageStatus actions
 */
export function mapPhaseStatusToStageAction(phaseStatus: PhaseStatus): string {
  switch (phaseStatus) {
    case 'IN_PROGRESS':
      return 'start'
    case 'COMPLETE':
      return 'complete'
    case 'NOT_APPLICABLE':
      return 'mark_not_applicable'
    case 'PENDING':
    default:
      return 'reopen'
  }
}

// Tailwind color classes for dynamic styling
// Using custom hex colors for brand consistency
export const COLOR_CLASSES = {
  purple: {
    bg: 'bg-[#a657f0]/10',
    text: 'text-[#a657f0]',
    border: 'border-[#a657f0]/30',
    hover: 'hover:bg-[#a657f0]/20',
    ring: 'ring-[#a657f0]/20',
    solid: 'bg-[#a657f0]'
  },
  orange: {
    bg: 'bg-[#f6762e]/10', 
    text: 'text-[#f6762e]',
    border: 'border-[#f6762e]/30',
    hover: 'hover:bg-[#f6762e]/20',
    ring: 'ring-[#f6762e]/20',
    solid: 'bg-[#f6762e]'
  },
  teal: {
    bg: 'bg-[#14b8a6]/10',
    text: 'text-[#14b8a6]', 
    border: 'border-[#14b8a6]/30',
    hover: 'hover:bg-[#14b8a6]/20',
    ring: 'ring-[#14b8a6]/20',
    solid: 'bg-[#14b8a6]'
  },
  indigo: {
    bg: 'bg-[#6366ea]/10',
    text: 'text-[#6366ea]',
    border: 'border-[#6366ea]/30', 
    hover: 'hover:bg-[#6366ea]/20',
    ring: 'ring-[#6366ea]/20',
    solid: 'bg-[#6366ea]'
  },
  // Keep these for compatibility
  blue: {
    bg: 'bg-[#14b8a6]/10',
    text: 'text-[#14b8a6]', 
    border: 'border-[#14b8a6]/30',
    hover: 'hover:bg-[#14b8a6]/20',
    ring: 'ring-[#14b8a6]/20',
    solid: 'bg-[#14b8a6]'
  },
  pink: {
    bg: 'bg-[#e94d97]/10',
    text: 'text-[#e94d97]',
    border: 'border-[#e94d97]/30',
    hover: 'hover:bg-[#e94d97]/20',
    ring: 'ring-[#e94d97]/20',
    solid: 'bg-[#e94d97]'
  },
  green: {
    bg: 'bg-green-50',
    text: 'text-green-800',
    border: 'border-green-200',
    hover: 'hover:bg-green-100', 
    ring: 'ring-green-200',
    solid: 'bg-green-500'
  },
  gray: {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
    hover: 'hover:bg-gray-100',
    ring: 'ring-gray-200',
    solid: 'bg-gray-500'
  },
  slate: {
    bg: 'bg-slate-50',
    text: 'text-slate-700',
    border: 'border-slate-200',
    hover: 'hover:bg-slate-100',
    ring: 'ring-slate-200',
    solid: 'bg-slate-500'
  }
} as const

export function getColorClasses(color: keyof typeof COLOR_CLASSES) {
  return COLOR_CLASSES[color] || COLOR_CLASSES.gray
}
