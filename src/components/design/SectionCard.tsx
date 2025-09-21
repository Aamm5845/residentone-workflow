'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronRight, CheckCircle2, Clock } from 'lucide-react'

// Placeholder interfaces - will be extended in the next task
interface SectionDefinition {
  id: string
  name: string
  icon: string
  color: string
  description: string
  placeholder: string
}

interface DesignSection {
  id: string
  type: string
  content?: string
  completed: boolean
  createdAt: string
  updatedAt: string
  assets?: any[]
  comments?: any[]
  checklistItems?: any[]
}

interface SectionCardProps {
  sectionDef: SectionDefinition
  section?: DesignSection
  stageId: string
  isExpanded: boolean
  onToggleExpand: () => void
  onDataChange: () => void
  isStageCompleted: boolean
}

export function SectionCard({ 
  sectionDef, 
  section, 
  stageId,
  isExpanded, 
  onToggleExpand, 
  onDataChange,
  isStageCompleted 
}: SectionCardProps) {
  const hasContent = section?.content && section.content.trim().length > 0
  const assetCount = section?.assets?.length || 0
  const commentCount = section?.comments?.length || 0
  const checklistItems = section?.checklistItems?.length || 0
  const completedChecklist = section?.checklistItems?.filter(item => item.completed).length || 0

  return (
    <div className={`border-2 rounded-lg transition-all duration-200 ${
      section?.completed 
        ? 'border-green-400 bg-green-50' 
        : 'border-gray-200 bg-white hover:border-gray-300'
    }`}>
      {/* Section Header */}
      <div className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {/* Expand/Collapse Button */}
            <button
              onClick={onToggleExpand}
              className="p-1 hover:bg-gray-100 rounded transition-colors"
            >
              {isExpanded ? (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronRight className="w-5 h-5 text-gray-400" />
              )}
            </button>
            
            {/* Section Icon */}
            <div className={`w-10 h-10 bg-gradient-to-br ${sectionDef.color} rounded-lg flex items-center justify-center text-white text-lg shadow-sm`}>
              {sectionDef.icon}
            </div>
            
            {/* Section Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h3 className={`font-semibold ${
                  section?.completed ? 'text-green-900' : 'text-gray-900'
                }`}>
                  {sectionDef.name}
                </h3>
                
                {/* Status Indicators */}
                <div className="flex items-center space-x-1">
                  {hasContent && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                      Content
                    </span>
                  )}
                  {assetCount > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                      {assetCount} Files
                    </span>
                  )}
                  {commentCount > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      {commentCount} Notes
                    </span>
                  )}
                  {checklistItems > 0 && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                      {completedChecklist}/{checklistItems} Tasks
                    </span>
                  )}
                </div>
              </div>
              <p className={`text-sm mt-1 ${
                section?.completed ? 'text-green-600' : 'text-gray-600'
              }`}>
                {sectionDef.description}
              </p>
            </div>
          </div>
          
          {/* Completion Toggle */}
          <div className="flex items-center space-x-3">
            <div className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all ${
              section?.completed 
                ? 'bg-green-500 border-green-500 text-white' 
                : 'border-gray-300 hover:border-green-400'
            }`}>
              {section?.completed && (
                <CheckCircle2 className="w-4 h-4" />
              )}
            </div>
            
            <span className={`text-sm font-medium ${
              section?.completed ? 'text-green-700' : 'text-gray-500'
            }`}>
              {section?.completed ? 'Complete' : 'Pending'}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded Content - Placeholder */}
      {isExpanded && (
        <div className="border-t border-gray-100 p-4 bg-gray-50">
          <div className="text-center py-8">
            <Clock className="w-8 h-8 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600 font-medium">Section Content Coming Soon</p>
            <p className="text-sm text-gray-500 mt-1">
              This section will include upload zones, notes, checklists, and tagging functionality.
            </p>
            <p className="text-xs text-gray-400 mt-2">
              Section ID: {section?.id || 'Not created'} • Stage ID: {stageId}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
