import NextAuth, { authOptions } from '@/auth'

const handler = NextAuth

export { handler as GET, handler as POST, authOptions }
