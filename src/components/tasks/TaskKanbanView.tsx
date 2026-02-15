'use client'

import { useMemo } from 'react'
import { cn } from '@/lib/utils'
import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from '@hello-pangea/dnd'
import { TaskCard } from './TaskCard'
import { statusConfig, type TaskData, type TaskStatus } from './types'

interface TaskKanbanViewProps {
  tasks: TaskData[]
  onTaskClick: (task: TaskData) => void
  onStatusChange: (taskId: string, status: TaskStatus) => void
}

const kanbanColumns: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'REVIEW', 'DONE']

export default function TaskKanbanView({
  tasks,
  onTaskClick,
  onStatusChange,
}: TaskKanbanViewProps) {
  const columns = useMemo(() => {
    const grouped = new Map<TaskStatus, TaskData[]>()
    for (const status of kanbanColumns) {
      grouped.set(status, [])
    }
    for (const task of tasks) {
      if (kanbanColumns.includes(task.status)) {
        grouped.get(task.status)!.push(task)
      }
    }
    // Sort tasks within each column by order
    for (const [, columnTasks] of grouped) {
      columnTasks.sort((a, b) => a.order - b.order)
    }
    return grouped
  }, [tasks])

  const handleDragEnd = (result: DropResult) => {
    const { draggableId, destination } = result

    if (!destination) return

    const newStatus = destination.droppableId as TaskStatus
    if (!kanbanColumns.includes(newStatus)) return

    // Find the task to check if status actually changed
    const task = tasks.find((t) => t.id === draggableId)
    if (!task) return

    if (task.status !== newStatus) {
      onStatusChange(draggableId, newStatus)
    }
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-4 gap-4 pb-4 min-h-[400px]">
        {kanbanColumns.map((status) => {
          const config = statusConfig[status]
          const columnTasks = columns.get(status) || []

          return (
            <div
              key={status}
              className="flex flex-col min-w-0"
            >
              {/* Column header */}
              <div className="flex items-center gap-2 px-3 py-2.5 mb-2">
                <span
                  className={cn('h-2.5 w-2.5 rounded-full shrink-0', config.dotColor)}
                />
                <span className="text-sm font-semibold text-gray-700">
                  {config.label}
                </span>
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2 py-0.5 ml-auto">
                  {columnTasks.length}
                </span>
              </div>

              {/* Droppable column */}
              <Droppable droppableId={status}>
                {(provided, snapshot) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className={cn(
                      'flex-1 rounded-lg p-2 space-y-2 transition-colors overflow-y-auto max-h-[calc(100vh-280px)]',
                      snapshot.isDraggingOver
                        ? 'bg-blue-50 border-2 border-dashed border-blue-200'
                        : 'bg-gray-50/50 border border-gray-100'
                    )}
                  >
                    {columnTasks.map((task, index) => (
                      <Draggable
                        key={task.id}
                        draggableId={task.id}
                        index={index}
                      >
                        {(dragProvided, dragSnapshot) => (
                          <div
                            ref={dragProvided.innerRef}
                            {...dragProvided.draggableProps}
                            {...dragProvided.dragHandleProps}
                            className={cn(
                              dragSnapshot.isDragging && 'rotate-2 shadow-lg'
                            )}
                          >
                            <TaskCard
                              task={task}
                              onClick={onTaskClick}
                              onStatusChange={onStatusChange}
                            />
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}

                    {/* Empty column state */}
                    {columnTasks.length === 0 && !snapshot.isDraggingOver && (
                      <div className="flex items-center justify-center py-8 text-xs text-gray-400">
                        Drag tasks here
                      </div>
                    )}
                  </div>
                )}
              </Droppable>
            </div>
          )
        })}
      </div>
    </DragDropContext>
  )
}
