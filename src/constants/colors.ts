// StudioFlow Color System
// This is the authoritative source for all brand colors

/**
 * Phase Colors - Used for workflow stages throughout the application
 * Each phase has a primary color and derived variants
 */
export const PHASE_COLORS = {
  DESIGN_CONCEPT: {
    name: 'Design Concept',
    primary: '#a657f0',      // Purple
    light: '#a657f0/10',     // For backgrounds
    medium: '#a657f0/20',    // For hover states
    border: '#a657f0/30',    // For borders
    text: '#7c3aed',         // For readable text (purple-600)
  },
  THREE_D: {
    name: '3D Rendering',
    primary: '#f6762e',      // Orange
    light: '#f6762e/10',
    medium: '#f6762e/20',
    border: '#f6762e/30',
    text: '#ea580c',         // For readable text (orange-600)
  },
  CLIENT_APPROVAL: {
    name: 'Client Approval',
    primary: '#14b8a6',      // Teal
    light: '#14b8a6/10',
    medium: '#14b8a6/20',
    border: '#14b8a6/30',
    text: '#0d9488',         // For readable text (teal-600)
  },
  DRAWINGS: {
    name: 'Drawings',
    primary: '#6366ea',      // Indigo
    light: '#6366ea/10',
    medium: '#6366ea/20',
    border: '#6366ea/30',
    text: '#4f46e5',         // For readable text (indigo-600)
  },
  FFE: {
    name: 'FFE',
    primary: '#e94d97',      // Pink/Magenta
    light: '#e94d97/10',
    medium: '#e94d97/20',
    border: '#e94d97/30',
    text: '#db2777',         // For readable text (pink-600)
  },
} as const

/**
 * Status Colors - Used for indicating state across the application
 */
export const STATUS_COLORS = {
  SUCCESS: {
    primary: '#22c55e',      // Green-500
    light: '#dcfce7',        // Green-100
    text: '#166534',         // Green-800
  },
  WARNING: {
    primary: '#f59e0b',      // Amber-500
    light: '#fef3c7',        // Amber-100
    text: '#92400e',         // Amber-800
  },
  ERROR: {
    primary: '#ef4444',      // Red-500
    light: '#fee2e2',        // Red-100
    text: '#991b1b',         // Red-800
  },
  INFO: {
    primary: '#3b82f6',      // Blue-500
    light: '#dbeafe',        // Blue-100
    text: '#1e40af',         // Blue-800
  },
  NEUTRAL: {
    primary: '#6b7280',      // Gray-500
    light: '#f3f4f6',        // Gray-100
    text: '#374151',         // Gray-700
  },
} as const

/**
 * UI Accent Colors - For buttons, links, and interactive elements
 */
export const UI_COLORS = {
  PRIMARY: '#a657f0',        // Purple (matches Design Concept)
  SECONDARY: '#6366ea',      // Indigo
  ACCENT: '#14b8a6',         // Teal
  HIGHLIGHT: '#f6762e',      // Orange
} as const

/**
 * Helper function to get Tailwind class for a phase color
 */
export function getPhaseColorClass(phase: keyof typeof PHASE_COLORS, variant: 'bg' | 'text' | 'border' | 'ring' = 'bg') {
  const color = PHASE_COLORS[phase].primary
  return `${variant}-[${color}]`
}

/**
 * Helper function to get phase color with opacity for Tailwind
 */
export function getPhaseColorWithOpacity(phase: keyof typeof PHASE_COLORS, opacity: number) {
  const color = PHASE_COLORS[phase].primary
  return `${color}/${opacity}`
}

