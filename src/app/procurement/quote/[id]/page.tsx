import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Old quote detail page - redirect to projects
export default async function QuoteDetailPage() {
  redirect('/projects')
}
