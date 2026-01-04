'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Building2, CreditCard, FileText, Loader2, Save, Upload } from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'

interface OrganizationSettings {
  id: string
  name: string
  slug: string
  logoUrl: string | null
  businessName: string | null
  businessAddress: string | null
  businessCity: string | null
  businessProvince: string | null
  businessPostal: string | null
  businessCountry: string | null
  businessPhone: string | null
  businessEmail: string | null
  gstNumber: string | null
  qstNumber: string | null
  defaultGstRate: number | null
  defaultQstRate: number | null
  wireInstructions: string | null
  checkInstructions: string | null
  etransferEmail: string | null
}

export default function BusinessSettingsPage() {
  const [settings, setSettings] = useState<OrganizationSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form state
  const [formData, setFormData] = useState({
    logoUrl: '',
    businessName: '',
    businessAddress: '',
    businessCity: '',
    businessProvince: '',
    businessPostal: '',
    businessCountry: 'Canada',
    businessPhone: '',
    businessEmail: '',
    gstNumber: '',
    qstNumber: '',
    defaultGstRate: '5',
    defaultQstRate: '9.975',
    wireInstructions: '',
    checkInstructions: '',
    etransferEmail: '',
  })

  useEffect(() => {
    fetchSettings()
  }, [])

  const fetchSettings = async () => {
    try {
      const response = await fetch('/api/settings/organization')
      if (!response.ok) throw new Error('Failed to fetch settings')
      const data = await response.json()
      setSettings(data.organization)

      // Populate form with existing data
      if (data.organization) {
        setFormData({
          logoUrl: data.organization.logoUrl || '',
          businessName: data.organization.businessName || '',
          businessAddress: data.organization.businessAddress || '',
          businessCity: data.organization.businessCity || '',
          businessProvince: data.organization.businessProvince || '',
          businessPostal: data.organization.businessPostal || '',
          businessCountry: data.organization.businessCountry || 'Canada',
          businessPhone: data.organization.businessPhone || '',
          businessEmail: data.organization.businessEmail || '',
          gstNumber: data.organization.gstNumber || '',
          qstNumber: data.organization.qstNumber || '',
          defaultGstRate: data.organization.defaultGstRate?.toString() || '5',
          defaultQstRate: data.organization.defaultQstRate?.toString() || '9.975',
          wireInstructions: data.organization.wireInstructions || '',
          checkInstructions: data.organization.checkInstructions || '',
          etransferEmail: data.organization.etransferEmail || '',
        })
      }
    } catch (error) {
      console.error('Error fetching settings:', error)
      toast.error('Failed to load settings')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      const response = await fetch('/api/settings/organization', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save settings')
      }

      const data = await response.json()
      setSettings(data.organization)
      toast.success('Business settings saved successfully')
    } catch (error) {
      console.error('Error saving settings:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to save settings')
    } finally {
      setSaving(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/settings">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Settings
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Business Profile</h1>
              <p className="text-sm text-gray-500">Configure your invoice and quote settings</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Company Information */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle>Company Information</CardTitle>
                  <CardDescription>
                    This information will appear on invoices and quotes
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <Label htmlFor="logoUrl">Logo URL</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      id="logoUrl"
                      value={formData.logoUrl}
                      onChange={(e) => handleInputChange('logoUrl', e.target.value)}
                      placeholder="https://example.com/logo.png"
                    />
                    {formData.logoUrl && (
                      <div className="w-10 h-10 border rounded flex items-center justify-center bg-white">
                        <img
                          src={formData.logoUrl}
                          alt="Logo preview"
                          className="max-w-full max-h-full object-contain"
                          onError={(e) => (e.currentTarget.style.display = 'none')}
                        />
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Enter a URL to your company logo</p>
                </div>

                <div className="col-span-2">
                  <Label htmlFor="businessName">Legal Business Name</Label>
                  <Input
                    id="businessName"
                    value={formData.businessName}
                    onChange={(e) => handleInputChange('businessName', e.target.value)}
                    placeholder="Your Company Inc."
                    className="mt-1"
                  />
                </div>

                <div className="col-span-2">
                  <Label htmlFor="businessAddress">Street Address</Label>
                  <Input
                    id="businessAddress"
                    value={formData.businessAddress}
                    onChange={(e) => handleInputChange('businessAddress', e.target.value)}
                    placeholder="123 Main Street, Suite 100"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="businessCity">City</Label>
                  <Input
                    id="businessCity"
                    value={formData.businessCity}
                    onChange={(e) => handleInputChange('businessCity', e.target.value)}
                    placeholder="Montreal"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="businessProvince">Province</Label>
                  <Input
                    id="businessProvince"
                    value={formData.businessProvince}
                    onChange={(e) => handleInputChange('businessProvince', e.target.value)}
                    placeholder="Quebec"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="businessPostal">Postal Code</Label>
                  <Input
                    id="businessPostal"
                    value={formData.businessPostal}
                    onChange={(e) => handleInputChange('businessPostal', e.target.value)}
                    placeholder="H2X 1Y4"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="businessCountry">Country</Label>
                  <Input
                    id="businessCountry"
                    value={formData.businessCountry}
                    onChange={(e) => handleInputChange('businessCountry', e.target.value)}
                    placeholder="Canada"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="businessPhone">Phone</Label>
                  <Input
                    id="businessPhone"
                    value={formData.businessPhone}
                    onChange={(e) => handleInputChange('businessPhone', e.target.value)}
                    placeholder="(514) 555-0123"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="businessEmail">Billing Email</Label>
                  <Input
                    id="businessEmail"
                    type="email"
                    value={formData.businessEmail}
                    onChange={(e) => handleInputChange('businessEmail', e.target.value)}
                    placeholder="billing@company.com"
                    className="mt-1"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tax Registration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                  <FileText className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <CardTitle>Tax Registration</CardTitle>
                  <CardDescription>
                    GST and QST numbers for Quebec invoicing
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="gstNumber">GST Number</Label>
                  <Input
                    id="gstNumber"
                    value={formData.gstNumber}
                    onChange={(e) => handleInputChange('gstNumber', e.target.value)}
                    placeholder="123456789RT0001"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Federal GST/HST number</p>
                </div>

                <div>
                  <Label htmlFor="qstNumber">QST Number</Label>
                  <Input
                    id="qstNumber"
                    value={formData.qstNumber}
                    onChange={(e) => handleInputChange('qstNumber', e.target.value)}
                    placeholder="1234567890TQ0001"
                    className="mt-1"
                  />
                  <p className="text-xs text-gray-500 mt-1">Quebec QST number</p>
                </div>

                <div>
                  <Label htmlFor="defaultGstRate">Default GST Rate (%)</Label>
                  <Input
                    id="defaultGstRate"
                    type="number"
                    step="0.001"
                    value={formData.defaultGstRate}
                    onChange={(e) => handleInputChange('defaultGstRate', e.target.value)}
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label htmlFor="defaultQstRate">Default QST Rate (%)</Label>
                  <Input
                    id="defaultQstRate"
                    type="number"
                    step="0.001"
                    value={formData.defaultQstRate}
                    onChange={(e) => handleInputChange('defaultQstRate', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                  <strong>Current rates:</strong> GST {formData.defaultGstRate}% + QST {formData.defaultQstRate}% = {(parseFloat(formData.defaultGstRate || '0') + parseFloat(formData.defaultQstRate || '0')).toFixed(3)}% total tax
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Payment Instructions */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle>Payment Instructions</CardTitle>
                  <CardDescription>
                    Instructions shown to clients for non-card payments
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Interac e-Transfer */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <Label htmlFor="etransferEmail" className="text-green-800 font-medium">
                  Interac e-Transfer Email
                </Label>
                <Input
                  id="etransferEmail"
                  type="email"
                  value={formData.etransferEmail}
                  onChange={(e) => handleInputChange('etransferEmail', e.target.value)}
                  placeholder="payments@yourcompany.com"
                  className="mt-2 bg-white"
                />
                <p className="text-xs text-green-700 mt-2">
                  This email will be shown on all invoices for clients to send Interac e-Transfers.
                  E-Transfer has no processing fee (unlike credit cards with 3% fee).
                </p>
              </div>

              <div>
                <Label htmlFor="wireInstructions">Wire Transfer Instructions</Label>
                <Textarea
                  id="wireInstructions"
                  value={formData.wireInstructions}
                  onChange={(e) => handleInputChange('wireInstructions', e.target.value)}
                  placeholder="Bank: Royal Bank of Canada&#10;Account Name: Your Company Inc.&#10;Account #: 12345678&#10;Transit #: 00001&#10;Institution #: 003"
                  className="mt-1 min-h-[120px] font-mono text-sm"
                />
              </div>

              <div>
                <Label htmlFor="checkInstructions">Check Payment Instructions</Label>
                <Textarea
                  id="checkInstructions"
                  value={formData.checkInstructions}
                  onChange={(e) => handleInputChange('checkInstructions', e.target.value)}
                  placeholder="Make checks payable to: Your Company Inc.&#10;Mail to:&#10;123 Main Street, Suite 100&#10;Montreal, QC H2X 1Y4"
                  className="mt-1 min-h-[100px] font-mono text-sm"
                />
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="min-w-[140px]">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
