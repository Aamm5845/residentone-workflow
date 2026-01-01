import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Old procurement page - redirect to projects
// Procurement is now accessed per-project at /projects/[id]/procurement
export default async function ProcurementPage() {
  redirect('/projects')
}
