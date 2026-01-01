'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  FileText,
  Send,
  Eye,
  RefreshCw,
  Package,
  Building2,
  Calendar,
  Clock,
  Pencil,
  MoreVertical,
  Copy,
  Trash2,
  Plus,
  ChevronRight,
  Check
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'

interface RFQsTabProps {
  projectId: string
  searchQuery: string
  refreshKey?: number
  onViewQuote?: (quoteId: string) => void
}

interface RFQ {
  id: string
  rfqNumber: string
  title: string
  description?: string
  suppliersCount: number
  supplierNames: string[]
  itemsCount: number
  sentAt: string | null
  deadline: string | null
  createdAt: string
  status: 'DRAFT' | 'SENT' | 'PARTIALLY_QUOTED' | 'FULLY_QUOTED' | 'QUOTE_ACCEPTED' | 'CANCELLED' | 'EXPIRED'
  latestQuoteId?: string | null
}

interface RFQDetail {
  id: string
  rfqNumber: string
  title: string
  description?: string
  status: string
  createdAt: string
  sentAt?: string
  responseDeadline?: string
  lineItems: Array<{
    id: string
    itemName: string
    itemDescription?: string
    quantity: number
    unitType?: string
    roomFFEItemId?: string
    roomFFEItem?: {
      id: string
      name: string
      description?: string
      brand?: string
      sku?: string
      supplierName?: string
      images?: string[]
      section?: {
        name: string
        instance?: {
          room?: {
            name: string
          }
        }
      }
    }
  }>
  supplierRFQs: Array<{
    id: string
    sentAt?: string
    viewedAt?: string
    responseStatus: string
    supplier?: {
      id: string
      name: string
      email?: string
    }
    vendorName?: string
    vendorEmail?: string
  }>
}

interface SpecItem {
  id: string
  name: string
  description?: string
  quantity: number
  category?: string
  room?: string
  images?: string[]
}

interface CategoryGroup {
  category: string
  items: SpecItem[]
  expanded: boolean
}

interface EditLineItem {
  id?: string  // RFQ line item ID if existing
  roomFFEItemId: string  // Link to All Specs item
  itemName: string
  itemDescription?: string
  quantity: number
  unitType?: string
  specItem?: SpecItem  // Reference to the spec item
}

interface Supplier {
  id: string
  name: string
  email?: string
  contactName?: string
}

const statusConfig: Record<string, { label: string; color: string }> = {
  // RFQ statuses
  DRAFT: { label: 'Draft', color: 'bg-gray-100 text-gray-600' },
  SENT: { label: 'Sent', color: 'bg-blue-50 text-blue-700' },
  VIEWED: { label: 'Viewed', color: 'bg-cyan-50 text-cyan-700' },
  PARTIALLY_QUOTED: { label: 'Partial Quotes', color: 'bg-amber-50 text-amber-700' },
  FULLY_QUOTED: { label: 'Quoted', color: 'bg-emerald-50 text-emerald-700' },
  QUOTE_ACCEPTED: { label: 'Accepted', color: 'bg-purple-50 text-purple-700' },
  CANCELLED: { label: 'Cancelled', color: 'bg-red-50 text-red-700' },
  EXPIRED: { label: 'Expired', color: 'bg-gray-100 text-gray-500' },
  // Supplier response statuses (used in detail view)
  PENDING: { label: 'Awaiting Response', color: 'bg-gray-100 text-gray-600' },
  SUBMITTED: { label: 'Quoted', color: 'bg-emerald-50 text-emerald-700' },
  DECLINED: { label: 'Declined', color: 'bg-red-50 text-red-700' },
}

export default function RFQsTab({ projectId, searchQuery, refreshKey, onViewQuote }: RFQsTabProps) {
  const router = useRouter()
  const [rfqs, setRfqs] = useState<RFQ[]>([])
  const [loading, setLoading] = useState(true)
  const [sendingId, setSendingId] = useState<string | null>(null)

  // Detail panel state
  const [selectedRFQ, setSelectedRFQ] = useState<RFQDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Edit mode state
  const [editingRFQ, setEditingRFQ] = useState<RFQDetail | null>(null)
  const [editLineItems, setEditLineItems] = useState<EditLineItem[]>([])
  const [specItems, setSpecItems] = useState<SpecItem[]>([])
  const [categoryGroups, setCategoryGroups] = useState<CategoryGroup[]>([])
  const [specSearchQuery, setSpecSearchQuery] = useState('')
  const [loadingSpecs, setLoadingSpecs] = useState(false)
  const [savingRFQ, setSavingRFQ] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showAddItems, setShowAddItems] = useState(false)

  // Supplier selection state
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [selectedSupplierId, setSelectedSupplierId] = useState<string | null>(null)
  const [loadingSuppliers, setLoadingSuppliers] = useState(false)

  const fetchRFQs = async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/rfq?projectId=${projectId}`)
      if (response.ok) {
        const data = await response.json()
        // Map the API response to our RFQ interface
        // Use _count for accurate counts since it comes from Prisma aggregation
        const mappedRfqs: RFQ[] = (data.rfqs || []).map((rfq: any) => {
          // Extract supplier names
          const supplierNames = (rfq.supplierRFQs || []).map((sRfq: any) =>
            sRfq.supplier?.name || sRfq.vendorName || 'Unknown'
          )

          // Derive display status based on supplier activity
          // Since RFQ is sent to one supplier at a time, check that supplier's status
          let displayStatus = rfq.status
          if (rfq.status === 'SENT' && rfq.supplierRFQs?.length > 0) {
            const supplierRfq = rfq.supplierRFQs[0]
            if (supplierRfq.responseStatus === 'SUBMITTED') {
              displayStatus = 'FULLY_QUOTED'
            } else if (supplierRfq.responseStatus === 'DECLINED') {
              displayStatus = 'CANCELLED'
            } else if (supplierRfq.viewedAt) {
              displayStatus = 'VIEWED'
            }
          }

          // Get latest quote ID from supplier RFQs that have submitted
          let latestQuoteId: string | null = null
          if (rfq.supplierRFQs?.length > 0) {
            const submittedRfq = rfq.supplierRFQs.find((s: any) => s.responseStatus === 'SUBMITTED')
            if (submittedRfq?.quotes?.length > 0) {
              // Get the most recent quote
              latestQuoteId = submittedRfq.quotes[0]?.id || null
            }
          }

          return {
            id: rfq.id,
            rfqNumber: rfq.rfqNumber,
            title: rfq.title,
            suppliersCount: rfq._count?.supplierRFQs || rfq.supplierRFQs?.length || 0,
            supplierNames,
            itemsCount: rfq._count?.lineItems || rfq.lineItems?.length || 0,
            sentAt: rfq.sentAt ? new Date(rfq.sentAt).toLocaleDateString() : null,
            deadline: rfq.responseDeadline ? new Date(rfq.responseDeadline).toLocaleDateString() : null,
            status: displayStatus,
            latestQuoteId
          }
        })
        setRfqs(mappedRfqs)
      }
    } catch (error) {
      console.error('Error fetching RFQs:', error)
    } finally {
      setLoading(false)
    }
  }

  // Fetch and show RFQ detail in panel
  const handleViewRFQ = async (rfqId: string) => {
    setDetailLoading(true)
    try {
      const response = await fetch(`/api/rfq/${rfqId}`)
      if (response.ok) {
        const data = await response.json()
        setSelectedRFQ(data.rfq)
      } else {
        toast.error('Failed to load RFQ details')
      }
    } catch (error) {
      console.error('Error loading RFQ:', error)
      toast.error('Failed to load RFQ details')
    } finally {
      setDetailLoading(false)
    }
  }

  // Format date helper
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Send RFQ to suppliers
  const handleSendRFQ = async (rfqId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    setSendingId(rfqId)
    try {
      const response = await fetch(`/api/rfq/${rfqId}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
      if (response.ok) {
        toast.success('RFQ sent to suppliers')
        fetchRFQs()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to send RFQ')
      }
    } catch (error) {
      console.error('Error sending RFQ:', error)
      toast.error('Failed to send RFQ')
    } finally {
      setSendingId(null)
    }
  }

  useEffect(() => {
    fetchRFQs()
  }, [projectId, refreshKey])

  // Fetch spec items for the project
  const fetchSpecItems = async () => {
    setLoadingSpecs(true)
    try {
      const response = await fetch(`/api/projects/${projectId}/specs`)
      if (response.ok) {
        const data = await response.json()
        // The API returns specs as a flat array with roomName and categoryName
        const items: SpecItem[] = (data.specs || []).map((spec: any) => ({
          id: spec.id,
          name: spec.name,
          description: spec.description,
          quantity: spec.quantity || 1,
          category: spec.categoryName || spec.sectionName || 'Uncategorized',
          room: spec.roomName,
          images: spec.images
        }))

        setSpecItems(items)

        // Group by category
        const grouped = items.reduce((acc: Record<string, SpecItem[]>, item) => {
          const cat = item.category || 'Uncategorized'
          if (!acc[cat]) acc[cat] = []
          acc[cat].push(item)
          return acc
        }, {})

        const groups: CategoryGroup[] = Object.entries(grouped)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([category, categoryItems]) => ({
            category,
            items: categoryItems,
            expanded: false
          }))
        setCategoryGroups(groups)
      }
    } catch (error) {
      console.error('Error fetching specs:', error)
    } finally {
      setLoadingSpecs(false)
    }
  }

  // Fetch suppliers list
  const fetchSuppliers = async () => {
    setLoadingSuppliers(true)
    try {
      const response = await fetch('/api/suppliers')
      if (response.ok) {
        const data = await response.json()
        setSuppliers(data.suppliers || [])
      }
    } catch (error) {
      console.error('Error fetching suppliers:', error)
    } finally {
      setLoadingSuppliers(false)
    }
  }

  // Open edit dialog for an RFQ
  const handleEditRFQ = async (rfqId: string) => {
    setDetailLoading(true)
    setShowAddItems(false)
    setSpecSearchQuery('')
    try {
      const response = await fetch(`/api/rfq/${rfqId}`)
      if (response.ok) {
        const data = await response.json()
        setEditingRFQ(data.rfq)

        // Convert current line items to edit format
        const currentItems: EditLineItem[] = data.rfq.lineItems.map((li: any) => ({
          id: li.id,
          roomFFEItemId: li.roomFFEItemId || '',
          itemName: li.itemName,
          itemDescription: li.itemDescription,
          quantity: li.quantity || 1,
          unitType: li.unitType
        }))
        setEditLineItems(currentItems)

        // Set current supplier (RFQ is sent to one supplier at a time)
        const currentSupplierRfq = data.rfq.supplierRFQs?.[0]
        if (currentSupplierRfq?.supplier?.id) {
          setSelectedSupplierId(currentSupplierRfq.supplier.id)
        } else {
          setSelectedSupplierId(null)
        }

        // Fetch spec items and suppliers
        await Promise.all([fetchSpecItems(), fetchSuppliers()])
      }
    } catch (error) {
      console.error('Error loading RFQ for edit:', error)
      toast.error('Failed to load RFQ')
    } finally {
      setDetailLoading(false)
    }
  }

  // Delete RFQ
  const handleDeleteRFQ = async (rfqId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!confirm('Are you sure you want to delete this RFQ? This cannot be undone.')) {
      return
    }
    setDeletingId(rfqId)
    try {
      const response = await fetch(`/api/rfq/${rfqId}`, { method: 'DELETE' })
      if (response.ok) {
        toast.success('RFQ deleted')
        fetchRFQs()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to delete RFQ')
      }
    } catch (error) {
      console.error('Error deleting RFQ:', error)
      toast.error('Failed to delete RFQ')
    } finally {
      setDeletingId(null)
    }
  }

  // Duplicate RFQ
  const handleDuplicateRFQ = async (rfqId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      const response = await fetch(`/api/rfq/${rfqId}/duplicate`, { method: 'POST' })
      if (response.ok) {
        toast.success('RFQ duplicated')
        fetchRFQs()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to duplicate RFQ')
      }
    } catch (error) {
      console.error('Error duplicating RFQ:', error)
      toast.error('Failed to duplicate RFQ')
    }
  }

  // Toggle category expansion
  const toggleCategory = (category: string) => {
    setCategoryGroups(prev => prev.map(g =>
      g.category === category ? { ...g, expanded: !g.expanded } : g
    ))
  }

  // Update a line item field
  const updateLineItem = (index: number, field: keyof EditLineItem, value: any) => {
    setEditLineItems(prev => prev.map((item, i) =>
      i === index ? { ...item, [field]: value } : item
    ))
  }

  // Remove a line item
  const removeLineItem = (index: number) => {
    setEditLineItems(prev => prev.filter((_, i) => i !== index))
  }

  // Add items from spec selection
  const addItemsFromSpec = (specItemsToAdd: SpecItem[]) => {
    const newItems: EditLineItem[] = specItemsToAdd.map(item => ({
      roomFFEItemId: item.id,
      itemName: item.name,
      itemDescription: item.description,
      quantity: item.quantity || 1,
      specItem: item
    }))
    setEditLineItems(prev => [...prev, ...newItems])
    setShowAddItems(false)
    setSpecSearchQuery('')
  }

  // Check if a spec item is already in the RFQ
  const isItemInRFQ = (specItemId: string) => {
    return editLineItems.some(li => li.roomFFEItemId === specItemId)
  }

  // Save RFQ changes
  const handleSaveRFQ = async () => {
    if (!editingRFQ) return
    if (editLineItems.length === 0) {
      toast.error('Please add at least one item to the RFQ')
      return
    }
    setSavingRFQ(true)
    try {
      const response = await fetch(`/api/rfq/${editingRFQ.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lineItems: editLineItems.map(item => ({
            roomFFEItemId: item.roomFFEItemId || null,
            itemName: item.itemName,
            itemDescription: item.itemDescription,
            quantity: item.quantity
          })),
          supplierId: selectedSupplierId
        })
      })

      if (response.ok) {
        toast.success('RFQ updated')
        setEditingRFQ(null)
        setEditLineItems([])
        fetchRFQs()
      } else {
        const error = await response.json()
        toast.error(error.error || 'Failed to update RFQ')
      }
    } catch (error) {
      console.error('Error saving RFQ:', error)
      toast.error('Failed to save RFQ')
    } finally {
      setSavingRFQ(false)
    }
  }

  // Filter spec items by search (excluding already added items)
  const filteredCategoryGroups = categoryGroups.map(group => ({
    ...group,
    items: group.items.filter(item =>
      !isItemInRFQ(item.id) && (
        !specSearchQuery ||
        item.name.toLowerCase().includes(specSearchQuery.toLowerCase()) ||
        item.category?.toLowerCase().includes(specSearchQuery.toLowerCase()) ||
        item.room?.toLowerCase().includes(specSearchQuery.toLowerCase())
      )
    )
  })).filter(group => group.items.length > 0)

  // Filter RFQs based on search
  const filteredRfqs = rfqs.filter(rfq =>
    !searchQuery ||
    rfq.rfqNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    rfq.title.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Stats
  const draftCount = rfqs.filter(r => r.status === 'DRAFT').length
  const sentCount = rfqs.filter(r => r.status === 'SENT').length
  const respondedCount = rfqs.filter(r =>
    r.status === 'PARTIALLY_QUOTED' ||
    r.status === 'FULLY_QUOTED' ||
    r.status === 'QUOTE_ACCEPTED'
  ).length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-gray-200">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-gray-900">{draftCount}</p>
                <p className="text-sm text-gray-500">Drafts</p>
              </div>
              <div className="w-2 h-8 bg-gray-200 rounded-full" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-blue-600">{sentCount}</p>
                <p className="text-sm text-gray-500">Sent</p>
              </div>
              <div className="w-2 h-8 bg-blue-200 rounded-full" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-gray-200">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-semibold text-emerald-600">{respondedCount}</p>
                <p className="text-sm text-gray-500">Responded</p>
              </div>
              <div className="w-2 h-8 bg-emerald-200 rounded-full" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* RFQs Table */}
      <Card className="border-gray-200">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold">Request for Quotes</CardTitle>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" className="h-8 text-gray-600" onClick={fetchRFQs}>
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {filteredRfqs.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-gray-200 rounded-lg bg-gray-50/50">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <FileText className="w-6 h-6 text-gray-400" />
              </div>
              <h3 className="text-sm font-medium text-gray-900 mb-1">No RFQs yet</h3>
              <p className="text-sm text-gray-500">
                Click "New RFQ" in the header to create your first Request for Quote
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="text-gray-500 font-medium">RFQ #</TableHead>
                  <TableHead className="text-gray-500 font-medium">Title</TableHead>
                  <TableHead className="text-gray-500 font-medium">Suppliers</TableHead>
                  <TableHead className="text-gray-500 font-medium">Items</TableHead>
                  <TableHead className="text-gray-500 font-medium">Sent</TableHead>
                  <TableHead className="text-gray-500 font-medium">Deadline</TableHead>
                  <TableHead className="text-gray-500 font-medium">Status</TableHead>
                  <TableHead className="text-gray-500 font-medium w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRfqs.map((rfq) => (
                  <TableRow
                    key={rfq.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => handleViewRFQ(rfq.id)}
                  >
                    <TableCell className="font-medium text-gray-900">{rfq.rfqNumber}</TableCell>
                    <TableCell className="text-gray-600">{rfq.title}</TableCell>
                    <TableCell className="text-gray-600">
                      {rfq.supplierNames.length === 0 ? (
                        <span className="text-gray-400">-</span>
                      ) : rfq.supplierNames.length <= 2 ? (
                        rfq.supplierNames.join(', ')
                      ) : (
                        <span title={rfq.supplierNames.join(', ')}>
                          {rfq.supplierNames.slice(0, 2).join(', ')} +{rfq.supplierNames.length - 2}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-gray-600">{rfq.itemsCount}</TableCell>
                    <TableCell className="text-gray-600">{rfq.sentAt || '-'}</TableCell>
                    <TableCell className="text-gray-600">
                      {rfq.status !== 'DRAFT' && rfq.deadline ? rfq.deadline : '-'}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Badge className={statusConfig[rfq.status].color}>
                          {statusConfig[rfq.status].label}
                        </Badge>
                        {rfq.latestQuoteId && onViewQuote && (
                          <Button
                            variant="link"
                            size="sm"
                            className="h-auto p-0 text-xs text-blue-600 hover:text-blue-800"
                            onClick={(e) => {
                              e.stopPropagation()
                              onViewQuote(rfq.latestQuoteId!)
                            }}
                          >
                            View Quote →
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-gray-500 hover:text-gray-900"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem onClick={() => handleViewRFQ(rfq.id)}>
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleEditRFQ(rfq.id)}>
                            <Pencil className="w-4 h-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={(e) => handleDuplicateRFQ(rfq.id, e as any)}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                          </DropdownMenuItem>
                          {rfq.status === 'DRAFT' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => handleSendRFQ(rfq.id, e as any)}
                                disabled={sendingId === rfq.id}
                                className="text-blue-600"
                              >
                                <Send className="w-4 h-4 mr-2" />
                                Send to Suppliers
                              </DropdownMenuItem>
                            </>
                          )}
                          {rfq.status !== 'DRAFT' && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={(e) => handleSendRFQ(rfq.id, e as any)}
                                disabled={sendingId === rfq.id}
                                className="text-blue-600"
                              >
                                <Send className="w-4 h-4 mr-2" />
                                Resend to Suppliers
                              </DropdownMenuItem>
                            </>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={(e) => handleDeleteRFQ(rfq.id, e as any)}
                            disabled={deletingId === rfq.id}
                            className="text-red-600"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* RFQ Detail Panel - Preview Modal */}
      <Dialog open={!!selectedRFQ} onOpenChange={(open) => !open && setSelectedRFQ(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <DialogTitle className="sr-only">Loading RFQ Details</DialogTitle>
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600" />
            </div>
          ) : selectedRFQ ? (
            <>
              {/* Header - Fixed */}
              <div className="px-6 py-4 border-b bg-white">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h2 className="text-xl font-bold text-gray-900">{selectedRFQ.rfqNumber}</h2>
                      <Badge className={statusConfig[selectedRFQ.status]?.color || 'bg-gray-100'}>
                        {statusConfig[selectedRFQ.status]?.label || selectedRFQ.status}
                      </Badge>
                    </div>
                    <DialogTitle className="text-lg text-gray-700 font-normal">{selectedRFQ.title}</DialogTitle>
                  </div>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto px-6 py-4">
                {/* Info Bar */}
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-6 pb-4 border-b">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-4 h-4" />
                    <span>Created: {formatDate(selectedRFQ.createdAt)}</span>
                  </div>
                  {selectedRFQ.sentAt && (
                    <div className="flex items-center gap-1.5 text-blue-600">
                      <Send className="w-4 h-4" />
                      <span>Sent: {formatDate(selectedRFQ.sentAt)}</span>
                    </div>
                  )}
                  {/* Only show deadline if RFQ has been sent */}
                  {selectedRFQ.sentAt && selectedRFQ.responseDeadline && (
                    <div className="flex items-center gap-1.5 text-amber-600">
                      <Clock className="w-4 h-4" />
                      <span>Deadline: {formatDate(selectedRFQ.responseDeadline)}</span>
                    </div>
                  )}
                </div>

                {selectedRFQ.description && (
                  <div className="mb-6">
                    <p className="text-sm text-gray-600">{selectedRFQ.description}</p>
                  </div>
                )}

                {/* Items Section - Card Style with Images */}
                <div className="mb-6">
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                    <Package className="w-4 h-4 text-blue-500" />
                    Requested Items ({selectedRFQ.lineItems.length})
                  </h3>
                  {selectedRFQ.lineItems.length === 0 ? (
                    <p className="text-sm text-gray-500 italic py-4 text-center bg-gray-50 rounded-lg">No items added yet</p>
                  ) : (
                    <div className="space-y-3">
                      {selectedRFQ.lineItems.map((item, index) => {
                        const specItem = item.roomFFEItem
                        const image = specItem?.images?.[0]
                        const roomName = specItem?.section?.instance?.room?.name
                        const categoryName = specItem?.section?.name

                        return (
                          <div key={item.id} className="border rounded-lg p-4 bg-white hover:shadow-sm transition-shadow">
                            <div className="flex gap-4">
                              {/* Image */}
                              <div className="flex-shrink-0">
                                {image ? (
                                  <img
                                    src={image}
                                    alt={item.itemName}
                                    className="w-20 h-20 object-cover rounded-lg border"
                                  />
                                ) : (
                                  <div className="w-20 h-20 bg-gray-100 rounded-lg border flex items-center justify-center">
                                    <Package className="w-8 h-8 text-gray-300" />
                                  </div>
                                )}
                              </div>

                              {/* Details */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-4">
                                  <div>
                                    <h4 className="font-medium text-gray-900">{item.itemName}</h4>
                                    {item.itemDescription && (
                                      <p className="text-sm text-gray-500 mt-0.5 line-clamp-2">{item.itemDescription}</p>
                                    )}
                                  </div>
                                  <div className="text-right flex-shrink-0">
                                    <span className="inline-flex items-center px-2.5 py-1 rounded-full text-sm font-medium bg-blue-50 text-blue-700">
                                      Qty: {item.quantity}
                                    </span>
                                  </div>
                                </div>

                                {/* Meta info */}
                                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-gray-500">
                                  {roomName && (
                                    <span className="flex items-center gap-1">
                                      <span className="font-medium">Room:</span> {roomName}
                                    </span>
                                  )}
                                  {categoryName && (
                                    <span className="flex items-center gap-1">
                                      <span className="font-medium">Category:</span> {categoryName}
                                    </span>
                                  )}
                                  {specItem?.brand && (
                                    <span className="flex items-center gap-1">
                                      <span className="font-medium">Brand:</span> {specItem.brand}
                                    </span>
                                  )}
                                  {specItem?.sku && (
                                    <span className="flex items-center gap-1">
                                      <span className="font-medium">SKU:</span> {specItem.sku}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Suppliers Section */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2 uppercase tracking-wide">
                    <Building2 className="w-4 h-4 text-emerald-500" />
                    Suppliers ({selectedRFQ.supplierRFQs.length})
                  </h3>
                  {selectedRFQ.supplierRFQs.length === 0 ? (
                    <p className="text-sm text-gray-500 italic py-4 text-center bg-gray-50 rounded-lg">No suppliers added yet</p>
                  ) : (
                    <div className="space-y-2">
                      {selectedRFQ.supplierRFQs.map((sRFQ) => (
                        <div key={sRFQ.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                              <span className="text-sm font-bold text-emerald-700">
                                {(sRFQ.supplier?.name || sRFQ.vendorName || 'S').substring(0, 1).toUpperCase()}
                              </span>
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {sRFQ.supplier?.name || sRFQ.vendorName}
                              </p>
                              <p className="text-sm text-gray-500">
                                {sRFQ.supplier?.email || sRFQ.vendorEmail}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={
                              selectedRFQ.status === 'DRAFT'
                                ? 'bg-gray-100 text-gray-600'
                                : sRFQ.viewedAt && sRFQ.responseStatus === 'PENDING'
                                  ? 'bg-blue-50 text-blue-700'
                                  : statusConfig[sRFQ.responseStatus]?.color || 'bg-gray-100 text-gray-600'
                            }>
                              {selectedRFQ.status === 'DRAFT'
                                ? 'Not Sent'
                                : sRFQ.viewedAt && sRFQ.responseStatus === 'PENDING'
                                  ? (
                                    <span className="flex items-center gap-1">
                                      <Eye className="w-3 h-3" /> Viewed
                                    </span>
                                  )
                                  : sRFQ.responseStatus === 'PENDING'
                                    ? 'Awaiting Response'
                                    : sRFQ.responseStatus === 'SUBMITTED'
                                      ? 'Quoted'
                                      : sRFQ.responseStatus}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Footer - Fixed */}
              <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
                <Button
                  variant="outline"
                  onClick={() => {
                    const rfqId = selectedRFQ.id
                    setSelectedRFQ(null)
                    handleEditRFQ(rfqId)
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit RFQ
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => setSelectedRFQ(null)}>
                    Close
                  </Button>
                  {selectedRFQ.status === 'DRAFT' && (
                    <Button
                      onClick={() => {
                        handleSendRFQ(selectedRFQ.id, { stopPropagation: () => {} } as React.MouseEvent)
                        setSelectedRFQ(null)
                      }}
                      disabled={sendingId === selectedRFQ.id}
                    >
                      <Send className="w-4 h-4 mr-2" />
                      Send to Suppliers
                    </Button>
                  )}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Edit RFQ Dialog */}
      <Dialog open={!!editingRFQ} onOpenChange={(open) => {
        if (!open) {
          setEditingRFQ(null)
          setEditLineItems([])
          setShowAddItems(false)
          setSelectedSupplierId(null)
        }
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
          {detailLoading ? (
            <div className="flex items-center justify-center py-12">
              <DialogTitle className="sr-only">Loading RFQ</DialogTitle>
              <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600" />
            </div>
          ) : editingRFQ ? (
            <>
              {/* Header */}
              <div className="px-6 py-4 border-b bg-white">
                <div className="flex items-center justify-between">
                  <div>
                    <DialogTitle className="text-lg font-semibold">Edit RFQ: {editingRFQ.rfqNumber}</DialogTitle>
                    <p className="text-sm text-gray-500 mt-1">{editingRFQ.title}</p>
                  </div>
                  <Badge className={statusConfig[editingRFQ.status]?.color || 'bg-gray-100'}>
                    {statusConfig[editingRFQ.status]?.label || editingRFQ.status}
                  </Badge>
                </div>
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {/* Supplier Selection - Only show for drafts */}
                {!showAddItems && editingRFQ.status === 'DRAFT' && (
                  <div className="px-6 py-4 border-b">
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                      Supplier
                    </label>
                    <select
                      value={selectedSupplierId || ''}
                      onChange={(e) => setSelectedSupplierId(e.target.value || null)}
                      className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a supplier...</option>
                      {suppliers.map(supplier => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name} {supplier.email ? `(${supplier.email})` : ''}
                        </option>
                      ))}
                    </select>
                    {loadingSuppliers && (
                      <p className="text-xs text-gray-400 mt-1">Loading suppliers...</p>
                    )}
                  </div>
                )}

                {/* Current Items List */}
                {!showAddItems && (
                  <div className="px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-medium text-gray-900">
                        Items in RFQ ({editLineItems.length})
                      </h3>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowAddItems(true)}
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Items
                      </Button>
                    </div>

                    {editLineItems.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed">
                        <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 mb-4">No items in this RFQ yet</p>
                        <Button onClick={() => setShowAddItems(true)}>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Items from All Specs
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {editLineItems.map((item, index) => (
                          <div key={index} className="border rounded-lg p-4 bg-white">
                            <div className="flex items-start gap-4">
                              <div className="flex-1 space-y-3">
                                {/* Item Name */}
                                <div>
                                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                    Item Name
                                  </label>
                                  <Input
                                    value={item.itemName}
                                    onChange={(e) => updateLineItem(index, 'itemName', e.target.value)}
                                    className="mt-1"
                                  />
                                </div>

                                {/* Description & Quantity Row */}
                                <div className="grid grid-cols-3 gap-3">
                                  <div className="col-span-2">
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                      Description
                                    </label>
                                    <Input
                                      value={item.itemDescription || ''}
                                      onChange={(e) => updateLineItem(index, 'itemDescription', e.target.value)}
                                      placeholder="Optional description..."
                                      className="mt-1"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">
                                      Quantity
                                    </label>
                                    <Input
                                      type="number"
                                      min="1"
                                      value={item.quantity}
                                      onChange={(e) => updateLineItem(index, 'quantity', parseInt(e.target.value) || 1)}
                                      className="mt-1"
                                    />
                                  </div>
                                </div>

                                {/* Linked to All Specs indicator */}
                                {item.roomFFEItemId && (
                                  <p className="text-xs text-emerald-600 flex items-center gap-1">
                                    <Check className="w-3 h-3" />
                                    Linked to All Specs
                                  </p>
                                )}
                              </div>

                              {/* Remove Button */}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                onClick={() => removeLineItem(index)}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Add Items Panel */}
                {showAddItems && (
                  <div className="px-6 py-4">
                    <div className="flex items-center justify-between mb-4">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowAddItems(false)
                          setSpecSearchQuery('')
                        }}
                      >
                        <ChevronRight className="w-4 h-4 mr-1 rotate-180" />
                        Back to Items
                      </Button>
                      <p className="text-sm text-gray-500">
                        Select items to add from All Specs
                      </p>
                    </div>

                    {/* Search */}
                    <Input
                      placeholder="Search by name, category, or room..."
                      value={specSearchQuery}
                      onChange={(e) => setSpecSearchQuery(e.target.value)}
                      className="mb-4"
                    />

                    {/* Categories */}
                    {loadingSpecs ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-300 border-t-gray-600" />
                      </div>
                    ) : filteredCategoryGroups.length === 0 ? (
                      <div className="text-center py-12 bg-gray-50 rounded-lg">
                        <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500">
                          {specItems.length === 0
                            ? 'No items in All Specs'
                            : 'All items already added to RFQ'}
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {filteredCategoryGroups.map((group) => (
                          <div key={group.category} className="border rounded-lg overflow-hidden">
                            <button
                              className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
                              onClick={() => toggleCategory(group.category)}
                            >
                              <div className="flex items-center gap-3">
                                <ChevronRight
                                  className={`w-4 h-4 text-gray-500 transition-transform ${
                                    group.expanded ? 'rotate-90' : ''
                                  }`}
                                />
                                <span className="font-medium text-gray-900">{group.category}</span>
                                <Badge variant="outline" className="text-xs">
                                  {group.items.length} available
                                </Badge>
                              </div>
                            </button>

                            {group.expanded && (
                              <div className="divide-y">
                                {group.items.map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50"
                                  >
                                    {item.images && item.images[0] ? (
                                      <img
                                        src={item.images[0]}
                                        alt={item.name}
                                        className="w-10 h-10 object-cover rounded border"
                                      />
                                    ) : (
                                      <div className="w-10 h-10 bg-gray-100 rounded border flex items-center justify-center">
                                        <Package className="w-4 h-4 text-gray-400" />
                                      </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <p className="font-medium text-gray-900 truncate">{item.name}</p>
                                      <p className="text-sm text-gray-500 truncate">
                                        {item.room && <span>{item.room} • </span>}
                                        Qty: {item.quantity}
                                      </p>
                                    </div>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => addItemsFromSpec([item])}
                                    >
                                      <Plus className="w-4 h-4 mr-1" />
                                      Add
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
                <p className="text-sm text-gray-600">
                  <span className="font-medium">{editLineItems.length}</span> item{editLineItems.length !== 1 ? 's' : ''} in RFQ
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => {
                    setEditingRFQ(null)
                    setEditLineItems([])
                    setShowAddItems(false)
                    setSelectedSupplierId(null)
                  }}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleSaveRFQ}
                    disabled={savingRFQ || editLineItems.length === 0}
                  >
                    {savingRFQ ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  )
}
