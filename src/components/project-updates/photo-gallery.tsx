'use client'

import React, { useState, useEffect, useRef } from 'react'
// Using plain <img> for Dropbox-backed assets to avoid Next/Image optimizer issues
// import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Camera, 
  MapPin, 
  Calendar, 
  Tag, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  Download,
  Edit3,
  Trash2,
  ArrowLeft,
  ArrowRight,
  Grid3X3,
  List,
  Filter,
  Search,
  X,
  Eye,
  MessageSquare,
  Star,
  StarOff,
  Layers,
  Target,
  Clock,
  User,
  ChevronDown,
  Video as VideoIcon
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface Photo {
  id: string
  asset: {
    id: string
    title: string
    filename: string
    url: string
    type: string
    size: number
    mimeType: string
    metadata?: any
    uploader: {
      id: string
      name: string
      email: string
      image?: string
    }
    createdAt: string
  }
  caption?: string
  gpsCoordinates?: { lat: number; lng: number }
  takenAt?: string
  beforeAfterPairId?: string
  tags: string[]
  roomArea?: string
  tradeCategory?: string
  isBeforePhoto: boolean
  isAfterPhoto: boolean
  annotationsData?: {
    annotations: Array<{
      type: 'arrow' | 'circle' | 'rectangle' | 'freehand' | 'text'
      coordinates: number[]
      color: string
      text?: string
      strokeWidth?: number
    }>
  }
  aiAnalysis?: {
    detectedObjects: string[]
    suggestedTags: string[]
    roomType: string
    tradeCategory: string
    qualityScore: number
    issues: string[]
  }
  beforeAfterPair?: Photo
  pairedPhoto?: Photo
  createdAt: string
  updatedAt: string
}

interface PhotoGalleryProps {
  projectId: string
  updateId: string
  photos: Photo[]
  onPhotoSelect?: (photo: Photo) => void
  onPhotoUpdate?: (photoId: string, updates: Partial<Photo>) => void
  onPhotoDelete?: (photoId: string) => void
  canEdit?: boolean
  showBeforeAfter?: boolean
}

export default function PhotoGallery({
  projectId,
  updateId,
  photos,
  onPhotoSelect,
  onPhotoUpdate,
  onPhotoDelete,
  canEdit = false,
  showBeforeAfter = true
}: PhotoGalleryProps) {
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'timeline'>('grid')
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [selectedTradeCategory, setSelectedTradeCategory] = useState<string>('all')
  const [selectedRoomArea, setSelectedRoomArea] = useState<string>('all')
  const [dateRange, setDateRange] = useState<[string, string]>(['', ''])
  const [showAnnotations, setShowAnnotations] = useState(true)
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'quality' | 'size'>('date')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [editingPhoto, setEditingPhoto] = useState<Photo | null>(null)

  // Get unique values for filters
  const allTags = Array.from(new Set(photos.flatMap(p => p.tags)))
  const allTradeCategories = Array.from(new Set(photos.map(p => p.tradeCategory).filter(Boolean)))
  const allRoomAreas = Array.from(new Set(photos.map(p => p.roomArea).filter(Boolean)))

  // Filter and sort photos
  const filteredPhotos = photos.filter(photo => {
    if (searchQuery && !photo.caption?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !photo.asset.title.toLowerCase().includes(searchQuery.toLowerCase())) {
      return false
    }
    if (selectedTags.length > 0 && !selectedTags.some(tag => photo.tags.includes(tag))) {
      return false
    }
    if (selectedTradeCategory && selectedTradeCategory !== 'all' && photo.tradeCategory !== selectedTradeCategory) {
      return false
    }
    if (selectedRoomArea && selectedRoomArea !== 'all' && photo.roomArea !== selectedRoomArea) {
      return false
    }
    return true
  }).sort((a, b) => {
    let comparison = 0
    switch (sortBy) {
      case 'date':
        comparison = new Date(a.takenAt || a.createdAt).getTime() - new Date(b.takenAt || b.createdAt).getTime()
        break
      case 'name':
        comparison = a.asset.title.localeCompare(b.asset.title)
        break
      case 'quality':
        comparison = (a.aiAnalysis?.qualityScore || 0) - (b.aiAnalysis?.qualityScore || 0)
        break
      case 'size':
        comparison = a.asset.size - b.asset.size
        break
    }
    return sortOrder === 'desc' ? -comparison : comparison
  })

  // Before/After pairs
  const beforeAfterPairs = photos.filter(p => p.isBeforePhoto && p.pairedPhoto).map(before => ({
    before,
    after: before.pairedPhoto!
  }))

  const PhotoCard = ({ photo, index }: { photo: Photo; index: number }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className="group relative"
    >
      <Card className="overflow-hidden hover:shadow-lg transition-all duration-200 cursor-pointer">
        <div 
          className="relative aspect-square"
          onClick={() => {
            setSelectedPhoto(photo)
            setLightboxOpen(true)
            onPhotoSelect?.(photo)
          }}
        >
          {photo.asset?.mimeType?.startsWith('video/') ? (
            <video
              src={photo.asset.url}
              className="w-full h-full object-cover"
              muted
              loop
              playsInline
              autoPlay
            />
          ) : (
            <img
              src={photo.asset.url}
              alt={photo.asset.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
            />
          )}
          
          {/* Overlay with metadata */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
              <p className="text-sm font-medium truncate">{photo.asset.title}</p>
              {photo.caption && (
                <p className="text-xs opacity-90 truncate mt-1">{photo.caption}</p>
              )}
            </div>
          </div>

          {/* Quality score badge */}
          {photo.aiAnalysis?.qualityScore && (
            <div className="absolute top-2 left-2">
              <Badge 
                variant={photo.aiAnalysis.qualityScore >= 0.8 ? 'default' : 'secondary'}
                className="text-xs"
              >
                {Math.round(photo.aiAnalysis.qualityScore * 100)}%
              </Badge>
            </div>
          )}

          {/* Before/After indicator */}
          {(photo.isBeforePhoto || photo.isAfterPhoto) && (
            <div className="absolute top-2 right-2">
              <Badge variant="outline" className="text-xs bg-white/90">
                {photo.isBeforePhoto ? 'Before' : 'After'}
              </Badge>
            </div>
          )}

          {/* Video indicator */}
          {photo.asset?.mimeType?.startsWith('video/') && (
            <div className="absolute top-2 left-2">
              <Badge variant="secondary" className="text-xs flex items-center gap-1">
                <VideoIcon className="w-3 h-3" /> Video
              </Badge>
            </div>
          )}

          {/* GPS indicator */}
          {photo.gpsCoordinates && (
            <div className="absolute bottom-2 right-2">
              <MapPin className="w-4 h-4 text-white opacity-75" />
            </div>
          )}

          {/* Actions overlay */}
          <div className="absolute top-2 left-1/2 transform -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="sm" variant="secondary" className="h-8 w-8 p-0">
                    <Eye className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>View full size</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            
            {canEdit && (
              <>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button size="sm" variant="secondary" className="h-8 w-8 p-0">
                        <Edit3 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Edit photo</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        className="h-8 w-8 p-0"
                        onClick={(e) => {
                          e.stopPropagation()
                          if (onPhotoDelete && confirm('Are you sure you want to delete this photo?')) {
                            onPhotoDelete(photo.id)
                          }
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete photo</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </>
            )}
          </div>
        </div>

        <CardContent className="p-3">
          <div className="space-y-2">
            {/* Tags */}
            {photo.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {photo.tags.slice(0, 3).map(tag => (
                  <Badge key={tag} variant="secondary" className="text-xs">
                    {tag}
                  </Badge>
                ))}
                {photo.tags.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{photo.tags.length - 3}
                  </Badge>
                )}
              </div>
            )}

            {/* Caption */}
            {photo.caption && (
              <p className="text-xs text-gray-700 line-clamp-2">{photo.caption}</p>
            )}

            {/* Room Area */}
            {photo.roomArea && (
              <div className="flex items-center gap-1 text-xs text-gray-600">
                <Target className="w-3 h-3" />
                <span className="truncate">{photo.roomArea}</span>
              </div>
            )}

            {/* Uploader */}
            <div className="flex items-center gap-2 text-xs text-gray-600">
              <User className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{photo.asset.uploader?.name || 'Unknown'}</span>
            </div>

            {/* Date and Time */}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3" />
                {new Date(photo.takenAt || photo.createdAt).toLocaleDateString()}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {new Date(photo.takenAt || photo.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Trade Category */}
            {photo.tradeCategory && (
              <div className="pt-2 border-t">
                <Badge variant="outline" className="text-xs w-full justify-center">
                  {photo.tradeCategory}
                </Badge>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  const BeforeAfterCard = ({ pair, index }: { pair: { before: Photo; after: Photo }; index: number }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
    >
      <Card className="overflow-hidden hover:shadow-lg transition-shadow duration-200">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Layers className="w-4 h-4" />
            Before & After Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0">
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-2">
              <div className="relative aspect-square rounded-lg overflow-hidden">
                <img
                  src={pair.before.asset.url}
                  alt="Before"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <Badge className="text-xs">Before</Badge>
                </div>
              </div>
              <p className="text-xs text-gray-500 truncate">{pair.before.caption || 'Before photo'}</p>
            </div>
            
            <div className="space-y-2">
              <div className="relative aspect-square rounded-lg overflow-hidden">
                <img
                  src={pair.after.asset.url}
                  alt="After"
                  className="w-full h-full object-cover"
                />
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-2">
                  <Badge className="text-xs">After</Badge>
                </div>
              </div>
              <p className="text-xs text-gray-500 truncate">{pair.after.caption || 'After photo'}</p>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t">
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {Math.ceil((new Date(pair.after.takenAt || pair.after.createdAt).getTime() - 
                           new Date(pair.before.takenAt || pair.before.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days apart
              </span>
              {pair.before.tradeCategory && (
                <Badge variant="outline" className="text-xs">
                  {pair.before.tradeCategory}
                </Badge>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  )

  return (
    <div className="space-y-6">
      {/* Header with controls */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Photo Documentation</h3>
          <p className="text-sm text-gray-500">
            {filteredPhotos.length} {filteredPhotos.length === 1 ? 'photo' : 'photos'}
            {filteredPhotos.length !== photos.length && ` of ${photos.length} total`}
            {showBeforeAfter && beforeAfterPairs.length > 0 && ` • ${beforeAfterPairs.length} before/after ${beforeAfterPairs.length === 1 ? 'pair' : 'pairs'}`}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search photos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 w-64"
            />
          </div>

          {/* View mode toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <Button
              size="sm"
              variant={viewMode === 'grid' ? 'default' : 'ghost'}
              onClick={() => setViewMode('grid')}
              className="h-8"
            >
              <Grid3X3 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant={viewMode === 'list' ? 'default' : 'ghost'}
              onClick={() => setViewMode('list')}
              className="h-8"
            >
              <List className="w-4 h-4" />
            </Button>
          </div>

          {/* Filters */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilterOpen(!filterOpen)}
            className={filterOpen ? 'bg-primary text-primary-foreground' : ''}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </Button>

          {/* Sort */}
          <Select value={`${sortBy}-${sortOrder}`} onValueChange={(value) => {
            const [by, order] = value.split('-') as [typeof sortBy, typeof sortOrder]
            setSortBy(by)
            setSortOrder(order)
          }}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="date-desc">Newest</SelectItem>
              <SelectItem value="date-asc">Oldest</SelectItem>
              <SelectItem value="name-asc">Name A-Z</SelectItem>
              <SelectItem value="name-desc">Name Z-A</SelectItem>
              <SelectItem value="quality-desc">Quality ↓</SelectItem>
              <SelectItem value="quality-asc">Quality ↑</SelectItem>
              <SelectItem value="size-desc">Size ↓</SelectItem>
              <SelectItem value="size-asc">Size ↑</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Filters panel */}
      <AnimatePresence>
        {filterOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Card className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Tags</label>
                  <div className="space-y-2 max-h-32 overflow-y-auto">
                    {allTags.map(tag => (
                      <div key={tag} className="flex items-center space-x-2">
                        <Checkbox
                          id={`tag-${tag}`}
                          checked={selectedTags.includes(tag)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setSelectedTags([...selectedTags, tag])
                            } else {
                              setSelectedTags(selectedTags.filter(t => t !== tag))
                            }
                          }}
                        />
                        <label htmlFor={`tag-${tag}`} className="text-sm">{tag}</label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Trade Category</label>
                  <Select value={selectedTradeCategory} onValueChange={setSelectedTradeCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="All categories" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {allTradeCategories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Room Area</label>
                  <Select value={selectedRoomArea} onValueChange={setSelectedRoomArea}>
                    <SelectTrigger>
                      <SelectValue placeholder="All areas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All areas</SelectItem>
                      {allRoomAreas.map(area => (
                        <SelectItem key={area} value={area}>
                          {area}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Actions</label>
                  <div className="space-y-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSelectedTags([])
                        setSelectedTradeCategory('all')
                        setSelectedRoomArea('all')
                        setSearchQuery('')
                      }}
                      className="w-full"
                    >
                      Clear Filters
                    </Button>
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="show-annotations"
                        checked={showAnnotations}
                        onCheckedChange={setShowAnnotations}
                      />
                      <label htmlFor="show-annotations" className="text-sm">Show annotations</label>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content tabs */}
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="all">All Photos ({filteredPhotos.length})</TabsTrigger>
          <TabsTrigger value="before-after" disabled={!showBeforeAfter || beforeAfterPairs.length === 0}>
            Before/After ({beforeAfterPairs.length})
          </TabsTrigger>
          <TabsTrigger value="ai-analysis">AI Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-6">
          {filteredPhotos.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Camera className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No photos found matching your criteria</p>
            </div>
          ) : (
            <motion.div
              layout
              className={`grid gap-6 ${
                viewMode === 'grid' 
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4' 
                  : 'grid-cols-1'
              }`}
            >
              <AnimatePresence>
                {filteredPhotos.map((photo, index) => (
                  <PhotoCard key={photo.id} photo={photo} index={index} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="before-after" className="mt-6">
          {beforeAfterPairs.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Layers className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p>No before/after pairs found</p>
            </div>
          ) : (
            <motion.div layout className="grid gap-6 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
              <AnimatePresence>
                {beforeAfterPairs.map((pair, index) => (
                  <BeforeAfterCard key={`${pair.before.id}-${pair.after.id}`} pair={pair} index={index} />
                ))}
              </AnimatePresence>
            </motion.div>
          )}
        </TabsContent>

        <TabsContent value="ai-analysis" className="mt-6">
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-2">
            {filteredPhotos
              .filter(photo => photo.aiAnalysis)
              .map(photo => (
                <Card key={photo.id}>
                  <CardContent className="p-4">
                    <div className="flex gap-4">
                      <div className="relative w-24 h-24 rounded-lg overflow-hidden flex-shrink-0">
                        <img
                          src={photo.asset.url}
                          alt={photo.asset.title}
                          className="w-24 h-24 object-cover rounded-lg"
                        />
                      </div>
                      <div className="flex-1 space-y-2">
                        <h4 className="font-medium">{photo.asset.title}</h4>
                        {photo.aiAnalysis && (
                          <div className="space-y-2 text-sm">
                            <div>
                              <span className="font-medium">Quality Score: </span>
                              <Badge variant={photo.aiAnalysis.qualityScore >= 0.8 ? 'default' : 'secondary'}>
                                {Math.round(photo.aiAnalysis.qualityScore * 100)}%
                              </Badge>
                            </div>
                            {photo.aiAnalysis.detectedObjects.length > 0 && (
                              <div>
                                <span className="font-medium">Detected: </span>
                                {photo.aiAnalysis.detectedObjects.slice(0, 3).join(', ')}
                                {photo.aiAnalysis.detectedObjects.length > 3 && ` +${photo.aiAnalysis.detectedObjects.length - 3} more`}
                              </div>
                            )}
                            {photo.aiAnalysis.issues.length > 0 && (
                              <div>
                                <span className="font-medium text-red-600">Issues: </span>
                                {photo.aiAnalysis.issues.join(', ')}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </TabsContent>
      </Tabs>

      {/* Lightbox for full-size viewing */}
      <Dialog open={lightboxOpen} onOpenChange={setLightboxOpen}>
        <DialogContent className="max-w-7xl w-full h-[90vh]">
          {selectedPhoto && (
            <div className="flex flex-col h-full">
              <DialogHeader className="flex-shrink-0">
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle>{selectedPhoto.asset.title}</DialogTitle>
                    <DialogDescription>
                      {selectedPhoto.caption && (
                        <span>{selectedPhoto.caption} • </span>
                      )}
                      Taken {new Date(selectedPhoto.takenAt || selectedPhoto.createdAt).toLocaleString()}
                    </DialogDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    {!selectedPhoto.asset?.mimeType?.startsWith('video/') && (
                      <>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setZoom(Math.max(25, zoom - 25))}
                        >
                          <ZoomOut className="w-4 h-4" />
                        </Button>
                        <span className="text-sm min-w-12 text-center">{zoom}%</span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setZoom(Math.min(400, zoom + 25))}
                        >
                          <ZoomIn className="w-4 h-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setRotation((rotation + 90) % 360)}
                        >
                          <RotateCcw className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="outline" asChild>
                      <a href={selectedPhoto.asset.url} download={selectedPhoto.asset.filename}>
                        <Download className="w-4 h-4" />
                      </a>
                    </Button>
                  </div>
                </div>
              </DialogHeader>
              
              <div className="flex-1 relative overflow-hidden">
                {selectedPhoto.asset?.mimeType?.startsWith('video/') ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <video
                      src={selectedPhoto.asset.url}
                      className="max-w-full max-h-full"
                      controls
                      playsInline
                    />
                  </div>
                ) : (
                  <div 
                    className="w-full h-full flex items-center justify-center"
                    style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)` }}
                  >
                    <img
                      src={selectedPhoto.asset.url}
                      alt={selectedPhoto.asset.title}
                      className="max-w-full max-h-full object-contain"
                    />
                  </div>
                )}
              </div>

              {/* Photo metadata */}
              <div className="flex-shrink-0 border-t pt-4 space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Uploaded by: </span>
                    {selectedPhoto.asset.uploader?.name || 'Unknown'}
                  </div>
                  <div>
                    <span className="font-medium">Size: </span>
                    {(selectedPhoto.asset.size / 1024 / 1024).toFixed(1)} MB
                  </div>
                  <div>
                    <span className="font-medium">Uploaded: </span>
                    {new Date(selectedPhoto.asset.createdAt).toLocaleDateString()} at {new Date(selectedPhoto.asset.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
                  {selectedPhoto.gpsCoordinates && (
                    <div>
                      <span className="font-medium">Location: </span>
                      {selectedPhoto.gpsCoordinates.lat.toFixed(6)}, {selectedPhoto.gpsCoordinates.lng.toFixed(6)}
                    </div>
                  )}
                </div>

                {selectedPhoto.roomArea && (
                  <div>
                    <span className="font-medium text-sm">Room: </span>
                    <Badge variant="outline" className="text-xs">{selectedPhoto.roomArea}</Badge>
                  </div>
                )}

                {selectedPhoto.tradeCategory && (
                  <div>
                    <span className="font-medium text-sm">Trade Category: </span>
                    <Badge variant="outline" className="text-xs">{selectedPhoto.tradeCategory}</Badge>
                  </div>
                )}
                
                {selectedPhoto.tags.length > 0 && (
                  <div>
                    <span className="font-medium text-sm">Tags: </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {selectedPhoto.tags.map(tag => (
                        <Badge key={tag} variant="secondary" className="text-xs">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Display notes from metadata */}
                {selectedPhoto.asset.metadata && (() => {
                  try {
                    const metadata = typeof selectedPhoto.asset.metadata === 'string' 
                      ? JSON.parse(selectedPhoto.asset.metadata) 
                      : selectedPhoto.asset.metadata
                    if (metadata?.notes) {
                      return (
                        <div className="pt-2 border-t">
                          <span className="font-medium text-sm">Notes: </span>
                          <p className="text-sm text-gray-600 mt-1 whitespace-pre-wrap">{metadata.notes}</p>
                        </div>
                      )
                    }
                  } catch (e) {
                    // Ignore JSON parse errors
                  }
                  return null
                })()}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
