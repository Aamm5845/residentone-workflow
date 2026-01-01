import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Old procurement analytics - redirect to projects
export default async function ProcurementAnalyticsPage() {
  redirect('/projects')
}
