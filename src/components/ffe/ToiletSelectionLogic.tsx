'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { CheckCircle, Circle, Clock, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getToiletTaskCount, getToiletSubTasks } from '@/lib/ffe/bathroom-template'
import type { FFESubItem } from '@/lib/ffe/bathroom-template'

interface ToiletStatus {
  selectionType: 'standard' | 'custom' | null
  standardOption?: string
  customOptions?: Record<string, string>
  state: 'pending' | 'in_progress' | 'completed' | 'not_needed'
  completedTasks: number
  totalTasks: number
}

interface ToiletSelectionLogicProps {
  initialStatus?: ToiletStatus
  onStatusUpdate: (status: ToiletStatus) => void
  disabled?: boolean
}

// Removed hardcoded standard options - should be user-managed
const STANDARD_OPTIONS: string[] = []

// Removed hardcoded wall mount sub-items - should be user-managed
const WALL_MOUNT_SUB_ITEMS: any[] = []

export default function ToiletSelectionLogic({ 
  initialStatus,
  onStatusUpdate,
  disabled = false
}: ToiletSelectionLogicProps) {
  const [status, setStatus] = useState<ToiletStatus>(() => {
    if (initialStatus) return initialStatus
    
    return {
      selectionType: null,
      state: 'pending',
      completedTasks: 0,
      totalTasks: 0
    }
  })

  // Calculate progress when status changes
  useEffect(() => {
    let completedTasks = 0
    let totalTasks = 0

    if (status.selectionType === 'standard') {
      totalTasks = 1
      completedTasks = status.standardOption ? 1 : 0
    } else if (status.selectionType === 'custom') {
      totalTasks = 4
      completedTasks = WALL_MOUNT_SUB_ITEMS.filter(item => 
        status.customOptions?.[item.id]
      ).length
    }

    const updatedStatus = {
      ...status,
      completedTasks,
      totalTasks,
      state: determineState(completedTasks, totalTasks, status.selectionType)
    }

    setStatus(updatedStatus)
    onStatusUpdate(updatedStatus)
  }, [status.selectionType, status.standardOption, status.customOptions])

  const determineState = (completed: number, total: number, selectionType: string | null): ToiletStatus['state'] => {
    if (!selectionType) return 'pending'
    if (completed === 0) return 'pending'
    if (completed < total) return 'in_progress'
    return 'completed'
  }

  const handleSelectionTypeChange = (type: 'standard' | 'custom') => {
    setStatus(prev => ({
      ...prev,
      selectionType: type,
      standardOption: type === 'standard' ? prev.standardOption : undefined,
      customOptions: type === 'custom' ? prev.customOptions || {} : undefined
    }))
  }

  const handleStandardOptionChange = (option: string) => {
    setStatus(prev => ({
      ...prev,
      standardOption: option
    }))
  }

  const handleCustomOptionChange = (subItemId: string, value: string) => {
    setStatus(prev => ({
      ...prev,
      customOptions: {
        ...prev.customOptions,
        [subItemId]: value
      }
    }))
  }

  const getStatusIcon = () => {
    switch (status.state) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'in_progress':
        return <Clock className="h-5 w-5 text-orange-600" />
      case 'pending':
        return <Circle className="h-5 w-5 text-gray-400" />
      default:
        return <Circle className="h-5 w-5 text-gray-400" />
    }
  }

  const getStatusBadge = () => {
    const variants = {
      completed: 'bg-green-100 text-green-800',
      in_progress: 'bg-orange-100 text-orange-800',
      pending: 'bg-gray-100 text-gray-800',
      not_needed: 'bg-red-100 text-red-800'
    }

    return (
      <Badge className={cn('text-xs', variants[status.state])}>
        {status.state === 'completed' && 'Completed'}
        {status.state === 'in_progress' && `${status.completedTasks}/${status.totalTasks} Tasks`}
        {status.state === 'pending' && 'Pending'}
        {status.state === 'not_needed' && 'Not Needed'}
      </Badge>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getStatusIcon()}
            <div>
              <CardTitle className="text-base">Toilet</CardTitle>
              <p className="text-sm text-gray-600">Required item</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {getStatusBadge()}
            {status.selectionType && (
              <Badge variant="outline" className="text-xs">
                {status.selectionType === 'standard' ? 'Freestanding' : 'Wall-Mount'}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Selection Type Choice */}
        <div className="space-y-3">
          <label className="text-sm font-medium">Selection Type</label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Button
              variant={status.selectionType === 'standard' ? 'default' : 'outline'}
              onClick={() => handleSelectionTypeChange('standard')}
              disabled={disabled}
              className="flex flex-col items-start p-4 h-auto space-y-1"
            >
              <span className="font-medium">Freestanding Toilet</span>
              <span className="text-xs text-left opacity-75">Simple selection (1 task)</span>
            </Button>
            
            <Button
              variant={status.selectionType === 'custom' ? 'default' : 'outline'}
              onClick={() => handleSelectionTypeChange('custom')}
              disabled={disabled}
              className="flex flex-col items-start p-4 h-auto space-y-1"
            >
              <span className="font-medium">Wall-Mount Toilet</span>
              <span className="text-xs text-left opacity-75">System installation (4 tasks)</span>
            </Button>
          </div>
        </div>

        {/* Standard Option */}
        {status.selectionType === 'standard' && (
          <div className="space-y-3 border-t pt-4">
            <label className="text-sm font-medium">Select Toilet Model</label>
            <Select 
              value={status.standardOption || ''} 
              onValueChange={handleStandardOptionChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Choose a toilet model..." />
              </SelectTrigger>
              <SelectContent>
                {STANDARD_OPTIONS.map(option => (
                  <SelectItem key={option} value={option}>
                    {option}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {status.standardOption && (
              <div className="flex items-center space-x-2 text-sm text-green-600">
                <CheckCircle className="h-4 w-4" />
                <span>Task completed: Toilet selected</span>
              </div>
            )}
          </div>
        )}

        {/* Custom Options (Wall-Mount) */}
        {status.selectionType === 'custom' && (
          <div className="space-y-4 border-t pt-4">
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium">Wall-Mount System Components</label>
              <span className="text-xs text-gray-600">
                {status.completedTasks} of {status.totalTasks} completed
              </span>
            </div>
            
            <div className="space-y-4">
              {WALL_MOUNT_SUB_ITEMS.map((subItem, index) => {
                const isCompleted = !!status.customOptions?.[subItem.id]
                
                return (
                  <div key={subItem.id} className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {isCompleted ? (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-gray-400" />
                      )}
                      <label className="text-sm font-medium">
                        {index + 1}. {subItem.name}
                      </label>
                      {isCompleted && (
                        <Badge variant="secondary" className="text-xs">
                          Complete
                        </Badge>
                      )}
                    </div>
                    
                    <Select
                      value={status.customOptions?.[subItem.id] || ''}
                      onValueChange={(value) => handleCustomOptionChange(subItem.id, value)}
                      disabled={disabled}
                    >
                      <SelectTrigger className={cn(
                        'ml-6',
                        isCompleted && 'border-green-200 bg-green-50'
                      )}>
                        <SelectValue placeholder={`Choose ${subItem.name.toLowerCase()}...`} />
                      </SelectTrigger>
                      <SelectContent>
                        {subItem.options.map(option => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )
              })}
            </div>

            {/* Progress Indicator */}
            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span>Installation Progress</span>
                <span className="font-medium">{Math.round((status.completedTasks / status.totalTasks) * 100)}%</span>
              </div>
              <div className="mt-2 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-600 transition-all duration-300 ease-in-out"
                  style={{ width: `${(status.completedTasks / status.totalTasks) * 100}%` }}
                />
              </div>
            </div>

            {status.state === 'completed' && (
              <div className="flex items-center space-x-2 text-sm text-green-600 mt-3">
                <CheckCircle className="h-4 w-4" />
                <span>Wall-mount toilet system fully configured</span>
              </div>
            )}
          </div>
        )}

        {/* Helpful Info */}
        {status.selectionType && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-blue-600 mt-0.5" />
              <div className="text-sm text-blue-800">
                {status.selectionType === 'standard' ? (
                  <p>
                    <strong>Freestanding Installation:</strong> Standard floor-mounted toilet installation. 
                    Quick setup with standard plumbing connections.
                  </p>
                ) : (
                  <p>
                    <strong>Wall-Mount Installation:</strong> Requires all 4 components (carrier, bowl, seat, flush plate) 
                    for proper installation. More complex but provides a modern, space-saving solution.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}