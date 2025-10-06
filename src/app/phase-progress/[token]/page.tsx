import React from 'react'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import { isTokenExpired, isValidTokenFormat, getClientIP, getUserAgent } from '@/lib/sharing-utils'
import Image from 'next/image'
import { 
  Home, 
  Calendar, 
  User, 
  Shield, 
  CheckCircle, 
  Clock, 
  AlertTriangle,
  FileText,
  Eye,
  Download,
  MessageSquare
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { formatDistanceToNow } from 'date-fns'

interface Props {
  params: { token: string }
}

interface PhaseData {
  id: string
  token: string
  name: string
  stage: {
    id: string
    type: string
    status: string
    startedAt?: Date | null
    completedAt?: Date | null
    dueDate?: Date | null
    assignedUser?: {
      name: string
      role: string
    } | null
    room: {
      id: string
      name?: string | null
      type: string
      project: {
        id: string
        name: string
        client: {
          name: string
        }
      }
    }
    assets: {
      id: string
      name: string
      originalName: string
      fileType: string
      fileSize: number
      url: string
      createdAt: Date
    }[]
    comments: {
      id: string
      content: string
      createdAt: Date
      author: {
        name: string
        role?: string
      }
    }[]
    _count: {
      assets: number
      comments: number
    }
  }
}

export default async function PhaseProgressPage({ params }: Props) {
  const { token } = await params

  // Validate token format first
  if (!isValidTokenFormat(token)) {
    notFound()
  }

  // Look up the token and associated phase data
  let phaseData: PhaseData | null = null
  
  try {
    const tokenRecord = await prisma.phaseAccessToken.findFirst({
      where: {
        token,
        active: true
      },
      include: {
        stage: {
          include: {
            room: {
              include: {
                project: {
                  include: {
                    client: {
                      select: {
                        name: true
                      }
                    }
                  }
                }
              }
            },
            assignedUser: {
              select: {
                name: true,
                role: true
              }
            },
            assets: {
              where: {
                // Only show approved/completed assets for public view
                // You might want to add additional filtering here
              },
              orderBy: {
                createdAt: 'desc'
              },
              take: 10 // Limit to recent assets
            },
            comments: {
              include: {
                author: {
                  select: {
                    name: true,
                    role: true
                  }
                }
              },
              orderBy: {
                createdAt: 'desc'
              },
              take: 5 // Limit to recent comments
            },
            _count: {
              select: {
                assets: true,
                comments: true
              }
            }
          }
        }
      }
    })

    if (!tokenRecord) {
      notFound()
    }

    phaseData = tokenRecord as PhaseData

    // Log the access (don't block the request if this fails)
    try {
      // Note: In a real app, you'd get the IP from headers
      await prisma.phaseAccessLog.create({
        data: {
          tokenId: tokenRecord.id,
          ipAddress: 'unknown', // You could implement IP detection here
          userAgent: 'unknown', // You could get this from request headers
          action: 'VIEW_PHASE',
          metadata: {
            stageId: tokenRecord.stageId,
            timestamp: new Date().toISOString()
          }
        }
      })

      // Update last accessed info on the token
      await prisma.phaseAccessToken.update({
        where: { id: tokenRecord.id },
        data: {
          lastAccessedAt: new Date(),
          accessCount: { increment: 1 }
        }
      })
    } catch (error) {
      console.error('Failed to log phase access:', error)
      // Continue anyway - don't block the user for logging failures
    }

  } catch (error) {
    console.error('Error fetching phase data:', error)
    notFound()
  }

  if (!phaseData) {
    notFound()
  }

  const stage = phaseData.stage
  const room = stage.room
  const project = room.project

  // Format stage type for display
  const formatStageType = (type: string) => {
    return type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }

  // Get status configuration
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'NOT_STARTED':
        return { label: 'Not Started', color: 'bg-gray-100 text-gray-800', icon: <Clock className="w-4 h-4" /> }
      case 'IN_PROGRESS':
        return { label: 'In Progress', color: 'bg-blue-100 text-blue-800', icon: <Clock className="w-4 h-4 animate-pulse" /> }
      case 'COMPLETED':
        return { label: 'Completed', color: 'bg-green-100 text-green-800', icon: <CheckCircle className="w-4 h-4" /> }
      case 'ON_HOLD':
        return { label: 'On Hold', color: 'bg-yellow-100 text-yellow-800', icon: <AlertTriangle className="w-4 h-4" /> }
      case 'NEEDS_ATTENTION':
        return { label: 'Needs Attention', color: 'bg-red-100 text-red-800', icon: <AlertTriangle className="w-4 h-4" /> }
      default:
        return { label: status, color: 'bg-gray-100 text-gray-800', icon: <Clock className="w-4 h-4" /> }
    }
  }

  const statusConfig = getStatusConfig(stage.status)
  const roomName = room.name || formatStageType(room.type)
  const phaseName = formatStageType(stage.type)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-blue-600 rounded-xl shadow-sm p-3 border border-blue-100">
              <Image 
                src="/meisner-logo.svg" 
                alt="Meisner Interiors" 
                width={24} 
                height={24}
                className="w-6 h-6"
              />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {roomName} - {phaseName}
              </h1>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <span>{project.name}</span>
                <span>•</span>
                <span>{project.client.name}</span>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center space-x-4">
            <Badge className={`${statusConfig.color} flex items-center space-x-1`}>
              {statusConfig.icon}
              <span>{statusConfig.label}</span>
            </Badge>
            
            {stage.assignedUser && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <User className="w-4 h-4" />
                <span>{stage.assignedUser.name} ({stage.assignedUser.role})</span>
              </div>
            )}

            {stage.dueDate && (
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>Due {new Date(stage.dueDate).toLocaleDateString()}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content Area */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Phase Timeline */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Phase Timeline</h3>
              <div className="space-y-4">
                {stage.startedAt && (
                  <div className="flex items-center space-x-3 text-sm">
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                    <span className="text-gray-600">Started</span>
                    <span className="text-gray-900 font-medium">
                      {formatDistanceToNow(new Date(stage.startedAt), { addSuffix: true })}
                    </span>
                  </div>
                )}
                
                {stage.completedAt && (
                  <div className="flex items-center space-x-3 text-sm">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="text-gray-600">Completed</span>
                    <span className="text-gray-900 font-medium">
                      {formatDistanceToNow(new Date(stage.completedAt), { addSuffix: true })}
                    </span>
                  </div>
                )}

                {!stage.startedAt && (
                  <div className="flex items-center space-x-3 text-sm text-gray-500">
                    <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    <span>Not started yet</span>
                  </div>
                )}
              </div>
            </div>

            {/* Assets Section */}
            {stage.assets.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Phase Assets</h3>
                  <Badge variant="outline">{stage._count.assets} total</Badge>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {stage.assets.map((asset) => (
                    <div key={asset.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-sm transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center space-x-3 flex-1">
                          <FileText className="w-8 h-8 text-gray-400 flex-shrink-0" />
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-gray-900 truncate">
                              {asset.originalName}
                            </p>
                            <p className="text-xs text-gray-500">
                              {(asset.fileSize / 1024 / 1024).toFixed(2)} MB • {asset.fileType.toUpperCase()}
                            </p>
                            <p className="text-xs text-gray-500">
                              {formatDistanceToNow(new Date(asset.createdAt), { addSuffix: true })}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2 ml-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(asset.url, '_blank')}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Comments Section */}
            {stage.comments.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Updates</h3>
                  <Badge variant="outline">{stage._count.comments} total</Badge>
                </div>
                
                <div className="space-y-4">
                  {stage.comments.map((comment) => (
                    <div key={comment.id} className="border-l-4 border-blue-200 pl-4 py-2">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-2">
                          <MessageSquare className="w-4 h-4 text-gray-400" />
                          <span className="text-sm font-medium text-gray-900">
                            {comment.author.name}
                          </span>
                          {comment.author.role && (
                            <Badge variant="outline" className="text-xs">
                              {comment.author.role}
                            </Badge>
                          )}
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-700 whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Phase Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Phase Information</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Room:</span>
                  <span className="text-gray-900 font-medium">{roomName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Phase:</span>
                  <span className="text-gray-900 font-medium">{phaseName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <Badge className={`${statusConfig.color} text-xs`}>
                    {statusConfig.label}
                  </Badge>
                </div>
                {stage.assignedUser && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Assigned to:</span>
                    <span className="text-gray-900 font-medium">{stage.assignedUser.name}</span>
                  </div>
                )}
                {stage.dueDate && (
                  <div className="flex justify-between">
                    <span className="text-gray-600">Due Date:</span>
                    <span className="text-gray-900 font-medium">
                      {new Date(stage.dueDate).toLocaleDateString()}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Project Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Project Information</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Project:</span>
                  <span className="text-gray-900 font-medium">{project.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Client:</span>
                  <span className="text-gray-900 font-medium">{project.client.name}</span>
                </div>
              </div>
            </div>

            {/* Team Access Notice */}
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h5 className="font-semibold text-blue-900 mb-1">Team Access</h5>
                  <p className="text-sm text-blue-800">
                    Quick link for team members to view phase details.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-10 h-10 bg-white rounded-lg shadow-sm p-2 border border-gray-100">
                <Image 
                  src="/meisner-logo.svg" 
                  alt="Meisner Interiors" 
                  width={24} 
                  height={24}
                  className="w-6 h-6"
                />
              </div>
              <span className="text-sm text-gray-700 font-medium">© {new Date().getFullYear()} Meisner Interiors</span>
            </div>
            <div className="text-sm text-gray-500">
              Professional Interior Design Services
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}