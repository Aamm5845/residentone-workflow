'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ClipboardList, Plus, Settings, Camera, FileImage, CheckSquare, Megaphone } from 'lucide-react'
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
      <div className="bg-gradient-to-r from-white via-white to-indigo-50/50 shadow-sm border-b border-gray-100 relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-purple-100/30 to-indigo-100/30 rounded-full blur-3xl -translate-y-1/2 translate-x-1/3" />
        <div className="absolute bottom-0 left-1/4 w-64 h-64 bg-gradient-to-tr from-cyan-100/20 to-blue-100/20 rounded-full blur-2xl translate-y-1/2" />
        
        <div className="max-w-7xl mx-auto px-6 py-6 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href={`/projects/${project.id}`}>
                <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900 hover:bg-gray-100/80">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Project
                </Button>
              </Link>
            </div>
            
            <div className="flex items-center space-x-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setSurveyDialogOpen(true)}
                className="gap-2 border-cyan-200 text-cyan-700 hover:bg-cyan-50 hover:border-cyan-300"
              >
                <Camera className="w-4 h-4" />
                Start Survey
              </Button>
              <Button 
                size="sm" 
                className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 shadow-md shadow-purple-500/20"
                onClick={() => setCreateUpdateDialogOpen(true)}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Update
              </Button>
            </div>
          </div>
          
          {/* Project Header */}
          <div className="mt-6">
            <div className="flex items-center space-x-5 mb-4">
              <div className="w-16 h-16 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/30 ring-4 ring-white">
                <ClipboardList className="w-8 h-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 bg-clip-text text-transparent">Project Updates</h1>
                <p className="text-lg text-gray-600 mt-1">{project.name} <span className="text-gray-400">•</span> {project.client.name}</p>
                <div className="flex items-center gap-3 mt-3">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-50 to-purple-50 border border-violet-100">
                    <FileImage className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-sm font-medium text-violet-700">{photos.length} photos</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-emerald-50 to-green-50 border border-emerald-100">
                    <CheckSquare className="w-3.5 h-3.5 text-emerald-500" />
                    <span className="text-sm font-medium text-emerald-700">{tasks.length} tasks</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100">
                    <Megaphone className="w-3.5 h-3.5 text-indigo-500" />
                    <span className="text-sm font-medium text-indigo-700">{projectUpdates.filter((u: any) => !u.isInternal).length} updates</span>
                  </div>
                </div>
              </div>
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
