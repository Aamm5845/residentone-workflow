'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Clock,
  Calendar,
  CheckCircle,
  AlertCircle,
  Camera,
  MessageSquare,
  FileText,
  User,
  Users,
  MapPin,
  Tag,
  Star,
  TrendingUp,
  TrendingDown,
  Pause,
  Play,
  RotateCcw,
  Filter,
  Search,
  Download,
  Share,
  Eye,
  EyeOff,
  ChevronDown,
  ChevronRight,
  ArrowRight,
  Zap,
  Target,
  Award,
  AlertTriangle,
  Info,
  CheckCheck,
  X,
  Plus,
  Edit3
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { format, formatDistanceToNow, isToday, isYesterday, startOfDay, isSameDay } from 'date-fns'

export interface TimelineActivity {
  id: string
  type: 'UPDATE' | 'TASK' | 'PHOTO' | 'MESSAGE' | 'MILESTONE' | 'ASSIGNMENT' | 'DOCUMENT' | 'MEETING' | 'APPROVAL' | 'ISSUE' | 'RESOLUTION'
  title: string
  description?: string
  timestamp: string
  author: {
    id: string
    name: string
    email: string
    image?: string
    role?: string
  }
  metadata?: {
    taskId?: string
    taskTitle?: string
    taskStatus?: string
    photoId?: string
    photoUrl?: string
    photoCount?: number
    updateId?: string
    messageId?: string
    messageContent?: string
    documentId?: string
    documentName?: string
    milestoneId?: string
    milestoneTitle?: string
    assigneeId?: string
    assigneeName?: string
    locationId?: string
    locationName?: string
    priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
    tags?: string[]
    oldStatus?: string
    newStatus?: string
    progress?: number
    estimatedHours?: number
    actualHours?: number
  }
  isImportant?: boolean
  isResolved?: boolean
  relatedActivities?: string[]
}

interface Milestone {
  id: string
  title: string
  description?: string
  dueDate: string
  completedAt?: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE'
  progress: number
  activities: TimelineActivity[]
}

interface TimelineProps {
  activities: TimelineActivity[]
  milestones?: Milestone[]
  currentUser: {
    id: string
    name: string
    email: string
    image?: string
  }
  onActivityClick?: (activity: TimelineActivity) => void
  onMilestoneClick?: (milestone: Milestone) => void
  onExportTimeline?: () => void
  showFilters?: boolean
  showMilestones?: boolean
  compact?: boolean
  maxHeight?: string
}

const activityIcons = {
  UPDATE: FileText,
  TASK: CheckCircle,
  PHOTO: Camera,
  MESSAGE: MessageSquare,
  MILESTONE: Target,
  ASSIGNMENT: Users,
  DOCUMENT: FileText,
  MEETING: Calendar,
  APPROVAL: CheckCheck,
  ISSUE: AlertTriangle,
  RESOLUTION: CheckCircle
}

const activityColors = {
  UPDATE: 'text-blue-600 bg-blue-100',
  TASK: 'text-green-600 bg-green-100',
  PHOTO: 'text-purple-600 bg-purple-100',
  MESSAGE: 'text-gray-600 bg-gray-100',
  MILESTONE: 'text-yellow-600 bg-yellow-100',
  ASSIGNMENT: 'text-indigo-600 bg-indigo-100',
  DOCUMENT: 'text-blue-600 bg-blue-100',
  MEETING: 'text-orange-600 bg-orange-100',
  APPROVAL: 'text-green-600 bg-green-100',
  ISSUE: 'text-red-600 bg-red-100',
  RESOLUTION: 'text-emerald-600 bg-emerald-100'
}

const priorityColors = {
  LOW: 'border-gray-300 bg-gray-50',
  MEDIUM: 'border-yellow-300 bg-yellow-50',
  HIGH: 'border-orange-300 bg-orange-50',
  URGENT: 'border-red-300 bg-red-50'
}

export default function Timeline({
  activities,
  milestones = [],
  currentUser,
  onActivityClick,
  onMilestoneClick,
  onExportTimeline,
  showFilters = true,
  showMilestones = true,
  compact = false,
  maxHeight = 'max-h-96'
}: TimelineProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [authorFilter, setAuthorFilter] = useState<string[]>([])
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')
  const [showOnlyImportant, setShowOnlyImportant] = useState(false)
  const [expandedActivities, setExpandedActivities] = useState<Set<string>>(new Set())
  const [groupByDate, setGroupByDate] = useState(true)

  // Filter activities based on current filters
  const filteredActivities = useMemo(() => {
    return activities.filter(activity => {
      // Search filter
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase()
        const matchesSearch = 
          activity.title.toLowerCase().includes(query) ||
          activity.description?.toLowerCase().includes(query) ||
          activity.author.name.toLowerCase().includes(query) ||
          activity.metadata?.taskTitle?.toLowerCase().includes(query) ||
          activity.metadata?.tags?.some(tag => tag.toLowerCase().includes(query))
        
        if (!matchesSearch) return false
      }

      // Type filter
      if (typeFilter.length > 0 && !typeFilter.includes(activity.type)) {
        return false
      }

      // Author filter
      if (authorFilter.length > 0 && !authorFilter.includes(activity.author.id)) {
        return false
      }

      // Date filter
      if (dateFilter !== 'all') {
        const activityDate = new Date(activity.timestamp)
        const today = new Date()

        switch (dateFilter) {
          case 'today':
            if (!isToday(activityDate)) return false
            break
          case 'week':
            const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000)
            if (activityDate < weekAgo) return false
            break
          case 'month':
            const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000)
            if (activityDate < monthAgo) return false
            break
        }
      }

      // Important filter
      if (showOnlyImportant && !activity.isImportant) {
        return false
      }

      return true
    })
  }, [activities, searchQuery, typeFilter, authorFilter, dateFilter, showOnlyImportant])

  // Group activities by date if enabled
  const groupedActivities = useMemo(() => {
    if (!groupByDate) {
      return [{ date: null, activities: filteredActivities }]
    }

    const groups: { date: Date; activities: TimelineActivity[] }[] = []
    const dateGroups = new Map<string, TimelineActivity[]>()

    filteredActivities.forEach(activity => {
      const date = startOfDay(new Date(activity.timestamp))
      const dateKey = date.toISOString()
      
      if (!dateGroups.has(dateKey)) {
        dateGroups.set(dateKey, [])
      }
      dateGroups.get(dateKey)!.push(activity)
    })

    Array.from(dateGroups.entries())
      .sort(([a], [b]) => new Date(b).getTime() - new Date(a).getTime())
      .forEach(([dateKey, activities]) => {
        groups.push({
          date: new Date(dateKey),
          activities: activities.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )
        })
      })

    return groups
  }, [filteredActivities, groupByDate])

  const toggleActivityExpansion = (activityId: string) => {
    setExpandedActivities(prev => {
      const newSet = new Set(prev)
      if (newSet.has(activityId)) {
        newSet.delete(activityId)
      } else {
        newSet.add(activityId)
      }
      return newSet
    })
  }

  const getRelativeTime = (timestamp: string) => {
    const date = new Date(timestamp)
    if (isToday(date)) {
      return format(date, 'HH:mm')
    } else if (isYesterday(date)) {
      return 'Yesterday'
    } else {
      return formatDistanceToNow(date, { addSuffix: true })
    }
  }

  const formatDateHeader = (date: Date) => {
    if (isToday(date)) {
      return 'Today'
    } else if (isYesterday(date)) {
      return 'Yesterday'
    } else {
      return format(date, 'MMMM d, yyyy')
    }
  }

  const ActivityCard = ({ activity }: { activity: TimelineActivity }) => {
    const Icon = activityIcons[activity.type]
    const isExpanded = expandedActivities.has(activity.id)
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`relative bg-white border rounded-lg p-4 hover:shadow-md transition-all cursor-pointer ${
          activity.metadata?.priority ? priorityColors[activity.metadata.priority] : 'border-gray-200'
        } ${activity.isImportant ? 'ring-2 ring-blue-200' : ''}`}
        onClick={() => onActivityClick?.(activity)}
      >
        {/* Timeline connector line */}
        <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-gray-200 via-gray-300 to-gray-200" />
        
        <div className="flex items-start gap-3">
          {/* Activity icon */}
          <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${activityColors[activity.type]}`}>
            <Icon className="w-5 h-5" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="text-sm font-medium text-gray-900 truncate">
                    {activity.title}
                  </h4>
                  {activity.isImportant && (
                    <Star className="w-4 h-4 text-yellow-500 fill-current flex-shrink-0" />
                  )}
                  {activity.metadata?.priority && (
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${activity.metadata.priority === 'URGENT' ? 'border-red-500 text-red-700' : 
                        activity.metadata.priority === 'HIGH' ? 'border-orange-500 text-orange-700' : 
                        'border-gray-500 text-gray-700'}`}
                    >
                      {activity.metadata.priority.toLowerCase()}
                    </Badge>
                  )}
                </div>

                {activity.description && (
                  <p className="text-sm text-gray-600 mb-2">
                    {activity.description}
                  </p>
                )}

                {/* Metadata */}
                <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                  <div className="flex items-center gap-1">
                    <Avatar className="w-4 h-4">
                      <AvatarImage src={activity.author.image} />
                      <AvatarFallback className="text-xs">
                        {activity.author.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <span>{activity.author.name}</span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>{getRelativeTime(activity.timestamp)}</span>
                  </div>

                  {activity.metadata?.locationName && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      <span>{activity.metadata.locationName}</span>
                    </div>
                  )}
                </div>

                {/* Activity-specific content */}
                {activity.type === 'TASK' && activity.metadata && (
                  <div className="space-y-2">
                    {activity.metadata.taskTitle && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">Task:</span>
                        <span className="text-sm text-gray-600">{activity.metadata.taskTitle}</span>
                        {activity.metadata.newStatus && (
                          <Badge variant="outline" className="text-xs">
                            {activity.metadata.newStatus.toLowerCase()}
                          </Badge>
                        )}
                      </div>
                    )}
                    {activity.metadata.progress !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm">Progress:</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${activity.metadata.progress}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-600">{activity.metadata.progress}%</span>
                      </div>
                    )}
                  </div>
                )}

                {activity.type === 'PHOTO' && activity.metadata?.photoUrl && (
                  <div className="mt-2">
                    <img 
                      src={activity.metadata.photoUrl} 
                      alt="Activity photo"
                      className="w-20 h-20 object-cover rounded-lg"
                    />
                    {activity.metadata.photoCount && activity.metadata.photoCount > 1 && (
                      <Badge className="mt-1 text-xs">
                        +{activity.metadata.photoCount - 1} more
                      </Badge>
                    )}
                  </div>
                )}

                {activity.type === 'MESSAGE' && activity.metadata?.messageContent && (
                  <div className="mt-2 p-2 bg-gray-50 rounded border-l-2 border-gray-300">
                    <p className="text-sm text-gray-700 italic">
                      "{activity.metadata.messageContent}"
                    </p>
                  </div>
                )}

                {/* Tags */}
                {activity.metadata?.tags && activity.metadata.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {activity.metadata.tags.map((tag, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1 ml-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleActivityExpansion(activity.id)
                        }}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-3 h-3" />
                        ) : (
                          <ChevronRight className="w-3 h-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      {isExpanded ? 'Collapse' : 'Expand'} details
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            {/* Expanded details */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-3 pt-3 border-t border-gray-100"
                >
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Full timestamp:</span>
                      <span className="font-mono">{format(new Date(activity.timestamp), 'PPp')}</span>
                    </div>
                    
                    {activity.metadata?.estimatedHours && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Estimated time:</span>
                        <span>{activity.metadata.estimatedHours}h</span>
                      </div>
                    )}
                    
                    {activity.metadata?.actualHours && (
                      <div className="flex items-center justify-between">
                        <span className="text-gray-600">Actual time:</span>
                        <span>{activity.metadata.actualHours}h</span>
                      </div>
                    )}

                    {activity.relatedActivities && activity.relatedActivities.length > 0 && (
                      <div>
                        <span className="text-gray-600">Related activities:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {activity.relatedActivities.map((relatedId) => (
                            <Badge key={relatedId} variant="outline" className="text-xs">
                              #{relatedId.slice(-6)}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {activity.isResolved && (
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span>Resolved</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </motion.div>
    )
  }

  const MilestoneCard = ({ milestone }: { milestone: Milestone }) => {
    const isCompleted = milestone.status === 'COMPLETED'
    const isOverdue = milestone.status === 'OVERDUE'
    
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`bg-white border-2 rounded-lg p-4 mb-6 ${
          isCompleted ? 'border-green-300 bg-green-50' : 
          isOverdue ? 'border-red-300 bg-red-50' : 
          'border-yellow-300 bg-yellow-50'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
              isCompleted ? 'bg-green-600 text-white' : 
              isOverdue ? 'bg-red-600 text-white' : 
              'bg-yellow-600 text-white'
            }`}>
              <Target className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">{milestone.title}</h3>
              <p className="text-sm text-gray-600">{milestone.description}</p>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm font-medium text-gray-900">
              {milestone.progress}% Complete
            </div>
            <div className="text-xs text-gray-500">
              Due: {format(new Date(milestone.dueDate), 'MMM d, yyyy')}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
          <div 
            className={`h-2 rounded-full transition-all ${
              isCompleted ? 'bg-green-500' : 
              isOverdue ? 'bg-red-500' : 
              'bg-yellow-500'
            }`}
            style={{ width: `${milestone.progress}%` }}
          />
        </div>

        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{milestone.activities.length} activities</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onMilestoneClick?.(milestone)}
            className="h-6 text-xs"
          >
            View details <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </div>
      </motion.div>
    )
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">Project Timeline</CardTitle>
          <div className="flex items-center gap-2">
            {onExportTimeline && (
              <Button size="sm" variant="outline" onClick={onExportTimeline}>
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="space-y-3 pt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search activities..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Filter className="w-4 h-4 mr-2" />
                    Type {typeFilter.length > 0 && `(${typeFilter.length})`}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {Object.keys(activityIcons).map(type => (
                    <DropdownMenuItem
                      key={type}
                      onClick={() => {
                        setTypeFilter(prev => 
                          prev.includes(type) 
                            ? prev.filter(t => t !== type)
                            : [...prev, type]
                        )
                      }}
                    >
                      <div className="flex items-center gap-2">
                        {typeFilter.includes(type) ? (
                          <CheckCircle className="w-4 h-4" />
                        ) : (
                          <div className="w-4 h-4" />
                        )}
                        <span>{type.toLowerCase()}</span>
                      </div>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Calendar className="w-4 h-4 mr-2" />
                    {dateFilter === 'all' ? 'All time' : 
                     dateFilter === 'today' ? 'Today' :
                     dateFilter === 'week' ? 'This week' : 'This month'}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  {['all', 'today', 'week', 'month'].map(period => (
                    <DropdownMenuItem
                      key={period}
                      onClick={() => setDateFilter(period as any)}
                    >
                      {period === 'all' ? 'All time' : 
                       period === 'today' ? 'Today' :
                       period === 'week' ? 'This week' : 'This month'}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              <Button
                size="sm"
                variant={showOnlyImportant ? "default" : "outline"}
                onClick={() => setShowOnlyImportant(!showOnlyImportant)}
              >
                <Star className={`w-4 h-4 mr-2 ${showOnlyImportant ? 'fill-current' : ''}`} />
                Important
              </Button>

              <Button
                size="sm"
                variant={groupByDate ? "default" : "outline"}
                onClick={() => setGroupByDate(!groupByDate)}
              >
                Group by date
              </Button>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 p-0">
        <ScrollArea className={`p-4 ${maxHeight}`}>
          <div className="space-y-6">
            {/* Milestones */}
            {showMilestones && milestones.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-gray-900 mb-3">Milestones</h3>
                {milestones.map(milestone => (
                  <MilestoneCard key={milestone.id} milestone={milestone} />
                ))}
                <Separator className="my-6" />
              </div>
            )}

            {/* Activities */}
            <AnimatePresence>
              {groupedActivities.map((group, groupIndex) => (
                <div key={groupIndex}>
                  {group.date && (
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {formatDateHeader(group.date)}
                      </h3>
                      <div className="flex-1 h-px bg-gray-200" />
                    </div>
                  )}
                  
                  <div className="space-y-3 pl-6 border-l-2 border-gray-200">
                    {group.activities.map((activity) => (
                      <ActivityCard key={activity.id} activity={activity} />
                    ))}
                  </div>
                </div>
              ))}
            </AnimatePresence>

            {filteredActivities.length === 0 && (
              <div className="text-center py-12">
                <Clock className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No activities found</h3>
                <p className="text-gray-600">
                  {activities.length === 0 
                    ? "No timeline activities yet. Activities will appear here as work progresses."
                    : "Try adjusting your filters to see more activities."
                  }
                </p>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  )
}
