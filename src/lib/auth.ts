import NextAuth, { NextAuthOptions, getServerSession } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import { prisma } from '@/lib/prisma'
import type { Session } from "next-auth"

// ✅ Define and export authOptions
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" }
      },
      async authorize(credentials) {
        if (!credentials?.email) return null
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: { organization: true }
          })
          if (!user) return null

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            orgId: user.orgId,
            orgName: user.organization?.name
          }
        } catch (error) {
          console.warn("Error in authorize:", error)
          return null
        }
      }
    })
  ],
  session: {
    strategy: "jwt"
  }
}

export default NextAuth(authOptions)

// ✅ getSession wrapper with your fallback logic
export async function getSession() {
  try {
    const session = (await getServerSession(authOptions)) as Session | null

    if (session?.user?.email) {
      try {
        // Try to get user details from database
        const user = await prisma.user.findUnique({
          where: { email: session.user.email },
          include: { organization: true }
        })

        if (user) {
          return {
            ...session,
            user: {
              ...session.user,
              id: user.id,
              role: user.role,
              orgId: user.orgId,
              orgName: user.organization.name
            }
          }
        }
      } catch (dbError) {
        console.warn("Database unavailable, using fallback auth")

        // Return enhanced session with fallback orgId when database fails
        return {
          ...session,
          user: {
            ...session.user,
            id:
              session.user?.email === "admin@example.com"
                ? "fallback-admin"
                : "fallback-user",
            role:
              session.user?.email === "admin@example.com"
                ? "OWNER"
                : "DESIGNER",
            orgId: "fallback-org",
            orgName: "Interior Design Studio"
          }
        }
      }
    }

    // No NextAuth session, return null
    return null
  } catch (error) {
    console.warn("NextAuth unavailable, checking for fallback auth")

    // If NextAuth fails completely, create a mock session for fallback auth
    return {
      user: {
        id: "fallback-admin",
        email: "admin@example.com",
        name: "Admin User",
        role: "OWNER",
        orgId: "fallback-org",
        orgName: "Interior Design Studio"
      },
      expires: "2025-12-31T23:59:59.999Z"
    } as Session
  }
}
