import { redirect } from 'next/navigation'
import { getSession } from '@/auth'

export default async function Home() {
  const session = await getSession()
  
  if (session) {
    redirect('/dashboard')
  } else {
    redirect('/auth/signin')
  }
}
