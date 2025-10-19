// FFE System - Complete Furniture, Fixtures, and Equipment Management
// This module provides a comprehensive FFE management system with learning capabilities

// Core validation and completion logic
export {
  validateFFECompletion,
  generateFFECompletionReport,
  canForceCompleteFFE,
  validateFFEItem,
  type FFECompletionResult,
  type FFEValidationIssue,
  type FFECompletionReport
} from './completion-validator'

// Stage management integration
export {
  getFFEStageStatus,
  completeFFEStage,
  resetFFEStage,
  updateRoomFFEProgress,
  checkRoomFFECompletion,
  getFFEStageStats,
  type FFEStageStatus,
  type FFEStageCompletion,
  type FFEStageStats
} from './ffe-stage-manager'

// Learning system for continuous improvement
export {
  recordFFEItemUsage,
  createCustomFFEItem,
  getEnhancedFFERecommendations,
  getFFETemplateStats,
  type FFELearningItem,
  type FFETemplateStats
} from './learning-system'

// Global settings and item library
export {
  getFFEGlobalSettings,
  updateFFEGlobalSettings,
  createFFELibraryItem,
  getFFELibraryItems,
  updateFFELibraryItemUsage,
  getFFELibraryInsights,
  type FFEGlobalSettings,
  type FFEItemLibrary
} from './global-settings'

// Integration hooks and smart recommendations
export {
  handleFFEStatusUpdate,
  getSmartFFERecommendations,
  analyzeFFECompletion,
  exportFFEData
} from './integration'

// Utility functions and constants
export {
  ROOM_FFE_CONFIG,
  FFE_CATEGORIES,
  FFE_PRIORITIES,
  type FFEItemTemplate,
  type FFESubItem,
  type FFECategory
} from '@/lib/constants/room-ffe-config'

// Re-export Prisma types for convenience
export type { FFEStatus, FFEItemStatus } from '@prisma/client'

/**
 * Complete FFE Management System
 * 
 * This module provides a comprehensive solution for managing Furniture, Fixtures, 
 * and Equipment (FFE) in interior design projects. It includes:
 * 
 * 1. **Completion Validation**: Validates FFE completion based on room type and requirements
 * 2. **Stage Management**: Integrates with project stage workflow for FFE phases
 * 3. **Learning System**: Records usage patterns and creates recommendations
 * 4. **Global Settings**: Organization-level settings and item libraries
 * 5. **Smart Integration**: Hooks into status updates and provides intelligent insights
 * 
 * Key Features:
 * - Automatic completion validation with detailed reporting
 * - Learning from project experience to build custom templates
 * - Budget and timeline estimation based on historical data
 * - Supplier tracking and performance analysis
 * - Customizable per-organization settings and workflows
 * - Smart recommendations based on room type and project parameters
 * - Comprehensive analytics and reporting capabilities
 * 
 * Usage Examples:
 * 
 * ```typescript
 * // Validate FFE completion for a room
 * const validation = await validateFFECompletion('room-id')
 * if (validation.isValid) {
 *   await completeFFEStage('stage-id', 'user-id')
 * }
 * 
 * // Get smart recommendations for a room
 * const recommendations = await getSmartFFERecommendations('org-id', 'room-id')
 * 
 * // Record FFE item usage for learning
 * await handleFFEStatusUpdate('room-id', 'item-id', 'IN_PROGRESS', 'COMPLETED', 1200, 8)
 * 
 * // Create custom FFE template
 * const template = await createCustomFFEItem('org-id', 'user-id', {
 *   name: 'Custom Sofa Template',
 *   category: 'furniture',
 *   roomTypes: ['living-room'],
 *   // ... other properties
 * })
 * ```
 */

/**
 * Default configuration for FFE system initialization
 */
export const FFE_SYSTEM_CONFIG = {
  // Validation settings
  validation: {
    allowForceCompletion: true,
    requireAllHighPriority: true,
    budgetVarianceThreshold: 20, // percentage
    timelineVarianceThreshold: 15 // percentage
  },
  
  // Learning system settings
  learning: {
    autoCreateTemplates: true,
    minimumUsageForTemplate: 2,
    successRateThreshold: 0.7
  },
  
  // Integration settings
  integration: {
    recordUsageOnStatusChange: true,
    updateLibraryStats: true,
    generateRecommendations: true
  },
  
  // Default budget multipliers by room type
  budgetMultipliers: {
    'living-room': 1.2,
    'bedroom': 1.0,
    'kitchen': 1.5,
    'bathroom': 1.1,
    'dining-room': 1.0,
    'office': 0.8,
    'guest-room': 0.9
  },
  
  // Default lead times by category (in weeks)
  leadTimes: {
    'furniture': 8,
    'lighting': 6,
    'window-treatments': 4,
    'accessories': 2,
    'artwork': 3,
    'rugs': 4,
    'plants': 1
  }
}

/**
 * Initialize FFE system for an organization
 */
export async function initializeFFESystem(orgId: string, userId: string) {
  try {
    // Ensure global settings exist
    const settings = await getFFEGlobalSettings(orgId)
    
    // Log initialization
    
    return {
      success: true,
      settingsId: settings.id,
      message: 'FFE system initialized successfully'
    }
  } catch (error) {
    console.error('Error initializing FFE system:', error)
    throw new Error('Failed to initialize FFE system')
  }
}