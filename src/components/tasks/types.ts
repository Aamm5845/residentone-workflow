export interface TaskUser {
  id: string
  name: string | null
  email: string
  image?: string | null
  role?: string
}

export interface TaskData {
  id: string
  title: string
  description: string | null
  status: 'TODO' | 'IN_PROGRESS' | 'REVIEW' | 'DONE' | 'CANCELLED'
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW' | 'NORMAL'
  projectId: string
  roomId: string | null
  stageId: string | null
  assignedToId: string | null
  createdById: string
  startDate: string | null
  dueDate: string | null
  completedAt: string | null
  order: number
  createdAt: string
  updatedAt: string
  emailLink: string | null
  emailSubject: string | null
  emailFrom: string | null
  project: { id: string; name: string }
  room?: { id: string; name: string | null; type: string } | null
  stage?: { id: string; type: string } | null
  assignedTo: TaskUser | null
  createdBy: TaskUser
  subtasks?: SubtaskData[]
  comments?: CommentData[]
  attachments?: AttachmentData[]
  _count: { subtasks: number; comments: number; attachments: number }
  completedSubtasks?: number
}

export interface SubtaskData {
  id: string
  taskId: string
  title: string
  completed: boolean
  order: number
  completedAt: string | null
}

export interface CommentData {
  id: string
  taskId: string
  authorId: string
  content: string
  createdAt: string
  updatedAt: string
  author: TaskUser
}

export interface AttachmentData {
  id: string
  taskId: string
  name: string
  url: string
  size: number | null
  type: string | null
  uploadedById: string
  createdAt: string
  uploadedBy: { id: string; name: string | null }
}

export const statusConfig = {
  TODO: { label: 'To Do', color: 'bg-gray-100 text-gray-700', dotColor: 'bg-gray-400', icon: 'Circle' },
  IN_PROGRESS: { label: 'In Progress', color: 'bg-blue-100 text-blue-700', dotColor: 'bg-blue-500', icon: 'Play' },
  REVIEW: { label: 'Review', color: 'bg-yellow-100 text-yellow-700', dotColor: 'bg-yellow-500', icon: 'Eye' },
  DONE: { label: 'Done', color: 'bg-green-100 text-green-700', dotColor: 'bg-green-500', icon: 'CheckCircle' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-100 text-red-700', dotColor: 'bg-red-400', icon: 'XCircle' }
} as const

export const priorityConfig = {
  URGENT: { label: 'Urgent', color: 'text-red-600', bgColor: 'bg-red-50', borderColor: 'border-red-200', dotColor: 'bg-red-500' },
  HIGH: { label: 'High', color: 'text-orange-600', bgColor: 'bg-orange-50', borderColor: 'border-orange-200', dotColor: 'bg-orange-500' },
  MEDIUM: { label: 'Medium', color: 'text-yellow-600', bgColor: 'bg-yellow-50', borderColor: 'border-yellow-200', dotColor: 'bg-yellow-500' },
  LOW: { label: 'Low', color: 'text-green-600', bgColor: 'bg-green-50', borderColor: 'border-green-200', dotColor: 'bg-green-500' },
  NORMAL: { label: 'Normal', color: 'text-gray-600', bgColor: 'bg-gray-50', borderColor: 'border-gray-200', dotColor: 'bg-gray-400' }
} as const

export type TaskStatus = keyof typeof statusConfig
export type TaskPriority = keyof typeof priorityConfig
