'use client'

import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toSafeFilterValue, fromSafeFilterValue, ALL_ANY } from '@/lib/selectSafe'
import { Search } from 'lucide-react'
import { statusConfig, priorityConfig, type TaskStatus, type TaskPriority } from './types'

export interface TaskFiltersState {
  status: string
  priority: string
  assigneeId: string
  roomId: string
  search: string
  projectId?: string
}

interface TaskFiltersProps {
  filters: TaskFiltersState
  onFiltersChange: (filters: TaskFiltersState) => void
  availableUsers?: Array<{ id: string; name: string | null; email: string }>
  availableRooms?: Array<{ id: string; name: string | null; type: string }>
  showProjectFilter?: boolean
  availableProjects?: Array<{ id: string; name: string }>
}

export default function TaskFilters({
  filters,
  onFiltersChange,
  availableUsers,
  availableRooms,
  showProjectFilter = false,
  availableProjects,
}: TaskFiltersProps) {
  const updateFilter = (key: keyof TaskFiltersState, value: string) => {
    onFiltersChange({ ...filters, [key]: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Search */}
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search tasks..."
          value={filters.search}
          onChange={(e) => updateFilter('search', e.target.value)}
          className="pl-8 h-9 text-sm"
        />
      </div>

      {/* Status filter */}
      <Select
        value={toSafeFilterValue(filters.status)}
        onValueChange={(val) => updateFilter('status', fromSafeFilterValue(val))}
      >
        <SelectTrigger className="w-[140px] h-9 text-sm">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_ANY}>All Statuses</SelectItem>
          {(Object.keys(statusConfig) as TaskStatus[]).map((key) => (
            <SelectItem key={key} value={key}>
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${statusConfig[key].dotColor}`}
                />
                {statusConfig[key].label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Priority filter */}
      <Select
        value={toSafeFilterValue(filters.priority)}
        onValueChange={(val) => updateFilter('priority', fromSafeFilterValue(val))}
      >
        <SelectTrigger className="w-[140px] h-9 text-sm">
          <SelectValue placeholder="Priority" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_ANY}>All Priorities</SelectItem>
          {(Object.keys(priorityConfig) as TaskPriority[]).map((key) => (
            <SelectItem key={key} value={key}>
              <span className="flex items-center gap-1.5">
                <span
                  className={`h-2 w-2 rounded-full shrink-0 ${priorityConfig[key].dotColor}`}
                />
                {priorityConfig[key].label}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Assignee filter */}
      {availableUsers && availableUsers.length > 0 && (
        <Select
          value={toSafeFilterValue(filters.assigneeId)}
          onValueChange={(val) => updateFilter('assigneeId', fromSafeFilterValue(val))}
        >
          <SelectTrigger className="w-[150px] h-9 text-sm">
            <SelectValue placeholder="Assignee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ANY}>All Assignees</SelectItem>
            {availableUsers.map((user) => (
              <SelectItem key={user.id} value={user.id}>
                {user.name || user.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Room filter */}
      {availableRooms && availableRooms.length > 0 && (
        <Select
          value={toSafeFilterValue(filters.roomId)}
          onValueChange={(val) => updateFilter('roomId', fromSafeFilterValue(val))}
        >
          <SelectTrigger className="w-[140px] h-9 text-sm">
            <SelectValue placeholder="Room" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ANY}>All Rooms</SelectItem>
            {availableRooms.map((room) => (
              <SelectItem key={room.id} value={room.id}>
                {room.name || room.type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Project filter */}
      {showProjectFilter && availableProjects && availableProjects.length > 0 && (
        <Select
          value={toSafeFilterValue(filters.projectId || '')}
          onValueChange={(val) => updateFilter('projectId', fromSafeFilterValue(val))}
        >
          <SelectTrigger className="w-[150px] h-9 text-sm">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_ANY}>All Projects</SelectItem>
            {availableProjects.map((project) => (
              <SelectItem key={project.id} value={project.id}>
                {project.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  )
}
