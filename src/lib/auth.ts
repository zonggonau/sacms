import { NextAuthOptions } from "next-auth"
import CredentialsProvider from "next-auth/providers/credentials"
import GoogleProvider from "next-auth/providers/google"
import GitHubProvider from "next-auth/providers/github"
import { PrismaAdapter } from "@next-auth/prisma-adapter"
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

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(db),
  secret: process.env.NEXTAUTH_SECRET,
  useSecureCookies: process.env.NODE_ENV === "production",
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
          const { isMailConfigured, getGlobalWorkspaceId } = await import("@/lib/settings")
          const hasMailService = await isMailConfigured()

          if (!hasMailService) {
            // Auto-verify user if platform has no email delivery service configured
            await db.user.update({
              where: { id: user.id },
              data: { emailVerified: new Date() },
            })
          } else {
            // Check existing active verification token
            const existingToken = await db.verificationToken.findFirst({
              where: { identifier: user.email },
              orderBy: { expires: "desc" },
            })

            const now = new Date()
            const isTokenExpired = !existingToken || existingToken.expires <= now
            
            // If a token was generated less than 2 minutes ago, prevent duplicate email blast
            const tokenCreatedAt = existingToken ? new Date(existingToken.expires.getTime() - 24 * 60 * 60 * 1000) : null
            const isRecentlySent = tokenCreatedAt && (now.getTime() - tokenCreatedAt.getTime() < 2 * 60 * 1000)

            if (isRecentlySent) {
              throw new Error("Akun Anda belum aktif. Email aktivasi baru saja dikirimkan (berlaku 24 jam). Silakan periksa kotak masuk atau folder spam.")
            }

            // Generate fresh verification token valid for 24 hours (1 day)
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

            try {
              await sendVerificationEmail(user.email, token, user.name || "User")
            } catch (err) {
              console.error("Failed to send verification email on login:", err)
              // If email fails to send, auto-verify user to avoid permanent lockout
              await db.user.update({
                where: { id: user.id },
                data: { emailVerified: new Date() },
              })
              const globalTenantId = await getGlobalWorkspaceId()
              return {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role,
                plan: user.plan || "free",
                tenants: user.tenants || [],
                globalTenantId,
              }
            }

            if (isTokenExpired) {
              throw new Error("Tautan aktivasi sebelumnya telah kadaluarsa. Tautan aktivasi baru telah dikirimkan ke email Anda (berlaku 24 jam). Silakan cek kotak masuk.")
            } else {
              throw new Error("Akun Anda belum aktif. Tautan aktivasi baru telah dikirimkan ke email Anda (berlaku 24 jam). Silakan periksa kotak masuk atau spam.")
            }
          }
        }

        // Auto-migrate legacy passwords to bcrypt on successful login
        if (!user.password.startsWith("$2")) {
          const newHash = await hashPassword(credentials.password)
          await db.user.update({
            where: { id: user.id },
            data: { password: newHash },
          }).catch(() => {})
        }

        const { getGlobalWorkspaceId } = await import("@/lib/settings")
        const globalTenantId = await getGlobalWorkspaceId()

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          plan: user.plan,
          image: user.image,
          tenants: user.tenants
            .filter((t) => t.tenant.id !== globalTenantId && t.tenant.slug !== globalTenantId)
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
        if (session?.image !== undefined) {
          token.picture = session.image
        }
        // Securely refetch plan & profile from DB on update trigger
        if (token.id) {
          const dbUser = await db.user.findUnique({ where: { id: token.id as string }, select: { plan: true, name: true, image: true } })
          if (dbUser) {
            token.plan = dbUser.plan
            if (dbUser.name) token.name = dbUser.name
            token.picture = dbUser.image
          }
        }
      }
      
      if (user) {
        token.id = user.id
        token.role = user.role || "user"
        token.plan = user.plan || "free"
        token.tenants = user.tenants || []
        token.picture = user.image
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
          const { getGlobalWorkspaceId } = await import("@/lib/settings")
          const globalTenantId = await getGlobalWorkspaceId()
          
          token.role = dbUser.role
          token.plan = dbUser.plan
          token.picture = dbUser.image
          token.tenants = dbUser.tenants
            .filter((t) => t.tenant.id !== globalTenantId && t.tenant.slug !== globalTenantId)
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
        session.user.image = (token.picture as string) || null
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
