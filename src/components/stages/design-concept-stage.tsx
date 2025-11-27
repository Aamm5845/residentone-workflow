'use client'

import React from 'react'
import DesignConceptWorkspace from '@/components/design/v2/DesignConceptWorkspace'

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
  return (
    <DesignConceptWorkspace 
      stageId={stage.id}
      roomId={room?.id}
      projectId={project?.id}
    />
  )
}
