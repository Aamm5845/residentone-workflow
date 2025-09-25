'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { 
  Bug, 
  Lightbulb, 
  RefreshCw, 
  MessageCircle,
  Search,
  Filter,
  Plus,
  Eye,
  Clock,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'
import IssueModal from './issue-modal'

interface Issue {
  id: string
  title: string
  description: string
  type: 'BUG' | 'FEATURE_REQUEST' | 'UPDATE_REQUEST' | 'GENERAL'
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
  createdAt: string
  updatedAt: string
  resolvedAt?: string
  reporter: {
    id: string
    name: string
    image?: string
    role: string
  }
  assignee?: {
    id: string
    name: string
    image?: string
    role: string
  }
  resolver?: {
    id: string
    name: string
    image?: string
    role: string
  }
  comments: Array<{
    id: string
    content: string
    createdAt: string
    author: {
      id: string
      name: string
      image?: string
      role: string
    }
  }>
}

interface IssueListProps {
  currentUser?: {
    id: string
    name: string
    role: string
  }
}

const ISSUE_TYPES = {
  BUG: { icon: Bug, label: 'Bug Report', color: 'bg-red-100 text-red-800 border-red-200' },
  FEATURE_REQUEST: { icon: Lightbulb, label: 'Feature Request', color: 'bg-blue-100 text-blue-800 border-blue-200' },
  UPDATE_REQUEST: { icon: RefreshCw, label: 'Update Request', color: 'bg-purple-100 text-purple-800 border-purple-200' },
  GENERAL: { icon: MessageCircle, label: 'General', color: 'bg-gray-100 text-gray-800 border-gray-200' }
}

const PRIORITY_COLORS = {
  LOW: 'bg-green-100 text-green-800 border-green-200',
  MEDIUM: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  HIGH: 'bg-orange-100 text-orange-800 border-orange-200',
  URGENT: 'bg-red-100 text-red-800 border-red-200'
}

const STATUS_COLORS = {
  OPEN: 'bg-blue-100 text-blue-800 border-blue-200',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  RESOLVED: 'bg-green-100 text-green-800 border-green-200',
  CLOSED: 'bg-gray-100 text-gray-800 border-gray-200'
}

const STATUS_ICONS = {
  OPEN: Clock,
  IN_PROGRESS: AlertTriangle,
  RESOLVED: CheckCircle,
  CLOSED: CheckCircle
}

export default function IssueList({ currentUser }: IssueListProps) {
  const { data: session } = useSession()
  
  // Use passed currentUser or extract from session
  const user = currentUser || (session?.user ? {
    id: session.user.id,
    name: session.user.name || 'Unknown User',
    role: session.user.role
  } : null)
  
  // Don't render if no user is available
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <p className="text-gray-500">Please sign in to view issues</p>
      </div>
    )
  }
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [priorityFilter, setPriorityFilter] = useState('all')
  const [showModal, setShowModal] = useState(false)
  const [editingIssue, setEditingIssue] = useState<Issue | null>(null)

  const fetchIssues = async () => {
    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (statusFilter !== 'all') params.set('status', statusFilter)
      
      const response = await fetch(`/api/issues?${params}`)
      if (response.ok) {
        const data = await response.json()
        setIssues(data.issues || [])
      }
    } catch (error) {
      console.error('Error fetching issues:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchIssues()
  }, [statusFilter])

  const filteredIssues = issues.filter(issue => {
    const matchesSearch = !searchTerm || 
      issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      issue.description.toLowerCase().includes(searchTerm.toLowerCase())
    
    const matchesType = typeFilter === 'all' || issue.type === typeFilter
    const matchesPriority = priorityFilter === 'all' || issue.priority === priorityFilter
    
    return matchesSearch && matchesType && matchesPriority
  })

  const handleCreateIssue = () => {
    setEditingIssue(null)
    setShowModal(true)
  }

  const handleViewIssue = (issue: Issue) => {
    setEditingIssue(issue)
    setShowModal(true)
  }

  const handleModalClose = () => {
    setShowModal(false)
    setEditingIssue(null)
  }

  const handleIssueCreated = () => {
    fetchIssues()
  }

  const handleIssueUpdated = () => {
    fetchIssues()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-gray-900">Issues & Updates</h2>
          <p className="text-gray-600 mt-1">Report issues, request features, or track updates</p>
        </div>
        <Button onClick={handleCreateIssue} className="bg-blue-600 hover:bg-blue-700">
          <Plus className="w-4 h-4 mr-2" />
          Report Issue
        </Button>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="md:col-span-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search issues..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>
        
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            <SelectItem value="OPEN">Open</SelectItem>
            <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
            <SelectItem value="RESOLVED">Resolved</SelectItem>
            <SelectItem value="CLOSED">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="BUG">Bug Report</SelectItem>
            <SelectItem value="FEATURE_REQUEST">Feature Request</SelectItem>
            <SelectItem value="UPDATE_REQUEST">Update Request</SelectItem>
            <SelectItem value="GENERAL">General</SelectItem>
          </SelectContent>
        </Select>

        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Priority" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Priorities</SelectItem>
            <SelectItem value="LOW">Low</SelectItem>
            <SelectItem value="MEDIUM">Medium</SelectItem>
            <SelectItem value="HIGH">High</SelectItem>
            <SelectItem value="URGENT">Urgent</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Issues List */}
      {filteredIssues.length === 0 ? (
        <div className="text-center py-12">
          <MessageCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No issues found</h3>
          <p className="text-gray-500 mb-4">
            {searchTerm || statusFilter !== 'all' || typeFilter !== 'all' || priorityFilter !== 'all'
              ? "No issues match your current filters."
              : "No issues have been reported yet."
            }
          </p>
          {!searchTerm && statusFilter === 'all' && typeFilter === 'all' && priorityFilter === 'all' && (
            <Button onClick={handleCreateIssue}>
              <Plus className="w-4 h-4 mr-2" />
              Report First Issue
            </Button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredIssues.map((issue) => {
            const TypeIcon = ISSUE_TYPES[issue.type].icon
            const StatusIcon = STATUS_ICONS[issue.status]
            
            return (
              <div
                key={issue.id}
                className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-lg transition-shadow duration-200 cursor-pointer"
                onClick={() => handleViewIssue(issue)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-3 mb-2">
                      <div className="flex items-center space-x-2">
                        <TypeIcon className="w-4 h-4 text-gray-500" />
                        <Badge className={ISSUE_TYPES[issue.type].color}>
                          {ISSUE_TYPES[issue.type].label}
                        </Badge>
                      </div>
                      <Badge className={PRIORITY_COLORS[issue.priority]}>
                        {issue.priority}
                      </Badge>
                      <div className="flex items-center space-x-1">
                        <StatusIcon className="w-3 h-3" />
                        <Badge className={STATUS_COLORS[issue.status]}>
                          {issue.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>
                    
                    <h3 className="text-lg font-medium text-gray-900 mb-2 truncate">
                      {issue.title}
                    </h3>
                    
                    <p className="text-gray-600 text-sm line-clamp-2 mb-3">
                      {issue.description}
                    </p>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <Avatar className="w-6 h-6">
                            <AvatarImage src={issue.reporter.image} />
                            <AvatarFallback className="text-xs">
                              {issue.reporter.name.charAt(0)}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-sm text-gray-600">
                            {issue.reporter.name}
                          </span>
                        </div>
                        
                        {issue.assignee && (
                          <>
                            <span className="text-gray-400">→</span>
                            <div className="flex items-center space-x-2">
                              <Avatar className="w-6 h-6">
                                <AvatarImage src={issue.assignee.image} />
                                <AvatarFallback className="text-xs">
                                  {issue.assignee.name.charAt(0)}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-sm text-gray-600">
                                {issue.assignee.name}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-3 text-sm text-gray-500">
                        {issue.comments.length > 0 && (
                          <div className="flex items-center space-x-1">
                            <MessageCircle className="w-4 h-4" />
                            <span>{issue.comments.length}</span>
                          </div>
                        )}
                        <span>{new Date(issue.createdAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  <Button variant="ghost" size="sm" className="ml-4">
                    <Eye className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Issue Modal */}
      <IssueModal
        isOpen={showModal}
        onClose={handleModalClose}
        onIssueCreated={handleIssueCreated}
        onIssueUpdated={handleIssueUpdated}
        editingIssue={editingIssue}
      />
    </div>
  )
}