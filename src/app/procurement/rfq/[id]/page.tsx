import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Old RFQ detail page - redirect to projects
// RFQs are now accessed per-project at /projects/[id]/procurement
export default async function RFQDetailPage() {
  redirect('/projects')
}
