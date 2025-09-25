import { getRoomFFEConfig, calculateFFECompletionStatus, FFEItemTemplate } from '@/lib/constants/room-ffe-config'

export interface FFEValidationResult {
  isComplete: boolean
  isReadyForCompletion: boolean
  completionPercentage: number
  requiredItems: {
    total: number
    completed: number
    missing: FFEItemTemplate[]
  }
  optionalItems: {
    total: number
    completed: number
  }
  highPriorityItems: {
    total: number
    completed: number
    missing: FFEItemTemplate[]
  }
  issues: FFEValidationIssue[]
  recommendations: string[]
  estimatedBudget: {
    total: number
    committed: number
    remaining: number
  }
  timeline: {
    longestLeadTime: number
    averageLeadTime: number
    readyForOrderCount: number
  }
}

export interface FFEValidationIssue {
  type: 'ERROR' | 'WARNING' | 'INFO'
  itemId?: string
  itemName?: string
  message: string
  severity: 'HIGH' | 'MEDIUM' | 'LOW'
  canIgnore: boolean
  resolution?: string
}

export interface FFEItemStatusSummary {
  itemId: string
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED' | 'NOT_NEEDED'
  hasNotes: boolean
  hasSupplierLink: boolean
  hasPrice: boolean
  actualPrice?: number
  subItemsCompleted: string[]
}

/**
 * Validates FFE completion for a room and provides detailed analysis
 */
export function validateFFECompletion(
  roomType: string,
  itemStatuses: Record<string, FFEItemStatusSummary>
): FFEValidationResult {
  const config = getRoomFFEConfig(roomType)
  
  if (!config) {
    return {
      isComplete: false,
      isReadyForCompletion: false,
      completionPercentage: 0,
      requiredItems: { total: 0, completed: 0, missing: [] },
      optionalItems: { total: 0, completed: 0 },
      highPriorityItems: { total: 0, completed: 0, missing: [] },
      issues: [{
        type: 'ERROR',
        message: `No FFE configuration found for room type: ${roomType}`,
        severity: 'HIGH',
        canIgnore: false,
        resolution: 'Contact system administrator to add room type configuration'
      }],
      recommendations: [],
      estimatedBudget: { total: 0, committed: 0, remaining: 0 },
      timeline: { longestLeadTime: 0, averageLeadTime: 0, readyForOrderCount: 0 }
    }
  }

  const issues: FFEValidationIssue[] = []
  const recommendations: string[] = []
  
  // Categorize items
  const requiredItems = config.items.filter(item => item.isRequired)
  const optionalItems = config.items.filter(item => !item.isRequired)
  const highPriorityItems = config.items.filter(item => item.priority === 'high')
  
  // Count completions
  const completedRequired = requiredItems.filter(item => 
    itemStatuses[item.id]?.status === 'COMPLETED'
  )
  const completedOptional = optionalItems.filter(item => 
    itemStatuses[item.id]?.status === 'COMPLETED'
  )
  const completedHighPriority = highPriorityItems.filter(item => 
    itemStatuses[item.id]?.status === 'COMPLETED'
  )
  
  // Find missing items
  const missingRequired = requiredItems.filter(item => 
    !itemStatuses[item.id] || itemStatuses[item.id].status !== 'COMPLETED'
  )
  const missingHighPriority = highPriorityItems.filter(item => 
    !itemStatuses[item.id] || itemStatuses[item.id].status !== 'COMPLETED'
  )
  
  // Calculate completion percentage
  const totalItems = config.items.length
  const completedItems = config.items.filter(item => 
    itemStatuses[item.id]?.status === 'COMPLETED'
  ).length
  const completionPercentage = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
  
  // Budget analysis
  let estimatedTotal = 0
  let committedAmount = 0
  
  config.items.forEach(item => {
    if (item.estimatedPrice) {
      estimatedTotal += item.estimatedPrice
    }
    const status = itemStatuses[item.id]
    if (status?.actualPrice) {
      committedAmount += status.actualPrice
    } else if (status?.status === 'COMPLETED' && item.estimatedPrice) {
      committedAmount += item.estimatedPrice
    }
  })
  
  // Timeline analysis
  const completedItemsWithLeadTime = config.items.filter(item => {
    const status = itemStatuses[item.id]
    return status?.status === 'COMPLETED' && item.leadTimeWeeks
  })
  
  const leadTimes = completedItemsWithLeadTime.map(item => item.leadTimeWeeks!).filter(Boolean)
  const longestLeadTime = leadTimes.length > 0 ? Math.max(...leadTimes) : 0
  const averageLeadTime = leadTimes.length > 0 ? leadTimes.reduce((a, b) => a + b, 0) / leadTimes.length : 0
  
  const readyForOrderCount = config.items.filter(item => {
    const status = itemStatuses[item.id]
    return status?.status === 'COMPLETED' && status.hasSupplierLink && status.hasPrice
  }).length
  
  // Validation logic
  const completionStatus = calculateFFECompletionStatus(roomType, Object.keys(itemStatuses))
  
  // Check for critical issues
  missingRequired.forEach(item => {
    issues.push({
      type: 'ERROR',
      itemId: item.id,
      itemName: item.name,
      message: `Required item "${item.name}" is not completed`,
      severity: 'HIGH',
      canIgnore: false,
      resolution: 'Complete this required item before finalizing FFE phase'
    })
  })
  
  // Check for dependencies
  config.items.forEach(item => {
    if (item.conditionalOn && item.conditionalOn.length > 0) {
      const status = itemStatuses[item.id]
      if (status?.status === 'COMPLETED') {
        const missingDependencies = item.conditionalOn.filter(depId => 
          !itemStatuses[depId] || itemStatuses[depId].status !== 'COMPLETED'
        )
        
        if (missingDependencies.length > 0) {
          const depNames = missingDependencies.map(depId => 
            config.items.find(i => i.id === depId)?.name || depId
          ).join(', ')
          
          issues.push({
            type: 'WARNING',
            itemId: item.id,
            itemName: item.name,
            message: `Item "${item.name}" is completed but depends on: ${depNames}`,
            severity: 'MEDIUM',
            canIgnore: true,
            resolution: 'Complete the dependent items or verify if they are not needed'
          })
        }
      }
    }
  })
  
  // Check for incomplete sub-items
  config.items.forEach(item => {
    if (item.subItems && item.subItems.length > 0) {
      const status = itemStatuses[item.id]
      if (status?.status === 'COMPLETED') {
        const requiredSubItems = item.subItems.filter(sub => sub.isRequired)
        const completedSubItems = status.subItemsCompleted || []
        const missingSubItems = requiredSubItems.filter(sub => 
          !completedSubItems.includes(sub.id)
        )
        
        if (missingSubItems.length > 0) {
          issues.push({
            type: 'WARNING',
            itemId: item.id,
            itemName: item.name,
            message: `Item "${item.name}" is marked complete but missing sub-items: ${missingSubItems.map(s => s.name).join(', ')}`,
            severity: 'MEDIUM',
            canIgnore: true,
            resolution: 'Review and complete all required specifications'
          })
        }
      }
    }
  })
  
  // Check for missing prices on completed items
  config.items.forEach(item => {
    const status = itemStatuses[item.id]
    if (status?.status === 'COMPLETED' && !status.hasPrice && item.estimatedPrice) {
      issues.push({
        type: 'INFO',
        itemId: item.id,
        itemName: item.name,
        message: `Completed item "${item.name}" is missing actual price information`,
        severity: 'LOW',
        canIgnore: true,
        resolution: 'Add actual price for better budget tracking'
      })
    }
  })
  
  // Generate recommendations
  if (missingHighPriority.length > 0) {
    recommendations.push(`Focus on ${missingHighPriority.length} high-priority items: ${missingHighPriority.slice(0, 3).map(i => i.name).join(', ')}`)
  }
  
  if (readyForOrderCount < completedItems) {
    recommendations.push(`${completedItems - readyForOrderCount} completed items are missing supplier links or pricing`)
  }
  
  if (longestLeadTime > 12) {
    recommendations.push(`Some items have lead times over 12 weeks - consider ordering early`)
  }
  
  if (committedAmount > estimatedTotal * 1.1) {
    recommendations.push(`Actual costs are ${Math.round(((committedAmount - estimatedTotal) / estimatedTotal) * 100)}% over budget`)
  }
  
  // Determine completion status
  const criticalIssues = issues.filter(i => i.type === 'ERROR' && !i.canIgnore)
  const isComplete = completionStatus.isComplete && criticalIssues.length === 0
  const isReadyForCompletion = completionStatus.progress >= 80 && missingRequired.length === 0
  
  return {
    isComplete,
    isReadyForCompletion,
    completionPercentage,
    requiredItems: {
      total: requiredItems.length,
      completed: completedRequired.length,
      missing: missingRequired
    },
    optionalItems: {
      total: optionalItems.length,
      completed: completedOptional.length
    },
    highPriorityItems: {
      total: highPriorityItems.length,
      completed: completedHighPriority.length,
      missing: missingHighPriority
    },
    issues,
    recommendations,
    estimatedBudget: {
      total: estimatedTotal,
      committed: committedAmount,
      remaining: estimatedTotal - committedAmount
    },
    timeline: {
      longestLeadTime,
      averageLeadTime: Math.round(averageLeadTime),
      readyForOrderCount
    }
  }
}

/**
 * Generates a completion report summary
 */
export function generateFFECompletionReport(validation: FFEValidationResult): string {
  const lines: string[] = []
  
  lines.push(`FFE Phase Completion: ${validation.completionPercentage}%`)
  lines.push(`Required Items: ${validation.requiredItems.completed}/${validation.requiredItems.total}`)
  
  if (validation.issues.length > 0) {
    const criticalCount = validation.issues.filter(i => i.severity === 'HIGH').length
    const warningCount = validation.issues.filter(i => i.severity === 'MEDIUM').length
    lines.push(`Issues: ${criticalCount} critical, ${warningCount} warnings`)
  }
  
  if (validation.estimatedBudget.total > 0) {
    const budgetUsed = Math.round((validation.estimatedBudget.committed / validation.estimatedBudget.total) * 100)
    lines.push(`Budget: ${budgetUsed}% committed ($${validation.estimatedBudget.committed.toLocaleString()})`)
  }
  
  if (validation.timeline.longestLeadTime > 0) {
    lines.push(`Timeline: Up to ${validation.timeline.longestLeadTime} weeks lead time`)
  }
  
  return lines.join('\n')
}

/**
 * Checks if FFE phase can be force-completed with warnings
 */
export function canForceComplete(validation: FFEValidationResult): {
  canForce: boolean
  warnings: string[]
  blockers: string[]
} {
  const blockers: string[] = []
  const warnings: string[] = []
  
  // Critical blockers that prevent force completion
  validation.issues.forEach(issue => {
    if (issue.type === 'ERROR' && !issue.canIgnore) {
      blockers.push(issue.message)
    } else if (issue.severity === 'HIGH') {
      warnings.push(issue.message)
    }
  })
  
  // Additional warnings for force completion
  if (validation.requiredItems.missing.length > 0) {
    warnings.push(`${validation.requiredItems.missing.length} required items are incomplete`)
  }
  
  if (validation.completionPercentage < 50) {
    warnings.push(`Only ${validation.completionPercentage}% of items are completed`)
  }
  
  return {
    canForce: blockers.length === 0,
    warnings,
    blockers
  }
}

/**
 * Validates individual FFE items for detailed feedback
 */
export function validateFFEItem(
  item: FFEItemTemplate,
  status?: FFEItemStatusSummary
): {
  isValid: boolean
  issues: string[]
  recommendations: string[]
  completionScore: number
} {
  const issues: string[] = []
  const recommendations: string[] = []
  let completionScore = 0
  
  if (!status || status.status === 'NOT_STARTED') {
    issues.push('Item has not been started')
    return { isValid: false, issues, recommendations, completionScore: 0 }
  }
  
  if (status.status === 'NOT_NEEDED') {
    if (item.isRequired) {
      issues.push('Required item is marked as not needed')
      return { isValid: false, issues, recommendations, completionScore: 0 }
    }
    return { isValid: true, issues, recommendations, completionScore: 100 }
  }
  
  if (status.status === 'COMPLETED') {
    completionScore = 70 // Base score for completion
    
    // Check sub-items if applicable
    if (item.subItems && item.subItems.length > 0) {
      const requiredSubItems = item.subItems.filter(sub => sub.isRequired)
      const completedSubItems = status.subItemsCompleted || []
      const missingSubItems = requiredSubItems.filter(sub => 
        !completedSubItems.includes(sub.id)
      )
      
      if (missingSubItems.length > 0) {
        issues.push(`Missing required specifications: ${missingSubItems.map(s => s.name).join(', ')}`)
        completionScore -= 20
      } else {
        completionScore += 10
      }
    }
    
    // Check for additional information
    if (status.hasNotes) completionScore += 5
    if (status.hasSupplierLink) completionScore += 10
    if (status.hasPrice) completionScore += 5
    
    // Recommendations for improvement
    if (!status.hasSupplierLink) {
      recommendations.push('Add supplier link for easier ordering')
    }
    if (!status.hasPrice) {
      recommendations.push('Add actual price for budget tracking')
    }
    if (!status.hasNotes && (item.subItems?.length || 0) > 0) {
      recommendations.push('Add notes with specific details and requirements')
    }
  } else {
    // In progress
    completionScore = 30
    recommendations.push('Complete item selection and specification')
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    recommendations,
    completionScore: Math.min(completionScore, 100)
  }
}