import { redirect } from 'next/navigation'

interface Props {
  params: { id: string }
}

// Redirect old spec-book URL to new specs URL
export default async function SpecBookPage({ params }: Props) {
  const { id } = await params
  redirect(`/projects/${id}/specs`)
}
