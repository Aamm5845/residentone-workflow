'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import DesignStage from './design-stage'
import ThreeDStage from './three-d-stage'
import ClientApprovalStage from './client-approval-stage'
import DrawingsStage from './drawings-stage'
import FFEStage from './ffe-stage'

interface StageDetailClientProps {
  stage: any
}

export default function StageDetailClient({ stage: initialStage }: StageDetailClientProps) {
  const [stage, setStage] = useState(initialStage)
  const router = useRouter()

  const handleStageComplete = async () => {
    try {
      const response = await fetch(`/api/stages/${stage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'complete' })
      })

      if (response.ok) {
        const updatedStage = await response.json()
        
        // Create notification for next stage assignee
        if (updatedStage.room) {
          const nextStageIndex = stage.room.stages.findIndex((s: any) => s.id === stage.id) + 1
          const nextStage = stage.room.stages[nextStageIndex]
          
          if (nextStage?.assignedTo) {
            await fetch('/api/notifications', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                userId: nextStage.assignedTo,
                type: 'STAGE_ASSIGNED',
                title: `New ${nextStage.type.replace('_', ' ')} stage assigned`,
                message: `${stage.room.name || stage.room.type} is ready for ${nextStage.type.replace('_', ' ').toLowerCase()}`,
                relatedId: nextStage.id,
                relatedType: 'STAGE'
              })
            })
          }
        }
        
        // Redirect back to project
        router.push(`/projects/${stage.room.project.id}`)
      }
    } catch (error) {
      console.error('Error completing stage:', error)
    }
  }

  const handleStageReopen = async () => {
    try {
      const response = await fetch(`/api/stages/${stage.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reopen' })
      })

      if (response.ok) {
        const updatedStage = await response.json()
        setStage(updatedStage)
      }
    } catch (error) {
      console.error('Error reopening stage:', error)
    }
  }

  const handleUpdateSection = async (sectionType: string, content: string) => {
    try {
      const response = await fetch(`/api/stages/${stage.id}/sections`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionType, content })
      })

      if (response.ok) {
        const updatedStage = await response.json()
        setStage(updatedStage)
      }
    } catch (error) {
      console.error('Error updating section:', error)
    }
  }

  const handleAddComment = async (sectionId: string, content: string, mentions: string[]) => {
    try {
      const response = await fetch(`/api/stages/${stage.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sectionId, content, mentions })
      })

      if (response.ok) {
        // Refresh stage data
        const stageResponse = await fetch(`/api/stages/${stage.id}`)
        if (stageResponse.ok) {
          const refreshedStage = await stageResponse.json()
          setStage(refreshedStage)
        }
      }
    } catch (error) {
      console.error('Error adding comment:', error)
    }
  }

  const handleUploadFile = async (sectionId: string, file: File) => {
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sectionId', sectionId)

      const response = await fetch(`/api/stages/${stage.id}/upload`, {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        const result = await response.json()
        if (result.stage) {
          setStage(result.stage)
        } else {
          // Fallback to refresh
          const stageResponse = await fetch(`/api/stages/${stage.id}`)
          if (stageResponse.ok) {
            const refreshedStage = await stageResponse.json()
            setStage(refreshedStage)
          }
        }
      }
    } catch (error) {
      console.error('Error uploading file:', error)
    }
  }

  const handleMarkSectionComplete = async (sectionType: string, isComplete: boolean) => {
    try {
      const response = await fetch(`/api/stages/${stage.id}/sections`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sectionType, 
          isComplete,
          action: 'mark_complete'
        })
      })

      if (response.ok) {
        const updatedStage = await response.json()
        setStage(updatedStage)
      }
    } catch (error) {
      console.error('Error marking section complete:', error)
    }
  }

  // Render appropriate stage component based on stage type
  switch (stage.type) {
    case 'DESIGN_CONCEPT':
      return (
        <DesignStage
          stage={stage}
          room={stage.room}
          project={stage.room.project}
          onComplete={handleStageComplete}
          onReopen={handleStageReopen}
          onUpdateSection={handleUpdateSection}
          onAddComment={handleAddComment}
          onUploadFile={handleUploadFile}
          onMarkSectionComplete={handleMarkSectionComplete}
        />
      )
    
    case 'THREE_D':
      return (
        <ThreeDStage
          stage={stage}
          room={stage.room}
          project={stage.room.project}
          onComplete={handleStageComplete}
          onUpdateSection={handleUpdateSection}
          onAddComment={handleAddComment}
          onUploadFile={handleUploadFile}
        />
      )
    
    case 'CLIENT_APPROVAL':
      return (
        <ClientApprovalStage
          stage={stage}
          room={stage.room}
          project={stage.room.project}
          onComplete={handleStageComplete}
          onUpdateSection={handleUpdateSection}
          onAddComment={handleAddComment}
          onUploadFile={handleUploadFile}
        />
      )
    
    case 'DRAWINGS':
      return (
        <DrawingsStage
          stage={stage}
          room={stage.room}
          project={stage.room.project}
          onComplete={handleStageComplete}
          onUpdateSection={handleUpdateSection}
          onAddComment={handleAddComment}
          onUploadFile={handleUploadFile}
        />
      )
    
    case 'FFE':
      return (
        <FFEStage
          stage={stage}
          room={stage.room}
          project={stage.room.project}
          onComplete={handleStageComplete}
          onUpdateSection={handleUpdateSection}
          onAddComment={handleAddComment}
          onUploadFile={handleUploadFile}
        />
      )
    
    default:
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {stage.type.replace('_', ' ').replace(/\b\w/g, (l: string) => l.toUpperCase())} Stage
          </h2>
          <p className="text-gray-600">
            Detailed view for this stage type is coming soon.
          </p>
        </div>
      )
  }
}
