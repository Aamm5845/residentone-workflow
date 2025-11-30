'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Camera } from 'lucide-react'
import { Button } from '@/components/ui/button'
import SiteSurveyDialog from './site-survey/SiteSurveyDialog'
import CreateUpdateDialog from './create-update-dialog'

interface Room {
  id: string
  name: string
  type: string | null
  status: string | null
}

interface Project {
  id: string
  name: string
  client: {
    name: string
  }
  rooms: Room[]
}

interface ProjectUpdatesHeaderProps {
  project: Project
  photos: any[]
  tasks: any[]
  projectUpdates: any[]
  rooms: Room[]
}

export default function ProjectUpdatesHeader({
  project,
  photos,
  tasks,
  projectUpdates,
  rooms
}: ProjectUpdatesHeaderProps) {
  const [surveyDialogOpen, setSurveyDialogOpen] = useState(false)
  const [createUpdateDialogOpen, setCreateUpdateDialogOpen] = useState(false)

  return (
    <>
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <Link href={`/projects/${project.id}`}>
              <Button variant="ghost" size="sm" className="text-gray-500 hover:text-gray-900 -ml-2">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Project
              </Button>
            </Link>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSurveyDialogOpen(true)}
                className="text-gray-600"
              >
                <Camera className="w-4 h-4 mr-2" />
                Start Survey
              </Button>
              <Button 
                size="sm" 
                className="bg-indigo-600 hover:bg-indigo-700"
                onClick={() => setCreateUpdateDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Update
              </Button>
            </div>
          </div>
          
          {/* Project Header */}
          <div className="mt-5">
            <h1 className="text-2xl font-semibold text-gray-900">Project Updates</h1>
            <p className="text-gray-500 mt-1">{project.name} • {project.client.name}</p>
            <div className="flex items-center gap-4 mt-3 text-sm text-gray-500">
              <span>{photos.length} photos</span>
              <span className="text-gray-300">•</span>
              <span>{tasks.length} tasks</span>
              <span className="text-gray-300">•</span>
              <span>{projectUpdates.filter((u: any) => !u.isInternal).length} updates</span>
            </div>
          </div>
        </div>
      </div>

      <SiteSurveyDialog
        open={surveyDialogOpen}
        onOpenChange={setSurveyDialogOpen}
        projectId={project.id}
        projectName={project.name}
        rooms={rooms}
      />

      <CreateUpdateDialog
        open={createUpdateDialogOpen}
        onOpenChange={setCreateUpdateDialogOpen}
        projectId={project.id}
        rooms={rooms}
      />
    </>
  )
}
