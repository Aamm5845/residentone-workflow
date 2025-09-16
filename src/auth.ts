import NextAuth from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { UserRole } from '@prisma/client'

export default NextAuth({
  session: {
    strategy: 'jwt',
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          console.log('Missing credentials')
          return null
        }

        try {
          console.log('🔐 Auth attempt for:', credentials.email)
          
          const user = await prisma.user.findUnique({
            where: {
              email: credentials.email as string
            },
            include: {
              organization: true
            }
          })

          if (!user) {
            console.log('❌ User not found:', credentials.email)
            return null
          }
          
          if (!user.password) {
            console.log('❌ User has no password:', credentials.email)
            return null
          }
          
          console.log('✅ User found, checking password...')
          const isPasswordValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          )

          if (!isPasswordValid) {
            console.log('❌ Invalid password for:', credentials.email)
            return null
          }

          console.log('🎉 Authentication successful for:', user.email)
          const authUser = {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            orgId: user.orgId,
            orgName: user.organization.name,
          }
          console.log('📤 Returning user data:', { email: authUser.email, role: authUser.role })
          return authUser
          
        } catch (error) {
          console.error('💥 Database auth error:', error)
          
          // Fallback authentication for demo
          if (credentials.email === 'admin@example.com' && credentials.password === 'password') {
            console.log('🔄 Using fallback authentication for demo')
            return {
              id: 'fallback-admin',
              email: 'admin@example.com',
              name: 'Admin User',
              role: 'OWNER' as UserRole,
              orgId: 'fallback-org',
              orgName: 'Interior Design Studio'
            }
          }
          
          return null
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      console.log('📝 JWT callback - user:', !!user, 'token.sub:', token.sub)
      if (user) {
        console.log('✅ JWT: Adding user data to token')
        return {
          ...token,
          role: user.role,
          orgId: user.orgId,
          orgName: user.orgName,
        }
      }
      return token
    },
    async session({ session, token }) {
      console.log('📝 Session callback - token.sub:', token.sub, 'role:', token.role)
      const enhancedSession = {
        ...session,
        user: {
          ...session.user,
          id: token.sub,
          role: token.role as UserRole,
          orgId: token.orgId as string,
          orgName: token.orgName as string,
        },
      }
      console.log('✅ Session: Returning enhanced session')
      return enhancedSession
    },
  },
  pages: {
    signIn: '/auth/signin',
  },
})
