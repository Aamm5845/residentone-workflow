'use client'

import React from 'react'
import BedroomDesignWorkspace from '@/components/design/BedroomDesignWorkspace'
import DesignConceptWorkspace from '@/components/design/DesignConceptWorkspace'

interface DesignConceptStageProps {
  stage: any
  room: any
  project: any
  onComplete: () => void
  onReopen?: () => void
  onUpdateSection?: (sectionType: string, content: string) => void
  onAddComment?: (sectionId: string, content: string, mentions: string[]) => void
  onUploadFile?: (sectionId: string, file: File) => void
  onMarkSectionComplete?: (sectionType: string, isComplete: boolean) => void
}

export default function DesignConceptStage({
  stage,
  room,
  project,
  onComplete,
  onReopen,
  onUpdateSection,
  onAddComment,
  onUploadFile,
  onMarkSectionComplete
}: DesignConceptStageProps) {
  // Use the enhanced BedroomDesignWorkspace for the new experience
  // This provides the full Pinterest-style reference board, threaded comments,
  // and enhanced functionality as requested
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto">
        {/* Use the enhanced workspace */}
        <BedroomDesignWorkspace
          stageId={stage.id}
          roomId={room?.id || stage.roomId}
          projectId={project?.id || stage.projectId || room?.projectId}
          className="shadow-xl"
        />
      </div>
    </div>
  )

  // Fallback to original workspace if needed
  // return (
  //   <DesignConceptWorkspace
  //     roomId={room?.id || stage.roomId}
  //     projectId={project?.id || stage.projectId || room?.projectId}
  //     stageId={stage.id}
  //     className="shadow-sm"
  //   />
  // )
}
