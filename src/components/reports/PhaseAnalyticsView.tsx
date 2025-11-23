'use client'

import { useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts'

interface PhaseStats {
  completed: number
  inProgress: number
  pending: number
  notApplicable: number
  total: number
  percentage: number
}

interface ProjectReport {
  id: string
  name: string
  clientName: string
  status: string
  overallCompletion: number
  phases: Record<string, PhaseStats>
  roomCount: number
  updatedAt: string
}

interface Props {
  projects: ProjectReport[]
}

const PHASE_CONFIG = {
  DESIGN_CONCEPT: { label: 'Design Concept', color: '#A855F7' },
  RENDERING: { label: '3D Rendering', color: '#F97316' },
  CLIENT_APPROVAL: { label: 'Client Approval', color: '#3B82F6' },
  DRAWINGS: { label: 'Drawings', color: '#6366F1' },
  FFE: { label: 'FFE', color: '#EC4899' }
}

export function PhaseAnalyticsView({ projects }: Props) {
  // Aggregate phase statistics across all projects
  const phaseAggregates = useMemo(() => {
    const aggregates: Record<string, PhaseStats> = {}
    
    Object.keys(PHASE_CONFIG).forEach(phaseKey => {
      aggregates[phaseKey] = {
        completed: 0,
        inProgress: 0,
        pending: 0,
        notApplicable: 0,
        total: 0,
        percentage: 0
      }
    })

    projects.forEach(project => {
      Object.entries(project.phases).forEach(([key, phase]) => {
        if (aggregates[key]) {
          aggregates[key].completed += phase.completed
          aggregates[key].inProgress += phase.inProgress
          aggregates[key].pending += phase.pending
          aggregates[key].notApplicable += phase.notApplicable
          aggregates[key].total += phase.total
        }
      })
    })

    // Calculate percentages
    Object.keys(aggregates).forEach(key => {
      const agg = aggregates[key]
      const applicableTotal = agg.total - agg.notApplicable
      agg.percentage = applicableTotal > 0 ? Math.round((agg.completed / applicableTotal) * 100) : 0
    })

    return aggregates
  }, [projects])

  // Prepare chart data
  const chartData = useMemo(() => {
    return Object.entries(PHASE_CONFIG).map(([key, config]) => {
      const phase = phaseAggregates[key]
      return {
        name: config.label,
        Completed: phase.completed,
        'In Progress': phase.inProgress,
        Pending: phase.pending,
        'Not Applicable': phase.notApplicable,
        color: config.color
      }
    })
  }, [phaseAggregates])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const total = payload.reduce((sum: number, entry: any) => sum + entry.value, 0)
      return (
        <div className="bg-white px-4 py-3 rounded-lg shadow-lg border border-gray-200">
          <p className="font-semibold text-gray-900 mb-2">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 text-sm">
              <span className="flex items-center gap-2">
                <span 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: entry.color }}
                />
                {entry.name}
              </span>
              <span className="font-semibold">{entry.value}</span>
            </div>
          ))}
          <div className="mt-2 pt-2 border-t border-gray-200 text-sm font-semibold">
            <div className="flex justify-between">
              <span>Total:</span>
              <span>{total}</span>
            </div>
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <div className="space-y-6">
      {/* Overview Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">Phase Status Breakdown</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip content={<CustomTooltip />} />
              <Legend />
              <Bar dataKey="Completed" stackId="a" fill="#10B981" />
              <Bar dataKey="In Progress" stackId="a" fill="#3B82F6" />
              <Bar dataKey="Pending" stackId="a" fill="#F97316" />
              <Bar dataKey="Not Applicable" stackId="a" fill="#6B7280" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Detailed Phase Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Object.entries(PHASE_CONFIG).map(([key, config]) => {
          const phase = phaseAggregates[key]
          const applicableTotal = phase.total - phase.notApplicable
          
          return (
            <div key={key} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900">{config.label}</h3>
                <div 
                  className="w-3 h-3 rounded-full" 
                  style={{ backgroundColor: config.color }}
                />
              </div>

              {/* Progress Circle */}
              <div className="flex items-center justify-center mb-6">
                <div className="relative w-32 h-32">
                  <svg className="transform -rotate-90 w-32 h-32">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="#E5E7EB"
                      strokeWidth="8"
                      fill="none"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke={config.color}
                      strokeWidth="8"
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 56}`}
                      strokeDashoffset={`${2 * Math.PI * 56 * (1 - phase.percentage / 100)}`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-2xl font-bold text-gray-900">{phase.percentage}%</span>
                  </div>
                </div>
              </div>

              {/* Statistics */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Rooms</span>
                  <span className="text-sm font-semibold text-gray-900">{phase.total}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-green-500"></span>
                    Completed
                  </span>
                  <span className="text-sm font-semibold text-green-600">{phase.completed}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                    In Progress
                  </span>
                  <span className="text-sm font-semibold text-blue-600">{phase.inProgress}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                    Pending
                  </span>
                  <span className="text-sm font-semibold text-orange-600">{phase.pending}</span>
                </div>
                {phase.notApplicable > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-600 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-gray-400"></span>
                      Not Applicable
                    </span>
                    <span className="text-sm font-semibold text-gray-400">{phase.notApplicable}</span>
                  </div>
                )}
              </div>

              {/* Completion Rate */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Completion Rate</span>
                  <span className="font-semibold" style={{ color: config.color }}>
                    {phase.completed}/{applicableTotal}
                  </span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
