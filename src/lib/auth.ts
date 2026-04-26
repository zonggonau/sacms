import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import { db } from "@/lib/database"
import bcrypt from "bcrypt"

import { logAudit, AuditAction } from "@/lib/audit-log"

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  // Support legacy simpleHash passwords for migration
  if (!hashedPassword.startsWith("$2")) {
    const legacyHash = legacySimpleHash(password)
    return hashedPassword === legacyHash || hashedPassword === password
  }
  return bcrypt.compare(password, hashedPassword)
}

// Legacy hash for backward compatibility - will be migrated on next login
function legacySimpleHash(password: string): string {
  let hash = 0
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return hash.toString(16)
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    // OAuth Providers
    ...(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
      ? [GoogleProvider({
          clientId: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        })]
      : []),
    ...(process.env.GITHUB_ID && process.env.GITHUB_SECRET
      ? [GitHubProvider({
          clientId: process.env.GITHUB_ID,
          clientSecret: process.env.GITHUB_SECRET,
        })]
      : []),
    // Credentials Provider
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email },
          include: {
            tenants: {
              include: {
                tenant: true,
              },
            },
          },
        })

        if (!user || !user.password) {
          return null
        }

        // Verify password with bcrypt (supports legacy migration)
        const isValid = await verifyPassword(credentials.password, user.password)
        if (!isValid) {
          return null
        }

        // Auto-migrate legacy passwords to bcrypt on successful login
        if (!user.password.startsWith("$2")) {
          const newHash = await hashPassword(credentials.password)
          await db.user.update({
            where: { id: user.id },
            data: { password: newHash },
          }).catch(() => {})
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
          tenants: user.tenants.map((t) => ({
            id: t.tenant.id,
            slug: t.tenant.slug,
            name: t.tenant.name,
            role: t.role,
          })),
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id
        token.role = user.role || "user"
        token.plan = user.plan || "free"
        token.tenants = user.tenants || []
      }
      // For OAuth sign-in, load user data from DB
      if (account && account.type !== "credentials" && token.id) {
        const dbUser = await db.user.findUnique({
          where: { id: token.id as string },
          include: {
            tenants: { include: { tenant: true } },
          },
        })
        if (dbUser) {
          token.role = dbUser.role
          token.plan = dbUser.plan
          token.tenants = dbUser.tenants.map((t) => ({
            id: t.tenant.id,
            slug: t.tenant.slug,
            name: t.tenant.name,
            role: t.role,
          }))
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id as string
        session.user.role = token.role as string
        session.user.plan = token.plan as string
        session.user.tenants = token.tenants as Array<{
          id: string
          slug: string
          name: string
          role: string
        }>
      }
      return session
    },
  },
  events: {
    async signIn({ user }) {
      // Update last login time and log
      if (user.id) {
        await db.user.update({
          where: { id: user.id },
          data: { updatedAt: new Date() },
        }).catch(() => {})
        logAudit({
          userId: user.id,
          action: AuditAction.LOGIN,
          entity: "User",
          entityId: user.id,
        })
      }
    },
  },
}

declare module "next-auth" {
  interface User {
    role: string
    plan: string
    tenants: Array<{
      id: string
      slug: string
      name: string
      role: string
    }>
  }
  interface Session {
    user: User & {
      id: string
      email: string
      name: string
      role: string
      plan: string
      tenants: Array<{
        id: string
        slug: string
        name: string
        role: string
      }>
    }
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string
    role: string
    plan: string
    tenants: Array<{
      id: string
      slug: string
      name: string
      role: string
    }>
  }
}
