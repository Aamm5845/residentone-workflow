import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import { prisma } from '@/lib/prisma'
import { Search, Filter, MoreVertical, Clock, AlertCircle, Eye, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDate } from '@/lib/utils'
import Link from 'next/link'
import type { Session } from 'next-auth'
import Image from 'next/image'

export default async function Approvals({ searchParams }: { searchParams: { status?: string } }) {
  const session = await getSession() as Session & {
    user: {
      id: string
      orgId: string
    }
  } | null
  
  if (!session?.user?.orgId) {
    redirect('/auth/signin')
  }

  // Handle filtering based on query parameters
  const statusFilter = searchParams.status

  // Build where clause based on filters
  const whereClause: any = {
    stage: {
      room: {
        project: { orgId: session.user.orgId }
      }
    }
  }

  if (statusFilter === 'pending') {
    whereClause.status = 'SENT_TO_CLIENT'
    whereClause.clientDecision = 'PENDING'
  }

  // Fetch client approval versions from database
  let approvals: any[] = []
  
  try {
    approvals = await prisma.clientApprovalVersion.findMany({
      where: whereClause,
      include: {
        stage: {
          include: {
            room: {
              include: {
                project: {
                  include: {
                    client: true
                  }
                }
              }
            }
          }
        },
        assets: {
          orderBy: { createdAt: 'desc' }
        },
        sentByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { sentToClientAt: 'desc' }
    })
  } catch (error) {
    console.error('Error fetching approvals:', error)
    approvals = []
  }

  // Calculate time since sent
  const approvalsWithTimeInfo = approvals.map(approval => {
    const sentAt = approval.sentToClientAt ? new Date(approval.sentToClientAt) : new Date(approval.createdAt)
    const now = new Date()
    const daysSent = Math.floor((now.getTime() - sentAt.getTime()) / (1000 * 60 * 60 * 24))
    
    const isOverdue = daysSent > 7
    const urgencyLevel = daysSent > 14 ? 'high' : daysSent > 7 ? 'medium' : 'low'
    
    return {
      ...approval,
      daysSent,
      isOverdue,
      urgencyLevel,
      sentAt
    }
  })

  const getUrgencyColor = (urgencyLevel: string) => {
    switch (urgencyLevel) {
      case 'high':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      default:
        return 'bg-green-100 text-green-800 border-green-200'
    }
  }

  const getUrgencyText = (daysSent: number) => {
    if (daysSent === 0) return 'Sent today'
    if (daysSent === 1) return 'Sent yesterday'
    if (daysSent <= 7) return `Sent ${daysSent} days ago`
    if (daysSent <= 14) return `Sent ${daysSent} days ago (Due)`
    return `Sent ${daysSent} days ago (Overdue)`
  }

  const formatStageType = (type: string) => {
    return type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }

  return (
    <DashboardLayout session={session}>
      <div className="p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {statusFilter === 'pending' ? 'Pending Client Approvals' : 'All Client Approvals'}
            </h1>
            <p className="text-gray-600 mt-1">
              {approvalsWithTimeInfo.length} {statusFilter === 'pending' ? 'pending' : ''} approvals
            </p>
            {statusFilter && (
              <Link href="/dashboard" className="text-sm text-purple-600 hover:text-purple-800 mt-2 inline-block">
                ← Back to Dashboard
              </Link>
            )}
          </div>
          <div className="flex items-center space-x-3">
            <Button variant="outline" size="sm">
              <Filter className="w-4 h-4 mr-2" />
              Filter
            </Button>
          </div>
        </div>

        {/* Approvals List */}
        <div className="space-y-6">
          {approvalsWithTimeInfo.length > 0 ? (
            <div className="space-y-4">
              {approvalsWithTimeInfo.map((approval) => (
                <div key={approval.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer" onClick={() => window.location.href = `/stages/${approval.stage.id}`}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      {/* Header */}
                      <div className="flex items-start justify-between mb-4">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3">
                            <h3 className="text-lg font-semibold text-gray-900">
                              {approval.stage.room.name || approval.stage.room.type.replace('_', ' ')}
                            </h3>
                            <span className="text-sm text-gray-500">•</span>
                            <span className="text-sm font-medium text-gray-700">
                              {formatStageType(approval.stage.type)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600">
                            <span>{approval.stage.room.project.name}</span>
                            <span>•</span>
                            <span>{approval.stage.room.project.client.name}</span>
                          </div>
                        </div>
                        
                        {/* Status Badge */}
                        <div className="flex items-center space-x-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getUrgencyColor(approval.urgencyLevel)}`}>
                            <Clock className="w-3 h-3 mr-1" />
                            {getUrgencyText(approval.daysSent)}
                          </span>
                          {approval.isOverdue && (
                            <AlertCircle className="w-5 h-5 text-red-500" />
                          )}
                        </div>
                      </div>

                      {/* Assets Preview */}
                      {approval.assets && approval.assets.length > 0 && (
                        <div className="mb-4">
                          <div className="flex items-center space-x-2 mb-3">
                            <Eye className="w-4 h-4 text-gray-500" />
                            <span className="text-sm font-medium text-gray-700">
                              {approval.assets.length} asset{approval.assets.length !== 1 ? 's' : ''} sent for approval
                            </span>
                          </div>
                          <div className="flex space-x-2 overflow-x-auto pb-2">
                            {approval.assets.slice(0, 4).map((asset: any) => (
                              <div key={asset.id} className="flex-shrink-0">
                                {asset.type === 'IMAGE' && asset.url ? (
                                  <div className="relative w-20 h-20 rounded-lg overflow-hidden bg-gray-100">
                                    <Image
                                      src={asset.url}
                                      alt={asset.name}
                                      fill
                                      className="object-cover"
                                      sizes="80px"
                                    />
                                  </div>
                                ) : (
                                  <div className="w-20 h-20 rounded-lg bg-gray-100 flex items-center justify-center">
                                    <span className="text-xs text-gray-500 text-center p-1">
                                      {asset.name.split('.').pop()?.toUpperCase()}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ))}
                            {approval.assets.length > 4 && (
                              <div className="w-20 h-20 rounded-lg bg-gray-50 border-2 border-dashed border-gray-300 flex items-center justify-center">
                                <span className="text-xs text-gray-500">
                                  +{approval.assets.length - 4}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex items-center justify-between text-sm text-gray-500">
                        <div className="flex items-center space-x-4">
                          <div className="flex items-center space-x-1">
                            <Send className="w-4 h-4" />
                            <span>Sent by {approval.sentByUser?.name}</span>
                          </div>
                          <span>•</span>
                          <span>Version {approval.version}</span>
                          {approval.sentToClientAt && (
                            <>
                              <span>•</span>
                              <span>{formatDate(approval.sentToClientAt)}</span>
                            </>
                          )}
                        </div>
                        
                        {/* Action Button */}
                        <Button variant="outline" size="sm" onClick={(e) => {
                          e.stopPropagation()
                          window.location.href = `/stages/${approval.stage.id}`
                        }}>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            /* Empty State */
            <div className="text-center py-12">
              <div className="mx-auto h-24 w-24 text-gray-400 mb-4">
                <Clock className="w-full h-full" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {statusFilter === 'pending' ? 'No pending approvals' : 'No approvals found'}
              </h3>
              <p className="text-gray-600 mb-6">
                {statusFilter === 'pending' 
                  ? 'All client approvals have been responded to.'
                  : 'Client approvals will appear here once you start sending renderings for approval.'}
              </p>
              <Button asChild>
                <Link href="/projects">
                  View Projects
                </Link>
              </Button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}