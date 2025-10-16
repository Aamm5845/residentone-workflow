import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { 
  ArrowLeft, 
  ClipboardList, 
  Camera, 
  MessageSquare, 
  Calendar,
  Users,
  CheckCircle,
  AlertCircle,
  Clock,
  Plus,
  Filter,
  Search,
  Bell,
  MapPin,
  FileText,
  Wrench,
  TrendingUp,
  Eye,
  Download,
  Share2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'

interface Props {
  params: { id: string }
}

export default async function EnhancedProjectUpdatesPage({ params }: Props) {
  const session = await getSession()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  const { id } = await params

  // Fetch project with extended data
  let project: any = null
  
  try {
    project = await prisma.project.findFirst({
      where: { id: id },
      select: {
        id: true,
        name: true,
        hasProjectUpdates: true,
        status: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        rooms: {
          select: {
            id: true,
            name: true,
            type: true,
            status: true
          }
        },
        projectContractors: {
          select: {
            contractor: {
              select: {
                id: true,
                businessName: true,
                contactName: true,
                email: true,
                specialty: true
              }
            },
            role: true,
            isActive: true
          },
          where: {
            isActive: true
          }
        }
      }
    })
  } catch (error) {
    console.error('Error fetching project:', error)
    redirect('/projects')
  }

  if (!project || !project.hasProjectUpdates) {
    redirect(`/projects/${id}`)
  }

  // Mock data for demonstration (in production, this would come from the new database tables)
  const mockUpdates = [
    {
      id: '1',
      type: 'PHOTO',
      title: 'Kitchen Progress - Electrical Rough-in',
      author: { name: 'Sarah Chen', avatar: null },
      room: 'Kitchen',
      timestamp: '2 hours ago',
      status: 'COMPLETED',
      priority: 'HIGH',
      content: 'All electrical outlets installed according to plan. Minor adjustment needed for island outlets.',
      photos: 3,
      tasks: 1,
      assignedTo: 'Mike Rodriguez - Electrical'
    },
    {
      id: '2',
      type: 'TASK',
      title: 'Plumbing Inspection Required',
      author: { name: 'John Davis', avatar: null },
      room: 'Master Bathroom',
      timestamp: '4 hours ago',
      status: 'REQUIRES_ATTENTION',
      priority: 'URGENT',
      content: 'Rough plumbing complete, city inspection needed before drywall. Inspector available Thursday 2-4pm.',
      dueDate: 'Oct 18, 2024',
      assignedTo: 'Tom Wilson - Plumbing'
    },
    {
      id: '3',
      type: 'DOCUMENT',
      title: 'Updated Electrical Plans v2.1',
      author: { name: 'Alex Kumar', avatar: null },
      room: null,
      timestamp: '1 day ago',
      status: 'PENDING_APPROVAL',
      priority: 'MEDIUM',
      content: 'Revised electrical plans with client-requested changes to kitchen island lighting.',
      version: 'v2.1',
      changes: 'Added 2 pendant light circuits, moved dimmer switch location'
    }
  ]

  const mockStats = {
    totalUpdates: 47,
    activeUpdates: 12,
    completedTasks: 89,
    pendingTasks: 23,
    photosThisWeek: 156,
    overdueTasks: 3
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800'
      case 'REQUIRES_ATTENTION': return 'bg-red-100 text-red-800'
      case 'PENDING_APPROVAL': return 'bg-yellow-100 text-yellow-800'
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-500'
      case 'HIGH': return 'bg-orange-500'
      case 'MEDIUM': return 'bg-yellow-500'
      case 'LOW': return 'bg-green-500'
      default: return 'bg-gray-500'
    }
  }

  return (
    <DashboardLayout session={session}>
      <div className="min-h-screen bg-gray-50">
        {/* Enhanced Header */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <Link href={`/projects/${project.id}`}>
                  <Button variant="ghost" size="sm" className="text-gray-600 hover:text-gray-900">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    Back to Project
                  </Button>
                </Link>
              </div>
              
              <div className="flex items-center space-x-3">
                <Button variant="outline" size="sm">
                  <Bell className="w-4 h-4 mr-2" />
                  Notifications
                </Button>
                <Button variant="outline" size="sm">
                  <Download className="w-4 h-4 mr-2" />
                  Export Report
                </Button>
                <Button size="sm" className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  New Update
                </Button>
              </div>
            </div>
            
            {/* Project Header */}
            <div className="mt-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
                  <ClipboardList className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl font-bold text-gray-900">Project Updates</h1>
                  <p className="text-lg text-gray-600 mt-1">{project.name} • {project.client.name}</p>
                </div>
              </div>

              {/* Stats Cards */}
              <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mt-6">
                <Card className="bg-gradient-to-r from-blue-50 to-blue-100 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600">Total Updates</p>
                        <p className="text-2xl font-bold text-blue-900">{mockStats.totalUpdates}</p>
                      </div>
                      <ClipboardList className="w-8 h-8 text-blue-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-green-50 to-green-100 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-green-600">Completed</p>
                        <p className="text-2xl font-bold text-green-900">{mockStats.completedTasks}</p>
                      </div>
                      <CheckCircle className="w-8 h-8 text-green-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-yellow-50 to-yellow-100 border-yellow-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-yellow-600">Pending</p>
                        <p className="text-2xl font-bold text-yellow-900">{mockStats.pendingTasks}</p>
                      </div>
                      <Clock className="w-8 h-8 text-yellow-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-purple-50 to-purple-100 border-purple-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-purple-600">Photos</p>
                        <p className="text-2xl font-bold text-purple-900">{mockStats.photosThisWeek}</p>
                      </div>
                      <Camera className="w-8 h-8 text-purple-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-red-50 to-red-100 border-red-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-red-600">Overdue</p>
                        <p className="text-2xl font-bold text-red-900">{mockStats.overdueTasks}</p>
                      </div>
                      <AlertCircle className="w-8 h-8 text-red-500" />
                    </div>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-r from-gray-50 to-gray-100 border-gray-200">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-600">Active</p>
                        <p className="text-2xl font-bold text-gray-900">{mockStats.activeUpdates}</p>
                      </div>
                      <TrendingUp className="w-8 h-8 text-gray-500" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Search and Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input 
                  placeholder="Search updates, tasks, or messages..." 
                  className="pl-10 pr-4 py-2"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
              <select className="border border-gray-300 rounded-md px-3 py-2 text-sm">
                <option>All Rooms</option>
                {project.rooms.map((room: any) => (
                  <option key={room.id} value={room.id}>
                    {room.name || room.type}
                  </option>
                ))}
              </select>
              <select className="border border-gray-300 rounded-md px-3 py-2 text-sm">
                <option>All Status</option>
                <option>Active</option>
                <option>Completed</option>
                <option>Requires Attention</option>
              </select>
            </div>
          </div>

          {/* Tabs Navigation */}
          <Tabs defaultValue="timeline" className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-6">
              <TabsTrigger value="timeline">Timeline</TabsTrigger>
              <TabsTrigger value="photos">Photos</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>

            {/* Timeline Tab */}
            <TabsContent value="timeline" className="space-y-6">
              {mockUpdates.map((update, index) => (
                <Card key={update.id} className="hover:shadow-lg transition-shadow duration-200">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        {/* Priority Indicator */}
                        <div className={`w-1 h-16 rounded-full ${getPriorityColor(update.priority)}`} />
                        
                        {/* Update Type Icon */}
                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center">
                          {update.type === 'PHOTO' && <Camera className="w-6 h-6 text-purple-600" />}
                          {update.type === 'TASK' && <CheckCircle className="w-6 h-6 text-blue-600" />}
                          {update.type === 'DOCUMENT' && <FileText className="w-6 h-6 text-green-600" />}
                        </div>

                        {/* Content */}
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{update.title}</h3>
                            <Badge className={getStatusColor(update.status)} variant="secondary">
                              {update.status.replace('_', ' ')}
                            </Badge>
                            <Badge variant="outline">{update.type}</Badge>
                          </div>

                          <p className="text-gray-600 mb-3">{update.content}</p>

                          {/* Metadata */}
                          <div className="flex items-center gap-6 text-sm text-gray-500">
                            <div className="flex items-center gap-1">
                              <Avatar className="w-6 h-6">
                                <AvatarFallback className="text-xs">
                                  {update.author.name.split(' ').map(n => n[0]).join('')}
                                </AvatarFallback>
                              </Avatar>
                              <span>{update.author.name}</span>
                            </div>

                            {update.room && (
                              <div className="flex items-center gap-1">
                                <MapPin className="w-4 h-4" />
                                <span>{update.room}</span>
                              </div>
                            )}

                            <div className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              <span>{update.timestamp}</span>
                            </div>

                            {update.assignedTo && (
                              <div className="flex items-center gap-1">
                                <Users className="w-4 h-4" />
                                <span>{update.assignedTo}</span>
                              </div>
                            )}

                            {update.photos && (
                              <div className="flex items-center gap-1">
                                <Camera className="w-4 h-4" />
                                <span>{update.photos} photos</span>
                              </div>
                            )}

                            {update.dueDate && (
                              <div className="flex items-center gap-1">
                                <Calendar className="w-4 h-4" />
                                <span>Due {update.dueDate}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2 ml-4">
                        <Button variant="ghost" size="sm">
                          <MessageSquare className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Eye className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Share2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Other tabs would be implemented similarly */}
            <TabsContent value="photos">
              <Card>
                <CardHeader>
                  <CardTitle>Photo Documentation</CardTitle>
                  <CardDescription>
                    Smart photo galleries organized by room, date, and progress milestones
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <Camera className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Photo gallery will display here with AI-powered categorization</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="tasks">
              <Card>
                <CardHeader>
                  <CardTitle>Task Management</CardTitle>
                  <CardDescription>
                    Kanban board with dependencies, contractor assignments, and progress tracking
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <Wrench className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Advanced task management interface coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents">
              <Card>
                <CardHeader>
                  <CardTitle>Document Control</CardTitle>
                  <CardDescription>
                    Version control, approvals, and automated distribution of plans and specifications
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <FileText className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Document management system with version control coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reports">
              <Card>
                <CardHeader>
                  <CardTitle>Progress Reports</CardTitle>
                  <CardDescription>
                    Automated client reports with photos, completed tasks, and budget tracking
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-center py-12 text-gray-500">
                    <TrendingUp className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                    <p>Automated reporting dashboard coming soon</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </DashboardLayout>
  )
}