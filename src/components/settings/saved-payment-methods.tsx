'use client'

import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import {
  CreditCard,
  Plus,
  Trash2,
  Star,
  MoreHorizontal,
  Loader2,
  Building2,
  Edit,
  CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'

interface PaymentMethod {
  id: string
  type: string
  nickname: string | null
  lastFour: string | null
  cardBrand: string | null
  expiryMonth: number | null
  expiryYear: number | null
  expiry: string | null
  bankName: string | null
  holderName: string | null
  billingAddress: string | null
  billingCity: string | null
  billingProvince: string | null
  billingPostal: string | null
  billingCountry: string | null
  isDefault: boolean
  notes: string | null
  createdBy: string | null
  createdAt: string
  hasFullCardDetails: boolean
}

const CARD_BRAND_COLORS: Record<string, string> = {
  VISA: 'bg-blue-100 text-blue-700',
  MASTERCARD: 'bg-orange-100 text-orange-700',
  AMEX: 'bg-green-100 text-green-700',
  DISCOVER: 'bg-purple-100 text-purple-700',
  UNKNOWN: 'bg-gray-100 text-gray-700'
}

export default function SavedPaymentMethods() {
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    type: 'CREDIT_CARD',
    nickname: '',
    cardNumber: '',
    cvv: '',
    expiryMonth: '',
    expiryYear: '',
    holderName: '',
    billingAddress: '',
    billingCity: '',
    billingProvince: '',
    billingPostal: '',
    billingCountry: 'Canada',
    bankName: '',
    isDefault: false,
    notes: ''
  })

  const fetchPaymentMethods = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/saved-payment-methods')
      if (!res.ok) throw new Error('Failed to fetch')
      const data = await res.json()
      setPaymentMethods(data.paymentMethods || [])
    } catch (error) {
      toast.error('Failed to load payment methods')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchPaymentMethods()
  }, [fetchPaymentMethods])

  const resetForm = () => {
    setFormData({
      type: 'CREDIT_CARD',
      nickname: '',
      cardNumber: '',
      cvv: '',
      expiryMonth: '',
      expiryYear: '',
      holderName: '',
      billingAddress: '',
      billingCity: '',
      billingProvince: '',
      billingPostal: '',
      billingCountry: 'Canada',
      bankName: '',
      isDefault: false,
      notes: ''
    })
  }

  const handleAdd = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/saved-payment-methods', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add payment method')
      }

      toast.success('Payment method added successfully')
      setShowAddDialog(false)
      resetForm()
      fetchPaymentMethods()
    } catch (error: any) {
      toast.error(error.message || 'Failed to add payment method')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdate = async () => {
    if (!selectedMethod) return

    setSubmitting(true)
    try {
      const res = await fetch(`/api/saved-payment-methods/${selectedMethod.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: formData.nickname || undefined,
          holderName: formData.holderName || undefined,
          expiryMonth: formData.expiryMonth || undefined,
          expiryYear: formData.expiryYear || undefined,
          billingAddress: formData.billingAddress || undefined,
          billingCity: formData.billingCity || undefined,
          billingProvince: formData.billingProvince || undefined,
          billingPostal: formData.billingPostal || undefined,
          billingCountry: formData.billingCountry || undefined,
          isDefault: formData.isDefault,
          notes: formData.notes || undefined,
          // Only update card/CVV if new values provided
          ...(formData.cardNumber && { cardNumber: formData.cardNumber }),
          ...(formData.cvv && { cvv: formData.cvv })
        })
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update payment method')
      }

      toast.success('Payment method updated')
      setShowEditDialog(false)
      setSelectedMethod(null)
      resetForm()
      fetchPaymentMethods()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update payment method')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this payment method?')) return

    try {
      const res = await fetch(`/api/saved-payment-methods/${id}`, {
        method: 'DELETE'
      })

      if (!res.ok) throw new Error('Failed to delete')

      toast.success('Payment method deleted')
      fetchPaymentMethods()
    } catch (error) {
      toast.error('Failed to delete payment method')
    }
  }

  const handleSetDefault = async (id: string) => {
    try {
      const res = await fetch(`/api/saved-payment-methods/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDefault: true })
      })

      if (!res.ok) throw new Error('Failed to set default')

      toast.success('Default payment method updated')
      fetchPaymentMethods()
    } catch (error) {
      toast.error('Failed to set default payment method')
    }
  }

  const openEditDialog = (method: PaymentMethod) => {
    setSelectedMethod(method)
    setFormData({
      type: method.type,
      nickname: method.nickname || '',
      cardNumber: '',
      cvv: '',
      expiryMonth: method.expiryMonth?.toString() || '',
      expiryYear: method.expiryYear?.toString() || '',
      holderName: method.holderName || '',
      billingAddress: method.billingAddress || '',
      billingCity: method.billingCity || '',
      billingProvince: method.billingProvince || '',
      billingPostal: method.billingPostal || '',
      billingCountry: method.billingCountry || 'Canada',
      bankName: method.bankName || '',
      isDefault: method.isDefault,
      notes: method.notes || ''
    })
    setShowEditDialog(true)
  }

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\D/g, '')
    const match = v.match(/(\d{0,4})(\d{0,4})(\d{0,4})(\d{0,4})/)
    if (!match) return ''
    return [match[1], match[2], match[3], match[4]].filter(Boolean).join(' ')
  }

  const getCardIcon = (brand: string | null) => {
    return <CreditCard className="h-5 w-5" />
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Payment Methods</h2>
          <p className="text-sm text-gray-500">
            Manage saved payment methods for supplier orders
          </p>
        </div>
        <Button onClick={() => { resetForm(); setShowAddDialog(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Add Payment Method
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
        </div>
      ) : paymentMethods.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="h-12 w-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-1">No payment methods</h3>
            <p className="text-gray-500 text-center mb-4">
              Add a credit card or bank account to use for supplier payments
            </p>
            <Button onClick={() => { resetForm(); setShowAddDialog(true) }}>
              <Plus className="h-4 w-4 mr-2" />
              Add Payment Method
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {paymentMethods.map((method) => (
            <Card key={method.id} className={method.isDefault ? 'border-blue-200 bg-blue-50/50' : ''}>
              <CardContent className="flex items-center justify-between p-4">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${CARD_BRAND_COLORS[method.cardBrand || 'UNKNOWN']}`}>
                    {getCardIcon(method.cardBrand)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900">
                        {method.nickname || `${method.cardBrand || 'Card'} ending in ${method.lastFour}`}
                      </span>
                      {method.isDefault && (
                        <Badge variant="secondary" className="bg-blue-100 text-blue-700">
                          <Star className="h-3 w-3 mr-1" />
                          Default
                        </Badge>
                      )}
                      {method.hasFullCardDetails && (
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          Full Details
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                      {method.type === 'CREDIT_CARD' || method.type === 'DEBIT_CARD' ? (
                        <>
                          <span>****{method.lastFour}</span>
                          {method.expiry && <span>Exp: {method.expiry}</span>}
                          {method.holderName && <span>{method.holderName}</span>}
                        </>
                      ) : (
                        <>
                          <Building2 className="h-4 w-4" />
                          <span>{method.bankName}</span>
                          {method.lastFour && <span>****{method.lastFour}</span>}
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(method)}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    {!method.isDefault && (
                      <DropdownMenuItem onClick={() => handleSetDefault(method.id)}>
                        <Star className="h-4 w-4 mr-2" />
                        Set as Default
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDelete(method.id)}
                      className="text-red-600 focus:text-red-600"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Payment Method Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Payment Method</DialogTitle>
            <DialogDescription>
              Add a credit card for supplier payments. Full card details will be stored securely and can be shared with suppliers on purchase orders.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Payment Type</Label>
              <Select
                value={formData.type}
                onValueChange={(v) => setFormData({ ...formData, type: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CREDIT_CARD">Credit Card</SelectItem>
                  <SelectItem value="DEBIT_CARD">Debit Card</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Nickname (optional)</Label>
              <Input
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                placeholder="e.g., Company Visa"
              />
            </div>

            <div>
              <Label>Card Number *</Label>
              <Input
                value={formData.cardNumber}
                onChange={(e) => setFormData({ ...formData, cardNumber: formatCardNumber(e.target.value) })}
                placeholder="1234 5678 9012 3456"
                maxLength={19}
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Expiry Month *</Label>
                <Select
                  value={formData.expiryMonth}
                  onValueChange={(v) => setFormData({ ...formData, expiryMonth: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="MM" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={(i + 1).toString()}>
                        {(i + 1).toString().padStart(2, '0')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Expiry Year *</Label>
                <Select
                  value={formData.expiryYear}
                  onValueChange={(v) => setFormData({ ...formData, expiryYear: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="YYYY" />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 10 }, (_, i) => {
                      const year = new Date().getFullYear() + i
                      return (
                        <SelectItem key={year} value={year.toString()}>
                          {year}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>CVV *</Label>
                <Input
                  value={formData.cvv}
                  onChange={(e) => setFormData({ ...formData, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                  placeholder="123"
                  maxLength={4}
                  type="password"
                />
              </div>
            </div>

            <div>
              <Label>Cardholder Name *</Label>
              <Input
                value={formData.holderName}
                onChange={(e) => setFormData({ ...formData, holderName: e.target.value })}
                placeholder="Name as it appears on card"
              />
            </div>

            <div className="border-t pt-4">
              <Label className="text-sm font-medium">Billing Address</Label>
              <div className="mt-2 space-y-3">
                <Input
                  value={formData.billingAddress}
                  onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                  placeholder="Street address"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={formData.billingCity}
                    onChange={(e) => setFormData({ ...formData, billingCity: e.target.value })}
                    placeholder="City"
                  />
                  <Input
                    value={formData.billingProvince}
                    onChange={(e) => setFormData({ ...formData, billingProvince: e.target.value })}
                    placeholder="Province/State"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={formData.billingPostal}
                    onChange={(e) => setFormData({ ...formData, billingPostal: e.target.value })}
                    placeholder="Postal Code"
                  />
                  <Input
                    value={formData.billingCountry}
                    onChange={(e) => setFormData({ ...formData, billingCountry: e.target.value })}
                    placeholder="Country"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isDefault"
                checked={formData.isDefault}
                onCheckedChange={(checked) => setFormData({ ...formData, isDefault: !!checked })}
              />
              <Label htmlFor="isDefault" className="text-sm font-normal cursor-pointer">
                Set as default payment method
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add Payment Method
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Payment Method Dialog */}
      <Dialog open={showEditDialog} onOpenChange={(open) => { setShowEditDialog(open); if (!open) setSelectedMethod(null) }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Payment Method</DialogTitle>
            <DialogDescription>
              Update payment method details. Leave card number/CVV blank to keep existing values.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Nickname</Label>
              <Input
                value={formData.nickname}
                onChange={(e) => setFormData({ ...formData, nickname: e.target.value })}
                placeholder="e.g., Company Visa"
              />
            </div>

            {(formData.type === 'CREDIT_CARD' || formData.type === 'DEBIT_CARD') && (
              <>
                <div>
                  <Label>Card Number (leave blank to keep existing)</Label>
                  <Input
                    value={formData.cardNumber}
                    onChange={(e) => setFormData({ ...formData, cardNumber: formatCardNumber(e.target.value) })}
                    placeholder="1234 5678 9012 3456"
                    maxLength={19}
                  />
                  {selectedMethod?.lastFour && !formData.cardNumber && (
                    <p className="text-xs text-gray-500 mt-1">Current: ****{selectedMethod.lastFour}</p>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Expiry Month</Label>
                    <Select
                      value={formData.expiryMonth}
                      onValueChange={(v) => setFormData({ ...formData, expiryMonth: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="MM" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 12 }, (_, i) => (
                          <SelectItem key={i + 1} value={(i + 1).toString()}>
                            {(i + 1).toString().padStart(2, '0')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Expiry Year</Label>
                    <Select
                      value={formData.expiryYear}
                      onValueChange={(v) => setFormData({ ...formData, expiryYear: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="YYYY" />
                      </SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 10 }, (_, i) => {
                          const year = new Date().getFullYear() + i
                          return (
                            <SelectItem key={year} value={year.toString()}>
                              {year}
                            </SelectItem>
                          )
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>CVV (leave blank to keep)</Label>
                    <Input
                      value={formData.cvv}
                      onChange={(e) => setFormData({ ...formData, cvv: e.target.value.replace(/\D/g, '').slice(0, 4) })}
                      placeholder="***"
                      maxLength={4}
                      type="password"
                    />
                  </div>
                </div>

                <div>
                  <Label>Cardholder Name</Label>
                  <Input
                    value={formData.holderName}
                    onChange={(e) => setFormData({ ...formData, holderName: e.target.value })}
                    placeholder="Name as it appears on card"
                  />
                </div>
              </>
            )}

            <div className="border-t pt-4">
              <Label className="text-sm font-medium">Billing Address</Label>
              <div className="mt-2 space-y-3">
                <Input
                  value={formData.billingAddress}
                  onChange={(e) => setFormData({ ...formData, billingAddress: e.target.value })}
                  placeholder="Street address"
                />
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={formData.billingCity}
                    onChange={(e) => setFormData({ ...formData, billingCity: e.target.value })}
                    placeholder="City"
                  />
                  <Input
                    value={formData.billingProvince}
                    onChange={(e) => setFormData({ ...formData, billingProvince: e.target.value })}
                    placeholder="Province/State"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input
                    value={formData.billingPostal}
                    onChange={(e) => setFormData({ ...formData, billingPostal: e.target.value })}
                    placeholder="Postal Code"
                  />
                  <Input
                    value={formData.billingCountry}
                    onChange={(e) => setFormData({ ...formData, billingCountry: e.target.value })}
                    placeholder="Country"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="isDefaultEdit"
                checked={formData.isDefault}
                onCheckedChange={(checked) => setFormData({ ...formData, isDefault: !!checked })}
              />
              <Label htmlFor="isDefaultEdit" className="text-sm font-normal cursor-pointer">
                Set as default payment method
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
