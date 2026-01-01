import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Old supplier detail page - redirect to projects
export default async function SupplierDetailPage() {
  redirect('/projects')
}
