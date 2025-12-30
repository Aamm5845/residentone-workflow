'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  MapPin,
  Loader2,
  X,
  Star,
  Building2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import toast from 'react-hot-toast'

interface SavedAddress {
  id: string
  name: string
  street: string
  city: string
  province: string
  postalCode: string
  country: string
  isDefault: boolean
  createdAt: string
  updatedAt: string
}

interface ShippingPhonebookProps {
  orgId: string
  user: {
    id: string
    name: string
    role: string
  }
}

export default function ShippingPhonebook({ orgId, user }: ShippingPhonebookProps) {
  const [addresses, setAddresses] = useState<SavedAddress[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Google Places state
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null)
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null)
  const [showPredictions, setShowPredictions] = useState(false)
  const [addressSearch, setAddressSearch] = useState('')

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    street: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'Canada',
    isDefault: false
  })

  // Initialize Google Places API
  useEffect(() => {
    const initGooglePlaces = () => {
      if (typeof google !== 'undefined' && google.maps && google.maps.places) {
        setAutocompleteService(new google.maps.places.AutocompleteService())
        const dummyMap = new google.maps.Map(document.createElement('div'))
        setPlacesService(new google.maps.places.PlacesService(dummyMap))
      }
    }

    if (typeof google !== 'undefined' && google.maps) {
      initGooglePlaces()
    } else {
      const existingScript = document.getElementById('google-maps-script')
      if (!existingScript) {
        const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY
        if (apiKey) {
          const script = document.createElement('script')
          script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&language=en`
          script.async = true
          script.id = 'google-maps-script'
          script.onload = initGooglePlaces
          document.head.appendChild(script)
        }
      } else {
        existingScript.addEventListener('load', initGooglePlaces)
      }
    }
  }, [])

  useEffect(() => {
    loadAddresses()
  }, [])

  const loadAddresses = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/saved-addresses')
      if (res.ok) {
        const data = await res.json()
        setAddresses(data.addresses || [])
      }
    } catch (error) {
      console.error('Error loading addresses:', error)
      toast.error('Failed to load addresses')
    } finally {
      setLoading(false)
    }
  }

  const handleSearchChange = async (query: string) => {
    setAddressSearch(query)
    if (!autocompleteService || query.length < 3) {
      setPredictions([])
      return
    }

    autocompleteService.getPlacePredictions(
      {
        input: query,
        componentRestrictions: { country: ['ca', 'us'] },
        types: ['address']
      },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          setPredictions(results)
          setShowPredictions(true)
        } else {
          setPredictions([])
        }
      }
    )
  }

  const handleSelectPrediction = (prediction: google.maps.places.AutocompletePrediction) => {
    if (!placesService) return

    placesService.getDetails(
      {
        placeId: prediction.place_id,
        fields: ['address_components', 'formatted_address']
      },
      (place, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && place) {
          let street = ''
          let city = ''
          let province = ''
          let postalCode = ''
          let country = 'Canada'

          place.address_components?.forEach(component => {
            const types = component.types
            if (types.includes('street_number')) {
              street = component.long_name
            }
            if (types.includes('route')) {
              street += (street ? ' ' : '') + component.long_name
            }
            if (types.includes('locality') || types.includes('sublocality')) {
              city = component.long_name
            }
            if (types.includes('administrative_area_level_1')) {
              province = component.short_name
            }
            if (types.includes('postal_code')) {
              postalCode = component.long_name
            }
            if (types.includes('country')) {
              country = component.long_name
            }
          })

          setFormData(prev => ({
            ...prev,
            street,
            city,
            province,
            postalCode,
            country
          }))
          setAddressSearch(place.formatted_address || '')
          setShowPredictions(false)
        }
      }
    )
  }

  const openAddDialog = () => {
    setFormData({
      name: '',
      street: '',
      city: '',
      province: '',
      postalCode: '',
      country: 'Canada',
      isDefault: false
    })
    setAddressSearch('')
    setEditingAddress(null)
    setShowAddDialog(true)
  }

  const openEditDialog = (address: SavedAddress) => {
    setFormData({
      name: address.name,
      street: address.street,
      city: address.city,
      province: address.province,
      postalCode: address.postalCode,
      country: address.country,
      isDefault: address.isDefault
    })
    setAddressSearch(`${address.street}, ${address.city}, ${address.province} ${address.postalCode}`)
    setEditingAddress(address)
    setShowAddDialog(true)
  }

  const handleSave = async () => {
    if (!formData.name || !formData.street || !formData.city || !formData.province || !formData.postalCode) {
      toast.error('Please fill in all required fields')
      return
    }

    setSaving(true)
    try {
      const url = '/api/saved-addresses'
      const method = editingAddress ? 'PUT' : 'POST'
      const body = editingAddress
        ? { id: editingAddress.id, ...formData }
        : formData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        toast.success(editingAddress ? 'Address updated' : 'Address added')
        setShowAddDialog(false)
        loadAddresses()
      } else {
        const data = await res.json()
        toast.error(data.error || 'Failed to save address')
      }
    } catch (error) {
      toast.error('Failed to save address')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this address?')) return

    setDeletingId(id)
    try {
      const res = await fetch(`/api/saved-addresses?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Address deleted')
        setAddresses(prev => prev.filter(a => a.id !== id))
      } else {
        toast.error('Failed to delete address')
      }
    } catch (error) {
      toast.error('Failed to delete address')
    } finally {
      setDeletingId(null)
    }
  }

  const handleSetDefault = async (address: SavedAddress) => {
    try {
      const res = await fetch('/api/saved-addresses', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: address.id, isDefault: true })
      })

      if (res.ok) {
        toast.success('Default address updated')
        loadAddresses()
      } else {
        toast.error('Failed to set default')
      }
    } catch (error) {
      toast.error('Failed to set default')
    }
  }

  const filteredAddresses = addresses.filter(addr =>
    addr.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    addr.street.toLowerCase().includes(searchQuery.toLowerCase()) ||
    addr.city.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center">
              <MapPin className="w-5 h-5 mr-2" />
              Shipping Address Book
            </CardTitle>
            <CardDescription>
              Save frequently used shipping addresses for quick selection when sending quotes
            </CardDescription>
          </div>
          <Button onClick={openAddDialog}>
            <Plus className="w-4 h-4 mr-2" />
            Add Address
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search addresses..."
            className="pl-10"
          />
        </div>

        {/* Addresses List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          </div>
        ) : filteredAddresses.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">
              {searchQuery ? 'No addresses match your search' : 'No saved addresses yet'}
            </p>
            <p className="text-sm text-gray-400 mt-1">
              Add addresses to quickly select them when sending quotes
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredAddresses.map(address => (
              <div
                key={address.id}
                className="flex items-start justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">{address.name}</h3>
                      {address.isDefault && (
                        <Badge variant="secondary" className="text-xs bg-amber-100 text-amber-700">
                          <Star className="w-3 h-3 mr-1 fill-amber-500" />
                          Default
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {address.street}
                    </p>
                    <p className="text-sm text-gray-500">
                      {address.city}, {address.province} {address.postalCode}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!address.isDefault && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleSetDefault(address)}
                      className="text-gray-500 hover:text-amber-600"
                      title="Set as default"
                    >
                      <Star className="w-4 h-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openEditDialog(address)}
                    className="text-gray-500 hover:text-blue-600"
                  >
                    <Pencil className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(address.id)}
                    disabled={deletingId === address.id}
                    className="text-gray-500 hover:text-red-600"
                  >
                    {deletingId === address.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      {/* Add/Edit Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              {editingAddress ? 'Edit Address' : 'Add New Address'}
            </DialogTitle>
            <DialogDescription>
              {editingAddress ? 'Update the address details' : 'Add a new shipping address to your phonebook'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Address Name *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Office, Warehouse, Client Site"
                className="mt-1"
              />
            </div>

            {/* Google Places Search */}
            <div className="relative">
              <Label>Search Address</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={addressSearch}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  onFocus={() => setShowPredictions(predictions.length > 0)}
                  placeholder="Start typing to search..."
                  className="pl-10"
                />
              </div>

              {/* Predictions Dropdown */}
              {showPredictions && predictions.length > 0 && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
                  {predictions.map(prediction => (
                    <button
                      key={prediction.place_id}
                      type="button"
                      onClick={() => handleSelectPrediction(prediction)}
                      className="w-full px-4 py-3 text-left hover:bg-gray-50 flex items-start gap-3 border-b last:border-0"
                    >
                      <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {prediction.structured_formatting.main_text}
                        </p>
                        <p className="text-xs text-gray-500 truncate">
                          {prediction.structured_formatting.secondary_text}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Street *</Label>
                <Input
                  value={formData.street}
                  onChange={(e) => setFormData(prev => ({ ...prev, street: e.target.value }))}
                  placeholder="123 Main Street"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>City *</Label>
                <Input
                  value={formData.city}
                  onChange={(e) => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Montreal"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <div className="w-20">
                  <Label>Province *</Label>
                  <Input
                    value={formData.province}
                    onChange={(e) => setFormData(prev => ({ ...prev, province: e.target.value }))}
                    placeholder="QC"
                    className="mt-1"
                  />
                </div>
                <div className="flex-1">
                  <Label>Postal *</Label>
                  <Input
                    value={formData.postalCode}
                    onChange={(e) => setFormData(prev => ({ ...prev, postalCode: e.target.value }))}
                    placeholder="H2V4H9"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isDefault"
                checked={formData.isDefault}
                onChange={(e) => setFormData(prev => ({ ...prev, isDefault: e.target.checked }))}
                className="rounded border-gray-300"
              />
              <Label htmlFor="isDefault" className="text-sm font-normal cursor-pointer">
                Set as default shipping address
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {editingAddress ? 'Save Changes' : 'Add Address'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
