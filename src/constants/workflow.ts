// Workflow constants for interior design project stages
// This is the authoritative source for all workflow-related logic

export const WORKFLOW_STAGES = [
  'DESIGN',
  'THREE_D', 
  'CLIENT_APPROVAL',
  'DRAWINGS' // FFE is now handled as part of the drawings stage
] as const

export type WorkflowStageType = typeof WORKFLOW_STAGES[number]

export const STAGE_CONFIG = {
  DESIGN: {
    name: 'Design',
    icon: '🎨',
    color: 'bg-purple-500',
    description: 'Create design concepts, mood boards, and material selections'
  },
  THREE_D: {
    name: '3D Rendering',
    icon: '🎥', 
    color: 'bg-blue-500',
    description: 'Generate 3D visualizations and renderings'
  },
  CLIENT_APPROVAL: {
    name: 'Client Approval',
    icon: '👥',
    color: 'bg-green-500', 
    description: 'Client review and approval process'
  },
  DRAWINGS: {
    name: 'Technical Drawings & FFE',
    icon: '📐',
    color: 'bg-orange-500',
    description: 'Create technical drawings, specifications, and furniture sourcing'
  }
} as const

// Helper functions
export function getStageConfig(stageType: string) {
  return STAGE_CONFIG[stageType as keyof typeof STAGE_CONFIG] || {
    name: 'Unknown Stage',
    icon: '⏳',
    color: 'bg-gray-500',
    description: 'Unknown stage type'
  }
}

export function getStageIcon(stageType: string) {
  return getStageConfig(stageType).icon
}

export function getStageColor(stageType: string) {
  return getStageConfig(stageType).color
}

export function getStageName(stageType: string) {
  return getStageConfig(stageType).name
}

// Total number of workflow stages (used for progress calculations)
export const TOTAL_WORKFLOW_STAGES = WORKFLOW_STAGES.length