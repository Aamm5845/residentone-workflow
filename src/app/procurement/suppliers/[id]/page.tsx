'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Building2,
  Mail,
  Phone,
  Globe,
  MapPin,
  ArrowLeft,
  Package,
  FileText,
  ShoppingCart,
  Loader2,
  AlertCircle,
  ExternalLink,
  Clock,
  CheckCircle,
  XCircle,
  Eye,
  DollarSign,
  TrendingUp,
  FolderOpen,
  Send,
  ChevronRight,
  MoreHorizontal,
  User,
  Calendar,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

interface SupplierDetailPageProps {
  params: Promise<{ id: string }>
}

interface SupplierData {
  supplier: {
    id: string
    name: string
    contactName?: string
    email?: string
    phone?: string
    website?: string
    logo?: string
    address?: string
    city?: string
    province?: string
    postalCode?: string
    country?: string
    notes?: string
    currency?: string
    category?: {
      id: string
      name: string
      color?: string
    }
    additionalEmails?: string[]
    hasPortalAccess?: boolean
    portalLastLogin?: string
    createdAt: string
  }
  statistics: {
    totalRFQs: number
    pendingRFQs: number
    quotedRFQs: number
    declinedRFQs: number
    totalItemsRequested: number
    totalQuotedValue: number
    totalOrderValue: number
    totalOrders: number
    projectCount: number
  }
  projects: Array<{
    id: string
    name: string
    clientName?: string
  }>
  rfqs: Array<{
    id: string
    rfqId: string
    rfqNumber: string
    title: string
    projectName: string
    projectId: string
    status: string
    sentAt: string
    viewedAt?: string
    respondedAt?: string
    accessToken: string
    itemCount: number
    quote?: {
      id: string
      quoteNumber: string
      status: string
      totalAmount?: number
      submittedAt?: string
      validUntil?: string
    }
  }>
  orders: Array<{
    id: string
    orderNumber: string
    projectName: string
    projectId: string
    status: string
    totalAmount?: number
    itemCount: number
    createdAt: string
    expectedDeliveryDate?: string
  }>
  items: Array<{
    id: string
    name: string
    images?: string[]
    brand?: string
    sku?: string
    quantity: number
    projectName: string
    rfqNumber: string
    rfqStatus: string
    quotedPrice?: number
    quoteStatus?: string
  }>
}

export default function SupplierDetailPage({ params }: SupplierDetailPageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<SupplierData | null>(null)
  const [activeTab, setActiveTab] = useState('rfqs')

  useEffect(() => {
    loadSupplier()
  }, [id])

  const loadSupplier = async () => {
    try {
      const response = await fetch(`/api/suppliers/${id}`)
      if (response.ok) {
        const result = await response.json()
        setData(result)
      } else {
        const err = await response.json()
        setError(err.error || 'Failed to load supplier')
      }
    } catch (err) {
      setError('Failed to load supplier')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: data?.supplier.currency || 'CAD'
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-CA', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; label: string }> = {
      PENDING: { color: 'bg-yellow-100 text-yellow-700', label: 'Pending' },
      SUBMITTED: { color: 'bg-green-100 text-green-700', label: 'Quoted' },
      DECLINED: { color: 'bg-red-100 text-red-700', label: 'Declined' },
      EXPIRED: { color: 'bg-gray-100 text-gray-700', label: 'Expired' },
      DRAFT: { color: 'bg-gray-100 text-gray-600', label: 'Draft' },
      UNDER_REVIEW: { color: 'bg-blue-100 text-blue-700', label: 'Under Review' },
      ACCEPTED: { color: 'bg-green-100 text-green-700', label: 'Accepted' },
      REJECTED: { color: 'bg-red-100 text-red-700', label: 'Rejected' },
      // Order statuses
      PENDING_PAYMENT: { color: 'bg-yellow-100 text-yellow-700', label: 'Pending Payment' },
      PAYMENT_RECEIVED: { color: 'bg-blue-100 text-blue-700', label: 'Payment Received' },
      ORDERED: { color: 'bg-purple-100 text-purple-700', label: 'Ordered' },
      CONFIRMED: { color: 'bg-indigo-100 text-indigo-700', label: 'Confirmed' },
      IN_PRODUCTION: { color: 'bg-orange-100 text-orange-700', label: 'In Production' },
      SHIPPED: { color: 'bg-cyan-100 text-cyan-700', label: 'Shipped' },
      DELIVERED: { color: 'bg-green-100 text-green-700', label: 'Delivered' },
      COMPLETED: { color: 'bg-emerald-100 text-emerald-700', label: 'Completed' }
    }
    const config = statusConfig[status] || { color: 'bg-gray-100 text-gray-600', label: status }
    return <Badge className={cn('font-medium', config.color)}>{config.label}</Badge>
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Error</h2>
            <p className="text-gray-500">{error || 'Supplier not found'}</p>
            <Button onClick={() => router.back()} className="mt-4">
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { supplier, statistics, projects, rfqs, orders, items } = data

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
            <div className="h-6 w-px bg-gray-200" />
            <div className="flex items-center gap-3 flex-1">
              <Avatar className="h-12 w-12">
                {supplier.logo ? (
                  <AvatarImage src={supplier.logo} alt={supplier.name} />
                ) : null}
                <AvatarFallback className="bg-emerald-100 text-emerald-700 text-lg">
                  {supplier.name.substring(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-xl font-bold text-gray-900">{supplier.name}</h1>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  {supplier.category && (
                    <Badge
                      variant="outline"
                      style={{ borderColor: supplier.category.color, color: supplier.category.color }}
                    >
                      {supplier.category.name}
                    </Badge>
                  )}
                  {supplier.contactName && (
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      {supplier.contactName}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {rfqs.length > 0 && rfqs[0].accessToken && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(`/supplier-portal/${rfqs[0].accessToken}`, '_blank')}
                >
                  <Eye className="w-4 h-4 mr-2" />
                  Preview Portal
                </Button>
              )}
              <Link href={`/preferences?tab=suppliers&edit=${supplier.id}`}>
                <Button variant="outline" size="sm">
                  Edit Supplier
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {/* Contact Info & Stats Row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Contact Info */}
          <Card className="lg:col-span-1">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {supplier.email && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-gray-400" />
                  <a href={`mailto:${supplier.email}`} className="text-blue-600 hover:underline">
                    {supplier.email}
                  </a>
                </div>
              )}
              {supplier.phone && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-gray-400" />
                  <a href={`tel:${supplier.phone}`} className="hover:underline">
                    {supplier.phone}
                  </a>
                </div>
              )}
              {supplier.website && (
                <div className="flex items-center gap-3">
                  <Globe className="w-4 h-4 text-gray-400" />
                  <a
                    href={supplier.website.startsWith('http') ? supplier.website : `https://${supplier.website}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {supplier.website.replace(/^https?:\/\//, '')}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
              {(supplier.address || supplier.city) && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                  <div>
                    {supplier.address && <p>{supplier.address}</p>}
                    <p>
                      {supplier.city}{supplier.province ? `, ${supplier.province}` : ''} {supplier.postalCode}
                    </p>
                    {supplier.country && <p>{supplier.country}</p>}
                  </div>
                </div>
              )}
              {supplier.portalLastLogin && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-gray-400">Last portal login</p>
                  <p className="text-gray-600">{formatDate(supplier.portalLastLogin)}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Statistics */}
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Overview</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-3 bg-blue-50 rounded-xl">
                  <FileText className="w-6 h-6 text-blue-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-blue-700">{statistics.totalRFQs}</p>
                  <p className="text-xs text-blue-600">RFQs Sent</p>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-xl">
                  <CheckCircle className="w-6 h-6 text-green-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-green-700">{statistics.quotedRFQs}</p>
                  <p className="text-xs text-green-600">Quotes Received</p>
                </div>
                <div className="text-center p-3 bg-purple-50 rounded-xl">
                  <ShoppingCart className="w-6 h-6 text-purple-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-purple-700">{statistics.totalOrders}</p>
                  <p className="text-xs text-purple-600">Orders Placed</p>
                </div>
                <div className="text-center p-3 bg-amber-50 rounded-xl">
                  <FolderOpen className="w-6 h-6 text-amber-600 mx-auto mb-1" />
                  <p className="text-2xl font-bold text-amber-700">{statistics.projectCount}</p>
                  <p className="text-xs text-amber-600">Projects</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4 pt-4 border-t">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                    <Package className="w-5 h-5 text-gray-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{statistics.totalItemsRequested}</p>
                    <p className="text-xs text-gray-500">Items Requested</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{formatCurrency(statistics.totalQuotedValue)}</p>
                    <p className="text-xs text-gray-500">Total Quoted</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-xl font-bold">{formatCurrency(statistics.totalOrderValue)}</p>
                    <p className="text-xs text-gray-500">Total Ordered</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Projects Quick Access */}
        {projects.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FolderOpen className="w-4 h-4" />
                Projects with this Supplier
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {projects.map(project => (
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <Badge
                      variant="outline"
                      className="cursor-pointer hover:bg-gray-100 transition-colors py-1.5 px-3"
                    >
                      {project.name}
                      {project.clientName && (
                        <span className="text-gray-400 ml-1">({project.clientName})</span>
                      )}
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Badge>
                  </Link>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Tabs for RFQs, Orders, Items */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="rfqs" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              RFQs
              <Badge variant="secondary" className="ml-1">{rfqs.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="orders" className="flex items-center gap-2">
              <ShoppingCart className="w-4 h-4" />
              Orders
              <Badge variant="secondary" className="ml-1">{orders.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="items" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Items
              <Badge variant="secondary" className="ml-1">{items.length}</Badge>
            </TabsTrigger>
          </TabsList>

          {/* RFQs Tab */}
          <TabsContent value="rfqs" className="mt-4">
            {rfqs.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No RFQs sent to this supplier yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {rfqs.map(rfq => (
                  <Card key={rfq.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FileText className="w-6 h-6 text-blue-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link href={`/procurement/rfq/${rfq.rfqId}`} className="font-semibold hover:text-blue-600">
                                {rfq.rfqNumber}
                              </Link>
                              {getStatusBadge(rfq.status)}
                            </div>
                            <p className="text-sm text-gray-500">{rfq.title}</p>
                            <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                              <span className="flex items-center gap-1">
                                <FolderOpen className="w-3 h-3" />
                                {rfq.projectName}
                              </span>
                              <span className="flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                {rfq.itemCount} items
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                Sent {formatDate(rfq.sentAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {rfq.quote && (
                            <div className="text-right">
                              <p className="font-semibold text-emerald-600">
                                {formatCurrency(rfq.quote.totalAmount || 0)}
                              </p>
                              <p className="text-xs text-gray-400">{rfq.quote.quoteNumber}</p>
                            </div>
                          )}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreHorizontal className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem asChild>
                                <Link href={`/procurement/rfq/${rfq.rfqId}`}>
                                  View RFQ Details
                                </Link>
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => window.open(`/supplier-portal/${rfq.accessToken}`, '_blank')}
                              >
                                <Eye className="w-4 h-4 mr-2" />
                                Preview Supplier Portal
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link href={`/projects/${rfq.projectId}`}>
                                  View Project
                                </Link>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Orders Tab */}
          <TabsContent value="orders" className="mt-4">
            {orders.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No orders placed with this supplier yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {orders.map(order => (
                  <Card key={order.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                            <ShoppingCart className="w-6 h-6 text-purple-600" />
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Link href={`/procurement/order/${order.id}`} className="font-semibold hover:text-blue-600">
                                {order.orderNumber}
                              </Link>
                              {getStatusBadge(order.status)}
                            </div>
                            <div className="flex items-center gap-3 text-xs text-gray-400 mt-1">
                              <span className="flex items-center gap-1">
                                <FolderOpen className="w-3 h-3" />
                                {order.projectName}
                              </span>
                              <span className="flex items-center gap-1">
                                <Package className="w-3 h-3" />
                                {order.itemCount} items
                              </span>
                              <span className="flex items-center gap-1">
                                <Calendar className="w-3 h-3" />
                                {formatDate(order.createdAt)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(order.totalAmount || 0)}</p>
                            {order.expectedDeliveryDate && (
                              <p className="text-xs text-gray-400">
                                ETA: {formatDate(order.expectedDeliveryDate)}
                              </p>
                            )}
                          </div>
                          <Link href={`/procurement/order/${order.id}`}>
                            <Button variant="ghost" size="sm">
                              <ChevronRight className="w-4 h-4" />
                            </Button>
                          </Link>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Items Tab */}
          <TabsContent value="items" className="mt-4">
            {items.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No items requested from this supplier yet</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((item, idx) => (
                  <Card key={`${item.id}-${idx}`} className="overflow-hidden">
                    <div className="flex">
                      <div className="w-20 h-20 bg-gray-100 flex-shrink-0">
                        {item.images && item.images[0] ? (
                          <img
                            src={item.images[0]}
                            alt={item.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-8 h-8 text-gray-300" />
                          </div>
                        )}
                      </div>
                      <CardContent className="py-3 px-4 flex-1">
                        <h4 className="font-medium text-sm line-clamp-1">{item.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          {item.brand && (
                            <Badge variant="outline" className="text-xs">{item.brand}</Badge>
                          )}
                          <span className="text-xs text-gray-500">Qty: {item.quantity}</span>
                        </div>
                        <div className="flex items-center justify-between mt-2">
                          <span className="text-xs text-gray-400">{item.projectName}</span>
                          {item.quotedPrice ? (
                            <span className="text-sm font-semibold text-emerald-600">
                              {formatCurrency(item.quotedPrice)}
                            </span>
                          ) : (
                            getStatusBadge(item.rfqStatus)
                          )}
                        </div>
                      </CardContent>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
