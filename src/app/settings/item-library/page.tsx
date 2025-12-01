import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import ItemLibrarySettings from '@/components/settings/ItemLibrarySettings'

export const metadata = {
  title: 'Item Library Settings | StudioFlow',
  description: 'Manage your design concept item library categories and items',
}

export default async function ItemLibrarySettingsPage() {
  const session = await getSession()
  
  if (!session?.user) {
    redirect('/auth/signin')
  }

  // Fetch categories
  const categories = await prisma.designConceptCategory.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  })

  // Fetch all library items grouped by category
  const items = await prisma.designConceptItemLibrary.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
  })

  // Group items by category
  const itemsByCategory: Record<string, typeof items> = {}
  items.forEach(item => {
    if (!itemsByCategory[item.category]) {
      itemsByCategory[item.category] = []
    }
    itemsByCategory[item.category].push(item)
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto py-8 px-4">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Item Library Settings</h1>
          <p className="text-gray-600 mt-2">
            Manage categories and items in your design concept library. Drag to reorder, click to edit.
          </p>
        </div>
        
        <ItemLibrarySettings 
          initialCategories={categories}
          initialItemsByCategory={itemsByCategory}
        />
      </div>
    </div>
  )
}

