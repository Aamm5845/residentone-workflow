'use client'

import useSWR from 'swr'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatElapsedTime } from '@/contexts/TimerContext'
import { 
  Users, 
  Play, 
  Pause, 
  Clock, 
  FolderOpen, 
  Home, 
  Layers,
  Loader2,
  RefreshCw
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { getStageName } from '@/constants/workflow'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function TeamActivity() {
  const { data, error, isLoading, mutate } = useSWR(
    '/api/timeline/team/active',
    fetcher,
    { 
      refreshInterval: 10000, // Refresh every 10 seconds
      revalidateOnFocus: true
    }
  )

  const team = data?.team || []
  const activeCount = data?.activeCount || 0

  const formatStageType = (type: string) => {
    return getStageName(type)
  }

  const getRoleColor = (role: string) => {
    const colors: Record<string, string> = {
      OWNER: 'bg-purple-100 text-purple-700',
      ADMIN: 'bg-blue-100 text-blue-700',
      DESIGNER: 'bg-pink-100 text-pink-700',
      RENDERER: 'bg-indigo-100 text-indigo-700',
      DRAFTER: 'bg-orange-100 text-orange-700',
      FFE: 'bg-emerald-100 text-emerald-700',
      VIEWER: 'bg-gray-100 text-gray-700'
    }
    return colors[role] || colors.VIEWER
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-600" />
          Team Activity
          {activeCount > 0 && (
            <span className="ml-2 text-sm font-normal text-gray-500">
              {activeCount} active now
            </span>
          )}
        </CardTitle>
        <Button 
          variant="ghost" 
          size="sm" 
          onClick={() => mutate()}
          className="text-gray-500"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-cyan-600" />
          </div>
        ) : team.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Users className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p>No team members found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {team.map((member: any) => (
              <div 
                key={member.user.id}
                className={cn(
                  "p-4 rounded-lg border transition-all",
                  member.isTracking 
                    ? member.isPaused 
                      ? "border-yellow-200 bg-yellow-50" 
                      : "border-green-200 bg-green-50"
                    : "border-gray-200 bg-gray-50"
                )}
              >
                {/* User Info */}
                <div className="flex items-center gap-3 mb-3">
                  {member.user.image ? (
                    <img 
                      src={member.user.image} 
                      alt={member.user.name}
                      className="w-10 h-10 rounded-full object-cover border-2 border-white shadow"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
                      <span className="text-white font-semibold">
                        {member.user.name?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">
                      {member.user.name || member.user.email}
                    </div>
                    <div className={cn(
                      "text-xs px-2 py-0.5 rounded-full inline-block",
                      getRoleColor(member.user.role)
                    )}>
                      {member.user.role}
                    </div>
                  </div>
                  
                  {/* Status Indicator */}
                  {member.isTracking ? (
                    <div className="flex items-center gap-2">
                      {member.isPaused ? (
                        <Pause className="w-5 h-5 text-yellow-600" />
                      ) : (
                        <div className="flex items-center gap-1">
                          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          <Play className="w-4 h-4 text-green-600" />
                        </div>
                      )}
                    </div>
                  ) : (
                    <Clock className="w-5 h-5 text-gray-400" />
                  )}
                </div>

                {/* Activity Details */}
                {member.isTracking && member.activeEntry ? (
                  <div className="space-y-2">
                    {/* Timer */}
                    <div className={cn(
                      "text-2xl font-mono font-bold",
                      member.isPaused ? "text-yellow-700" : "text-green-700"
                    )}>
                      {formatElapsedTime(member.activeEntry.elapsedSeconds || 0)}
                    </div>
                    
                    {/* Project/Room/Stage */}
                    <div className="space-y-1 text-sm">
                      {member.activeEntry.project && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <FolderOpen className="w-3 h-3" />
                          {member.activeEntry.project.name}
                        </div>
                      )}
                      {member.activeEntry.room && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <Home className="w-3 h-3" />
                          {member.activeEntry.room.name || member.activeEntry.room.type.replace(/_/g, ' ')}
                        </div>
                      )}
                      {member.activeEntry.stage && (
                        <div className="flex items-center gap-1 text-gray-600">
                          <Layers className="w-3 h-3" />
                          {formatStageType(member.activeEntry.stage.type)}
                        </div>
                      )}
                    </div>

                    {/* Description */}
                    {member.activeEntry.description && (
                      <p className="text-sm text-gray-500 italic">
                        "{member.activeEntry.description}"
                      </p>
                    )}

                    {/* Status Badge */}
                    <div className={cn(
                      "text-xs font-medium",
                      member.isPaused ? "text-yellow-600" : "text-green-600"
                    )}>
                      {member.isPaused ? 'Paused' : 'Working'}
                    </div>
                  </div>
                ) : (
                  <div className="text-sm text-gray-500 italic">
                    Not tracking time
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
