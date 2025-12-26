/**
 * AfterShip Integration Service
 * Provides real-time tracking updates for deliveries
 * API Documentation: https://www.aftership.com/docs/tracking/api
 */

interface AfterShipConfig {
  apiKey: string
  baseUrl: string
}

interface TrackingCheckpoint {
  slug: string
  city: string
  createdAt: string
  location: string
  countryName: string
  message: string
  countryIso3: string
  tag: string
  subtag: string
  subtag_message: string
  checkpoint_time: string
  coordinates: [number, number] | null
  state: string
  zip: string
  raw_tag: string
}

interface TrackingResult {
  id: string
  createdAt: string
  updatedAt: string
  lastUpdatedAt: string
  trackingNumber: string
  slug: string // carrier slug
  active: boolean
  customFields: Record<string, string> | null
  customerName: string | null
  deliveryTime: number | null // delivery time in days
  destinationCountryIso3: string | null
  destinationRawLocation: string | null
  emails: string[]
  expectedDelivery: string | null
  note: string | null
  orderId: string | null
  orderIdPath: string | null
  originCountryIso3: string | null
  shipmentPackageCount: number
  shipmentPickupDate: string | null
  shipmentDeliveryDate: string | null
  shipmentType: string | null
  shipmentWeight: number | null
  shipmentWeightUnit: string | null
  signedBy: string | null
  source: string
  tag: string // Status tag
  subtag: string
  subtagMessage: string
  title: string
  trackedCount: number
  lastMileTrackingSupported: boolean | null
  language: string | null
  uniqueToken: string
  checkpoints: TrackingCheckpoint[]
  subscribed_smses: string[]
  subscribed_emails: string[]
  returnToSender: boolean
  orderPromisedDeliveryDate: string | null
  deliveryType: string | null
  pickupLocation: string | null
  pickupNote: string | null
  courierTrackingLink: string | null
  courierRedirectLink: string | null
  firstAttemptedAt: string | null
}

interface AfterShipTrackingResponse {
  meta: {
    code: number
  }
  data: {
    tracking: TrackingResult
  }
}

interface AfterShipTrackingsResponse {
  meta: {
    code: number
  }
  data: {
    page: number
    limit: number
    count: number
    keyword: string
    slug: string
    origin: string[]
    destination: string[]
    tag: string
    fields: string
    created_at_min: string
    created_at_max: string
    last_updated_at: string | null
    return_to_sender: string[]
    courier_destination_country_iso3: string[]
    trackings: TrackingResult[]
  }
}

// Map AfterShip status tags to our delivery status
const STATUS_MAP: Record<string, string> = {
  'Pending': 'PENDING',
  'InfoReceived': 'INFO_RECEIVED',
  'InTransit': 'IN_TRANSIT',
  'OutForDelivery': 'OUT_FOR_DELIVERY',
  'AttemptFail': 'DELIVERY_FAILED',
  'Delivered': 'DELIVERED',
  'AvailableForPickup': 'READY_FOR_PICKUP',
  'Exception': 'EXCEPTION',
  'Expired': 'EXPIRED'
}

class AfterShipService {
  private config: AfterShipConfig | null = null

  constructor() {
    if (process.env.AFTERSHIP_API_KEY) {
      this.config = {
        apiKey: process.env.AFTERSHIP_API_KEY,
        baseUrl: 'https://api.aftership.com/v4'
      }
    }
  }

  isConfigured(): boolean {
    return !!this.config
  }

  private async request<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    body?: any
  ): Promise<T> {
    if (!this.config) {
      throw new Error('AfterShip is not configured. Set AFTERSHIP_API_KEY environment variable.')
    }

    const response = await fetch(`${this.config.baseUrl}${endpoint}`, {
      method,
      headers: {
        'aftership-api-key': this.config.apiKey,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    })

    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.meta?.message || 'AfterShip API error')
    }

    return data
  }

  /**
   * Create a new tracking
   */
  async createTracking(params: {
    trackingNumber: string
    carrier?: string // AfterShip carrier slug
    title?: string
    customerName?: string
    orderId?: string
    orderIdPath?: string
    customFields?: Record<string, string>
    emails?: string[]
    smses?: string[]
  }): Promise<TrackingResult> {
    const response = await this.request<AfterShipTrackingResponse>('POST', '/trackings', {
      tracking: {
        tracking_number: params.trackingNumber,
        slug: params.carrier,
        title: params.title,
        customer_name: params.customerName,
        order_id: params.orderId,
        order_id_path: params.orderIdPath,
        custom_fields: params.customFields,
        emails: params.emails,
        smses: params.smses
      }
    })

    return response.data.tracking
  }

  /**
   * Get tracking by tracking number and carrier
   */
  async getTracking(
    trackingNumber: string,
    carrier?: string
  ): Promise<TrackingResult | null> {
    try {
      const slug = carrier || 'auto-detect'
      const response = await this.request<AfterShipTrackingResponse>(
        'GET',
        `/trackings/${slug}/${trackingNumber}`
      )
      return response.data.tracking
    } catch (error) {
      console.error('[AfterShip] Error getting tracking:', error)
      return null
    }
  }

  /**
   * Detect carrier from tracking number
   */
  async detectCarrier(trackingNumber: string): Promise<string[]> {
    const response = await this.request<{
      meta: { code: number }
      data: { couriers: Array<{ slug: string; name: string }> }
    }>('POST', '/couriers/detect', {
      tracking: {
        tracking_number: trackingNumber
      }
    })

    return response.data.couriers.map(c => c.slug)
  }

  /**
   * Get all trackings with filters
   */
  async getTrackings(params?: {
    page?: number
    limit?: number
    tag?: string
    createdAfter?: Date
    createdBefore?: Date
    keyword?: string
  }): Promise<TrackingResult[]> {
    const query = new URLSearchParams()
    if (params?.page) query.set('page', params.page.toString())
    if (params?.limit) query.set('limit', params.limit.toString())
    if (params?.tag) query.set('tag', params.tag)
    if (params?.createdAfter) query.set('created_at_min', params.createdAfter.toISOString())
    if (params?.createdBefore) query.set('created_at_max', params.createdBefore.toISOString())
    if (params?.keyword) query.set('keyword', params.keyword)

    const response = await this.request<AfterShipTrackingsResponse>(
      'GET',
      `/trackings?${query.toString()}`
    )

    return response.data.trackings
  }

  /**
   * Delete a tracking
   */
  async deleteTracking(trackingNumber: string, carrier: string): Promise<boolean> {
    try {
      await this.request('DELETE', `/trackings/${carrier}/${trackingNumber}`)
      return true
    } catch (error) {
      console.error('[AfterShip] Error deleting tracking:', error)
      return false
    }
  }

  /**
   * Mark a tracking as completed
   */
  async markAsCompleted(trackingNumber: string, carrier: string): Promise<TrackingResult | null> {
    try {
      const response = await this.request<AfterShipTrackingResponse>(
        'POST',
        `/trackings/${carrier}/${trackingNumber}/mark-as-completed`,
        { tracking: { reason: 'DELIVERED' } }
      )
      return response.data.tracking
    } catch (error) {
      console.error('[AfterShip] Error marking as completed:', error)
      return null
    }
  }

  /**
   * Get our internal status from AfterShip tag
   */
  mapStatus(afterShipTag: string): string {
    return STATUS_MAP[afterShipTag] || 'UNKNOWN'
  }

  /**
   * Format tracking data for our delivery model
   */
  formatForDelivery(tracking: TrackingResult): {
    status: string
    carrier: string
    trackingUrl: string | null
    expectedDate: Date | null
    actualDate: Date | null
    signedBy: string | null
    lastUpdate: string
    checkpoints: Array<{
      status: string
      message: string
      location: string
      timestamp: Date
    }>
  } {
    return {
      status: this.mapStatus(tracking.tag),
      carrier: tracking.slug.toUpperCase(),
      trackingUrl: tracking.courierTrackingLink,
      expectedDate: tracking.expectedDelivery ? new Date(tracking.expectedDelivery) : null,
      actualDate: tracking.shipmentDeliveryDate ? new Date(tracking.shipmentDeliveryDate) : null,
      signedBy: tracking.signedBy,
      lastUpdate: tracking.lastUpdatedAt,
      checkpoints: tracking.checkpoints.map(cp => ({
        status: cp.tag,
        message: cp.message,
        location: [cp.city, cp.state, cp.countryName].filter(Boolean).join(', '),
        timestamp: new Date(cp.checkpoint_time)
      }))
    }
  }

  /**
   * Get list of supported carriers
   */
  async getCouriers(): Promise<Array<{ slug: string; name: string }>> {
    const response = await this.request<{
      meta: { code: number }
      data: { couriers: Array<{ slug: string; name: string }> }
    }>('GET', '/couriers')

    return response.data.couriers
  }
}

export const aftershipService = new AfterShipService()
