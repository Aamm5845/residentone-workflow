'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog'
import { MapPin, Plus, Search, Building2, Loader2, Star, Trash2, Edit2 } from 'lucide-react'
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
}

interface AddressData {
  street: string
  city: string
  province: string
  postalCode: string
  country: string
}

interface AddressPickerProps {
  value: AddressData
  onChange: (address: AddressData) => void
  onAddressNameChange?: (name: string | null) => void // Called when saved address name changes
  showSavedAddresses?: boolean
  placeholder?: string
}

export default function AddressPicker({
  value,
  onChange,
  onAddressNameChange,
  showSavedAddresses = true,
  placeholder = "Select or enter address"
}: AddressPickerProps) {
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([])
  const [loadingAddresses, setLoadingAddresses] = useState(false)
  const [selectedAddressId, setSelectedAddressId] = useState<string>('')
  const [showManualEntry, setShowManualEntry] = useState(false)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [predictions, setPredictions] = useState<google.maps.places.AutocompletePrediction[]>([])
  const [autocompleteService, setAutocompleteService] = useState<google.maps.places.AutocompleteService | null>(null)
  const [placesService, setPlacesService] = useState<google.maps.places.PlacesService | null>(null)
  const [showPredictions, setShowPredictions] = useState(false)
  const searchInputRef = useRef<HTMLInputElement>(null)

  // New address form state
  const [newAddress, setNewAddress] = useState({
    name: '',
    street: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'Canada',
    isDefault: false
  })
  const [savingAddress, setSavingAddress] = useState(false)

  // Load saved addresses
  useEffect(() => {
    if (showSavedAddresses) {
      loadSavedAddresses()
    }
  }, [showSavedAddresses])

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
      // Load Google Maps script if not already loaded
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

  const loadSavedAddresses = async () => {
    setLoadingAddresses(true)
    try {
      const res = await fetch('/api/saved-addresses')
      const data = await res.json()
      if (data.addresses) {
        setSavedAddresses(data.addresses)
        // Auto-select default if no value set
        if (!value.street && !value.city) {
          const defaultAddr = data.addresses.find((a: SavedAddress) => a.isDefault)
          if (defaultAddr) {
            handleSelectSavedAddress(defaultAddr.id, data.addresses)
          }
        }
      }
    } catch (error) {
      console.error('Error loading saved addresses:', error)
    } finally {
      setLoadingAddresses(false)
    }
  }

  const handleSelectSavedAddress = (addressId: string, addresses = savedAddresses) => {
    setSelectedAddressId(addressId)
    const address = addresses.find(a => a.id === addressId)
    if (address) {
      onChange({
        street: address.street,
        city: address.city,
        province: address.province,
        postalCode: address.postalCode,
        country: address.country
      })
      // Notify parent of the address name (e.g., "Warehouse", "Office")
      onAddressNameChange?.(address.name)
      setShowManualEntry(false)
    }
  }

  const handleSearchChange = async (query: string) => {
    setSearchQuery(query)
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
          const addressData: AddressData = {
            street: '',
            city: '',
            province: '',
            postalCode: '',
            country: 'Canada'
          }

          place.address_components?.forEach(component => {
            const types = component.types
            if (types.includes('street_number')) {
              addressData.street = component.long_name
            }
            if (types.includes('route')) {
              addressData.street += (addressData.street ? ' ' : '') + component.long_name
            }
            if (types.includes('locality') || types.includes('sublocality')) {
              addressData.city = component.long_name
            }
            if (types.includes('administrative_area_level_1')) {
              addressData.province = component.short_name
            }
            if (types.includes('postal_code')) {
              addressData.postalCode = component.long_name
            }
            if (types.includes('country')) {
              addressData.country = component.long_name
            }
          })

          onChange(addressData)
          // Clear address name since this is a manual/Google Places entry
          onAddressNameChange?.(null)
          setNewAddress(prev => ({ ...prev, ...addressData }))
          setSearchQuery(place.formatted_address || '')
          setShowPredictions(false)
          setSelectedAddressId('')
        }
      }
    )
  }

  const handleSaveNewAddress = async () => {
    if (!newAddress.name || !newAddress.street || !newAddress.city || !newAddress.province || !newAddress.postalCode) {
      toast.error('Please fill in all required fields')
      return
    }

    setSavingAddress(true)
    try {
      const res = await fetch('/api/saved-addresses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAddress)
      })

      if (res.ok) {
        const data = await res.json()
        setSavedAddresses(prev => [...prev, data.address])
        handleSelectSavedAddress(data.address.id, [...savedAddresses, data.address])
        setShowAddDialog(false)
        setNewAddress({
          name: '',
          street: '',
          city: '',
          province: '',
          postalCode: '',
          country: 'Canada',
          isDefault: false
        })
        toast.success('Address saved to phonebook')
      } else {
        toast.error('Failed to save address')
      }
    } catch (error) {
      toast.error('Failed to save address')
    } finally {
      setSavingAddress(false)
    }
  }

  const handleDeleteAddress = async (id: string) => {
    try {
      const res = await fetch(`/api/saved-addresses?id=${id}`, { method: 'DELETE' })
      if (res.ok) {
        setSavedAddresses(prev => prev.filter(a => a.id !== id))
        if (selectedAddressId === id) {
          setSelectedAddressId('')
          onChange({ street: '', city: '', province: '', postalCode: '', country: 'Canada' })
        }
        toast.success('Address deleted')
      }
    } catch (error) {
      toast.error('Failed to delete address')
    }
  }

  const formattedValue = value.street
    ? `${value.street}, ${value.city}, ${value.province} ${value.postalCode}`
    : ''

  return (
    <div className="space-y-3">
      {/* Saved Addresses Selector */}
      {showSavedAddresses && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Select
              value={selectedAddressId}
              onValueChange={handleSelectSavedAddress}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder={loadingAddresses ? "Loading..." : "Select saved address"}>
                  {selectedAddressId && savedAddresses.find(a => a.id === selectedAddressId)?.name}
                </SelectValue>
              </SelectTrigger>
              <SelectContent position="popper" sideOffset={4} className="max-h-[300px] overflow-y-auto z-[9999]">
                {savedAddresses.map(addr => (
                  <SelectItem key={addr.id} value={addr.id}>
                    <div className="flex items-center gap-2">
                      {addr.isDefault && <Star className="w-3 h-3 text-amber-500 fill-amber-500" />}
                      <span className="font-medium">{addr.name}</span>
                      <span className="text-gray-400 text-xs">
                        - {addr.city}, {addr.province}
                      </span>
                    </div>
                  </SelectItem>
                ))}
                {savedAddresses.length === 0 && (
                  <div className="px-2 py-3 text-sm text-gray-500 text-center">
                    No saved addresses yet
                  </div>
                )}
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setShowAddDialog(true)}
              title="Add new address"
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>

          {selectedAddressId && (
            <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-md flex items-start gap-2">
              <MapPin className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
              <span>{formattedValue}</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs text-gray-400">or enter manually</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
        </div>
      )}

      {/* Manual Entry with Google Places Autocomplete */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            ref={searchInputRef}
            value={searchQuery || formattedValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => setShowPredictions(predictions.length > 0)}
            placeholder="Start typing an address..."
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

      {/* Manual Fields (collapsed) */}
      {(value.street || showManualEntry) && (
        <div className="grid grid-cols-2 gap-2 pt-2">
          <div className="col-span-2">
            <Input
              value={value.street}
              onChange={(e) => onChange({ ...value, street: e.target.value })}
              placeholder="Street address"
              className="text-sm"
            />
          </div>
          <Input
            value={value.city}
            onChange={(e) => onChange({ ...value, city: e.target.value })}
            placeholder="City"
            className="text-sm"
          />
          <div className="flex gap-2">
            <Input
              value={value.province}
              onChange={(e) => onChange({ ...value, province: e.target.value })}
              placeholder="Province"
              className="text-sm w-20"
            />
            <Input
              value={value.postalCode}
              onChange={(e) => onChange({ ...value, postalCode: e.target.value })}
              placeholder="Postal"
              className="text-sm flex-1"
            />
          </div>
        </div>
      )}

      {/* Add New Address Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5" />
              Save New Address
            </DialogTitle>
            <DialogDescription>
              Add this address to your phonebook for quick selection
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label>Address Name *</Label>
              <Input
                value={newAddress.name}
                onChange={(e) => setNewAddress(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g., Office, Warehouse, Showroom"
                className="mt-1"
              />
            </div>

            {/* Google Places Search for new address */}
            <div>
              <Label>Search Address</Label>
              <div className="relative mt-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Start typing to search..."
                  className="pl-10"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Street *</Label>
                <Input
                  value={newAddress.street}
                  onChange={(e) => setNewAddress(prev => ({ ...prev, street: e.target.value }))}
                  placeholder="123 Main Street"
                  className="mt-1"
                />
              </div>
              <div>
                <Label>City *</Label>
                <Input
                  value={newAddress.city}
                  onChange={(e) => setNewAddress(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="Montreal"
                  className="mt-1"
                />
              </div>
              <div className="flex gap-2">
                <div className="w-20">
                  <Label>Province *</Label>
                  <Input
                    value={newAddress.province}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, province: e.target.value }))}
                    placeholder="QC"
                    className="mt-1"
                  />
                </div>
                <div className="flex-1">
                  <Label>Postal *</Label>
                  <Input
                    value={newAddress.postalCode}
                    onChange={(e) => setNewAddress(prev => ({ ...prev, postalCode: e.target.value }))}
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
                checked={newAddress.isDefault}
                onChange={(e) => setNewAddress(prev => ({ ...prev, isDefault: e.target.checked }))}
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
            <Button onClick={handleSaveNewAddress} disabled={savingAddress}>
              {savingAddress && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Save Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
