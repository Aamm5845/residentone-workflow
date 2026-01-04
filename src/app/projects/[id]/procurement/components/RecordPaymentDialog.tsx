'use client'

import { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Loader2, DollarSign, CreditCard, Building, Banknote, Wallet, Upload, FileText, X, Check } from 'lucide-react'
import { toast } from 'sonner'

interface RecordPaymentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  invoice: {
    id: string
    invoiceNumber: string
    title: string
    totalAmount: number
    paidAmount: number
    balance: number
  }
  onSuccess: () => void
}

const paymentMethods = [
  { value: 'E_TRANSFER', label: 'Interac e-Transfer', icon: Wallet },
  { value: 'WIRE_TRANSFER', label: 'Wire Transfer', icon: Building },
  { value: 'CHECK', label: 'Check', icon: Banknote },
  { value: 'CREDIT_CARD', label: 'Credit Card', icon: CreditCard },
  { value: 'ACH_BANK_TRANSFER', label: 'ACH/Bank Transfer', icon: Building },
  { value: 'CASH', label: 'Cash', icon: Wallet },
  { value: 'OTHER', label: 'Other', icon: DollarSign }
]

export default function RecordPaymentDialog({
  open,
  onOpenChange,
  projectId,
  invoice,
  onSuccess
}: RecordPaymentDialogProps) {
  const [amount, setAmount] = useState(invoice.balance.toString())
  const [method, setMethod] = useState('WIRE_TRANSFER')
  const [reference, setReference] = useState('')
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split('T')[0])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Proof of payment upload
  const [proofFile, setProofFile] = useState<File | null>(null)
  const [uploadingProof, setUploadingProof] = useState(false)
  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB')
        return
      }
      setProofFile(file)
      setProofUrl(null)
    }
  }

  const removeProofFile = () => {
    setProofFile(null)
    setProofUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const uploadProofToDropbox = async (): Promise<string | null> => {
    if (!proofFile) return null

    setUploadingProof(true)
    try {
      // Create form data for upload
      const formData = new FormData()
      formData.append('file', proofFile)
      formData.append('folder', `/Shopping/Payments/${invoice.invoiceNumber}`)
      formData.append('description', `Payment proof for ${invoice.invoiceNumber}`)

      const res = await fetch(`/api/projects/${projectId}/dropbox/upload`, {
        method: 'POST',
        body: formData
      })

      if (!res.ok) {
        throw new Error('Failed to upload proof to Dropbox')
      }

      const data = await res.json()
      setProofUrl(data.url)
      return data.url
    } catch (error) {
      console.error('Error uploading proof:', error)
      toast.error('Failed to upload proof document')
      return null
    } finally {
      setUploadingProof(false)
    }
  }

  const handleRecord = async () => {
    const paymentAmount = parseFloat(amount)
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      toast.error('Please enter a valid amount')
      return
    }

    if (paymentAmount > invoice.balance) {
      toast.error(`Amount cannot exceed balance of ${formatCurrency(invoice.balance)}`)
      return
    }

    if (!method) {
      toast.error('Please select a payment method')
      return
    }

    setSaving(true)
    try {
      // Upload proof document to Dropbox if provided
      let uploadedProofUrl = proofUrl
      if (proofFile && !proofUrl) {
        uploadedProofUrl = await uploadProofToDropbox()
      }

      const res = await fetch(`/api/projects/${projectId}/procurement/client-invoices/${invoice.id}/payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: paymentAmount,
          method,
          reference,
          paidAt,
          notes,
          proofDocumentUrl: uploadedProofUrl,
          proofFileName: proofFile?.name
        })
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to record payment')
      }

      const data = await res.json()
      const statusMsg = data.invoiceStatus === 'PAID'
        ? 'Invoice fully paid!'
        : `Payment recorded. Remaining balance: ${formatCurrency(data.newBalance)}`
      toast.success(statusMsg)
      onSuccess()
    } catch (error: any) {
      toast.error(error.message || 'Failed to record payment')
    } finally {
      setSaving(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-CA', {
      style: 'currency',
      currency: 'CAD'
    }).format(value)
  }

  const handleAmountChange = (value: string) => {
    // Allow only valid decimal numbers
    if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
      setAmount(value)
    }
  }

  const setFullBalance = () => {
    setAmount(invoice.balance.toFixed(2))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5" />
            Record Payment
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Invoice Summary */}
          <div className="p-3 bg-gray-50 rounded-lg space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-600">Invoice</span>
              <span className="font-medium">{invoice.invoiceNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Total</span>
              <span>{formatCurrency(invoice.totalAmount)}</span>
            </div>
            {invoice.paidAmount > 0 && (
              <div className="flex justify-between text-emerald-600">
                <span>Paid</span>
                <span>-{formatCurrency(invoice.paidAmount)}</span>
              </div>
            )}
            <div className="flex justify-between font-medium pt-2 border-t">
              <span>Balance Due</span>
              <span className="text-amber-600">{formatCurrency(invoice.balance)}</span>
            </div>
          </div>

          {/* Payment Amount */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label htmlFor="amount">Payment Amount *</Label>
              <button
                type="button"
                onClick={setFullBalance}
                className="text-xs text-blue-600 hover:text-blue-700"
              >
                Full balance
              </button>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
              <Input
                id="amount"
                value={amount}
                onChange={(e) => handleAmountChange(e.target.value)}
                className="pl-7"
                placeholder="0.00"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <Label htmlFor="method">Payment Method *</Label>
            <Select value={method} onValueChange={setMethod}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {paymentMethods.map(pm => {
                  const Icon = pm.icon
                  return (
                    <SelectItem key={pm.value} value={pm.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {pm.label}
                      </div>
                    </SelectItem>
                  )
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Reference Number */}
          {(method === 'CHECK' || method === 'WIRE_TRANSFER' || method === 'E_TRANSFER') && (
            <div>
              <Label htmlFor="reference">
                {method === 'CHECK' ? 'Check Number' : method === 'E_TRANSFER' ? 'Confirmation Number' : 'Wire Reference'}
              </Label>
              <Input
                id="reference"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={method === 'CHECK' ? 'e.g., 1234' : method === 'E_TRANSFER' ? 'e.g., CA12345678' : 'e.g., TRF-123456'}
              />
            </div>
          )}

          {/* Payment Date */}
          <div>
            <Label htmlFor="paidAt">Payment Date</Label>
            <Input
              id="paidAt"
              type="date"
              value={paidAt}
              onChange={(e) => setPaidAt(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any additional notes..."
              rows={2}
            />
          </div>

          {/* Proof of Payment Upload */}
          <div>
            <Label>Proof of Payment (optional)</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              onChange={handleFileSelect}
              className="hidden"
            />
            {!proofFile ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="w-full mt-1 p-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 text-gray-500 hover:text-blue-600"
              >
                <Upload className="w-4 h-4" />
                <span className="text-sm">Upload proof document</span>
              </button>
            ) : (
              <div className="mt-1 p-3 bg-gray-50 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <span className="text-sm text-gray-700 truncate">{proofFile.name}</span>
                  {proofUrl && (
                    <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                  )}
                </div>
                <button
                  type="button"
                  onClick={removeProofFile}
                  className="p-1 hover:bg-gray-200 rounded"
                >
                  <X className="w-4 h-4 text-gray-500" />
                </button>
              </div>
            )}
            <p className="text-xs text-gray-500 mt-1">
              PDF, images, or documents up to 10MB
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleRecord} disabled={saving}>
            {saving ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <DollarSign className="w-4 h-4 mr-2" />
            )}
            Record Payment
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
