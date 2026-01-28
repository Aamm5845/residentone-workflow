/**
 * Ship24 Tracking API Integration
 * https://www.ship24.com/tracking-api
 */

const SHIP24_API_KEY = process.env.SHIP24_API_KEY
const SHIP24_BASE_URL = 'https://api.ship24.com/public/v1'

interface Ship24Event {
  eventCode: string
  eventName: string
  eventDate: string
  eventTime: string
  location: string
  locationId: string | null
  status: string
  statusCode: string
  statusCategory: string
  statusMilestone: string
}

interface Ship24Tracking {
  trackingNumber: string
  courierCode: string
  courierName: string
  estimatedDeliveryDate: string | null
  originCountry: string | null
  destinationCountry: string | null
  events: Ship24Event[]
  statistics: {
    timestamps: {
      infoReceivedAt: string | null
      inTransitAt: string | null
      outForDeliveryAt: string | null
      deliveredAt: string | null
    }
  }
}

interface Ship24Response {
  data: {
    trackings: Ship24Tracking[]
  }
}

export interface TrackingResult {
  success: boolean
  trackingNumber: string
  carrier: string | null
  carrierName: string | null
  status: 'PENDING' | 'IN_TRANSIT' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'EXCEPTION' | 'UNKNOWN'
  statusDescription: string | null
  estimatedDelivery: Date | null
  deliveredAt: Date | null
  lastLocation: string | null
  lastUpdate: Date | null
  events: Array<{
    date: Date
    status: string
    location: string
    description: string
  }>
  error?: string
}

/**
 * Create a tracker for a tracking number
 */
export async function createTracker(trackingNumber: string, courierCode?: string): Promise<{ trackerId: string } | null> {
  if (!SHIP24_API_KEY) {
    console.error('SHIP24_API_KEY not configured')
    return null
  }

  try {
    const response = await fetch(`${SHIP24_BASE_URL}/trackers`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SHIP24_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        trackingNumber,
        ...(courierCode && { courierCode })
      })
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Ship24 create tracker error:', error)
      return null
    }

    const data = await response.json()
    return { trackerId: data.data?.tracker?.trackerId }
  } catch (error) {
    console.error('Ship24 create tracker error:', error)
    return null
  }
}

/**
 * Get tracking info for a tracking number
 */
export async function getTracking(trackingNumber: string): Promise<TrackingResult> {
  if (!SHIP24_API_KEY) {
    return {
      success: false,
      trackingNumber,
      carrier: null,
      carrierName: null,
      status: 'UNKNOWN',
      statusDescription: null,
      estimatedDelivery: null,
      deliveredAt: null,
      lastLocation: null,
      lastUpdate: null,
      events: [],
      error: 'SHIP24_API_KEY not configured'
    }
  }

  try {
    const response = await fetch(`${SHIP24_BASE_URL}/trackers/search/${trackingNumber}/results`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${SHIP24_API_KEY}`,
        'Content-Type': 'application/json'
      }
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('Ship24 tracking error:', error)
      return {
        success: false,
        trackingNumber,
        carrier: null,
        carrierName: null,
        status: 'UNKNOWN',
        statusDescription: null,
        estimatedDelivery: null,
        deliveredAt: null,
        lastLocation: null,
        lastUpdate: null,
        events: [],
        error: `API error: ${response.status}`
      }
    }

    const data: Ship24Response = await response.json()
    const tracking = data.data?.trackings?.[0]

    if (!tracking) {
      return {
        success: true,
        trackingNumber,
        carrier: null,
        carrierName: null,
        status: 'PENDING',
        statusDescription: 'Tracking information not yet available',
        estimatedDelivery: null,
        deliveredAt: null,
        lastLocation: null,
        lastUpdate: null,
        events: []
      }
    }

    // Map Ship24 status to our status
    const latestEvent = tracking.events?.[0]
    let status: TrackingResult['status'] = 'UNKNOWN'

    if (latestEvent) {
      const milestone = latestEvent.statusMilestone?.toLowerCase() || ''
      const statusCat = latestEvent.statusCategory?.toLowerCase() || ''

      if (milestone.includes('delivered') || statusCat.includes('delivered')) {
        status = 'DELIVERED'
      } else if (milestone.includes('out_for_delivery') || statusCat.includes('out_for_delivery')) {
        status = 'OUT_FOR_DELIVERY'
      } else if (milestone.includes('transit') || statusCat.includes('transit') || milestone.includes('in_transit')) {
        status = 'IN_TRANSIT'
      } else if (milestone.includes('pending') || statusCat.includes('pending') || milestone.includes('info_received')) {
        status = 'PENDING'
      } else if (milestone.includes('exception') || statusCat.includes('exception') || statusCat.includes('failure')) {
        status = 'EXCEPTION'
      } else if (latestEvent.eventName) {
        status = 'IN_TRANSIT' // Default to in transit if we have events
      }
    }

    const deliveredAt = tracking.statistics?.timestamps?.deliveredAt
      ? new Date(tracking.statistics.timestamps.deliveredAt)
      : null

    return {
      success: true,
      trackingNumber,
      carrier: tracking.courierCode,
      carrierName: tracking.courierName,
      status,
      statusDescription: latestEvent?.eventName || null,
      estimatedDelivery: tracking.estimatedDeliveryDate ? new Date(tracking.estimatedDeliveryDate) : null,
      deliveredAt,
      lastLocation: latestEvent?.location || null,
      lastUpdate: latestEvent ? new Date(`${latestEvent.eventDate}T${latestEvent.eventTime}`) : null,
      events: (tracking.events || []).map(event => ({
        date: new Date(`${event.eventDate}T${event.eventTime}`),
        status: event.statusMilestone || event.status,
        location: event.location,
        description: event.eventName
      }))
    }
  } catch (error) {
    console.error('Ship24 tracking error:', error)
    return {
      success: false,
      trackingNumber,
      carrier: null,
      carrierName: null,
      status: 'UNKNOWN',
      statusDescription: null,
      estimatedDelivery: null,
      deliveredAt: null,
      lastLocation: null,
      lastUpdate: null,
      events: [],
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

/**
 * Map our status to OrderStatus
 */
export function mapTrackingStatusToOrderStatus(status: TrackingResult['status']): string {
  switch (status) {
    case 'DELIVERED':
      return 'DELIVERED'
    case 'OUT_FOR_DELIVERY':
    case 'IN_TRANSIT':
      return 'IN_TRANSIT'
    case 'PENDING':
      return 'SHIPPED'
    case 'EXCEPTION':
      return 'EXCEPTION'
    default:
      return 'SHIPPED'
  }
}
