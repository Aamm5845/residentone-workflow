import { redirect } from 'next/navigation'

interface FFESettingsPageProps {
  params: Promise<{
    roomId: string
  }>
}

// Settings page now redirects to unified workspace
export default async function FFESettingsPage({ params }: FFESettingsPageProps) {
  const resolvedParams = await params
  // Redirect to the unified workspace - settings is now merged into workspace
  redirect(`/ffe/${resolvedParams.roomId}/workspace`)
}
