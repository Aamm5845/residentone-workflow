import React from 'react'
import { notFound } from 'next/navigation'
import ClientProgressView from '@/components/client-progress/ClientProgressView'

interface ClientProgressPageProps {
  params: { token: string }
}

export default async function ClientProgressPage({ params }: ClientProgressPageProps) {
  const { token } = await params

  // The data fetching will be handled client-side for better user experience
  // and to handle token validation errors gracefully
  
  return <ClientProgressView token={token} />
}

export async function generateMetadata({ params }: ClientProgressPageProps) {
  const { token } = await params
  
  return {
    title: 'Project Progress - ResidentOne',
    description: 'View your interior design project progress and download approved renderings',
    robots: 'noindex, nofollow', // Prevent search engines from indexing client links
  }
}