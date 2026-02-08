// Workflow constants for interior design project stages
// This is the authoritative source for all workflow-related logic
// Colors are defined in @/constants/colors.ts

import { PHASE_COLORS } from './colors'

export const WORKFLOW_STAGES = [
  'DESIGN_CONCEPT',
  'THREE_D',
  'CLIENT_APPROVAL',
  'DRAWINGS',
  'FFE'
] as const

export type WorkflowStageType = typeof WORKFLOW_STAGES[number]

// Stage status types
export type StageStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_APPLICABLE'

export const STAGE_CONFIG = {
  DESIGN_CONCEPT: {
    name: 'Design Concept',
    icon: '🎨',
    color: PHASE_COLORS.DESIGN_CONCEPT.primary, // #a657f0 Purple
    baseColor: 'bg-[#a657f0]',
    colors: {
      NOT_STARTED: 'border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300',
      IN_PROGRESS: 'border-[#a657f0]/40 bg-gradient-to-br from-[#a657f0]/5 to-[#a657f0]/15 shadow-lg ring-2 ring-[#a657f0]/20',
      COMPLETED: 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg ring-2 ring-green-200',
      NOT_APPLICABLE: 'border-slate-200 bg-slate-50 opacity-75 shadow-sm'
    },
    textColors: {
      NOT_STARTED: 'text-gray-600',
      IN_PROGRESS: 'text-[#a657f0]',
      COMPLETED: 'text-green-800',
      NOT_APPLICABLE: 'text-slate-600'
    },
    description: 'Create stunning design concepts, mood boards, and material selections'
  },
  THREE_D: {
    name: '3D Rendering',
    icon: '🎥', 
    color: PHASE_COLORS.THREE_D.primary, // #f6762e Orange
    baseColor: 'bg-[#f6762e]',
    colors: {
      NOT_STARTED: 'border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300',
      IN_PROGRESS: 'border-[#f6762e]/40 bg-gradient-to-br from-[#f6762e]/5 to-[#f6762e]/15 shadow-lg ring-2 ring-[#f6762e]/20',
      COMPLETED: 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg ring-2 ring-green-200',
      NOT_APPLICABLE: 'border-slate-200 bg-slate-50 opacity-75 shadow-sm'
    },
    textColors: {
      NOT_STARTED: 'text-gray-600',
      IN_PROGRESS: 'text-[#f6762e]',
      COMPLETED: 'text-green-800',
      NOT_APPLICABLE: 'text-slate-600'
    },
    description: 'Create versioned 3D renderings with team collaboration, notes, and client approval integration'
  },
  CLIENT_APPROVAL: {
    name: 'Client Approval',
    icon: '👥',
    color: PHASE_COLORS.CLIENT_APPROVAL.primary, // #14b8a6 Teal
    baseColor: 'bg-[#14b8a6]',
    colors: {
      NOT_STARTED: 'border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300',
      IN_PROGRESS: 'border-[#14b8a6]/40 bg-gradient-to-br from-[#14b8a6]/5 to-[#14b8a6]/15 shadow-lg ring-2 ring-[#14b8a6]/20',
      COMPLETED: 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg ring-2 ring-green-200',
      NOT_APPLICABLE: 'border-slate-200 bg-slate-50 opacity-75 shadow-sm'
    },
    textColors: {
      NOT_STARTED: 'text-gray-600',
      IN_PROGRESS: 'text-[#14b8a6]',
      COMPLETED: 'text-green-800',
      NOT_APPLICABLE: 'text-slate-600'
    },
    description: 'Client review and approval process with presentation materials'
  },
  DRAWINGS: {
    name: 'Drawings',
    icon: '📐',
    color: PHASE_COLORS.DRAWINGS.primary, // #6366ea Indigo
    baseColor: 'bg-[#6366ea]',
    colors: {
      NOT_STARTED: 'border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300',
      IN_PROGRESS: 'border-[#6366ea]/40 bg-gradient-to-br from-[#6366ea]/5 to-[#6366ea]/15 shadow-lg ring-2 ring-[#6366ea]/20',
      COMPLETED: 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg ring-2 ring-green-200',
      NOT_APPLICABLE: 'border-slate-200 bg-slate-50 opacity-75 shadow-sm'
    },
    textColors: {
      NOT_STARTED: 'text-gray-600',
      IN_PROGRESS: 'text-[#6366ea]',
      COMPLETED: 'text-green-800',
      NOT_APPLICABLE: 'text-slate-600'
    },
    description: 'Create detailed technical drawings and construction specifications'
  },
  FFE: {
    name: 'FFE',
    icon: '🛋️',
    color: PHASE_COLORS.FFE.primary, // #e94d97 Pink/Magenta
    baseColor: 'bg-[#e94d97]',
    colors: {
      NOT_STARTED: 'border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300',
      IN_PROGRESS: 'border-[#e94d97]/40 bg-gradient-to-br from-[#e94d97]/5 to-[#e94d97]/15 shadow-lg ring-2 ring-[#e94d97]/20',
      COMPLETED: 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg ring-2 ring-green-200',
      NOT_APPLICABLE: 'border-slate-200 bg-slate-50 opacity-75 shadow-sm'
    },
    textColors: {
      NOT_STARTED: 'text-gray-600',
      IN_PROGRESS: 'text-[#e94d97]',
      COMPLETED: 'text-green-800',
      NOT_APPLICABLE: 'text-slate-600'
    },
    description: 'Premium furniture, fixtures, and equipment sourcing with detailed specifications'
  },
  FLOORPLAN: {
    name: 'Floorplan',
    icon: '📋',
    color: PHASE_COLORS.FLOORPLAN.primary, // #0ea5e9 Sky Blue
    baseColor: 'bg-[#0ea5e9]',
    colors: {
      NOT_STARTED: 'border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300',
      IN_PROGRESS: 'border-[#0ea5e9]/40 bg-gradient-to-br from-[#0ea5e9]/5 to-[#0ea5e9]/15 shadow-lg ring-2 ring-[#0ea5e9]/20',
      COMPLETED: 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg ring-2 ring-green-200',
      NOT_APPLICABLE: 'border-slate-200 bg-slate-50 opacity-75 shadow-sm'
    },
    textColors: {
      NOT_STARTED: 'text-gray-600',
      IN_PROGRESS: 'text-[#0ea5e9]',
      COMPLETED: 'text-green-800',
      NOT_APPLICABLE: 'text-slate-600'
    },
    description: 'Floor plan layouts and spatial planning'
  }
} as const

// Helper functions
export function getStageConfig(stageType: string) {
  return STAGE_CONFIG[stageType as keyof typeof STAGE_CONFIG] || {
    name: 'Unknown Stage',
    icon: '⏳',
    color: '#6b7280',
    baseColor: 'bg-gray-500',
    colors: {
      NOT_STARTED: 'border-gray-200 bg-white',
      IN_PROGRESS: 'border-gray-400 bg-gray-50',
      COMPLETED: 'border-green-400 bg-green-50',
      NOT_APPLICABLE: 'border-slate-200 bg-slate-50 opacity-75 shadow-sm'
    },
    textColors: {
      NOT_STARTED: 'text-gray-500',
      IN_PROGRESS: 'text-gray-700',
      COMPLETED: 'text-green-700',
      NOT_APPLICABLE: 'text-slate-600'
    },
    description: 'Unknown stage type'
  }
}

export function getStageIcon(stageType: string) {
  return getStageConfig(stageType).icon
}

export function getStageColor(stageType: string) {
  return getStageConfig(stageType).baseColor
}

export function getStageHexColor(stageType: string) {
  return getStageConfig(stageType).color
}

export function getStageStatusColor(stageType: string, status: StageStatus) {
  const config = getStageConfig(stageType)
  return config.colors[status] || config.colors.NOT_STARTED
}

export function getStageStatusTextColor(stageType: string, status: StageStatus) {
  const config = getStageConfig(stageType)
  return config.textColors[status] || config.textColors.NOT_STARTED
}

// Map database stage types to workflow stage types
const STAGE_TYPE_MAP = {
  'DESIGN': 'DESIGN_CONCEPT',
  'THREE_D': 'THREE_D',
  'CLIENT_APPROVAL': 'CLIENT_APPROVAL',
  'DRAWINGS': 'DRAWINGS',
  'FFE': 'FFE',
  'FLOORPLAN': 'FLOORPLAN'
} as const

export function getStageName(stageType: string) {
  // Map database stage type to workflow stage type if needed
  const mappedType = STAGE_TYPE_MAP[stageType as keyof typeof STAGE_TYPE_MAP] || stageType
  return getStageConfig(mappedType).name
}

// Total number of workflow stages (used for progress calculations)
export const TOTAL_WORKFLOW_STAGES = WORKFLOW_STAGES.length
