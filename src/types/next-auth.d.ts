import { DefaultSession } from 'next-auth'
import { UserRole } from '@prisma/client'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      role: UserRole
      orgId: string
      orgName: string
    } & DefaultSession['user']
  }

  interface User {
    role: UserRole
    orgId: string
    orgName: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role: UserRole
    orgId: string
    orgName: string
  }
}
