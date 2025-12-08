import { getSession } from '@/auth'
import { redirect } from 'next/navigation'
import DashboardLayout from '@/components/layout/dashboard-layout'
import ProductLibrary from '@/components/products/product-library'
import type { Session } from 'next-auth'

export const dynamic = 'force-dynamic'

export default async function ProductsPage() {
  const session = await getSession() as Session & {
    user: {
      id: string
      name: string
      orgId: string
      role: string
    }
  } | null
  
  if (!session?.user?.orgId) {
    redirect('/auth/signin')
  }

  return (
    <DashboardLayout session={session}>
      <ProductLibrary userId={session.user.id} />
    </DashboardLayout>
  )
}
