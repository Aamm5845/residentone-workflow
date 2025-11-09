'use client'

import React from 'react'
import DesignConceptWorkspaceV2 from '@/components/design/v2/DesignConceptWorkspaceV2'

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
  // Use the V2 workspace with universal item library
  // This provides 83 pre-loaded items, auto-notifications, and enhanced workflow
  return (
    <DesignConceptWorkspaceV2 
      stageId={stage.id}
      roomId={room?.id}
      projectId={project?.id}
    />
  )
}
