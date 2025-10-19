import { useState, useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import { useSession } from 'next-auth/react'
import { toast } from 'react-hot-toast'
import { RoomType, FFETemplateStatus, FFEItemState } from '@prisma/client'

// Types
interface APIResponse<T> {
  success: boolean
  data: T
  count?: number
  message?: string
}

interface APIError {
  error: string
  details?: any
}

// Fetcher function
const fetcher = async (url: string) => {
  const response = await fetch(url)
  const data = await response.json()
  
  if (!response.ok) {
    throw new Error(data.error || 'An error occurred')
  }
  
  return data
}

// POST/PUT/DELETE helper
const mutationFetcher = async (url: string, options: RequestInit) => {
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  })
  
  let data
  try {
    data = await response.json()
  } catch (jsonError) {
    console.error('❌ Failed to parse API response as JSON:', jsonError)
    console.error('❌ Response status:', response.status)
    console.error('❌ Response headers:', Object.fromEntries(response.headers.entries()))
    const responseText = await response.text()
    console.error('❌ Response text:', responseText)
    throw new Error(`API request failed with status ${response.status}: Unable to parse JSON response`)
  }

  if (!response.ok) {
    console.error('❌ API Error:', { status: response.status, error: data?.error, details: data?.details, fullResponse: data })
    throw new Error(data?.error || `API request failed with status ${response.status}: ${JSON.stringify(data)}`)
  }
  
  return data
}

// FFE Templates API Hooks
export function useFFETemplates(orgId?: string, filters?: {
  status?: FFETemplateStatus
  search?: string
}) {
  const { data: session } = useSession()
  
  const queryParams = new URLSearchParams()
  if (orgId) queryParams.set('orgId', orgId)
  if (filters?.status) queryParams.set('status', filters.status)
  if (filters?.search) queryParams.set('search', filters.search)
  
  const key = session && orgId ? `/api/ffe/v2/templates?${queryParams.toString()}` : null

  const { data, error, isLoading, mutate: revalidate } = useSWR<APIResponse<any[]>>(
    key,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
      errorRetryCount: 0, // Disable retries to prevent blinking
      fallbackData: { data: [], count: 0, success: true }, // Provide fallback
    }
  )
  
  return {
    templates: data?.data || [],
    count: data?.count || 0,
    isLoading,
    error,
    revalidate,
  }
}

export function useFFETemplate(templateId: string) {
  const { data: session } = useSession()
  
  const key = session && templateId ? `/api/ffe/v2/templates/${templateId}` : null
  
  const { data, error, isLoading, mutate: revalidate } = useSWR<APIResponse<any>>(
    key,
    fetcher
  )
  
  return {
    template: data?.data || null,
    isLoading,
    error,
    revalidate,
  }
}

// Room FFE Instance API Hooks
export function useRoomFFEInstance(roomId: string) {
  const { data: session } = useSession()
  
  const key = session && roomId ? `/api/ffe/v2/rooms/${roomId}` : null
  
  const { data, error, isLoading, mutate: revalidate } = useSWR<APIResponse<any>>(
    key,
    fetcher,
    {
      revalidateOnFocus: true,
      refreshInterval: 30000, // Refresh every 30 seconds for active rooms
    }
  )
  
  return {
    instance: data?.data || null,
    isLoading,
    error,
    revalidate,
  }
}

// Mutation Hooks
export function useFFETemplateMutations() {
  const createTemplate = async (templateData: any) => {
    try {
      const result = await mutationFetcher('/api/ffe/v2/templates', {
        method: 'POST',
        body: JSON.stringify(templateData),
      })
      
      // Optimistically update the templates list
      mutate(
        (key) => typeof key === 'string' && key.startsWith('/api/ffe/v2/templates?'),
        undefined,
        { revalidate: true }
      )
      
      toast.success('Template created successfully')
      return result.data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create template')
      throw error
    }
  }
  
  const updateTemplate = async (templateId: string, updates: any) => {
    try {
      const result = await mutationFetcher(`/api/ffe/v2/templates/${templateId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
      
      // Update specific template
      mutate(`/api/ffe/v2/templates/${templateId}`, result, false)
      
      // Update templates list
      mutate(
        (key) => typeof key === 'string' && key.startsWith('/api/ffe/v2/templates?'),
        undefined,
        { revalidate: true }
      )
      
      toast.success('Template updated successfully')
      return result.data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update template')
      throw error
    }
  }
  
  const deleteTemplate = async (templateId: string) => {
    try {
      
      const result = await mutationFetcher(`/api/ffe/v2/templates/${templateId}`, {
        method: 'DELETE',
      })

      // Remove from templates list
      mutate(
        (key) => typeof key === 'string' && key.startsWith('/api/ffe/v2/templates?'),
        undefined,
        { revalidate: true }
      )

      toast.success('Template deleted successfully')
    } catch (error) {
      console.error('❌ Failed to delete template:', error);
      console.error('❌ Error details:', { 
        templateId, 
        error: error instanceof Error ? error.message : error,
        stack: error instanceof Error ? error.stack : undefined
      });
      toast.error(error instanceof Error ? error.message : 'Failed to delete template')
      throw error
    }
  }
  
  const copyTemplate = async (templateId: string, newName: string) => {
    try {
      const result = await mutationFetcher(`/api/ffe/v2/templates/${templateId}/copy`, {
        method: 'POST',
        body: JSON.stringify({ name: newName }),
      })
      
      // Update templates list
      mutate(
        (key) => typeof key === 'string' && key.startsWith('/api/ffe/v2/templates?'),
        undefined,
        { revalidate: true }
      )
      
      toast.success('Template copied successfully')
      return result.data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to copy template')
      throw error
    }
  }
  
  return {
    createTemplate,
    updateTemplate,
    deleteTemplate,
    copyTemplate,
  }
}

export function useRoomFFEMutations() {
  const createRoomInstance = async (roomId: string, instanceData: any) => {
    try {
      const result = await mutationFetcher(`/api/ffe/v2/rooms/${roomId}`, {
        method: 'POST',
        body: JSON.stringify(instanceData),
      })
      
      // Update room instance
      mutate(`/api/ffe/v2/rooms/${roomId}`, result, false)
      
      toast.success('FFE instance created successfully')
      return result.data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create FFE instance')
      throw error
    }
  }
  
  const updateRoomInstance = async (roomId: string, updates: any) => {
    try {
      const result = await mutationFetcher(`/api/ffe/v2/rooms/${roomId}`, {
        method: 'PUT',
        body: JSON.stringify(updates),
      })
      
      // Optimistically update room instance
      mutate(`/api/ffe/v2/rooms/${roomId}`, result, false)
      
      toast.success('FFE instance updated successfully')
      return result.data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update FFE instance')
      throw error
    }
  }
  
  return {
    createRoomInstance,
    updateRoomInstance,
  }
}

// Item-specific mutations
export function useFFEItemMutations() {
  const updateItemState = async (roomId: string, itemId: string, state: FFEItemState, notes?: string) => {
    try {
      const updates = { itemId, state, ...(notes !== undefined && { notes }) }
      
      const result = await mutationFetcher(`/api/ffe/v2/rooms/${roomId}/items`, {
        method: 'PATCH',
        body: JSON.stringify(updates),
      })
      
      // Revalidate room instance
      mutate(`/api/ffe/v2/rooms/${roomId}`)
      
      return result.data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update item state')
      throw error
    }
  }
  
  const deleteItem = async (roomId: string, itemId: string) => {
    try {
      await mutationFetcher(`/api/ffe/v2/rooms/${roomId}/items?itemId=${itemId}`, {
        method: 'DELETE',
      })
      
      // Revalidate room instance
      mutate(`/api/ffe/v2/rooms/${roomId}`)
      
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete item')
      throw error
    }
  }
  
  const bulkDeleteItems = async (roomId: string, itemIds: string[]) => {
    try {
      await mutationFetcher(`/api/ffe/v2/rooms/${roomId}/items?itemIds=${itemIds.join(',')}`, {
        method: 'DELETE',
      })
      
      // Revalidate room instance
      mutate(`/api/ffe/v2/rooms/${roomId}`)
      
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete items')
      throw error
    }
  }
  
  const duplicateItem = async (roomId: string, itemId: string) => {
    try {
      const result = await mutationFetcher(`/api/ffe/v2/rooms/${roomId}/items/${itemId}/duplicate`, {
        method: 'POST',
      })
      
      // Revalidate room instance
      mutate(`/api/ffe/v2/rooms/${roomId}`)
      
      return result.data
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to duplicate item')
      throw error
    }
  }

  return {
    updateItemState,
    deleteItem,
    bulkDeleteItems,
    duplicateItem,
  }
}

// Sections API Hooks (placeholder)
export function useFFESections() {
  const { data: session } = useSession()
  
  const key = session ? '/api/ffe/v2/sections' : null
  
  const { data, error, isLoading, mutate: revalidate } = useSWR<APIResponse<any[]>>(
    key,
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      dedupingInterval: 60000,
      errorRetryCount: 0, // Disable retries to prevent blinking
      fallbackData: { 
        data: [
          { id: '1', name: 'Flooring', description: 'Flooring materials and finishes', defaultOrder: 1 },
          { id: '2', name: 'Lighting', description: 'Light fixtures and electrical', defaultOrder: 2 },
          { id: '3', name: 'Furniture', description: 'Furniture pieces and seating', defaultOrder: 3 },
          { id: '4', name: 'Window Treatments', description: 'Curtains, blinds, and shades', defaultOrder: 4 },
          { id: '5', name: 'Hardware', description: 'Door handles, knobs, and fixtures', defaultOrder: 5 },
          { id: '6', name: 'Accessories', description: 'Decorative items and artwork', defaultOrder: 6 },
          { id: '7', name: 'Textiles', description: 'Rugs, pillows, and fabrics', defaultOrder: 7 },
          { id: '8', name: 'Storage', description: 'Shelving and organizational items', defaultOrder: 8 },
          { id: '9', name: 'Plumbing Fixtures', description: 'Faucets, sinks, and bathroom fixtures', defaultOrder: 9 }
        ], 
        count: 9, 
        success: true 
      },
    }
  )
  
  // Always ensure sections are available
  const sections = data?.data || [
    { id: '1', name: 'Flooring', description: 'Flooring materials and finishes', defaultOrder: 1 },
    { id: '2', name: 'Lighting', description: 'Light fixtures and electrical', defaultOrder: 2 },
    { id: '3', name: 'Furniture', description: 'Furniture pieces and seating', defaultOrder: 3 },
    { id: '4', name: 'Window Treatments', description: 'Curtains, blinds, and shades', defaultOrder: 4 },
    { id: '5', name: 'Hardware', description: 'Door handles, knobs, and fixtures', defaultOrder: 5 },
    { id: '6', name: 'Accessories', description: 'Decorative items and artwork', defaultOrder: 6 },
    { id: '7', name: 'Textiles', description: 'Rugs, pillows, and fabrics', defaultOrder: 7 },
    { id: '8', name: 'Storage', description: 'Shelving and organizational items', defaultOrder: 8 },
    { id: '9', name: 'Plumbing Fixtures', description: 'Faucets, sinks, and bathroom fixtures', defaultOrder: 9 }
  ];
  
  return {
    sections,
    count: sections.length,
    isLoading,
    error,
    revalidate,
  }
}

// Combined API Hook for Template Management
export function useFFEApi(orgId: string) {
  const templatesQuery = useFFETemplates(orgId)
  const sectionsQuery = useFFESections()
  const templateMutations = useFFETemplateMutations()
  
  return {
    templates: {
      data: templatesQuery.templates,
      isLoading: templatesQuery.isLoading,
      error: templatesQuery.error,
      refetch: templatesQuery.revalidate,
    },
    sections: {
      data: sectionsQuery.sections,
      isLoading: sectionsQuery.isLoading,
      error: sectionsQuery.error,
      refetch: sectionsQuery.revalidate,
    },
    createTemplate: {
      mutateAsync: async (data: any) => {
        return await templateMutations.createTemplate(data)
      },
      isLoading: false, // SWR mutations don't have loading state by default
    },
    updateTemplate: {
      mutateAsync: async (params: { id: string; data: any }) => {
        return await templateMutations.updateTemplate(params.id, params.data)
      },
      isLoading: false,
    },
    deleteTemplate: {
      mutateAsync: async (id: string) => {
        await templateMutations.deleteTemplate(id)
      },
      isLoading: false,
    },
    copyTemplate: {
      mutateAsync: async (params: { id: string; name: string }) => {
        return await templateMutations.copyTemplate(params.id, params.name)
      },
      isLoading: false,
    },
  }
}

// Utility hooks
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)
    
    return () => {
      clearTimeout(handler)
    }
  }, [value, delay])
  
  return debouncedValue
}