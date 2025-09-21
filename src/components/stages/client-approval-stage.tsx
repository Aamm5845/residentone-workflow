'use client'

import ClientApprovalWorkspace from './client-approval/ClientApprovalWorkspace'

export default function ClientApprovalStage({ 
  stage, 
  room, 
  project, 
  onComplete,
  onUpdateSection,
  onAddComment,
  onUploadFile
}: any) {
  return (
    <ClientApprovalWorkspace 
      stage={stage}
      room={room}
      project={project}
      onComplete={onComplete}
      onUpdateSection={onUpdateSection}
    />
  )
}
