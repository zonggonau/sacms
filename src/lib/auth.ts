import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import { db } from "@/lib/database"
import bcrypt from "bcrypt"
import crypto from "crypto"
import { sendVerificationEmail } from "@/lib/mail"

import { logAudit, AuditAction } from "@/lib/audit-log"

const SALT_ROUNDS = 12

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS)
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  // Support legacy simpleHash passwords for migration
  if (!hashedPassword.startsWith("$2")) {
    const legacyHash = legacySimpleHash(password)
    // B7 Fix: Only compare via legacy hash — never compare raw plaintext passwords
    return hashedPassword === legacyHash
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

const useSecureCookies = process.env.NODE_ENV === "production"
const cookiePrefix = useSecureCookies ? "__Secure-" : ""
const appHost = (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
  .replace(/^https?:\/\//, "")
  .split(":")[0]
const wildcardDomain = appHost === "localhost" ? undefined : `.${appHost}`

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies,
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: useSecureCookies,
        domain: wildcardDomain, // Enables shared session across subdomains!
      },
    },
  },
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

        // Check if email is verified
        if (user.emailVerified === null) {
          // Generate new verification token
          const token = crypto.randomBytes(32).toString("hex")
          const expires = new Date()
          expires.setHours(expires.getHours() + 24)

          // Delete existing token if any
          await db.verificationToken.deleteMany({
            where: { identifier: user.email }
          })

          await db.verificationToken.create({
            data: {
              identifier: user.email,
              token,
              expires,
            },
          })

          // Send email
          await sendVerificationEmail(user.email, token, user.name || "User")

          throw new Error("Email belum diverifikasi. Tautan verifikasi baru telah dikirim ke email Anda.")
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
          tenants: user.tenants
            .filter((t) => t.tenant.slug !== "sacms-global")
            .map((t) => ({
              id: t.tenant.id,
              slug: t.tenant.slug,
              name: t.tenant.name,
              role: t.role,
              customPermissions: t.customPermissions,
            })),
        }
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account, trigger, session }) {
      if (trigger === "update") {
        if (session?.name) {
          token.name = session.name
        }
        // Securely refetch plan from DB on update trigger
        if (token.id) {
          const dbUser = await db.user.findUnique({ where: { id: token.id as string }, select: { plan: true } })
          if (dbUser) token.plan = dbUser.plan
        }
      }
      
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
          token.tenants = dbUser.tenants
            .filter((t) => t.tenant.slug !== "sacms-global")
            .map((t) => ({
              id: t.tenant.id,
              slug: t.tenant.slug,
              name: t.tenant.name,
              role: t.role,
              customPermissions: t.customPermissions,
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
        if (token.name) session.user.name = token.name
        session.user.tenants = token.tenants as Array<{
          id: string
          slug: string
          name: string
          role: string
          customPermissions?: any
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
      customPermissions?: any
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
        customPermissions?: any
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
      customPermissions?: any
    }>
  }
}
