'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Upload,
  FileSpreadsheet,
  Trash2,
  Link2,
  Unlink,
  Filter,
  CheckCircle2,
  XCircle,
  Package,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  ExternalLink
} from 'lucide-react'
import { toast } from 'sonner'

interface ProgramaItem {
  id: string
  category: string
  name: string
  description?: string
  details?: string
  brand?: string
  sku?: string
  color?: string
  finish?: string
  material?: string
  quantity: number
  rrp?: number
  tradePrice?: number
  supplierCompanyName?: string
  websiteUrl?: string
  status?: string
  linkedRoomFFEItemId?: string
  linkedAt?: string
  linkedRoomFFEItem?: {
    id: string
    name: string
    images?: string[]
    section?: {
      name: string
      room?: { name: string }
    }
  }
  linkedBy?: { name: string }
}

export default function ProgramaImportPage() {
  const [items, setItems] = useState<ProgramaItem[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [stats, setStats] = useState({ total: 0, linked: 0, unlinked: 0 })
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [filter, setFilter] = useState<'all' | 'linked' | 'unlinked'>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const fetchItems = useCallback(async () => {
    setLoading(true)
    try {
      let url = '/api/programa-import?'
      if (filter === 'linked') url += 'linked=true&'
      if (filter === 'unlinked') url += 'unlinked=true&'
      if (categoryFilter !== 'all') url += `category=${encodeURIComponent(categoryFilter)}&`

      const res = await fetch(url)
      const data = await res.json()
      setItems(data.items || [])
      setCategories(data.categories || [])
      setStats(data.stats || { total: 0, linked: 0, unlinked: 0 })

      // Auto-expand all categories on first load
      if (data.categories) {
        setExpandedCategories(new Set(data.categories))
      }
    } catch (error) {
      console.error('Error fetching items:', error)
      toast.error('Failed to fetch items')
    } finally {
      setLoading(false)
    }
  }, [filter, categoryFilter])

  useEffect(() => {
    fetchItems()
  }, [fetchItems])

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      toast.error('Please upload an Excel file (.xlsx or .xls)')
      return
    }

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('clearExisting', 'true')

      const res = await fetch('/api/programa-import', {
        method: 'POST',
        body: formData
      })

      const data = await res.json()
      if (res.ok) {
        toast.success(`Imported ${data.imported} items`)
        fetchItems()
      } else {
        toast.error(data.error || 'Failed to import')
      }
    } catch (error) {
      console.error('Error uploading:', error)
      toast.error('Failed to upload file')
    } finally {
      setUploading(false)
      e.target.value = ''
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm('Are you sure you want to delete all imported items? This cannot be undone.')) {
      return
    }

    try {
      const res = await fetch('/api/programa-import', { method: 'DELETE' })
      if (res.ok) {
        toast.success('All items deleted')
        fetchItems()
      } else {
        toast.error('Failed to delete items')
      }
    } catch (error) {
      toast.error('Failed to delete items')
    }
  }

  const handleUnlink = async (itemId: string) => {
    try {
      const res = await fetch(`/api/programa-import/${itemId}/link`, {
        method: 'DELETE'
      })
      if (res.ok) {
        toast.success('Item unlinked')
        fetchItems()
      } else {
        toast.error('Failed to unlink item')
      }
    } catch (error) {
      toast.error('Failed to unlink item')
    }
  }

  const toggleCategory = (category: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }

  // Group items by category
  const groupedItems = items.reduce((acc, item) => {
    if (!acc[item.category]) {
      acc[item.category] = []
    }
    acc[item.category].push(item)
    return acc
  }, {} as Record<string, ProgramaItem[]>)

  // Filter by search query
  const filteredGroupedItems = Object.entries(groupedItems).reduce((acc, [category, categoryItems]) => {
    const filtered = categoryItems.filter(item =>
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.brand?.toLowerCase().includes(searchQuery.toLowerCase())
    )
    if (filtered.length > 0) {
      acc[category] = filtered
    }
    return acc
  }, {} as Record<string, ProgramaItem[]>)

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Programa Import</h1>
          <p className="text-gray-600 mt-2">
            Import items from Excel and link them to FFE items in your projects
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
                <div className="text-sm text-gray-500">Total Items</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-emerald-600">{stats.linked}</div>
                <div className="text-sm text-gray-500">Linked</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-amber-600">{stats.unlinked}</div>
                <div className="text-sm text-gray-500">Not Linked</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5" />
              Import from Excel
            </CardTitle>
            <CardDescription>
              Upload an Excel file exported from Programa to import items
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <label className="cursor-pointer">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
                <Button asChild disabled={uploading}>
                  <span>
                    {uploading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4 mr-2" />
                    )}
                    {uploading ? 'Uploading...' : 'Upload Excel File'}
                  </span>
                </Button>
              </label>
              {stats.total > 0 && (
                <Button variant="outline" onClick={handleDeleteAll} className="text-red-600 hover:text-red-700">
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete All
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Filters */}
        {stats.total > 0 && (
          <div className="flex items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm text-gray-500">Filter:</span>
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Items</SelectItem>
                <SelectItem value="linked">Linked Only</SelectItem>
                <SelectItem value="unlinked">Not Linked</SelectItem>
              </SelectContent>
            </Select>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              placeholder="Search items..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64"
            />
            <Button variant="outline" size="sm" onClick={fetchItems}>
              <RefreshCw className="w-4 h-4 mr-1" />
              Refresh
            </Button>
          </div>
        )}

        {/* Items List */}
        {loading ? (
          <div className="text-center py-12">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
            <p className="mt-2 text-gray-500">Loading items...</p>
          </div>
        ) : stats.total === 0 ? (
          <Card>
            <CardContent className="py-12">
              <div className="text-center">
                <Package className="w-12 h-12 mx-auto text-gray-300" />
                <h3 className="mt-4 text-lg font-medium text-gray-900">No items imported</h3>
                <p className="mt-2 text-gray-500">
                  Upload an Excel file to import items from Programa
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(filteredGroupedItems).map(([category, categoryItems]) => {
              const isExpanded = expandedCategories.has(category)
              const linkedCount = categoryItems.filter(i => i.linkedRoomFFEItemId).length

              return (
                <Card key={category}>
                  <CardHeader
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleCategory(category)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-5 h-5 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        )}
                        <CardTitle className="text-lg">{category}</CardTitle>
                        <Badge variant="secondary">{categoryItems.length} items</Badge>
                        {linkedCount > 0 && (
                          <Badge className="bg-emerald-100 text-emerald-700">
                            {linkedCount} linked
                          </Badge>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  {isExpanded && (
                    <CardContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-12"></TableHead>
                            <TableHead>Item</TableHead>
                            <TableHead>Brand</TableHead>
                            <TableHead>Details</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {categoryItems.map((item) => (
                            <TableRow key={item.id} className={item.linkedRoomFFEItemId ? 'bg-emerald-50/50' : ''}>
                              <TableCell>
                                {item.linkedRoomFFEItemId ? (
                                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                                ) : (
                                  <XCircle className="w-5 h-5 text-gray-300" />
                                )}
                              </TableCell>
                              <TableCell>
                                <div>
                                  <p className="font-medium text-gray-900">{item.name}</p>
                                  {item.description && item.description !== item.name && (
                                    <p className="text-sm text-gray-500 truncate max-w-xs">{item.description}</p>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-600">{item.brand || '-'}</span>
                              </TableCell>
                              <TableCell>
                                <div className="text-sm text-gray-500">
                                  {item.color && <span className="mr-2">Color: {item.color}</span>}
                                  {item.material && <span>Material: {item.material}</span>}
                                </div>
                              </TableCell>
                              <TableCell>
                                <span className="text-sm text-gray-600">{item.supplierCompanyName || '-'}</span>
                              </TableCell>
                              <TableCell className="text-center">
                                {item.linkedRoomFFEItemId ? (
                                  <div className="text-xs">
                                    <p className="text-emerald-600 font-medium">Linked to:</p>
                                    <p className="text-gray-600 truncate max-w-32">
                                      {item.linkedRoomFFEItem?.name}
                                    </p>
                                    <p className="text-gray-400">
                                      {item.linkedRoomFFEItem?.section?.room?.name} / {item.linkedRoomFFEItem?.section?.name}
                                    </p>
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-amber-600 border-amber-300">
                                    Not Linked
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                  {item.websiteUrl && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      asChild
                                    >
                                      <a href={item.websiteUrl} target="_blank" rel="noopener noreferrer">
                                        <ExternalLink className="w-4 h-4" />
                                      </a>
                                    </Button>
                                  )}
                                  {item.linkedRoomFFEItemId && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleUnlink(item.id)}
                                      className="text-red-600 hover:text-red-700"
                                    >
                                      <Unlink className="w-4 h-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  )}
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
