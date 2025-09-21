'use client'

import React, { useState, useEffect } from 'react'
import { 
  CheckCircle, 
  Clock, 
  AlertCircle, 
  Download, 
  Calendar,
  Home,
  Eye,
  ArrowRight,
  Loader2,
  Shield,
  Star,
  Mail,
  Phone,
  Globe,
  ChevronDown,
  ChevronRight,
  Building
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import Image from 'next/image'

interface ClientProgressViewProps {
  token: string
}

interface ProjectData {
  id: string
  name: string
  description?: string
  type: string
  status: string
  client: {
    name: string
  }
  createdAt: string
  updatedAt: string
  floors: Floor[]
  rooms: Room[]
}

interface Floor {
  id: string
  name: string
  order: number
  rooms: Room[]
}

interface Room {
  id: string
  name?: string
  type: string
  status: string
  progress: number
  phases: Phase[]
  approvedRenderings: ApprovedRendering[]
}

interface Phase {
  name: string
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED'
  completedAt?: string
}

interface ApprovedRendering {
  id: string
  version: string
  customName?: string
  approvedAt: string
  aaronApprovedAt: string
  assets: Asset[]
}

interface Asset {
  id: string
  title: string
  url: string
  type: string
  description?: string
  createdAt: string
}

export default function ClientProgressView({ token }: ClientProgressViewProps) {
  const [projectData, setProjectData] = useState<ProjectData | null>(null)
  const [tokenInfo, setTokenInfo] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingAsset, setDownloadingAsset] = useState<string | null>(null)
  const [expandedFloors, setExpandedFloors] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetchProjectData()
  }, [token])

  const fetchProjectData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await fetch(`/api/client-progress/${token}`)
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to load project data')
      }
      
      setProjectData(data.project)
      setTokenInfo(data.tokenInfo)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = async (assetId: string, assetTitle: string) => {
    try {
      setDownloadingAsset(assetId)
      
      // Create a temporary link to trigger download
      const downloadUrl = `/api/client-progress/${token}/download/${assetId}`
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = assetTitle
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      
    } catch (err) {
      console.error('Download error:', err)
      alert('Download failed. Please try again.')
    } finally {
      setDownloadingAsset(null)
    }
  }

  const getPhaseIcon = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'IN_PROGRESS':
        return <Clock className="w-5 h-5 text-blue-600" />
      default:
        return <div className="w-5 h-5 rounded-full border-2 border-gray-300" />
    }
  }

  const getPhaseStatusColor = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'IN_PROGRESS':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-600 border-gray-200'
    }
  }

  const formatRoomName = (room: Room) => {
    return room.name || room.type.replace('_', ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
  }

  const toggleFloor = (floorId: string) => {
    const newExpanded = new Set(expandedFloors)
    if (newExpanded.has(floorId)) {
      newExpanded.delete(floorId)
    } else {
      newExpanded.add(floorId)
    }
    setExpandedFloors(newExpanded)
  }

  const calculateOverallProgress = () => {
    const allRooms = [
      ...projectData?.rooms || [],
      ...(projectData?.floors?.flatMap(floor => floor.rooms) || [])
    ]
    if (!allRooms.length) return 0
    const totalProgress = allRooms.reduce((sum, room) => sum + room.progress, 0)
    return Math.round(totalProgress / allRooms.length)
  }

  const getTotalRenderingCount = () => {
    const allRooms = [
      ...projectData?.rooms || [],
      ...(projectData?.floors?.flatMap(floor => floor.rooms) || [])
    ]
    return allRooms.reduce((sum, room) => sum + room.approvedRenderings.length, 0)
  }

  const getTotalRoomCount = () => {
    return (projectData?.rooms?.length || 0) + (projectData?.floors?.reduce((sum, floor) => sum + floor.rooms.length, 0) || 0)
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Loading Your Project</h2>
          <p className="text-gray-600">Please wait while we fetch your project progress...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <AlertCircle className="w-16 h-16 text-red-600 mx-auto mb-6" />
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <p className="text-sm text-gray-500">
            Please contact your design team if you believe this is an error.
          </p>
        </div>
      </div>
    )
  }

  if (!projectData) {
    return null
  }

  const overallProgress = calculateOverallProgress()
  const totalRenderings = getTotalRenderingCount()
  const totalRooms = getTotalRoomCount()

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Clean Header */}
      <div className="bg-white shadow-sm">
        {/* Company Branding Bar */}
        <div className="bg-white border-b border-gray-100">
          <div className="max-w-6xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-gray-50 rounded-lg p-2 flex items-center justify-center">
                  <Image 
                    src="/meisner-logo.svg" 
                    alt="Meisner Interiors Logo" 
                    width={32} 
                    height={32}
                    className="w-8 h-8"
                    priority
                  />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Meisner Interiors</h2>
                  <p className="text-sm text-gray-600">Project Progress Portal</p>
                </div>
              </div>
              <div className="flex items-center space-x-6 text-sm text-gray-600">
                <div className="flex items-center space-x-2">
                  <Mail className="w-4 h-4" />
                  <span>projects@meisnerinteriors.com</span>
                </div>
                <div className="flex items-center space-x-2 text-green-600">
                  <Shield className="w-4 h-4" />
                  <span>Secure Access</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Project Information */}
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="mb-6">
            <div className="flex items-start space-x-4">
              <div className="w-12 h-12 bg-gray-100 rounded-lg flex items-center justify-center">
                <Home className="w-6 h-6 text-gray-700" />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 mb-1">{projectData.name}</h1>
                <p className="text-gray-600 mb-2">{projectData.client.name}</p>
                {projectData.description && (
                  <p className="text-gray-700 leading-relaxed">{projectData.description}</p>
                )}
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900 mb-1">{overallProgress}%</div>
                <div className="text-sm text-gray-600">Complete</div>
              </div>
            </div>
          </div>
          
          {/* Progress Bar */}
          <div className="mb-6">
            <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
              <div 
                className="bg-gray-800 h-2 rounded-full transition-all duration-1000 ease-out"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
            <div className="flex justify-between text-sm text-gray-600">
              <span>{totalRooms} room{totalRooms !== 1 ? 's' : ''}</span>
              <span>{totalRenderings} approved rendering{totalRenderings !== 1 ? 's' : ''}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-6 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Floors Section */}
            {projectData.floors && projectData.floors.length > 0 && (
              <>
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Project Floors</h3>
                {projectData.floors.map((floor) => (
                  <div key={floor.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    {/* Floor Header */}
                    <button 
                      onClick={() => toggleFloor(floor.id)}
                      className="w-full p-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                    >
                      <div className="flex items-center space-x-3">
                        <Building className="w-5 h-5 text-gray-600" />
                        <div className="text-left">
                          <h4 className="font-semibold text-gray-900">{floor.name}</h4>
                          <p className="text-sm text-gray-600">{floor.rooms.length} room{floor.rooms.length !== 1 ? 's' : ''}</p>
                        </div>
                      </div>
                      {expandedFloors.has(floor.id) ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    
                    {/* Floor Rooms */}
                    {expandedFloors.has(floor.id) && (
                      <div className="border-t border-gray-100">
                        {floor.rooms.map((room) => (
                          <RoomCard key={room.id} room={room} downloadingAsset={downloadingAsset} handleDownload={handleDownload} formatRoomName={formatRoomName} getPhaseIcon={getPhaseIcon} getPhaseStatusColor={getPhaseStatusColor} />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}
            
            {/* Standalone Rooms (not assigned to floors) */}
            {projectData.rooms && projectData.rooms.length > 0 && (
              <>
                {projectData.floors && projectData.floors.length > 0 && (
                  <h3 className="text-xl font-semibold text-gray-900 mb-4 mt-8">Other Rooms</h3>
                )}
                {projectData.rooms.map((room) => (
                  <RoomCard key={room.id} room={room} downloadingAsset={downloadingAsset} handleDownload={handleDownload} formatRoomName={formatRoomName} getPhaseIcon={getPhaseIcon} getPhaseStatusColor={getPhaseStatusColor} />
                ))}
              </>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Project Info */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Project Information</h4>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Status:</span>
                  <Badge className="bg-blue-100 text-blue-800 border-blue-200">
                    {projectData.status.replace('_', ' ')}
                  </Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Started:</span>
                  <span className="text-gray-900">
                    {new Date(projectData.createdAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Last Updated:</span>
                  <span className="text-gray-900">
                    {new Date(projectData.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Total Rooms:</span>
                  <span className="text-gray-900">{projectData.rooms.length}</span>
                </div>
              </div>
            </div>

            {/* Access Info */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
              <div className="flex items-center space-x-2 mb-3">
                <Shield className="w-5 h-5 text-gray-700" />
                <h4 className="font-semibold text-gray-900">Secure Access</h4>
              </div>
              <p className="text-sm text-gray-700 mb-3">
                This link provides secure access to your project progress and approved renderings.
              </p>
              <div className="text-xs text-gray-600">
                <div className="flex justify-between mb-1">
                  <span>Access granted:</span>
                  <span>{new Date(tokenInfo?.createdAt).toLocaleDateString()}</span>
                </div>
                {tokenInfo?.expiresAt && (
                  <div className="flex justify-between">
                    <span>Expires:</span>
                    <span>{new Date(tokenInfo.expiresAt).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Help */}
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
              <h4 className="font-semibold text-gray-900 mb-3">Need Help?</h4>
              <p className="text-sm text-gray-600 mb-4">
                If you have questions about your project or need assistance, please contact your design team.
              </p>
              <p className="text-xs text-gray-500">
                Please do not share this link with others as it provides access to your private project information.
              </p>
            </div>
          </div>
        </div>
      </div>
        
      {/* Help Section */}
      <div className="max-w-6xl mx-auto px-6 py-8 mt-8">
        <div className="bg-gray-100 rounded-lg p-6">
          <div className="flex items-center space-x-3 mb-4">
            <Shield className="w-5 h-5 text-gray-600" />
            <h3 className="font-semibold text-gray-900">Need Help?</h3>
          </div>
          <p className="text-gray-700 mb-4">
            If you have questions about your project or need assistance, please contact your design team at <a href="mailto:projects@meisnerinteriors.com" className="text-gray-900 underline hover:no-underline">projects@meisnerinteriors.com</a>
          </p>
          <p className="text-sm text-gray-600">
            Please do not share this link with others as it provides access to your private project information.
          </p>
        </div>
      </div>
      {/* Simple Footer */}
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-gray-50 rounded p-1">
                <Image 
                  src="/meisner-logo.svg" 
                  alt="Meisner Interiors" 
                  width={24} 
                  height={24}
                  className="w-full h-full"
                />
              </div>
              <span className="text-sm text-gray-600">© {new Date().getFullYear()} Meisner Interiors</span>
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

// RoomCard component for individual room display
interface RoomCardProps {
  room: Room
  downloadingAsset: string | null
  handleDownload: (assetId: string, assetTitle: string) => void
  formatRoomName: (room: Room) => string
  getPhaseIcon: (status: string) => JSX.Element
  getPhaseStatusColor: (status: string) => string
}

function RoomCard({ room, downloadingAsset, handleDownload, formatRoomName, getPhaseIcon, getPhaseStatusColor }: RoomCardProps) {
  return (
    <div className="bg-white border-b border-gray-100 last:border-b-0">
      {/* Room Header */}
      <div className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="font-medium text-gray-900">{formatRoomName(room)}</h4>
            <p className="text-sm text-gray-600">{room.progress}% Complete</p>
          </div>
          <div className="text-right">
            <div className="text-lg font-semibold text-gray-900">{room.progress}%</div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
          <div 
            className="bg-gray-600 h-2 rounded-full transition-all duration-500"
            style={{ width: `${room.progress}%` }}
          />
        </div>

        {/* Phase Timeline */}
        <div className="space-y-3 mb-4">
          {room.phases.map((phase, index) => (
            <div key={phase.name} className="flex items-center space-x-3">
              {getPhaseIcon(phase.status)}
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${phase.status === 'COMPLETED' ? 'text-gray-900' : 'text-gray-600'}`}>
                    {phase.name}
                  </span>
                  <Badge className={`text-xs ${getPhaseStatusColor(phase.status)}`}>
                    {phase.status === 'COMPLETED' ? 'Complete' : 
                     phase.status === 'IN_PROGRESS' ? 'In Progress' : 'Pending'}
                  </Badge>
                </div>
                {phase.completedAt && (
                  <p className="text-xs text-gray-500 mt-1">
                    Completed {new Date(phase.completedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Approved Renderings */}
        {room.approvedRenderings.length > 0 && (
          <div className="border-t border-gray-100 pt-4">
            <h5 className="text-sm font-medium text-gray-900 mb-3 flex items-center">
              <Star className="w-4 h-4 text-yellow-500 mr-2" />
              Approved Renderings ({room.approvedRenderings.length})
            </h5>
            <div className="space-y-3">
              {room.approvedRenderings.map((rendering) => (
                <div key={rendering.id} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h6 className="text-sm font-medium text-gray-900">
                        {rendering.customName || rendering.version}
                      </h6>
                      <p className="text-xs text-gray-600">
                        Approved {new Date(rendering.approvedAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-800 border-green-200 text-xs">
                      Approved
                    </Badge>
                  </div>
                  
                  {rendering.assets.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {rendering.assets.map((asset) => (
                        <div key={asset.id} className="bg-white rounded border border-gray-200 overflow-hidden">
                          <div className="aspect-video bg-gray-100 relative">
                            <img
                              src={asset.url}
                              alt={asset.title}
                              className="w-full h-full object-cover"
                            />
                            <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-20 transition-all flex items-center justify-center opacity-0 hover:opacity-100">
                              <Button
                                variant="outline"
                                size="sm"
                                className="bg-white hover:bg-gray-100 text-xs"
                                onClick={() => window.open(asset.url, '_blank')}
                              >
                                <Eye className="w-3 h-3 mr-1" />
                                View
                              </Button>
                            </div>
                          </div>
                          <div className="p-2">
                            <div className="flex items-center justify-between">
                              <div className="flex-1 min-w-0">
                                <h7 className="text-xs font-medium text-gray-900 truncate block">
                                  {asset.title}
                                </h7>
                                {asset.description && (
                                  <p className="text-xs text-gray-600 mt-1 truncate">{asset.description}</p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                onClick={() => handleDownload(asset.id, asset.title)}
                                disabled={downloadingAsset === asset.id}
                                className="ml-2 bg-gray-800 hover:bg-gray-900 text-white text-xs px-2 py-1"
                              >
                                {downloadingAsset === asset.id ? (
                                  <Loader2 className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Download className="w-3 h-3" />
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
