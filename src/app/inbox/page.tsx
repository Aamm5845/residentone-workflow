import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Redirect /inbox to /messages for backward compatibility
export default async function InboxPage() {
  redirect('/messages')
}
