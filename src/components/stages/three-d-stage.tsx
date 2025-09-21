'use client'

import RenderingWorkspace from './RenderingWorkspace'

interface ThreeDStageProps {
  stage: any
  room: any
  project: any
  onComplete: () => void
  onAddComment?: (sectionId: string, content: string, mentions: string[]) => void
  onUploadFile?: (sectionId: string, file: File) => void
  onUpdateSection?: (sectionId: string, content: string) => void
}

export default function ThreeDStage({ 
  stage, 
  room, 
  project, 
  onComplete
}: ThreeDStageProps) {
  return (
    <RenderingWorkspace 
      stage={stage}
      room={room}
      project={project}
      onComplete={onComplete}
    />
  )
}
