// Workflow constants for interior design project stages
// This is the authoritative source for all workflow-related logic

export const WORKFLOW_STAGES = [
  'DESIGN_CONCEPT',
  'RENDERING', 
  'CLIENT_APPROVAL',
  'DRAWINGS',
  'FFE'
] as const

export type WorkflowStageType = typeof WORKFLOW_STAGES[number]

// Stage status types
export type StageStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'

export const STAGE_CONFIG = {
  DESIGN_CONCEPT: {
    name: 'Design Concept',
    icon: '🎨',
    baseColor: 'bg-gradient-to-r from-purple-500 to-pink-500',
    colors: {
      NOT_STARTED: 'border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300',
      IN_PROGRESS: 'border-purple-400 bg-gradient-to-br from-purple-50 to-pink-50 shadow-lg ring-2 ring-purple-200',
      COMPLETED: 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg ring-2 ring-green-200'
    },
    textColors: {
      NOT_STARTED: 'text-gray-600',
      IN_PROGRESS: 'text-purple-800',
      COMPLETED: 'text-green-800'
    },
    description: 'Create stunning design concepts, mood boards, and material selections'
  },
  RENDERING: {
    name: '3D Rendering Workspace',
    icon: '🎥', 
    baseColor: 'bg-gradient-to-r from-blue-500 to-cyan-500',
    colors: {
      NOT_STARTED: 'border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300',
      IN_PROGRESS: 'border-blue-400 bg-gradient-to-br from-blue-50 to-cyan-50 shadow-lg ring-2 ring-blue-200',
      COMPLETED: 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg ring-2 ring-green-200'
    },
    textColors: {
      NOT_STARTED: 'text-gray-600',
      IN_PROGRESS: 'text-blue-800',
      COMPLETED: 'text-green-800'
    },
    description: 'Create versioned 3D renderings with team collaboration, notes, and client approval integration'
  },
  CLIENT_APPROVAL: {
    name: 'Client Approval',
    icon: '👥',
    baseColor: 'bg-gradient-to-r from-yellow-500 to-amber-500', 
    colors: {
      NOT_STARTED: 'border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300',
      IN_PROGRESS: 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-50 shadow-lg ring-2 ring-yellow-200',
      COMPLETED: 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg ring-2 ring-green-200'
    },
    textColors: {
      NOT_STARTED: 'text-gray-600',
      IN_PROGRESS: 'text-yellow-800',
      COMPLETED: 'text-green-800'
    },
    description: 'Client review and approval process with presentation materials'
  },
  DRAWINGS: {
    name: 'Drawings',
    icon: '📐',
    baseColor: 'bg-gradient-to-r from-orange-500 to-red-500',
    colors: {
      NOT_STARTED: 'border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300',
      IN_PROGRESS: 'border-orange-400 bg-gradient-to-br from-orange-50 to-red-50 shadow-lg ring-2 ring-orange-200',
      COMPLETED: 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg ring-2 ring-green-200'
    },
    textColors: {
      NOT_STARTED: 'text-gray-600',
      IN_PROGRESS: 'text-orange-800',
      COMPLETED: 'text-green-800'
    },
    description: 'Create detailed technical drawings and construction specifications'
  },
  FFE: {
    name: 'FFE',
    icon: '🛌️',
    baseColor: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    colors: {
      NOT_STARTED: 'border-gray-200 bg-white shadow-sm hover:shadow-md transition-all duration-300',
      IN_PROGRESS: 'border-emerald-400 bg-gradient-to-br from-emerald-50 to-teal-50 shadow-lg ring-2 ring-emerald-200',
      COMPLETED: 'border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 shadow-lg ring-2 ring-green-200'
    },
    textColors: {
      NOT_STARTED: 'text-gray-600',
      IN_PROGRESS: 'text-emerald-800',
      COMPLETED: 'text-green-800'
    },
    description: 'Premium furniture, fixtures, and equipment sourcing with detailed specifications'
  }
} as const

// Helper functions
export function getStageConfig(stageType: string) {
  return STAGE_CONFIG[stageType as keyof typeof STAGE_CONFIG] || {
    name: 'Unknown Stage',
    icon: '⏳',
    baseColor: 'bg-gray-500',
    colors: {
      NOT_STARTED: 'border-gray-200 bg-white',
      IN_PROGRESS: 'border-gray-400 bg-gray-50',
      COMPLETED: 'border-green-400 bg-green-50'
    },
    textColors: {
      NOT_STARTED: 'text-gray-500',
      IN_PROGRESS: 'text-gray-700',
      COMPLETED: 'text-green-700'
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

export function getStageStatusColor(stageType: string, status: StageStatus) {
  const config = getStageConfig(stageType)
  return config.colors[status] || config.colors.NOT_STARTED
}

export function getStageStatusTextColor(stageType: string, status: StageStatus) {
  const config = getStageConfig(stageType)
  return config.textColors[status] || config.textColors.NOT_STARTED
}

export function getStageName(stageType: string) {
  return getStageConfig(stageType).name
}

// Total number of workflow stages (used for progress calculations)
export const TOTAL_WORKFLOW_STAGES = WORKFLOW_STAGES.length
