// Room phases configuration for interior design workflow
// Professional, enterprise-grade phase management

export const ROOM_PHASES = [
  {
    id: 'DESIGN_CONCEPT',
    label: 'Design Concept',
    shortLabel: 'Concept',
    icon: '🎨',
    color: 'purple',
    description: 'Create mood boards, material selections, and design concepts',
    requiredRole: 'DESIGNER'
  },
  {
    id: 'RENDERING',
    label: '3D Rendering',
    shortLabel: '3D',
    icon: '🎥',
    color: 'orange', 
    description: 'Generate photorealistic 3D visualizations',
    requiredRole: 'RENDERER'
  },
  {
    id: 'CLIENT_APPROVAL',
    label: 'Client Approval',
    shortLabel: 'Approval',
    icon: '👥',
    color: 'blue',
    description: 'Client review and approval process',
    requiredRole: null // Any team member can handle client approvals
  },
  {
    id: 'DRAWINGS',
    label: 'Drawings',
    shortLabel: 'Drawings',
    icon: '📐',
    color: 'indigo',
    description: 'Technical drawings and construction documentation',
    requiredRole: 'DRAFTER'
  },
  {
    id: 'FFE',
    label: 'FFE',
    shortLabel: 'FFE',
    icon: '🛌️',
    color: 'pink',
    description: 'Furniture, fixtures, and equipment sourcing',
    requiredRole: 'FFE'
  }
] as const

export type PhaseId = typeof ROOM_PHASES[number]['id']

export const PHASE_STATUS = [
  'PENDING',
  'IN_PROGRESS', 
  'COMPLETE'
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

export function getPhasesByRole(userRole: string) {
  return ROOM_PHASES.filter(phase => 
    !phase.requiredRole || phase.requiredRole === userRole
  )
}

// Tailwind color classes for dynamic styling
export const COLOR_CLASSES = {
  purple: {
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    hover: 'hover:bg-purple-100',
    ring: 'ring-purple-200'
  },
  orange: {
    bg: 'bg-orange-50', 
    text: 'text-orange-800',
    border: 'border-orange-200',
    hover: 'hover:bg-orange-100',
    ring: 'ring-orange-200'
  },
  blue: {
    bg: 'bg-blue-50',
    text: 'text-blue-800', 
    border: 'border-blue-200',
    hover: 'hover:bg-blue-100',
    ring: 'ring-blue-200'
  },
  indigo: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200', 
    hover: 'hover:bg-indigo-100',
    ring: 'ring-indigo-200'
  },
  pink: {
    bg: 'bg-pink-50',
    text: 'text-pink-800',
    border: 'border-pink-200',
    hover: 'hover:bg-pink-100',
    ring: 'ring-pink-200'
  },
  green: {
    bg: 'bg-green-50',
    text: 'text-green-800',
    border: 'border-green-200',
    hover: 'hover:bg-green-100', 
    ring: 'ring-green-200'
  },
  gray: {
    bg: 'bg-gray-50',
    text: 'text-gray-700',
    border: 'border-gray-200',
    hover: 'hover:bg-gray-100',
    ring: 'ring-gray-200'
  }
} as const

export function getColorClasses(color: keyof typeof COLOR_CLASSES) {
  return COLOR_CLASSES[color] || COLOR_CLASSES.gray
}