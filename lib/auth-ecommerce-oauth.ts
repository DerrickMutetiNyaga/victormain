import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

export const { handlers, auth, signIn } = NextAuth({
  trustHost: true,
  basePath: "/api/ecommerce/oauth",
  session: {
    strategy: "jwt",
    maxAge: 10 * 60,
  },
  cookies: {
    sessionToken: {
      name: (() => {
        const isProduction =
          process.env.NODE_ENV === "production" ||
          process.env.NEXTAUTH_URL?.startsWith("https://")
        const prefix = isProduction ? "__Secure-" : ""
        return `${prefix}shop.oauth-session-token`
      })(),
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure:
          process.env.NODE_ENV === "production" ||
          process.env.NEXTAUTH_URL?.startsWith("https://"),
      },
    },
  },
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account?.provider === "google" && account.providerAccountId) {
        ;(token as any).googleSub = account.providerAccountId
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as any).googleSub = (token as any).googleSub
      }
      return session
    },
  },
  pages: {
    signIn: "/auth",
    error: "/auth",
  },
})
