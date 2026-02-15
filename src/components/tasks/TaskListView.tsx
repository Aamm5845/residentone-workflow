'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { ChevronRight, ListChecks } from 'lucide-react'
import { TaskRow } from './TaskRow'
import { statusConfig, priorityConfig, type TaskData, type TaskStatus, type TaskPriority } from './types'

interface TaskListViewProps {
  tasks: TaskData[]
  onTaskClick: (task: TaskData) => void
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onPriorityChange: (taskId: string, priority: TaskPriority) => void
  showProject?: boolean
  groupBy?: 'none' | 'project' | 'status' | 'priority'
}

interface TaskGroup {
  key: string
  label: string
  dotColor?: string
  tasks: TaskData[]
}

function groupTasks(
  tasks: TaskData[],
  groupBy: 'none' | 'project' | 'status' | 'priority'
): TaskGroup[] {
  if (groupBy === 'none') {
    return [{ key: 'all', label: 'All Tasks', tasks }]
  }

  if (groupBy === 'project') {
    const projectMap = new Map<string, TaskData[]>()
    const projectNames = new Map<string, string>()

    for (const task of tasks) {
      const key = task.projectId
      if (!projectMap.has(key)) {
        projectMap.set(key, [])
        projectNames.set(key, task.project.name)
      }
      projectMap.get(key)!.push(task)
    }

    return Array.from(projectMap.entries()).map(([key, groupTasks]) => ({
      key,
      label: projectNames.get(key) || 'Unknown Project',
      tasks: groupTasks,
    }))
  }

  if (groupBy === 'status') {
    const statusOrder: TaskStatus[] = [
      'TODO',
      'IN_PROGRESS',
      'REVIEW',
      'DONE',
      'CANCELLED',
    ]
    return statusOrder
      .map((status) => ({
        key: status,
        label: statusConfig[status].label,
        dotColor: statusConfig[status].dotColor,
        tasks: tasks.filter((t) => t.status === status),
      }))
      .filter((group) => group.tasks.length > 0)
  }

  if (groupBy === 'priority') {
    const priorityOrder: TaskPriority[] = [
      'URGENT',
      'HIGH',
      'MEDIUM',
      'NORMAL',
      'LOW',
    ]
    return priorityOrder
      .map((priority) => ({
        key: priority,
        label: priorityConfig[priority].label,
        dotColor: priorityConfig[priority].dotColor,
        tasks: tasks.filter((t) => t.priority === priority),
      }))
      .filter((group) => group.tasks.length > 0)
  }

  return [{ key: 'all', label: 'All Tasks', tasks }]
}

function ListHeader({ showProject }: { showProject?: boolean }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 bg-gray-50/80 text-xs font-medium text-gray-500 uppercase tracking-wider">
      <div className="w-5 shrink-0" /> {/* Status circle */}
      <div className="flex-1 min-w-0">Title</div>
      {showProject && (
        <div className="hidden sm:block shrink-0 w-[120px]">Project</div>
      )}
      <div className="hidden sm:block shrink-0 w-[100px]">Assignee</div>
      <div className="hidden md:block shrink-0 w-[90px]">Due Date</div>
      <div className="hidden md:block shrink-0 w-[80px]">Priority</div>
      <div className="hidden lg:block shrink-0 w-[44px]">Subtasks</div>
      <div className="hidden lg:block shrink-0 w-[32px]" /> {/* Comments */}
    </div>
  )
}

function GroupSection({
  group,
  onTaskClick,
  onStatusChange,
  onPriorityChange,
  showProject,
  defaultOpen = true,
}: {
  group: TaskGroup
  onTaskClick: (task: TaskData) => void
  onStatusChange: (taskId: string, status: TaskStatus) => void
  onPriorityChange: (taskId: string, priority: TaskPriority) => void
  showProject?: boolean
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 w-full px-4 py-2.5 bg-gray-50 border-b border-gray-200 hover:bg-gray-100 transition-colors text-left">
        <ChevronRight
          className={cn(
            'h-4 w-4 text-gray-400 transition-transform',
            isOpen && 'rotate-90'
          )}
        />
        {group.dotColor && (
          <span className={cn('h-2.5 w-2.5 rounded-full shrink-0', group.dotColor)} />
        )}
        <span className="text-sm font-semibold text-gray-700">{group.label}</span>
        <span className="text-xs text-gray-400 ml-1">({group.tasks.length})</span>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {group.tasks
          .sort((a, b) => a.order - b.order)
          .map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onClick={onTaskClick}
              onStatusChange={onStatusChange}
              onPriorityChange={onPriorityChange}
              showProject={showProject}
            />
          ))}
      </CollapsibleContent>
    </Collapsible>
  )
}

export default function TaskListView({
  tasks,
  onTaskClick,
  onStatusChange,
  onPriorityChange,
  showProject = false,
  groupBy = 'none',
}: TaskListViewProps) {
  const groups = useMemo(() => groupTasks(tasks, groupBy), [tasks, groupBy])

  if (tasks.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <ListChecks className="h-8 w-8 text-gray-400" />
        </div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No tasks yet</h3>
        <p className="text-sm text-gray-500 max-w-sm">
          Create your first task to start tracking work. Tasks can be assigned,
          prioritized, and organized into projects.
        </p>
      </div>
    )
  }

  if (groupBy === 'none') {
    return (
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <ListHeader showProject={showProject} />
        {tasks
          .sort((a, b) => a.order - b.order)
          .map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onClick={onTaskClick}
              onStatusChange={onStatusChange}
              onPriorityChange={onPriorityChange}
              showProject={showProject}
            />
          ))}
      </div>
    )
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <ListHeader showProject={showProject} />
      {groups.map((group) => (
        <GroupSection
          key={group.key}
          group={group}
          onTaskClick={onTaskClick}
          onStatusChange={onStatusChange}
          onPriorityChange={onPriorityChange}
          showProject={showProject}
        />
      ))}
    </div>
  )
}
