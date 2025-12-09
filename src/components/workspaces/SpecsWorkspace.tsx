'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { 
  ArrowLeft, 
  BookOpen,
  ListChecks,
  Check,
  Clock,
  ChevronRight,
  FileSpreadsheet,
  Package,
  Layers
} from 'lucide-react'
import Link from 'next/link'

interface SpecsWorkspaceProps {
  project: {
    id: string
    name: string
    client?: {
      id: string
      name: string
      email: string
    }
  }
  specBookStatus: 'NOT_STARTED' | 'IN_PROGRESS' | 'COMPLETED'
  totalItems: number
  completedItems: number
}

export function SpecsWorkspace({
  project,
  specBookStatus,
  totalItems,
  completedItems
}: SpecsWorkspaceProps) {
  const router = useRouter()

  const specProgress = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0

  const getOverallStatus = () => {
    if (specBookStatus === 'COMPLETED') return { label: 'Complete', color: 'bg-emerald-500', textColor: 'text-emerald-700' }
    if (specBookStatus === 'IN_PROGRESS') return { label: 'In Progress', color: 'bg-blue-500', textColor: 'text-blue-700' }
    return { label: 'Not Started', color: 'bg-gray-300', textColor: 'text-gray-500' }
  }

  const status = getOverallStatus()

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <Button
            onClick={() => router.push(`/projects/${project.id}`)}
            variant="ghost"
            size="sm"
            className="text-gray-500 hover:text-gray-700 -ml-2 mb-3"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Back to Project
          </Button>
          
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Specs</h1>
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-sm text-gray-500">{project.name}</span>
                <span className="text-gray-300">•</span>
                <div className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${status.color}`} />
                  <span className={`text-sm font-medium ${status.textColor}`}>{status.label}</span>
                </div>
              </div>
            </div>
            
            {totalItems > 0 && (
              <div className="text-right">
                <div className="text-sm text-gray-500">Project Progress</div>
                <div className="text-lg font-semibold text-gray-900">{completedItems} / {totalItems} items</div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        
        {/* Quick Stats */}
        {totalItems > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-gray-700">Overall Specs Completion</span>
              <span className="text-sm font-semibold text-gray-900">{specProgress}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2">
              <div 
                className="bg-emerald-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${specProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Section Cards */}
        <div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* All Specs Card */}
            <Link href={`/projects/${project.id}/specs/all`} className="group block">
              <div className="bg-white rounded-xl border border-gray-200 hover:border-teal-300 p-5 transition-all duration-200 hover:shadow-md group-hover:scale-[1.01] h-full">
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm bg-teal-500">
                    <ListChecks className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 mt-0.5">
                      All Specs
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      View and manage all product specifications in this project
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-teal-500 transition-colors mt-1" />
                </div>

                {/* Stats */}
                <div className="mt-4 flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Package className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{totalItems} items</span>
                  </div>
                  {completedItems > 0 && (
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-sm text-emerald-600">{completedItems} complete</span>
                    </div>
                  )}
                </div>
              </div>
            </Link>

            {/* Spec Book Builder Card */}
            <Link href={`/projects/${project.id}/specs/builder`} className="group block">
              <div className={`bg-white rounded-xl border p-5 transition-all duration-200 hover:shadow-md group-hover:scale-[1.01] h-full ${
                specBookStatus === 'COMPLETED'
                  ? 'border-emerald-200'
                  : specBookStatus === 'IN_PROGRESS'
                  ? 'border-indigo-200'
                  : 'border-gray-200 hover:border-indigo-300'
              }`}>
                <div className="flex items-start gap-4">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center shadow-sm bg-indigo-500">
                    <BookOpen className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      {specBookStatus === 'COMPLETED' && (
                        <Check className="w-4 h-4 text-emerald-500" />
                      )}
                    </div>
                    <h3 className="font-semibold text-gray-900 mt-0.5">
                      Spec Book Builder
                    </h3>
                    <p className="text-sm text-gray-500 mt-1">
                      Generate professional spec book documents for clients
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-indigo-500 transition-colors mt-1" />
                </div>

                {/* Status badge */}
                <div className="mt-4 flex items-center justify-between">
                  <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${
                    specBookStatus === 'COMPLETED' 
                      ? 'bg-emerald-100 text-emerald-700'
                      : specBookStatus === 'IN_PROGRESS'
                      ? 'bg-indigo-100 text-indigo-700'
                      : 'bg-gray-100 text-gray-600'
                  }`}>
                    {specBookStatus === 'COMPLETED' && <Check className="w-3 h-3" />}
                    {specBookStatus === 'IN_PROGRESS' && <Clock className="w-3 h-3" />}
                    {specBookStatus === 'COMPLETED' ? 'Generated' : 
                     specBookStatus === 'IN_PROGRESS' ? 'In Progress' : 'Not Started'}
                  </span>
                  <div className="flex items-center gap-1 text-gray-400">
                    <FileSpreadsheet className="w-4 h-4" />
                    <span className="text-xs">PDF Export</span>
                  </div>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

