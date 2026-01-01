import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Old order detail page - redirect to projects
export default async function OrderDetailPage() {
  redirect('/projects')
}
